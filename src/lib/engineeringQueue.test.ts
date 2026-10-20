import { describe, expect, it, vi, afterEach } from "vitest";
import { defaultEngineeringQueuePeriod, filterEngineeringQueue, isEngineeringPending, restrictEngineeringQueue } from "./engineeringQueue";
const rows = [
  { id: "a", data: "2026-10-01", obra_nome: "OGS 2539", engenheiro_responsavel_user_id: "ana", engenheiro_responsavel: "Ana", status_validacao: "enviado", validado_por: null },
  { id: "b", data: "2026-10-02", obra_nome: "OGS 2553", engenheiro_responsavel_user_id: null, engenheiro_responsavel: "Ana", status_validacao: "aguardando_validacao", validado_por: null },
  { id: "c", data: "2026-09-01", obra_nome: "OGS 2553", engenheiro_responsavel_user_id: "outro", engenheiro_responsavel: "Ana", status_validacao: "enviado", validado_por: null },
];
const names = { ana: "Ana Engenharia", outro: "Outro Engenheiro" };
afterEach(() => vi.useRealTimers());
describe("regra única da fila de engenharia", () => {
  it("usa hoje de São Paulo, não o dia seguinte de UTC", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T01:00:00Z"));
    expect(defaultEngineeringQueuePeriod()).toEqual({ from: "2026-07-17", to: "2026-10-20" });
  });
  it("prioriza ID sobre nome e mantém o fallback legado somente sem ID", () => {
    expect(restrictEngineeringQueue(rows, { userId: "ana", name: "Ana", isAdmin: false }).map(r => r.id)).toEqual(["a", "b"]);
    expect(restrictEngineeringQueue(rows, { userId: "ana", name: "Ana", isAdmin: true })).toEqual(rows);
  });
  it("não atribui registro sem ID a um usuário sem nome", () => {
    expect(restrictEngineeringQueue(rows, { userId: "novo", name: "", isAdmin: false })).toEqual([]);
  });
  it("filtra obra, responsável e busca independentemente do RDO técnico", () => {
    expect(filterEngineeringQueue(rows, { obra: "OGS 2553", engineer: "outro", search: "Outro" }, names).map(r => r.id)).toEqual(["c"]);
    expect(filterEngineeringQueue(rows, { obra: "", engineer: "__sem_identificacao", search: "2553" }, names).map(r => r.id)).toEqual(["b"]);
    expect(rows[1].engenheiro_responsavel_user_id).toBeNull();
  });
  it("recusa rascunho, rejeitado, já validado, antes do marco e depois do fim", () => {
    const period = { from: "2026-07-17", to: "2026-10-20" };
    expect(isEngineeringPending(rows[0], period)).toBe(true);
    expect(isEngineeringPending(rows[1], period)).toBe(true);
    for (const override of [{ status_validacao: "rascunho" }, { status_validacao: "rejeitado" }, { validado_por: "ana" }, { data: "2026-07-16" }, { data: "2026-10-21" }]) {
      expect(isEngineeringPending({ ...rows[0], ...override }, period)).toBe(false);
    }
  });
});
