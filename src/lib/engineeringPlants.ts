import { supabase } from "@/integrations/supabase/client";

/** Catálogo único do RDO Técnico; o escopo de leitura continua protegido pela RLS. */
export async function loadEngineeringPlants(): Promise<string[]> {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("nome, tipo_insumos, tipo_insumo")
    .or("vinculo_rdo.eq.CAUQ,vinculo_rdo.eq.PAVIMENTACAO")
    .order("nome");
  if (error) throw new Error(error.message);
  return [...new Set((data || [])
    .filter(f => f.tipo_insumos?.includes("Massa Asfáltica") || f.tipo_insumo?.includes("Massa Asfáltica"))
    .map(f => f.nome).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}
