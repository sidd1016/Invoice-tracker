import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getCompanyDashboard, downloadTemplate } from "../api/client";
import { currentFinancialYear, formatCurrency, formatDate } from "../utils";
import Navbar from "../components/Navbar";
import FilterBar from "../components/FilterBar";
import KpiCard from "../components/KpiCard";

export default function CompanyDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fy, setFy] = useState(currentFinancialYear());
  const [month, setMonth] = useState("All");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const d = await getCompanyDashboard(id, fy, month);
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, fy, month]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  const { company, totals, recentInvoices, topClients } = data;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-semibold text-slate-800">{company.name}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/companies/${id}/upload`)}
              className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-md"
            >
              Upload invoice
            </button>
            <button
              onClick={downloadTemplate}
              className="text-sm bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-md"
            >
              Download template
            </button>
            <Link
              to={`/companies/${id}/reports`}
              className="text-sm bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-md"
            >
              View reports
            </Link>
          </div>
        </div>

        <FilterBar fy={fy} setFy={setFy} month={month} setMonth={setMonth} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Total sales" value={formatCurrency(totals.totalSales)} />
          <KpiCard label="Total purchase" value={formatCurrency(totals.totalPurchase)} />
          <KpiCard label="Gross profit" value={formatCurrency(totals.grossProfit)} accent="text-emerald-600" />
          <KpiCard label="Profit margin" value={`${totals.profitMargin}%`} />
          <KpiCard label="GST collected" value={formatCurrency(totals.gstCollected)} />
          <KpiCard label="GST paid" value={formatCurrency(totals.gstPaid)} />
          <KpiCard label="Invoices" value={totals.invoiceCount} />
          <KpiCard label="Clients" value={totals.clientCount} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Recent invoices</h2>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-slate-400">No invoices yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b">
                    <th className="py-1.5">Invoice #</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th className="text-right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      <td className="py-1.5">{inv.invoice_number}</td>
                      <td>{inv.client_name}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td className="text-right">{formatCurrency(inv.sales_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold text-slate-700 mb-3">Top clients</h2>
            {topClients.length === 0 ? (
              <p className="text-sm text-slate-400">No clients yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b">
                    <th className="py-1.5">Client</th>
                    <th className="text-right">Sales</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/clients/${c.id}`)}
                    >
                      <td className="py-1.5">{c.name}</td>
                      <td className="text-right">{formatCurrency(c.total_sales)}</td>
                      <td className="text-right text-emerald-600">{formatCurrency(c.total_profit)}</td>
                      <td className="text-right">{c.invoice_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
