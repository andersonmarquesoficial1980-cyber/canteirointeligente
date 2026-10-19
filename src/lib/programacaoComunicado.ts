export type DestinoEquipe = {
  equipe: string;
  situacao: "TRABALHO" | "FOLGA";
  local: string;
  ogs: string;
  cliente: string;
  periodo: string;
  observacao: string;
  equipamentos?: string[];
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
