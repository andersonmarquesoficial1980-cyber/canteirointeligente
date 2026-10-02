import { describe, expect, it } from "vitest";
import { applyDraftDecisions, buildBulkChanges, buildPersonPeriodChanges, buildTeamPeriodChanges, buildConferenceCalendar, eligibleOnDay, eligibleForConferenceDay, buildEligibleDays, mapPastedOgs, type MdoBaseDay, type MdoDecision } from "./mdoWorkbench";

const base: MdoBaseDay = {
  employee_id: "person-a", data: "2026-09-01", funcionario: "Maria", equipe: "Obra", funcao: "Auxiliar",
  matricula: "10", status: "ativo", presenca_rdo: "NAO", ogs: "-", rdo_ids: "-",
};

const decision: MdoDecision = {
  employee_id: "person-a", data: "2026-09-01", disposition: "ogs", ogs_id: "ogs-1", ogs_number: "OGS-101", reason: "", include: true,
};

describe("conferência MDO", () => {
  it("mostra todos os dias de Brian: equipe Thiago até 28/09 e AFASTADOS a partir de 29/09", () => {
    const employee = { id: "brian", equipe: "AFASTADOS", status: "afastado", data_admissao: "2026-07-20", data_demissao: null };
    const transitions = [
      { employee_id: "brian", data: "2026-09-29", campo: "equipe" as const, antes: "CBUQ04 - THIAGO HENRIQUE", depois: "AFASTADOS", created_at: "2026-09-29T12:31:27Z", id: "2" },
      { employee_id: "brian", data: "2026-09-29", campo: "status" as const, antes: "ativo", depois: "afastado", created_at: "2026-09-29T12:31:22Z", id: "1" },
    ];
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10));
    const result = buildConferenceCalendar([employee], days, transitions);
    expect(result).toHaveLength(30);
    expect(result.filter((r) => r.equipe === "CBUQ04 - THIAGO HENRIQUE" && r.status === "ativo")).toHaveLength(28);
    expect(result.map((r) => [r.data, r.equipe, r.status]).filter((r) => r[0] >= "2026-09-28")).toEqual([
      ["2026-09-28", "CBUQ04 - THIAGO HENRIQUE", "ativo"],
      ["2026-09-29", "AFASTADOS", "afastado"],
      ["2026-09-30", "AFASTADOS", "afastado"],
    ]);
    const grade = applyDraftDecisions(result.map((r) => ({ ...base, employee_id: r.id, data: r.data, equipe: r.equipe, status: r.status })), []);
    expect(grade).toHaveLength(30);
    expect(grade.every((r) => r.situacao === "PENDENTE" && r.presenca_rdo === "NAO")).toBe(true);
    expect(buildTeamPeriodChanges(grade, "CBUQ04 - THIAGO HENRIQUE", days[0], days[29], { id: "og", ogs_number: "2555" })).toHaveLength(28);
    expect(buildPersonPeriodChanges(grade, "brian", days[0], days[29], { id: "og", ogs_number: "2555" })).toHaveLength(30);
  });

  it("exibe dias mesmo fora do vínculo, sem inventar presença ou OGS", () => {
    const e = { id: "ex", equipe: "SEM EQUIPE", status: "demitido", data_admissao: "2026-09-10", data_demissao: "2026-09-20" };
    expect(buildConferenceCalendar([e], ["2026-09-01", "2026-09-15", "2026-09-30"], [])
      .map((r) => [r.data, r.status])).toEqual([
      ["2026-09-01", "não admitido"], ["2026-09-15", "demitido"], ["2026-09-30", "demitido"],
    ]);
  });

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

  it("inclui só dias de RDO de afastado, mas respeita admissão e demissão", () => {
    const brian = { status: "afastado", data_admissao: "2026-07-20", data_demissao: null };
    expect(eligibleForConferenceDay(brian, "2026-09-11", true)).toBe(true);
    expect(eligibleForConferenceDay(brian, "2026-09-13", false)).toBe(false);
    expect(eligibleForConferenceDay({ ...brian, data_admissao: "2026-09-12" }, "2026-09-11", true)).toBe(false);
    expect(eligibleForConferenceDay({ ...brian, status: "demitido", data_demissao: "2026-09-10" }, "2026-09-11", true)).toBe(false);
    expect(eligibleForConferenceDay({ ...brian, status: "ativo" }, "2026-09-13", false)).toBe(true);
  });

  it("aplica OGS só aos dias pendentes da equipe e do intervalo, inclusive as pontas", () => {
    const rows = applyDraftDecisions([
      base,
      { ...base, employee_id: "person-b", data: "2026-09-02" },
      { ...base, employee_id: "person-c", data: "2026-09-02", equipe: "Outra" },
      { ...base, data: "2026-09-03" },
      { ...base, data: "2026-09-02", ogs: "OGS-ORIGINAL" },
    ], []);
    const changes = buildTeamPeriodChanges(rows, "Obra", "2026-09-01", "2026-09-02", { id: "ogs-1", ogs_number: "OGS-101" });
    expect(changes.map((d) => `${d.employee_id}|${d.data}`)).toEqual(["person-a|2026-09-01", "person-b|2026-09-02"]);
    expect(changes.every((d) => d.ogs_id === "ogs-1")).toBe(true);
  });

  it("preserva exclusões e justificativas mesmo ao substituir OGS já preenchidas", () => {
    const rows = applyDraftDecisions([
      base, { ...base, employee_id: "alocado", ogs: "OGS-ANTIGA" },
      { ...base, employee_id: "fora" }, { ...base, employee_id: "ferias" },
    ], [
      { ...decision, employee_id: "fora", disposition: "exclude", ogs_id: null, reason: "Fora do escopo", include: false },
      { ...decision, employee_id: "ferias", disposition: "exception", ogs_id: null, reason: "Férias", include: true },
    ]);
    const changes = buildTeamPeriodChanges(rows, "Obra", "2026-09-01", "2026-09-01", { id: "nova", ogs_number: "OGS-NOVA" }, true);
    expect(changes.map((d) => d.employee_id)).toEqual(["person-a", "alocado"]);
  });

  it("recusa equipe, intervalo ou OGS ausente em vez de alterar todos", () => {
    const rows = applyDraftDecisions([base], []);
    expect(buildTeamPeriodChanges(rows, "", "2026-09-01", "2026-09-01", { id: "1", ogs_number: "OGS-1" })).toEqual([]);
    expect(buildTeamPeriodChanges(rows, "Obra", "2026-09-02", "2026-09-01", { id: "1", ogs_number: "OGS-1" })).toEqual([]);
    expect(buildTeamPeriodChanges(rows, "Obra", "2026-09-01", "2026-09-01", { id: "", ogs_number: "" })).toEqual([]);
  });

  it("edita só o funcionário selecionado pelo ID, mesmo com homônimo em outra equipe", () => {
    const rows = applyDraftDecisions([
      base, { ...base, data: "2026-09-02" },
      { ...base, employee_id: "homonimo", funcionario: "Maria", equipe: "Outra", data: "2026-09-02" },
      { ...base, data: "2026-09-03" },
    ], []);
    const changes = buildPersonPeriodChanges(rows, "person-a", "2026-09-01", "2026-09-02", { id: "og-1", ogs_number: "2539" });
    expect(changes.map((d) => `${d.employee_id}|${d.data}`)).toEqual(["person-a|2026-09-01", "person-a|2026-09-02"]);
    expect(changes.every((d) => d.ogs_id === "og-1")).toBe(true);
  });

  it("edição individual por período preserva OGS existente, exclusão e justificativa por padrão", () => {
    const rows = applyDraftDecisions([
      base, { ...base, data: "2026-09-02", ogs: "OGS-RDO" },
      { ...base, data: "2026-09-03" }, { ...base, data: "2026-09-04" },
    ], [
      { ...decision, data: "2026-09-03", disposition: "exclude", ogs_id: null, reason: "Fora do escopo", include: false },
      { ...decision, data: "2026-09-04", disposition: "exception", ogs_id: null, reason: "Férias", include: true },
    ]);
    const ogs = { id: "nova", ogs_number: "OGS-NOVA" };
    expect(buildPersonPeriodChanges(rows, "person-a", "2026-09-01", "2026-09-04", ogs).map((d) => d.data)).toEqual(["2026-09-01"]);
    expect(buildPersonPeriodChanges(rows, "person-a", "2026-09-01", "2026-09-04", ogs, true).map((d) => d.data)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(buildPersonPeriodChanges(rows, "", "2026-09-01", "2026-09-04", ogs)).toEqual([]);
  });
});
