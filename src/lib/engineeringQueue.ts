import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { toSaoPauloISODate } from "@/lib/date-local";
import { namesLikelyMatch } from "@/lib/nameMatch";

export const ENGINEERING_VALIDATION_START = "2026-07-17";
export const ENGINEERING_QUEUE_ERROR = "Não foi possível carregar a fila completa. Atualize para tentar novamente; nenhum total parcial foi exibido.";
export type QueuePeriod = { from: string; to: string };
export function defaultEngineeringQueuePeriod(): QueuePeriod {
  return { from: ENGINEERING_VALIDATION_START, to: toSaoPauloISODate() };
}
export function isEngineeringPending(row: { data: string; status_validacao: string | null; validado_por: string | null }, period: QueuePeriod): boolean {
  return row.data >= period.from && row.data <= period.to && !row.validado_por
    && ["enviado", "aguardando_validacao"].includes(row.status_validacao || "");
}

// Fetch every page BEFORE restricting by the viewer. No 500-row/1000-row silent totals.
export async function loadEngineeringQueue(client: SupabaseClient<Database>, companyId: string, period = defaultEngineeringQueuePeriod()) {
  if (!companyId) throw new Error("Empresa não identificada");
  if (!period.from || !period.to || period.from > period.to) throw new Error("Período de validação inválido");
  const pageSize = 500;
  const page = (start: number) => client.from("rdo_diarios")
    .select("id,data,obra_nome,preenchido_por,encarregado,turno,tipo_rdo,status_validacao,engenheiro_responsavel,engenheiro_responsavel_user_id,validado_por,validado_em,encarregado_employee_id,validado_encarregado,nao_aprovado_encarregado,ogs_id")
    .eq("company_id", companyId)
    .in("status_validacao", ["enviado", "aguardando_validacao"])
    .is("validado_por", null)
    .gte("data", period.from).lte("data", period.to)
    .order("data", { ascending: false }).order("id", { ascending: false })
    .range(start, start + pageSize - 1);
  const first = await page(0);
  if (first.error) throw first.error;
  const rows = [...(first.data || [])];
  let lastPageLength = first.data?.length || 0;
  for (let start = pageSize; lastPageLength === pageSize; start += pageSize) {
    const result = await page(start);
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    lastPageLength = result.data?.length || 0;
  }
  return rows;
}

export type EngineeringQueueRow = Awaited<ReturnType<typeof loadEngineeringQueue>>[number];
export function restrictEngineeringQueue<T extends { engenheiro_responsavel_user_id?: string | null; engenheiro_responsavel?: string | null }>(
  rows: T[], viewer: { userId: string; name: string; isAdmin: boolean },
): T[] {
  if (viewer.isAdmin) return rows;
  // Preserve the existing legacy fallback only when no user ID is stored.
  return rows.filter(row => row.engenheiro_responsavel_user_id
    ? row.engenheiro_responsavel_user_id === viewer.userId
    : !!viewer.name.trim() && namesLikelyMatch(viewer.name, row.engenheiro_responsavel));
}


export function filterEngineeringQueue<T extends {
  obra_nome: string | null; engenheiro_responsavel_user_id: string | null; engenheiro_responsavel?: string | null;
}>(rows: T[], filters: { obra: string; engineer: string; search: string }, names: Record<string, string>): T[] {
  const q = filters.search.trim().toLocaleLowerCase("pt-BR");
  return rows.filter(row => {
    const id = row.engenheiro_responsavel_user_id;
    if (filters.obra && row.obra_nome !== filters.obra) return false;
    if (filters.engineer === "__sem_identificacao" && id && names[id]) return false;
    if (filters.engineer && filters.engineer !== "__sem_identificacao" && id !== filters.engineer) return false;
    return !q || [row.obra_nome, row.engenheiro_responsavel, id ? names[id] : ""].join(" ").toLocaleLowerCase("pt-BR").includes(q);
  });
}
