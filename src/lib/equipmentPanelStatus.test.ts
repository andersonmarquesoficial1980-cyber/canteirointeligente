import { describe, expect, it } from "vitest";
import { dbStatusToPainel, painelStatusToDb, STATUS_PAINEL_OPTIONS } from "./equipmentPanelStatus";

describe("status no Painel de Controle da Frota", () => {
  it("não oferece Reserva", () => {
    expect(STATUS_PAINEL_OPTIONS).not.toContain("RESERVA");
  });

  it("mostra o status real dos caminhões devolvidos", () => {
    expect(dbStatusToPainel("devolvido")).toBe("DEVOLVIDO");
    expect(painelStatusToDb(dbStatusToPainel("devolvido"))).toBe("devolvido");
  });

  it("mantém DEVOLVER distinto de DEVOLVIDO ao editar", () => {
    expect(dbStatusToPainel("devolver")).toBe("DEVOLVER");
    expect(painelStatusToDb("DEVOLVER")).toBe("devolver");
  });

  it("preserva os rótulos dos status legados", () => {
    expect(dbStatusToPainel("disposicao")).toBe("DEVOLVER");
    expect(dbStatusToPainel("inativo")).toBe("INOPERANTE");
    expect(dbStatusToPainel("ativo")).toBe("OPERACIONAL");
  });
});
