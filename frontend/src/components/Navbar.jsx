import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { globalSearch } from "../api/client";

export default function Navbar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);

  async function handleSearch(e) {
    const value = e.target.value;
    setQ(value);
    if (value.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    const data = await globalSearch(value.trim());
    setResults(data);
    setOpen(true);
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-20 bg-brand-700 text-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-semibold text-lg whitespace-nowrap">
          Invoice Tracker
        </Link>

        <div className="relative flex-1 max-w-md">
          <input
            value={q}
            onChange={handleSearch}
            placeholder="Search invoice #, client, product..."
            className="w-full rounded-md px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {open && results && (
            <div className="absolute mt-1 w-full bg-white text-slate-800 rounded-md shadow-lg max-h-80 overflow-auto text-sm">
              {results.invoices.length === 0 && results.clients.length === 0 && results.products.length === 0 && (
                <div className="p-3 text-slate-400">No matches</div>
              )}
              {results.invoices.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-semibold text-slate-400 px-2 py-1">Invoices</div>
                  {results.invoices.map((inv) => (
                    <button
                      key={inv.id}
                      className="w-full text-left px-2 py-1.5 hover:bg-slate-100 rounded"
                      onClick={() => { setOpen(false); navigate(`/invoices/${inv.id}`); }}
                    >
                      #{inv.invoice_number} — {inv.client_name} ({inv.company_name})
                    </button>
                  ))}
                </div>
              )}
              {results.clients.length > 0 && (
                <div className="p-2 border-t">
                  <div className="text-xs font-semibold text-slate-400 px-2 py-1">Clients</div>
                  {results.clients.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-2 py-1.5 hover:bg-slate-100 rounded"
                      onClick={() => { setOpen(false); navigate(`/clients/${c.id}`); }}
                    >
                      {c.name} ({c.company_name})
                    </button>
                  ))}
                </div>
              )}
              {results.products.length > 0 && (
                <div className="p-2 border-t">
                  <div className="text-xs font-semibold text-slate-400 px-2 py-1">Products</div>
                  {results.products.map((p) => (
                    <div key={p} className="px-2 py-1.5 text-slate-600">{p}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={logout} className="text-sm bg-brand-600 hover:bg-brand-500 px-3 py-1.5 rounded-md">
          Log out
        </button>
      </div>
    </header>
  );
}
