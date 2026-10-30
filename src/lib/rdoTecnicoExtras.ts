/** Campos de apoio/qualidade, retrabalho e caminhões do RDO Técnico (valores de formulário em string). */
export interface TechnicalExtrasForm {
  houve_producao: boolean;
  retrabalho: boolean;
  retrabalho_oficio: string;
  autorizacao_no_horario: "" | "sim" | "nao";
  autorizacao_atraso_detalhe: string;
  sinalizacao_presente: "" | "sim" | "nao";
  sinalizacao_nota: number;
  controle_tecnologico_presente: "" | "sim" | "nao";
  sinalizacao_vertical_nota: number;
  controle_tecnologico_nota: number;
}

export const TECHNICAL_EXTRAS_DEFAULTS = {
  retrabalho: false,
  retrabalho_oficio: "",
  qtd_caminhoes_basculante: "",
  autorizacao_no_horario: "" as "" | "sim" | "nao",
  autorizacao_atraso_detalhe: "",
  sinalizacao_presente: "" as "" | "sim" | "nao",
  sinalizacao_nota: 0,
  controle_tecnologico_presente: "" as "" | "sim" | "nao",
  sinalizacao_vertical_nota: 0,
  controle_tecnologico_nota: 0,
};

export const simNaoToBool = (v: string): boolean | null => (v === "sim" ? true : v === "nao" ? false : null);
export const boolToSimNao = (v: boolean | null | undefined): "" | "sim" | "nao" => (v == null ? "" : v ? "sim" : "nao");

/** Exigências só no envio de dia produtivo; rascunho nunca é bloqueado. */
export function getTechnicalExtrasError(form: TechnicalExtrasForm, status: "enviado" | "rascunho"): string | null {
  if (status !== "enviado" || !form.houve_producao) return null;
  if (form.retrabalho && !form.retrabalho_oficio.trim()) return "Preencha a Obs Retrabalho";
  if (form.autorizacao_no_horario === "") return "Informe se a autorização para iniciar ocorreu no horário previsto";
  if (form.autorizacao_no_horario === "nao" && !form.autorizacao_atraso_detalhe.trim()) return "Descreva os detalhes do atraso na autorização";
  if (form.sinalizacao_presente === "") return "Informe se a equipe de sinalização estava presente no horário";
  if (form.sinalizacao_presente === "sim" && !form.sinalizacao_nota) return "Avalie a equipe de sinalização (1 a 5)";
  if (form.controle_tecnologico_presente === "") return "Informe se o controle tecnológico esteve presente no horário";
  if (form.controle_tecnologico_presente === "sim" && !form.controle_tecnologico_nota) return "Avalie a equipe de controle tecnológico (1 a 5)";
  if (!form.sinalizacao_vertical_nota) return "Avalie a sinalização vertical (1 a 5)";
  return null;
}

export const toIntOrNull = (v: string): number | null => {
  const n = Number(String(v).trim().replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, Math.trunc(n));
};
