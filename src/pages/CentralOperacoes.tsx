/**
 * Central de Operações (WF Relatórios) — painel único: equipamentos, pessoas e obras.
 * Rota: /relatorios/central-operacoes  (modo TV: botão TV → tela cheia + rotação automática)
 * Regras de cálculo: src/lib/centralOperacoes.ts (fonte única; não recalcular aqui).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Maximize2, Minimize2, Pause, Play, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { addDaysLocalISO, toSaoPauloISODate } from "@/lib/date-local";
import { AbaDivergencias, AbaMedidores, AbaPendenciasProgramador } from "@/components/relatorios/CentralOperacoesAbas";
import {
  agruparPorLocal, FONTE_LABEL, norm, ogsKey, resumoCentral, situacaoEquipamentos, situacaoObras, situacaoPessoas,
  type DiarioLite, type EmployeeBase, type EquipamentoBase, type EquipamentoSituacao, type OgsLite,
  type PessoaSituacao, type PresencaRdo, type RdoLite, type StatusOperacao, type TransporteLite,
} from "@/lib/centralOperacoes";

const JANELA_DIAS = 30;
const TABS = [
  { id: "hoje", label: "Hoje" }, { id: "equipamentos", label: "Equipamentos" },
  { id: "pessoas", label: "Pessoas" }, { id: "obras", label: "Obras" },
  { id: "pendencias", label: "Pendências do Programador" }, { id: "divergencias", label: "Divergências RDO × Diário" }, { id: "medidores", label: "Horímetro / Odômetro" },
] as const;
const ABAS_TV: TabId[] = ["hoje", "equipamentos", "pessoas", "obras"]; // abas sob demanda não entram na rotação da TV
type TabId = (typeof TABS)[number]["id"];

const STATUS_LABEL: Record<StatusOperacao, string> = {
  trabalhando: "Trabalhando", disposicao: "Disposição", manutencao: "Manutenção", transporte: "Em trânsito",
  folga: "Folga", patio: "Pátio/Base", sem_info: "Sem informação",
};
const STATUS_COR: Record<StatusOperacao, string> = {
  trabalhando: "#10b981", disposicao: "#3b82f6", manutencao: "#ef4444", transporte: "#f59e0b",
  folga: "#8b5cf6", patio: "#64748b", sem_info: "#94a3b8",
};
const fmtData = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const fmtDias = (n: number | null) => (n === null ? "nunca" : n === 0 ? "hoje" : n === 1 ? "ontem" : `há ${n} dias`);

// Paginação estável: o limite padrão do PostgREST (1000) não pode truncar o painel em silêncio.
async function readAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < 1000) return out;
    if (out.length >= 50000) throw new Error("Volume de dados acima do limite do painel.");
  }
}

interface Dados {
  equips: EquipamentoBase[]; diarios: DiarioLite[]; transportes: TransporteLite[];
  pessoas: EmployeeBase[]; presencas: PresencaRdo[]; rdos: RdoLite[]; ogs: OgsLite[];
}

const numDiario = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function KpiCard({ valor, rotulo, tom, onClick }: { valor: string | number; rotulo: string; tom?: "red" | "yellow" | "green"; onClick?: () => void }) {
  const cor = tom === "red" ? "#ef4444" : tom === "yellow" ? "#f59e0b" : tom === "green" ? "#10b981" : undefined;
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className="rounded-xl border bg-card p-3 text-left disabled:cursor-default enabled:hover:border-primary/50"
      style={cor ? { borderColor: cor + "99" } : undefined}>
      <div className="text-2xl font-bold" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
    </button>
  );
}

function Pill({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: cor + "22", color: cor }}>{children}</span>;
}

function Ajuda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border bg-muted/30 p-3 text-sm [&_p]:mt-1.5 [&_ul]:mt-1.5" open>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</summary>
      <div className="mt-2 space-y-1">{children}</div>
    </details>
  );
}

function Tabela({ cols, children, vazio }: { cols: string[]; children: React.ReactNode; vazio?: string }) {
  const n = Array.isArray(children) ? children.length : children ? 1 : 0;
  if (!n) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">{vazio || "Nada a mostrar."}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50"><tr>{cols.map((c) => <th key={c} className="p-2.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function CentralOperacoes() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [atualizado, setAtualizado] = useState("");
  const [hoje, setHoje] = useState(toSaoPauloISODate());
  const [aba, setAba] = useState<TabId>("hoje");
  const [limiteEq, setLimiteEq] = useState(2);
  const [limitePe, setLimitePe] = useState(4);
  const [busca, setBusca] = useState("");
  const [soAlertas, setSoAlertas] = useState(true);
  const [incluirAdm, setIncluirAdm] = useState(false);
  const [porObra, setPorObra] = useState(false);
  const [mostrarIsentos, setMostrarIsentos] = useState(false);
  const [tv, setTv] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [soManut, setSoManut] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    const companyId = profile?.company_id;
    if (!companyId) return;
    setCarregando(true); setErro("");
    try {
      const dia = toSaoPauloISODate();
      const ini = addDaysLocalISO(new Date(`${dia}T12:00:00`), -JANELA_DIAS);
      const sb = supabase as any;
      const [equips, diarios, transportes, pessoas, rdos, ogs, rdoTec, perfis, alocacoes] = await Promise.all([
        readAll<EquipamentoBase>((f, t) => sb.from("equipamentos").select("id,frota,nome,tipo,status,setor,local_atual").eq("company_id", companyId).order("frota").range(f, t)),
        readAll<DiarioLite>((f, t) => sb.from("equipment_diaries").select("equipment_fleet,date,work_status,ogs_number,operator_name,operator_id,operator_solo,operator_solo_id,status,is_auto,period").eq("company_id", companyId).gte("date", ini).order("date").order("id").range(f, t)),
        readAll<TransporteLite>((f, t) => sb.from("equipamento_transportes").select("equipment_fleet,data,origem_ogs,destino_ogs").eq("company_id", companyId).gte("data", ini).order("data").order("id").range(f, t)),
        readAll<EmployeeBase>((f, t) => sb.from("employees").select("id,name,matricula,role,equipe,centro_custo,origem,status,data_admissao,data_demissao").eq("company_id", companyId).eq("origem", "PROPRIO").eq("status", "ativo").order("name").range(f, t)),
        readAll<RdoLite & { id: string; encarregado?: string | null; encarregado_employee_id?: string | null }>((f, t) => sb.from("rdo_diarios").select("id,data,obra_nome,ogs_id,equipe,encarregado,encarregado_employee_id,status_validacao,tipo_rdo").eq("company_id", companyId).gte("data", ini).order("data").order("id").range(f, t)),
        readAll<OgsLite>((f, t) => sb.from("ogs_reference").select("id,ogs_number,client_name,location_address").eq("company_id", companyId).order("id").range(f, t)),
        // Fontes extras de presença: se uma falhar (permissão), a Central continua com as demais.
        readAll<{ engenheiro_id: string; data: string; ogs_number: string | null }>((f, t) => sb.from("rdo_engenheiro").select("engenheiro_id,data,ogs_number").eq("company_id", companyId).gte("data", ini).order("id").range(f, t)).catch(() => [] as any[]),
        readAll<{ user_id: string; nome_completo: string | null }>((f, t) => sb.from("profiles").select("user_id,nome_completo").eq("company_id", companyId).order("user_id").range(f, t)).catch(() => [] as any[]),
        readAll<{ employee_id: string; data: string; tipo: string; ogs_number: string | null }>((f, t) => sb.from("alocacao_diaria").select("employee_id,data,tipo,ogs_number").eq("company_id", companyId).gte("data", ini).order("id").range(f, t)).catch(() => [] as any[]),
      ]);
      // Presença de pessoas: só RDO enviado e não automático (RDO automático gera presença presumida).
      const validos = rdos.filter((r) => norm(r.status_validacao) !== "RASCUNHO" && norm(r.tipo_rdo) !== "AUTOMATICO");
      const rdoPorId = new Map(validos.map((r) => [r.id, r]));
      const ogsPorId = new Map(ogs.map((o) => [o.id, o]));
      const ids = validos.map((r) => r.id);
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
      const efetivoPartes = await Promise.all(chunks.map((c) =>
        readAll<{ rdo_id: string; nome: string | null; employee_id: string | null }>((f, t) => sb.from("rdo_efetivo").select("rdo_id,nome,employee_id").in("rdo_id", c).order("id").range(f, t))));
      const presencas: PresencaRdo[] = [];
      for (const ef of efetivoPartes.flat()) {
        const r = rdoPorId.get(ef.rdo_id); if (!r || !r.data) continue;
        const o = r.ogs_id ? ogsPorId.get(r.ogs_id) : undefined;
        const base = { data: r.data, obra: r.obra_nome, ogs: ogsKey(o?.ogs_number) || ogsKey(r.obra_nome), equipe: r.equipe || "" };
        const nomes = (ef.nome || "").split("|||").map((n) => n.trim()).filter(Boolean);
        if (!nomes.length) presencas.push({ employee_id: ef.employee_id, nome: null, ...base });
        nomes.forEach((n, i) => presencas.push({ employee_id: i === 0 ? ef.employee_id : null, nome: n, ...base }));
      }
      // Encarregado do RDO também é presença.
      for (const r of validos) {
        if (!r.data) continue;
        const o = r.ogs_id ? ogsPorId.get(r.ogs_id) : undefined;
        const k = ogsKey(o?.ogs_number) || ogsKey(r.obra_nome);
        if (r.encarregado_employee_id || r.encarregado) presencas.push({ employee_id: r.encarregado_employee_id || null, nome: r.encarregado || null, data: r.data, obra: r.obra_nome, ogs: k, equipe: r.equipe || "", fonte: "rdo" });
      }
      // Operadores e motoristas: diário de equipamento enviado e manual.
      for (const d of diarios as any[]) {
        if (d.is_auto === true || norm(d.status) !== "ENVIADO" || !d.date) continue;
        const id = d.operator_id || d.operator_solo_id || null; const nome = numDiario(d.operator_name) || numDiario(d.operator_solo) || null;
        if (id || nome) presencas.push({ employee_id: id, nome, data: d.date, obra: d.ogs_number || "", ogs: ogsKey(d.ogs_number), equipe: "", fonte: "diario" });
      }
      // Engenheiros: RDO Técnico (engenheiro_id = usuário; casa com o cadastro pelo nome do perfil).
      const nomePerfil = new Map<string, string | null>(perfis.map((p): [string, string | null] => [p.user_id, p.nome_completo]));
      for (const t of rdoTec) { const nome = nomePerfil.get(t.engenheiro_id); if (nome && t.data) presencas.push({ employee_id: null, nome, data: t.data, obra: t.ogs_number || "", ogs: ogsKey(t.ogs_number), equipe: "", fonte: "rdo_tecnico" }); }
      // Programador: qualquer alocação (obra, base, folga, férias, atestado...) justifica a pessoa.
      for (const a of alocacoes) presencas.push({ employee_id: a.employee_id, nome: null, data: a.data, obra: a.tipo === "obra" ? a.ogs_number || "" : `(${a.tipo})`, ogs: a.tipo === "obra" ? ogsKey(a.ogs_number) : "", equipe: "", fonte: "programador" });
      setDados({ equips, diarios, transportes, pessoas, presencas, rdos, ogs });
      setHoje(dia);
      setAtualizado(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a Central de Operações.");
    } finally { setCarregando(false); }
  }, [profile?.company_id]);

  useEffect(() => { carregar(); const t = setInterval(carregar, 60_000); return () => clearInterval(t); }, [carregar]);

  // Modo TV: rotaciona as abas a cada 20s.
  useEffect(() => {
    if (!tv || pausado) return;
    const t = setInterval(() => setAba((a) => ABAS_TV[(Math.max(0, ABAS_TV.indexOf(a)) + 1) % ABAS_TV.length]), 20_000);
    return () => clearInterval(t);
  }, [tv, pausado]);
  useEffect(() => {
    if (!tv) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setPausado((p) => !p); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tv]);
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setTv(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const alternarTv = () => {
    if (!tv) { setTv(true); setPausado(false); setSoManut(false); setSoAlertas(true); raiz.current?.requestFullscreen?.().catch(() => {}); }
    else { setTv(false); if (document.fullscreenElement) document.exitFullscreen?.(); }
  };

  const equipamentos = useMemo(() => dados ? situacaoEquipamentos(dados.equips, dados.diarios, dados.transportes, hoje, limiteEq) : [], [dados, hoje, limiteEq]);
  const pessoas = useMemo(() => dados ? situacaoPessoas(dados.pessoas, dados.presencas, hoje, limitePe, incluirAdm) : [], [dados, hoje, limitePe, incluirAdm]);
  const pessoasPorOgsHoje = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const p of dados?.presencas || []) if (p.data === hoje && p.ogs && (p.fonte || "rdo") === "rdo") (m.get(p.ogs) || m.set(p.ogs, new Set()).get(p.ogs)!).add(p.employee_id || norm(p.nome));
    return new Map([...m].map(([k, v]) => [k, v.size]));
  }, [dados, hoje]);
  const obras = useMemo(() => dados ? situacaoObras(dados.ogs, dados.rdos, dados.diarios, pessoasPorOgsHoje, hoje) : [], [dados, pessoasPorOgsHoje, hoje]);
  const resumo = useMemo(() => resumoCentral(equipamentos, pessoas, obras), [equipamentos, pessoas, obras]);

  const totalIsentos = equipamentos.filter((e) => e.estado === "isento" && e.statusCadastro === "OPERACIONAL").length;
  const q = norm(busca);
  const eqVis = equipamentos
    .filter((e) => e.statusCadastro !== "DEVOLVIDO")
    .filter((e) => mostrarIsentos || e.estado !== "isento" || e.statusCadastro === "MANUTENÇÃO" || e.statusCadastro === "INOPERANTE")
    .filter((e) => !soManut || e.statusCadastro === "MANUTENÇÃO" || e.statusCadastro === "INOPERANTE")
    .filter((e) => soManut || !soAlertas || e.estado === "atrasado" || e.estado === "nunca")
    .filter((e) => !q || norm([e.frota, e.nome, e.tipo, e.ogs, e.local, e.operador].join(" ")).includes(q))
    .sort((a, b) => (b.diasSemDiario ?? 9999) - (a.diasSemDiario ?? 9999) || a.frota.localeCompare(b.frota));
  const peVis = pessoas
    .filter((p) => !soAlertas || p.estado === "atrasado")
    .filter((p) => !q || norm([p.nome, p.matricula, p.funcao, p.equipe, p.ultimaObra].join(" ")).includes(q))
    .sort((a, b) => (b.diasSemRegistro ?? 9999) - (a.diasSemRegistro ?? 9999) || a.nome.localeCompare(b.nome));

  function exportarCsv(nome: string, cab: string[], linhas: (string | number)[][]) {
    const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = href; a.download = `${nome}_${hoje}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  const abrirEquip = (e: EquipamentoSituacao) => navigate(`/relatorios/equipamento/${encodeURIComponent(e.frota)}`);
  const estadoEq = (e: EquipamentoSituacao) =>
    e.estado === "atrasado" ? <Pill cor="#ef4444">Sem diário {fmtDias(e.diasSemDiario)}</Pill>
    : e.estado === "nunca" ? <Pill cor="#ef4444">Nunca lançou</Pill>
    : e.estado === "isento" ? <Pill cor="#94a3b8">Não monitorado</Pill>
    : e.semDiarioHoje ? <Pill cor="#f59e0b">Sem diário hoje</Pill> : <Pill cor="#10b981">Diário em dia</Pill>;
  const estadoPe = (p: PessoaSituacao) =>
    p.estado === "atrasado" ? <Pill cor="#ef4444">Sem nenhum registro {fmtDias(p.diasSemRegistro)}</Pill>
    : p.estado === "sem_historico" ? <Pill cor="#94a3b8">Sem registro em {JANELA_DIAS} dias</Pill>
    : p.semRegistroHoje ? <Pill cor="#f59e0b">Visto {fmtDias(p.diasSemRegistro)}</Pill> : <Pill cor="#10b981">Apareceu hoje</Pill>;
  const ultimoReg = (p: PessoaSituacao) => p.ultimaData ? `${fmtData(p.ultimaData)} · ${p.ultimaFonte ? FONTE_LABEL[p.ultimaFonte] : ""}` : "—";

  const topEq = equipamentos.filter((e) => e.estado === "atrasado" || e.estado === "nunca").sort((a, b) => (b.diasSemDiario ?? 9999) - (a.diasSemDiario ?? 9999)).slice(0, tv ? 12 : 8);
  const topPe = pessoas.filter((p) => p.estado === "atrasado").sort((a, b) => (b.diasSemRegistro ?? 9999) - (a.diasSemRegistro ?? 9999)).slice(0, tv ? 12 : 8);
  const obrasSemRdo = obras.filter((o) => o.estado === "sem_rdo_hoje");
  const maxStatus = Math.max(1, ...Object.values(resumo.porStatus));

  return (
    <div ref={raiz} className={`mx-auto space-y-4 p-4 ${tv ? "max-w-none min-h-screen bg-background text-[15px]" : "max-w-7xl"}`}>
      <header className="flex flex-wrap items-start gap-3">
        {!tv && <Button variant="outline" size="icon" aria-label="Voltar" onClick={() => goBack()}><ArrowLeft className="h-4 w-4" /></Button>}
        <div className="flex-1">
          <h1 className="text-xl font-bold">Central de Operações</h1>
          <p className="text-sm text-muted-foreground">
            Equipamentos, pessoas e obras em um só lugar · dia {fmtData(hoje)} · atualizado às {atualizado || "—"} (a cada 1 min)
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label="Atualizar" onClick={carregar}><RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /></Button>
        {tv && <Button variant="outline" onClick={() => setPausado((p) => !p)} aria-label={pausado ? "Retomar rotação" : "Pausar rotação"}>{pausado ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}{pausado ? "Retomar" : "Pausar"}</Button>}
        <Button onClick={alternarTv}>{tv ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}{tv ? "Sair da TV" : "TV"}</Button>
      </header>

      {erro && <p role="alert" className="rounded-xl border border-destructive p-3 text-sm text-destructive">{erro}</p>}
      {!dados && !erro && <p className="rounded-xl border p-6 text-sm text-muted-foreground">Carregando dados da operação...</p>}

      {dados && <>
        <nav className="flex flex-wrap gap-2" aria-label="Abas da Central de Operações">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setAba(t.id)} aria-current={aba === t.id ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${aba === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t.label}</button>
          ))}
        </nav>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard valor={`${resumo.equipComDiarioHoje}/${resumo.equipMonitorados}`} rotulo="Equipamentos com diário lançado hoje" tom="green" onClick={() => { setAba("equipamentos"); setSoAlertas(false); }} />
          <KpiCard valor={resumo.equipAtrasados + resumo.equipNunca} rotulo={`Equip. sem diário há ${limiteEq}+ dias`} tom={resumo.equipAtrasados + resumo.equipNunca ? "red" : "green"} onClick={() => { setAba("equipamentos"); setSoAlertas(true); }} />
          <KpiCard valor={`${resumo.pessoasComRdoHoje}/${resumo.pessoasMonitoradas}`} rotulo="Pessoas com algum registro hoje" tom="green" onClick={() => { setAba("pessoas"); setSoAlertas(false); }} />
          <KpiCard valor={resumo.pessoasAtrasadas} rotulo={`Pessoas sem nenhum registro há ${limitePe}+ dias`} tom={resumo.pessoasAtrasadas ? "yellow" : "green"} onClick={() => { setAba("pessoas"); setSoAlertas(true); }} />
          <KpiCard valor={`${resumo.obrasComRdoHoje}/${resumo.obrasAtivas}`} rotulo="Obras com RDO hoje" onClick={() => setAba("obras")} />
          <KpiCard valor={resumo.emManutencao} rotulo="Em manutenção / inoperantes" tom={resumo.emManutencao ? "yellow" : "green"} onClick={() => { setAba("equipamentos"); setSoManut(true); setSoAlertas(false); }} />
        </section>

        {aba === "hoje" && new Date().getHours() < 16 && (
          <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            Dia em andamento ({new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}): os lançamentos de hoje ainda estão chegando. Os alertas contam <b>dias sem lançar</b>, então não dependem do fechamento de hoje.
          </p>
        )}

        {aba === "hoje" && (
          <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-3">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frota por situação</h2>
                {(Object.keys(STATUS_LABEL) as StatusOperacao[]).map((s) => (
                  <div key={s} className="my-1.5 flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0">{STATUS_LABEL[s]}</span>
                    <i className="block h-2 rounded" style={{ width: `${(resumo.porStatus[s] / maxStatus) * 80}px`, minWidth: resumo.porStatus[s] ? 4 : 0, background: STATUS_COR[s] }} />
                    <b>{resumo.porStatus[s]}</b>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border bg-card p-3">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obras sem RDO hoje ({obrasSemRdo.length})</h2>
                {obrasSemRdo.length === 0 ? <p className="text-sm text-muted-foreground">Todas as obras ativas lançaram RDO.</p> :
                  obrasSemRdo.slice(0, 8).map((o) => <div key={o.ogs} className="my-1 flex justify-between gap-2 text-sm"><span className="truncate">{o.nome}</span><Pill cor="#f59e0b">{fmtDias(o.diasSemRdo)}</Pill></div>)}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 text-sm font-semibold">Equipamentos que deveriam ter diário e estão sem ({resumo.equipAtrasados + resumo.equipNunca})</h2>
                <Tabela cols={["Frota", "Tipo", "Último diário", "Onde estava", "Situação"]} vazio="Nenhum equipamento monitorado está atrasado.">
                  {topEq.map((e) => <tr key={e.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => abrirEquip(e)}>
                    <td className="p-2.5 font-medium">{e.frota}</td><td className="p-2.5">{e.tipo || e.nome || "—"}</td>
                    <td className="p-2.5">{fmtData(e.ultimoDiario)}</td><td className="p-2.5">{e.ogs || e.local || "—"}</td><td className="p-2.5">{estadoEq(e)}</td></tr>)}
                </Tabela>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold">Pessoas que sumiram dos lançamentos ({resumo.pessoasAtrasadas})</h2>
                <Tabela cols={["Nome", "Função", "Equipe", "Último registro", "Situação"]} vazio="Todas as pessoas acompanhadas apareceram em algum lançamento recentemente.">
                  {topPe.map((p) => <tr key={p.id} className="border-t">
                    <td className="p-2.5 font-medium">{p.nome}</td><td className="p-2.5">{p.funcao || "—"}</td><td className="p-2.5">{p.equipe || "—"}</td>
                    <td className="p-2.5">{ultimoReg(p)}</td><td className="p-2.5">{estadoPe(p)}</td></tr>)}
                </Tabela>
              </div>
            </div>
          </section>
        )}

        {(aba === "equipamentos" || aba === "pessoas") && (
          <section className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
            <label className="text-sm">Buscar<div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={aba === "equipamentos" ? "frota, tipo, obra, operador" : "nome, função, equipe"} /></div></label>
            <label className="text-sm">Alerta a partir de
              <select className="block h-10 rounded-md border bg-background px-3" value={aba === "pessoas" ? limitePe : limiteEq} onChange={(e) => (aba === "pessoas" ? setLimitePe : setLimiteEq)(+e.target.value)}>
                {[1, 2, 3, 4, 5, 7, 10].map((n) => <option key={n} value={n}>{n} dia{n > 1 ? "s" : ""} sem lançamento</option>)}
              </select></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soAlertas} onChange={(e) => { setSoAlertas(e.target.checked); if (e.target.checked) setSoManut(false); }} />Só pendências</label>
            {aba === "equipamentos" && soManut && <button type="button" className="rounded-full border border-amber-500 bg-amber-500/10 px-3 py-1 text-xs font-semibold" onClick={() => setSoManut(false)}>Só manutenção / inoperantes ✕</button>}
            {aba === "equipamentos" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mostrarIsentos} onChange={(e) => setMostrarIsentos(e.target.checked)} />Mostrar também os que não lançam diário</label>}
            {aba === "equipamentos" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={porObra} onChange={(e) => setPorObra(e.target.checked)} />Agrupar por obra</label>}
            {aba === "pessoas" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incluirAdm} onChange={(e) => setIncluirAdm(e.target.checked)} />Incluir administrativos e ajudantes</label>}
            <Button variant="outline" onClick={() => aba === "equipamentos"
              ? exportarCsv("equipamentos", ["Frota", "Tipo", "Equipe", "Cadastro", "Situação", "OGS", "Local", "Operador", "Último diário", "Dias sem diário"], eqVis.map((e) => [e.frota, e.tipo, e.equipe, e.statusCadastro, STATUS_LABEL[e.statusOperacao], e.ogs, e.local, e.operador, fmtData(e.ultimoDiario), e.diasSemDiario ?? "nunca"]))
              : exportarCsv("pessoas", ["Nome", "Matrícula", "Função", "Equipe", "Último registro", "Fonte", "Dias sem registro"], peVis.map((p) => [p.nome, p.matricula, p.funcao, p.equipe, fmtData(p.ultimaData), p.ultimaFonte ? FONTE_LABEL[p.ultimaFonte] : "", p.diasSemRegistro ?? "nunca"]))}>
              <Download className="mr-2 h-4 w-4" />CSV</Button>
          </section>
        )}

        {aba === "equipamentos" && <>
          <Ajuda titulo="Como ler esta tela">
            <p>Mostra os equipamentos <b>ativos que lançam diário</b> (operador ou motorista), onde estavam no último diário, e há quantos dias não têm diário.</p>
            <p>Equipamentos que ninguém lança diário (banheiro químico, torre de iluminação, compressor, rompedor, gerador etc.) ficam <b>fora da lista</b> para não gerar alarme falso{totalIsentos ? ` (${totalIsentos} no momento)` : ""}. Diário automático de pátio não conta como lançamento. Clique numa linha para abrir o relatório do equipamento.</p>
          </Ajuda>
          <p className="text-xs text-muted-foreground">{eqVis.length} equipamento(s).</p>
          {porObra ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agruparPorLocal(eqVis).map((g) => (
                <div key={g.chave} className="rounded-xl border bg-card p-3">
                  <h3 className="mb-1 flex justify-between text-sm font-semibold"><span>{g.titulo}</span><span>{g.itens.length}</span></h3>
                  <div className="mb-2 flex flex-wrap gap-1">{(Object.keys(g.porStatus) as StatusOperacao[]).map((st) => <Pill key={st} cor={STATUS_COR[st]}>{STATUS_LABEL[st]} {g.porStatus[st]}</Pill>)}</div>
                  <ul className="space-y-1 text-sm">
                    {g.itens.map((e) => (
                      <li key={e.id} className="flex cursor-pointer justify-between gap-2 border-t pt-1 hover:bg-muted/40" onClick={() => abrirEquip(e)}>
                        <span><b>{e.frota}</b> <span className="text-muted-foreground">{e.tipo}{e.equipe ? ` · ${e.equipe}` : ""}</span></span>
                        <span className="whitespace-nowrap">{estadoEq(e)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
          <Tabela cols={["Frota", "Tipo", "Situação", "Obra (OGS) / Local", "Equipe", "Operador", "Último diário", "Lançamento"]} vazio="Nenhum equipamento para os filtros.">
            {eqVis.map((e) => <tr key={e.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => abrirEquip(e)}>
              <td className="p-2.5 font-medium">{e.frota}</td><td className="p-2.5">{e.tipo || e.nome || "—"}</td>
              <td className="p-2.5"><Pill cor={STATUS_COR[e.statusOperacao]}>{STATUS_LABEL[e.statusOperacao]}</Pill></td>
              <td className="p-2.5">{e.ogs || e.local || "—"}</td><td className="p-2.5">{e.equipe || "—"}</td><td className="p-2.5">{e.operador || "—"}</td>
              <td className="p-2.5">{fmtData(e.ultimoDiario)}</td><td className="p-2.5">{estadoEq(e)}</td></tr>)}
          </Tabela>
          )}
        </>}

        {aba === "pessoas" && <>
          <Ajuda titulo="Como ler esta tela">
            <p>Mostra <b>funcionários próprios ativos de campo</b> e a <b>última vez que apareceram em algum lançamento</b>. Cada um é registrado num lugar diferente:</p>
            <ul className="ml-4 list-disc">
              <li><b>Citado em RDO</b> — equipe lançada pelo apontador (ajudantes, rasteleiros, encarregados...).</li>
              <li><b>Diário de equipamento</b> — operadores e motoristas.</li>
              <li><b>RDO Técnico</b> — engenheiros.</li>
              <li><b>Alocado no Programador</b> — folga, férias, atestado, base ou obra.</li>
            </ul>
            <p>"Sem nenhum registro há N dias" = a pessoa apareceu nos últimos {JANELA_DIAS} dias mas <b>não aparece em nenhum desses lugares há N dias ou mais</b>. Pode ser férias, afastamento ou lançamento esquecido. Ajudantes e administrativos não são cobrados (nem todos são citados em RDO ou lançam diário). Quem não aparece em nada nos {JANELA_DIAS} dias fica como "Sem registro" (provavelmente não é de campo).</p>
          </Ajuda>
          <p className="text-xs text-muted-foreground">{peVis.length} pessoa(s).</p>
          <Tabela cols={["Nome", "Função", "Equipe", "Último registro", "Situação"]} vazio="Nenhuma pessoa para os filtros.">
            {peVis.map((p) => <tr key={p.id} className="border-t">
              <td className="p-2.5 font-medium">{p.nome}</td><td className="p-2.5">{p.funcao || "—"}</td><td className="p-2.5">{p.equipe || "—"}</td>
              <td className="p-2.5">{ultimoReg(p)}{p.ultimaObra ? <span className="text-muted-foreground"> · {p.ultimaObra}</span> : null}</td><td className="p-2.5">{estadoPe(p)}</td></tr>)}
          </Tabela>
        </>}

        {aba === "pendencias" && profile?.company_id && <AbaPendenciasProgramador companyId={profile.company_id} />}
        {aba === "divergencias" && profile?.company_id && <AbaDivergencias companyId={profile.company_id} />}

        {aba === "medidores" && profile?.company_id && <AbaMedidores companyId={profile.company_id} />}

        {aba === "obras" && (
          <Tabela cols={["Obra", "OGS", "Cliente", "RDO hoje", "Último RDO", "Equipamentos hoje", "Pessoas hoje", "Situação"]} vazio="Nenhuma obra com RDO nos últimos 14 dias.">
            {obras.map((o) => <tr key={o.ogs} className="border-t">
              <td className="p-2.5 font-medium">{o.nome}</td><td className="p-2.5">{o.ogs}</td><td className="p-2.5">{o.cliente || "—"}</td>
              <td className="p-2.5">{o.rdoHoje}</td><td className="p-2.5">{fmtData(o.ultimoRdo)}</td>
              <td className="p-2.5">{o.equipamentosHoje}</td><td className="p-2.5">{o.pessoasHoje}</td>
              <td className="p-2.5">{o.estado === "rdo_hoje" ? <Pill cor="#10b981">RDO hoje</Pill> : <Pill cor="#f59e0b">Sem RDO {fmtDias(o.diasSemRdo)}</Pill>}</td></tr>)}
          </Tabela>
        )}
      </>}
    </div>
  );
}
