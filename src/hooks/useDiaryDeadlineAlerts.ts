import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toSaoPauloISODate } from "@/lib/date-local";
import {
  EQUIPMENT_LOOKBACK_DAYS,
  computeEquipmentAlerts,
  computeRdoAlerts,
  shiftIso,
  type ExpiringDay,
  type FleetAlert,
} from "@/lib/diaryDeadlineAlerts";

export interface DiaryDeadlineAlerts {
  loading: boolean;
  equipment: FleetAlert[];
  rdo: ExpiringDay[];
  hasAny: boolean;
}

const EMPTY: DiaryDeadlineAlerts = { loading: false, equipment: [], rdo: [], hasAny: false };
const ADMIN_PERFIS = new Set(["admin", "administrador", "superadmin"]);

/**
 * Avisos de prazo do usuário logado (somente leitura).
 * 1) Prazo vencendo (72h) e 2) dias sem lançar desde que assumiu a frota.
 * Admin não recebe aviso (não é bloqueado pelo prazo).
 * Qualquer falha de consulta resulta em "sem aviso": nunca atrapalha o lançamento.
 */
export function useDiaryDeadlineAlerts(): DiaryDeadlineAlerts {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [state, setState] = useState<DiaryDeadlineAlerts>({ ...EMPTY, loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setState(EMPTY);
      return;
    }

    async function load() {
      try {
        const today = toSaoPauloISODate();
        const since = shiftIso(today, -EQUIPMENT_LOOKBACK_DAYS);
        const sb = supabase as any;

        const [{ data: profile }, { data: hasAdminRole }] = await Promise.all([
          sb.from("profiles").select("perfil, role, company_id").eq("user_id", userId).maybeSingle(),
          sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
        ]);
        const perfil = String(profile?.perfil || "").trim().toLowerCase();
        const role = String(profile?.role || "").trim().toLowerCase();
        if (hasAdminRole || ADMIN_PERFIS.has(perfil) || ADMIN_PERFIS.has(role)) {
          if (!cancelled) setState(EMPTY);
          return;
        }

        const companyId: string | null = profile?.company_id ?? null;
        const scope = <T extends { eq: (c: string, v: string) => T }>(q: T) =>
          companyId ? q.eq("company_id", companyId) : q;

        const [diariesRes, rdoRes, unlockRes] = await Promise.all([
          scope(
            sb
              .from("equipment_diaries")
              .select("date, equipment_fleet, equipment_type")
              .eq("created_by", userId)
              .eq("status", "enviado")
              .gte("date", since)
              .limit(2000),
          ),
          scope(
            sb
              .from("rdo_diarios")
              .select("data")
              .eq("user_id", userId)
              .neq("status_validacao", "rascunho")
              .gte("data", since)
              .limit(2000),
          ),
          scope(
            sb
              .from("diary_unlock_requests")
              .select("data_liberada, tipo")
              .eq("user_id", userId)
              .gte("data_liberada", since)
              .limit(2000),
          ),
        ]);

        const unlockRows: { data_liberada: string; tipo: string }[] = unlockRes.data ?? [];
        const unlockedEquip = new Set(unlockRows.filter((u) => u.tipo === "equipamento").map((u) => u.data_liberada));
        const unlockedRdo = new Set(unlockRows.filter((u) => u.tipo === "rdo").map((u) => u.data_liberada));

        const equipment = diariesRes.error
          ? []
          : computeEquipmentAlerts({
              today,
              diaries: ((diariesRes.data ?? []) as any[]).map((r) => ({
                fleet: r.equipment_fleet,
                date: r.date,
                equipmentType: r.equipment_type,
              })),
              unlockedDates: unlockedEquip,
            });

        const rdoDatesArr: string[] = rdoRes.error ? [] : ((rdoRes.data ?? []) as any[]).map((r) => r.data).filter(Boolean);
        const rdo = computeRdoAlerts({
          today,
          rdoDates: new Set(rdoDatesArr),
          lastRdoDate: rdoDatesArr.length ? [...rdoDatesArr].sort().at(-1)! : null,
          unlockedDates: unlockedRdo,
        });

        if (cancelled) return;
        const hasAny =
          equipment.some((f) => f.expiring.length > 0 || f.blocked.some((b) => !b.unlocked)) || rdo.length > 0;
        setState({ loading: false, equipment, rdo, hasAny });
      } catch (error) {
        console.error("[useDiaryDeadlineAlerts] Falha ao calcular avisos:", error);
        if (!cancelled) setState(EMPTY);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}
