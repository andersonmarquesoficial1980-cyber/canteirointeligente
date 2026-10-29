import { supabase } from "@/integrations/supabase/client";

/**
 * Equipes/setores exibidos no campo "Equipe / Setor" do RDO Técnico.
 * Equipes com `exibir_rdo_tecnico = false` (definido em Admin > Equipes) ficam ocultas.
 * Se a coluna ainda não existir no banco, cai para o comportamento anterior (todas as ativas).
 */
export async function loadRdoTecnicoTeams(): Promise<string[]> {
  const client = supabase as any;
  const { data, error } = await client.from("ci_equipes").select("nome, exibir_rdo_tecnico").eq("ativa", true).order("nome");
  if (!error) {
    return (data || []).filter((e: any) => e.exibir_rdo_tecnico !== false).map((e: any) => e.nome);
  }
  const { data: legacy } = await client.from("ci_equipes").select("nome").eq("ativa", true).order("nome");
  return (legacy || []).map((e: any) => e.nome);
}
