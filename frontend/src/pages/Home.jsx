import { useEffect, useState } from "react";
import { getCompanies, createCompany } from "../api/client";
import { currentFinancialYear } from "../utils";
import Navbar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import CompanyCard from "../components/CompanyCard";

export default function Home() {
  const [fy, setFy] = useState(currentFinancialYear());
  const [month, setMonth] = useState("All");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    setLoading(true);
    const data = await getCompanies(fy, month);
    setCompanies(data);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fy, month]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createCompany(newName.trim());
    setNewName("");
    setShowAdd(false);
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-slate-800">Companies</h1>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-md"
          >
            + Add company
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="mb-4 flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Company name"
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md">Save</button>
          </form>
        )}

        <FilterBar fy={fy} setFy={setFy} month={month} setMonth={setMonth} />

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : companies.length === 0 ? (
          <div className="text-slate-400 text-sm">No companies yet. Add one to get started.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
