// Indian financial year runs April -> March.
// e.g. 15 June 2025 -> "2025-26", 15 Jan 2026 -> "2025-26"
export function financialYearFor(dateInput) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  return `${year - 1}-${String(year).slice(-2)}`;
}

export const MONTH_NAMES = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

// Maps a JS month (0-11, Jan=0) to its position in the FY month order above.
export function fyMonthIndex(jsMonth) {
  // Jan(0)..Mar(2) -> 9..11 ; Apr(3)..Dec(11) -> 0..8
  return jsMonth >= 3 ? jsMonth - 3 : jsMonth + 9;
}
