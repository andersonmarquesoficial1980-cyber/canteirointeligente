type Person = { id: string; company_id?: string | null; equipe: string | null; status: string | null };
type Equipment = { id: string; company_id?: string | null; setor: string | null; status?: string | null };

function checkTarget(id: string, recordCompany: string | null | undefined, companyId: string | null, target: string) {
  if (!id || !companyId || recordCompany !== companyId) throw new Error("Registro fora da empresa atual");
  if (!target.trim()) throw new Error("Informe o destino da movimentação");
  return target.trim();
}

export function buildPersonMovement(person: Person, companyId: string | null, mode: "status" | "transferencia", target: string) {
  const value = checkTarget(person.id, person.company_id, companyId, target);
  const equipe = mode === "transferencia" ? value : person.equipe;
  const status = mode === "status" ? value : person.status;
  if (equipe === person.equipe && status === person.status) throw new Error("Nenhuma alteração identificada");
  if (!status) throw new Error("Status atual ausente");
  return { id: person.id, equipe, status };
}

export function assertNewAdmission(companyId: string | null, existingId: string | null) {
  if (!companyId) throw new Error("Empresa não identificada");
  if (existingId) throw new Error("Esta matrícula já existe; revise o cadastro e a recontratação na Gestão de Pessoas antes de admitir novamente");
}

export function summarizeTeamRental(rows: { condicao: string | null; valor_mensal: number | null }[]) {
  const rentals = rows.filter(row => (row.condicao || "").trim().toUpperCase() === "TERCEIRO");
  return {
    rented: rentals.length,
    monthlyKnown: rentals.reduce((sum, row) => sum + (Number(row.valor_mensal) > 0 ? Number(row.valor_mensal) : 0), 0),
    withoutPrice: rentals.filter(row => !Number.isFinite(Number(row.valor_mensal)) || Number(row.valor_mensal) <= 0).length,
  };
}

export function buildEquipmentMovement(equipment: Equipment, companyId: string | null, mode: "status" | "transferencia", target: string, responsible: string | null = null) {
  const value = checkTarget(equipment.id, equipment.company_id, companyId, target);
  const setor = mode === "transferencia" ? value : equipment.setor;
  const status = mode === "status" ? value : equipment.status;
  if (setor === equipment.setor && status === equipment.status) throw new Error("Nenhuma alteração identificada");
  if (!status) throw new Error("Status atual ausente");
  return { id: equipment.id, setor, status, responsavel_destino: responsible };
}
