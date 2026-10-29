import { describe, expect, it } from "vitest";
import { getTechnicalExtrasError, toIntOrNull, type TechnicalExtrasForm } from "./rdoTecnicoExtras";

const ok: TechnicalExtrasForm = { houve_producao: true, retrabalho: false, retrabalho_oficio: "", autorizacao_no_horario: "sim", autorizacao_atraso_detalhe: "",
  sinalizacao_presente: "sim", sinalizacao_nota: 3, controle_tecnologico_presente: "nao", sinalizacao_vertical_nota: 2 };

describe("Extras do RDO Técnico", () => {
  it("aceita formulário completo", () => expect(getTechnicalExtrasError(ok, "enviado")).toBeNull());
  it("nunca bloqueia rascunho nem dia sem produção", () => {
    const vazio = { ...ok, autorizacao_no_horario: "" as const, retrabalho: true };
    expect(getTechnicalExtrasError(vazio, "rascunho")).toBeNull();
    expect(getTechnicalExtrasError({ ...vazio, houve_producao: false }, "enviado")).toBeNull();
  });
  it.each([
    [{ retrabalho: true, retrabalho_oficio: "  " }, "Informe o número do ofício do retrabalho"],
    [{ autorizacao_no_horario: "" as const }, "Informe se a autorização para iniciar ocorreu no horário previsto"],
    [{ autorizacao_no_horario: "nao" as const }, "Descreva os detalhes do atraso na autorização"],
    [{ sinalizacao_presente: "" as const }, "Informe se a equipe de sinalização estava presente no horário"],
    [{ sinalizacao_nota: 0 }, "Avalie a equipe de sinalização (1 a 5)"],
    [{ controle_tecnologico_presente: "" as const }, "Informe se o controle tecnológico esteve presente no horário"],
    [{ sinalizacao_vertical_nota: 0 }, "Avalie a sinalização vertical (1 a 5)"],
  ])("rejeita %j", (patch, msg) => expect(getTechnicalExtrasError({ ...ok, ...patch }, "enviado")).toBe(msg));
  it("sinalização ausente dispensa a nota", () => expect(getTechnicalExtrasError({ ...ok, sinalizacao_presente: "nao", sinalizacao_nota: 0 }, "enviado")).toBeNull());
  it("converte quantidade de caminhões para inteiro não negativo", () => {
    expect([toIntOrNull(""), toIntOrNull("7"), toIntOrNull("7,9"), toIntOrNull("-3"), toIntOrNull("abc")]).toEqual([null, 7, 7, 0, null]);
  });
});
