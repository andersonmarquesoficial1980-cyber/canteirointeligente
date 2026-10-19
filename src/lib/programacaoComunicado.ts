export type DestinoEquipe = {
  equipe: string;
  situacao: "TRABALHO" | "FOLGA";
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

export function validarComunicado(itens: DestinoEquipe[]): string | null {
  if (!itens.length) return "Inclua pelo menos uma equipe.";
  const nomes = new Set<string>();
  for (const item of itens) {
    const nome = item.equipe.trim().toLocaleUpperCase("pt-BR");
    if (!nome || nomes.has(nome)) return "Selecione equipes diferentes no mesmo comunicado.";
    nomes.add(nome);
    if (item.situacao === "TRABALHO" && !item.local.trim()) return `Informe onde ${item.equipe} irá trabalhar.`;
  }
  return null;
}

export function textoComunicado(comunicado: Comunicado): string {
  const data = comunicado.data.split("-").reverse().join("/");
  const linhas = comunicado.itens.map((item, index) => {
    const corpo = [`*${index + 1}. ${item.equipe}* — ${item.situacao === "FOLGA" ? "FOLGA" : "TRABALHA"}`];
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
    `📅 *Data: ${data}*\n👷 *Equipes programadas: ${comunicado.itens.length}*`,
    "━━━━━━━━━━━━━━━━",
    ...linhas,
    "━━━━━━━━━━━━━━━━\n_Programado no Workflux. Confira atualizações no aplicativo._",
  ].join("\n\n");
}

export function urlWhatsAppComunicado(comunicado: Comunicado): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(textoComunicado(comunicado))}`;
}
