import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { toLocalISODate } from "@/lib/date-local";
import { reconcileRdoDiaries, type DiaryDivergence } from "@/lib/rdoDiaryDivergences";
import RdoEquipmentStandardsManager from "@/components/relatorios/RdoEquipmentStandardsManager";

const TITLES: Record<DiaryDivergence["kind"], string> = {
  diario_sem_rdo: "Diário sem RDO correspondente",
  diario_sem_equipamento: "Equipamento do diário fora do RDO",
  rdo_sem_diario: "Equipamento do RDO sem diário",
  operador_fora_efetivo: "Operador do diário fora do efetivo",
};
const fmt = (value: string) => value ? value.split("-").reverse().join("/") : "—";

// Paginação estável: o limite padrão do PostgREST não pode truncar silenciosamente o levantamento.
async function readAll(table: string, fields: string, companyId: string, start: string, end: string, dateField: string) {
  const result: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await (supabase as any).from(table).select(fields)
      .eq("company_id", companyId).gte(dateField, start).lte(dateField, end)
      .order(dateField).order("id").range(offset, offset + 499);
    if (error) throw error;
    result.push(...(data || []));
    if ((data || []).length < 500) return result;
    if (result.length >= 30000) throw new Error("Período muito amplo: refine as datas para garantir levantamento completo.");
  }
}
async function readChildren(table: string, fields: string, ids: string[]) {
  const result: any[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await (supabase as any).from(table).select(fields).in("rdo_id", ids.slice(index, index + 100));
    if (error) throw error;
    result.push(...(data || []));
  }
  return result;
}

export default function RelatorioDivergenciasRdoDiarios() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const [start, setStart] = useState(toLocalISODate());
  const [end, setEnd] = useState(toLocalISODate());
  const [loaded, setLoaded] = useState<{ start: string; end: string } | null>(null);
  const [rows, setRows] = useState<DiaryDivergence[]>([]);
  const [totals, setTotals] = useState({ rdos: 0, diarios: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("todos");
  const [search, setSearch] = useState("");
  const visible = rows.filter(row => (kind === "todos" || row.kind === kind) &&
    (!search.trim() || [row.frota, row.ogs, row.operator, row.encarregado].join(" ").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))));

  async function load() {
    if (!profile?.company_id || !start || !end || start > end) {
      setError("Informe uma data inicial e final válidas e aguarde o carregamento da empresa.");
      return;
    }
    setBusy(true); setError(""); setLoaded(null); setRows([]);
    try {
      const companyId = profile.company_id;
      const [rdos, diaries, ogsResult] = await Promise.all([
        readAll("rdo_diarios", "id,data,obra_nome,ogs_id,turno,encarregado,clima,status_validacao", companyId, start, end, "data"),
        readAll("equipment_diaries", "id,date,equipment_fleet,ogs_number,period,operator_name,operator_id,work_status,status,is_auto", companyId, start, end, "date"),
        (supabase as any).from("ogs_reference").select("id,ogs_number").eq("company_id", companyId),
      ]);
      if (ogsResult.error) throw ogsResult.error;
      const submittedRdos = rdos.filter(r => r.status_validacao !== "rascunho");
      const ids = submittedRdos.map(r => r.id);
      const [equipments, people] = await Promise.all([
        readChildren("rdo_equipamentos", "id,rdo_id,frota,tipo", ids),
        readChildren("rdo_efetivo", "rdo_id,nome,employee_id", ids),
      ]);
      const manualDiaries = diaries.filter(d => d.is_auto !== true);
      setRows(reconcileRdoDiaries(submittedRdos, equipments, manualDiaries, ogsResult.data || [], people));
      setTotals({ rdos: submittedRdos.length, diarios: manualDiaries.filter(d => d.status === "enviado").length });
      setLoaded({ start, end });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar todos os lançamentos.");
    } finally { setBusy(false); }
  }

  function exportCsv() {
    if (!loaded || !visible.length) return;
    const header = ["Data", "Divergência potencial", "OGS", "Turno", "Frota", "Operador", "Encarregado", "Detalhe", "RDO ID", "Diário ID"];
    const lines = visible.map(row => [fmt(row.date), TITLES[row.kind], row.ogs, row.turno, row.frota, row.operator, row.encarregado, row.detail, row.rdoId || "", row.diaryId || ""]);
    const csv = "\uFEFF" + [header, ...lines].map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = href; link.download = `Divergencias_RDO_Diarios_${loaded.start}_${loaded.end}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return <div className="max-w-7xl mx-auto p-4 space-y-5">
    <header className="flex gap-3 items-start">
      <Button variant="outline" size="icon" aria-label="Voltar" onClick={() => goBack()}><ArrowLeft className="w-4 h-4" /></Button>
      <div><h1 className="text-xl font-bold">Divergências RDO × Diários de Equipamento</h1>
        <p className="text-sm text-muted-foreground">Conferência operacional; divergências são indícios, não faltas comprovadas. Nenhum lançamento é alterado aqui.</p></div>
    </header>
    {profile?.company_id && <RdoEquipmentStandardsManager companyId={profile.company_id} userId={profile.user_id} />}
    <section className="rounded-xl border p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Data inicial<Input aria-label="Data inicial" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="text-sm">Data final<Input aria-label="Data final" type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <Button disabled={busy || !profile?.company_id} onClick={load}><Search className="w-4 h-4 mr-2" />{busy ? "Consultando..." : "Consultar"}</Button>
        <Button variant="outline" disabled={!loaded || !visible.length} onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Exportar CSV</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loaded && <p className="text-sm">Período consultado: <strong>{fmt(loaded.start)} a {fmt(loaded.end)}</strong> · RDOs: {totals.rdos} · Diários enviados: {totals.diarios} · Divergências potenciais: <strong>{rows.length}</strong></p>}
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Situação<select aria-label="Situação" className="block h-10 rounded-md border bg-background px-3" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="todos">Todas</option>{Object.entries(TITLES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label className="text-sm">Buscar frota, OGS ou pessoa<Input aria-label="Buscar frota, OGS ou pessoa" value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
    </section>
    {loaded && <section className="space-y-3">
      <p className="text-xs text-muted-foreground">Exibindo {visible.length} de {rows.length} indícios. Cruzamento por empresa, data, OGS, turno e frota. Nome do operador conferido por texto exato; confira abreviações e diários ainda não enviados.</p>
      {!visible.length ? <p className="p-5 rounded-xl border text-sm">Nenhuma divergência encontrada para os filtros. Isso não comprova que todos os lançamentos foram realizados.</p> :
      <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{["Data", "Situação", "OGS / Turno", "Frota", "Operador", "Encarregado", "Conferir"].map(col => <th key={col} className="text-left p-3 whitespace-nowrap">{col}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={`${row.kind}-${row.rdoId}-${row.diaryId}-${row.frota}-${index}`} className="border-t align-top">
        <td className="p-3 whitespace-nowrap">{fmt(row.date)}</td><td className="p-3 font-medium">{TITLES[row.kind]}<p className="font-normal text-xs text-muted-foreground mt-1">{row.detail}</p></td>
        <td className="p-3">{row.ogs || "—"} / {row.turno || "—"}</td><td className="p-3">{row.frota}</td><td className="p-3">{row.operator || "—"}</td><td className="p-3">{row.encarregado || "—"}</td>
        <td className="p-3 whitespace-nowrap">{row.rdoId && <Button variant="link" size="sm" onClick={() => navigate(`/visualizar-rdo/${row.rdoId}`)}>RDO</Button>}{row.diaryId && <Button variant="link" size="sm" onClick={() => navigate(`/visualizar-lancamento/${row.diaryId}`)}>Diário</Button>}</td>
      </tr>)}</tbody></table></div>}
    </section>}
  </div>;
}
