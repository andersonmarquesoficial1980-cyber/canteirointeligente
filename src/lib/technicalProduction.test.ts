import { describe, expect, it } from "vitest";
import { getTechnicalProductionError } from "./technicalProduction";
const base = { houve_producao: true, tipos_servico: ["APLICAÇÃO DE FX II - BINDER"], infra_descricao: "", binder_ton: "" };

describe("Validação de produção no envio técnico", () => {
  it.each(["", " ", "0", "-1", "NaN", "Infinity", "1,2,3"])("rejeita medição inválida de Binder: %s", binder_ton => {
    expect(getTechnicalProductionError({ ...base, binder_ton }, "enviado")).toBe("Informe Binder (ton) com valor maior que zero");
  });
  it.each(["0.01", "96,72", "96.72"])("aceita medição positiva %s", binder_ton => {
    expect(getTechnicalProductionError({ ...base, binder_ton }, "enviado")).toBeNull();
  });
  it("não usa CAUQ programado ou outra medição para preencher Binder faltante", () => {
    expect(getTechnicalProductionError({ ...base, cauq_programado: "100", fresagem_m2: "300" }, "enviado")).toContain("Binder (ton)");
  });
  it("exige todas as medições selecionadas, inclusive quando INFRA também está preenchida", () => {
    expect(getTechnicalProductionError({ ...base, tipos_servico: ["INFRA", "FRESAGEM", ...base.tipos_servico], infra_descricao: "Drenagem", fresagem_m2: "10" }, "enviado")).toContain("Binder (ton)");
  });
  it.each([
    ["FRESAGEM", "fresagem_m2"], ["APLICAÇÃO DE RAP ESPUMADO", "rap_espumado_m2"],
    ["APLICAÇÃO DE FX II - BINDER", "binder_ton"], ["APLICAÇÃO DE FX III", "cbuq_fx3_ton"],
    ["APLICAÇÃO DE GAP GRADED", "gap_ton"], ["APLICAÇÃO DE BGS", "bgs_ton"],
    ["APLICAÇÃO DE SMA", "sma_ton"], ["APLICAÇÃO DE BGTC", "bgtc_m3"],
    ["APLICAÇÃO DE MACADAME", "macadame_m3"], ["APLICAÇÃO DE CAUQ-HIMA", "cauq_rima_ton"],
    ["APLICAÇÃO DE FX C", "fx_c_ton"], ["DEMOLIÇÃO", "demolicao_m"], ["NIVELAMENTO DE PV", "nivelamento_pv_un"],
    ["APLICAÇÃO DE BN25", "bm25_ton"], ["GEOGRELHA", "geogrelha_m2"],
    ["APLICAÇÃO DE EGL", "egl_ton"], ["APLICAÇÃO DE RACHÃO", "rachao_ton"],
  ])("valida a unidade e o campo específico de %s", (service, field) => {
    const form = { ...base, tipos_servico: [service] };
    expect(getTechnicalProductionError(form, "enviado")).not.toBeNull();
    expect(getTechnicalProductionError({ ...form, [field]: "2.5" }, "enviado")).toBeNull();
  });
  it("não obriga tonelagem para INFRA descritiva ou serviço sem medição definida", () => {
    expect(getTechnicalProductionError({ ...base, tipos_servico: ["ENSAIOS E EXTRAÇÕES"] }, "enviado")).toBeNull();
    expect(getTechnicalProductionError({ ...base, tipos_servico: ["INFRA"], infra_descricao: "Drenagem" }, "enviado")).toBeNull();
  });
  it("preserva rascunho incompleto e não aplica medição a dia sem produção", () => {
    expect(getTechnicalProductionError({ ...base, tipos_servico: [] }, "rascunho")).toBeNull();
    expect(getTechnicalProductionError({ ...base, tipos_servico: ["INFRA"] }, "rascunho")).toBeNull();
    expect(getTechnicalProductionError({ ...base, houve_producao: false }, "enviado")).toBeNull();
  });
});
