export function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

export function formatQuantity(qty: number, unit: string): string {
  const rounded = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
  return `${rounded} ${unit}`;
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
