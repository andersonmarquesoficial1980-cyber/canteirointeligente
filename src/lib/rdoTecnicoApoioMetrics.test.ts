import { describe, expect, it } from "vitest";
import { computeApoioMetrics, type ApoioRow } from "./rdoTecnicoApoioMetrics";

const r = (p: Partial<ApoioRow>): ApoioRow => ({ houve_producao: true, ogs_number: "1", ...p });

describe("computeApoioMetrics", () => {
  it("ignora dias sem produção e valores não respondidos", () => {
    const m = computeApoioMetrics([
      r({ autorizacao_no_horario: true, sinalizacao_presente: true, sinalizacao_nota: 5, controle_tecnologico_presente: true, sinalizacao_vertical_nota: 4, qtd_caminhoes_basculante: 6 }),
      r({ autorizacao_no_horario: false, sinalizacao_presente: false, controle_tecnologico_presente: false, sinalizacao_vertical_nota: 2, qtd_caminhoes_basculante: 4, retrabalho: true, retrabalho_oficio: "12/2026" }),
      r({}),
      { houve_producao: false, autorizacao_no_horario: false, sinalizacao_nota: 1, qtd_caminhoes_basculante: 99, retrabalho: true },
    ]);
    expect(m.diasComProducao).toBe(3);
    expect(m.autorizacao).toEqual({ sim: 1, nao: 1, avaliados: 2, pct: 50 });
    expect(m.sinalizacaoPresente.pct).toBe(50);
    expect(m.controleTecnologico.avaliados).toBe(2);
    expect(m.notaSinalizacao.media).toBe(5);
    expect(m.notaVertical.media).toBe(3);
    expect(m.notaVertical.distribuicao.map(d => d.value)).toEqual([0, 1, 0, 1, 0]);
    expect(m.caminhoes).toEqual({ total: 10, registros: 2, mediaDia: 5 });
    expect(m.retrabalho).toEqual({ total: 1, semOficio: 0 });
  });
  it("sem dados devolve null, não zero enganoso", () => {
    const m = computeApoioMetrics([]);
    expect(m.autorizacao.pct).toBeNull();
    expect(m.notaSinalizacao.media).toBeNull();
    expect(m.caminhoes.mediaDia).toBeNull();
  });
  it("agrupa nota média por OGS", () => {
    const m = computeApoioMetrics([r({ ogs_number: "20", sinalizacao_nota: 4 }), r({ ogs_number: "20", sinalizacao_nota: 2 }), r({ ogs_number: "3", sinalizacao_vertical_nota: 5 })]);
    expect(m.notaPorOgs).toEqual([{ name: "3", sinalizacao: null, vertical: 5 }, { name: "20", sinalizacao: 3, vertical: null }]);
  });
  it("conta retrabalho sem ofício", () => {
    expect(computeApoioMetrics([r({ retrabalho: true, retrabalho_oficio: " " })]).retrabalho).toEqual({ total: 1, semOficio: 1 });
  });
});
