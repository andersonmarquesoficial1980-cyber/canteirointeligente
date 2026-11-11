/**
 * Abas "sob demanda" da Central de Operações (consultam só ao abrir / trocar a data):
 *  - Pendências do Programador: RPC programador_pendencias (mesma regra do WF Programador).
 *  - Divergências RDO × Diário: reconcileRdoDiaries (mesma regra do relatório de Divergências).
 * Somente leitura; nenhuma alteração é feita aqui.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { addDaysLocalISO, toSaoPauloISODate } from "@/lib/date-local";
import { reconcileRdoDiaries, type DiaryDivergence } from "@/lib/rdoDiaryDivergences";
import { cruzarTransportes, norm, saltosMedidor, type Cruzamento, type SaltoMedidor, type TipoCruzamento } from "@/lib/centralOperacoes";
import type { MeterDiary } from "@/lib/equipmentDiaryAudit";

const fmt = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
export const ontemSP = () => addDaysLocalISO(new Date(`${toSaoPauloISODate()}T12:00:00`), -1);

async function readAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < 1000) return out;
    if (out.length >= 30000) throw new Error("Período muito amplo.");
  }
}

function Barra({ data, setData, carregando, onAtualizar, children }: { data: string; setData: (d: string) => void; carregando: boolean; onAtualizar: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
      <label className="text-sm">Dia<Input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} /></label>
      <Button variant="outline" size="icon" aria-label="Atualizar aba" onClick={onAtualizar}><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
      {children}
    </div>
  );
}

// ─── Divergências RDO × Diário ───────────────────────────────────────────────
const TITULOS: Record<DiaryDivergence["kind"], string> = {
  diario_sem_rdo: "Diário sem RDO", diario_sem_equipamento: "Equipamento do diário fora do RDO",
  rdo_sem_diario: "Equipamento no RDO sem diário", operador_fora_efetivo: "Operador fora do efetivo",
};
const COR: Record<DiaryDivergence["kind"], string> = { diario_sem_rdo: "#ef4444", diario_sem_equipamento: "#f59e0b", rdo_sem_diario: "#3b82f6", operador_fora_efetivo: "#8b5cf6" };

export function AbaDivergencias({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState(ontemSP());
  const [rows, setRows] = useState<DiaryDivergence[] | null>(null);
  const [totais, setTotais] = useState({ rdos: 0, diarios: 0 });
  const [kind, setKind] = useState("todos");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const sb = supabase as any;
      const [rdos, diarios, ogs] = await Promise.all([
        readAll((f, t) => sb.from("rdo_diarios").select("id,data,obra_nome,ogs_id,turno,encarregado,clima,status_validacao").eq("company_id", companyId).eq("data", data).order("id").range(f, t)),
        readAll((f, t) => sb.from("equipment_diaries").select("id,date,equipment_fleet,ogs_number,period,operator_name,operator_id,work_status,status,is_auto").eq("company_id", companyId).eq("date", data).order("id").range(f, t)),
        readAll((f, t) => sb.from("ogs_reference").select("id,ogs_number").eq("company_id", companyId).order("id").range(f, t)),
      ]);
      const enviados = rdos.filter((r: any) => norm(r.status_validacao) !== "RASCUNHO");
      const ids: string[] = enviados.map((r: any) => r.id);
      const filhos = async (tabela: string, campos: string) => {
        const out: any[] = [];
        for (let i = 0; i < ids.length; i += 100) out.push(...await readAll((f, t) => sb.from(tabela).select(campos).in("rdo_id", ids.slice(i, i + 100)).order("id").range(f, t)));
        return out;
      };
      const [equips, pessoas] = await Promise.all([filhos("rdo_equipamentos", "id,rdo_id,frota,tipo"), filhos("rdo_efetivo", "id,rdo_id,nome,employee_id")]);
      const manuais = diarios.filter((d: any) => d.is_auto !== true);
      setRows(reconcileRdoDiaries(enviados, equips, manuais, ogs, pessoas));
      setTotais({ rdos: enviados.length, diarios: manuais.filter((d: any) => d.status === "enviado").length });
    } catch (e) { setRows(null); setErro(e instanceof Error ? e.message : "Falha ao consultar divergências."); }
    setCarregando(false);
  }, [companyId, data]);
  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = (rows || []).filter((r) => kind === "todos" || r.kind === kind);
  const contagem = useMemo(() => (rows || []).reduce<Record<string, number>>((m, r) => (m[r.kind] = (m[r.kind] || 0) + 1, m), {}), [rows]);

  return (
    <section className="space-y-3">
      <Barra data={data} setData={setData} carregando={carregando} onAtualizar={carregar}>
        <label className="text-sm">Tipo
          <select className="block h-10 rounded-md border bg-background px-3" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="todos">Todos ({rows?.length ?? 0})</option>
            {(Object.keys(TITULOS) as DiaryDivergence["kind"][]).map((k) => <option key={k} value={k}>{TITULOS[k]} ({contagem[k] || 0})</option>)}
          </select></label>
      </Barra>
      <p className="text-xs text-muted-foreground">Cruza RDOs enviados × diários manuais enviados do dia (mesma OGS, turno e frota). São <b>indícios</b>, não faltas comprovadas. RDOs: {totais.rdos} · Diários: {totais.diarios}. Para período maior use o relatório "Divergências RDO × Diários".</p>
      {erro && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erro}</p>}
      {rows && visiveis.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhuma divergência para o dia e filtro.</p>}
      {visiveis.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>{["Situação", "OGS / Turno", "Frota", "Operador", "Encarregado", "Abrir"].map((c) => <th key={c} className="p-2.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
            <tbody>
              {visiveis.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: COR[r.kind] + "22", color: COR[r.kind] }}>{TITULOS[r.kind]}</span><p className="mt-1 text-xs text-muted-foreground">{r.detail}</p></td>
                  <td className="p-2.5">{r.ogs || "—"} / {r.turno || "—"}</td><td className="p-2.5 font-medium">{r.frota}</td>
                  <td className="p-2.5">{r.operator || "—"}</td><td className="p-2.5">{r.encarregado || "—"}</td>
                  <td className="p-2.5 whitespace-nowrap">
                    {r.rdoId && <Button variant="link" size="sm" onClick={() => navigate(`/visualizar-rdo/${r.rdoId}`)}>RDO</Button>}
                    <Button variant="link" size="sm" onClick={() => navigate(`/relatorios/equipamento/${encodeURIComponent(r.frota)}`)}>Equip.</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Medidores ───────────────────────────────────────────────────────────────
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export function AbaMedidores({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [dias, setDias] = useState(15);
  const [tolKm, setTolKm] = useState(50);
  const [tolHoras, setTolHoras] = useState(5);
  const [tipo, setTipo] = useState("todos");
  const [linhas, setLinhas] = useState<MeterDiary[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const ini = addDaysLocalISO(new Date(`${toSaoPauloISODate()}T12:00:00`), -(60)); // base de 60d para achar o lançamento anterior
      const rows = await readAll<any>((f, t) => (supabase as any).from("equipment_diaries")
        .select("id,equipment_fleet,operator_name,date,period,created_at,status,is_auto,meter_initial,meter_final,odometer_initial,odometer_final")
        .eq("company_id", companyId).gte("date", ini).order("date").order("id").range(f, t));
      setLinhas(rows.map((r) => ({ ...r, meter_initial: num(r.meter_initial), meter_final: num(r.meter_final), odometer_initial: num(r.odometer_initial), odometer_final: num(r.odometer_final) })));
    } catch (e) { setLinhas(null); setErro(e instanceof Error ? e.message : "Falha ao consultar medidores."); }
    setCarregando(false);
  }, [companyId]);
  useEffect(() => { carregar(); }, [carregar]);

  const saltos: SaltoMedidor[] = useMemo(() => {
    if (!linhas) return [];
    const desde = addDaysLocalISO(new Date(`${toSaoPauloISODate()}T12:00:00`), -dias);
    return saltosMedidor(linhas, desde, tolHoras, tolKm);
  }, [linhas, dias, tolKm, tolHoras]);
  const vis = saltos.filter((x) => tipo === "todos" || x.tipo === tipo);
  const un = (x: SaltoMedidor) => (x.medidor === "odometro" ? "km" : "h");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
        <label className="text-sm">Período
          <select className="block h-10 rounded-md border bg-background px-3" value={dias} onChange={(e) => setDias(+e.target.value)}>{[7, 15, 30].map((n) => <option key={n} value={n}>últimos {n} dias</option>)}</select></label>
        <label className="text-sm">Tipo
          <select className="block h-10 rounded-md border bg-background px-3" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="todos">Todos ({saltos.length})</option>
            <option value="regressao">Medidor voltou ({saltos.filter((x) => x.tipo === "regressao").length})</option>
            <option value="salto">Rodou sem diário ({saltos.filter((x) => x.tipo === "salto").length})</option></select></label>
        <label className="text-sm">Ignorar até (km)<Input type="number" min={0} className="w-24" value={tolKm} onChange={(e) => setTolKm(Math.max(0, +e.target.value))} /></label>
        <label className="text-sm">Ignorar até (h)<Input type="number" min={0} className="w-24" value={tolHoras} onChange={(e) => setTolHoras(Math.max(0, +e.target.value))} /></label>
        <Button variant="outline" size="icon" aria-label="Atualizar aba" onClick={carregar}><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
      </div>
      <p className="text-xs text-muted-foreground">Compara o <b>medidor final</b> de um diário com o <b>inicial</b> do próximo, por frota (só diários enviados e manuais). <b>Medidor voltou</b> = provável erro de digitação (ex.: zero a mais). <b>Rodou sem diário</b> = o equipamento andou/trabalhou entre dois lançamentos; pode ser diário faltando. Indícios, não prova.</p>
      {erro && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erro}</p>}
      {linhas && vis.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhum salto acima da tolerância no período.</p>}
      {vis.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>{["Frota", "Situação", "Anterior", "Atual", "Diferença", "Operador (atual)", "Abrir"].map((c) => <th key={c} className="p-2.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
            <tbody>
              {vis.map((x, i) => {
                const cor = x.tipo === "regressao" ? "#ef4444" : "#f59e0b";
                return (
                  <tr key={i} className="border-t">
                    <td className="p-2.5 font-medium">{x.frota}</td>
                    <td className="p-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: cor + "22", color: cor }}>{x.tipo === "regressao" ? "Medidor voltou" : "Rodou sem diário"}</span></td>
                    <td className="p-2.5">{fmt(x.dataAnterior)}: fim {fmtNum(x.finalAnterior)} {un(x)}</td>
                    <td className="p-2.5">{fmt(x.dataAtual)}: início {fmtNum(x.inicialAtual)} {un(x)}</td>
                    <td className="p-2.5 font-semibold" style={{ color: cor }}>{x.diferenca > 0 ? "+" : ""}{fmtNum(x.diferenca)} {un(x)}</td>
                    <td className="p-2.5">{x.operador || "—"}</td>
                    <td className="p-2.5"><Button variant="link" size="sm" onClick={() => navigate(`/relatorios/equipamento/${encodeURIComponent(x.frota)}`)}>Equip.</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


// ─── Cruzamento Transporte × Diário × RDO ────────────────────────────────────
const CRUZ_TITULO: Record<TipoCruzamento, string> = {
  sem_registro_no_destino: "Transportado, sem registro no destino",
  mudou_de_obra_sem_transporte: "Mudou de obra sem transporte",
};
const CRUZ_COR: Record<TipoCruzamento, string> = { sem_registro_no_destino: "#ef4444", mudou_de_obra_sem_transporte: "#f59e0b" };

export function AbaCruzamento({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [dias, setDias] = useState(15);
  const [tipo, setTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [rows, setRows] = useState<Cruzamento[] | null>(null);
  const [totais, setTotais] = useState({ transportes: 0, internos: 0 });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const sb = supabase as any; const hoje = toSaoPauloISODate();
      const desde = addDaysLocalISO(new Date(`${hoje}T12:00:00`), -dias);
      const base = addDaysLocalISO(new Date(`${hoje}T12:00:00`), -(dias + 30)); // diários anteriores p/ comparar
      const [trs, diarios, rdos, ogs] = await Promise.all([
        readAll<any>((f, t) => sb.from("equipamento_transportes").select("id,equipment_fleet,data,origem_ogs,origem_descricao,destino_ogs,destino_descricao,transportador_nome").eq("company_id", companyId).gte("data", base).order("id").range(f, t)),
        readAll<any>((f, t) => sb.from("equipment_diaries").select("id,equipment_fleet,date,ogs_number,status,is_auto,meter_initial,meter_final,odometer_initial,odometer_final").eq("company_id", companyId).gte("date", base).order("date").order("id").range(f, t)),
        readAll<any>((f, t) => sb.from("rdo_diarios").select("id,data,ogs_id,obra_nome,status_validacao").eq("company_id", companyId).gte("data", desde).order("id").range(f, t)),
        readAll<any>((f, t) => sb.from("ogs_reference").select("id,ogs_number").eq("company_id", companyId).order("id").range(f, t)),
      ]);
      const enviados = rdos.filter((r) => norm(r.status_validacao) !== "RASCUNHO");
      const ogsPorId = new Map(ogs.map((o) => [o.id, o.ogs_number]));
      const rdoInfo = new Map(enviados.map((r) => [r.id, { data: r.data as string, ogs: (ogsPorId.get(r.ogs_id) || r.obra_nome || "") as string }]));
      const ids = [...rdoInfo.keys()]; const eqs: any[] = [];
      for (let i = 0; i < ids.length; i += 100) eqs.push(...await readAll<any>((f, t) => sb.from("rdo_equipamentos").select("id,rdo_id,frota").in("rdo_id", ids.slice(i, i + 100)).order("id").range(f, t)));
      const rdoEquip = eqs.map((e) => ({ ...rdoInfo.get(e.rdo_id)!, frota: e.frota })).filter((e) => e.data);
      const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
      const trN = trs.map((t) => ({ ...t, meter_no_transporte: null, odometer_no_transporte: null }));
      const diN = diarios.map((d) => ({ ...d, meter_initial: num(d.meter_initial), meter_final: num(d.meter_final), odometer_initial: num(d.odometer_initial), odometer_final: num(d.odometer_final) }));
      setRows(cruzarTransportes(trN, diN, rdoEquip, desde, hoje));
      setTotais({ transportes: trN.filter((t) => t.data >= desde).length, internos: trN.filter((t) => t.data >= desde && /OUTROS/i.test(t.origem_ogs || "") && /OUTROS/i.test(t.destino_ogs || "")).length });
    } catch (e) { setRows(null); setErro(e instanceof Error ? e.message : "Falha ao cruzar lançamentos."); }
    setCarregando(false);
  }, [companyId, dias]);
  useEffect(() => { carregar(); }, [carregar]);

  const q = norm(busca);
  const vis = (rows || []).filter((r) => (tipo === "todos" || r.tipo === tipo) && (!q || norm(`${r.frota} ${r.obra} ${r.transportador}`).includes(q)));
  const cont = (t: TipoCruzamento) => (rows || []).filter((r) => r.tipo === t).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
        <label className="text-sm">Período
          <select className="block h-10 rounded-md border bg-background px-3" value={dias} onChange={(e) => setDias(+e.target.value)}>{[7, 15, 30].map((n) => <option key={n} value={n}>últimos {n} dias</option>)}</select></label>
        <label className="text-sm">Tipo
          <select className="block h-10 rounded-md border bg-background px-3" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="todos">Todos ({rows?.length ?? 0})</option>
            {(Object.keys(CRUZ_TITULO) as TipoCruzamento[]).map((k) => <option key={k} value={k}>{CRUZ_TITULO[k]} ({cont(k)})</option>)}</select></label>
        <label className="text-sm">Buscar<Input className="w-48" placeholder="frota, obra, motorista" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <Button variant="outline" size="icon" aria-label="Atualizar aba" onClick={carregar}><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
      </div>
      <div className="space-y-1 rounded-xl border bg-muted/30 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como ler esta tela</p>
        <p>Compara o que o <b>motorista da carreta</b> registrou no transporte com os <b>diários de equipamento</b> e os <b>RDOs</b>. São indícios para conferir, não faltas comprovadas.</p>
        <ul className="ml-4 list-disc">
          <li><b>Transportado, sem registro no destino</b> — a carreta levou o equipamento para a obra X, mas não há diário nem RDO dele nessa obra em até 2 dias.</li>
          <li><b>Mudou de obra sem transporte</b> — o equipamento lançou diário numa obra e depois em outra, sem nenhum transporte registrado entre elas.</li>
        </ul>
        <p>Transporte com origem e destino "Outros" (mudança de trecho dentro da mesma obra) <b>não gera alerta</b>{rows ? ` — ${totais.internos} de ${totais.transportes} transportes do período` : ""}.</p>
      </div>
      {erro && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erro}</p>}
      {rows && vis.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhuma divergência no período e filtro.</p>}
      {vis.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>{["Data", "Frota", "Situação", "Obra", "Motorista da carreta", "Abrir"].map((c) => <th key={c} className="p-2.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
            <tbody>
              {vis.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="whitespace-nowrap p-2.5">{fmt(r.data)}</td><td className="p-2.5 font-medium">{r.frota}</td>
                  <td className="p-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: CRUZ_COR[r.tipo] + "22", color: CRUZ_COR[r.tipo] }}>{CRUZ_TITULO[r.tipo]}</span><p className="mt-1 text-xs text-muted-foreground">{r.detalhe}</p></td>
                  <td className="p-2.5">{r.obra || "—"}</td><td className="p-2.5">{r.transportador || "—"}</td>
                  <td className="p-2.5"><Button variant="link" size="sm" onClick={() => navigate(`/relatorios/equipamento/${encodeURIComponent(r.frota)}`)}>Equip.</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
