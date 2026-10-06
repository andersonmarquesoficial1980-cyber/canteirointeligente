import { supabase } from "@/integrations/supabase/client";

export type ForemanIdentity = { id: string; name: string; company_id: string };
export type PendingForemanRdo = { id: string; data: string; obra_nome: string; preenchido_por: string; encarregado: string; turno: string; tipo_rdo: string; ogs_id?: string | null };

export async function listForemanPendingRdos(identity: ForemanIdentity): Promise<PendingForemanRdo[]> {
  const makeQuery = () => (supabase as any).from("rdo_diarios")
    .select("id,data,obra_nome,preenchido_por,encarregado,turno,tipo_rdo,ogs_id")
    .eq("company_id", identity.company_id)
    .eq("validado_encarregado", false).eq("nao_aprovado_encarregado", false)
    .neq("status_validacao", "rascunho").gte("data", "2026-07-17")
    .order("data", { ascending: false });
  const [linked, legacy] = await Promise.all([
    makeQuery().eq("encarregado_employee_id", identity.id).limit(1000),
    makeQuery().is("encarregado_employee_id", null).eq("encarregado", identity.name).limit(1000),
  ]);
  if (linked.error || legacy.error) throw new Error(linked.error?.message || legacy.error?.message);
  const unique = new Map<string, PendingForemanRdo>();
  for (const row of [...(linked.data || []), ...(legacy.data || [])]) unique.set(row.id, row);
  return [...unique.values()].sort((a, b) => b.data.localeCompare(a.data));
}

export async function getMyForeman(): Promise<ForemanIdentity | null> {
  const { data, error } = await (supabase as any).rpc("wf_meu_encarregado");
  if (error) throw new Error(error.message);
  if (!data?.id || !data?.name || !data?.company_id) return null;
  return { id: data.id, name: data.name, company_id: data.company_id };
}

export async function validateForemanRdo(id: string, action: "aprovado" | "nao_aprovado", reason: string): Promise<void> {
  if (action === "nao_aprovado" && !reason.trim()) throw new Error("Informe o motivo da rejeição.");
  const { data, error } = await (supabase as any).rpc("wf_validar_rdo_encarregado", {
    p_rdo_id: id,
    p_acao: action,
    p_motivo: action === "nao_aprovado" ? reason.trim() : null,
  });
  if (error) throw new Error(error.message);
  if (data !== id) throw new Error("O RDO não foi atualizado. Atualize a lista e tente novamente.");
}
