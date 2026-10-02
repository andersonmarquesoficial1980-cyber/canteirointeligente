import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyDraftDecisions, buildBulkChanges, buildPersonPeriodChanges, buildTeamPeriodChanges, mapPastedOgs, type MdoBaseDay, type MdoDecision, type MdoDisposition } from "@/lib/mdoWorkbench";

type Periodo = {
  id: string; data_inicio: string; data_fim: string; versao: number;
  status: "rascunho" | "aprovado"; revisao: number; aprovado_em: string | null; total_linhas: number | null;
};
type Ogs = { id: string; ogs_number: string | null };
type EmployeeLookup = { id: string; name: string; matricula: string | null; equipe: string | null;
  status: string | null; data_admissao: string | null; data_demissao: string | null };
type CostUser = { user_id: string; nome: string; email: string; permitido: boolean };
type Fechado = {
  employee_id: string; dia: string; nome: string; funcao: string | null;
  equipe: string | null; matricula: string | null; ogs_rdo: string | null;
  ogs_custos: string | null; disposicao: string; motivo: string; rdo_ids: string | null;
};

const PAGE_SIZE = 120;
const db = supabase as any; // As tabelas/RPCs passam a existir após a migração versionada.
const foldSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

async function fetchAll<T>(table: string, query: (q: any) => any, columns = "*"): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(db.from(table).select(columns)).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return rows;
}

export function MdoConferencia({ companyId, inicio, fim, grade, canEdit, canApprove, reportReady = grade.length > 0, reportLoading = false, onLoadReport }: {
  companyId: string; inicio: string; fim: string; grade: MdoBaseDay[];
  canEdit: boolean; canApprove: boolean; reportReady?: boolean; reportLoading?: boolean; onLoadReport?: () => Promise<void>;
}) {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [draft, setDraft] = useState<Periodo | null>(null);
  const [decisions, setDecisions] = useState<MdoDecision[]>([]);
  const [ogs, setOgs] = useState<Ogs[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("pendentes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [disposition, setDisposition] = useState<MdoDisposition>("ogs");
  const [ogsId, setOgsId] = useState("");
  const [reason, setReason] = useState("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [approvedId, setApprovedId] = useState("");
  const [editingCell, setEditingCell] = useState("");
  const [costUsers, setCostUsers] = useState<CostUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [team, setTeam] = useState("");
  const [editMode, setEditMode] = useState<"equipe" | "funcionario">("equipe");
  const [personId, setPersonId] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [roster, setRoster] = useState<EmployeeLookup[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [teamStart, setTeamStart] = useState(inicio);
  const [teamEnd, setTeamEnd] = useState(fim);
  const [teamOgsId, setTeamOgsId] = useState("");
  const [replaceAllocated, setReplaceAllocated] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");

  const reloadPeriods = async () => {
    const { data, error } = await db.from("mdo_custos_periodos").select("*")
      .eq("company_id", companyId).eq("data_inicio", inicio).eq("data_fim", fim)
      .order("versao", { ascending: false });
    if (error) throw error;
    const all = (data || []) as Periodo[];
    setPeriodos(all);
    setDraft(all.find((p) => p.status === "rascunho") || null);
    setApprovedId((prev) => all.some((p) => p.id === prev && p.status === "aprovado")
      ? prev : (all.find((p) => p.status === "aprovado")?.id || ""));
    return all;
  };

  const reloadDecisions = async (period: Periodo | undefined) => {
    if (!period || !canEdit) { setDecisions([]); return; }
    // A chave (dia, employee_id) é única no período. Ordenar só por dia causa
    // sobreposição entre páginas de 500 e falsas pendências em dias como 11/09.
    const loaded = await fetchAll<any>("mdo_custos_decisoes", (q) => q.eq("periodo_id", period.id).order("dia").order("employee_id"));
    setDecisions(loaded.map((d) => ({
      employee_id: d.employee_id, data: d.dia,
      disposition: d.disposicao === "excecao" ? "exception" : d.disposicao === "excluir" ? "exclude" : "ogs",
      ogs_id: d.ogs_id, ogs_number: ogs.find((o) => o.id === d.ogs_id)?.ogs_number || null,
      reason: d.motivo, include: d.disposicao !== "excluir",
    })));
  };

  useEffect(() => {
    setSelected(new Set()); setPage(0); setDraft(null); setDecisions([]);
    setTeam(""); setPersonId(""); setPersonSearch(""); setTeamStart(inicio); setTeamEnd(fim);
    setTeamOgsId(""); setReplaceAllocated(false); setSearch(""); setFilter("pendentes");
    reloadPeriods().catch((err) => toast.error(`Não foi possível carregar a conferência: ${err.message}`));
    // OGS é lida apenas pelo editor; Custos consome exclusivamente o fechamento publicado.
    if (canEdit) fetchAll<Ogs>("ogs_reference", (q) => q.eq("company_id", companyId).order("ogs_number"))
      .then(setOgs).catch((err) => toast.error(`Falha ao buscar OGS: ${err.message}`));
  }, [companyId, inicio, fim, canEdit]);

  // Pessoas e equipes independentes dos RDOs: a grade só carrega após escolher o alvo.
  useEffect(() => {
    if (!canEdit || !companyId) { setRoster([]); return; }
    let active = true;
    setRoster([]); setRosterLoading(true);
    fetchAll<EmployeeLookup>("employees", (q) => q.eq("company_id", companyId).order("name"),
      "id,name,matricula,equipe,status,data_admissao,data_demissao")
      .then((rows) => { if (active) setRoster(rows.filter((e) =>
        (!e.data_admissao || e.data_admissao <= fim) && (!e.data_demissao || e.data_demissao >= inicio)
        && (e.status === "ativo" || Boolean(e.data_demissao)))); })
      .catch((err) => { if (active) toast.error(`Não foi possível listar funcionários: ${err.message}`); })
      .finally(() => { if (active) setRosterLoading(false); });
    return () => { active = false; };
  }, [companyId, inicio, fim, canEdit]);

  useEffect(() => {
    reloadDecisions(draft || undefined).catch((err) => toast.error(`Falha ao carregar ajustes: ${err.message}`));
  }, [draft?.id, ogs]);

  useEffect(() => {
    if (!canApprove) return;
    db.rpc("mdo_custos_listar_acessos", { p_empresa: companyId }).then(({ data, error }: any) => {
      if (error) toast.error(`Não foi possível listar os acessos: ${error.message}`);
      else setCostUsers(data || []);
    });
  }, [companyId, canApprove]);

  const setCostAccess = async (user: CostUser) => {
    if (!window.confirm(`${user.permitido ? "Remover" : "Liberar"} a exportação aprovada para ${user.nome}? Esta permissão é individual e não dá acesso a rascunhos.`)) return;
    setBusy(true);
    try {
      const { error } = await db.rpc("mdo_custos_definir_exportador", {
        p_empresa: companyId, p_usuario: user.user_id, p_permitir: !user.permitido,
      });
      if (error) throw error;
      const { data, error: readError } = await db.rpc("mdo_custos_listar_acessos", { p_empresa: companyId });
      if (readError) throw readError;
      setCostUsers(data || []);
      toast.success("Permissão conferida e atualizada");
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const displayed = useMemo(() => applyDraftDecisions(grade, decisions), [grade, decisions]);
  const teams = useMemo(() => [...new Set([
    ...roster.map((e) => (e.equipe || "SEM EQUIPE").trim() || "SEM EQUIPE"),
    ...grade.map((r) => r.equipe),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR")), [grade, roster]);
  const people = useMemo(() => [...new Map([
    ...roster.map((e) => [e.id, { id: e.id, nome: e.name || "", matricula: e.matricula || "-", equipe: e.equipe || "SEM EQUIPE" }] as const),
    ...grade.map((r) => [r.employee_id, { id: r.employee_id, nome: r.funcionario, matricula: r.matricula, equipe: r.equipe }] as const),
  ]).values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [grade, roster]);
  const selectedPerson = people.find((p) => p.id === personId);
  const personQuery = foldSearch(personSearch);
  const peopleOptions = personQuery ? people.filter((p) => foldSearch(`${p.nome} ${p.matricula} ${p.equipe}`).includes(personQuery)) : [];
  const targetChosen = editMode === "equipe" ? !!team : Boolean(selectedPerson && reportReady && grade.some((r) => r.employee_id === selectedPerson.id));
  const scoped = useMemo(() => displayed.filter((r) => (editMode === "equipe" ? team && r.equipe === team : personId && r.employee_id === personId)
    && r.data >= teamStart && r.data <= teamEnd), [displayed, editMode, team, personId, teamStart, teamEnd]);
  const teamOgs = ogs.find((o) => o.id === teamOgsId);
  const periodChanges = useMemo(() => editMode === "equipe"
    ? buildTeamPeriodChanges(displayed, team, teamStart, teamEnd, teamOgs || { id: "", ogs_number: null }, replaceAllocated)
    : buildPersonPeriodChanges(displayed, selectedPerson?.id || "", teamStart, teamEnd, teamOgs || { id: "", ogs_number: null }, replaceAllocated),
  [displayed, editMode, team, selectedPerson?.id, teamStart, teamEnd, teamOgsId, ogs, replaceAllocated]);
  const filtered = useMemo(() => scoped.filter((r) => {
    if (filter === "pendentes" && r.situacao !== "PENDENTE") return false;
    if (filter === "sem_rdo" && r.presenca_rdo !== "NAO") return false;
    if (filter === "excluidos" && r.situacao !== "FORA DE CUSTOS") return false;
    if (filter === "todos" || filter === "pendentes" || filter === "sem_rdo" || filter === "excluidos") {
      return !search || `${r.funcionario} ${r.equipe} ${r.data} ${r.ogs_rdo}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    }
    return true;
  }), [scoped, filter, search]);
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pending = displayed.filter((r) => r.situacao === "PENDENTE").length;
  const pendingScope = scoped.filter((r) => r.situacao === "PENDENTE").length;
  const selectedRows = displayed.filter((r) => selected.has(`${r.employee_id}|${r.data}`));

  const ensureDraft = async (): Promise<Periodo> => {
    if (draft) return draft;
    const { data, error } = await db.rpc("mdo_custos_abrir", { p_empresa: companyId, p_inicio: inicio, p_fim: fim });
    if (error) throw error;
    const all = await reloadPeriods();
    const current = all.find((p) => p.id === data);
    if (!current) throw Error("Rascunho criado mas indisponível para leitura");
    setDraft(current);
    return current;
  };

  const openDraft = async () => {
    setBusy(true);
    try {
      const current = await ensureDraft();
      toast.success(`Conferência versão ${current.versao} aberta`);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const save = async (cells: MdoDecision[], target: Periodo | null = draft) => {
    if (!target || !cells.length) return;
    setBusy(true);
    try {
      let revision = target.revisao;
      for (let offset = 0; offset < cells.length; offset += 200) {
        setSaveProgress(`Salvando ${offset + 1}–${Math.min(offset + 200, cells.length)} de ${cells.length} dias...`);
        const batch = cells.slice(offset, offset + 200);
        const { data, error } = await db.rpc("mdo_custos_alterar", {
          p_periodo: target.id, p_revisao: revision, p_celulas: batch,
        });
        if (error) throw error;
        revision = data;
      }
      setDraft({ ...target, revisao: revision });
      await reloadDecisions({ ...target, revisao: revision });
      setSelected(new Set());
      toast.success(`${cells.length} funcionário(s)/dia atualizado(s). Revise antes de aprovar.`);
    } catch (err: any) {
      const all = await reloadPeriods();
      await reloadDecisions(all.find((p) => p.status === "rascunho"));
      toast.error(`Lote interrompido: ${err.message}. Atualize e confira o que foi salvo.`);
    } finally { setBusy(false); setSaveProgress(""); }
  };

  const applyPeriod = async () => {
    if (!reportReady) return toast.error("Carregue o relatório completo antes de aplicar OGS");
    if (!targetChosen || teamStart < inicio || teamEnd > fim || teamStart > teamEnd) return toast.error("Escolha uma equipe ou funcionário e datas dentro do período do relatório");
    if (!teamOgs) return toast.error("Escolha a OGS para aplicar");
    if (!periodChanges.length) return toast.error("Não há dias elegíveis para essa alteração");
    const affected = new Set(periodChanges.map((c) => c.employee_id)).size;
    const target = editMode === "equipe" ? `Equipe: ${team}` : `Funcionário: ${selectedPerson?.nome} · matrícula ${selectedPerson?.matricula} · equipe ${selectedPerson?.equipe}`;
    if (!window.confirm(`${target}\nDatas: ${teamStart} a ${teamEnd}\nOGS: ${teamOgs.ogs_number}\n${affected} funcionário(s) · ${periodChanges.length} dias.\n${replaceAllocated ? "Inclui substituição de OGS já atribuídas." : "Somente dias pendentes; OGS existentes preservadas."}\nJustificativas e exclusões são preservadas. ${draft ? "" : "Será criado um rascunho. "}Confirmar?`)) return;
    setBusy(true);
    try {
      const current = await ensureDraft();
      await save(periodChanges, current);
    } catch (err: any) { toast.error(`Não foi possível abrir a conferência: ${err.message}`); }
    finally { setBusy(false); }
  };

  const applyBulk = () => {
    if (!draft) return toast.error("Abra uma conferência para editar");
    if (!selectedRows.length) return toast.error("Selecione funcionário(s)/dia na tabela");
    if (disposition === "ogs" && !ogsId) return toast.error("Selecione uma OGS válida");
    if (disposition !== "ogs" && reason.trim().length < 3) return toast.error("Informe um motivo (mínimo 3 caracteres)");
    const input = { disposition, ogs_id: disposition === "ogs" ? ogsId : null, reason: reason.trim(), include: disposition !== "exclude" };
    const cells = buildBulkChanges(displayed, selected, input);
    if (!window.confirm(`Aplicar ${disposition === "ogs" ? ogs.find((o) => o.id === ogsId)?.ogs_number : disposition === "exclude" ? "exclusão" : "justificativa"} a ${cells.length} funcionário(s)/dia? Alterações no RDO original não serão feitas.`)) return;
    void save(cells);
  };

  const pasteOgs = () => {
    if (!draft || !selectedRows.length) return toast.error("Abra o rascunho e selecione as células");
    try {
      const cells = mapPastedOgs(selectedRows, paste, ogs);
      if (!window.confirm(`Colar ${cells.length} OGS na ordem das linhas selecionadas? Primeira: ${cells[0].ogs_number} → ${selectedRows[0].funcionario} ${selectedRows[0].data}. Confira a ordem antes de confirmar.`)) return;
      void save(cells).then(() => setPaste(""));
    } catch (err: any) { toast.error(err.message); }
  };

  const approve = async () => {
    if (!draft || !canApprove) return;
    if (pending > 0) return toast.error(`${pending} dias ainda precisam de OGS, justificativa ou exclusão`);
    if (!window.confirm(`Aprovar a versão ${draft.versao} para Custos? O fechamento será imutável. Verifique divergências antes de confirmar.`)) return;
    setBusy(true);
    try {
      const { data, error } = await db.rpc("mdo_custos_aprovar", { p_periodo: draft.id, p_revisao: draft.revisao });
      if (error) throw error;
      setDraft(null); setDecisions([]); setSelected(new Set());
      await reloadPeriods();
      toast.success(`${data} funcionário(s)/dia aprovados na versão ${draft.versao}`);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const exportApproved = async () => {
    if (!approvedId || !periodos.some((p) => p.id === approvedId && p.status === "aprovado")) return;
    setBusy(true);
    try {
      const source = await fetchAll<Fechado>("mdo_custos_fechado", (q) => q.eq("periodo_id", approvedId)
        .neq("disposicao", "excluir").order("employee_id").order("dia"));
      if (!source.length) throw Error("Fechamento vazio; exportação cancelada");
      const selectedPeriod = periodos.find((p) => p.id === approvedId)!;
      if (!selectedPeriod.total_linhas || source.length !== selectedPeriod.total_linhas)
        throw Error(`Fechamento incompleto: ${source.length} de ${selectedPeriod.total_linhas || "?"} linhas; nenhum arquivo foi gerado`);
      const wb = XLSX.utils.book_new();
      const main = source.map((r) => ({
        DATA: new Date(`${r.dia}T12:00:00`), FUNCIONARIO: r.nome, MATRICULA: r.matricula || "-", FUNCAO: r.funcao || "-",
        EQUIPE: r.equipe || "-", OGS_RDO: r.ogs_rdo || "-", OGS_CUSTOS: r.ogs_custos || "-",
        SITUACAO: r.disposicao === "excecao" ? "JUSTIFICADO" : "ALOCADO", MOTIVO: r.motivo || "-", RDO_IDS: r.rdo_ids || "-",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { CAMPO: "Período", VALOR: `${inicio} a ${fim}` },
        { CAMPO: "Versão aprovada", VALOR: selectedPeriod.versao },
        { CAMPO: "Aprovada em", VALOR: selectedPeriod.aprovado_em || "-" },
        { CAMPO: "Linhas incluídas", VALOR: main.length },
      ]), "RESUMO");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(main, { cellDates: true, dateNF: "dd/mm/yyyy" }), "MDO_CUSTOS");
      XLSX.writeFile(wb, `WF_MDO_CUSTOS_${inicio}_${fim}_v${selectedPeriod.versao}.xlsx`, { cellDates: true });
      toast.success(`Exportação da versão ${selectedPeriod.versao}: ${main.length} linhas incluídas`);
    } catch (err: any) { toast.error(`Exportação cancelada: ${err.message}`); } finally { setBusy(false); }
  };

  return <section className="rounded-xl border bg-card p-4 space-y-3" aria-label="Conferência MDO para Custos">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-bold">Conferência MDO para Custos</h2>
        <p className="text-xs text-muted-foreground">OGS do RDO é o dado original. OGS para Custos só muda nesta conferência; sem RDO não significa falta ao trabalho.</p></div>
      {canEdit && <Button onClick={openDraft} disabled={busy || !!draft || !grade.length}> {draft ? `Rascunho v${draft.versao} · revisão ${draft.revisao}` : "Abrir nova conferência"}</Button>}
    </div>
    {periodos.some((p) => p.status === "aprovado") && <div className="flex flex-wrap gap-2 items-center rounded-md border p-2">
      <span className="text-sm font-medium">Versão aprovada:</span>
      <select className="border rounded px-2 py-1 bg-background" value={approvedId} onChange={(e) => setApprovedId(e.target.value)}>
        {periodos.filter((p) => p.status === "aprovado").map((p) => <option key={p.id} value={p.id}>v{p.versao} · {p.aprovado_em?.slice(0, 10)}</option>)}
      </select>
      <Button variant="outline" disabled={busy} onClick={exportApproved}>Exportar Excel aprovado</Button>
      <span className="text-xs text-muted-foreground">Somente versão congelada; nunca o rascunho.</span>
    </div>}
    {!canEdit && !approvedId && <p className="text-sm">Não existe versão aprovada para este período. Custos não pode exportar um rascunho.</p>}
    {canApprove && <details className="border rounded p-2 text-sm"><summary className="font-semibold cursor-pointer">Quem pode exportar para Custos</summary>
      <p className="text-xs text-muted-foreground my-2">Conceda somente a pessoas autorizadas. O acesso ao módulo WF Relatórios e ao tipo MDO também deve estar habilitado no Painel de Permissões.</p>
      <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Buscar usuário de Custos" className="w-64 mb-2" />
      <div className="max-h-60 overflow-auto space-y-1">{costUsers.filter((u) => `${u.nome} ${u.email}`.toLocaleLowerCase("pt-BR").includes(userSearch.toLocaleLowerCase("pt-BR"))).map((u) =>
        <div className="flex items-center justify-between border-b py-1 gap-2" key={u.user_id}><span>{u.nome} <small className="text-muted-foreground">{u.email}</small></span>
          <Button size="sm" variant={u.permitido ? "outline" : "default"} disabled={busy} onClick={() => setCostAccess(u)}>{u.permitido ? "Revogar exportação" : "Permitir exportação"}</Button></div>)}</div>
    </details>}
    {canEdit && <>
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">{editMode === "equipe" ? "Editar equipe por período" : "Editar funcionário por período"}</h3>
        <p className="text-xs text-muted-foreground">{editMode === "equipe" ? "Escolha a equipe do cadastro atual (ex.: CBUQ03 - GIVANILDO), as datas e uma OGS. Não altera RDO nem outras equipes." : "Busque um funcionário do relatório, defina as datas e uma OGS. Não altera RDO nem outros funcionários."}</p>
        <label className="text-sm space-y-1 inline-block">Editar por
          <select aria-label="Editar por" className="border rounded p-2 bg-background w-full" value={editMode}
            onChange={(e) => { setEditMode(e.target.value as "equipe" | "funcionario"); setSelected(new Set()); setSearch(""); setFilter("pendentes"); setPage(0); }}>
            <option value="equipe">Equipe</option><option value="funcionario">Funcionário</option>
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {editMode === "equipe" ? <label className="text-sm space-y-1">Equipe
            <select aria-label="Equipe para conferência MDO" className="border rounded p-2 bg-background w-full" value={team}
              onChange={(e) => { const chosen = e.target.value; setTeam(chosen); setSelected(new Set()); setSearch(""); setPage(0);
                if (chosen && !reportReady && !reportLoading && onLoadReport) void onLoadReport().catch((err) => toast.error(`Não foi possível carregar o relatório: ${err.message}`)); }}>
              <option value="">{rosterLoading && !teams.length ? "Carregando equipes..." : "Selecione uma equipe"}</option>
              {teams.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {team && !reportReady && <span className="block text-xs text-muted-foreground">{reportLoading ? "Carregando relatório completo para conferir os dias..." : "Relatório não carregado. Clique em Buscar no topo se a carga automática falhar."} A aplicação fica bloqueada até a grade estar pronta.</span>}
          </label> : <div className="space-y-1"><label className="text-sm block" htmlFor="mdo-person-search">Buscar funcionário</label>
            <Input id="mdo-person-search" aria-label="Buscar funcionário para conferência MDO" value={personSearch}
              onChange={(e) => { setPersonSearch(e.target.value); setPersonId(""); setSelected(new Set()); setSearch(""); setPage(0); }} placeholder="Digite nome ou matrícula" />
            {selectedPerson && !personQuery && <p className="text-sm rounded border p-2 bg-muted/40">Selecionado: {selectedPerson.nome} · {selectedPerson.matricula} · {selectedPerson.equipe}
              {!reportReady && <span className="block text-xs">{reportLoading ? "Carregando relatório completo para conferir os dias..." : "Relatório não carregado. Clique em Buscar no topo se a carga automática falhar."} Nenhuma OGS será aplicada até a grade ficar pronta.</span>}</p>}
            {personQuery && <div className="rounded border bg-background max-h-48 overflow-auto" aria-label="Resultados da busca de funcionários">
              {peopleOptions.length ? peopleOptions.slice(0, 20).map((person) => <button type="button" key={person.id}
                className="block text-left text-sm w-full p-2 hover:bg-muted focus-visible:bg-muted border-b"
                onClick={() => { setPersonId(person.id); setPersonSearch(""); setSelected(new Set()); setSearch(""); setPage(0);
                  if (!reportReady && !reportLoading && onLoadReport) void onLoadReport().catch((err) => toast.error(`Não foi possível carregar o relatório: ${err.message}`)); }}>
                {person.nome} · {person.matricula} · {person.equipe}
              </button>) : <p className="text-xs p-2" role="status">{rosterLoading ? "Carregando funcionários..." : "Nenhum funcionário encontrado neste período. Confira o nome e as datas."}</p>}
              {peopleOptions.length > 20 && <p className="text-xs p-2">Mostrando 20 de {peopleOptions.length}; digite mais letras para refinar.</p>}
            </div>}
            {!people.length && !rosterLoading && <p className="text-xs text-muted-foreground">Nenhum funcionário elegível encontrado para as datas selecionadas.</p>}
          </div>}
          <label className="text-sm space-y-1">De
            <Input aria-label={`Início da edição ${editMode === "equipe" ? "da equipe" : "do funcionário"}`} type="date" min={inicio} max={fim} value={teamStart}
              onChange={(e) => { setTeamStart(e.target.value); setSelected(new Set()); setPage(0); }} />
          </label>
          <label className="text-sm space-y-1">Até
            <Input aria-label={`Fim da edição ${editMode === "equipe" ? "da equipe" : "do funcionário"}`} type="date" min={inicio} max={fim} value={teamEnd}
              onChange={(e) => { setTeamEnd(e.target.value); setSelected(new Set()); setPage(0); }} />
          </label>
          <label className="text-sm space-y-1">OGS para Custos
            <select aria-label={editMode === "equipe" ? "OGS para período da equipe" : "OGS para período"} className="border rounded p-2 bg-background w-full" value={teamOgsId} onChange={(e) => setTeamOgsId(e.target.value)}>
              <option value="">Selecione a OGS</option>{ogs.filter((o) => o.ogs_number?.trim()).map((o) => <option key={o.id} value={o.id}>{o.ogs_number}</option>)}
            </select>
          </label>
        </div>
        {targetChosen && <p className="text-sm" role="status"><strong>{new Set(scoped.map((r) => r.employee_id)).size} funcionário(s)</strong> · {scoped.length} funcionário/dia no período · <strong className="text-amber-700">{pendingScope} pendentes</strong> {editMode === "equipe" ? "na equipe" : "do funcionário"}. A aprovação considera todas as equipes ({pending} pendentes no relatório).</p>}
        <label className="text-xs inline-flex gap-2 items-center"><input type="checkbox" checked={replaceAllocated} onChange={(e) => setReplaceAllocated(e.target.checked)} />Substituir também OGS já atribuídas (não altera justificativas nem exclusões)</label>
        <div className="flex items-center flex-wrap gap-3"><Button disabled={busy || !targetChosen || !teamOgs || !periodChanges.length || teamStart < inicio || teamEnd > fim || teamStart > teamEnd} onClick={applyPeriod}>
          {teamOgs ? `Aplicar OGS ${editMode === "equipe" ? "à equipe" : "ao funcionário"} · ${periodChanges.length} ${periodChanges.length === 1 ? "dia" : "dias"}` : "Selecione a OGS para aplicar"}</Button>
          <span className="text-xs text-muted-foreground">{teamOgs ? `${new Set(periodChanges.map((c) => c.employee_id)).size} pessoa(s) afetada(s). ${replaceAllocated ? "Substitui OGS alocadas." : "Só dias pendentes; preserva OGS existentes."}` : "Selecione uma OGS para pré-visualizar o impacto."}</span></div>
        {saveProgress && <p role="status" className="text-sm">{saveProgress}</p>}
      </div>
      {targetChosen ? <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong>Revisão {editMode === "equipe" ? "da equipe" : "do funcionário"}</strong>
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar funcionário ou OGS" className="w-64" />
        <select aria-label={`Situação ${editMode === "equipe" ? "na equipe" : "do funcionário"}`} className="border rounded px-2 py-2 bg-background" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); setSelected(new Set()); }}>
          <option value="pendentes">Somente pendentes</option><option value="sem_rdo">Sem RDO</option>
          <option value="excluidos">Fora de Custos</option><option value="todos">Todos</option>
        </select>
      </div> : <p className="text-sm text-muted-foreground">Selecione {editMode === "equipe" ? "uma equipe" : "um funcionário"} acima para revisar os dias.</p>}
      {targetChosen && <details className="border rounded p-2 text-sm"><summary className="cursor-pointer font-medium">Ajustes individuais e exceções</summary>
        <div className="flex flex-wrap gap-2 items-center pt-3">
          <Button variant="outline" disabled={!draft || busy || !shown.length} onClick={() => setSelected(new Set(shown.map((r) => `${r.employee_id}|${r.data}`)))}>Selecionar página ({shown.length})</Button>
          <Button variant="outline" disabled={!draft || busy || !filtered.length} onClick={() => setSelected(new Set(filtered.map((r) => `${r.employee_id}|${r.data}`)))}>Selecionar filtro ({filtered.length})</Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button><strong>{selected.size} selecionados</strong>
          <select aria-label="Ação para células selecionadas" className="border rounded px-2 py-2 bg-background" value={disposition} onChange={(e) => setDisposition(e.target.value as MdoDisposition)}>
            <option value="ogs">Atribuir OGS</option><option value="exception">Justificar sem OGS</option><option value="exclude">Não enviar para Custos</option>
          </select>
          {disposition === "ogs" ? <select aria-label="OGS para células selecionadas" className="border rounded px-2 py-2 bg-background max-w-48" value={ogsId} onChange={(e) => setOgsId(e.target.value)}>
            <option value="">Escolha a OGS</option>{ogs.filter((o) => o.ogs_number).map((o) => <option key={o.id} value={o.id}>{o.ogs_number}</option>)}
          </select> : <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo obrigatório" className="w-52" />}
          <Button disabled={!draft || busy || !selected.size} onClick={applyBulk}>Aplicar selecionados</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs pt-2">
          <label htmlFor="mdo-paste" className="font-semibold">Colar OGS (uma por linha, na ordem das células selecionadas)</label>
          <textarea id="mdo-paste" className="border rounded p-2 bg-background w-56 h-16" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="OGS-101&#10;OGS-102" />
          <Button variant="outline" disabled={!draft || busy || !selected.size || !paste.trim()} onClick={pasteOgs}>Conferir e colar</Button>
        </div>
      </details>}
      <div className="border rounded-md overflow-auto max-h-[550px]">
        <table className="w-full text-xs"><thead className="sticky top-0 bg-card z-10"><tr className="border-b">
          <th className="p-2">Sel.</th><th className="p-2 text-left">Data</th><th className="p-2 text-left">Funcionário</th>
          <th className="p-2 text-left">Equipe</th><th className="p-2 text-left">OGS do RDO</th><th className="p-2 text-left">OGS para Custos</th>
          <th className="p-2 text-left">Situação</th><th className="p-2 text-left">Motivo</th><th className="p-2 text-left">Editar</th></tr></thead><tbody>
          {shown.map((r) => { const key = `${r.employee_id}|${r.data}`; return <tr className="border-b" key={key}>
            <td className="p-2"><input type="checkbox" disabled={!draft || busy} checked={selected.has(key)} aria-label={`Selecionar ${r.funcionario} ${r.data}`} onChange={(e) => setSelected((prev) => { const next = new Set(prev); e.target.checked ? next.add(key) : next.delete(key); return next; })} /></td>
            <td className="p-2 whitespace-nowrap">{r.data.split("-").reverse().join("/")}</td>
            <td className="p-2 font-medium whitespace-nowrap">{r.funcionario}</td><td className="p-2">{r.equipe}</td>
            <td className="p-2">{r.ogs_rdo}</td><td className="p-2 font-bold">{r.ogs_custos}</td>
            <td className="p-2">{r.situacao}</td><td className="p-2">{r.motivo || "-"}</td>
            <td className="p-2">{editingCell === key ? <select autoFocus className="border rounded bg-background p-1" defaultValue="" aria-label={`OGS para ${r.funcionario} em ${r.data}`}
              onChange={(e) => {
                const item = ogs.find((o) => o.id === e.target.value);
                if (!item) return;
                setEditingCell("");
                void save([{ employee_id: r.employee_id, data: r.data, disposition: "ogs", ogs_id: item.id, ogs_number: item.ogs_number, reason: "", include: true }]);
              }} onBlur={() => setEditingCell("")}>
                <option value="">Escolha OGS</option>{ogs.filter((o) => o.ogs_number).map((o) => <option key={o.id} value={o.id}>{o.ogs_number}</option>)}
              </select> : <Button variant="ghost" size="sm" disabled={!draft || busy} onClick={() => setEditingCell(key)}>OGS</Button>}</td>
          </tr>; })}</tbody></table>
      </div>
      <div className="flex justify-between items-center text-sm"><span>{filtered.length} resultados · página {page + 1}</span>
        <div className="flex gap-2"><Button variant="outline" disabled={!page} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div></div>
      {canApprove && <div className="flex items-center gap-2 border-t pt-3"><Button disabled={!draft || busy || pending > 0 || !grade.length} onClick={approve}>Aprovar e liberar versão para Custos</Button>
        <span className="text-xs text-muted-foreground">Após aprovação, mudanças exigem uma nova versão.</span></div>}
    </>}
  </section>;
}
