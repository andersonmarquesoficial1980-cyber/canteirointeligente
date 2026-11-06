import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { fmtNumero, parseNumeroBR, resumirProducao, validarToneladas, type LinhaProducao } from "./equipProducao";

const linha = (o: Partial<LinhaProducao>): LinhaProducao => ({
  equipamento_id: "e", frota: "VB01", ogs_number: "1001", data: "2026-10-05", turno: "noturno", tipo: "vibroacabadora",
  valor: null, unidade: "t", fonte: "apontamento", lancado: false, apontamento_id: null, ...o,
});

describe("parseNumeroBR", () => {
  it("aceita formatos brasileiros e simples", () => {
    expect(parseNumeroBR("312,45")).toBe(312.45);
    expect(parseNumeroBR("1.234,5")).toBe(1234.5);
    expect(parseNumeroBR("1234.5")).toBe(1234.5);
    expect(parseNumeroBR("1.234.567")).toBe(1234567);
    expect(parseNumeroBR(" 0 ")).toBe(0);
  });
  it("rejeita vazio e lixo", () => {
    expect(parseNumeroBR("")).toBeNull();
    expect(parseNumeroBR("abc")).toBeNull();
    expect(parseNumeroBR("12,3,4")).toBeNull();
    expect(parseNumeroBR(null)).toBeNull();
  });
});

describe("validarToneladas", () => {
  it("aceita zero e valores normais", () => {
    expect(validarToneladas("0")).toBeNull();
    expect(validarToneladas("312,45")).toBeNull();
  });
  it("rejeita vazio, negativo e acima do limite", () => {
    expect(validarToneladas("")).toMatch(/Informe/);
    expect(validarToneladas("-5")).toMatch(/negativas/);
    expect(validarToneladas("5000,01")).toMatch(/acima/);
    expect(validarToneladas("5000")).toBeNull();
  });
});

describe("resumirProducao", () => {
  it("soma só o lançado e conta pendentes à parte (pendente ≠ zero)", () => {
    const r = resumirProducao([
      linha({ valor: 100.1, lancado: true }), linha({ valor: 50.2, lancado: true }), linha({}),
      linha({ tipo: "fresadora", unidade: "m", fonte: "diario", valor: 200.5, lancado: true }),
      linha({ tipo: "fresadora", unidade: "m", fonte: "diario" }), linha({ tipo: "fresadora", unidade: "m", fonte: "diario" }),
    ]);
    expect(r).toEqual({ toneladas: 150.3, metros: 200.5, vibroPendentes: 1, fresaPendentes: 2, vibroLancados: 2, fresaLancados: 1 });
  });
  it("lista vazia → zeros", () => {
    expect(resumirProducao([]).toneladas).toBe(0);
  });
  it("zero lançado conta como lançado, não pendente", () => {
    const r = resumirProducao([linha({ valor: 0, lancado: true })]);
    expect(r.vibroLancados).toBe(1);
    expect(r.vibroPendentes).toBe(0);
  });
});

describe("fmtNumero", () => {
  it("formata pt-BR e mostra 'Sem dados' para ausência", () => {
    expect(fmtNumero(1234.5)).toBe("1.234,50");
    expect(fmtNumero(0)).toBe("0,00");
    expect(fmtNumero(null)).toBe("Sem dados");
  });
});
