export function toLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysLocalISO(baseDate: Date, days: number): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
}
