import { describe, expect, it } from "vitest";
import { textoComunicado, validarComunicado, type DestinoEquipe } from "./programacaoComunicado";
const trabalho: DestinoEquipe = { equipe: "CBUQ 01", situacao: "TRABALHO", local: "Obra Centro", ogs: "123", cliente: "Cliente", periodo: "NOTURNO", observacao: "" };
const folga: DestinoEquipe = { equipe: "CBUQ 02", situacao: "FOLGA", local: "", ogs: "", cliente: "", periodo: "", observacao: "" };
describe("comunicado de obras", () => {
  it("exige destino somente de quem trabalha", () => {
    expect(validarComunicado([trabalho, folga])).toBeNull();
    expect(validarComunicado([{ ...trabalho, local: "" }])).toMatch(/onde/);
  });
  it("impede duplicidade dentro do mesmo comunicado", () => {
    expect(validarComunicado([trabalho, { ...trabalho, equipe: "cbuq 01" }])).toMatch(/diferentes/);
  });
  it("compõe mensagem única com todos os destinos e folgas", () => {
    const texto = textoComunicado({ id: "id", data: "2026-10-18", created_at: "", itens: [trabalho, folga] });
    expect(texto).toContain("*1. CBUQ 01* — TRABALHA");
    expect(texto).toContain("📍 Obra Centro");
    expect(texto).toContain("*2. CBUQ 02* — FOLGA");
    expect(texto).toContain("18/10/2026");
  });
});
