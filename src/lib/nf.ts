export const sanitizeNotaFiscalNumero = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";

  const digitsOnly = String(value).replace(/\D/g, "");
  if (!digitsOnly) return "";

  const semZerosEsquerda = digitsOnly.replace(/^0+/, "");
  return semZerosEsquerda || "0";
};
