import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getInvoice, deleteInvoice, getInvoiceDownloadUrl, addPayment, deletePayment } from "../api/client";
import { formatCurrency, formatDate } from "../utils";
import Navbar from "../components/Navbar";

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState("");

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  function load() {
    getInvoice(id).then(setData);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function handleDelete() {
    await deleteInvoice(id);
    navigate(-1);
  }

  async function handleAddPayment(e) {
    e.preventDefault();
    setPaymentError("");
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }
    setSavingPayment(true);
    try {
      await addPayment(id, { amount: amt, paymentDate, paymentType: "payment", notes: paymentNotes || undefined });
      setPaymentAmount("");
      setPaymentNotes("");
      setShowPaymentForm(false);
      load();
    } catch (err) {
      setPaymentError(err.response?.data?.error || "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDeletePayment(paymentId) {
    await deletePayment(id, paymentId);
    load();
  }

  async function handleDownloadOriginal() {
    try {
      const { url } = await getInvoiceDownloadUrl(id);
      window.open(url, "_blank");
    } catch {
      setDownloadMsg("The original file isn't available for this invoice.");
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-6 text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  const { invoice, items, payments, paymentSummary } = data;
  const balanceDue = paymentSummary?.balanceDue ?? Number(invoice.sales_total);
  const isPaid = balanceDue <= 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-sm text-slate-400">{invoice.company_name} · {invoice.client_name}</div>
            <h1 className="text-xl font-semibold text-slate-800">
              Invoice #{invoice.invoice_number}
              {invoice.version > 1 && <span className="ml-2 text-sm font-normal text-amber-600">(v{invoice.version})</span>}
            </h1>
            <div className="text-sm text-slate-500">{formatDate(invoice.invoice_date)} · FY {invoice.financial_year}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDownloadOriginal} className="text-sm bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-md">
              Download original
            </button>
            <button onClick={() => setConfirmingDelete(true)} className="text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-md">
              Delete
            </button>
          </div>
        </div>

        {downloadMsg && <div className="mb-4 text-sm text-amber-600">{downloadMsg}</div>}

        {confirmingDelete && (
          <div className="mb-4 border border-red-300 bg-red-50 rounded-md p-3 text-sm">
            <p className="text-red-700 mb-2">Delete this invoice permanently? This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="bg-red-600 text-white text-sm px-3 py-1.5 rounded-md">Yes, delete</button>
              <button onClick={() => setConfirmingDelete(false)} className="text-sm px-3 py-1.5">Cancel</button>
            </div>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-slate-700 mb-3">Items</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b">
                  <th className="py-1.5">Product</th>
                  <th>HSN</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Buy</th>
                  <th className="text-right">Sell</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">GST</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-1.5">{it.product_name}</td>
                    <td>{it.hsn || "—"}</td>
                    <td className="text-right">{it.quantity}</td>
                    <td className="text-right">{formatCurrency(it.buy_price)}</td>
                    <td className="text-right">{formatCurrency(it.sell_price)}</td>
                    <td className="text-right text-emerald-600">{formatCurrency(it.profit)}</td>
                    <td className="text-right">{formatCurrency(it.gst_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-slate-700 mb-3">Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <SummaryStat label="Purchase total (excl. GST)" value={formatCurrency(invoice.purchase_total)} />
            <SummaryStat label="Sales total (excl. GST)" value={formatCurrency(invoice.sales_total)} />
            <SummaryStat label="Gross profit" value={formatCurrency(invoice.profit_total)} accent />
            <SummaryStat label="GST total" value={formatCurrency(invoice.gst_total)} />
          </div>
          <div className="mt-3 pt-3 border-t">
            <SummaryStat label="Amount receivable (incl. GST)" value={formatCurrency(paymentSummary?.grandTotal)} accent />
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-slate-700">Payments</h2>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {isPaid ? "Fully paid" : `Balance due: ${formatCurrency(balanceDue)}`}
              </span>
              <button
                onClick={() => setShowPaymentForm((s) => !s)}
                className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-md"
              >
                Record payment
              </button>
            </div>
          </div>

          {showPaymentForm && (
            <form onSubmit={handleAddPayment} className="mb-4 bg-slate-50 rounded-md p-3">
              {paymentError && <div className="mb-2 text-sm text-red-600">{paymentError}</div>}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount received</label>
                  <input
                    type="number" min="0" step="0.01" autoFocus
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date received</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
              <input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g. Bank transfer, cheque #123"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <button disabled={savingPayment} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
                  {savingPayment ? "Saving..." : "Save payment"}
                </button>
                <button type="button" onClick={() => setShowPaymentForm(false)} className="text-sm px-4 py-2 text-slate-500">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {payments.length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b">
                  <th className="py-1.5">Date</th>
                  <th>Type</th>
                  <th>Notes</th>
                  <th className="text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-1.5">{formatDate(p.payment_date)}</td>
                    <td className="capitalize">{p.payment_type}</td>
                    <td className="text-slate-500">{p.notes || "—"}</td>
                    <td className="text-right">{formatCurrency(p.amount)}</td>
                    <td className="text-right">
                      <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-500 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td colSpan={3} className="py-2">Total received</td>
                  <td className="text-right py-2">{formatCurrency(paymentSummary.totalReceived)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryStat({ label, value, accent }) {
  return (
    <div>
      <div className="text-slate-400 text-xs">{label}</div>
      <div className={accent ? "font-semibold text-emerald-600" : "font-medium text-slate-700"}>{value}</div>
    </div>
  );
}
