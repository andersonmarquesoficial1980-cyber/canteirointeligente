import { describe, expect, it } from "vitest";
import { buildEngineeringMonitoring } from "./engineeringMonitoring";

describe("acompanhamento separado da engenharia", () => {
  const people = [
    { user_id: "ana", nome_completo: "Ana", email: null },
    { user_id: "bia", nome_completo: "Bia", email: null },
  ];

  it("conta envios técnicos por autor sem misturar validações, incluindo engenheiro com zero", () => {
    const result = buildEngineeringMonitoring(people, [
      { id: "t1", data: "2026-09-15", engenheiro_id: "ana", status: "enviado", ogs_number: "2539" },
      { id: "t2", data: "2026-09-16", engenheiro_id: "ana", status: "rascunho", ogs_number: "2539" },
      { id: "t3", data: "2026-08-31", engenheiro_id: "ana", status: "enviado", ogs_number: "2539" },
    ], [
      { id: "a1", data: "2026-09-10", obra_nome: "OGS 1", engenheiro_responsavel_user_id: "bia", status_validacao: "enviado", validado_por: null },
    ], { from: "2026-09-01", to: "2026-10-05" });

    expect(result.launchRows.map(r => [r.nome, r.enviados, r.rascunhos])).toEqual([
      ["Ana", 1, 1], ["Bia", 0, 0],
    ]);
    expect(result.pendingRows.map(r => [r.nome, r.pendentes.length])).toEqual([["Bia", 1]]);
  });

  it("mostra somente apontamentos pendentes até a data final, inclusive backlog antigo", () => {
    const result = buildEngineeringMonitoring(people, [], [
      { id: "old", data: "2026-08-20", obra_nome: "OGS A", engenheiro_responsavel_user_id: "ana", status_validacao: "enviado", validado_por: null },
      { id: "new", data: "2026-09-20", obra_nome: "OGS B", engenheiro_responsavel_user_id: "ana", status_validacao: "aguardando_validacao", validado_por: null },
      { id: "done", data: "2026-09-20", obra_nome: "OGS C", engenheiro_responsavel_user_id: "ana", status_validacao: "validado", validado_por: "ana" },
      { id: "future", data: "2026-10-06", obra_nome: "OGS D", engenheiro_responsavel_user_id: "ana", status_validacao: "enviado", validado_por: null },
      { id: "unassigned", data: "2026-09-01", obra_nome: "OGS E", engenheiro_responsavel_user_id: null, status_validacao: "enviado", validado_por: null },
    ], { from: "2026-09-01", to: "2026-10-05" });

    expect(result.pendingRows.map(r => [r.nome, r.pendentes.map(p => p.id)])).toEqual([
      ["Ana", ["old", "new"]],
    ]);
    expect(result.unassigned.map(r => r.id)).toEqual(["unassigned"]);
  });
});
