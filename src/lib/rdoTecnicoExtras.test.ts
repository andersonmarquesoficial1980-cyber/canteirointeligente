import { describe, expect, it } from "vitest";
import { atrasoMinutos, getTechnicalExtrasError, responsavelLiberacao, toIntOrNull, type TechnicalExtrasForm } from "./rdoTecnicoExtras";

const ok: TechnicalExtrasForm = { houve_producao: true, retrabalho: false, retrabalho_oficio: "", autorizacao_no_horario: "sim", autorizacao_atraso_detalhe: "", autorizacao_motivo: "", autorizacao_horario_previsto: "", autorizacao_horario_real: "",
  sinalizacao_presente: "sim", sinalizacao_nota: 3, controle_tecnologico_presente: "nao", controle_tecnologico_nota: 0, sinalizacao_vertical_nota: 2, sinalizacao_ausente_motivo: "", controle_tecnologico_ausente_motivo: "Laboratório não compareceu",
  meta_contratual: "sim", meta_contratual_motivo: "", meta_contratual_outro: "" };

describe("Extras do RDO Técnico", () => {
  it("aceita formulário completo", () => expect(getTechnicalExtrasError(ok, "enviado")).toBeNull());
  it("nunca bloqueia rascunho nem dia sem produção", () => {
    const vazio = { ...ok, autorizacao_no_horario: "" as const, retrabalho: true };
    expect(getTechnicalExtrasError(vazio, "rascunho")).toBeNull();
    expect(getTechnicalExtrasError({ ...vazio, houve_producao: false }, "enviado")).toBeNull();
  });
  it.each([
    [{ retrabalho: true, retrabalho_oficio: "  " }, "Preencha a Obs Retrabalho"],
    [{ autorizacao_no_horario: "" as const }, "Informe se a obra foi liberada no horário previsto"],
    [{ autorizacao_no_horario: "nao" as const }, "Selecione o motivo da liberação fora do horário"],
    [{ autorizacao_no_horario: "nao" as const, autorizacao_motivo: "Condições climáticas" }, "Justifique a liberação fora do horário"],
    [{ sinalizacao_presente: "" as const }, "Informe se a equipe de sinalização estava presente no horário"],
    [{ sinalizacao_nota: 0 }, "Avalie a equipe de sinalização (1 a 5)"],
    [{ controle_tecnologico_presente: "" as const }, "Informe se o controle tecnológico esteve presente no horário"],
    [{ controle_tecnologico_presente: "sim" as const, controle_tecnologico_nota: 0 }, "Avalie a equipe de controle tecnológico (1 a 5)"],
    [{ sinalizacao_vertical_nota: 0 }, "Avalie a sinalização vertical (1 a 5)"],
    [{ meta_contratual: "" as const }, "Informe se atingiu a meta contratual"],
    [{ meta_contratual: "nao" as const }, "Selecione o motivo de não ter atingido a meta contratual"],
    [{ meta_contratual: "nao" as const, meta_contratual_motivo: "Outro", meta_contratual_outro: "  " }, "Descreva qual foi o outro motivo de não atingir a meta"],
    [{ sinalizacao_presente: "nao" as const, sinalizacao_nota: 0, sinalizacao_ausente_motivo: "  " }, "Explique por que a equipe de sinalização não estava presente no horário"],
    [{ controle_tecnologico_ausente_motivo: " " }, "Explique por que o controle tecnológico não esteve presente no horário"],
  ])("rejeita %j", (patch, msg) => expect(getTechnicalExtrasError({ ...ok, ...patch }, "enviado")).toBe(msg));
  it("meta não atingida com motivo da lista é aceita; Outro exige texto", () => {
    expect(getTechnicalExtrasError({ ...ok, meta_contratual: "nao", meta_contratual_motivo: "Chuva / condições climáticas" }, "enviado")).toBeNull();
    expect(getTechnicalExtrasError({ ...ok, meta_contratual: "nao", meta_contratual_motivo: "Outro", meta_contratual_outro: "Greve" }, "enviado")).toBeNull();
  });
  it("OGS simplificada ainda exige a meta contratual", () => {
    expect(getTechnicalExtrasError({ ...ok, meta_contratual: "" }, "enviado", { simplificado: true })).toBe("Informe se atingiu a meta contratual");
    expect(getTechnicalExtrasError({ ...ok, autorizacao_no_horario: "" }, "enviado", { simplificado: true })).toBeNull();
  });
  it("sinalização ausente dispensa a nota", () => expect(getTechnicalExtrasError({ ...ok, sinalizacao_presente: "nao", sinalizacao_nota: 0, sinalizacao_ausente_motivo: "Equipe atrasou" }, "enviado")).toBeNull());
  it("converte quantidade de caminhões para inteiro não negativo", () => {
    expect([toIntOrNull(""), toIntOrNull("7"), toIntOrNull("7,9"), toIntOrNull("-3"), toIntOrNull("abc")]).toEqual([null, 7, 7, 0, null]);
  });
  it("calcula atraso e responsável da liberação", () => {
    expect([atrasoMinutos("07:00", "09:30:00"), atrasoMinutos("07:00", ""), atrasoMinutos("09:00", "07:00")]).toEqual([150, null, null]);
    expect([responsavelLiberacao("Fiscalização não liberou a pista"), responsavelLiberacao("Condições climáticas"), responsavelLiberacao(null)]).toEqual(["Cliente / fiscalização", "Clima", "A esclarecer"]);
  });
});
