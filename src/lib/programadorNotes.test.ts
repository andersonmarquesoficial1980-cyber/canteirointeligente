import { describe, expect, it, vi } from "vitest";
import { normalizeOperationalNote, saveOperationalNote } from "./programadorNotes";

describe("observações operacionais do Programador", () => {
  it("rejects notes over the limit and trims valid text", () => {
    expect(normalizeOperationalNote("  Conferir CNH  ")).toBe("Conferir CNH");
    expect(() => normalizeOperationalNote("x".repeat(1001))).toThrow(/1000/);
    expect(normalizeOperationalNote("   ")).toBeNull();
  });
  it("writes to the scoped RPC and confirms the saved text by reading the same target", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "n1", texto: "Revisar documentação" }, error: null });
    const single = vi.fn().mockResolvedValue({ data: { texto: "Revisar documentação" }, error: null });
    const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) });
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
    await expect(saveOperationalNote({ rpc, from }, "company", "equipamento", "equipment", " Revisar documentação ")).resolves.toBe("Revisar documentação");
    expect(rpc).toHaveBeenCalledWith("programador_salvar_observacao", {
      p_company_id: "company", p_subject_type: "equipamento", p_subject_id: "equipment", p_texto: "Revisar documentação",
    });
    expect(from).toHaveBeenCalledWith("programador_observacoes");
  });
  it("does not report success if the readback fails", async () => {
    const query = { eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
    query.eq.mockReturnValue(query);
    const client = { rpc: vi.fn().mockResolvedValue({ data: { id: "n1" }, error: null }),
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }) };
    await expect(saveOperationalNote(client, "company", "pessoa", "person", "Texto")).rejects.toThrow(/confirmar/);
  });
});
