import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getClientPaymentHistory } from "../api/client";
import { formatCurrency, formatDate } from "../utils";
import Navbar from "../components/Navbar";
import KpiCard from "../components/KpiCard";

export default function PaymentHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    getClientPaymentHistory(id).then(setData);
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-6 text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  const { client, payments, summary } = data;
  const isPaid = summary.balanceDue <= 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Link to={`/clients/${id}`} className="text-sm text-brand-600 hover:underline">← Back to {client.name}</Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1 mb-4">Payment history — {client.name}</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <KpiCard label="Total invoiced (incl. GST)" value={formatCurrency(summary.totalInvoiced)} />
          <KpiCard label="Total received" value={formatCurrency(summary.totalReceived)} accent="text-emerald-600" />
          <KpiCard
            label="Balance due"
            value={isPaid ? "Fully paid" : formatCurrency(summary.balanceDue)}
            accent={isPaid ? "text-emerald-600" : "text-amber-600"}
          />
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold text-slate-700 mb-3">All payments</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded for this client yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b">
                  <th className="py-1.5">Date received</th>
                  <th>Invoice #</th>
                  <th>Type</th>
                  <th>Notes</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/invoices/${p.invoice_id}`)}
                  >
                    <td className="py-1.5">{formatDate(p.payment_date)}</td>
                    <td>#{p.invoice_number}</td>
                    <td className="capitalize">{p.payment_type}</td>
                    <td className="text-slate-500">{p.notes || "—"}</td>
                    <td className="text-right">{formatCurrency(p.amount)}</td>
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
