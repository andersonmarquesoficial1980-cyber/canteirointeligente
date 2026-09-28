type PersonChange = { id: string; equipe: string | null; status: string };
type EquipmentChange = { id: string; setor: string | null; status: string; responsavel_destino: string | null };

type BatchInput = {
  companyId: string | null;
  date: string;
  team: string;
  overrideReason: string;
  employees: PersonChange[];
  equipments: EquipmentChange[];
};

type BatchResult = { funcionarios: number; equipamentos: number };

// One RPC = one PostgreSQL transaction: master changes and history succeed or fail together.
export async function applyProgramadorBatch(
  client: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: BatchResult | null; error: Error | null }> },
  input: BatchInput,
): Promise<BatchResult> {
  if (!input.companyId) throw new Error("Empresa não identificada");
  const { data, error } = await client.rpc("programador_aplicar_lote", {
    p_company_id: input.companyId,
    p_data: input.date,
    p_equipe: input.team,
    p_override_reason: input.overrideReason,
    p_func_changes: input.employees,
    p_equip_changes: input.equipments,
  });
  if (error) throw error;
  if (!data) throw new Error("O banco não confirmou a aplicação do lote");
  return data;
}
