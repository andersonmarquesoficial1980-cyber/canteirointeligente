import { describe, expect, it } from "vitest";
import { computeMetaContratual, motivoMetaLabel } from "./rdoTecnicoMetaContratual";

const r = (o: Record<string, unknown>) => ({ houve_producao: true, ogs_number: "1", ...o }) as any;

describe("computeMetaContratual", () => {
  it("só conta dias com produção e % sobre quem respondeu", () => {
    const m = computeMetaContratual([
      r({ meta_contratual_atingida: true }),
      r({ meta_contratual_atingida: false, meta_contratual_motivo: "Chuva / condições climáticas" }),
      r({ meta_contratual_atingida: false, meta_contratual_motivo: "Chuva / condições climáticas" }),
      r({ meta_contratual_atingida: null }),
      r({ houve_producao: false, meta_contratual_atingida: false, meta_contratual_motivo: "Outro" }),
    ]);
    expect(m).toMatchObject({ comProducao: 4, respondidos: 3, semResposta: 1, sim: 1, nao: 2 });
    expect(m.pct).toBeCloseTo(33.33, 1);
    expect(m.motivos).toEqual([{ name: "Chuva / condições climáticas", value: 2 }]);
  });
  it("sem dados → pct null", () => {
    expect(computeMetaContratual([]).pct).toBeNull();
  });
  it("Outro mostra o texto digitado", () => {
    expect(motivoMetaLabel({ meta_contratual_motivo: "Outro", meta_contratual_outro: " greve " })).toBe("Outro: greve");
    expect(motivoMetaLabel({ meta_contratual_motivo: null, meta_contratual_outro: null })).toBe("Sem motivo informado");
  });
});
