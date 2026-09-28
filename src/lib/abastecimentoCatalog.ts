// Catalog lookups must stay within the current company, even if RLS changes.
// These are reads of the canonical equipment and employee registries, not copies.
export async function loadFuelEquipment(db: any, companyId: string | null) {
  if (!companyId) throw new Error("Empresa não identificada");
  const { data, error } = await db.from("equipamentos")
    .select("id, frota, nome, placa, tipo, categoria_rdo")
    .eq("company_id", companyId)
    .in("status", ["ativo", "Operando"])
    .order("frota");
  if (error) throw error;
  return data || [];
}

export async function loadFuelOperatorNames(db: any, companyId: string | null, ids: string[]): Promise<string[]> {
  if (!companyId) throw new Error("Empresa não identificada");
  if (!ids.length) return [];
  const { data, error } = await db.from("employees")
    .select("name")
    .eq("company_id", companyId)
    .in("id", ids)
    .order("name");
  if (error) throw error;
  return (data || []).map((row: { name: string | null }) => row.name).filter(Boolean);
}
