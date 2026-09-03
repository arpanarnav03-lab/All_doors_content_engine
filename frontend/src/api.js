const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(BASE + path, {
    ...options,
    headers,
  });

  // Only treat a 401 as "your session expired" when this request actually
  // carried a token - an anonymous call (login/signup/forgot-password,
  // wrong credentials) also gets a 401, but for a completely different
  // reason, and redirecting away from the login page mid-attempt would
  // break its own inline error display.
  if (res.status === 401 && token) {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
    // Stop here - the redirect is already in flight, and there's no
    // meaningful response to hand back to whichever caller triggered this.
    throw new Error("401: Session expired");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// request() throws Error("<status>: <raw response body>") - this pulls the
// actual { error: "..." } message out of that raw JSON body for display,
// falling back gracefully if the body isn't the shape we expect.
export function getErrorMessage(err, fallback = "Something went wrong") {
  const match = err.message.match(/^\d+:\s*([\s\S]*)$/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.error || parsed.message || fallback;
  } catch {
    return match[1] || fallback;
  }
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
  signup: (email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, newPassword) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) }),
  getMe: () => request("/auth/me"),
};
