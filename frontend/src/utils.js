export const MONTHS = [
  "All", "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

export function currentFinancialYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

export function financialYearOptions(spanBack = 5) {
  const current = currentFinancialYear();
  const startYear = parseInt(current.slice(0, 4), 10);
  const years = [];
  for (let i = 0; i < spanBack; i++) {
    const y = startYear - i;
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
}

export function formatCurrency(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
