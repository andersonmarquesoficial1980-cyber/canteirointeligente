export type DestinoEquipe = {
  equipe: string;
  situacao: "TRABALHO" | "FOLGA" | "CANCELADO";
  motivo_cancelamento?: string;
  local: string;
  ogs: string;
  cliente: string;
  periodo: string;
  observacao: string;
  equipamentos?: string[];
  encarregado_id?: string;
  encarregado_nome?: string;
  engenheiro_id?: string;
  engenheiro_nome?: string;
};

export type Comunicado = {
  id: string;
  data: string;
  created_at: string;
  itens: DestinoEquipe[];
  revisao?: number;
};

export function intervaloMes(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split("-").map(Number);
  if (!ano || numero < 1 || numero > 12) throw new Error("Mês inválido");
  const ultimo = new Date(ano, numero, 0).getDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

export function sortOgsDecrescente<T extends { ogs_number: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.ogs_number) - Number(a.ogs_number)
    || b.ogs_number.localeCompare(a.ogs_number, "pt-BR", { numeric: true }));
}

export function rotuloSituacao(situacao: string | null): string {
  if (situacao === "CANCELADO") return "Cancelado";
  if (situacao === "FOLGA") return "Folga programada";
  return "Trabalho programado";
}

export function validarComunicado(itens: DestinoEquipe[]): string | null {
  if (!itens.length) return "Inclua pelo menos uma equipe.";
  const nomes = new Set<string>();
  for (const item of itens) {
    const nome = item.equipe.trim().toLocaleUpperCase("pt-BR");
    if (!nome || nomes.has(nome)) return "Selecione equipes diferentes no mesmo comunicado.";
    nomes.add(nome);
    if (item.situacao === "TRABALHO" && !item.local.trim()) return `Informe onde ${item.equipe} irá trabalhar.`;
    if (item.situacao === "CANCELADO" && !item.motivo_cancelamento?.trim()) return `Informe o motivo do cancelamento de ${item.equipe}.`;
  }
  return null;
}

export function textoComunicado(comunicado: Comunicado): string {
  const data = comunicado.data.split("-").reverse().join("/");
  const linhas = comunicado.itens.map((item, index) => {
    const corpo = [`*${index + 1}. ${item.equipe}* — ${item.situacao === "FOLGA" ? "FOLGA" : item.situacao === "CANCELADO" ? "CANCELADO" : "TRABALHA"}`];
    if (item.situacao === "CANCELADO") corpo.push(`🚫 Motivo: ${item.motivo_cancelamento}`);
    if (item.situacao === "TRABALHO") {
      corpo.push(`📍 ${item.local}`);
      if (item.periodo) corpo.push(`🕒 ${item.periodo}`);
      if (item.ogs) corpo.push(`📋 OGS ${item.ogs}${item.cliente ? ` — ${item.cliente}` : ""}`);
      if (item.encarregado_nome) corpo.push(`🦺 Encarregado: ${item.encarregado_nome}`);
      if (item.engenheiro_nome) corpo.push(`👷 Engenheiro: ${item.engenheiro_nome}`);
    }
    if (item.observacao) corpo.push(`📝 ${item.observacao}`);
    return corpo.join("\n");
  });
  return [
    "🏗️ *PROGRAMAÇÃO DE OBRAS*",
    ...(comunicado.revisao && comunicado.revisao > 1 ? [`⚠️ *ATUALIZAÇÃO — revisão ${comunicado.revisao} (substitui a anterior)*`] : []),
    `📅 *Data: ${data}*\n👷 *Equipes programadas: ${comunicado.itens.length}*`,
    "━━━━━━━━━━━━━━━━",
    ...linhas,
    "━━━━━━━━━━━━━━━━\n_Programado no Workflux. Confira atualizações no aplicativo._",
  ].join("\n\n");
}

export function urlWhatsAppComunicado(comunicado: Comunicado): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(textoComunicado(comunicado))}`;
}

export function diferencasRevisao(antes: DestinoEquipe[], depois: DestinoEquipe[]): string[] {
  const anterior = new Map(antes.map(item => [item.equipe, item]));
  const campos: Array<[keyof DestinoEquipe, string]> = [
    ["situacao", "Situação"], ["ogs", "OGS"], ["cliente", "Cliente"],
    ["local", "Local"], ["periodo", "Período"],
    ["encarregado_nome", "Encarregado"], ["engenheiro_nome", "Engenheiro"],
    ["motivo_cancelamento", "Motivo"], ["observacao", "Orientação"],
  ];
  const rotular = (key: keyof DestinoEquipe, value: unknown) => key === "situacao"
    ? ({ TRABALHO: "Vai trabalhar", FOLGA: "Folga", CANCELADO: "Cancelado" }[String(value)] || "—")
    : String(value || "—");
  return depois.flatMap(item => {
    const old = anterior.get(item.equipe);
    if (!old) return [`${item.equipe} · Equipe incluída`];
    return campos.flatMap(([key, label]) => {
      const from = rotular(key, old[key]);
      const to = rotular(key, item[key]);
      return from === to ? [] : [`${item.equipe} · ${label}: ${from} → ${to}`];
    });
  });
}
