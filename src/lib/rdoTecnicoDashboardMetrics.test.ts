import { describe, expect, it } from "vitest";
import { climaSplit, equipesVisiveisFiltro, perdasPorMotivo, producaoPorServico, resumoPorOgs, secaoDaObra, somaCampo } from "./rdoTecnicoDashboardMetrics";

const p = (x: object) => ({ houve_producao: true, ogs_number: "1", ...x });
const s = (motivo: string, x: object = {}) => ({ houve_producao: false, ogs_number: "1", motivo_sem_producao: motivo, ...x });

describe("Métricas extras do Dashboard", () => {
  it("separa perda por causa externa de folga/sem atividade", () => {
    const m = perdasPorMotivo([s("Chuva"), s("Chuva"), s("Falha de Combustível"), s("Folga / Feriado"), s("Sem Atividade"), p({})]);
    expect(m.diasPerdidos).toBe(3);
    expect(m.diasNaoPerda).toBe(2);
    expect(m.porMotivo[0]).toEqual({ name: "Chuva", value: 2, perda: true });
    expect(m.porOgs).toEqual([{ name: "1", value: 3 }]);
  });
  it("totaliza produção por serviço na própria unidade e ignora dia parado", () => {
    const r = producaoPorServico([p({ massa_fria_sacos: 10 }), p({ massa_fria_sacos: 5, demolicao_m: 30 }), s("Chuva", { massa_fria_sacos: 99 }), p({ binder_ton: 0 })]);
    expect(r.find(x => x.field === "massa_fria_sacos")).toMatchObject({ servico: "Massa Fria", unidade: "sacos", total: 15, rdos: 2 });
    expect(r.find(x => x.field === "demolicao_m")).toMatchObject({ unidade: "m", total: 30 });
    expect(r.find(x => x.field === "binder_ton")).toBeUndefined();
  });
  it("soma campo", () => expect(somaCampo([p({ a: 2 }), p({ a: null }), p({ a: 3 })], "a")).toBe(5));
  it("conta seção da obra só em dia produtivo", () => {
    expect(secaoDaObra([p({ tipo_secao: "Funcional, Estrutural" }), p({ tipo_secao: "Funcional" }), s("Chuva", { tipo_secao: "Estrutural" }), p({})]))
      .toMatchObject({ comSecao: 2, itens: [{ name: "Funcional", value: 2 }, { name: "Intermediário", value: 0 }, { name: "Estrutural", value: 1 }] });
  });
  it("seção da obra ignora OGS que não são PMSP (dados antigos)", () => {
    const r = secaoDaObra([p({ ogs_number: "2539", tipo_secao: "Funcional" }), p({ ogs_number: "2547", tipo_secao: "Estrutural" })], new Set(["2547"]));
    expect(r).toMatchObject({ comSecao: 1, ogs: ["2547"] });
    expect(secaoDaObra([p({ ogs_number: "2539", tipo_secao: "Funcional" })], new Set()).comSecao).toBe(0);
  });
  it("resume retrabalho %, caminhões e última conclusão por OGS", () => {
    const r = resumoPorOgs([p({ ogs_number: "7", retrabalho: true, retrabalho_oficio: "ofício 1", qtd_caminhoes_basculante: 4, perc_conclusao_via: 30, data: "2026-10-01" }),
      p({ ogs_number: "7", qtd_caminhoes_basculante: 2, perc_conclusao_via: 60, data: "2026-10-05" }), p({ ogs_number: "8" })]);
    expect(r[0]).toMatchObject({ ogs: "7", rdos: 2, retrabalhos: 1, pctRetrabalho: 50, caminhoes: 6, conclusao: 60, obs: ["ofício 1"] });
    expect(r[1]).toMatchObject({ ogs: "8", retrabalhos: 0, conclusao: null });
  });
  it("separa chuva que parou a obra da chuva em dia produtivo", () => {
    expect(climaSplit([s("Chuva", { choveu: true }), p({ choveu: true, intensidade_chuva: "Forte" }), p({ choveu: true }), p({})]))
      .toEqual({ pararam: 1, comProducao: 2, semIntensidadeComProducao: 1 });
  });
  it("esconde equipes desmarcadas, mas mantém as com histórico", () => {
    expect(equipesVisiveisFiltro([{ nome: "A", exibir: true }, { nome: "B", exibir: false }, { nome: "C", exibir: false }, { nome: "D" }], ["C"])).toEqual(["A", "C", "D"]);
  });
});
