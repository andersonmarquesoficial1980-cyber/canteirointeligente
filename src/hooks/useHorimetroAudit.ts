import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuditResult {
  inconsistente: boolean;
  diff: number;
  threshold: number;
  ultimoValor: number | null;
}

interface UltimoRegistro {
  meter_final: number | null;
  odometer_final: number | null;
  date: string | null;
}

export function useHorimetroAudit(companyId: string) {

  const buscarUltimoRegistro = useCallback(async (equipmentFleet: string): Promise<UltimoRegistro> => {
    const { data } = await (supabase as any)
      .from("equipment_diaries")
      .select("meter_final, odometer_final, date")
      .eq("equipment_fleet", equipmentFleet)
      .eq("company_id", companyId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      meter_final: data?.meter_final ?? null,
      odometer_final: data?.odometer_final ?? null,
      date: data?.date ?? null,
    };
  }, [companyId]);

  const buscarThreshold = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("patio_auto_config")
      .select("horimetro_threshold, odometro_threshold")
      .eq("company_id", companyId)
      .maybeSingle();
    return {
      horimetro: data?.horimetro_threshold ?? 5,
      odometro: data?.odometro_threshold ?? 50,
    };
  }, [companyId]);

  const verificarInconsistencia = useCallback(async (
    equipmentFleet: string,
    valorAtual: number,
    tipo: "horimetro" | "odometro"
  ): Promise<AuditResult> => {
    const [ultimo, threshold] = await Promise.all([
      buscarUltimoRegistro(equipmentFleet),
      buscarThreshold(),
    ]);

    const ultimoValor = tipo === "horimetro" ? ultimo.meter_final : ultimo.odometer_final;
    const limite = tipo === "horimetro" ? threshold.horimetro : threshold.odometro;

    if (ultimoValor === null) {
      return { inconsistente: false, diff: 0, threshold: limite, ultimoValor: null };
    }

    const diff = valorAtual - ultimoValor;
    return {
      inconsistente: diff > limite,
      diff,
      threshold: limite,
      ultimoValor,
    };
  }, [buscarUltimoRegistro, buscarThreshold]);

  const registrarAudit = useCallback(async (params: {
    equipmentFleet: string;
    diaryDate: string;
    ultimoValor: number | null;
    valorInformado: number;
    diff: number;
    threshold: number;
    confirmado: boolean;
    userId: string;
  }) => {
    await (supabase as any).from("horimetro_audit").insert({
      company_id: companyId,
      equipment_fleet: params.equipmentFleet,
      diary_date: params.diaryDate,
      ultimo_valor: params.ultimoValor,
      valor_informado: params.valorInformado,
      diff: params.diff,
      threshold_usado: params.threshold,
      confirmado_pelo_operador: params.confirmado,
      created_by: params.userId,
    });
  }, [companyId]);

  return { verificarInconsistencia, buscarUltimoRegistro, registrarAudit };
}
