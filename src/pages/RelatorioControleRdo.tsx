import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Copy, Download, Settings2, Tractor, Users, Link2Off, AlertCircle, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { toLocalISODate, toSaoPauloISODate } from "@/lib/date-local";
import { norm } from "@/lib/centralOperacoes";
import {
  coberturaEquipamentos, coberturaPessoas, lancamentosSemVinculo, textoCobranca, eachDay,
  type CoverageState, type DayCell, type EquipCoverage, type PersonCoverage, type SemVinculo,
  type PresencaExtra, type RdoIn, type OgsIn, type RdoEquipIn, type RdoEfetivoIn, type DiaryIn, type TransportIn, type AllocIn, type EquipIn, type EmployeeIn,
} from "@/lib/rdoCoverage";

const MAX_DIAS = 62;
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const dmy = (d: string) => `${dm(d)}/${d.slice(0, 4)}`;
const wd = (d: string) => DIAS[new Date(`${d}T12:00:00`).getDay()];
const tipoKey = (t?: string | null) => (t || "").trim().toUpperCase();

async function readAll<T = any>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if ((data || []).length < 1000) return out;
    if (out.length >= 80000) throw new Error("Volume de dados acima do limite do relatório. Reduza o período.");
  }
}

const CELL: Record<CoverageState, { cls: string; txt: string; label: string }> = {
  rdo:            { cls: "bg-green-100 border-green-300 text-green-800", txt: "", label: "Lançado em RDO" },
  justificado:    { cls: "bg-blue-100 border-blue-300 text-blue-700", txt: "J", label: "Justificado" },
  inconsistente:  { cls: "bg-orange-100 border-orange-400 text-orange-700", txt: "!", label: "Indício de trabalho fora do RDO" },
  sem_registro:   { cls: "bg-red-100 border-red-300 text-red-600", txt: "✕", label: "Sem registro" },
  hoje:           { cls: "bg-amber-50 border-amber-200 text-amber-600", txt: "•", label: "Hoje (ainda não atrasado)" },
  futuro:         { cls: "bg-gray-50 border-gray-100 text-gray-300", txt: "", label: "Futuro" },
  sem_expediente: { cls: "bg-gray-100 border-gray-200 text-gray-400", txt: "–", label: "Nenhum RDO da empresa nesse dia" },
  na:             { cls: "bg-gray-50 border-gray-100 text-gray-300", txt: "", label: "Fora do cadastro/vínculo" },
};

interface Dados {
  inicio: string; fim: string;
  equips: EquipIn[]; employees: EmployeeIn[]; rdos: RdoIn[]; ogs: OgsIn[];
  rdoEquips: RdoEquipIn[]; efetivo: RdoEfetivoIn[]; diarios: DiaryIn[]; transportes: TransportIn[]; alocacoes: AllocIn[]; extras: PresencaExtra[];
}

interface Cfg { tiposDispensados: string[]; frotasDispensadas: string[] }
const CFG0: Cfg = { tiposDispensados: [], frotasDispensadas: [] };

function Matriz({ dias, cells, onCell }: { dias: string[]; cells: DayCell[]; onCell: (c: DayCell) => void }) {
  return (
    <div className="flex gap-[2px]">
      {cells.map(c => {
        const m = CELL[c.state];
        const ogs = c.state === "rdo" ? [...new Set(c.rdo.map(r => r.ogs))].join("/") : "";
        const clicavel = c.state === "rdo" || c.state === "justificado" || c.state === "inconsistente";
        return (
          <button key={c.date} type="button" disabled={!clicavel}
            title={`${dmy(c.date)} (${wd(c.date)}) — ${m.label}${c.note ? `: ${c.note}` : ""}${c.rdo.length ? ` — ${c.rdo.map(r => r.obra).join(" | ")}` : ""}`}
            onClick={() => onCell(c)}
            className={`w-9 h-7 flex-shrink-0 rounded border text-[9px] font-bold leading-none flex items-center justify-center overflow-hidden ${m.cls} ${clicavel ? "hover:brightness-95 cursor-pointer" : "cursor-default"}`}>
            {c.state === "rdo" ? <span className="truncate px-0.5">{ogs || "✓"}</span> : m.txt}
          </button>
        );
      })}
      {dias.length === 0 && null}
    </div>
  );
}

export default function RelatorioControleRdo() {
  const goBack = useSmartBack("/relatorios");
  const { profile } = useUserProfile();
  const companyId = profile?.company_id;

  const hojeISO = toSaoPauloISODate();
  const mesIni = toLocalISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [ini, setIni] = useState(mesIni);
  const [fim, setFim] = useState(hojeISO);
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [aba, setAba] = useState<"equipamentos" | "pessoas" | "semvinculo">("equipamentos");
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [soPend, setSoPend] = useState(true);
  const [ordem, setOrdem] = useState<"pend" | "az">("pend");
  const [ajudantes, setAjudantes] = useState(true);
  const [adm, setAdm] = useState(false);
  const [semExp, setSemExp] = useState(false);
  const [cfgAberta, setCfgAberta] = useState(false);
  const [modal, setModal] = useState<{ titulo: string; cell: DayCell } | null>(null);

  const cfgKey = `wf_ctrl_rdo_cfg_${companyId || "x"}`;
  const [cfg, setCfg] = useState<Cfg>(CFG0);
  useEffect(() => { try { const r = localStorage.getItem(cfgKey); setCfg(r ? { ...CFG0, ...JSON.parse(r) } : CFG0); } catch { setCfg(CFG0); } }, [cfgKey]);
  const salvarCfg = (n: Cfg) => { setCfg(n); try { localStorage.setItem(cfgKey, JSON.stringify(n)); } catch { /* ignore */ } };

  const carregar = useCallback(async () => {
    if (!companyId) return;
    const dias = eachDay(ini, fim).length;
    if (!dias || dias > MAX_DIAS) { setErro(`Escolha um período de 1 a ${MAX_DIAS} dias.`); return; }
    setLoading(true); setErro("");
    try {
      const sb = supabase as any;
      const [equips, employees, rdosRaw, ogs, diarios, transportes, rdoTec, perfis, alocacoes] = await Promise.all([
        readAll<EquipIn>((f, t) => sb.from("equipamentos").select("id,frota,nome,tipo,status,created_at").eq("company_id", companyId).order("frota").range(f, t)),
        readAll<EmployeeIn>((f, t) => sb.from("employees").select("id,name,matricula,role,equipe,centro_custo,origem,status,data_admissao,data_demissao").eq("company_id", companyId).order("name").range(f, t)),
        readAll<any>((f, t) => sb.from("rdo_diarios").select("id,data,obra_nome,ogs_id,equipe,encarregado,encarregado_employee_id,status_validacao,tipo_rdo,preenchido_por,responsavel").eq("company_id", companyId).gte("data", ini).lte("data", fim).order("id").range(f, t)),
        readAll<OgsIn>((f, t) => sb.from("ogs_reference").select("id,ogs_number").eq("company_id", companyId).order("id").range(f, t)),
        readAll<DiaryIn>((f, t) => sb.from("equipment_diaries").select("equipment_fleet,date,work_status,status,is_auto,operator_id,operator_name,operator_solo_id,operator_solo").eq("company_id", companyId).gte("date", ini).lte("date", fim).order("id").range(f, t)),
        readAll<TransportIn>((f, t) => sb.from("equipamento_transportes").select("equipment_fleet,data").eq("company_id", companyId).gte("data", ini).lte("data", fim).order("id").range(f, t)).catch(() => [] as TransportIn[]),
        readAll<{ engenheiro_id: string; data: string }>((f, t) => sb.from("rdo_engenheiro").select("engenheiro_id,data").eq("company_id", companyId).gte("data", ini).lte("data", fim).order("id").range(f, t)).catch(() => [] as any[]),
        readAll<{ user_id: string; nome_completo: string | null }>((f, t) => sb.from("profiles").select("user_id,nome_completo").eq("company_id", companyId).order("user_id").range(f, t)).catch(() => [] as any[]),
        readAll<AllocIn>((f, t) => sb.from("alocacao_diaria").select("employee_id,data,tipo,ogs_number").eq("company_id", companyId).gte("data", ini).lte("data", fim).order("id").range(f, t)).catch(() => [] as AllocIn[]),
      ]);
      const rdos: RdoIn[] = rdosRaw.map((r: any) => ({ ...r, apontador: r.preenchido_por || r.responsavel || "" }));
      const ids = rdos.filter(r => norm(r.status_validacao) !== "RASCUNHO" && norm(r.tipo_rdo) !== "AUTOMATICO").map(r => r.id);
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
      const partes = await Promise.all(chunks.map(async c => ({
        eq: await readAll<RdoEquipIn>((f, t) => sb.from("rdo_equipamentos").select("rdo_id,frota").in("rdo_id", c).order("id").range(f, t)),
        ef: await readAll<RdoEfetivoIn>((f, t) => sb.from("rdo_efetivo").select("rdo_id,nome,employee_id").in("rdo_id", c).order("id").range(f, t)),
      })));
      const nomePerfil = new Map<string, string>(perfis.filter(x => x.nome_completo).map(x => [x.user_id, x.nome_completo as string]));
      const extras: PresencaExtra[] = rdoTec.flatMap(t => nomePerfil.get(t.engenheiro_id) ? [{ nome: nomePerfil.get(t.engenheiro_id) as string, data: t.data, nota: "RDO Técnico" }] : []);
      setDados({
        inicio: ini, fim, equips, employees, rdos, ogs, diarios, transportes, alocacoes, extras,
        rdoEquips: partes.flatMap(p => p.eq), efetivo: partes.flatMap(p => p.ef),
      });
    } catch (e) {
      console.error("[ControleRdo]", e);
      setErro("Falha ao carregar. Não considere o painel completo; tente novamente.");
    }
    setLoading(false);
  }, [companyId, ini, fim]);
  useEffect(() => { if (companyId) carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);

  const dias = useMemo(() => dados ? eachDay(dados.inicio, dados.fim) : [], [dados]);

  const equipCov: EquipCoverage[] = useMemo(() => dados ? coberturaEquipamentos({
    equips: dados.equips.filter(e => (e.status || "").toLowerCase() !== "devolvido"),
    rdos: dados.rdos, ogs: dados.ogs, rdoEquips: dados.rdoEquips, diarios: dados.diarios, transportes: dados.transportes,
    inicio: dados.inicio, fim: dados.fim, hoje: hojeISO, contarSemExpediente: semExp,
  }) : [], [dados, hojeISO, semExp]);

  const pessoaCov: PersonCoverage[] = useMemo(() => dados ? coberturaPessoas({
    pessoas: dados.employees, rdos: dados.rdos, ogs: dados.ogs, efetivo: dados.efetivo, diarios: dados.diarios, alocacoes: dados.alocacoes,
    inicio: dados.inicio, fim: dados.fim, hoje: hojeISO, filtro: { incluirAjudantes: ajudantes, incluirAdm: adm }, contarSemExpediente: semExp, extras: dados.extras,
  }) : [], [dados, hojeISO, ajudantes, adm, semExp]);

  const semVinc: SemVinculo[] = useMemo(() => dados ? lancamentosSemVinculo({
    rdos: dados.rdos, ogs: dados.ogs, efetivo: dados.efetivo, rdoEquips: dados.rdoEquips,
    todosFuncionarios: dados.employees, todosEquipamentos: dados.equips,
  }) : [], [dados]);

  const dispensada = (e: EquipCoverage) => cfg.frotasDispensadas.includes(e.frota) || (!!e.tipo && cfg.tiposDispensados.includes(tipoKey(e.tipo)));
  const equipMonit = equipCov.filter(e => !dispensada(e));
  const tiposEquip = useMemo(() => [...new Set(equipCov.map(e => tipoKey(e.tipo)).filter(Boolean))].sort(), [equipCov]);
  const equipesPessoa = useMemo(() => [...new Set(pessoaCov.map(p => p.equipe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [pessoaCov]);

  const pend = (x: { faltando: string[]; inconsistentes: string[] }) => x.faltando.length + x.inconsistentes.length;
  const b = busca.trim().toLowerCase();

  const equipLista = useMemo(() => equipMonit
    .filter(e => !grupo || tipoKey(e.tipo) === grupo)
    .filter(e => !b || e.frota.toLowerCase().includes(b) || e.nome.toLowerCase().includes(b) || e.tipo.toLowerCase().includes(b))
    .filter(e => !soPend || pend(e) > 0)
    .sort((x, y) => ordem === "pend" ? pend(y) - pend(x) || x.frota.localeCompare(y.frota, "pt-BR", { numeric: true }) : x.frota.localeCompare(y.frota, "pt-BR", { numeric: true })),
  [equipMonit, grupo, b, soPend, ordem]);

  const pessoaLista = useMemo(() => pessoaCov
    .filter(p => !grupo || p.equipe === grupo)
    .filter(p => !b || p.nome.toLowerCase().includes(b) || p.matricula.toLowerCase().includes(b) || p.funcao.toLowerCase().includes(b) || p.equipe.toLowerCase().includes(b))
    .filter(p => !soPend || pend(p) > 0)
    .sort((x, y) => ordem === "pend" ? pend(y) - pend(x) || x.nome.localeCompare(y.nome, "pt-BR") : x.nome.localeCompare(y.nome, "pt-BR")),
  [pessoaCov, grupo, b, soPend, ordem]);

  const cobertura = (arr: { comRdo: number; cobrados: number }[]) => {
    const c = arr.reduce((s, x) => s + x.cobrados, 0); const k = arr.reduce((s, x) => s + x.comRdo, 0);
    return c ? Math.round((k / c) * 100) : null;
  };
  const eqComPend = equipMonit.filter(e => pend(e) > 0).length;
  const peComPend = pessoaCov.filter(p => pend(p) > 0).length;

  const copiar = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); toast.success("Cobrança copiada"); } catch { toast.error("Não foi possível copiar"); }
  };

  const exportarCsv = () => {
    const linhas: string[][] = aba === "equipamentos"
      ? [["Frota", "Nome", "Tipo", "Dias com RDO", "Dias sem registro", "Indícios fora do RDO", "Datas sem registro", "Datas com indício"],
        ...equipLista.map(e => [e.frota, e.nome, e.tipo, String(e.comRdo), String(e.faltando.length), String(e.inconsistentes.length), e.faltando.map(dm).join(" "), e.inconsistentes.map(dm).join(" ")])]
      : aba === "pessoas"
        ? [["Nome", "Matrícula", "Função", "Equipe", "Dias com RDO", "Dias sem registro", "Indícios fora do RDO", "Datas sem registro", "Datas com indício"],
          ...pessoaLista.map(p => [p.nome, p.matricula, p.funcao, p.equipe, String(p.comRdo), String(p.faltando.length), String(p.inconsistentes.length), p.faltando.map(dm).join(" "), p.inconsistentes.map(dm).join(" ")])]
        : [["Tipo", "Nome no RDO", "Situação", "Cadastro sugerido", "Ocorrências", "Datas", "Obras", "Apontadores"],
          ...semVinc.map(s => [s.tipo, s.nome, s.situacao === "sem_cadastro" ? "Sem cadastro" : "Cadastro existe, linha sem vínculo", s.cadastroNome || "", String(s.ocorrencias), s.datas.map(dm).join(" "), s.obras.join(" | "), s.apontadores.join(" | ")])];
    const csv = "\uFEFF" + linhas.map(l => l.map(v => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `controle-rdo-${aba}-${dados?.inicio}-${dados?.fim}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const Cab = () => (
    <div className="flex gap-[2px] pl-0">
      {dias.map(d => {
        const we = [0, 6].includes(new Date(`${d}T12:00:00`).getDay());
        return <div key={d} className="w-9 flex-shrink-0 text-center leading-tight">
          <div className={`text-[9px] font-bold ${we ? "text-red-500" : "text-gray-500"}`}>{wd(d)}</div>
          <div className={`text-[10px] font-semibold ${we ? "text-red-400" : "text-gray-600"}`}>{dm(d)}</div>
        </div>;
      })}
    </div>
  );

  const abrirCelula = (titulo: string) => (cell: DayCell) => setModal({ titulo, cell });

  const kpis = [
    { label: "Equipamentos monitorados", val: equipMonit.length, cls: "bg-teal-600" },
    { label: "Equipamentos com pendência", val: eqComPend, cls: "bg-red-600" },
    { label: "Cobertura de equipamentos", val: cobertura(equipMonit) === null ? "—" : `${cobertura(equipMonit)}%`, cls: "bg-green-600" },
    { label: "Funcionários monitorados", val: pessoaCov.length, cls: "bg-blue-600" },
    { label: "Funcionários com pendência", val: peComPend, cls: "bg-red-600" },
    { label: "Cobertura de funcionários", val: cobertura(pessoaCov) === null ? "—" : `${cobertura(pessoaCov)}%`, cls: "bg-green-600" },
    { label: "Lançamentos sem vínculo", val: semVinc.length, cls: "bg-orange-500" },
  ];

  const lista = aba === "equipamentos" ? equipLista : pessoaLista;

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg no-print">
          <div className="w-full px-4 2xl:px-8 py-4 flex items-center gap-3">
            <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Voltar"><ArrowLeft size={20} /></button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Controle de RDO</h1>
              <p className="text-slate-300 text-sm">Quem e o quê não apareceu nos RDOs — equipamentos e funcionários cadastrados</p>
            </div>
            <Button onClick={exportarCsv} size="sm" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2"><Download size={16} /> Exportar CSV</Button>
            <Button onClick={() => window.print()} size="sm" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2"><Download size={16} /> PDF</Button>
          </div>
        </div>

        <div className="w-full px-4 2xl:px-8 py-5">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 no-print">
            <div className="flex flex-wrap gap-3 items-end">
              <div><label className="text-xs font-semibold text-gray-500 mb-1 block">DATA INÍCIO</label><Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="h-9 text-sm w-40" /></div>
              <div><label className="text-xs font-semibold text-gray-500 mb-1 block">DATA FIM</label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="h-9 text-sm w-40" /></div>
              <Button onClick={carregar} disabled={loading} className="h-9 bg-slate-700 hover:bg-slate-800 text-white gap-2"><Search size={15} /> {loading ? "Buscando..." : "Buscar"}</Button>
              {aba !== "semvinculo" && (<>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{aba === "equipamentos" ? "TIPO DE EQUIPAMENTO" : "EQUIPE"}</label>
                  <select value={grupo} onChange={e => setGrupo(e.target.value)} className="h-9 text-sm border border-gray-200 rounded-md px-3 bg-white min-w-[200px]">
                    <option value="">{aba === "equipamentos" ? "Todos os tipos" : "Todas as equipes"}</option>
                    {(aba === "equipamentos" ? tiposEquip : equipesPessoa).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-48"><label className="text-xs font-semibold text-gray-500 mb-1 block">BUSCAR</label>
                  <Input placeholder={aba === "equipamentos" ? "Frota, nome ou tipo..." : "Nome, matrícula, função..."} value={busca} onChange={e => setBusca(e.target.value)} className="h-9 text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 mb-1 block">ORDENAR</label>
                  <select value={ordem} onChange={e => setOrdem(e.target.value as "pend" | "az")} className="h-9 text-sm border border-gray-200 rounded-md px-3 bg-white">
                    <option value="pend">Mais pendências primeiro</option><option value="az">A–Z</option></select></div>
                <button onClick={() => setSoPend(v => !v)} className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold border ${soPend ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}><AlertCircle size={15} /> Só com pendência</button>
              </>)}
              {aba === "equipamentos" && (
                <button onClick={() => setCfgAberta(v => !v)} className={`flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold border ${cfgAberta ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}>
                  <Settings2 size={15} /> Equipamentos obrigatórios{(cfg.tiposDispensados.length + cfg.frotasDispensadas.length) ? ` (${equipCov.length - equipMonit.length} dispensados)` : ""}</button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-slate-600">
              <label className="flex items-center gap-2"><input type="checkbox" checked={ajudantes} onChange={e => setAjudantes(e.target.checked)} /> Incluir ajudantes</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={adm} onChange={e => setAdm(e.target.checked)} /> Incluir áreas administrativas/escritório</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={semExp} onChange={e => setSemExp(e.target.checked)} /> Cobrar também dias em que nenhum RDO foi lançado na empresa (domingo/feriado)</label>
            </div>
            {aba === "equipamentos" && cfgAberta && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-slate-600 mb-2">Desmarque os tipos que <strong>não entram em RDO</strong> (ex.: banheiro químico). Dispensados saem da lista e dos totais. Fica salvo neste navegador.</p>
                <div className="max-h-56 overflow-auto rounded-md border border-gray-200 divide-y divide-gray-100 max-w-xl">
                  {tiposEquip.map(t => (
                    <label key={t} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={!cfg.tiposDispensados.includes(t)}
                        onChange={() => salvarCfg({ ...cfg, tiposDispensados: cfg.tiposDispensados.includes(t) ? cfg.tiposDispensados.filter(x => x !== t) : [...cfg.tiposDispensados, t] })} />
                      <span className="flex-1">{t}</span><span className="text-xs text-gray-400">{equipCov.filter(e => tipoKey(e.tipo) === t).length}</span>
                    </label>
                  ))}
                </div>
                {cfg.frotasDispensadas.length > 0 && <p className="text-xs text-slate-500 mt-2">Dispensados individualmente: {cfg.frotasDispensadas.join(", ")} — <button className="underline" onClick={() => salvarCfg({ ...cfg, frotasDispensadas: [] })}>restaurar</button></p>}
              </div>
            )}
          </div>

          {erro && <p className="text-destructive font-semibold mb-3" role="alert">{erro}</p>}

          <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-7 gap-3 mb-4">
            {kpis.map(k => <div key={k.label} className={`${k.cls} text-white rounded-xl p-3 shadow-sm`}><div className="text-2xl font-bold">{k.val}</div><div className="text-xs opacity-90 font-medium">{k.label}</div></div>)}
          </div>

          <details className="mb-3 text-xs text-slate-500 no-print">
            <summary className="cursor-pointer underline w-fit">Como ler este relatório</summary>
            <div className="mt-1.5 text-sm text-slate-600 space-y-1">
              <p>Um dia conta como <strong>lançado</strong> quando o equipamento ou a pessoa aparece em um RDO enviado/validado (não rascunho, não automático). O relatório mostra <strong>"sem registro"</strong>, não "erro": o equipamento pode estar parado ou a pessoa de folga.</p>
              <p><strong>Justificado (J)</strong>: RDO Técnico (engenheiros), diário de equipamento com Folga/Manutenção/Disposição, transporte, equipamento em manutenção no cadastro, ou folga/férias/atestado no Programador. <strong>Indício (!)</strong>: o diário diz Trabalhando, ou o Programador alocou em obra, mas não há RDO. Dias em que nenhum RDO foi lançado na empresa não são cobrados (opção acima).</p>
              <p>Funcionários: casados por vínculo de cadastro e, quando a linha do RDO está sem vínculo, pelo nome (sem acento/caixa). Terceiros não entram. Equipamentos devolvidos ficam fora; o status de manutenção é o atual (sem histórico).</p>
            </div>
          </details>

          <div className="flex gap-2 mb-4 no-print items-center flex-wrap">
            {([["equipamentos", "Equipamentos", <Tractor key="a" size={15} />], ["pessoas", "Funcionários", <Users key="b" size={15} />], ["semvinculo", `Sem vínculo com o cadastro (${semVinc.length})`, <Link2Off key="c" size={15} />]] as const).map(([id, label, icon]) => (
              <button key={id} onClick={() => { setAba(id); setGrupo(""); setBusca(""); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold ${aba === id ? "bg-slate-800 text-white shadow" : "bg-white text-slate-600 border border-gray-200 hover:bg-gray-50"}`}>{icon} {label}</button>
            ))}
            {aba !== "semvinculo" && <span className="text-sm text-gray-500 ml-2">{lista.length} na lista</span>}
            <div className="ml-auto flex flex-wrap gap-3 text-[11px] text-slate-600 items-center">
              {(["rdo", "justificado", "inconsistente", "sem_registro", "sem_expediente"] as CoverageState[]).map(s => (
                <span key={s} className="flex items-center gap-1"><span className={`w-4 h-4 rounded border inline-flex items-center justify-center text-[9px] font-bold ${CELL[s].cls}`}>{CELL[s].txt}</span>{CELL[s].label}</span>))}
            </div>
          </div>

          {loading && <div className="text-center py-16 text-gray-400 text-sm">Carregando RDOs, equipamentos e funcionários...</div>}

          {!loading && dados && aba !== "semvinculo" && (
            lista.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">{soPend ? "🎉 Nenhuma pendência no período com os filtros atuais." : "Nada encontrado."}</div> : (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-9rem)]">
                <div className="min-w-max">
                  <div className="flex items-end gap-3 sticky top-0 z-20 bg-white border-b border-gray-200 px-3 py-2">
                    <div className="w-[320px] flex-shrink-0 sticky left-0 bg-white z-30 text-xs font-semibold text-gray-500">{aba === "equipamentos" ? "EQUIPAMENTO" : "FUNCIONÁRIO"}</div>
                    <div className="w-[120px] flex-shrink-0 text-xs font-semibold text-gray-500">COBERTURA</div>
                    <Cab />
                    <div className="w-[110px] flex-shrink-0" />
                  </div>
                  {aba === "equipamentos" ? equipLista.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 hover:bg-gray-50/60">
                      <div className="w-[320px] flex-shrink-0 sticky left-0 bg-white z-10 min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">{e.frota}{e.nome && e.nome !== e.frota ? <span className="font-normal text-gray-500"> · {e.nome}</span> : null}</div>
                        <div className="text-[11px] text-gray-400 truncate">{e.tipo || "—"}{e.statusCadastro !== "OPERACIONAL" ? ` · ${e.statusCadastro}` : ""}</div>
                      </div>
                      <div className="w-[120px] flex-shrink-0 flex flex-col gap-0.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full w-fit ${e.pct === null ? "bg-gray-100 text-gray-500" : e.pct === 100 ? "bg-green-100 text-green-700" : e.pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{e.pct === null ? "—" : `${e.comRdo}/${e.cobrados} (${e.pct}%)`}</span>
                        {e.inconsistentes.length > 0 && <span className="text-[10px] text-orange-600 font-semibold">{e.inconsistentes.length} indício(s)</span>}
                      </div>
                      <Matriz dias={dias} cells={e.cells} onCell={abrirCelula(`${e.frota} — ${e.tipo}`)} />
                      <div className="w-[110px] flex-shrink-0 flex gap-1 no-print">
                        <button title="Copiar cobrança" disabled={!pend(e)} onClick={() => copiar(textoCobranca("equipamento", e.frota, e.tipo, e.faltando, e.inconsistentes))}
                          className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30"><Copy size={14} /></button>
                        <button title="Dispensar este equipamento (não entra em RDO)" onClick={() => salvarCfg({ ...cfg, frotasDispensadas: [...cfg.frotasDispensadas, e.frota] })}
                          className="p-1.5 rounded border border-gray-200 hover:bg-gray-100"><EyeOff size={14} /></button>
                      </div>
                    </div>
                  )) : pessoaLista.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 hover:bg-gray-50/60">
                      <div className="w-[320px] flex-shrink-0 sticky left-0 bg-white z-10 min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">{p.nome}</div>
                        <div className="text-[11px] text-gray-400 truncate">{p.funcao || "—"}{p.equipe ? ` · ${p.equipe}` : ""}{p.matricula ? ` · mat. ${p.matricula}` : ""}</div>
                      </div>
                      <div className="w-[120px] flex-shrink-0 flex flex-col gap-0.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full w-fit ${p.pct === null ? "bg-gray-100 text-gray-500" : p.pct === 100 ? "bg-green-100 text-green-700" : p.pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{p.pct === null ? "—" : `${p.comRdo}/${p.cobrados} (${p.pct}%)`}</span>
                        {p.inconsistentes.length > 0 && <span className="text-[10px] text-orange-600 font-semibold">{p.inconsistentes.length} indício(s)</span>}
                      </div>
                      <Matriz dias={dias} cells={p.cells} onCell={abrirCelula(`${p.nome} — ${p.funcao}`)} />
                      <div className="w-[110px] flex-shrink-0 flex gap-1 no-print">
                        <button title="Copiar cobrança" disabled={!pend(p)} onClick={() => copiar(textoCobranca("pessoa", p.nome, [p.funcao, p.equipe].filter(Boolean).join(" · "), p.faltando, p.inconsistentes))}
                          className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30"><Copy size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {!loading && dados && aba === "semvinculo" && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto">
              <p className="text-sm text-slate-600 p-4 border-b border-gray-100">
                Nomes e frotas digitados no RDO que o sistema não consegue ligar ao cadastro. <strong>Sem cadastro</strong>: o nome/frota não existe — pode ser digitação errada ou cadastro faltando. <strong>Linha sem vínculo</strong>: a pessoa existe no cadastro, mas o RDO guardou só o texto; o relatório já a reconhece pelo nome, mas o apontador deve selecionar do cadastro.
              </p>
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b border-gray-200">{["Tipo", "Nome no RDO", "Situação", "Cadastro", "Vezes", "Datas", "Obras", "Apontador", ""].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {semVinc.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-gray-400">🎉 Todos os lançamentos do período estão ligados ao cadastro.</td></tr>}
                  {semVinc.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-1.5">{s.tipo === "pessoa" ? "Funcionário" : "Equipamento"}</td>
                      <td className="px-3 py-1.5 font-semibold">{s.nome}</td>
                      <td className="px-3 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.situacao === "sem_cadastro" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{s.situacao === "sem_cadastro" ? "Sem cadastro" : "Linha sem vínculo"}</span></td>
                      <td className="px-3 py-1.5">{s.cadastroNome || "—"}</td>
                      <td className="px-3 py-1.5 text-center">{s.ocorrencias}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={s.datas.map(dm).join(", ")}>{s.datas.slice(0, 6).map(dm).join(", ")}{s.datas.length > 6 ? "…" : ""}</td>
                      <td className="px-3 py-1.5 max-w-[240px] truncate" title={s.obras.join(" | ")}>{s.obras.join(" | ")}</td>
                      <td className="px-3 py-1.5 max-w-[160px] truncate">{s.apontadores.join(", ") || "—"}</td>
                      <td className="px-3 py-1.5 no-print"><button title="Copiar cobrança" className="p-1.5 rounded border border-gray-200 hover:bg-gray-100"
                        onClick={() => copiar(`Lançamento sem vínculo com o cadastro no RDO\n${s.tipo === "pessoa" ? "Nome" : "Frota"} digitado: "${s.nome}"\n${s.situacao === "vinculavel" ? `Existe no cadastro como: ${s.cadastroNome}\n` : "Não encontrado no cadastro.\n"}Dias: ${s.datas.map(dm).join(", ")}\nFavor corrigir o RDO selecionando a opção do cadastro${s.situacao === "sem_cadastro" ? " (ou solicitar o cadastro, se for novo)" : ""}.`)}><Copy size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print" onClick={() => setModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-800 text-white px-5 py-3 rounded-t-2xl flex items-center justify-between">
                <div><h3 className="font-bold">{modal.titulo}</h3><p className="text-slate-300 text-sm">{dmy(modal.cell.date)} ({wd(modal.cell.date)}) — {CELL[modal.cell.state].label}</p></div>
                <button onClick={() => setModal(null)} className="text-2xl leading-none text-white/70 hover:text-white">×</button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                {modal.cell.note && <p className="text-slate-700">{modal.cell.note}</p>}
                {modal.cell.rdo.map(r => (
                  <div key={r.rdoId} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="font-semibold text-slate-800">{r.obra}</div>
                    <div className="text-xs text-gray-500">OGS {r.ogs || "—"}{r.equipe ? ` · ${r.equipe}` : ""}</div>
                    <div className="text-xs text-gray-500">Apontador: {r.apontador || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
