/** Campos de apoio/qualidade, retrabalho e caminhões do RDO Técnico (valores de formulário em string). */
export interface TechnicalExtrasForm {
  houve_producao: boolean;
  retrabalho: boolean;
  retrabalho_oficio: string;
  autorizacao_no_horario: "" | "sim" | "nao";
  autorizacao_atraso_detalhe: string;
  autorizacao_motivo: string;
  autorizacao_horario_previsto: string;
  autorizacao_horario_real: string;
  sinalizacao_presente: "" | "sim" | "nao";
  sinalizacao_nota: number;
  controle_tecnologico_presente: "" | "sim" | "nao";
  sinalizacao_vertical_nota: number;
  controle_tecnologico_nota: number;
  sinalizacao_ausente_motivo: string;
  controle_tecnologico_ausente_motivo: string;
}

export const TECHNICAL_EXTRAS_DEFAULTS = {
  retrabalho: false,
  retrabalho_oficio: "",
  qtd_caminhoes_basculante: "",
  autorizacao_no_horario: "" as "" | "sim" | "nao",
  autorizacao_atraso_detalhe: "",
  autorizacao_motivo: "",
  autorizacao_horario_previsto: "",
  autorizacao_horario_real: "",
  sinalizacao_presente: "" as "" | "sim" | "nao",
  sinalizacao_nota: 0,
  controle_tecnologico_presente: "" as "" | "sim" | "nao",
  sinalizacao_vertical_nota: 0,
  controle_tecnologico_nota: 0,
  sinalizacao_ausente_motivo: "",
  controle_tecnologico_ausente_motivo: "",
};

/** Motivos de liberação fora do horário (texto exato gravado e usado pelo Dashboard). */
export const MOTIVOS_LIBERACAO = [
  "Fiscalização não liberou a pista",
  "Cliente / contratante (outro motivo)",
  "Condições climáticas",
  "Aguardando sinalização / interdição da via",
  "Usina / massa asfáltica atrasou",
  "Equipe ou equipamento da Fremix",
  "Outro",
] as const;

/** Quem responde pelo motivo — mostra à diretoria o que foi causa externa. */
export type ResponsavelLiberacao = "Cliente / fiscalização" | "Clima" | "Terceiros" | "Fremix" | "A esclarecer";
export const RESPONSAVEL_LIBERACAO: Record<string, ResponsavelLiberacao> = {
  "Fiscalização não liberou a pista": "Cliente / fiscalização",
  "Cliente / contratante (outro motivo)": "Cliente / fiscalização",
  "Condições climáticas": "Clima",
  "Aguardando sinalização / interdição da via": "Terceiros",
  "Usina / massa asfáltica atrasou": "Terceiros",
  "Equipe ou equipamento da Fremix": "Fremix",
};
export const responsavelLiberacao = (motivo?: string | null): ResponsavelLiberacao => RESPONSAVEL_LIBERACAO[motivo || ""] ?? "A esclarecer";

/** "HH:MM[:SS]" -> minutos desde 00:00 (null se inválido). */
export const horaParaMin = (h?: string | null): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Atraso em minutos entre previsto e real (null se faltar dado ou real < previsto). */
export const atrasoMinutos = (previsto?: string | null, real?: string | null): number | null => {
  const a = horaParaMin(previsto), b = horaParaMin(real);
  return a == null || b == null || b < a ? null : b - a;
};

export const simNaoToBool = (v: string): boolean | null => (v === "sim" ? true : v === "nao" ? false : null);
export const boolToSimNao = (v: boolean | null | undefined): "" | "sim" | "nao" => (v == null ? "" : v ? "sim" : "nao");

/** Exigências só no envio de dia produtivo; rascunho nunca é bloqueado. */
export function getTechnicalExtrasError(
  form: TechnicalExtrasForm,
  status: "enviado" | "rascunho",
  opts?: { simplificado?: boolean },
): string | null {
  if (status !== "enviado" || !form.houve_producao || opts?.simplificado) return null;
  if (form.retrabalho && !form.retrabalho_oficio.trim()) return "Preencha a Obs Retrabalho";
  if (form.autorizacao_no_horario === "") return "Informe se a obra foi liberada no horário previsto";
  if (form.autorizacao_no_horario === "nao" && !form.autorizacao_motivo) return "Selecione o motivo da liberação fora do horário";
  if (form.autorizacao_no_horario === "nao" && !form.autorizacao_atraso_detalhe.trim()) return "Justifique a liberação fora do horário";
  if (form.sinalizacao_presente === "") return "Informe se a equipe de sinalização estava presente no horário";
  if (form.sinalizacao_presente === "nao" && !form.sinalizacao_ausente_motivo.trim()) return "Explique por que a equipe de sinalização não estava presente no horário";
  if (form.sinalizacao_presente === "sim" && !form.sinalizacao_nota) return "Avalie a equipe de sinalização (1 a 5)";
  if (form.controle_tecnologico_presente === "") return "Informe se o controle tecnológico esteve presente no horário";
  if (form.controle_tecnologico_presente === "nao" && !form.controle_tecnologico_ausente_motivo.trim()) return "Explique por que o controle tecnológico não esteve presente no horário";
  if (form.controle_tecnologico_presente === "sim" && !form.controle_tecnologico_nota) return "Avalie a equipe de controle tecnológico (1 a 5)";
  if (!form.sinalizacao_vertical_nota) return "Avalie a sinalização vertical (1 a 5)";
  return null;
}

export const toIntOrNull = (v: string): number | null => {
  const n = Number(String(v).trim().replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, Math.trunc(n));
};


/** OGS com formulário simplificado (sem usina, retrabalho, caminhões, % conclusão e apoio/qualidade). */
export const OGS_RDO_SIMPLIFICADAS = ["2339"];
export const isOgsRdoSimplificada = (ogsNumber?: string | null): boolean =>
  !!ogsNumber && OGS_RDO_SIMPLIFICADAS.includes(String(ogsNumber).trim());

/** Valores gravados quando a OGS é simplificada (campos ocultos não carregam dado antigo). */
export const OGS_SIMPLIFICADA_PAYLOAD_RESET = {
  usina_programada: null,
  cauq_programado: null,
  usina_atendeu: null,
  usina_nao_atendeu_motivo: null,
  retrabalho: false,
  retrabalho_oficio: null,
  qtd_caminhoes_basculante: null,
  perc_conclusao_via: null,
  autorizacao_no_horario: null,
  autorizacao_atraso_detalhe: null,
  autorizacao_motivo: null,
  autorizacao_horario_previsto: null,
  autorizacao_horario_real: null,
  sinalizacao_presente: null,
  sinalizacao_nota: null,
  controle_tecnologico_presente: null,
  controle_tecnologico_nota: null,
  sinalizacao_ausente_motivo: null,
  controle_tecnologico_ausente_motivo: null,
  sinalizacao_vertical_nota: null,
};
