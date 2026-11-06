import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import {
  deInputLocal, duracaoHoras, fmtHoras, horasReparo, origemPorPerfil, paraInputLocal, situacaoFalha, sugerirJanela,
  validarFalha, validarReparo,
} from "./equipDisponibilidade";

const AGORA = new Date("2026-10-10T15:00:00");
const base = { equipamentoId: "e1", ogs: "1001", causa: "Hidráulica", inicio: "2026-10-10T10:00", fim: "" };

describe("validarFalha", () => {
  it("aceita falha em aberto e falha com retorno", () => {
    expect(validarFalha(base, AGORA)).toBeNull();
    expect(validarFalha({ ...base, fim: "2026-10-10T12:00" }, AGORA)).toBeNull();
  });
  it("exige equipamento, obra, causa e início", () => {
    expect(validarFalha({ ...base, equipamentoId: "" }, AGORA)).toMatch(/equipamento/i);
    expect(validarFalha({ ...base, ogs: "" }, AGORA)).toMatch(/obra/i);
    expect(validarFalha({ ...base, causa: "  " }, AGORA)).toMatch(/causa/i);
    expect(validarFalha({ ...base, inicio: "" }, AGORA)).toMatch(/parou/i);
  });
  it("rejeita retorno antes/igual ao início e datas futuras", () => {
    expect(validarFalha({ ...base, fim: "2026-10-10T09:00" }, AGORA)).toMatch(/depois do início/);
    expect(validarFalha({ ...base, fim: "2026-10-10T10:00" }, AGORA)).toMatch(/depois do início/);
    expect(validarFalha({ ...base, inicio: "2026-10-11T10:00" }, AGORA)).toMatch(/futuro/);
    expect(validarFalha({ ...base, fim: "2026-10-10T20:00" }, AGORA)).toMatch(/futuro/);
  });
});

describe("validarReparo", () => {
  const f = { parada_inicio: "2026-10-10T10:00:00", parada_fim: "2026-10-10T14:00:00" };
  it("exige o reparo dentro da parada", () => {
    expect(validarReparo(f, "2026-10-10T10:30", "2026-10-10T11:30")).toBeNull();
    expect(validarReparo(f, "2026-10-10T09:00", "2026-10-10T11:30")).toMatch(/antes da parada/);
    expect(validarReparo(f, "2026-10-10T12:00", "2026-10-10T15:00")).toMatch(/depois do retorno/);
    expect(validarReparo(f, "2026-10-10T12:00", "2026-10-10T11:00")).toMatch(/depois do início/);
    expect(validarReparo(f, "", "")).toMatch(/Informe/);
  });
  it("com falha em aberto só exige que não comece antes da parada", () => {
    expect(validarReparo({ parada_inicio: f.parada_inicio, parada_fim: null }, "2026-10-10T11:00", "2026-10-10T18:00")).toBeNull();
  });
});

describe("horasReparo", () => {
  it("soma trechos e une sobreposição (igual ao banco)", () => {
    const r = (a: string, b: string) => ({ reparo_inicio: `2026-10-10T${a}:00Z`, reparo_fim: `2026-10-10T${b}:00Z` });
    expect(horasReparo([r("00:30", "01:30"), r("01:00", "02:00"), r("02:30", "03:00")])).toBe(2);
    expect(horasReparo([])).toBe(0);
    expect(horasReparo(undefined)).toBe(0);
  });
});

describe("tempo e formatação", () => {
  it("duracaoHoras e fmtHoras (sem dado ≠ zero)", () => {
    expect(duracaoHoras("2026-10-10T10:00:00Z", "2026-10-10T12:30:00Z")).toBe(2.5);
    expect(duracaoHoras("2026-10-10T10:00:00Z", null)).toBeNull();
    expect(duracaoHoras("2026-10-10T12:00:00Z", "2026-10-10T10:00:00Z")).toBeNull();
    expect(fmtHoras(2.5)).toBe("2,50 h");
    expect(fmtHoras(0)).toBe("0,00 h");
    expect(fmtHoras(null)).toBe("Sem dados");
  });
  it("datetime-local ida e volta", () => {
    expect(paraInputLocal(deInputLocal("2026-10-10T22:30"))).toBe("2026-10-10T22:30");
    expect(deInputLocal("")).toBeNull();
    expect(paraInputLocal(null)).toBe("");
  });
  it("situação da falha", () => {
    expect(situacaoFalha({ status: "confirmada", parada_fim: null })).toBe("aberta");
    expect(situacaoFalha({ status: "confirmada", parada_fim: "x" })).toBe("reparada");
    expect(situacaoFalha({ status: "cancelada", parada_fim: null })).toBe("cancelada");
    expect(situacaoFalha({ status: "pendente_confirmacao", parada_fim: null })).toBe("pendente");
  });
  it("origem pelo perfil, com acento", () => {
    expect(origemPorPerfil("Mecânico")).toBe("mecanico");
    expect(origemPorPerfil("Encarregado de Obra")).toBe("encarregado");
    expect(origemPorPerfil("Apontador")).toBe("operador");
    expect(origemPorPerfil(null)).toBe("operador");
  });
});

describe("sugerirJanela", () => {
  it("noturno que cruza a meia-noite: mediana 22:00–04:00", () => {
    const a = [["22:00", "04:00"], ["22:15", "04:00"], ["21:45", "04:15"], ["22:00", "03:45"], ["22:00", "04:00"]]
      .map(([start, end]) => ({ start: `${start}:00`, end: `${end}:00` }));
    expect(sugerirJanela(a, "noturno")).toEqual({ inicio: "22:00", fim: "04:00", amostras: 5 });
  });
  it("noturno com início após a meia-noite não distorce a mediana", () => {
    const a = [["22:00", "04:00"], ["22:00", "04:00"], ["00:30", "05:00"]].map(([start, end]) => ({ start: `${start}:00`, end: `${end}:00` }));
    expect(sugerirJanela(a, "noturno")?.inicio).toBe("22:00");
  });
  it("diurno 07:00–17:00", () => {
    const a = [["07:00", "17:00"], ["07:10", "16:50"], ["06:50", "17:10"]].map(([start, end]) => ({ start: `${start}:00`, end: `${end}:00` }));
    expect(sugerirJanela(a, "diurno")).toEqual({ inicio: "07:00", fim: "17:00", amostras: 3 });
  });
  it("poucas amostras ou horários iguais não geram sugestão", () => {
    expect(sugerirJanela([{ start: "07:00:00", end: "17:00:00" }], "diurno")).toBeNull();
    expect(sugerirJanela(Array(5).fill({ start: "07:00:00", end: "07:00:00" }), "diurno")).toBeNull();
  });
});
