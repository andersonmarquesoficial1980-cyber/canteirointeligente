import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type DiaryTipo = "equipamento" | "rdo";

interface UseDiaryUnlockResult {
  isBlocked: boolean;
  isLoading: boolean;
  prazoLabel: string;
}

// Bloqueio de prazo ativo em produção
const DIARY_DEADLINE_DISABLED = false;

const ADMIN_PERFIS = new Set(["admin", "administrador", "superadmin"]);
const ADMIN_ROLES = new Set(["admin", "superadmin"]);

function getTodayInSaoPauloIso(): string {
  const br = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const [day, month, year] = br.split("/");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isAdminProfile(perfil?: string | null, role?: string | null): boolean {
  const perfilNorm = (perfil || "").trim().toLowerCase();
  const roleNorm = (role || "").trim().toLowerCase();
  return ADMIN_PERFIS.has(perfilNorm) || ADMIN_ROLES.has(roleNorm);
}

export function useDiaryUnlock(date: string, tipo: DiaryTipo): UseDiaryUnlockResult {
  const { session } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const prazoLabel = useMemo(
    () => "até 48h (dia do lançamento + 2 dias)",
    [],
  );

  useEffect(() => {
    // Bloqueio desativado temporariamente durante implantação
    if (DIARY_DEADLINE_DISABLED) {
      setIsBlocked(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function checkUnlock() {
      if (!session?.user?.id || !date) {
        if (!cancelled) {
          setIsBlocked(false);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("perfil, role, company_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (isAdminProfile((profile as any)?.perfil, (profile as any)?.role)) {
          if (!cancelled) setIsBlocked(false);
          return;
        }

        const todaySp = getTodayInSaoPauloIso();
        const twoDaysAgoSp = shiftIsoDate(todaySp, -2);

        // Regra operacional: lançamento permitido até 48h
        // Ex.: dia 10 pode lançar até dia 12; no dia 13 bloqueia.
        const withinDeadline = date >= twoDaysAgoSp && date <= todaySp;

        if (withinDeadline) {
          if (!cancelled) setIsBlocked(false);
          return;
        }

        let query = (supabase as any)
          .from("diary_unlock_requests")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("data_liberada", date)
          .eq("tipo", tipo)
          .limit(1);

        if ((profile as any)?.company_id) {
          query = query.eq("company_id", (profile as any).company_id);
        }

        const { data: unlocks, error: unlockError } = await query;
        if (unlockError) throw unlockError;

        if (!cancelled) {
          setIsBlocked(!unlocks || unlocks.length === 0);
        }
      } catch (error) {
        console.error("[useDiaryUnlock] Falha ao validar prazo:", error);
        if (!cancelled) {
          setIsBlocked(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkUnlock();

    return () => {
      cancelled = true;
    };
  }, [date, session?.user?.id, tipo]);

  return { isBlocked, isLoading, prazoLabel };
}
