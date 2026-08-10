import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getClientsForCompany, createClient, checkDuplicateInvoice,
  previewInvoiceExcel, saveInvoice, downloadTemplate
} from "../api/client";
import { formatCurrency, formatDate } from "../utils";
import Navbar from "../components/Navbar";

const STEPS = ["Client", "Invoice details", "Upload"];

export default function UploadInvoice() {
  const { id: companyId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [hasAdvance, setHasAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { items, totals }
  const [errors, setErrors] = useState([]);
  const [duplicate, setDuplicate] = useState(null); // { existing } | null
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    getClientsForCompany(companyId).then(setClients);
  }, [companyId]);

  async function handleAddClient(e) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    const c = await createClient(companyId, newClientName.trim());
    setClients((prev) => [...prev, c]);
    setClientId(c.id);
    setNewClientName("");
    setAddingClient(false);
  }

  async function goToUploadStep() {
    setSaveError("");
    setDuplicateChecked(false);
    setDuplicate(null);
    const result = await checkDuplicateInvoice(companyId, clientId, invoiceNumber.trim());
    setDuplicateChecked(true);
    if (result.duplicate) setDuplicate(result.existing);
    setStep(2);
  }

  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setErrors([]);
    setBusy(true);
    try {
      const data = await previewInvoiceExcel(f);
      setPreview(data);
    } catch (err) {
      setErrors(err.response?.data?.errors || ["Failed to parse the file."]);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(action) {
    if (!preview) return;
    setBusy(true);
    setSaveError("");
    try {
      const result = await saveInvoice({
        companyId, clientId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        items: preview.items,
        action: duplicate ? action : undefined,
        file,
        advanceAmount: hasAdvance && advanceAmount ? advanceAmount : undefined,
        advanceDate: hasAdvance && advanceAmount ? advanceDate : undefined
      });
      navigate(`/invoices/${result.id}`);
    } catch (err) {
      setSaveError(err.response?.data?.error || "Failed to save invoice.");
    } finally {
      setBusy(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Upload invoice</h1>

        <ol className="flex items-center gap-2 text-sm mb-6">
          {STEPS.map((s, i) => (
            <li key={s} className={`px-3 py-1 rounded-full ${i === step ? "bg-brand-600 text-white" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="block text-sm text-slate-600 mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {!addingClient ? (
              <button className="text-sm text-brand-600 hover:underline" onClick={() => setAddingClient(true)}>
                + Add new client
              </button>
            ) : (
              <form onSubmit={handleAddClient} className="flex gap-2 mt-2">
                <input
                  autoFocus
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="New client name"
                  className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-md">Add</button>
              </form>
            )}

            <div className="mt-6 flex justify-end">
              <button
                disabled={!clientId}
                onClick={() => setStep(1)}
                className="bg-brand-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-md"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-sm text-slate-500 mb-3">Client: <strong>{selectedClient?.name}</strong></div>

            <label className="block text-sm text-slate-600 mb-1">Invoice number</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <label className="block text-sm text-slate-600 mb-1">Invoice date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
              <input type="checkbox" checked={hasAdvance} onChange={(e) => setHasAdvance(e.target.checked)} />
              Received an advance payment for this invoice
            </label>

            {hasAdvance && (
              <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 rounded-md p-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Advance amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date received</label>
                  <input
                    type="date"
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="text-sm text-slate-500 px-4 py-2">Back</button>
              <button
                disabled={!invoiceNumber.trim() || !invoiceDate}
                onClick={goToUploadStep}
                className="bg-brand-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-md"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {duplicateChecked && duplicate && (
              <div className="mb-4 border border-amber-300 bg-amber-50 rounded-md p-3 text-sm">
                <p className="font-medium text-amber-800 mb-1">This invoice number already exists for this client.</p>
                <p className="text-amber-700">
                  Existing invoice — date {formatDate(duplicate.invoiceDate)}, amount {formatCurrency(duplicate.salesTotal)}, {duplicate.itemCount} item(s).
                </p>
                <p className="text-amber-700 mt-1">You'll choose to replace it or save as a new version after uploading.</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-slate-600">Excel file</label>
              <button onClick={downloadTemplate} className="text-xs text-brand-600 hover:underline">Download template</button>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 mb-3"
            />

            {busy && <p className="text-sm text-slate-400">Processing...</p>}

            {errors.length > 0 && (
              <div className="mb-4 border border-red-300 bg-red-50 rounded-md p-3 text-sm text-red-700">
                <p className="font-medium mb-1">Please fix the following and re-upload:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {preview && (
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Preview ({preview.items.length} item(s))</p>
                <div className="max-h-64 overflow-auto border border-slate-200 rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-500">
                        <th className="p-2">Product</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Buy</th>
                        <th className="p-2 text-right">Sell</th>
                        <th className="p-2 text-right">GST%</th>
                        <th className="p-2 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((it, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{it.productName}</td>
                          <td className="p-2 text-right">{it.quantity}</td>
                          <td className="p-2 text-right">{it.buyPrice}</td>
                          <td className="p-2 text-right">{it.sellPrice}</td>
                          <td className="p-2 text-right">{it.gstPercent}</td>
                          <td className="p-2 text-right text-emerald-600">{it.profit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
                  <SummaryStat label="Purchase" value={formatCurrency(preview.totals.purchaseTotal)} />
                  <SummaryStat label="Sales" value={formatCurrency(preview.totals.salesTotal)} />
                  <SummaryStat label="Profit" value={formatCurrency(preview.totals.profitTotal)} accent />
                  <SummaryStat label="GST" value={formatCurrency(preview.totals.gstTotal)} />
                </div>
              </div>
            )}

            {saveError && <div className="mb-3 text-sm text-red-600">{saveError}</div>}

            <div className="flex justify-between items-center">
              <button onClick={() => setStep(1)} className="text-sm text-slate-500 px-4 py-2">Back</button>
              {preview && !duplicate && (
                <button disabled={busy} onClick={() => handleSave()} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
                  Save invoice
                </button>
              )}
              {preview && duplicate && (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => handleSave("replace")} className="bg-amber-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
                    Replace existing
                  </button>
                  <button disabled={busy} onClick={() => handleSave("new-version")} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
                    Save as new version
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryStat({ label, value, accent }) {
  return (
    <div className="bg-slate-50 rounded-md p-2 text-center">
      <div className="text-slate-400 text-xs">{label}</div>
      <div className={accent ? "font-semibold text-emerald-600" : "font-medium"}>{value}</div>
    </div>
  );
}
