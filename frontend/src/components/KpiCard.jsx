export default function KpiCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className={`text-xl font-semibold ${accent || "text-slate-800"}`}>{value}</div>
    </div>
  );
}
