const STOPWORDS = new Set(["DA", "DE", "DI", "DO", "DOS", "DAS", "E"]);

export function normalizePersonName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function tokenizePersonName(value: string | null | undefined): string[] {
  return normalizePersonName(value)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function namesLikelyMatch(profileName: string | null | undefined, targetName: string | null | undefined): boolean {
  const a = normalizePersonName(profileName);
  const b = normalizePersonName(targetName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const tokensA = tokenizePersonName(a);
  const tokensB = new Set(tokenizePersonName(b));
  if (tokensA.length === 0) return false;

  // Para evitar falso positivo com nomes muito curtos, exige 2+ tokens quando possível.
  if (tokensA.length >= 2) {
    return tokensA.every((tk) => tokensB.has(tk));
  }

  return tokensB.has(tokensA[0]);
}
