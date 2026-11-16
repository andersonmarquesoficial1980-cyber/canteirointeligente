import { describe, expect, it } from "vitest";
import { candidatosParaVaga, equipesComVagaAberta, resumoVagas, vagasAbertasPorEquipe, type Vaga } from "./vagasContratacao";

const v = (o: Partial<Vaga>): Vaga => ({
  id: Math.random().toString(), company_id: "c", equipe: "CBUQ03 - GIVANILDO", funcao_id: null, funcao: "AJUDANTE GERAL", observacao: null,
  prioridade: "normal", motivo: "aumento_efetivo", data_prevista: null, status: "aberta", employee_id: null, motivo_cancelamento: null,
  fechada_em: null, created_at: "2026-11-16T10:00:00Z", ...o,
});

describe("vagasContratacao", () => {
  it("agrupa só abertas e em seleção, ignorando acento e caixa da equipe", () => {
    const mapa = vagasAbertasPorEquipe([
      v({ equipe: "SINALIZAÇÃO/EXTRAÇÃO 01" }), v({ equipe: "sinalizacao/extracao 01", status: "em_selecao" }),
      v({ equipe: "SINALIZAÇÃO/EXTRAÇÃO 01", status: "contratada" }), v({ status: "cancelada" }),
    ]);
    expect(mapa.get("sinalizacao/extracao 01")).toHaveLength(2);
    expect(mapa.has("cbuq03 - givanildo")).toBe(false);
  });
  it("ordena urgente antes de normal", () => {
    const l = vagasAbertasPorEquipe([v({ id: "a" }), v({ id: "b", prioridade: "urgente", created_at: "2026-11-17T00:00:00Z" })]).get("cbuq03 - givanildo")!;
    expect(l.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("equipes com vaga aberta criam coluna mesmo sem funcionário", () => {
    expect(equipesComVagaAberta([v({ equipe: "SINALIZAÇÃO/EXTRAÇÃO 02" }), v({ equipe: "SINALIZAÇÃO/EXTRAÇÃO 02" }), v({ status: "cancelada", equipe: "X" })]))
      .toEqual(["SINALIZAÇÃO/EXTRAÇÃO 02"]);
  });
  it("resumo soma por equipe e função", () => {
    const r = resumoVagas([v({}), v({}), v({ funcao: "RASTELEIRO" }), v({ status: "contratada" })]);
    expect(r.total).toBe(3);
    expect(r.linhas).toEqual([
      { equipe: "CBUQ03 - GIVANILDO", funcao: "AJUDANTE GERAL", total: 2 },
      { equipe: "CBUQ03 - GIVANILDO", funcao: "RASTELEIRO", total: 1 },
    ]);
  });
  it("candidatos: exclui demitido, mesma função e sem equipe primeiro", () => {
    const p = (id: string, name: string, role: string, equipe: string | null, status = "ativo") => ({ id, name, role, equipe, status });
    const r = candidatosParaVaga([
      p("1", "ZE", "MOTORISTA", "CBUQ01"), p("2", "ANA", "AJUDANTE GERAL", "CBUQ01"), p("3", "BIA", "AJUDANTE GERAL", null),
      p("4", "CARLOS", "AJUDANTE GERAL", "CBUQ03 - GIVANILDO"), p("5", "DEMI", "AJUDANTE GERAL", null, "demitido"),
    ], { funcao: "AJUDANTE GERAL", equipe: "CBUQ03 - GIVANILDO" });
    expect(r.map((x) => x.id)).toEqual(["3", "4", "2", "1"]);
  });
});
