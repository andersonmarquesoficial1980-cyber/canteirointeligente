/**
 * audit.ts — Registro de auditoria do Workflux
 * Chama para registrar ações críticas: delete, update, create
 */
import { supabase } from "@/integrations/supabase/client";

type AuditAcao = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "RESTORE";

interface AuditParams {
  acao: AuditAcao;
  tabela: string;
  registroId?: string;
  dadosAntes?: Record<string, any>;
  dadosDepois?: Record<string, any>;
}

export async function registrarAuditoria(params: AuditParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, nome_completo")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("audit_log" as any).insert({
      company_id: (profile as any)?.company_id || null,
      user_id: user.id,
      user_nome: (profile as any)?.nome_completo || user.email,
      acao: params.acao,
      tabela: params.tabela,
      registro_id: params.registroId || null,
      dados_antes: params.dadosAntes || null,
      dados_depois: params.dadosDepois || null,
    });
  } catch {
    // Nunca deixar auditoria quebrar a ação principal
  }
}
