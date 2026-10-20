interface MonitoringRoster {
  readonly includeUserIds: readonly string[];
  readonly excludeLaunchUserIds: readonly string[];
}

/**
 * Complementos de acompanhamento confirmados pela gestão, por empresa e user_id.
 * Não concede acesso, não determina escala diária e não altera autoria ou validação.
 * A lista complementa autores/designados do recorte; não é o cadastro de funcionários.
 */
const ROSTERS: Readonly<Record<string, MonitoringRoster>> = {
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
    includeUserIds: [
      "54900f26-da3b-4b0d-ac90-b2f4721de54a", // Adenilton Sousa
      "83e64f4c-5207-477b-926e-a2441f874243", // Leticia Reis
      "217afba8-3280-44fe-a218-f9d16a60bb42", // Tiago Rodrigues
    ],
    excludeLaunchUserIds: ["27c76763-85b9-4f95-82bc-ef20cc3cd471"], // Igor Capucho: fora apenas do acompanhamento
  },
};
const EMPTY: MonitoringRoster = { includeUserIds: [], excludeLaunchUserIds: [] };

export function getEngineeringMonitoringRoster(companyId: string | null | undefined): MonitoringRoster {
  return companyId ? ROSTERS[companyId] || EMPTY : EMPTY;
}
