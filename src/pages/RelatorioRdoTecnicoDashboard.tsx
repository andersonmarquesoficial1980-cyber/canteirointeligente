import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  ClipboardList,
  AlertTriangle,
  CloudRain,
  Gauge,
  Loader2,
  Download,
  BarChart3,
  Building2,
  Users,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";

interface RdoTecnicoRow {
  id: string;
  ogs_number: string | null;
  data: string;
  status: string;
  equipe: string | null;
  localizacao: string | null;
  engenheiro_id: string | null;
  houve_producao: boolean;
  motivo_sem_producao: string | null;
  outro_motivo_sem_producao: string | null;
  choveu: boolean | null;
  intensidade_chuva: string | null;
  tipo_servico: string | null;
  usina_programada: string | null;
  usina_atendeu: boolean | null;
  usina_nao_atendeu_motivo: string | null;
  equipamentos_conforme: boolean | null;
  equipamentos_nao_conformes: string | null;
  houve_ocorrencia: boolean;
  descricao_ocorrencia: string | null;
  observacoes: string | null;
  fresagem_m2: number | null;
  rap_espumado_m2: number | null;
  binder_ton: number | null;
  cbuq_fx3_ton: number | null;
  gap_ton: number | null;
  bgs_ton: number | null;
  sma_ton: number | null;
  cauq_rima_ton: number | null;
  bm25_ton: number | null;
  egl_ton: number | null;
  rachao_ton: number | null;
  perc_conclusao_via: number | null;
}

interface FiltroOption {
  value: string;
  label: string;
}

type AssuntoTab =
  | "geral"
  | "producao"
  | "meteo"
  | "usina"
  | "equipamentos"
  | "ocorrencias"
  | "sem_producao";

const TAB_META: { id: AssuntoTab; label: string; icon: any }[] = [
  { id: "geral", label: "Visão Geral", icon: BarChart3 },
  { id: "producao", label: "Produção", icon: Activity },
  { id: "meteo", label: "Clima", icon: CloudRain },
  { id: "usina", label: "Usina", icon: Building2 },
  { id: "equipamentos", label: "Equipamentos", icon: Gauge },
  { id: "ocorrencias", label: "Ocorrências", icon: AlertTriangle },
  { id: "sem_producao", label: "Sem Produção", icon: FileText },
];

const STATUS_COLORS: Record<string, string> = {
  enviado: "#22c55e",
  rascunho: "#f59e0b",
};

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function fmtNum(v: number | null | undefined, max = 0) {
  if (v == null || Number.isNaN(v)) return "0";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: max });
}

function csvEscape(val: unknown) {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export default function RelatorioRdoTecnicoDashboard() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const hojeISO = hoje.toISOString().split("T")[0];

  const [dataIni, setDataIni] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hojeISO);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroOgs, setFiltroOgs] = useState("");
  const [filtroEng, setFiltroEng] = useState("");
  const [busca, setBusca] = useState("");

  const [tab, setTab] = useState<AssuntoTab>("geral");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RdoTecnicoRow[]>([]);
  const [ogsOptions, setOgsOptions] = useState<FiltroOption[]>([]);
  const [engMap, setEngMap] = useState<Record<string, string>>({});

  const companyId = profile?.company_id;

  const buscarDados = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data: rdoData, error } = await (supabase as any)
        .from("rdo_engenheiro")
        .select(`
          id, ogs_number, data, status, equipe, localizacao, engenheiro_id,
          houve_producao, motivo_sem_producao, outro_motivo_sem_producao,
          choveu, intensidade_chuva, tipo_servico,
          usina_programada, usina_atendeu, usina_nao_atendeu_motivo,
          equipamentos_conforme, equipamentos_nao_conformes,
          houve_ocorrencia, descricao_ocorrencia, observacoes,
          fresagem_m2, rap_espumado_m2, binder_ton, cbuq_fx3_ton,
          gap_ton, bgs_ton, sma_ton, cauq_rima_ton, bm25_ton, egl_ton, rachao_ton,
          perc_conclusao_via
        `)
        .eq("company_id", companyId)
        .gte("data", dataIni)
        .lte("data", dataFim)
        .order("data", { ascending: false });

      if (error) throw error;

      const lista = ((rdoData || []) as RdoTecnicoRow[]);
      setRows(lista);

      const ogsUniques = [...new Set(lista.map(r => r.ogs_number).filter(Boolean) as string[])];
      setOgsOptions(ogsUniques.sort((a, b) => Number(b) - Number(a)).map(o => ({ value: o, label: `OGS ${o}` })));

      const engIds = [...new Set(lista.map(r => r.engenheiro_id).filter(Boolean) as string[])];
      if (engIds.length > 0) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("user_id,nome,nome_completo")
          .in("user_id", engIds);

        const map: Record<string, string> = {};
        (perfis || []).forEach((p: any) => {
          map[p.user_id] = p.nome_completo || p.nome || "—";
        });
        setEngMap(map);
      } else {
        setEngMap({});
      }
    } catch (e) {
      console.error("[RelatorioRdoTecnicoDashboard]", e);
      setRows([]);
      setOgsOptions([]);
      setEngMap({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) buscarDados();
  }, [companyId]);

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return rows.filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroOgs && r.ogs_number !== filtroOgs) return false;
      if (filtroEng && r.engenheiro_id !== filtroEng) return false;

      if (!q) return true;

      const nomeEng = r.engenheiro_id ? engMap[r.engenheiro_id] || "" : "";
      const texto = [
        r.ogs_number,
        r.equipe,
        r.localizacao,
        r.tipo_servico,
        r.status,
        nomeEng,
        r.motivo_sem_producao,
        r.outro_motivo_sem_producao,
        r.descricao_ocorrencia,
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });
  }, [rows, filtroStatus, filtroOgs, filtroEng, busca, engMap]);

  const kpis = useMemo(() => {
    const total = linhasFiltradas.length;
    const enviados = linhasFiltradas.filter(r => r.status === "enviado").length;
    const rascunhos = linhasFiltradas.filter(r => r.status !== "enviado").length;
    const comProducao = linhasFiltradas.filter(r => r.houve_producao).length;
    const semProducao = total - comProducao;
    const comOcorrencia = linhasFiltradas.filter(r => r.houve_ocorrencia).length;
    const comChuva = linhasFiltradas.filter(r => r.choveu).length;

    const conformeCount = linhasFiltradas.filter(r => r.equipamentos_conforme === true).length;
    const avaliadosEquip = linhasFiltradas.filter(r => r.equipamentos_conforme !== null).length;
    const percConformeEquip = avaliadosEquip > 0 ? (conformeCount / avaliadosEquip) * 100 : 0;

    const toneladas = linhasFiltradas.reduce((acc, r) => acc
      + (r.binder_ton || 0)
      + (r.cbuq_fx3_ton || 0)
      + (r.gap_ton || 0)
      + (r.bgs_ton || 0)
      + (r.sma_ton || 0)
      + (r.cauq_rima_ton || 0)
      + (r.bm25_ton || 0)
      + (r.egl_ton || 0)
      + (r.rachao_ton || 0), 0);

    return {
      total,
      enviados,
      rascunhos,
      comProducao,
      semProducao,
      comOcorrencia,
      comChuva,
      percConformeEquip,
      toneladas,
    };
  }, [linhasFiltradas]);

  const serieStatus = useMemo(() => {
    const enviado = linhasFiltradas.filter(r => r.status === "enviado").length;
    const rascunho = linhasFiltradas.filter(r => r.status !== "enviado").length;
    return [
      { name: "Enviado", value: enviado, color: STATUS_COLORS.enviado },
      { name: "Rascunho", value: rascunho, color: STATUS_COLORS.rascunho },
    ];
  }, [linhasFiltradas]);

  const serieEngenheiro = useMemo(() => {
    const map: Record<string, number> = {};
    linhasFiltradas.forEach((r) => {
      const nome = r.engenheiro_id ? (engMap[r.engenheiro_id] || "Sem nome") : "Sem engenheiro";
      map[nome] = (map[nome] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [linhasFiltradas, engMap]);

  const cardsAssunto = useMemo(() => {
    return {
      producao: linhasFiltradas.filter(r => r.houve_producao),
      meteo: linhasFiltradas.filter(r => r.choveu),
      usina: linhasFiltradas.filter(r => r.usina_programada || r.usina_atendeu === false),
      equipamentos: linhasFiltradas.filter(r => r.equipamentos_conforme !== null),
      ocorrencias: linhasFiltradas.filter(r => r.houve_ocorrencia),
      sem_producao: linhasFiltradas.filter(r => !r.houve_producao),
    };
  }, [linhasFiltradas]);

  const engenheiroOptions = useMemo(() => {
    return Object.entries(engMap)
      .map(([id, nome]) => ({ value: id, label: nome }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [engMap]);

  const exportarCsv = () => {
    const head = [
      "Data",
      "OGS",
      "Status",
      "Engenheiro",
      "Equipe",
      "Localização",
      "Houve produção",
      "Tipo serviço",
      "Usina",
      "Usina atendeu",
      "Equipamentos conformes",
      "Houve ocorrência",
      "Motivo sem produção",
      "Descrição ocorrência",
      "Observações",
    ];

    const linhas = linhasFiltradas.map((r) => [
      fmtDate(r.data),
      r.ogs_number || "",
      r.status,
      r.engenheiro_id ? engMap[r.engenheiro_id] || "" : "",
      r.equipe || "",
      r.localizacao || "",
      r.houve_producao ? "Sim" : "Não",
      r.tipo_servico || "",
      r.usina_programada || "",
      r.usina_atendeu == null ? "" : r.usina_atendeu ? "Sim" : "Não",
      r.equipamentos_conforme == null ? "" : r.equipamentos_conforme ? "Sim" : "Não",
      r.houve_ocorrencia ? "Sim" : "Não",
      !r.houve_producao ? (r.motivo_sem_producao === "Outro" ? (r.outro_motivo_sem_producao || "Outro") : (r.motivo_sem_producao || "")) : "",
      r.descricao_ocorrencia || "",
      r.observacoes || "",
    ]);

    const csv = "\uFEFF" + [head, ...linhas].map((l) => l.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WF_RDO_Tecnico_${dataIni}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTabelaAssunto = () => {
    if (tab === "geral") {
      return (
        <div className="rounded-2xl border bg-white p-4 space-y-4">
          <h3 className="text-sm font-bold">Resumo executivo por assunto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <AssuntoResumoCard titulo="Produção" total={cardsAssunto.producao.length} texto="RDOs com produção lançada" />
            <AssuntoResumoCard titulo="Clima/Chuva" total={cardsAssunto.meteo.length} texto="RDOs com chuva registrada" />
            <AssuntoResumoCard titulo="Usina" total={cardsAssunto.usina.length} texto="RDOs com informação de usina" />
            <AssuntoResumoCard titulo="Equipamentos" total={cardsAssunto.equipamentos.length} texto="RDOs com avaliação de conformidade" />
            <AssuntoResumoCard titulo="Ocorrências" total={cardsAssunto.ocorrencias.length} texto="RDOs com ocorrência reportada" />
            <AssuntoResumoCard titulo="Sem produção" total={cardsAssunto.sem_producao.length} texto="RDOs sem produção no período" />
          </div>
        </div>
      );
    }

    const lista = cardsAssunto[tab] || [];

    return (
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-bold">{TAB_META.find(t => t.id === tab)?.label}</h3>
          <span className="text-xs text-muted-foreground">{lista.length} registro(s)</span>
        </div>

        {lista.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground text-center">Nenhum lançamento para este assunto com os filtros atuais.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">OGS</th>
                  <th className="px-3 py-2">Engenheiro</th>
                  <th className="px-3 py-2">Equipe</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Detalhes do assunto</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const detalhe =
                    tab === "producao"
                      ? `${r.tipo_servico || "Sem tipo"} • Conclusão: ${r.perc_conclusao_via != null ? `${r.perc_conclusao_via}%` : "-"}`
                      : tab === "meteo"
                        ? `Chuva ${r.intensidade_chuva || "não informada"}`
                        : tab === "usina"
                          ? `${r.usina_programada || "Sem usina"} • ${r.usina_atendeu === false ? `Não atendeu (${r.usina_nao_atendeu_motivo || "sem motivo"})` : "Atendeu/sem avaliação"}`
                          : tab === "equipamentos"
                            ? r.equipamentos_conforme
                              ? "Conforme"
                              : `Não conforme: ${r.equipamentos_nao_conformes || "sem descrição"}`
                            : tab === "ocorrencias"
                              ? r.descricao_ocorrencia || "Sem descrição"
                              : !r.houve_producao
                                ? (r.motivo_sem_producao === "Outro"
                                    ? (r.outro_motivo_sem_producao || "Outro")
                                    : (r.motivo_sem_producao || "Sem motivo"))
                                : "-";

                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.data)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.ogs_number || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.engenheiro_id ? (engMap[r.engenheiro_id] || "-" ) : "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.equipe || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === "enviado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {r.status === "enviado" ? "Enviado" : "Rascunho"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{detalhe}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg sticky top-0 z-20">
        <button onClick={() => navigate("/relatorios")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Dashboard RDO Técnico</span>
          <span className="block text-[11px] text-primary-foreground/80">Acompanhamento executivo de Engenharia</span>
        </div>
        <Button onClick={exportarCsv} disabled={linhasFiltradas.length === 0} className="h-9 rounded-xl bg-white text-primary hover:bg-white/90">
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </header>

      <main className="max-w-[1500px] mx-auto p-4 space-y-4 pb-10">
        <div className="rounded-2xl border bg-white p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-semibold">De</label>
              <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-full h-10 rounded-xl border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Até</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full h-10 rounded-xl border px-3 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Status</label>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full h-10 rounded-xl border px-3 text-sm bg-white">
                <option value="">Todos</option>
                <option value="enviado">Enviado</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold">OGS</label>
              <select value={filtroOgs} onChange={(e) => setFiltroOgs(e.target.value)} className="w-full h-10 rounded-xl border px-3 text-sm bg-white">
                <option value="">Todas</option>
                {ogsOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Engenheiro</label>
              <select value={filtroEng} onChange={(e) => setFiltroEng(e.target.value)} className="w-full h-10 rounded-xl border px-3 text-sm bg-white">
                <option value="">Todos</option>
                {engenheiroOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Busca rápida</label>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="OGS, equipe, tipo, motivo..." className="w-full h-10 rounded-xl border px-3 text-sm" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={buscarDados} className="h-9 rounded-xl">
              Atualizar relatório
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-3">Carregando dados do RDO Técnico...</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              <KpiCard icon={ClipboardList} titulo="Total" valor={fmtNum(kpis.total)} cor="text-slate-700" />
              <KpiCard icon={Activity} titulo="Enviados" valor={fmtNum(kpis.enviados)} cor="text-green-700" />
              <KpiCard icon={FileText} titulo="Rascunhos" valor={fmtNum(kpis.rascunhos)} cor="text-amber-700" />
              <KpiCard icon={BarChart3} titulo="Com Produção" valor={fmtNum(kpis.comProducao)} cor="text-blue-700" />
              <KpiCard icon={AlertTriangle} titulo="Sem Produção" valor={fmtNum(kpis.semProducao)} cor="text-red-700" />
              <KpiCard icon={CloudRain} titulo="Com Chuva" valor={fmtNum(kpis.comChuva)} cor="text-cyan-700" />
              <KpiCard icon={Gauge} titulo="Conforme Eq." valor={`${fmtNum(kpis.percConformeEquip, 1)}%`} cor="text-violet-700" />
              <KpiCard icon={Users} titulo="Toneladas" valor={fmtNum(kpis.toneladas, 1)} cor="text-emerald-700" />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-white p-4">
                <h3 className="text-sm font-bold mb-2">Status dos lançamentos</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={serieStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                        {serieStatus.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, name: any) => [`${v}`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  {serieStatus.map((s) => (
                    <div key={s.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}: {s.value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <h3 className="text-sm font-bold mb-2">Top engenheiros por lançamentos</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serieEngenheiro} layout="vertical" margin={{ left: 30, right: 10, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Botões de acompanhamento por assunto do RDO Técnico</p>
              <div className="flex flex-wrap gap-2">
                {TAB_META.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-semibold transition-colors ${tab === id ? "bg-primary text-white border-primary" : "bg-white border-border hover:bg-muted"}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {renderTabelaAssunto()}
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  titulo,
  valor,
  cor,
}: {
  icon: any;
  titulo: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">{titulo}</span>
        <Icon className={`w-4 h-4 ${cor}`} />
      </div>
      <p className="text-2xl font-black mt-1 text-foreground leading-none">{valor}</p>
    </div>
  );
}

function AssuntoResumoCard({ titulo, total, texto }: { titulo: string; total: number; texto: string }) {
  return (
    <div className="rounded-xl border p-3 bg-muted/20">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{titulo}</p>
      <p className="text-2xl font-black mt-1">{total}</p>
      <p className="text-xs text-muted-foreground mt-1">{texto}</p>
    </div>
  );
}
