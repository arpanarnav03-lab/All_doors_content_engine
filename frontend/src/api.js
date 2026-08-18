const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  getDrafts: (status = "pending") => request(`/drafts?status=${status}`),
  getStats: () => request(`/drafts/stats`),
  getDraft: (id) => request(`/drafts/${id}`),
  saveDraft: (id, body) =>
    request(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveDraft: (id) => request(`/drafts/${id}/approve`, { method: "POST" }),
  rejectDraft: (id) => request(`/drafts/${id}/reject`, { method: "POST" }),
};
