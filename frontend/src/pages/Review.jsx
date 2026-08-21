import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import StatusBadge from "../components/StatusBadge.jsx";

export default function Review() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(null);
  const [headline, setHeadline] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    api.getDraft(id).then((d) => {
      setDraft(d);
      setHeadline(d.blog.headline || "");
      setMetaDescription(d.blog.metaDescription || "");
      setBody(d.blog.body || "");
    });
  }, [id]);

  if (!draft) return <p className="text-slate-500 text-sm">Loading...</p>;

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const dashMatches = (headline + " " + body).match(/[—–]/g);
  const hasConclusion = body.includes("## Conclusion");
  const hasFaqs = body.includes("## FAQs");

  async function handleSave() {
    setSaving(true);
    await api.saveDraft(id, { headline, metaDescription, body });
    setSaving(false);
    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  async function handleApprove() {
    setApproving(true);
    await api.saveDraft(id, { headline, metaDescription, body });
    try {
      await api.approveDraft(id);
      navigate("/queue");
    } catch (err) {
      alert("Approve failed: " + err.message);
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!confirm("Reject this draft? It won't be sent to the Sheet or Doc.")) return;
    await api.rejectDraft(id);
    navigate("/queue");
  }

  return (
    <div>
      <button onClick={() => navigate("/queue")} className="text-sm text-slate-500 hover:text-slate-700 mb-4">
        ← Back to Queue
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* Editor column */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={draft.status} />
            <span className="text-xs text-slate-400">
              Generated {new Date(draft.createdAt).toLocaleString("en-IN")}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Headline</label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Meta Description</label>
            <input
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm italic focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Body (## marks a subheading — keep Conclusion/FAQs formatting intact)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={28}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {draft.blog.tables && draft.blog.tables.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Table (read-only preview — reject & regenerate to change table data)
              </p>
              {draft.blog.tables.map((t, i) => (
                <div key={i} className="mb-3">
                  <p className="text-sm font-medium mb-1">{t.caption}</p>
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr>
                        {t.headers.map((h, hi) => (
                          <th key={hi} className="border border-slate-300 px-2 py-1 bg-slate-100 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((r, ri) => (
                        <tr key={ri}>
                          {r.map((c, ci) => (
                            <td key={ci} className="border border-slate-300 px-2 py-1">{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={handleApprove}
              disabled={approving || draft.status !== "pending"}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {approving ? "Approving..." : "Approve & Send"}
            </button>
            <button
              onClick={handleReject}
              disabled={draft.status !== "pending"}
              className="px-4 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
            {savedMsg && <span className="text-xs text-emerald-600">{savedMsg}</span>}
          </div>

          {draft.status === "approved" && draft.blogDocUrl && (
            <a
              href={draft.blogDocUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm text-brand-600 hover:underline"
            >
              Open Google Doc →
            </a>
          )}
        </div>

        {/* Reference sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Checks</p>
            <CheckRow ok={wordCount >= 600 && wordCount <= 1000} label={`${wordCount} words`} />
            <CheckRow ok={hasConclusion} label="Conclusion section" />
            <CheckRow ok={hasFaqs} label="FAQs section" />
            <CheckRow ok={!dashMatches} label={dashMatches ? `${dashMatches.length} em/en dash(es) found` : "No em/en dashes"} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Source Research</p>
            <RefField label="Original title" value={draft.item.Title} />
            <RefField label="Summary" value={draft.item.Summary} />
            <RefField label="Data Points" value={draft.item.DataPoints} />
            <RefField label="Unique Insight" value={draft.item.UniqueInsight} />
            <RefField label="Content Angle" value={draft.item.ContentAngle} />
            <a
              href={draft.item.Source}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:underline block pt-1"
            >
              Open source article →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ ok, label }) {
  return (
    <div className="flex items-center gap-2 text-sm py-0.5">
      <span className={ok ? "text-emerald-500" : "text-amber-500"}>{ok ? "✓" : "!"}</span>
      <span className={ok ? "text-slate-600" : "text-amber-700"}>{label}</span>
    </div>
  );
}

function RefField({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
}
