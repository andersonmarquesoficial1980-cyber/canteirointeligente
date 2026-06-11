import { supabase } from "@/integrations/supabase/client";

const IMPERSONATION_KEY = "ci_impersonation";

export interface ImpersonationState {
  active: boolean;
  targetName: string;
  targetEmail: string;
  adminAccessToken: string;
  adminRefreshToken: string;
}

export function getImpersonationState(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImpersonationState;
  } catch {
    return null;
  }
}

export async function startImpersonation(
  targetUserId: string,
  targetName: string,
  targetEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Salvar sessão admin atual ANTES de trocar
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    if (!adminSession) return { success: false, error: "Sessão admin não encontrada" };

    const { data, error } = await supabase.functions.invoke("admin-impersonate", {
      body: { target_user_id: targetUserId },
    });

    if (error || data?.error) {
      return { success: false, error: data?.error || error?.message || "Erro desconhecido" };
    }

    // Persistir estado de impersonation
    const state: ImpersonationState = {
      active: true,
      targetName,
      targetEmail,
      adminAccessToken: adminSession.access_token,
      adminRefreshToken: adminSession.refresh_token,
    };
    localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state));

    // Trocar sessão para o usuário alvo
    const { error: setError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    if (setError) {
      localStorage.removeItem(IMPERSONATION_KEY);
      return { success: false, error: setError.message };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Erro inesperado" };
  }
}

export async function stopImpersonation(): Promise<void> {
  const state = getImpersonationState();
  if (!state) return;

  try {
    // Restaurar sessão admin
    await supabase.auth.setSession({
      access_token: state.adminAccessToken,
      refresh_token: state.adminRefreshToken,
    });
  } catch {}

  localStorage.removeItem(IMPERSONATION_KEY);
  window.location.replace("/admin/configuracoes");
}
