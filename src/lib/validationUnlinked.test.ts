import { describe, expect, it } from "vitest";
import { classifyUnlinkedValidationRdos } from "./validationUnlinked";

const row = { id: "1", data: "2026-10-05", obra_nome: "2525", encarregado: "Josenildo", encarregado_employee_id: null, validado_encarregado: false, nao_aprovado_encarregado: false, engenheiro_responsavel: "Dimas", engenheiro_responsavel_user_id: null, validado_por: null, status_validacao: "enviado" };

describe("fila administrativa de RDOs sem vínculo", () => {
  it("separa pendências sem identidade e preserva nomes para conferência", () => {
    const result = classifyUnlinkedValidationRdos([row]);
    expect(result.encarregado.map(r => r.id)).toEqual(["1"]);
    expect(result.engenharia.map(r => r.id)).toEqual(["1"]);
  });
  it("não cobra decisões concluídas nem rascunhos", () => {
    const result = classifyUnlinkedValidationRdos([
      { ...row, id: "2", validado_encarregado: true, validado_por: "engenheiro" },
      { ...row, id: "3", status_validacao: "rascunho" },
    ]);
    expect(result.encarregado).toEqual([]);
    expect(result.engenharia).toEqual([]);
  });
});
