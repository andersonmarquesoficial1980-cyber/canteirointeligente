export type EquipmentLike = {
  frota?: string | null;
  fleet_number?: string | null;
  nome?: string | null;
  equipment_type?: string | null;
  tipo?: string | null;
  categoria_rdo?: string | null;
};

const CATEGORY_ORDER = [
  "FRESAGEM",
  "BOBCAT",
  "VIBROACABADORA",
  "ROLO COMPACTADOR",
  "VEÍCULOS",
  "LINHA AMARELA",
  "PEQUENO PORTE",
  "USINA MÓVEL",
] as const;

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  FRESAGEM: "FRESADORA",
};

const TYPE_KEYWORDS_BY_CATEGORY: Array<{ category: string; keywords: string[] }> = [
  { category: "FRESAGEM", keywords: ["FRESADORA"] },
  { category: "BOBCAT", keywords: ["BOBCAT"] },
  { category: "VIBROACABADORA", keywords: ["VIBRO ACABADORA"] },
  { category: "ROLO COMPACTADOR", keywords: ["ROLO CHAPA", "ROLO PNEU", "ROLO PE DE CARNEIRO"] },
  { category: "VEÍCULOS", keywords: ["CAMINHAO", "CAVALO MECANICO", "PRANCHA REBOQUE", "MICROONIBUS", "VAN"] },
  { category: "LINHA AMARELA", keywords: ["RETROESCAVADEIRA", "ESCAVADEIRA HIDRAULICA", "PA CARREGADEIRA", "MOTONIVELADORA", "TRATOR DE ESTEIRA", "MINI ESCAVADEIRA"] },
  { category: "PEQUENO PORTE", keywords: ["COMPRESSOR", "DENSIMETRO", "GERADOR", "MISTURADOR DE ARGAMASSA", "PLACA VIBRATORIA", "ROMPEDOR ELETRICO", "ROMPEDOR PNEUMATICO", "SERRA CLIPPER", "TORRE DE ILUMINACAO"] },
  { category: "USINA MÓVEL", keywords: ["USINA MOVEL"] },
];

export function normalizeTxt(v: string) {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeCategory(v: string) {
  const normalized = normalizeTxt(v);
  const direct = CATEGORY_ORDER.find((c) => normalizeTxt(c) === normalized);
  if (direct) return direct;
  return v;
}

export function resolveEquipmentCategory(eq: EquipmentLike) {
  if (eq?.categoria_rdo) {
    return normalizeCategory(eq.categoria_rdo);
  }

  const tipo = normalizeTxt(eq?.tipo || eq?.equipment_type || "");
  for (const rule of TYPE_KEYWORDS_BY_CATEGORY) {
    if (rule.keywords.some((k) => tipo.includes(normalizeTxt(k)))) {
      return rule.category;
    }
  }

  return "OUTROS";
}

export function categoryUiLabel(category: string) {
  return CATEGORY_LABEL_OVERRIDES[category] || category;
}

export function buildEquipmentTypeOptionsFromEquipments(equipments: EquipmentLike[]) {
  const unique = new Set<string>();
  for (const eq of equipments || []) {
    const cat = resolveEquipmentCategory(eq);
    if (cat) unique.add(cat);
  }

  return Array.from(unique)
    .map((value) => ({ value, label: categoryUiLabel(value) }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.value as (typeof CATEGORY_ORDER)[number]);
      const ib = CATEGORY_ORDER.indexOf(b.value as (typeof CATEGORY_ORDER)[number]);
      const inA = ia >= 0;
      const inB = ib >= 0;
      if (inA && inB) return ia - ib;
      if (inA) return -1;
      if (inB) return 1;
      return a.label.localeCompare(b.label, "pt-BR");
    });
}

export function listEquipmentFleetsByCategory(equipments: EquipmentLike[], category: string) {
  const categoryNormalized = normalizeTxt(category);
  const filtered = (equipments || []).filter((eq) => normalizeTxt(resolveEquipmentCategory(eq)) === categoryNormalized);

  const seen = new Set<string>();
  return filtered.filter((eq) => {
    const frota = String(eq.frota || eq.fleet_number || "").trim().toUpperCase();
    if (!frota || seen.has(frota)) return false;
    seen.add(frota);
    return true;
  });
}
