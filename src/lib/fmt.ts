/**
 * Formatadores numéricos padrão Brasil (vírgula decimal)
 */

/** Exibição na tela — vírgula decimal, pt-BR */
export function fmtNum(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "-";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Para células de CSV/Excel — vírgula decimal */
export function fmtNumCsv(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "-";
  return value.toFixed(decimals).replace(".", ",");
}

/** Parseia string para número (retorna 0 se inválido) */
export function toNum(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
}
