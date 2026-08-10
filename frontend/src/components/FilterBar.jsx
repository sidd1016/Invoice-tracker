import { MONTHS, financialYearOptions } from "../utils";

export default function FilterBar({ fy, setFy, month, setMonth }) {
  return (
    <div className="flex flex-wrap gap-3 items-center bg-white border border-slate-200 rounded-lg px-4 py-3 mb-6">
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-500">Financial year</label>
        <select
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          className="border border-slate-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {financialYearOptions().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-500">Month</label>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
