import { describe, it, expect } from "vitest";
import { isPendenciaFerias, diasPendenciaFerias, periodoSugeridoFerias } from "./feriasPendencia";

const base = { tipo: "outros", justificativa: "Férias 30 dias", data_efetiva: "2026-12-07", payload: { subtipo: "ferias" } };
describe("feriasPendencia", () => {
  it("reconhece Dar férias", () => {
    expect(isPendenciaFerias(base)).toBe(true);
    expect(isPendenciaFerias({ tipo: "outros", payload: { outro_tipo_solicitacao: "Dar férias" } })).toBe(true);
    expect(isPendenciaFerias({ tipo: "outros", payload: { subtipo: "afastar" } })).toBe(false);
    expect(isPendenciaFerias({ tipo: "demissao", payload: { subtipo: "ferias" } })).toBe(false);
  });
  it("dias: payload > texto > 30", () => {
    expect(diasPendenciaFerias({ justificativa: "x", payload: { dias_ferias: 20 } })).toBe(20);
    expect(diasPendenciaFerias({ justificativa: "tirar 15 dias", payload: {} })).toBe(15);
    expect(diasPendenciaFerias({ justificativa: "sem número", payload: null })).toBe(30);
  });
  it("período sugerido", () => {
    expect(periodoSugeridoFerias(base)).toEqual({ inicio: "2026-12-07", fim: "2027-01-05", dias: 30 });
    expect(periodoSugeridoFerias({ ...base, data_efetiva: null }).inicio).toBe("");
  });
});
