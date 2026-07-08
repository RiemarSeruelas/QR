import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  LayoutDashboard,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  XCircle
} from "lucide-react";
import { api } from "./api.js";

const EMPTY_FIELD = { label: "", type: "text", required: false, placeholder: "", optionsText: "" };
const FIELD_TYPES = ["text", "number", "date", "textarea", "select"];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseQrText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const itemIndex = parts.findIndex((part) => part.toLowerCase() === "item");
    if (itemIndex !== -1 && parts[itemIndex + 1]) return decodeURIComponent(parts[itemIndex + 1]);
  } catch {
    // Normal QR-ID text is still valid.
  }

  if (raw.startsWith("MACHINEQR:")) return raw.replace("MACHINEQR:", "").trim();
  if (raw.startsWith("QR-")) return raw;
  return raw;
}

function StatCard({ icon: Icon, label, value, tone = "default" }) {
  return (
    <section className={cx("stat-card", `tone-${tone}`)}>
      <div className="stat-icon"><Icon size={18} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

function StatusBadge({ validity, status }) {
  const finalStatus = status || validity?.status || "unknown";
  const label = finalStatus === "valid" ? "Good" : finalStatus === "expired" ? "Expired" : finalStatus === "archived" ? "Archived" : finalStatus;
  return <span className={cx("status-badge", finalStatus)}>{label}</span>;
}

function FieldInput({ field, value, onChange }) {
  const commonProps = {
    id: field.id,
    value: value ?? "",
    required: field.required,
    placeholder: field.placeholder || field.label,
    onChange: (event) => onChange(field.id, event.target.value)
  };

  if (field.type === "textarea") {
    return <textarea {...commonProps} rows={4} />;
  }

  if (field.type === "select") {
    return (
      <select {...commonProps}>
        <option value="">Select {field.label}</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  return <input {...commonProps} type={field.type || "text"} />;
}


function FieldRows({ fields = [], values = {}, compact = false }) {
  const knownRows = (fields || []).map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    value: values?.[field.id]
  }));
  const knownIds = new Set(knownRows.map((row) => row.id));
  const extraRows = Object.entries(values || {})
    .filter(([key]) => !knownIds.has(key))
    .map(([key, value]) => ({ id: key, label: key.replace(/^field-/, "").replaceAll("-", " "), value }));

  const rows = [...knownRows, ...extraRows];
  if (rows.length === 0) return <p className="muted">No extra details submitted.</p>;

  return (
    <div className={compact ? "detail-lines compact" : "details-lines-full"}>
      {rows.map((row) => (
        <div key={row.id} className={compact ? undefined : "detail-line"}>
          <span>{row.label}</span>
          <strong>{row.type === "date" ? formatDate(row.value) : (row.value || "—")}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = ClipboardList, title, message }) {
  return (
    <div className="empty-state">
      <Icon size={34} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

function UserRegister({ categories, onCreated }) {
  const [form, setForm] = useState({
    itemName: "",
    itemCode: "",
    site: "",
    submittedBy: "",
    categoryId: categories[0]?.id || "",
    values: {}
  });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.categoryId && categories[0]?.id) {
      setForm((current) => ({ ...current, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const category = categories.find((entry) => entry.id === form.categoryId);

  function updateBase(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateValue(fieldId, value) {
    setForm((current) => ({
      ...current,
      values: { ...current.values, [fieldId]: value }
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.createRequest(form);
      setMessage({ type: "success", text: "Request submitted. Admin can now review and approve it." });
      setForm({ itemName: "", itemCode: "", site: "", submittedBy: "", categoryId: form.categoryId, values: {} });
      onCreated?.();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-grid user-grid">
      <section className="hero-card">
        <div className="hero-badge"><QrCode size={18} /> QR Registration</div>
        <h1>Register an item for QR approval.</h1>
        <p>
          The user submits the asset details first. Admin reviews it, approves it, then the system generates one permanent QR code for that specific item.
        </p>
        <div className="hero-steps">
          <span>1. User submits</span>
          <span>2. Admin approves</span>
          <span>3. QR is generated</span>
          <span>4. Scan checks validity</span>
        </div>
      </section>

      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">User form</p>
            <h2>Asset request</h2>
          </div>
          <PackageCheck size={24} />
        </div>

        {message && <div className={cx("notice", message.type)}>{message.text}</div>}

        <form onSubmit={submit} className="stack-form">
          <div className="form-row two">
            <label>
              Item name <span>*</span>
              <input value={form.itemName} onChange={(event) => updateBase("itemName", event.target.value)} required placeholder="Example: Flowwrap 1" />
            </label>
            <label>
              Item ID <span>*</span>
              <input value={form.itemCode} onChange={(event) => updateBase("itemCode", event.target.value)} required placeholder="Example: FD12B-FW-001" />
            </label>
          </div>

          <div className="form-row two">
            <label>
              Site / Area <span>*</span>
              <input value={form.site} onChange={(event) => updateBase("site", event.target.value)} required placeholder="Example: Cavite Foods - Savoury" />
            </label>
            <label>
              Submitted by
              <input value={form.submittedBy} onChange={(event) => updateBase("submittedBy", event.target.value)} placeholder="Name / team" />
            </label>
          </div>

          <label>
            Category <span>*</span>
            <select value={form.categoryId} onChange={(event) => updateBase("categoryId", event.target.value)} required>
              {categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>

          {category && (
            <div className="dynamic-card">
              <div className="dynamic-head">
                <strong>{category.name} details</strong>
                <span>{(category.fields || []).length} fields</span>
              </div>
              {(category.fields || []).map((field) => (
                <label key={field.id}>
                  {field.label} {field.required && <span>*</span>}
                  <FieldInput field={field} value={form.values[field.id]} onChange={updateValue} />
                </label>
              ))}
            </div>
          )}

          <button className="primary-btn" disabled={busy}>
            {busy ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ScanPage({ onOpenItem }) {
  const [qrText, setQrText] = useState("");
  const [scannerOn, setScannerOn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scannerOn) return;
    let scanner;
    let disposed = false;

    import("html5-qrcode")
      .then(({ Html5QrcodeScanner, Html5QrcodeSupportedFormats }) => {
        if (disposed) return;
        scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            rememberLastUsedCamera: true,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
          },
          false
        );
        scanner.render(
          (decodedText) => {
            const qrId = parseQrText(decodedText);
            setQrText(qrId);
            onOpenItem(qrId);
            scanner.clear().catch(() => {});
            setScannerOn(false);
          },
          () => {}
        );
      })
      .catch((err) => setError(`Scanner failed to load: ${err.message}`));

    return () => {
      disposed = true;
      if (scanner) scanner.clear().catch(() => {});
    };
  }, [scannerOn, onOpenItem]);

  function manualSubmit(event) {
    event.preventDefault();
    const qrId = parseQrText(qrText);
    if (!qrId) return setError("Enter or scan a QR code first.");
    onOpenItem(qrId);
  }

  return (
    <main className="single-page">
      <section className="panel scanner-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Mobile-friendly scanner</p>
            <h2>Scan QR to check machine validity</h2>
          </div>
          <ScanLine size={28} />
        </div>
        <p className="muted">
          On phones, camera scanning usually requires HTTPS. Use the included Caddyfile for LAN testing.
        </p>

        {error && <div className="notice error">{error}</div>}

        <div className="scanner-box">
          {scannerOn ? <div id="qr-reader" /> : (
            <button className="scan-start" onClick={() => { setError(""); setScannerOn(true); }}>
              <ScanLine size={38} />
              Open camera scanner
            </button>
          )}
        </div>

        <form onSubmit={manualSubmit} className="manual-scan">
          <label>
            Or paste/type QR ID
            <input value={qrText} onChange={(event) => setQrText(event.target.value)} placeholder="QR-XXXXXXXX or scanned URL" />
          </label>
          <button className="secondary-btn">Check QR</button>
        </form>
      </section>
    </main>
  );
}

function ItemDetails({ qrId, onBack }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!qrId) return;
    setLoading(true);
    setError("");
    api.itemByQr(qrId)
      .then(setItem)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [qrId]);

  return (
    <main className="single-page">
      <section className="panel detail-panel">
        <button className="ghost-btn back-btn" onClick={onBack}>← Back</button>
        {loading && <EmptyState icon={RefreshCw} title="Checking QR..." message="Loading item details and validity status." />}
        {error && <EmptyState icon={XCircle} title="QR not found" message={error} />}
        {item && !loading && (
          <>
            <div className={cx("validity-banner", item.validity?.status)}>
              {item.validity?.status === "valid" ? <CheckCircle2 size={34} /> : <XCircle size={34} />}
              <div>
                <p>System validity</p>
                <h1>{item.validity?.status === "valid" ? "This item is still GOOD" : item.validity?.status === "expired" ? "This item QR is EXPIRED" : "This item is ARCHIVED"}</h1>
                <span>
                  {item.validity?.status === "valid"
                    ? `${item.validity?.daysLeft ?? "—"} day(s) left before expiry`
                    : `Expiry date: ${formatDate(item.expiresAt)}`}
                </span>
              </div>
            </div>

            <div className="detail-title-row">
              <div>
                <p className="eyebrow">{item.categoryName}</p>
                <h2>{item.itemName}</h2>
                <p className="muted">ID: {item.itemCode} • QR: {item.qrId}</p>
              </div>
              <StatusBadge validity={item.validity} />
            </div>

            <div className="detail-grid">
              <div><span>Site</span><strong>{item.site}</strong></div>
              <div><span>Registered</span><strong>{formatDateTime(item.registeredAt)}</strong></div>
              <div><span>Expires</span><strong>{formatDate(item.expiresAt)}</strong></div>
              <div><span>Submitted by</span><strong>{item.submittedBy || "—"}</strong></div>
            </div>

            <div className="details-list">
              <h3>Registered details</h3>
              <FieldRows fields={item.fieldsSnapshot || []} values={item.values || {}} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function CategoryManager({ categories, reload }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", description: "", fields: [{ ...EMPTY_FIELD, label: "Validity Date", type: "date", required: true }] });
  const [message, setMessage] = useState(null);

  function resetDraft() {
    setEditingId(null);
    setDraft({ name: "", description: "", fields: [{ ...EMPTY_FIELD, label: "Validity Date", type: "date", required: true }] });
  }

  function editCategory(category) {
    setEditingId(category.id);
    setDraft({
      name: category.name,
      description: category.description || "",
      fields: (category.fields || []).map((field) => ({
        ...field,
        optionsText: (field.options || []).join("\n")
      }))
    });
  }

  function updateField(index, key, value) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field)
    }));
  }

  function addField() {
    setDraft((current) => ({ ...current, fields: [...current.fields, { ...EMPTY_FIELD }] }));
  }

  function removeField(index) {
    setDraft((current) => ({ ...current, fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index) }));
  }

  async function saveCategory(event) {
    event.preventDefault();
    setMessage(null);
    const payload = {
      ...draft,
      fields: draft.fields.map((field) => ({
        ...field,
        options: String(field.optionsText || "").split("\n").map((entry) => entry.trim()).filter(Boolean)
      }))
    };

    try {
      if (editingId) await api.updateCategory(editingId, payload);
      else await api.createCategory(payload);
      setMessage({ type: "success", text: editingId ? "Category updated." : "Category added." });
      resetDraft();
      reload();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  async function deleteCategory(categoryId) {
    if (!confirm("Delete this unused category?")) return;
    try {
      await api.deleteCategory(categoryId);
      reload();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  return (
    <section className="admin-section category-admin">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin builder</p>
          <h2>Categories & addable fields</h2>
        </div>
        <button className="ghost-btn" onClick={resetDraft}>New category</button>
      </div>
      {message && <div className={cx("notice", message.type)}>{message.text}</div>}

      <div className="split-admin">
        <div className="category-list">
          {categories.map((category) => (
            <button key={category.id} className={cx("category-chip", editingId === category.id && "active")} onClick={() => editCategory(category)}>
              <strong>{category.name}</strong>
              <span>{(category.fields || []).length} fields</span>
            </button>
          ))}
        </div>

        <form className="stack-form category-form" onSubmit={saveCategory}>
          <div className="form-row two">
            <label>
              Category name <span>*</span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required placeholder="Machines, Devices, Tools" />
            </label>
            <label>
              Description
              <input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Optional short description" />
            </label>
          </div>

          <div className="field-builder-head">
            <strong>Fields users will fill in</strong>
            <button type="button" className="secondary-btn small" onClick={addField}><Plus size={16} /> Add field</button>
          </div>
          <p className="muted small-text">At least one required date is mandatory. If you forget it, the backend adds one automatically.</p>

          {draft.fields.map((field, index) => (
            <div className="field-builder-card" key={`${field.id || "field"}-${index}`}>
              <div className="form-row field-grid">
                <label>
                  Label
                  <input value={field.label} onChange={(event) => updateField(index, "label", event.target.value)} placeholder="Next check date" />
                </label>
                <label>
                  Type
                  <select value={field.type} onChange={(event) => updateField(index, "type", event.target.value)}>
                    {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="check-label">
                  <input type="checkbox" checked={Boolean(field.required)} onChange={(event) => updateField(index, "required", event.target.checked)} /> Required
                </label>
                <button type="button" className="danger-icon" onClick={() => removeField(index)} title="Remove field"><Trash2 size={18} /></button>
              </div>
              {field.type === "select" && (
                <label>
                  Select options, one per line
                  <textarea rows={3} value={field.optionsText || ""} onChange={(event) => updateField(index, "optionsText", event.target.value)} placeholder={"Good\nNeeds Repair\nFor Checking"} />
                </label>
              )}
            </div>
          ))}

          <button className="primary-btn">{editingId ? "Save category" : "Add category"}</button>
        </form>
      </div>
    </section>
  );
}

function RequestCard({ request, onAction }) {
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      await api.approveRequest(request.id, { reviewNote: note, expiresAt: expiresAt || undefined });
      onAction();
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await api.rejectRequest(request.id, { reviewNote: note });
      onAction();
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="request-card">
      <div className="request-top">
        <div>
          <p className="eyebrow">{request.categoryName}</p>
          <h3>{request.itemName}</h3>
          <span>ID: {request.itemCode} • {request.site}</span>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="request-meta">
        <span>Submitted: {formatDateTime(request.submittedAt)}</span>
        <span>By: {request.submittedBy || "—"}</span>
      </div>
      <details>
        <summary>View submitted details</summary>
        <FieldRows compact fields={request.fieldsSnapshot || []} values={request.values || {}} />
      </details>
      {request.status === "pending" && (
        <div className="approval-box">
          <label>
            Optional expiry override
            <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </label>
          <label>
            Review note
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reason or remark" />
          </label>
          <div className="button-row">
            <button className="primary-btn small" disabled={busy} onClick={approve}><CheckCircle2 size={16} /> Approve & generate QR</button>
            <button className="danger-btn small" disabled={busy} onClick={reject}><XCircle size={16} /> Reject</button>
          </div>
        </div>
      )}
    </article>
  );
}

function RequestsAdmin({ requests, reload }) {
  const pending = requests.filter((entry) => entry.status === "pending");
  const reviewed = requests.filter((entry) => entry.status !== "pending").slice(0, 6);
  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Approval queue</p>
          <h2>Requests</h2>
        </div>
        <button className="ghost-btn" onClick={reload}><RefreshCw size={16} /> Refresh</button>
      </div>

      {pending.length === 0 ? (
        <EmptyState title="No pending requests" message="New user registrations will appear here for admin approval." />
      ) : (
        <div className="request-list">
          {pending.map((request) => <RequestCard key={request.id} request={request} onAction={reload} />)}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="reviewed-strip">
          <h3>Latest reviewed</h3>
          {reviewed.map((request) => (
            <div key={request.id} className="reviewed-row">
              <span>{request.itemName}</span>
              <StatusBadge status={request.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ItemCard({ item, reload, openItem }) {
  const [expiry, setExpiry] = useState(item.expiresAt?.slice(0, 10) || "");
  const [busy, setBusy] = useState(false);

  async function renew() {
    setBusy(true);
    try {
      await api.updateItem(item.id, { expiresAt: expiry });
      reload();
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveToggle() {
    setBusy(true);
    try {
      if (item.archivedAt) await api.restoreItem(item.id);
      else await api.archiveItem(item.id, { archiveNote: "Archived from admin list" });
      reload();
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={cx("asset-card", item.validity?.status)}>
      <div className="asset-main">
        <img src={item.qrImageDataUrl} alt={`QR for ${item.itemName}`} className="qr-thumb" />
        <div>
          <div className="asset-title-row">
            <h3>{item.itemName}</h3>
            <StatusBadge validity={item.validity} />
          </div>
          <p>ID: {item.itemCode}</p>
          <p>{item.site} • {item.categoryName}</p>
          <p className="muted">QR: {item.qrId}</p>
        </div>
      </div>
      <div className="asset-dates">
        <span>Registered: <strong>{formatDate(item.registeredAt)}</strong></span>
        <span>Expires: <strong>{formatDate(item.expiresAt)}</strong></span>
        {item.validity?.status === "valid" && <span>{item.validity.daysLeft} day(s) left</span>}
      </div>
      <div className="asset-actions">
        <label>
          Update expiry
          <input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
        </label>
        <button className="secondary-btn small" onClick={renew} disabled={busy}>Save expiry</button>
        <button className="ghost-btn small" onClick={() => openItem(item.qrId)}><Eye size={16} /> View</button>
        <a className="ghost-btn small" href={item.qrImageDataUrl} download={`${item.itemCode || item.qrId}-qr.png`}>Download QR</a>
        <button className="danger-btn small subtle" onClick={archiveToggle} disabled={busy}>
          <Archive size={16} /> {item.archivedAt ? "Restore" : "Archive"}
        </button>
      </div>
    </article>
  );
}

function RegisteredAdmin({ items, categories, filters, setFilters, reload, openItem }) {
  const sites = useMemo(() => Array.from(new Set(items.map((item) => item.site).filter(Boolean))).sort(), [items]);
  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Registered QR list</p>
          <h2>Approved assets</h2>
        </div>
        <button className="ghost-btn" onClick={reload}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="filter-bar">
        <label className="search-field">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, ID, site, QR" />
        </label>
        <label>
          <ChevronDown size={16} />
          <select value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          <ChevronDown size={16} />
          <select value={filters.site} onChange={(event) => setFilters((current) => ({ ...current, site: event.target.value }))}>
            <option value="">All sites</option>
            {sites.map((site) => <option key={site} value={site}>{site}</option>)}
          </select>
        </label>
        <label>
          <Filter size={16} />
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All status</option>
            <option value="expired">Expired</option>
            <option value="valid">Good</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <SlidersHorizontal size={16} />
          <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
            <option value="expiry">Default: expired / closest expiry</option>
            <option value="alpha">Alphabetical</option>
            <option value="site">By site</option>
            <option value="registered">Date registered</option>
            <option value="expired">Expired first</option>
          </select>
        </label>
        <label className="archive-toggle">
          <input type="checkbox" checked={filters.includeArchived} onChange={(event) => setFilters((current) => ({ ...current, includeArchived: event.target.checked }))} />
          Show archived
        </label>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={QrCode} title="No registered assets yet" message="Approve a request to generate the first QR code." />
      ) : (
        <div className="asset-list">
          {items.map((item) => <ItemCard key={item.id} item={item} reload={reload} openItem={openItem} />)}
        </div>
      )}
    </section>
  );
}

function AdminDashboard({ categories, requests, items, filters, setFilters, reloadAll, openItem }) {
  const stats = useMemo(() => {
    return {
      pending: requests.filter((entry) => entry.status === "pending").length,
      registered: items.filter((entry) => !entry.archivedAt).length,
      expired: items.filter((entry) => entry.validity?.status === "expired").length,
      archived: items.filter((entry) => entry.archivedAt).length
    };
  }, [requests, items]);

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Admin console</p>
          <h1>Build forms, approve registrations, and manage QR validity.</h1>
          <p>Default asset sorting prioritizes expired QR records first, then the assets closest to expiring.</p>
        </div>
        <button className="primary-btn" onClick={reloadAll}><RefreshCw size={17} /> Sync data</button>
      </section>

      <div className="stats-grid">
        <StatCard icon={ClipboardList} label="Pending requests" value={stats.pending} tone="warn" />
        <StatCard icon={QrCode} label="Registered" value={stats.registered} tone="ok" />
        <StatCard icon={CalendarDays} label="Expired" value={stats.expired} tone="danger" />
        <StatCard icon={Archive} label="Archived" value={stats.archived} />
      </div>

      <CategoryManager categories={categories} reload={reloadAll} />
      <RequestsAdmin requests={requests} reload={reloadAll} />
      <RegisteredAdmin items={items} categories={categories} filters={filters} setFilters={setFilters} reload={reloadAll} openItem={openItem} />
    </main>
  );
}

export default function App() {
  const routeQrId = useMemo(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "item" && parts[1]) return decodeURIComponent(parts[1]);
    return "";
  }, []);

  const [tab, setTab] = useState(routeQrId ? "details" : "register");
  const [selectedQrId, setSelectedQrId] = useState(routeQrId);
  const [categories, setCategories] = useState([]);
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: "", categoryId: "", site: "", status: "", sort: "expiry", includeArchived: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadCategories() {
    const data = await api.categories();
    setCategories(data);
  }

  async function loadRequests() {
    const data = await api.requests();
    setRequests(data);
  }

  async function loadItems(nextFilters = filters) {
    const data = await api.items(nextFilters);
    setItems(data);
  }

  async function reloadAll() {
    setLoadError("");
    try {
      await Promise.all([loadCategories(), loadRequests(), loadItems()]);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadItems(filters).catch((error) => setLoadError(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.categoryId, filters.site, filters.status, filters.sort, filters.includeArchived]);

  function openItem(qrId) {
    const finalQrId = parseQrText(qrId);
    setSelectedQrId(finalQrId);
    setTab("details");
    if (window.location.pathname !== `/item/${finalQrId}`) {
      window.history.pushState({}, "", `/item/${finalQrId}`);
    }
  }

  function setMainTab(nextTab) {
    setTab(nextTab);
    if (nextTab !== "details" && window.location.pathname.startsWith("/item/")) {
      window.history.pushState({}, "", "/");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setMainTab("register")}>
          <span><ShieldCheck size={22} /></span>
          <div>
            <strong>QR Asset System</strong>
            <small>Register • Approve • Scan</small>
          </div>
        </button>
        <nav>
          <button className={cx(tab === "register" && "active")} onClick={() => setMainTab("register")}><PackageCheck size={17} /> User</button>
          <button className={cx(tab === "scan" && "active")} onClick={() => setMainTab("scan")}><ScanLine size={17} /> Scan</button>
          <button className={cx(tab === "admin" && "active")} onClick={() => setMainTab("admin")}><LayoutDashboard size={17} /> Admin</button>
        </nav>
      </header>

      {loadError && <div className="global-error">{loadError}</div>}
      {loading && <div className="loading-strip"><RefreshCw size={16} /> Loading QR system...</div>}

      {tab === "register" && <UserRegister categories={categories} onCreated={reloadAll} />}
      {tab === "scan" && <ScanPage onOpenItem={openItem} />}
      {tab === "admin" && <AdminDashboard categories={categories} requests={requests} items={items} filters={filters} setFilters={setFilters} reloadAll={reloadAll} openItem={openItem} />}
      {tab === "details" && <ItemDetails qrId={selectedQrId} onBack={() => setMainTab("scan")} />}
    </div>
  );
}
