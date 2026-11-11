/**
 * Dashboards Obras · Disponibilidade e Confiabilidade de equipamentos.
 * Indicadores: disponibilidade operacional, MTBF, MTTR, quantidade de falhas, tempo parado
 * e Produção × Disponibilidade (vibroacabadora em t, fresadora em m).
 * Layout TV: KPIs no cabeçalho, filtros e gráfico à esquerda, tabela fixa à direita.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toSaoPauloISODate } from "@/lib/date-local";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Maximize2, RefreshCw, AlertTriangle } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useUserProfile } from "@/hooks/useUserProfile";
import logoCi from "@/assets/logo-workflux.png";
import {
  agregarPorEquipamento, buscarIndicadores, corDisponibilidade, fmtHoras, fmtPct, produzirXDisponibilidade, somarLinhas,
  type IndicadorLinha, type IndicadoresEquipamento,
} from "@/lib/equipConfiabilidade";
import { fmtNumero, listarProducao, type LinhaProducao } from "@/lib/equipProducao";

const hoje = () => toSaoPauloISODate();
const diasAtras = (n: number) => toSaoPauloISODate(new Date(Date.now() - n * 86_400_000));
const COR = { neutro: "#94a3b8", verde: "#10b981", amarelo: "#f59e0b", vermelho: "#ef4444" } as const;
const TODAS = "";

function Kpi({ label, valor, sub, cor = "#e2e8f0" }: { label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="min-w-[170px] flex-1 rounded-xl border border-white/10 px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none" style={{ color: cor }}>{valor}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export default function DashboardConfiabilidade() {
  const goBack = useSmartBack("/relatorios/dashboards-obras");
  const { profile } = useUserProfile();
  const [params, setParams] = useSearchParams();
  const de = params.get("de") || diasAtras(30);
  const ate = params.get("ate") || hoje();
  const ogs = params.get("ogs") || TODAS;
  const eq = params.get("eq") || TODAS;
  const tipoGrafico = (params.get("tipo") === "fresadora" ? "fresadora" : "vibroacabadora") as "vibroacabadora" | "fresadora";
  const setParam = (k: string, v: string) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const [linhas, setLinhas] = useState<IndicadorLinha[]>([]);
  const [producao, setProducao] = useState<LinhaProducao[]>([]);
  const [erro, setErro] = useState("");
  const [erroProducao, setErroProducao] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizado, setAtualizado] = useState("");
  const [opcoes, setOpcoes] = useState<{ ogs: string[]; equipamentos: { id: string; frota: string }[] }>({ ogs: [], equipamentos: [] });

  const periodoInvalido = !de || !ate || ate < de;

  const carregar = useCallback(async () => {
    if (!profile?.company_id || periodoInvalido) return;
    const filtros = { companyId: profile.company_id, de, ate, ogs: ogs || undefined, equipamentoId: eq || undefined };
    setCarregando(true); setErro(""); setErroProducao("");
    const [ind, prod] = await Promise.allSettled([buscarIndicadores(filtros), listarProducao(filtros)]);
    if (ind.status === "fulfilled") setLinhas(ind.value); else { setLinhas([]); setErro((ind.reason as any)?.message || "Não foi possível calcular os indicadores."); }
    if (prod.status === "fulfilled") setProducao(prod.value); else { setProducao([]); setErroProducao((prod.reason as any)?.message || "Não foi possível carregar a produção."); }
    setAtualizado(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    setCarregando(false);
  }, [profile?.company_id, de, ate, ogs, eq, periodoInvalido]);

  useEffect(() => { carregar(); const t = setInterval(carregar, 300_000); return () => clearInterval(t); }, [carregar]);

  useEffect(() => {
    if (!profile?.company_id) return;
    Promise.all([
      (supabase as any).from("ogs_reference").select("ogs_number").eq("company_id", profile.company_id).order("ogs_number").limit(2000),
      (supabase as any).from("equipamentos").select("id, frota").eq("company_id", profile.company_id).order("frota").limit(2000),
    ]).then(([o, e]: any[]) => setOpcoes({
      ogs: [...new Set<string>((o.data || []).map((x: any) => x.ogs_number))],
      equipamentos: e.data || [],
    }));
  }, [profile?.company_id]);

  const equipamentos = useMemo(() => agregarPorEquipamento(linhas), [linhas]);
  const total = useMemo(() => somarLinhas(linhas), [linhas]);
  const grafico = useMemo(() => produzirXDisponibilidade(equipamentos, producao).filter(p => p.tipo === tipoGrafico), [equipamentos, producao, tipoGrafico]);
  const unidade = tipoGrafico === "vibroacabadora" ? "t" : "m";
  const pendentesGrafico = grafico.reduce((s, g) => s + g.diasPendentes, 0);
  const corDisp = COR[corDisponibilidade(total.disponibilidade)];

  const toggleFullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); };
  const campo = "w-full rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-sm text-slate-100";

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#0f172a" }}>
      <header className="border-b border-white/10 px-6 py-3" style={{ background: "rgba(15,23,42,0.95)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={goBack} aria-label="Voltar" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
            <img src={logoCi} alt="Workflux" className="h-7 opacity-90" />
            <div className="h-8 w-px bg-white/20" />
            <div>
              <h1 className="text-lg font-black leading-none text-white">Dashboards Obras · Disponibilidade e Confiabilidade</h1>
              <p className="mt-0.5 text-xs text-slate-400">Equipamentos · {de.split("-").reverse().join("/")} a {ate.split("-").reverse().join("/")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Atualizado {atualizado || "—"}</span>
            <button onClick={carregar} aria-label="Atualizar" className="rounded-lg p-2 hover:bg-white/10 hover:text-white"><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></button>
            <button onClick={toggleFullscreen} aria-label="Tela cheia" className="rounded-lg p-2 hover:bg-white/10 hover:text-white"><Maximize2 className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Kpi label="Disponibilidade operacional" valor={fmtPct(total.disponibilidade)} cor={corDisp}
            sub={total.disponibilidade === null ? "Cadastre os horários programados" : `${fmtHoras(total.programadoH)} programadas`} />
          <Kpi label="MTBF" valor={fmtHoras(total.mtbf)} sub={total.mtbf === null ? "Sem falhas no período" : "Operação ÷ falhas"} />
          <Kpi label="MTTR" valor={fmtHoras(total.mttr)} sub={total.mttr === null ? "Sem reparos informados" : "Reparo efetivo ÷ falhas reparadas"} />
          <Kpi label="Quantidade de falhas" valor={String(total.falhas)} cor={total.falhas > 0 ? "#f97316" : "#e2e8f0"} />
          <Kpi label="Tempo parado por falhas" valor={fmtHoras(total.paradoH)} cor={total.paradoH > 0 ? "#f97316" : "#e2e8f0"} />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(340px,5fr)_7fr] gap-5 px-6 py-5">
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">Filtros</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">De<input aria-label="De" type="date" className={campo} value={de} onChange={e => setParam("de", e.target.value)} /></label>
              <label className="text-xs text-slate-400">Até<input aria-label="Até" type="date" className={campo} value={ate} onChange={e => setParam("ate", e.target.value)} /></label>
              <label className="text-xs text-slate-400">Obra (OGS)
                <select aria-label="Obra" className={campo} value={ogs} onChange={e => setParam("ogs", e.target.value)}>
                  <option value="">Todas</option>{opcoes.ogs.map(o => <option key={o} value={o}>{o}</option>)}
                </select></label>
              <label className="text-xs text-slate-400">Equipamento
                <select aria-label="Equipamento" className={campo} value={eq} onChange={e => setParam("eq", e.target.value)}>
                  <option value="">Todos</option>{opcoes.equipamentos.map(o => <option key={o.id} value={o.id}>{o.frota}</option>)}
                </select></label>
            </div>
            {periodoInvalido && <p role="alert" className="mt-3 text-xs text-red-400">A data final deve ser igual ou posterior à inicial.</p>}
          </section>

          <section className="flex min-h-[340px] flex-1 flex-col rounded-2xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Produção × Disponibilidade</h2>
              <div className="flex gap-1">
                {(["vibroacabadora", "fresadora"] as const).map(t => (
                  <button key={t} onClick={() => setParam("tipo", t === "vibroacabadora" ? "" : t)} aria-pressed={tipoGrafico === t}
                    className={`rounded-md px-2 py-1 text-xs ${tipoGrafico === t ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400"}`}>
                    {t === "vibroacabadora" ? "Vibroacabadora (t)" : "Fresadora (m)"}
                  </button>
                ))}
              </div>
            </div>
            {erroProducao && <p role="alert" className="text-xs text-red-400">{erroProducao}</p>}
            {!erroProducao && grafico.length === 0 && !carregando && (
              <p className="my-auto text-center text-sm text-slate-500">Sem {tipoGrafico === "vibroacabadora" ? "vibroacabadoras" : "fresadoras"} com dia trabalhado neste filtro.</p>
            )}
            {grafico.length > 0 && (
              <div className="min-h-[260px] flex-1" data-testid="grafico-producao">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="frota" stroke="#94a3b8" fontSize={11} />
                    <YAxis yAxisId="prod" stroke="#94a3b8" fontSize={11} unit={` ${unidade}`} width={64} />
                    <YAxis yAxisId="disp" orientation="right" domain={[0, 100]} stroke="#94a3b8" fontSize={11} unit="%" width={44} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                      formatter={(v: any, n: any) => n === "Produção" ? [`${fmtNumero(Number(v))} ${unidade}`, n] : [v === null || v === undefined ? "Sem horário" : `${Number(v).toFixed(2).replace(".", ",")}%`, n]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    <Bar yAxisId="prod" dataKey="producao" name="Produção" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="disp" dataKey="disponibilidade" name="Disponibilidade" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {pendentesGrafico > 0 && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-yellow-400"><AlertTriangle className="h-3 w-3" /> {pendentesGrafico} dia(s) sem produção lançada: o total mostrado é parcial.</p>
            )}
          </section>
        </aside>

        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Por equipamento</h2>
            <span className="text-[11px] text-slate-500">{equipamentos.length} equipamento(s)</span>
          </div>
          {erro && <p role="alert" className="m-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</p>}
          {!erro && !carregando && equipamentos.length === 0 && !periodoInvalido && (
            <p className="m-auto p-8 text-center text-sm text-slate-500">Nenhum equipamento com diário de trabalho no período e filtros selecionados.</p>
          )}
          {equipamentos.length > 0 && (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Equipamento</th>
                    <th className="px-2 py-2 text-left">Obra(s)</th>
                    <th className="px-2 py-2 text-right">Disponibilidade</th>
                    <th className="px-2 py-2 text-right">MTBF</th>
                    <th className="px-2 py-2 text-right">MTTR</th>
                    <th className="px-2 py-2 text-right">Falhas</th>
                    <th className="px-4 py-2 text-right">Parado</th>
                  </tr>
                </thead>
                <tbody>
                  {equipamentos.map(e => <Linha key={e.equipamentoId} e={e} />)}
                </tbody>
              </table>
            </div>
          )}
          {(total.diasSemHorario > 0 || total.falhasEmAberto > 0 || total.falhasSemReparo > 0) && (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2 text-[11px] text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {total.diasSemHorario > 0 && <span>{total.diasSemHorario} dia(s) de equipamento sem horário programado (fora do cálculo)</span>}
              {total.falhasEmAberto > 0 && <span>{total.falhasEmAberto} falha(s) em aberto (parado até o fim da janela)</span>}
              {total.falhasSemReparo > 0 && <span>{total.falhasSemReparo} falha(s) sem tempo de reparo (fora do MTTR)</span>}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function Linha({ e }: { e: IndicadoresEquipamento }) {
  const cor = COR[corDisponibilidade(e.disponibilidade)];
  return (
    <tr className="border-t border-white/5 text-slate-200">
      <td className="px-4 py-2 font-semibold">{e.frota}</td>
      <td className="px-2 py-2 text-xs text-slate-400">{e.obras.join(", ")}</td>
      <td className="px-2 py-2 text-right font-bold" style={{ color: cor }}>
        {e.disponibilidade === null ? <span className="text-xs font-normal text-slate-500">Sem horário</span> : fmtPct(e.disponibilidade)}
      </td>
      <td className="px-2 py-2 text-right">{e.mtbf === null ? <span className="text-xs text-slate-500">Sem dados</span> : fmtHoras(e.mtbf)}</td>
      <td className="px-2 py-2 text-right">{e.mttr === null ? <span className="text-xs text-slate-500">Sem dados</span> : fmtHoras(e.mttr)}</td>
      <td className="px-2 py-2 text-right">{e.falhas}{e.falhasEmAberto > 0 && <span title="Falha em aberto" className="ml-1 text-orange-400">●</span>}</td>
      <td className="px-4 py-2 text-right">{fmtHoras(e.paradoH)}</td>
    </tr>
  );
}
