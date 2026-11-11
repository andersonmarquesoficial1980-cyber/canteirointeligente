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
import { norm, saltosMedidor, type SaltoMedidor } from "@/lib/centralOperacoes";
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

// ─── Pendências do Programador ───────────────────────────────────────────────
interface Pendencia { employee_id: string; nome: string; matricula: string | null; funcao: string | null; equipe: string | null; ultima_ogs: string | null; ultima_data: string | null; ultima_equipe_rdo: string | null }

export function AbaPendenciasProgramador({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState(ontemSP());
  const [rows, setRows] = useState<Pendencia[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    const { data: res, error } = await (supabase as any).rpc("programador_pendencias", { p_company_id: companyId, p_data: data });
    if (error) { setRows(null); setErro(/Sem acesso/i.test(error.message) ? "Seu usuário não tem acesso ao WF Programador nesta empresa." : error.message); }
    else setRows(res || []);
    setCarregando(false);
  }, [companyId, data]);
  useEffect(() => { carregar(); }, [carregar]);

  const porEquipe = useMemo(() => {
    const m = new Map<string, Pendencia[]>();
    for (const r of rows || []) (m.get(r.equipe || "Sem equipe") || m.set(r.equipe || "Sem equipe", []).get(r.equipe || "Sem equipe")!).push(r);
    return [...m].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  return (
    <section className="space-y-3">
      <Barra data={data} setData={setData} carregando={carregando} onAtualizar={carregar}>
        <Button onClick={() => navigate("/programador/pendencias")}>Alocar no WF Programador →</Button>
      </Barra>
      <p className="text-xs text-muted-foreground">Funcionários próprios ativos que <b>não aparecem em nenhum RDO</b> do dia e <b>não foram alocados</b> pelo Programador. É a mesma lista da tela de Pendências do Programador; a alocação continua sendo feita lá.</p>
      {erro && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erro}</p>}
      {rows && <p className="text-sm"><b>{rows.length}</b> pendência(s) em {fmt(data)}.</p>}
      {rows && rows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {porEquipe.map(([equipe, lista]) => (
            <div key={equipe} className="rounded-xl border bg-card p-3">
              <h3 className="mb-2 flex justify-between text-sm font-semibold"><span>{equipe}</span><span>{lista.length}</span></h3>
              <ul className="space-y-1 text-sm">
                {lista.map((p) => (
                  <li key={p.employee_id} className="flex justify-between gap-2 border-t pt-1">
                    <span>{p.nome}{p.funcao ? <span className="text-muted-foreground"> · {p.funcao}</span> : null}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{p.ultima_ogs ? `últ. ${p.ultima_ogs} (${fmt(p.ultima_data)})` : "sem RDO em 30d"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {rows && rows.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhuma pendência neste dia.</p>}
    </section>
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
