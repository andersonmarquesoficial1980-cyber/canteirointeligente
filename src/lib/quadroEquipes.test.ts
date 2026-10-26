import { describe, expect, it } from "vitest";
import { inserirAntes, ordenarPessoas, LARGURA_MAX, LARGURA_MIN, LARGURA_PADRAO, SEM_EQUIPE, chaveColuna, colunasVisiveis, limitarLargura, montarColunas, moverChave, ordenarColunas, prepararMovimento, type PessoaQuadro } from "./quadroEquipes";

const p = (id: string, name: string, equipe: string | null, status: string | null = "ativo", company_id = "c1"): PessoaQuadro =>
  ({ id, name, matricula: id, role: "AJUDANTE GERAL", equipe, status, company_id });

describe("montarColunas", () => {
  it("coloca 'Sem equipe' primeiro, ordena equipes e agrupa variações de caixa/acento", () => {
    const cols = montarColunas(
      [p("1", "Bruno", "CBUQ02"), p("2", "Ana", "cbuq02"), p("3", "Caio", null), p("4", "Dani", "CBUQ01")],
      [],
    );
    expect(cols.map((c) => c.nome)).toEqual(["Sem equipe", "CBUQ01", "CBUQ02"]);
    expect(cols[0].chave).toBe(SEM_EQUIPE);
    expect(cols[2].pessoas.map((x) => x.name)).toEqual(["Ana", "Bruno"]);
  });

  it("mantém equipe do catálogo vazia como destino e esconde demitidos", () => {
    const cols = montarColunas([p("1", "Ana", "CBUQ01"), p("2", "Zé", "CBUQ01", "demitido")], ["CBUQ09"]);
    expect(cols.find((c) => c.nome === "CBUQ09")?.pessoas).toEqual([]);
    expect(cols.find((c) => c.nome === "CBUQ01")?.pessoas.map((x) => x.name)).toEqual(["Ana"]);
  });

  it("busca filtra cards sem remover colunas", () => {
    const cols = montarColunas([p("1", "Ana", "CBUQ01"), p("2", "Bruno", "CBUQ02")], [], "bru");
    expect(cols.map((c) => c.nome)).toEqual(["Sem equipe", "CBUQ01", "CBUQ02"]);
    expect(cols.flatMap((c) => c.pessoas.map((x) => x.name))).toEqual(["Bruno"]);
  });
});

describe("prepararMovimento", () => {
  it("move para equipe e preserva o status atual", () => {
    expect(prepararMovimento(p("1", "Ana", "CBUQ01", "ferias"), "CBUQ02", "c1")).toEqual({ id: "1", equipe: "CBUQ02", status: "ferias" });
  });

  it("destino 'Sem equipe' grava null", () => {
    expect(prepararMovimento(p("1", "Ana", "CBUQ01"), SEM_EQUIPE, "c1").equipe).toBeNull();
  });

  it("recusa empresa diferente, demitido, status fora do padrão e mesma equipe", () => {
    expect(() => prepararMovimento(p("1", "A", "X", "ativo", "c2"), "Y", "c1")).toThrow(/fora da empresa/);
    expect(() => prepararMovimento(p("1", "A", "X", "demitido"), "Y", "c1")).toThrow(/demitido/);
    expect(() => prepararMovimento(p("1", "A", "X", "disposicao"), "Y", "c1")).toThrow(/fora do padrão/);
    expect(() => prepararMovimento(p("1", "A", "X", null), "Y", "c1")).toThrow(/fora do padrão/);
    expect(() => prepararMovimento(p("1", "A", "cbuq01"), "CBUQ01", "c1")).toThrow(/já está/);
    expect(() => prepararMovimento(p("1", "A", "X"), "Y", null)).toThrow(/fora da empresa/);
  });
});

describe("colunasVisiveis", () => {
  it("oculta por chave estável (ignora caixa/acento) e inclui 'Sem equipe'", () => {
    const cols = montarColunas([p("1", "Ana", "Administrativo"), p("2", "Bia", "CBUQ01"), p("3", "Caio", null)], []);
    expect(colunasVisiveis(cols, new Set(["administrativo"])).map((c) => c.nome)).toEqual(["Sem equipe", "CBUQ01"]);
    expect(colunasVisiveis(cols, new Set([SEM_EQUIPE])).map((c) => c.nome)).toEqual(["Administrativo", "CBUQ01"]);
    expect(colunasVisiveis(cols, new Set()).length).toBe(3);
    expect(chaveColuna(cols[1])).toBe("administrativo");
  });
});

describe("ordem e largura das colunas", () => {
  const cols = montarColunas([p("1", "A", "CBUQ01"), p("2", "B", "CBUQ02"), p("3", "C", "Administrativo"), p("4", "D", null)], []);

  it("aplica a ordem salva, manda equipes novas ao fim e ignora chaves que não existem mais", () => {
    const r = ordenarColunas(cols, ["cbuq02", "fantasma", SEM_EQUIPE, "cbuq02"]).map((c) => c.nome);
    expect(r).toEqual(["CBUQ02", "Sem equipe", "Administrativo", "CBUQ01"]);
    expect(ordenarColunas(cols, []).map((c) => c.nome)).toEqual(cols.map((c) => c.nome));
  });

  it("moverChave age como arrayMove e é seguro com chaves inválidas", () => {
    const base = ["a", "b", "c", "d"];
    expect(moverChave(base, "d", "a")).toEqual(["d", "a", "b", "c"]);
    expect(moverChave(base, "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moverChave(base, "a", "a")).toEqual(base);
    expect(moverChave(base, "x", "a")).toEqual(base);
    expect(base).toEqual(["a", "b", "c", "d"]);
  });

  it("limita a largura entre mínimo e máximo e cai no padrão com valor inválido", () => {
    expect(limitarLargura(50)).toBe(LARGURA_MIN);
    expect(limitarLargura(5000)).toBe(LARGURA_MAX);
    expect(limitarLargura(333.4)).toBe(333);
    expect(limitarLargura(NaN)).toBe(LARGURA_PADRAO);
  });
});

describe("ordem dos cards dentro da equipe", () => {
  const r = (id: string, name: string, role: string | null) => ({ id, name, role, matricula: id, equipe: "X", status: "ativo", company_id: "c1" });
  const gente = [r("1", "Zeca", "RASTELEIRO"), r("2", "Ana", "AJUDANTE GERAL"), r("3", "Bia", null), r("4", "Caio", "AJUDANTE GERAL"), r("5", "Davi", "rasteleiro")];

  it("nome: A–Z", () => {
    expect(ordenarPessoas(gente, "nome").map((x) => x.name)).toEqual(["Ana", "Bia", "Caio", "Davi", "Zeca"]);
  });

  it("função: agrupa (ignora caixa), A–Z dentro do grupo e 'sem função' por último", () => {
    expect(ordenarPessoas(gente, "funcao").map((x) => x.name)).toEqual(["Ana", "Caio", "Davi", "Zeca", "Bia"]);
  });

  it("manual: respeita a ordem salva, ignora ids de fora e põe novos ao final em A–Z", () => {
    const r2 = ordenarPessoas(gente, "manual", ["5", "fantasma", "2", "5"]).map((x) => x.id);
    expect(r2).toEqual(["5", "2", "1", "3", "4"].filter((id) => id !== "1" && id !== "3" && id !== "4").concat(["3", "4", "1"]));
    expect(ordenarPessoas(gente, "manual", []).map((x) => x.name)).toEqual(["Ana", "Bia", "Caio", "Davi", "Zeca"]);
  });

  it("não altera o array original", () => {
    const copia = gente.map((x) => x.id);
    ordenarPessoas(gente, "funcao"); ordenarPessoas(gente, "manual", ["5"]);
    expect(gente.map((x) => x.id)).toEqual(copia);
  });

  it("inserirAntes posiciona antes do alvo, vai ao fim se o alvo não existe e não duplica", () => {
    expect(inserirAntes(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(inserirAntes(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
    expect(inserirAntes(["a", "b"], "z", "b")).toEqual(["a", "z", "b"]);
    expect(inserirAntes(["a", "b"], "a", "x")).toEqual(["b", "a"]);
  });
});
