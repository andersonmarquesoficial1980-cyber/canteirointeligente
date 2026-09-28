type Group<T> = { title: string; items: T[] };
const norm = (text?: string | null) => (text || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR").trim();

const PEOPLE_ORDER = [
  "Encarregado", "Apontador", "Técnico de Segurança", "Marteleteiro", "Ajudantes", "Sinaleiros",
  "Rasteleiros", "Mangueirista", "Mesista", "Operadores", "Motoristas", "Outros",
] as const;
const EQUIPMENT_ORDER = [
  "Fresadora", "Bobcat", "Rolos", "Vibroacabadoras", "Caminhões", "Veículo de Transportes", "Pequeno Porte", "Outros",
] as const;

function personCategory(role: string | null) {
  const text = norm(role);
  if (text.includes("ENCARREGAD")) return "Encarregado";
  if (text.includes("APONTADOR")) return "Apontador";
  if (text.includes("SEGURANCA") && /TECNIC|TEC\b|TST\b/.test(text)) return "Técnico de Segurança";
  if (text.includes("MARTELETEIR")) return "Marteleteiro";
  if (text.includes("AJUDANTE")) return "Ajudantes";
  if (text.includes("SINALEIR")) return "Sinaleiros";
  if (text.includes("RASTELEIR")) return "Rasteleiros";
  if (text.includes("MANGUEIRIST")) return "Mangueirista";
  if (text.includes("MESIST")) return "Mesista";
  if (text.includes("OPERADOR")) return "Operadores";
  if (text.includes("MOTORISTA")) return "Motoristas";
  return "Outros";
}

function equipmentCategory(type: string | null, registeredCategory?: string | null) {
  // The master fleet registry owns the category. Type matching is only a fallback
  // for older rows whose categoria_rdo is absent or not one of these groups.
  const category = norm(registeredCategory).replace(/_/g, " ");
  if (category === "PEQUENO PORTE") return "Pequeno Porte";
  if (category === "FRESAGEM") return "Fresadora";
  if (category === "BOBCAT") return "Bobcat";
  if (category === "ROLO COMPACTADOR") return "Rolos";
  if (category === "VIBROACABADORA") return "Vibroacabadoras";
  const text = norm(type);
  if (text.includes("FRESADOR")) return "Fresadora";
  if (/BOBCAT|MINI.?CARREGADEIRA|MINI.?CARREGADOR/.test(text)) return "Bobcat";
  if (/\bROLOS?\b|COMPACTADOR/.test(text)) return "Rolos";
  if (/VIBRO.?ACABADORA|VIBRO.?ACABAMENTO/.test(text)) return "Vibroacabadoras";
  if (/BANHEIRO|COMPRESSOR|GERADOR|DENSIMETRO|CARRETINHA|MARTELETE|PLACA VIBRATORIA|BETONEIRA|MOTOBOMBA|TORRE DE ILUMINACAO/.test(text)) return "Pequeno Porte";
  if (/CAMINHAO|CAMINHOES|CAVALO MECANICO|CARRETA\b/.test(text)) return "Caminhões";
  if (/ONIBUS|VAN\b|VEICULO|AUTOMOVEL|CARRO\b|CAMINHONETE|UTILITARIO|PICK.?UP|TRANSPORTE|MOTOCICLET/.test(text)) return "Veículo de Transportes";
  return "Outros";
}

function grouped<T>(rows: readonly T[], titles: readonly string[], category: (row: T) => string): Group<T>[] {
  const buckets = new Map(titles.map(title => [title, [] as T[]]));
  for (const row of rows) buckets.get(category(row))!.push(row);
  return titles.map(title => ({ title, items: buckets.get(title)! })).filter(group => group.items.length > 0);
}

export function groupPeopleForProgramador<T extends { role?: string | null }>(rows: readonly T[]): Group<T>[] {
  return grouped(rows, PEOPLE_ORDER, row => personCategory(row.role ?? null));
}
export function groupEquipmentForProgramador<T extends { tipo?: string | null; categoria_rdo?: string | null }>(rows: readonly T[]): Group<T>[] {
  return grouped(rows, EQUIPMENT_ORDER, row => equipmentCategory(row.tipo ?? null, row.categoria_rdo));
}
