const API_ROOT = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || data?.detail || "Request failed");
  }
  return data;
}

export const api = {
  health: () => request("/health"),
  categories: () => request("/categories"),
  createCategory: (payload) => request("/categories", { method: "POST", body: JSON.stringify(payload) }),
  updateCategory: (id, payload) => request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),
  createRequest: (payload) => request("/requests", { method: "POST", body: JSON.stringify(payload) }),
  requests: (status = "") => request(`/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  approveRequest: (id, payload) => request(`/requests/${id}/approve`, { method: "POST", body: JSON.stringify(payload) }),
  rejectRequest: (id, payload) => request(`/requests/${id}/reject`, { method: "POST", body: JSON.stringify(payload) }),
  items: (params = {}) => {
    const qs = new URLSearchParams(params);
    return request(`/items${qs.toString() ? `?${qs}` : ""}`);
  },
  itemByQr: (qrId) => request(`/items/qr/${encodeURIComponent(qrId)}`),
  updateItem: (id, payload) => request(`/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveItem: (id, payload = {}) => request(`/items/${id}/archive`, { method: "POST", body: JSON.stringify(payload) }),
  restoreItem: (id) => request(`/items/${id}/restore`, { method: "POST", body: JSON.stringify({}) })
};
