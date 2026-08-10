import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { getReport, exportReport } from "../api/client";
import { currentFinancialYear, financialYearOptions, formatCurrency } from "../utils";
import Navbar from "../components/Navbar";

const TABS = [
  { key: "monthly", label: "Monthly" },
  { key: "client-wise", label: "Client-wise" },
  { key: "product-wise", label: "Product-wise" }
];

export default function Reports() {
  const { id: companyId } = useParams();
  const [fy, setFy] = useState(currentFinancialYear());
  const [tab, setTab] = useState("monthly");
  const [rows, setRows] = useState([]);
  const [gst, setGst] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getReport(tab, { companyId, fy }).then((data) => { setRows(data); setLoading(false); });
  }, [tab, companyId, fy]);

  useEffect(() => {
    getReport("gst-summary", { companyId, fy }).then(setGst);
  }, [companyId, fy]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-xl font-semibold text-slate-800">Reports</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Financial year</label>
            <select
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              className="border border-slate-300 rounded-md text-sm px-2 py-1.5"
            >
              {financialYearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {gst && (
          <div className="grid grid-cols-3 gap-3 mb-6 max-w-2xl">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">GST collected (output)</div>
              <div className="text-lg font-semibold">{formatCurrency(gst.gstCollected)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">GST paid (input credit)</div>
              <div className="text-lg font-semibold">{formatCurrency(gst.gstPaid)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">Net GST payable</div>
              <div className={`text-lg font-semibold ${gst.gstCollected - gst.gstPaid >= 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {formatCurrency(gst.gstCollected - gst.gstPaid)}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm px-3 py-1.5 rounded-md ${tab === t.key ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-600"}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => exportReport(tab, { companyId, fy })}
            className="ml-auto text-sm bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-md"
          >
            Export to Excel
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-400">No data for this period.</div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                {tab === "monthly" ? (
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="#059669" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : (
                  <BarChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={tab === "client-wise" ? "client" : "product"} fontSize={11} hide={rows.length > 8} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey={tab === "product-wise" ? "revenue" : "sales"} fill="#2563eb" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b">
                    {Object.keys(rows[0]).map((k) => <th key={k} className="p-2 capitalize">{k.replace(/_/g, " ")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} className="p-2">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
