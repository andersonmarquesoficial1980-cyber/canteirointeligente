import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
import { getMyForeman, listForemanPendingRdos, validateForemanRdo } from "./foremanValidation";

describe("validação do encarregado", () => {
  beforeEach(() => rpc.mockReset());
  it("usa vínculo único fornecido pelo banco", async () => {
    rpc.mockResolvedValue({ data: { id: "emp-1", name: "JOSENILDO DA SILVA RAMOS", company_id: "co-1" }, error: null });
    await expect(getMyForeman()).resolves.toEqual({ id: "emp-1", name: "JOSENILDO DA SILVA RAMOS", company_id: "co-1" });
    expect(rpc).toHaveBeenCalledWith("wf_meu_encarregado");
  });
  it("não inventa vínculo se não houver um único funcionário", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getMyForeman()).resolves.toBeNull();
  });
  it("busca pendências por ID e cobre legados sem ID pelo nome, sem perder registros", async () => {
    const filters: string[] = [];
    from.mockImplementation(() => {
      const builder: any = { select: () => builder, eq: (field: string, value: unknown) => { filters.push(`${field}:${value}`); return builder; },
        is: (field: string, value: unknown) => { filters.push(`${field}:is:${value}`); return builder; },
        neq: () => builder, gte: () => builder, order: () => builder,
        limit: () => Promise.resolve({ data: [{ id: "rdo-1", data: "2026-10-05" }], error: null }) };
      return builder;
    });
    const identity = { id: "emp-1", name: "JOSENILDO DA SILVA RAMOS", company_id: "co-1" };
    await expect(listForemanPendingRdos(identity)).resolves.toHaveLength(1);
    expect(filters).toContain("encarregado_employee_id:emp-1");
    expect(filters).toContain("encarregado_employee_id:is:null");
    expect(filters).toContain("encarregado:JOSENILDO DA SILVA RAMOS");
    expect(filters).toContain("company_id:co-1");
  });
  it("envia somente a decisão e exige confirmação real do banco", async () => {
    rpc.mockResolvedValue({ data: "rdo-1", error: null });
    await validateForemanRdo("rdo-1", "aprovado", "");
    expect(rpc).toHaveBeenCalledWith("wf_validar_rdo_encarregado", { p_rdo_id: "rdo-1", p_acao: "aprovado", p_motivo: null });
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(validateForemanRdo("rdo-1", "aprovado", "")).rejects.toThrow("não foi atualizado");
  });
  it("exige motivo de rejeição e propaga erro do banco", async () => {
    await expect(validateForemanRdo("rdo-1", "nao_aprovado", " ")).rejects.toThrow("motivo");
    rpc.mockResolvedValue({ data: null, error: { message: "Somente o encarregado responsável" } });
    await expect(validateForemanRdo("rdo-1", "nao_aprovado", "  Falta material ")).rejects.toThrow("responsável");
    expect(rpc).toHaveBeenCalledWith("wf_validar_rdo_encarregado", { p_rdo_id: "rdo-1", p_acao: "nao_aprovado", p_motivo: "Falta material" });
  });
});
