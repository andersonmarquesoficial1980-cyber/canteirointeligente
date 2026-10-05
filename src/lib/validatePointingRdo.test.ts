import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { validatePointingRdo } from "./validatePointingRdo";

describe("validatePointingRdo", () => {
  beforeEach(() => rpc.mockReset());

  it("envia somente ID, decisão e motivo para uma função autorizada", async () => {
    rpc.mockResolvedValue({ data: "rdo-1", error: null });
    await validatePointingRdo("rdo-1", "validado", "");
    expect(rpc).toHaveBeenCalledWith("wf_validar_rdo_apontador", {
      p_rdo_id: "rdo-1", p_acao: "validado", p_motivo: null,
    });
  });

  it("não informa sucesso se o banco não alterou o RDO", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(validatePointingRdo("rdo-1", "validado", "")).rejects.toThrow("não foi atualizado");
  });

  it("repassa rejeição com motivo e erros do banco", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Prazo expirado" } });
    await expect(validatePointingRdo("rdo-1", "rejeitado", "Incompleto")).rejects.toThrow("Prazo expirado");
    expect(rpc).toHaveBeenCalledWith("wf_validar_rdo_apontador", {
      p_rdo_id: "rdo-1", p_acao: "rejeitado", p_motivo: "Incompleto",
    });
  });
});
