import { describe, expect, it } from "vitest";
import { applyDraftDecisions, buildBulkChanges, eligibleOnDay, buildEligibleDays, mapPastedOgs, type MdoBaseDay, type MdoDecision } from "./mdoWorkbench";

const base: MdoBaseDay = {
  employee_id: "person-a", data: "2026-09-01", funcionario: "Maria", equipe: "Obra", funcao: "Auxiliar",
  matricula: "10", status: "ativo", presenca_rdo: "NAO", ogs: "-", rdo_ids: "-",
};

const decision: MdoDecision = {
  employee_id: "person-a", data: "2026-09-01", disposition: "ogs", ogs_id: "ogs-1", ogs_number: "OGS-101", reason: "", include: true,
};

describe("conferência MDO", () => {
  it("exibe OGS do RDO separada da decisão gerencial, sem alterar a fonte", () => {
    const result = applyDraftDecisions([base], [decision]);
    expect(result[0].ogs_rdo).toBe("-");
    expect(result[0].ogs_custos).toBe("OGS-101");
    expect(base.ogs).toBe("-");
  });

  it("não aprova automaticamente múltiplas OGS no mesmo dia", () => {
    expect(applyDraftDecisions([{ ...base, ogs: "OGS-1 | OGS-2" }], [])[0].situacao).toBe("PENDENTE");
  });

  it("não considera dia sem RDO como ausência do funcionário", () => {
    expect(applyDraftDecisions([base], [])[0].situacao).toBe("PENDENTE");
  });

  it("em lote, altera somente as células selecionadas e não inventa OGS", () => {
    const other = { ...base, employee_id: "person-b" };
    const changes = buildBulkChanges([base, other], new Set(["person-a|2026-09-01"]), { disposition: "exception", ogs_id: null, reason: "Férias", include: true });
    expect(changes).toEqual([{ employee_id: "person-a", data: "2026-09-01", disposition: "exception", ogs_id: null, reason: "Férias", include: true }]);
  });

  it("cola OGS linha a linha na ordem das células selecionadas, rejeitando códigos desconhecidos", () => {
    const second = { ...base, data: "2026-09-02" };
    const catalog = [{ id: "one", ogs_number: "OGS-1" }, { id: "two", ogs_number: "OGS-2" }];
    expect(mapPastedOgs([base, second], "OGS-1\nOGS-2", catalog).map((c) => c.ogs_id)).toEqual(["one", "two"]);
    expect(() => mapPastedOgs([base], "OGS-3", catalog)).toThrow(/não encontrada/i);
    expect(() => mapPastedOgs([base, second], "OGS-1", catalog)).toThrow(/quantidade/i);
  });

  it("grade histórica inclui somente os dias de vínculo elegíveis", () => {
    const days = buildEligibleDays([
      { id: "a", status: "demitido", data_admissao: "2026-09-02", data_demissao: "2026-09-03" },
    ], ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(days).toEqual([{ employee_id: "a", data: "2026-09-02" }, { employee_id: "a", data: "2026-09-03" }]);
  });

  it("respeita datas de admissão e demissão no período histórico", () => {
    expect(eligibleOnDay({ status: "demitido", data_admissao: "2026-08-01", data_demissao: "2026-09-15" }, "2026-09-10")).toBe(true);
    expect(eligibleOnDay({ status: "demitido", data_admissao: "2026-08-01", data_demissao: "2026-09-15" }, "2026-09-16")).toBe(false);
    expect(eligibleOnDay({ status: "ativo", data_admissao: "2026-09-10", data_demissao: null }, "2026-09-09")).toBe(false);
  });
});
