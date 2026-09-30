import { describe, expect, it } from "vitest";
import { formatDiaryFleetLabel } from "./diaryFleetLabel";

describe("identificação da frota no diário", () => {
  it("exibe a placa cadastrada de caminhões mesmo quando nome contém descrição genérica", () => {
    expect(formatDiaryFleetLabel({ frota: "CC15", placa: "EJY0G69", nome: "CARROCERIA" }, true)).toBe("CC15 — EJY0G69");
    expect(formatDiaryFleetLabel({ frota: "CC17", placa: "EJY0D27", nome: "CASINHA" }, true)).toBe("CC17 — EJY0D27");
  });

  it("sinaliza placa ausente em veículo sem inventar uma a partir do nome", () => {
    expect(formatDiaryFleetLabel({ frota: "CB021", placa: null, nome: "ATEGO 3133" }, true)).toBe("CB021 — placa não cadastrada");
  });

  it("preserva a identificação por nome para equipamentos que não são veículos", () => {
    expect(formatDiaryFleetLabel({ frota: "KMA03", placa: null, nome: "Usina móvel" }, false)).toBe("KMA03 — Usina móvel");
  });
});
