type TruckIdentity = {
  company_id: string | null;
  placa: string | null;
};

export type LinkedEquipment = TruckIdentity & {
  id: string;
  frota?: string | null;
  modelo_completo?: string | null;
  nome?: string | null;
};

const normalizedPlate = (plate: string | null) =>
  (plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Never guess a link from a missing plate, another tenant, or multiple candidates.
export function resolveTruckEquipment<T extends LinkedEquipment>(
  truck: TruckIdentity,
  equipments: readonly T[],
): T | null {
  if (!truck.company_id) return null;
  const plate = normalizedPlate(truck.placa);
  if (!plate) return null;
  const matches = equipments.filter((equipment) =>
    equipment.company_id === truck.company_id && normalizedPlate(equipment.placa) === plate,
  );
  return matches.length === 1 ? matches[0] : null;
}
