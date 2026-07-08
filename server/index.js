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
  if (item.qrBrand === "unilever-v1" && item.qrImageDataUrl) return false;
  item.qrPayload = item.qrPayload || makeItemUrl(req, item.qrId);
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
  let requests = db.requests || [];
  if (status) requests = requests.filter((entry) => entry.status === status);
  requests = requests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(requests);
});


app.get("/api/requests/reference/:referenceId", async (req, res) => {
  const db = await readDb();
  const referenceId = normalizeText(req.params.referenceId).toUpperCase();
  const request = (db.requests || []).find((entry) =>
    normalizeText(entry.referenceId || entry.id).toUpperCase() === referenceId
  );
  if (!request) return res.status(404).json({ error: "Reference ID not found." });

  const item = request.itemId
    ? (db.items || []).find((entry) => entry.id === request.itemId)
    : null;

  if (item && await ensureBrandedQrForItem(req, item)) await writeDb(db);

  res.json({
    referenceId: request.referenceId || request.id,
    itemName: request.itemName,
    itemCode: request.itemCode,
    site: request.site,
    categoryName: request.categoryName,
    status: request.status === "approved" ? "accepted" : request.status === "rejected" ? "rejected" : "pending",
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
  if (request.status !== "pending") return res.status(409).json({ error: "Only pending requests can be approved." });

  const category = db.categories.find((entry) => entry.id === request.categoryId);
  if (!category) return res.status(400).json({ error: "Request category no longer exists." });
  const expiresAt = pickExpiryDate(category, request.values, req.body?.expiresAt);
  if (!expiresAt) return res.status(400).json({ error: "Expiry/validity date is required before approval." });

  const qrId = `QR-${nanoid()}`;
  const qrPayload = makeItemUrl(req, qrId);
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
    reviewNote: normalizeText(req.body?.reviewNote)
  };

  request.status = "approved";
  request.reviewedAt = nowIso();
  request.reviewNote = item.reviewNote;
  request.itemId = item.id;

  db.items.push(item);
  await writeDb(db);
  res.status(201).json({ request, item: { ...item, validity: getItemValidity(item) } });
});

app.post("/api/requests/:id/reject", async (req, res) => {
  const db = await readDb();
  const request = db.requests.find((entry) => entry.id === req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });
  if (request.status !== "pending") return res.status(409).json({ error: "Only pending requests can be rejected." });
  request.status = "rejected";
  request.reviewedAt = nowIso();
  request.reviewNote = normalizeText(req.body?.reviewNote);
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
