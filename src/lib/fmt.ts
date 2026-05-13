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
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : value;
  return isNaN(n) ? 0 : n;
}

/**
 * Parseia input numérico pt-BR para number.
 * Suporta vírgula como separador decimal.
 * Retorna null se vazio, 0 se inválido.
 */
export function parseNumBR(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = parseFloat(value.trim().replace(",", "."));
  return isNaN(n) ? null : n;
}

/**
 * Handler para onKeyDown em inputs numéricos pt-BR.
 * Bloqueia espaço após vírgula e caracteres não numéricos.
 * Permite: 0-9, vírgula, ponto, backspace, delete, setas, tab.
 */
export function numericKeyHandler(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = [
    "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab",
    "Home", "End", "Enter",
  ];
  if (allowed.includes(e.key)) return;

  // Bloqueia espaço
  if (e.key === " ") {
    e.preventDefault();
    return;
  }

  // Permite Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if (e.ctrlKey || e.metaKey) return;

  // Permite dígitos
  if (/^[0-9]$/.test(e.key)) return;

  // Permite apenas uma vírgula ou um ponto
  if (e.key === "," || e.key === ".") {
    const val = (e.currentTarget as HTMLInputElement).value;
    if (val.includes(",") || val.includes(".")) {
      e.preventDefault();
    }
    return;
  }

  // Bloqueia qualquer outra coisa
  e.preventDefault();
}
