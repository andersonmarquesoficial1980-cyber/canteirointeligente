import { describe, expect, it } from "vitest";
import { limpar } from "./monitoring";

describe("monitoramento — limpeza de dados pessoais", () => {
  it("remove CPF, e-mail e token das mensagens de erro", () => {
    const out = limpar("Falha para 123.456.789-09 (joao@fremix.workflux.app) Bearer eyJhbGciOi.abc123.def456");
    expect(out).not.toMatch(/123\.456\.789-09/);
    expect(out).not.toMatch(/joao@/);
    expect(out).not.toMatch(/eyJhbGciOi/);
    expect(out).toContain("[cpf]");
  });
  it("tolera vazio", () => {
    expect(limpar(undefined)).toBeUndefined();
  });
});
