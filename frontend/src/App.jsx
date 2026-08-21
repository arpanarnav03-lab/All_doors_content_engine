import { Routes, Route, NavLink } from "react-router-dom";
import Ideas from "./pages/Ideas.jsx";
import Queue from "./pages/Queue.jsx";
import Review from "./pages/Review.jsx";
import Published from "./pages/Published.jsx";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Alldoors Content Review</h1>
            <p className="text-xs text-slate-500">AI-generated drafts, human-approved</p>
          </div>
          <nav className="flex gap-2">
            <NavItem to="/">Ideas</NavItem>
            <NavItem to="/queue">Queue</NavItem>
            <NavItem to="/published">Published</NavItem>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Ideas />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/review/:id" element={<Review />} />
          <Route path="/published" element={<Published />} />
        </Routes>
      </main>
    </div>
  );
}
