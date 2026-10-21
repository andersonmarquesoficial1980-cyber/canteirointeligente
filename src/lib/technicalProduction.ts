export interface TechnicalProductionForm {
  houve_producao: boolean;
  tipos_servico: string[];
  infra_descricao: string;
  [field: string]: unknown;
}

/** Fonte comum dos campos visíveis e da validação; unidades nunca são intercambiáveis. */
export const TECHNICAL_QUANTITIES = [
  { label: "Fresagem (m²)", field: "fresagem_m2", requiredType: "FRESAGEM" },
  { label: "RAP Espumado (m²)", field: "rap_espumado_m2", requiredType: "APLICAÇÃO DE RAP ESPUMADO" },
  { label: "Binder (ton)", field: "binder_ton", requiredType: "APLICAÇÃO DE FX II - BINDER" },
  { label: "CBUQ FX3 (ton)", field: "cbuq_fx3_ton", requiredType: "APLICAÇÃO DE FX III" },
  { label: "GAP (ton)", field: "gap_ton", requiredType: "APLICAÇÃO DE GAP GRADED" },
  { label: "BGS (ton)", field: "bgs_ton", requiredType: "APLICAÇÃO DE BGS" },
  { label: "SMA (ton)", field: "sma_ton", requiredType: "APLICAÇÃO DE SMA" },
  { label: "BGTC (m³)", field: "bgtc_m3", requiredType: "APLICAÇÃO DE BGTC" },
  { label: "Macadame (m³)", field: "macadame_m3", requiredType: "APLICAÇÃO DE MACADAME" },
  { label: "CAUQ-RIMA (ton)", field: "cauq_rima_ton", requiredType: "APLICAÇÃO DE CAUQ-RIMA" },
  { label: "BN25 (ton)", field: "bm25_ton", requiredType: "APLICAÇÃO DE BN25" },
  { label: "Geogrelha (m²)", field: "geogrelha_m2", requiredType: "GEOGRELHA" },
  { label: "EGL (ton)", field: "egl_ton", requiredType: "APLICAÇÃO DE EGL" },
  { label: "RACHÃO (ton)", field: "rachao_ton", requiredType: "APLICAÇÃO DE RACHÃO" },
] as const;

/** Serviços qualitativos aprovados; não geram quantidade numérica. */
export const INFRA_SERVICE = "INFRA";
export const ENSAIOS_SERVICE = "ENSAIOS E EXTRAÇÕES";

/** Tokens exatos de `tipo_servico` (separado por vírgula, após trim); nunca por substring. */
export function hasServiceToken(tipoServico: string | null | undefined, token: string): boolean {
  return (tipoServico ?? "").split(",").some(part => part.trim() === token);
}

/** Novas exigências só no envio produtivo, sem exigir rascunho completo. */
export function getTechnicalProductionError(form: TechnicalProductionForm, status: "enviado" | "rascunho"): string | null {
  if (status !== "enviado" || !form.houve_producao) return null;
  const services = new Set(form.tipos_servico.map(service => service.trim()).filter(Boolean));
  if (services.size === 0) return "Selecione ao menos um serviço executado";
  if (services.has("INFRA") && !form.infra_descricao.trim()) return "Descreva o tipo de infra executada";
  for (const { field, label, requiredType } of TECHNICAL_QUANTITIES) {
    if (!services.has(requiredType)) continue;
    const value = form[field];
    const amount = typeof value === "number" ? value : Number(String(value ?? "").trim().replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return `Informe ${label} com valor maior que zero`;
  }
  return null;
}
