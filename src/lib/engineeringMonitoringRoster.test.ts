import { describe, expect, it } from "vitest";
import { getEngineeringMonitoringRoster } from "./engineeringMonitoringRoster";

describe("Lista de acompanhamento confirmada pela gestão", () => {
  it("inclui somente os três usuários adicionais confirmados na Fremix", () => {
    expect(getEngineeringMonitoringRoster("a1b2c3d4-e5f6-7890-abcd-ef1234567890").includeUserIds).toEqual([
      "54900f26-da3b-4b0d-ac90-b2f4721de54a",
      "83e64f4c-5207-477b-926e-a2441f874243",
      "217afba8-3280-44fe-a218-f9d16a60bb42",
    ]);
  });
  it("exclui Igor apenas da lista de preenchimento da Fremix", () => {
    const roster = getEngineeringMonitoringRoster("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(roster.excludeLaunchUserIds).toEqual(["27c76763-85b9-4f95-82bc-ef20cc3cd471"]);
    expect(roster.includeUserIds).not.toContain(roster.excludeLaunchUserIds[0]);
  });
  it.each(["outra-empresa", null, undefined])("não transfere decisões da Fremix para %s", companyId => {
    expect(getEngineeringMonitoringRoster(companyId)).toEqual({ includeUserIds: [], excludeLaunchUserIds: [] });
  });
});
