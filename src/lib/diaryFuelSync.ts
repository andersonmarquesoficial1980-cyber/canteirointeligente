import { supabase } from "@/integrations/supabase/client";

/** Abastecimentos feitos pelo Comboio para uma frota no dia do diário, sem depender de diary_id. */
export async function loadComboioFuel(companyId: string, fleet: string, date: string, usesOdometer: boolean) {
  const { data, error } = await supabase.from("abastecimentos")
    .select("litros, horimetro, km_odometro")
    .eq("company_id", companyId)
    .eq("fonte", "comboio")
    .eq("equipment_fleet", fleet)
    .eq("data", date);
  if (error) throw error;
  if (!data?.length) return null;
  const liters = data.reduce((sum, row) => sum + (Number(row.litros) || 0), 0);
  if (liters <= 0) return null;
  const meter = data.reduce((max, row) => Math.max(max, Number(usesOdometer ? row.km_odometro : row.horimetro) || 0), 0);
  return { liters, meter: meter || null };
}
