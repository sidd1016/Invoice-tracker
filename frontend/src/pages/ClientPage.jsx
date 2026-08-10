import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getClientDetail } from "../api/client";
import { MONTHS, formatCurrency, formatDate } from "../utils";
import Navbar from "../components/Navbar";
import KpiCard from "../components/KpiCard";

export default function ClientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [month, setMonth] = useState("All");
  const [data, setData] = useState(null);

  useEffect(() => {
    getClientDetail(id, month).then(setData);
  }, [id, month]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  const { client, totals, invoices } = data;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-1 text-sm text-slate-400">{client.company_name}</div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">{client.name}</h1>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-slate-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Link
            to={`/clients/${id}/payments`}
            className="text-sm bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-md"
          >
            View payment history
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <KpiCard label="Total sales" value={formatCurrency(totals.totalSales)} />
          <KpiCard label="Total purchase" value={formatCurrency(totals.totalPurchase)} />
          <KpiCard label="Total profit" value={formatCurrency(totals.totalProfit)} accent="text-emerald-600" />
          <KpiCard label="Invoice count" value={totals.invoiceCount} />
          <KpiCard label="Average margin" value={`${totals.averageMargin}%`} />
          <KpiCard label="Last invoice" value={formatDate(totals.lastInvoiceDate)} />
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-700 mb-3">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-400">No invoices for this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b">
                  <th className="py-1.5">Invoice #</th>
                  <th>Date</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">Purchase</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">GST</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="py-1.5">{inv.invoice_number}</td>
                    <td>{formatDate(inv.invoice_date)}</td>
                    <td className="text-right">{formatCurrency(inv.sales_total)}</td>
                    <td className="text-right">{formatCurrency(inv.purchase_total)}</td>
                    <td className="text-right text-emerald-600">{formatCurrency(inv.profit_total)}</td>
                    <td className="text-right">{formatCurrency(inv.gst_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
