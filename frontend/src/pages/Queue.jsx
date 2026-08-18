import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function Queue() {
  const [status, setStatus] = useState("pending");
  const [drafts, setDrafts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [d, s] = await Promise.all([api.getDrafts(status), api.getStats()]);
    setDrafts(d);
    setStats(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Pending review" value={stats.pending} />
          <StatCard label="Approved today" value={stats.approvedToday} />
          <StatCard label="Total this week" value={stats.totalThisWeek} />
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              status === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading...</p>}

      {!loading && drafts.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No {status} drafts right now.</p>
        </div>
      )}

      <div className="space-y-3">
        {drafts.map((d) => (
          <DraftCard key={d.id} draft={d} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-2xl font-semibold text-slate-900">{value ?? "-"}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function DraftCard({ draft }) {
  const preview = (draft.blog.body || "").replace(/##\s*/g, "").slice(0, 160);
  const isValid = draft.originalBlog?._valid !== false;

  return (
    <Link
      to={`/review/${draft.id}`}
      className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={draft.status} />
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {draft.item.Location}
            </span>
            {!isValid && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Needs attention
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 leading-snug">{draft.blog.headline}</h3>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{preview}...</p>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap pt-1">
          {new Date(draft.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      </div>
    </Link>
  );
}
