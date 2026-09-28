type EquipmentForRental = { id: string; company_id?: string | null; condicao: string | null; valor_mensal: number | null };
type Result = { antes: number | null; depois: number };

/** Reject invalid or imprecise prices; never silently round an executive KPI. */
export function parseMonthlyPrice(text: string): number {
  const raw = text.trim().replace(/^R\$\s?/, "").replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Informe o valor mensal com até duas casas decimais");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed > 1000000000) throw new Error("Valor mensal fora do limite");
  return parsed;
}

/** A single RPC handles permission checks, update and before/after audit in one transaction. */
export async function saveMonthlyRental(
  client: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: Result | null; error: Error | null }> },
  item: EquipmentForRental,
  companyId: string | null,
  text: string,
): Promise<Result> {
  if (!companyId || !item.id || item.company_id !== companyId) throw new Error("Equipamento fora da empresa atual");
  if ((item.condicao || "").trim().toUpperCase() !== "TERCEIRO") throw new Error("Valor mensal só pode ser editado para equipamento de terceiro");
  const value = parseMonthlyPrice(text);
  if (item.valor_mensal != null && Number(item.valor_mensal) === value) throw new Error("O valor mensal não foi alterado");
  const { data, error } = await client.rpc("programador_atualizar_valor_mensal", {
    p_company_id: companyId, p_equipment_id: item.id, p_valor_mensal: value,
  });
  if (error) throw error;
  if (!data || data.depois !== value) throw new Error("Banco não confirmou a alteração do valor mensal");
  return data;
}
