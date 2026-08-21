import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

function keywordLine(idea) {
  if (idea.searchVolume == null) {
    return `Target keyword: ${idea.keyword} (search volume unavailable)`;
  }
  if (idea.isBucketed) {
    return `Target keyword: ${idea.keyword} (~${idea.searchVolume}/mo estimated, ${idea.competition || "unknown"} competition)`;
  }
  return `Target keyword: ${idea.keyword} (${idea.searchVolume}/mo, ${idea.competition || "unknown"} competition)`;
}

export default function Ideas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getIdeas().then((d) => {
      setIdeas(d);
      setLoading(false);
    });
  }, []);

  async function handleGenerateDraft(id) {
    setBusyId(id);
    try {
      const result = await api.generateDraft(id);
      navigate(`/review/${result.draftId}`);
    } catch (err) {
      alert("Failed to generate draft: " + err.message);
      setBusyId(null);
    }
  }

  async function handleDismiss(id) {
    setBusyId(id);
    try {
      await api.dismissIdea(id);
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert("Failed to dismiss: " + err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading...</p>;

  if (ideas.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-sm">No new ideas right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ideas.map((idea) => (
        <div
          key={idea.id}
          className="bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                {idea.item.Location}
              </span>
              <h3 className="font-semibold text-slate-900 leading-snug mt-1.5">
                {idea.item.Headline}
              </h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{idea.item.Summary}</p>
              <p className="text-xs text-slate-400 mt-2">{keywordLine(idea)}</p>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap pt-1">
              {new Date(idea.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => handleGenerateDraft(idea.id)}
              disabled={busyId === idea.id}
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {busyId === idea.id ? "Generating..." : "Generate Draft"}
            </button>
            <button
              onClick={() => handleDismiss(idea.id)}
              disabled={busyId === idea.id}
              className="px-4 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
