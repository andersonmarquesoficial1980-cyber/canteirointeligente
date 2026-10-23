import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { concessionDeadline } from "@/lib/vacationPlanning";

interface Period { id: string; periodo_inicio: string; periodo_fim: string; dias_direito: number; dias_gozados: number; dias_coletiva: number; status: string }
interface Manual { id: string; data_inicio: string; data_fim: string; dias: number; tipo: string; fonte: string; observacao: string | null; periodo_inicio: string | null; periodo_fim: string | null; criado_em: string; criado_por: string }
interface Record { id: string; data_inicio: string; data_fim: string; dias: number; tipo: string; workflow_status: string | null; vacation_period_id: string | null; created_at: string; confirmacao_observacao: string | null }
const fmt = (value?: string | null) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";

/** Fatos da ficha: não converte uma programação, mesmo passada, em gozo comprovado. */
export function EmployeeVacationTimeline({ employeeId, companyId, viewerCompanyId, admission }: {
  employeeId: string;
  companyId: string | null;
  viewerCompanyId: string | null;
  admission: string | null;
}) {
  const authorized = Boolean(companyId && viewerCompanyId === companyId);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [history, setHistory] = useState<Manual[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(authorized);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authorized || !companyId || !employeeId) return;
    let valid = true;
    setLoading(true);
    setError("");
    const fetchAll = async <T,>(table: string, columns: string, dateColumn: string): Promise<T[]> => {
      const result: T[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: queryError } = await (supabase as any).from(table).select(columns)
          .eq("company_id", companyId).eq("employee_id", employeeId)
          .order(dateColumn, { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
        if (queryError) throw queryError;
        result.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      return result;
    };
    Promise.all([
      fetchAll<Period>("vacation_periods", "id,periodo_inicio,periodo_fim,dias_direito,dias_gozados,dias_coletiva,status", "periodo_inicio"),
      fetchAll<Manual>("vacation_manual_history", "id,data_inicio,data_fim,dias,tipo,fonte,observacao,periodo_inicio,periodo_fim,criado_em,criado_por", "data_inicio"),
      fetchAll<Record>("vacation_records", "id,data_inicio,data_fim,dias,tipo,workflow_status,vacation_period_id,created_at,confirmacao_observacao", "data_inicio"),
    ]).then(([p, h, r]) => {
      if (!valid) return;
      setPeriods(p); setHistory(h); setRecords(r);
    }).catch((e) => { if (valid) setError(e?.message || "Falha ao carregar férias. Tente novamente."); })
      .finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [authorized, companyId, employeeId]);

  if (!authorized) return <p role="alert" className="text-sm text-destructive">Acesso ao histórico de férias indisponível para esta empresa.</p>;
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Carregando histórico de férias...</p>;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;

  return <section aria-label="Ficha de férias do funcionário" className="space-y-4">
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>Saldo não homologado</strong><p>Admissão: {fmt(admission)}. Gozo informado, programações e contadores antigos precisam ser conciliados pelo RH antes de calcular direito disponível ou aplicar bloqueios.</p>
    </div>
    <div className="rounded-xl border border-border bg-card p-3">
      <h3 className="font-semibold text-sm mb-2">Períodos aquisitivos cadastrados ({periods.length})</h3>
      {!periods.length ? <p className="text-xs text-muted-foreground">Nenhum período cadastrado. Não é possível afirmar saldo ou vencimento.</p> : periods.map(p => <div key={p.id} className="border-t border-border py-2 text-xs">
        <strong>{fmt(p.periodo_inicio)} a {fmt(p.periodo_fim)}</strong> · Prazo concessivo previsto: {fmt(concessionDeadline(p.periodo_fim))}
        <p className="text-muted-foreground">Contador legado: {p.dias_direito}d direito, {p.dias_gozados}d lançados como gozados, {p.dias_coletiva}d coletivos · {p.status}. A conferir com comprovantes.</p>
      </div>)}
    </div>
    <div className="rounded-xl border border-border bg-card p-3">
      <h3 className="font-semibold text-sm mb-2">Férias já gozadas — informadas pelo RH ({history.length})</h3>
      {!history.length ? <p className="text-xs text-muted-foreground">Nenhum gozo passado documentado neste histórico. Isso não significa ausência de férias anteriores.</p> : history.map(h => <div key={h.id} className="border-t border-border py-2 text-xs">
        <strong>{fmt(h.data_inicio)} a {fmt(h.data_fim)}</strong> · {h.dias} dias · {h.tipo === "coletiva" ? "Coletiva" : "Individual"}
        <p>Fonte: {h.fonte} · Aquisitivo: {h.periodo_inicio ? `${fmt(h.periodo_inicio)} a ${fmt(h.periodo_fim)}` : "a conferir"}</p>
        {h.observacao && <p>Observação: {h.observacao}</p>}
        <p className="text-muted-foreground">Registrado em {fmt(h.criado_em)} · Usuário: {h.criado_por || "a identificar"} · Registro: {h.id.slice(0, 8)}</p>
      </div>)}
    </div>
    <div className="rounded-xl border border-border bg-card p-3">
      <h3 className="font-semibold text-sm mb-2">Programação — não comprova gozo ({records.length})</h3>
      {!records.length ? <p className="text-xs text-muted-foreground">Nenhuma programação registrada.</p> : records.map(r => <div key={r.id} className="border-t border-border py-2 text-xs">
        <strong>{fmt(r.data_inicio)} a {fmt(r.data_fim)}</strong> · {r.dias} dias · {r.tipo === "coletiva" ? "Coletiva" : "Individual"}
        <p>Situação: {r.workflow_status === "nao_confirmada" ? "Não ocorrerá" : r.workflow_status === "confirmada" ? "Confirmada para ocorrer" : r.workflow_status === "aguardando_confirmacao" ? "Aguardando confirmação" : "Programada"} · Período: {periods.find(p => p.id === r.vacation_period_id) ? `${fmt(periods.find(p => p.id === r.vacation_period_id)!.periodo_inicio)} a ${fmt(periods.find(p => p.id === r.vacation_period_id)!.periodo_fim)}` : "não vinculado"}</p>
        {r.confirmacao_observacao && <p>Justificativa: {r.confirmacao_observacao}</p>}
      </div>)}
    </div>
  </section>;
}
