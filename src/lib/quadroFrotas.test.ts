import { describe, expect, it } from "vitest";
import { SEM_EQUIPE, montarColunas } from "./quadroEquipes";
import {
  badgeStatusEquipamento, custoMensalEquipamento, equipamentoParaCard, prepararMovimentoEquipamento,
  statusCanonicoEquipamento, type EquipamentoQuadro,
} from "./quadroFrotas";

const eq = (o: Partial<EquipamentoQuadro> = {}): EquipamentoQuadro =>
  ({ id: "e1", frota: "CB018", placa: "ABC1D23", tipo: "CAMINHÃO CARROCERIA", setor: "CBUQ01", status: "ativo", company_id: "c1", ...o });

describe("status canônico", () => {
  it("aceita os do RPC (ignora caixa/espaço) e 'operando'; rejeita NULL e texto livre", () => {
    expect(statusCanonicoEquipamento("Ativo")).toBe("ativo");
    expect(statusCanonicoEquipamento("Em Manutencao")).toBe("em_manutencao");
    expect(statusCanonicoEquipamento("Operando")).toBe("ativo");
    expect(statusCanonicoEquipamento(null)).toBeNull();
    expect(statusCanonicoEquipamento("Manutenção")).toBeNull();
  });
});

describe("prepararMovimentoEquipamento", () => {
  it("prepara troca de setor mantendo o status canônico", () => {
    expect(prepararMovimentoEquipamento(eq({ status: "Operando" }), "CBUQ02", "c1")).toEqual({ id: "e1", setor: "CBUQ02", status: "ativo", responsavel_destino: null });
    expect(prepararMovimentoEquipamento(eq({ status: "em_manutencao" }), SEM_EQUIPE, "c1")).toMatchObject({ setor: null, status: "em_manutencao" });
  });
  it("recusa outra empresa, devolvido, status fora do padrão e mesma equipe (sem acento/caixa)", () => {
    expect(() => prepararMovimentoEquipamento(eq(), "X", "c2")).toThrow(/empresa/);
    expect(() => prepararMovimentoEquipamento(eq({ status: "devolvido" }), "X", "c1")).toThrow(/devolvido/);
    expect(() => prepararMovimentoEquipamento(eq({ status: null }), "X", "c1")).toThrow(/fora do padrão/);
    expect(() => prepararMovimentoEquipamento(eq({ setor: "Manutenção" }), "MANUTENCAO", "c1")).toThrow(/já está/);
  });
});

describe("adaptação para o quadro", () => {
  it("frota vira título, placa vira matrícula e tipo vira função; setor vazio cai em 'Sem equipe'", () => {
    const cols = montarColunas([equipamentoParaCard(eq()), equipamentoParaCard(eq({ id: "e2", frota: "FA12", setor: null, tipo: "FRESADORA" }))], []);
    expect(cols[0].chave).toBe(SEM_EQUIPE);
    expect(cols[0].pessoas.map((p) => p.name)).toEqual(["FA12"]);
    expect(cols[1].pessoas[0]).toMatchObject({ name: "CB018", matricula: "ABC1D23", role: "CAMINHÃO CARROCERIA" });
  });
  it("busca encontra por frota, placa e tipo", () => {
    const lista = [equipamentoParaCard(eq())];
    for (const q of ["cb018", "abc1d", "carroceria"]) expect(montarColunas(lista, [], q).flatMap((c) => c.pessoas)).toHaveLength(1);
  });
  it("selos e custo: operacional sem selo; só locado soma valor mensal", () => {
    expect(badgeStatusEquipamento("ativo")).toBeNull();
    expect(badgeStatusEquipamento("em_manutencao")?.label).toMatch(/Manutenção/);
    expect(badgeStatusEquipamento(null)?.label).toMatch(/ajustar/);
    expect(custoMensalEquipamento(eq({ condicao: "TERCEIRO", valor_mensal: "12500.5" }))).toBe(12500.5);
    expect(custoMensalEquipamento(eq({ condicao: "PROPRIO", valor_mensal: 9999 }))).toBe(0);
    expect(custoMensalEquipamento(eq({ categoria: "locado", valor_mensal: null }))).toBe(0);
  });
});
