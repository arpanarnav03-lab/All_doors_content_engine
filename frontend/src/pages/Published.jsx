import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Published() {
  const [drafts, setDrafts] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getDrafts("approved").then(setDrafts);
  }, []);

  const filtered = drafts.filter((d) =>
    d.blog.headline.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        placeholder="Search published headlines..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {filtered.length === 0 && <p className="text-sm text-slate-400">Nothing published yet.</p>}

      <div className="space-y-2">
        {filtered.map((d) => (
          <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 text-sm">{d.blog.headline}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {d.item.Location} · Approved {new Date(d.approvedAt).toLocaleDateString("en-IN")}
              </p>
            </div>
            {d.blogDocUrl && (
              <a href={d.blogDocUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                Open Doc →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
