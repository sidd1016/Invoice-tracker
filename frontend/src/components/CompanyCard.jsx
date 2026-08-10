import { Link } from "react-router-dom";
import { formatCurrency } from "../utils";

export default function CompanyCard({ company }) {
  return (
    <Link
      to={`/companies/${company.id}`}
      className="block bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-brand-300 transition"
    >
      <h3 className="font-semibold text-lg text-slate-800 mb-3">{company.name}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Total sales" value={formatCurrency(company.total_sales)} />
        <Stat label="Total purchase" value={formatCurrency(company.total_purchase)} />
        <Stat label="Total profit" value={formatCurrency(company.total_profit)} highlight />
        <Stat label="Invoices" value={company.invoice_count} />
        <Stat label="Clients" value={company.client_count} />
      </div>
    </Link>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <div className="text-slate-400 text-xs">{label}</div>
      <div className={highlight ? "font-semibold text-emerald-600" : "font-medium text-slate-700"}>{value}</div>
    </div>
  );
}
