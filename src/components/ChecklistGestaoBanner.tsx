import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Resumo diário para Gestão de Frotas / Manutenção: ontem sem checklist + NÃO CONFORME em aberto. */
export function ChecklistGestaoBanner({ destino = "/gestao-frotas/checklist", mostrarSemChecklist = true }: { destino?: string; mostrarSemChecklist?: boolean }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ ontem: string; sem: number; abertas: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
      const ontem = addDays(hojeSP(), -1);
      const db = supabase as any;
      const [dy, cl, oc] = await Promise.all([
        db.from("equipment_diaries").select("equipment_fleet, period, work_status, preop_checklist_id, checklist_submitted_at")
          .eq("date", ontem).neq("status", "rascunho").in("work_status", ["Trabalhando", "Em Transporte"]).limit(2000),
        db.from("equipment_preop_checklists").select("equipment_fleet, period").eq("date", ontem).limit(2000),
        db.from("equipamentos_ocorrencias").select("id", { count: "exact", head: true }).eq("origem", "checklist").eq("status", "ABERTA"),
      ]);
      const k = (f: string, p: string) => `${(f || "").trim().toUpperCase()}|${p}`;
      const feitos = new Set<string>((cl.data || []).map((c: any) => k(c.equipment_fleet, c.period)));
      const sem = new Set<string>();
      (dy.data || []).forEach((d: any) => {
        if (d.preop_checklist_id || d.checklist_submitted_at) return;
        if (!feitos.has(k(d.equipment_fleet, d.period))) sem.add(k(d.equipment_fleet, d.period));
      });
      if (vivo) setData({ ontem, sem: sem.size, abertas: oc.count || 0 });
      } catch { /* banner é opcional */ }
    })();
    return () => { vivo = false; };
  }, []);
  if (!data) return null;
  const mostrarSem = mostrarSemChecklist && data.sem > 0;
  if (!mostrarSem && data.abertas === 0) return null;
  return (
    <button onClick={() => navigate(destino)} className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-left flex items-start gap-3">
      <ClipboardCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
      <div className="text-xs text-amber-900 space-y-0.5">
        <p className="font-bold text-sm">Checklists — atenção</p>
        {mostrarSem && <p>{data.sem} equipamento(s) operaram em {data.ontem.split("-").reverse().join("/")} sem checklist.</p>}
        {data.abertas > 0 && <p>{data.abertas} ocorrência(s) de NÃO CONFORME aberta(s) para a Manutenção.</p>}
      </div>
    </button>
  );
}
