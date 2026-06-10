/**
 * Format a Date as YYYY-MM-DD using the server's LOCAL time components
 * (not UTC). When the container runs with TZ=Asia/Jakarta, this yields
 * correct WIB calendar-day grouping for reports and trends.
 */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
