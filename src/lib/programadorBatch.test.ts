import { describe, expect, it, vi } from "vitest";
import { applyProgramadorBatch } from "./programadorBatch";

const payload = {
  companyId: "company-1",
  date: "2026-09-28",
  team: "EQUIPE A",
  overrideReason: "",
  employees: [{ id: "employee-1", equipe: "EQUIPE B", status: "ativo" }],
  equipments: [{ id: "equipment-1", setor: "EQUIPE B", status: "ativo", responsavel_destino: "Responsável" }],
};

describe("aplicação de lote do Programador", () => {
  it("sends people and equipment in a single backend transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { funcionarios: 1, equipamentos: 1 }, error: null });
    expect(await applyProgramadorBatch({ rpc }, payload)).toEqual({ funcionarios: 1, equipamentos: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("programador_aplicar_lote", {
      p_company_id: "company-1", p_data: "2026-09-28", p_equipe: "EQUIPE A",
      p_override_reason: "", p_func_changes: payload.employees, p_equip_changes: payload.equipments,
    });
  });

  it("does not call the database without a company", async () => {
    const rpc = vi.fn();
    await expect(applyProgramadorBatch({ rpc }, { ...payload, companyId: null })).rejects.toThrow("Empresa não identificada");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates an atomic transaction failure without claiming success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("auditoria indisponível") });
    await expect(applyProgramadorBatch({ rpc }, payload)).rejects.toThrow("auditoria indisponível");
  });
});
