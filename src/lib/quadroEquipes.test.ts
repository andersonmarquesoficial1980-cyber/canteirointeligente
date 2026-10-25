import { describe, expect, it } from "vitest";
import { SEM_EQUIPE, chaveColuna, colunasVisiveis, montarColunas, prepararMovimento, type PessoaQuadro } from "./quadroEquipes";

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
