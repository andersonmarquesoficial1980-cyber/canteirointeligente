import { describe, expect, it } from "vitest";
import { vacationReadiness } from "./vacationReadiness";

const base = { admission: "2022-03-01", periods: [] as { periodo_inicio: string; periodo_fim: string }[], history: [] as { periodo_inicio: string | null }[], records: [] as { vacation_period_id: string | null }[] };

describe("conferência do histórico de férias", () => {
  it("não transforma a última saída conhecida em saldo validado", () => {
    const result = vacationReadiness({ ...base, history: [{ periodo_inicio: null }] });
    expect(result.label).toBe("Histórico a conferir");
    expect(result.reasons).toContain("Última saída informada sem período aquisitivo identificado.");
    expect(result.reasons).toContain("Nenhum período aquisitivo cadastrado no RH.");
  });
  it("não trata período cadastrado como homologação", () => {
    const result = vacationReadiness({ ...base, periods: [{ periodo_inicio: "2024-03-01", periodo_fim: "2025-02-28" }] });
    expect(result.label).toBe("Saldo a conferir");
    expect(result.reasons).toContain("Período cadastrado não comprova, sozinho, o saldo de férias.");
  });
  it("aponta ausência de admissão e registros sem vínculo, sem inventar vencimento", () => {
    const result = vacationReadiness({ ...base, admission: "", records: [{ vacation_period_id: null }] });
    expect(result.reasons).toContain("Data de admissão ausente no cadastro.");
    expect(result.reasons).toContain("Programações sem período aquisitivo vinculado.");
    expect(result.reasons.join(" ")).not.toMatch(/vencido|dias disponíveis/i);
  });
});
