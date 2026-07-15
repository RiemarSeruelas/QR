import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import { readDb, writeDb, getDbPath } from "./dataStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 5057);
const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

app.use(cors());
app.use(express.json({ limit: "20mb" }));

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "field";
}

function getPublicBaseUrl(req) {
  const configured = normalizeText(process.env.PUBLIC_APP_URL);
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, "");
}

function makeItemUrl(req, qrId) {
  return `${getPublicBaseUrl(req)}/item/${encodeURIComponent(qrId)}`;
}

function getQrPayload(req, qrId) {
  const mode = normalizeText(process.env.QR_PAYLOAD_MODE || "url").toLowerCase();
  if (["code", "id", "qr-id", "qr_id"].includes(mode)) {
    return `MACHINEQR:${qrId}`;
  }
  return makeItemUrl(req, qrId);
}

function makeBrandedQrSvg(rawSvg) {
  const badge = `
  <rect x="208" y="208" width="144" height="144" rx="28" fill="#ffffff" stroke="#0f62fe" stroke-width="6"/>
  <circle cx="280" cy="280" r="50" fill="#0f62fe"/>
  <text x="280" y="276" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#ffffff">U</text>
  <text x="280" y="303" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="800" fill="#ffffff">Unilever</text>`;
  return rawSvg.replace("</svg>", `${badge}\n</svg>`);
}

async function createBrandedQrDataUrl(payload) {
  const rawSvg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 560,
    color: {
      dark: "#122033",
      light: "#ffffff"
    }
  });
  const brandedSvg = makeBrandedQrSvg(rawSvg);
  return `data:image/svg+xml;base64,${Buffer.from(brandedSvg).toString("base64")}`;
}

async function ensureBrandedQrForItem(req, item) {
  const expectedPayload = getQrPayload(req, item.qrId);
  if (item.qrBrand === "unilever-v1" && item.qrImageDataUrl && item.qrPayload === expectedPayload) return false;
  item.qrPayload = expectedPayload;
  item.qrImageDataUrl = await createBrandedQrDataUrl(item.qrPayload);
  item.qrBrand = "unilever-v1";
  item.updatedAt = nowIso();
  return true;
}

function getItemValidity(item) {
  const archived = Boolean(item.archivedAt);
  const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
  const invalidDate = !expiresAt || Number.isNaN(expiresAt.getTime());
  const expired = invalidDate || expiresAt.getTime() < Date.now();
  const daysLeft = invalidDate
    ? null
    : Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return {
    status: archived ? "archived" : expired ? "expired" : "valid",
    isExpired: expired,
    isArchived: archived,
    daysLeft
  };
}

const ROLE_LABELS = {
  security: "Security",
  engineering: "Engineering",
  all: "Full Admin"
};

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  if (["security", "engineering", "all"].includes(role)) return role;
  if (["admin", "superadmin", "full"].includes(role)) return "all";
  return "";
}

function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || normalizeText(role) || "Admin";
}

function defaultAdminUsers() {
  return [
    { id: "admin-security", username: "security", password: "1234", role: "security", displayName: "Security Admin", createdAt: nowIso() },
    { id: "admin-engineering", username: "engineering", password: "1234", role: "engineering", displayName: "Engineering Admin", createdAt: nowIso() },
    { id: "admin-full", username: "admin", password: "1234", role: "all", displayName: "Full Admin", createdAt: nowIso() }
  ];
}

function ensureAdminUsers(db) {
  let changed = false;
  const existing = Array.isArray(db.adminUsers) ? db.adminUsers : [];
  const usersByName = new Map(existing.map((user) => [normalizeText(user.username).toLowerCase(), user]));
  for (const user of defaultAdminUsers()) {
    const key = normalizeText(user.username).toLowerCase();
    if (!usersByName.has(key)) {
      existing.push(user);
      changed = true;
    }
  }
  db.adminUsers = existing.map((user) => ({
    ...user,
    role: normalizeRole(user.role) || "security",
    displayName: normalizeText(user.displayName) || normalizeText(user.username) || "Admin"
  }));
  return changed;
}

function categoryApprovalFlow(categoryName) {
  const name = normalizeText(categoryName).toLowerCase();
  if (name.includes("device")) return ["engineering", "security"];
  if (name.includes("machine")) return ["security", "engineering"];
  if (name.includes("tool")) return ["security", "engineering"];
  return ["security", "engineering"];
}

function ensureRequestWorkflow(request) {
  let changed = false;
  const flow = Array.isArray(request.approvalFlow) && request.approvalFlow.length
    ? request.approvalFlow.map(normalizeRole).filter((role) => role && role !== "all")
    : categoryApprovalFlow(request.categoryName);

  if (!Array.isArray(request.approvalFlow) || request.approvalFlow.join("|") !== flow.join("|")) {
    request.approvalFlow = flow;
    changed = true;
  }
  if (!Array.isArray(request.approvals)) {
    request.approvals = [];
    changed = true;
  }

  const approvedRoles = new Set(request.approvals.map((entry) => normalizeRole(entry.role)).filter(Boolean));
  const nextRole = flow.find((role) => !approvedRoles.has(role)) || "";

  if (request.status === "pending") {
    if (request.currentApprovalRole !== nextRole) {
      request.currentApprovalRole = nextRole;
      changed = true;
    }
  } else if (request.currentApprovalRole) {
    request.currentApprovalRole = "";
    changed = true;
  }

  return changed;
}

function requestCanBeActionedBy(request, role) {
  const adminRole = normalizeRole(role);
  if (adminRole === "all") return true;
  return request.status === "pending" && normalizeRole(request.currentApprovalRole) === adminRole;
}

function validateCategoryPayload(body, existingId) {
  const name = normalizeText(body.name);
  if (!name) return { error: "Category name is required." };

  const fields = Array.isArray(body.fields) ? body.fields : [];
  const normalizedFields = fields
    .map((field, index) => {
      const label = normalizeText(field.label);
      if (!label) return null;
      const type = ["text", "number", "date", "textarea", "select", "image"].includes(field.type) ? field.type : "text";
      const options = type === "select"
        ? (Array.isArray(field.options) ? field.options : String(field.options || "").split("\n"))
            .map(normalizeText)
            .filter(Boolean)
        : [];
      return {
        id: field.id || `field-${slugify(label)}-${index + 1}`,
        label,
        type,
        required: Boolean(field.required),
        placeholder: normalizeText(field.placeholder),
        options
      };
    })
    .filter(Boolean);

  const hasRequiredDate = normalizedFields.some((field) => field.type === "date" && field.required);
  if (!hasRequiredDate) {
    normalizedFields.push({
      id: `field-required-date-${Date.now()}`,
      label: "Required Validity Date",
      type: "date",
      required: true,
      placeholder: ""
    });
  }

  return {
    category: {
      id: existingId || `cat-${slugify(name)}-${nanoid()}`,
      name,
      description: normalizeText(body.description),
      fields: normalizedFields,
      createdAt: body.createdAt || nowIso(),
      updatedAt: nowIso()
    }
  };
}

function validateRequestPayload(db, body) {
  const itemName = normalizeText(body.itemName);
  const itemCode = normalizeText(body.itemCode);
  const site = normalizeText(body.site);
  const submittedBy = normalizeText(body.submittedBy);
  const categoryId = normalizeText(body.categoryId);
  const category = db.categories.find((entry) => entry.id === categoryId);

  if (!itemName) return { error: "Item name is required." };
  if (!itemCode) return { error: "Item ID/code is required." };
  if (!site) return { error: "Site is required." };
  if (!category) return { error: "Category is required." };

  const values = body.values && typeof body.values === "object" ? body.values : {};
  for (const field of category.fields || []) {
    if (field.required && !normalizeText(values[field.id])) {
      return { error: `${field.label} is required.` };
    }
  }

  return {
    request: {
      id: `req-${nanoid()}`,
      referenceId: `REF-${nanoid()}`,
      itemName,
      itemCode,
      site,
      submittedBy,
      categoryId: category.id,
      categoryName: category.name,
      values,
      fieldsSnapshot: category.fields || [],
      approvalFlow: categoryApprovalFlow(category.name),
      approvals: [],
      currentApprovalRole: categoryApprovalFlow(category.name)[0],
      status: "pending",
      submittedAt: nowIso(),
      reviewedAt: null,
      reviewNote: ""
    }
  };
}

function pickExpiryDate(category, values, explicitExpiresAt) {
  if (explicitExpiresAt) return explicitExpiresAt;
  const dateFields = (category.fields || []).filter((field) => field.type === "date");
  const requiredDate = dateFields.find((field) => field.required) || dateFields[0];
  if (requiredDate && values?.[requiredDate.id]) return values[requiredDate.id];
  return null;
}

function sortItemsDefault(a, b) {
  const av = getItemValidity(a);
  const bv = getItemValidity(b);
  const aExpired = av.status === "expired" ? 0 : 1;
  const bExpired = bv.status === "expired" ? 0 : 1;
  if (aExpired !== bExpired) return aExpired - bExpired;
  return new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0);
}

app.get("/api/health", async (req, res) => {
  res.json({ ok: true, dbPath: getDbPath(), time: nowIso() });
});

app.post("/api/auth/login", async (req, res) => {
  const db = await readDb();
  const changed = ensureAdminUsers(db);
  const username = normalizeText(req.body?.username).toLowerCase();
  const password = normalizeText(req.body?.password);
  const user = (db.adminUsers || []).find((entry) => normalizeText(entry.username).toLowerCase() === username);
  if (changed) await writeDb(db);
  if (!user || normalizeText(user.password) !== password) {
    return res.status(401).json({ error: "Wrong username or password." });
  }
  res.json({
    username: user.username,
    displayName: user.displayName || user.username,
    role: normalizeRole(user.role),
    roleLabel: roleLabel(user.role)
  });
});

app.get("/api/categories", async (req, res) => {
  const db = await readDb();
  res.json(db.categories || []);
});

app.post("/api/categories", async (req, res) => {
  const db = await readDb();
  const result = validateCategoryPayload(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  db.categories.push(result.category);
  await writeDb(db);
  res.status(201).json(result.category);
});

app.put("/api/categories/:id", async (req, res) => {
  const db = await readDb();
  const index = db.categories.findIndex((entry) => entry.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Category not found." });
  const result = validateCategoryPayload(req.body, req.params.id);
  if (result.error) return res.status(400).json({ error: result.error });
  db.categories[index] = { ...result.category, createdAt: db.categories[index].createdAt };
  await writeDb(db);
  res.json(db.categories[index]);
});

app.delete("/api/categories/:id", async (req, res) => {
  const db = await readDb();
  const hasRequests = db.requests.some((entry) => entry.categoryId === req.params.id);
  const hasItems = db.items.some((entry) => entry.categoryId === req.params.id);
  if (hasRequests || hasItems) {
    return res.status(409).json({ error: "This category is already used. Archive items instead of deleting the category." });
  }
  db.categories = db.categories.filter((entry) => entry.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

app.post("/api/requests", async (req, res) => {
  const db = await readDb();
  const result = validateRequestPayload(db, req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  db.requests.push(result.request);
  await writeDb(db);
  res.status(201).json(result.request);
});

app.get("/api/requests", async (req, res) => {
  const db = await readDb();
  const status = normalizeText(req.query.status);
  let changed = false;
  for (const request of db.requests || []) changed = ensureRequestWorkflow(request) || changed;
  if (changed) await writeDb(db);
  let requests = db.requests || [];
  if (status) requests = requests.filter((entry) => entry.status === status);
  requests = requests.sort((a, b) => {
    const pendingDiff = Number(a.status !== "pending") - Number(b.status !== "pending");
    if (pendingDiff) return pendingDiff;
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  });
  res.json(requests);
});


app.get("/api/requests/reference/:referenceId", async (req, res) => {
  const db = await readDb();
  const referenceId = normalizeText(req.params.referenceId).toUpperCase();
  const request = (db.requests || []).find((entry) =>
    normalizeText(entry.referenceId || entry.id).toUpperCase() === referenceId
  );
  if (!request) return res.status(404).json({ error: "Reference ID not found." });

  const changedWorkflow = ensureRequestWorkflow(request);
  const item = request.itemId
    ? (db.items || []).find((entry) => entry.id === request.itemId)
    : null;

  const changedQr = item ? await ensureBrandedQrForItem(req, item) : false;
  if (changedWorkflow || changedQr) await writeDb(db);

  res.json({
    referenceId: request.referenceId || request.id,
    itemName: request.itemName,
    itemCode: request.itemCode,
    site: request.site,
    categoryName: request.categoryName,
    status: request.status === "approved" ? "accepted" : request.status === "rejected" ? "rejected" : "pending",
    approvalFlow: request.approvalFlow || [],
    approvals: request.approvals || [],
    currentApprovalRole: request.currentApprovalRole || "",
    submittedAt: request.submittedAt,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote || "",
    qrId: item?.qrId || "",
    qrPayload: item?.qrPayload || "",
    qrImageDataUrl: item?.qrImageDataUrl || "",
    expiresAt: item?.expiresAt || "",
    validity: item ? getItemValidity(item) : null
  });
});

app.post("/api/requests/:id/approve", async (req, res) => {
  const db = await readDb();
  const request = db.requests.find((entry) => entry.id === req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });
  ensureRequestWorkflow(request);
  if (request.status !== "pending") return res.status(409).json({ error: "Only pending requests can be approved." });

  const role = normalizeRole(req.body?.role);
  if (!requestCanBeActionedBy(request, role)) {
    return res.status(403).json({ error: `Waiting for ${roleLabel(request.currentApprovalRole)} approval.` });
  }

  const category = db.categories.find((entry) => entry.id === request.categoryId);
  if (!category) return res.status(400).json({ error: "Request category no longer exists." });

  const approvingRole = normalizeRole(request.currentApprovalRole);
  const approvedBy = normalizeText(req.body?.approvedBy) || roleLabel(role);
  request.approvals = Array.isArray(request.approvals) ? request.approvals : [];
  if (!request.approvals.some((entry) => normalizeRole(entry.role) === approvingRole)) {
    request.approvals.push({
      role: approvingRole,
      roleLabel: roleLabel(approvingRole),
      approvedBy,
      approvedAt: nowIso(),
      note: normalizeText(req.body?.reviewNote)
    });
  }

  ensureRequestWorkflow(request);

  if (request.currentApprovalRole) {
    request.reviewNote = normalizeText(req.body?.reviewNote);
    await writeDb(db);
    return res.json({ request, nextRole: request.currentApprovalRole, complete: false });
  }

  const expiresAt = pickExpiryDate(category, request.values, req.body?.expiresAt);
  if (!expiresAt) return res.status(400).json({ error: "Expiry/validity date is required before final approval." });

  const qrId = `QR-${nanoid()}`;
  const qrPayload = getQrPayload(req, qrId);
  const qrImageDataUrl = await createBrandedQrDataUrl(qrPayload);

  const item = {
    id: `asset-${nanoid()}`,
    qrId,
    qrPayload,
    qrImageDataUrl,
    qrBrand: "unilever-v1",
    itemName: request.itemName,
    itemCode: request.itemCode,
    site: request.site,
    categoryId: request.categoryId,
    categoryName: request.categoryName,
    values: request.values,
    fieldsSnapshot: request.fieldsSnapshot || category.fields || [],
    submittedBy: request.submittedBy,
    requestId: request.id,
    registeredAt: nowIso(),
    approvedAt: nowIso(),
    expiresAt,
    archivedAt: null,
    reviewNote: normalizeText(req.body?.reviewNote),
    approvals: request.approvals || []
  };

  request.status = "approved";
  request.reviewedAt = nowIso();
  request.reviewNote = item.reviewNote;
  request.currentApprovalRole = "";
  request.itemId = item.id;

  db.items.push(item);
  await writeDb(db);
  res.status(201).json({ request, item: { ...item, validity: getItemValidity(item) }, complete: true });
});

app.post("/api/requests/:id/reject", async (req, res) => {
  const db = await readDb();
  const request = db.requests.find((entry) => entry.id === req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });
  ensureRequestWorkflow(request);
  if (request.status !== "pending") return res.status(409).json({ error: "Only pending requests can be rejected." });
  const role = normalizeRole(req.body?.role);
  if (!requestCanBeActionedBy(request, role)) {
    return res.status(403).json({ error: `Waiting for ${roleLabel(request.currentApprovalRole)} review.` });
  }
  const rejectedRole = normalizeRole(request.currentApprovalRole);
  request.status = "rejected";
  request.reviewedAt = nowIso();
  request.currentApprovalRole = "";
  request.reviewNote = normalizeText(req.body?.reviewNote);
  request.rejectedBy = normalizeText(req.body?.rejectedBy) || roleLabel(role);
  request.rejectedRole = role === "all" ? rejectedRole : role;
  await writeDb(db);
  res.json(request);
});

app.get("/api/items", async (req, res) => {
  const db = await readDb();
  let changedQrBranding = false;
  for (const item of db.items || []) {
    if (await ensureBrandedQrForItem(req, item)) changedQrBranding = true;
  }
  if (changedQrBranding) await writeDb(db);
  const search = normalizeText(req.query.search).toLowerCase();
  const categoryId = normalizeText(req.query.categoryId);
  const site = normalizeText(req.query.site).toLowerCase();
  const status = normalizeText(req.query.status);
  const sort = normalizeText(req.query.sort) || "expiry";
  const includeArchived = req.query.includeArchived === "true";

  let items = (db.items || []).map((item) => ({ ...item, validity: getItemValidity(item) }));

  if (!includeArchived) items = items.filter((item) => !item.archivedAt);
  if (search) {
    items = items.filter((item) => [item.itemName, item.itemCode, item.site, item.categoryName, item.qrId]
      .some((value) => normalizeText(value).toLowerCase().includes(search)));
  }
  if (categoryId) items = items.filter((item) => item.categoryId === categoryId);
  if (site) items = items.filter((item) => normalizeText(item.site).toLowerCase().includes(site));
  if (status) items = items.filter((item) => item.validity.status === status);

  if (sort === "alpha") items.sort((a, b) => a.itemName.localeCompare(b.itemName));
  else if (sort === "site") items.sort((a, b) => a.site.localeCompare(b.site) || a.itemName.localeCompare(b.itemName));
  else if (sort === "registered") items.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
  else if (sort === "expired") items.sort((a, b) => Number(b.validity.isExpired) - Number(a.validity.isExpired) || sortItemsDefault(a, b));
  else items.sort(sortItemsDefault);

  res.json(items);
});

app.get("/api/items/qr/:qrId", async (req, res) => {
  const db = await readDb();
  const item = db.items.find((entry) => entry.qrId === req.params.qrId);
  if (!item) return res.status(404).json({ error: "QR item not found." });
  if (await ensureBrandedQrForItem(req, item)) await writeDb(db);
  const sourceRequest = (db.requests || []).find((entry) => entry.id === item.requestId || entry.itemId === item.id);
  res.json({
    ...item,
    referenceId: sourceRequest?.referenceId || "",
    validity: getItemValidity(item)
  });
});

app.get("/api/items/:id/qr", async (req, res) => {
  const db = await readDb();
  const item = db.items.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (await ensureBrandedQrForItem(req, item)) await writeDb(db);
  res.json({ qrId: item.qrId, qrPayload: item.qrPayload, qrImageDataUrl: item.qrImageDataUrl, qrBrand: item.qrBrand });
});

app.patch("/api/items/:id", async (req, res) => {
  const db = await readDb();
  const item = db.items.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });

  const editable = ["itemName", "itemCode", "site", "expiresAt", "reviewNote"];
  for (const key of editable) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) item[key] = req.body[key];
  }
  if (req.body.values && typeof req.body.values === "object") {
    item.values = { ...(item.values || {}), ...req.body.values };
  }
  item.updatedAt = nowIso();
  await writeDb(db);
  res.json({ ...item, validity: getItemValidity(item) });
});

app.post("/api/items/:id/archive", async (req, res) => {
  const db = await readDb();
  const item = db.items.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  item.archivedAt = item.archivedAt || nowIso();
  item.archiveNote = normalizeText(req.body?.archiveNote);
  await writeDb(db);
  res.json({ ...item, validity: getItemValidity(item) });
});

app.post("/api/items/:id/restore", async (req, res) => {
  const db = await readDb();
  const item = db.items.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  item.archivedAt = null;
  item.archiveNote = "";
  await writeDb(db);
  res.json({ ...item, validity: getItemValidity(item) });
});

const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error.", detail: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`QR System backend running on http://0.0.0.0:${PORT}`);
  console.log(`JSON database: ${getDbPath()}`);
});
