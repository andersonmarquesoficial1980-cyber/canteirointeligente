import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  agregarPorEquipamento, corDisponibilidade, fmtHoras, fmtPct, normalizarLinha, produzirXDisponibilidade, somarLinhas,
  type IndicadorLinha,
} from "./equipConfiabilidade";
import type { LinhaProducao } from "./equipProducao";

const L = (o: Partial<IndicadorLinha> = {}): IndicadorLinha => ({
  equipamento_id: "e1", frota: "FA01", ogs_number: "1001", dias_programados: 1, tempo_programado_h: 6, tempo_parado_h: 0,
  disponibilidade_pct: 100, qtd_falhas: 0, tempo_operacao_h: 6, mtbf_h: null, qtd_reparadas: 0, tempo_reparo_h: 0, mttr_h: null,
  falhas_em_aberto: 0, falhas_sem_reparo: 0, dias_sem_horario: 0, dias_sem_operacao: 0, dias_excluidos_rdo: 0, ...o,
});

describe("somarLinhas", () => {
  it("exemplo da solicitação: 6h programadas, 2h de quebra = 66,67%", () => {
    const r = somarLinhas([L({ tempo_parado_h: 2, tempo_operacao_h: 4, qtd_falhas: 1, qtd_reparadas: 1, tempo_reparo_h: 1.5 })]);
    expect(r.disponibilidade).toBe(66.67);
    expect(r.mtbf).toBe(4);
    expect(r.mttr).toBe(1.5);
    expect(r.paradoH).toBe(2);
  });
  it("sem falhas: disponibilidade 100%, MTBF e MTTR nulos (sem divisão por zero)", () => {
    const r = somarLinhas([L()]);
    expect(r.disponibilidade).toBe(100);
    expect(r.mtbf).toBeNull();
    expect(r.mttr).toBeNull();
  });
  it("sem tempo programado: disponibilidade nula, nunca 0% nem NaN", () => {
    const r = somarLinhas([L({ tempo_programado_h: 0, tempo_operacao_h: 0, dias_programados: 0, disponibilidade_pct: null, dias_sem_horario: 3 })]);
    expect(r.disponibilidade).toBeNull();
    expect(r.diasSemHorario).toBe(3);
  });
  it("ponderado pelas horas, não média das médias", () => {
    // 10h a 100% + 2h a 50% => 11/12 = 91,67% (média simples daria 75%)
    const r = somarLinhas([
      L({ tempo_programado_h: 10, tempo_operacao_h: 10 }),
      L({ equipamento_id: "e2", tempo_programado_h: 2, tempo_parado_h: 1, tempo_operacao_h: 1, qtd_falhas: 1 }),
    ]);
    expect(r.disponibilidade).toBe(91.67);
    expect(r.mtbf).toBe(11); // 11h de operação / 1 falha
  });
  it("MTTR só considera falhas reparadas com tempo de reparo", () => {
    const r = somarLinhas([L({ qtd_falhas: 3, qtd_reparadas: 2, tempo_reparo_h: 3, tempo_operacao_h: 3, tempo_parado_h: 3 })]);
    expect(r.mttr).toBe(1.5);
    expect(r.mtbf).toBe(1);
  });
  it("lista vazia → tudo nulo/zero", () => {
    const r = somarLinhas([]);
    expect(r).toMatchObject({ disponibilidade: null, mtbf: null, mttr: null, falhas: 0, paradoH: 0 });
  });
});

describe("agregarPorEquipamento", () => {
  it("une as obras do mesmo equipamento e ordena por frota", () => {
    const r = agregarPorEquipamento([
      L({ equipamento_id: "e2", frota: "FA10" }),
      L({ ogs_number: "1001", tempo_programado_h: 6, tempo_parado_h: 2, tempo_operacao_h: 4, qtd_falhas: 1 }),
      L({ ogs_number: "2002", tempo_programado_h: 6, tempo_operacao_h: 6 }),
    ]);
    expect(r.map(x => x.frota)).toEqual(["FA01", "FA10"]);
    expect(r[0].obras).toEqual(["1001", "2002"]);
    expect(r[0].disponibilidade).toBe(83.33); // 10h / 12h
    expect(r[0].falhas).toBe(1);
  });
});

describe("produzirXDisponibilidade", () => {
  const P = (o: Partial<LinhaProducao>): LinhaProducao => ({
    equipamento_id: "e1", frota: "VB01", ogs_number: "1001", data: "2026-10-05", turno: "noturno", tipo: "vibroacabadora",
    valor: null, unidade: "t", fonte: "apontamento", lancado: false, apontamento_id: null, ...o,
  });
  it("soma só o lançado, conta pendentes e cruza com a disponibilidade", () => {
    const eqs = agregarPorEquipamento([L({ equipamento_id: "e1", frota: "VB01", tempo_programado_h: 10, tempo_parado_h: 2, tempo_operacao_h: 8, qtd_falhas: 1 })]);
    const r = produzirXDisponibilidade(eqs, [P({ valor: 120.5, lancado: true }), P({ valor: 80, lancado: true, data: "2026-10-06" }), P({ data: "2026-10-07" })]);
    expect(r).toEqual([{ equipamentoId: "e1", frota: "VB01", tipo: "vibroacabadora", unidade: "t", producao: 200.5, disponibilidade: 80, diasLancados: 2, diasPendentes: 1 }]);
  });
  it("equipamento com produção mas sem disponibilidade calculada fica com disponibilidade nula", () => {
    const r = produzirXDisponibilidade([], [P({ valor: 10, lancado: true })]);
    expect(r[0].disponibilidade).toBeNull();
  });
});

describe("formatação e faixas", () => {
  it("fmtPct / fmtHoras mostram texto claro quando não há dado", () => {
    expect(fmtPct(66.67)).toBe("66,67%");
    expect(fmtPct(0)).toBe("0,00%");
    expect(fmtPct(null)).toBe("Sem horário");
    expect(fmtHoras(1.5)).toBe("1,50 h");
    expect(fmtHoras(0)).toBe("0,00 h");
    expect(fmtHoras(null)).toBe("Sem dados");
  });
  it("faixas de cor", () => {
    expect(corDisponibilidade(null)).toBe("neutro");
    expect(corDisponibilidade(95)).toBe("verde");
    expect(corDisponibilidade(80)).toBe("amarelo");
    expect(corDisponibilidade(50)).toBe("vermelho");
  });
  it("normalizarLinha converte numeric em texto e preserva nulos", () => {
    const n = normalizarLinha({ equipamento_id: "e", frota: "F", ogs_number: "1", tempo_programado_h: "6.00", disponibilidade_pct: "66.67", mtbf_h: null, qtd_falhas: 1 });
    expect(n.tempo_programado_h).toBe(6);
    expect(n.disponibilidade_pct).toBe(66.67);
    expect(n.mtbf_h).toBeNull();
    expect(n.tempo_reparo_h).toBe(0);
  });
});
