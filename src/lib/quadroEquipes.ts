/** Quadro (Kanban) de equipes da Gestão de Pessoas — lógica pura, sem I/O. */

export const SEM_EQUIPE = "__sem_equipe__";
const STATUS_PERMITIDOS = ["ativo", "afastado", "ferias"] as const;

export type PessoaQuadro = {
  id: string;
  name: string;
  matricula: string | null;
  role: string | null;
  equipe: string | null;
  status?: string | null;
  company_id?: string | null;
};

export type ColunaQuadro<T extends PessoaQuadro = PessoaQuadro> = {
  chave: string; // SEM_EQUIPE ou nome da equipe (como gravado/exibido)
  nome: string;
  pessoas: T[];
};

export const chaveEquipe = (valor?: string | null) =>
  (valor || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const statusBruto = (status?: string | null) =>
  (status || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const estaDemitido = (status?: string | null) => {
  const s = statusBruto(status).replace(/[_\s]/g, "");
  return s === "demitido" || s === "demissao";
};

/**
 * Monta as colunas: "Sem equipe" primeiro, depois equipes em ordem alfabética (pt-BR).
 * Equipes do catálogo sem ninguém entram como colunas vazias (destino válido de arraste).
 * Demitidos não entram no quadro. A busca filtra os cards, nunca as colunas.
 */
export function montarColunas<T extends PessoaQuadro>(
  pessoas: readonly T[],
  catalogo: readonly string[],
  busca = "",
): ColunaQuadro<T>[] {
  const termo = chaveEquipe(busca);
  const mapa = new Map<string, ColunaQuadro<T>>();
  const garantir = (nome: string) => {
    const k = chaveEquipe(nome);
    if (!mapa.has(k)) mapa.set(k, { chave: nome.trim(), nome: nome.trim(), pessoas: [] });
    return mapa.get(k)!;
  };

  const semEquipe: ColunaQuadro<T> = { chave: SEM_EQUIPE, nome: "Sem equipe", pessoas: [] };
  for (const p of pessoas) if (p.equipe?.trim()) garantir(p.equipe);
  for (const nome of catalogo) if (nome?.trim()) garantir(nome);

  for (const p of pessoas) {
    if (estaDemitido(p.status)) continue;
    if (termo) {
      const alvo = [p.name, p.matricula, p.role].map(chaveEquipe).join(" ");
      if (!alvo.includes(termo)) continue;
    }
    (p.equipe?.trim() ? garantir(p.equipe) : semEquipe).pessoas.push(p);
  }

  const ordenar = (a: T, b: T) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  const colunas = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  [semEquipe, ...colunas].forEach((c) => c.pessoas.sort(ordenar));
  return [semEquipe, ...colunas];
}

export type MovimentoPessoa = { id: string; equipe: string | null; status: string };

/**
 * Valida e prepara o item enviado ao RPC `programador_aplicar_lote`.
 * O RPC grava também o status; por isso o status atual só segue adiante se já for
 * um valor canônico — nunca "normalizamos" um status estranho (ex.: 'disposicao') por baixo dos panos.
 */
export function prepararMovimento(
  pessoa: PessoaQuadro,
  destino: string,
  companyId: string | null,
): MovimentoPessoa {
  if (!companyId || pessoa.company_id !== companyId) throw new Error("Funcionário fora da empresa atual");
  if (estaDemitido(pessoa.status)) throw new Error("Funcionário demitido não pode ser movido de equipe");
  const status = statusBruto(pessoa.status);
  if (!(STATUS_PERMITIDOS as readonly string[]).includes(status)) {
    throw new Error("Status do funcionário fora do padrão; ajuste o status na ficha antes de mover");
  }
  const equipe = destino === SEM_EQUIPE ? null : destino.trim() || null;
  if (chaveEquipe(equipe) === chaveEquipe(pessoa.equipe)) throw new Error("O funcionário já está nesta equipe");
  return { id: pessoa.id, equipe, status };
}

export const rotuloEquipe = (equipe: string | null | undefined) => (equipe?.trim() ? equipe.trim() : "Sem equipe");

/** Identificador estável de uma coluna para preferências (ignora caixa/acento do nome). */
export const chaveColuna = (c: { chave: string; nome: string }) => (c.chave === SEM_EQUIPE ? SEM_EQUIPE : chaveEquipe(c.nome));

export const colunasVisiveis = <T extends { chave: string; nome: string }>(colunas: readonly T[], ocultas: ReadonlySet<string>) =>
  colunas.filter((c) => !ocultas.has(chaveColuna(c)));

export const LARGURA_PADRAO = 270;
export const LARGURA_MIN = 200;
export const LARGURA_MAX = 640;

export const limitarLargura = (px: number) =>
  Number.isFinite(px) ? Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, Math.round(px))) : LARGURA_PADRAO;

/** Colunas na ordem salva; o que não está salvo (equipe nova) vai ao final, na ordem original. Chaves salvas inexistentes são ignoradas. */
export function ordenarColunas<T extends { chave: string; nome: string }>(colunas: readonly T[], ordem: readonly string[]): T[] {
  const porChave = new Map(colunas.map((c) => [chaveColuna(c), c]));
  const usadas = new Set<string>();
  const salvas: T[] = [];
  for (const k of ordem) {
    const c = porChave.get(k);
    if (c && !usadas.has(k)) { salvas.push(c); usadas.add(k); }
  }
  return [...salvas, ...colunas.filter((c) => !usadas.has(chaveColuna(c)))];
}

/** Move `de` para a posição de `para` (como arrayMove). Chave desconhecida ou igual: nada muda. */
export function moverChave(chaves: readonly string[], de: string, para: string): string[] {
  const i = chaves.indexOf(de);
  const j = chaves.indexOf(para);
  if (i < 0 || j < 0 || i === j) return [...chaves];
  const proximo = [...chaves];
  proximo.splice(i, 1);
  proximo.splice(j, 0, de);
  return proximo;
}

export type ModoCards = "nome" | "funcao" | "manual";
export const SEM_FUNCAO = "SEM FUNÇÃO";

export const funcaoDe = (p: { role?: string | null }) => (p.role?.trim() ? p.role.trim().toUpperCase() : SEM_FUNCAO);

const porNome = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

/**
 * nome: A–Z. funcao: agrupa por função (A–Z, "SEM FUNÇÃO" por último) e dentro dela por nome.
 * manual: ids salvos primeiro, na ordem salva; quem não está salvo (pessoa nova na equipe) vem depois, A–Z.
 * Ids salvos que não pertencem mais à coluna são ignorados.
 */
export function ordenarPessoas<T extends { id: string; name: string; role?: string | null }>(
  pessoas: readonly T[], modo: ModoCards, ordemSalva: readonly string[] = [],
): T[] {
  if (modo === "manual") {
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    const vistos = new Set<string>();
    const salvos: T[] = [];
    for (const id of ordemSalva) {
      const p = porId.get(id);
      if (p && !vistos.has(id)) { salvos.push(p); vistos.add(id); }
    }
    return [...salvos, ...pessoas.filter((p) => !vistos.has(p.id)).sort(porNome)];
  }
  if (modo === "funcao") {
    return [...pessoas].sort((a, b) => {
      const fa = funcaoDe(a), fb = funcaoDe(b);
      if (fa !== fb) {
        if (fa === SEM_FUNCAO) return 1;
        if (fb === SEM_FUNCAO) return -1;
        return fa.localeCompare(fb, "pt-BR", { sensitivity: "base" });
      }
      return porNome(a, b);
    });
  }
  return [...pessoas].sort(porNome);
}

/** Tira `id` da lista e o coloca imediatamente antes de `antesDe` (ou no fim, se antesDe não existir). */
export function inserirAntes(ids: readonly string[], id: string, antesDe: string): string[] {
  const resto = ids.filter((x) => x !== id);
  const i = resto.indexOf(antesDe);
  if (i < 0) return [...resto, id];
  resto.splice(i, 0, id);
  return resto;
}
