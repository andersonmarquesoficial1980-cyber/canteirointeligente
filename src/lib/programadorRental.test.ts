import { describe, expect, it, vi } from "vitest";
import { parseMonthlyPrice, saveMonthlyRental } from "./programadorRental";

const item = { id: "equipment-1", company_id: "company-1", condicao: "TERCEIRO", valor_mensal: 1200 };

describe("valor mensal no WF Programador", () => {
  it("accepts Brazilian currency with two decimal places", () => {
    expect(parseMonthlyPrice("1.234,56")).toBe(1234.56);
    expect(parseMonthlyPrice("1234.56")).toBe(1234.56);
  });
  it("refuses invalid or silently rounded monetary values", () => {
    for (const text of ["", "-1", "1,234", "dez", "1,2,3"]) {
      expect(() => parseMonthlyPrice(text)).toThrow();
    }
  });
  it("updates only a third-party item in the current company via one audited RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { antes: 1200, depois: 1234.56 }, error: null });
    expect(await saveMonthlyRental({ rpc }, item, "company-1", "1.234,56")).toEqual({ antes: 1200, depois: 1234.56 });
    expect(rpc).toHaveBeenCalledWith("programador_atualizar_valor_mensal", {
      p_company_id: "company-1", p_equipment_id: "equipment-1", p_valor_mensal: 1234.56,
    });
  });
  it("blocks own fleet or another company before contacting the database", async () => {
    const rpc = vi.fn();
    await expect(saveMonthlyRental({ rpc }, { ...item, condicao: "PROPRIO" }, "company-1", "5")).rejects.toThrow();
    await expect(saveMonthlyRental({ rpc }, item, "another-company", "5")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("distinguishes missing price from an explicit zero", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { antes: null, depois: 0 }, error: null });
    await expect(saveMonthlyRental({ rpc }, { ...item, valor_mensal: null }, "company-1", "0")).resolves.toEqual({ antes: null, depois: 0 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("propagates a failed transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("Auditoria indisponível") });
    await expect(saveMonthlyRental({ rpc }, item, "company-1", "1300")).rejects.toThrow("Auditoria indisponível");
  });
});
