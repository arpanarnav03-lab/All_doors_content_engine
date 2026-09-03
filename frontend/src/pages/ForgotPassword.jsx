import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
    } finally {
      // Always show the generic success state, matching the backend's
      // privacy-conscious behavior - never reveal whether the email exists.
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Forgot password</h1>
          <p className="text-xs text-slate-500">Alldoors Content Review</p>
        </div>

        {submitted ? (
          <p className="text-sm text-slate-600">
            If an account exists for this email, check your inbox for a reset link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-xs text-center pt-1">
          <Link to="/login" className="text-brand-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
