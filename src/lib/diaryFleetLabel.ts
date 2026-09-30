type DiaryFleetEquipment = {
  frota: string;
  placa?: string | null;
  nome?: string | null;
};

/** O identificador salvo continua sendo a frota; a placa serve apenas para conferir a escolha. */
export function formatDiaryFleetLabel(equipment: DiaryFleetEquipment, isVehicle: boolean): string {
  const frota = equipment.frota.trim();
  if (isVehicle) {
    const placa = equipment.placa?.trim();
    return `${frota} — ${placa || "placa não cadastrada"}`;
  }
  const nome = equipment.nome?.trim();
  return nome ? `${frota} — ${nome}` : frota;
}
