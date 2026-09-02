const BASE = import.meta.env.VITE_API_URL || "/api";

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
  getIdeas: (status = "new") => request(`/ideas?status=${status}`),
  generateDraft: (id) => request(`/ideas/${id}/generate-draft`, { method: "POST" }),
  dismissIdea: (id) => request(`/ideas/${id}/dismiss`, { method: "POST" }),
};
