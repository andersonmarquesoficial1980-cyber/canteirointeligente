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
      if (item.equipamentos?.length) corpo.push(`🚜 ${item.equipamentos.join(", ")}`);
    }
    if (item.observacao) corpo.push(`📝 ${item.observacao}`);
    return corpo.join("\n");
  });
  return [`🏗️ *PROGRAMAÇÃO DE OBRAS — ${data}*`, ...linhas, "_Programado no Workflux. Confira atualizações no aplicativo._"].join("\n\n");
}
