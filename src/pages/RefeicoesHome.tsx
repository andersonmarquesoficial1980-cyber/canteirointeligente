import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardCopy, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { useToast } from "@/hooks/use-toast";

// Tipos locais até a migração ser aplicada e os tipos do Supabase regenerados.
const db = supabase as SupabaseClient;
type Employee = { id: string; name: string; equipe: string | null; matricula: string | null };
type Order = { id: string; meal_date: string; shift: string; supplier: string; status: string; delivered_quantity: number | null; delivery_note: string | null; closed_at: string | null; updated_at: string };
type Person = { employee_id: string; employee_name: string; team_name: string; active: boolean };
const teamOf = (e: Employee) => e.equipe?.trim() || "Sem equipe";
const todaySP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function RefeicoesHome() {
  const navigate = useNavigate();
  const { profile, loading: loadingProfile } = useUserProfile();
  const { permissions, loading: loadingPermissions } = usePermissions();
  const { isSuperAdmin, loading: loadingModules } = useCompanyModules();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [date, setDate] = useState(todaySP);
  const [shift, setShift] = useState<"diurno" | "noturno">("diurno");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [delivered, setDelivered] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const requestId = useRef(0);
  const companyId = profile?.company_id || (isSuperAdmin ? selectedCompany : null);
  const permitted = isSuperAdmin || permissions?.modulo_refeicoes === true;
  const manager = isSuperAdmin || permissions?.refeicoes_gestor === true;

  useEffect(() => {
    if (!isSuperAdmin || profile?.company_id) return;
    let cancelled = false;
    supabase.from("companies").select("id,name").order("name").then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast({ title: "Falha ao listar empresas", description: error.message, variant: "destructive" });
      else setCompanies(data || []);
    });
    return () => { cancelled = true; };
  }, [isSuperAdmin, profile?.company_id, toast]);

  const reload = useCallback(async () => {
    if (!companyId || !date) return;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const { data: found, error: orderError } = await db.from("meal_orders").select("*")
        .eq("company_id", companyId).eq("meal_date", date).eq("shift", shift).maybeSingle();
      if (orderError) throw orderError;
      const current = found as Order | null;
      const list: Person[] = [];
      if (current) for (let offset = 0; ; offset += 500) {
        const { data, error } = await db.from("meal_order_people").select("employee_id,employee_name,team_name,active")
          .eq("company_id", companyId).eq("order_id", current.id).eq("active", true).order("employee_id").range(offset, offset + 499);
        if (error) throw error;
        list.push(...((data || []) as Person[]));
        if (!data || data.length < 500) break;
      }
      if (request !== requestId.current) return;
      setOrder(current);
      setPeople(list);
      setSelected(list.map(p => p.employee_id));
      setDelivered(current?.delivered_quantity?.toString() || "");
      setNote(current?.delivery_note || "");
      setDirty(false);
    } catch (error) {
      if (request === requestId.current) toast({ title: "Não foi possível carregar o pedido", description: String(error), variant: "destructive" });
    } finally { if (request === requestId.current) setLoading(false); }
  }, [companyId, date, shift, toast]);

  useEffect(() => { if (companyId && permitted) void reload(); }, [companyId, permitted, reload]);
  useEffect(() => {
    if (!companyId || !permitted) return;
    let cancelled = false;
    (async () => {
      try {
        const all: Employee[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await db.rpc("meals_list_employees", { p_company_id: companyId, p_offset: offset });
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        if (!cancelled) setEmployees(all.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      } catch (error) {
        toast({ title: "Erro ao carregar funcionários", description: String(error), variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, permitted, toast]);

  const teams = useMemo(() => [...new Set(employees.map(teamOf))].sort((a, b) => a.localeCompare(b, "pt-BR")), [employees]);
  const visible = useMemo(() => employees.filter(e =>
    (teamFilter === "Todas" || teamOf(e) === teamFilter) &&
    `${e.name} ${e.matricula || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ), [employees, teamFilter, query]);
  const savedGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const person of people) groups.set(person.team_name, (groups.get(person.team_name) || 0) + 1);
    return [...groups].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [people]);
  const selectedGroups = useMemo(() => {
    const groups = new Map<string, number>();
    const ids = new Set(selected);
    for (const employee of employees) if (ids.has(employee.id)) groups.set(teamOf(employee), (groups.get(teamOf(employee)) || 0) + 1);
    return [...groups].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [employees, selected]);
  const labelDate = date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "";
  const message = `Pedido de marmitas — Fremix\nFornecedor: ${order?.supplier || "Luana – Sabor Delícia"}\nData da refeição: ${labelDate} | Turno: ${shift}\n${savedGroups.map(([team, quantity]) => `${team}: ${quantity}`).join("\n")}\nTOTAL: ${people.length} marmitas`;

  function toggle(id: string) {
    setSelected(previous => previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]);
    setDirty(true);
  }
  async function run(action: () => PromiseLike<{ error: { message: string } | null }>, success: string) {
    setSaving(true);
    try {
      const { error } = await action();
      if (error) throw error;
      await reload();
      toast({ title: success });
    } catch (error) {
      toast({ title: "Não foi possível concluir", description: String(error), variant: "destructive" });
    } finally { setSaving(false); }
  }
  async function copyMessage() {
    try { await navigator.clipboard.writeText(message); toast({ title: "Pedido copiado para enviar ao fornecedor" }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  }

  if (loadingProfile || loadingPermissions || loadingModules) return <div className="p-6">Carregando...</div>;
  if (isSuperAdmin && !companyId) return <main className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-2xl font-bold">Controle de Refeições</h1><p>Selecione a empresa para consultar seus pedidos.</p><select aria-label="Empresa" className="h-10 w-full rounded-md border bg-background px-3" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}><option value="">Selecionar empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></main>;
  if (!companyId || !permitted) return <div className="p-6">Sem acesso ao Controle de Refeições. Solicite a permissão no Painel de Controle.</div>;
  return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
    <header className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
      <div><h1 className="text-2xl font-bold">Controle de Refeições</h1><p className="text-sm text-muted-foreground">Solicitação diária por funcionário, equipe e turno</p></div>
    </header>
    <Card><CardContent className="flex flex-wrap items-end gap-4 pt-6">
      {isSuperAdmin && <label className="space-y-1 text-sm font-medium">Empresa<select className="block h-10 rounded-md border bg-background px-3" value={selectedCompany} disabled={saving} onChange={e => { if (!dirty || window.confirm("Descartar seleção não salva?")) { setLoading(true); setSelectedCompany(e.target.value); } }}>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="space-y-1 text-sm font-medium">Data da refeição<Input type="date" disabled={saving} value={date} onChange={e => { if (!dirty || window.confirm("Descartar seleção não salva?")) { setLoading(true); setDate(e.target.value); } }} /></label>
      <label className="space-y-1 text-sm font-medium">Turno<select disabled={saving} className="block h-10 rounded-md border bg-background px-3" value={shift} onChange={e => { if (!dirty || window.confirm("Descartar seleção não salva?")) { setLoading(true); setShift(e.target.value as "diurno" | "noturno"); } }}><option value="diurno">Diurno</option><option value="noturno">Noturno</option></select></label>
      <span className="text-sm">Fornecedor: <strong>{order?.supplier || "Luana – Sabor Delícia"}</strong></span>
      <span className="rounded bg-muted px-3 py-2 text-sm">Status: <strong>{order?.status || "Sem pedido"}</strong></span>
    </CardContent></Card>
    {loading ? <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando pedido...</p> : <>
      <Card><CardHeader><CardTitle>Composição nominal {order?.status === "rascunho" || !order ? `(selecionados: ${selected.length})` : `(solicitados: ${people.length})`}</CardTitle></CardHeader><CardContent className="space-y-4">
        {(!order || order.status === "rascunho") && <>
          <p className="text-sm text-muted-foreground">Marque a equipe inteira ou ajuste por pessoa. A seleção só entra no pedido após salvar.</p>
          <div className="flex flex-wrap gap-2"><Input aria-label="Buscar funcionário" placeholder="Buscar nome ou matrícula" value={query} onChange={e => setQuery(e.target.value)} className="max-w-sm" />
          <select aria-label="Filtrar equipe" className="h-10 rounded-md border bg-background px-3" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}><option>Todas</option>{teams.map(t => <option key={t}>{t}</option>)}</select></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { const ids = new Set(selected); visible.forEach(e => ids.add(e.id)); setSelected([...ids]); setDirty(true); }}>Marcar exibidos ({visible.length})</Button>
          <Button variant="outline" onClick={() => { const ids = new Set(visible.map(e => e.id)); setSelected(selected.filter(id => !ids.has(id))); setDirty(true); }}>Desmarcar exibidos</Button></div>
          <div className="max-h-80 overflow-auto rounded border divide-y">{visible.map(e => <label key={e.id} className="flex cursor-pointer items-center gap-3 p-2 hover:bg-muted/50"><input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} /><span className="flex-1">{e.name} <span className="text-xs text-muted-foreground">{e.matricula || "sem matrícula"}</span></span><span className="text-xs">{teamOf(e)}</span></label>)}{visible.length === 0 && <p className="p-3">Nenhum funcionário encontrado.</p>}</div>
          <p className="text-sm">Prévia por equipe: {selectedGroups.map(([team, n]) => `${team}: ${n}`).join(" · ") || "nenhum selecionado"}</p>
          <Button disabled={saving || !dirty || selected.some(id => !employees.some(e => e.id === id))} onClick={() => void run(() => db.rpc("meals_save_draft", { p_company_id: companyId, p_date: date, p_shift: shift, p_employee_ids: selected, p_expected_updated_at: order?.updated_at || null }), "Rascunho salvo")}>Salvar rascunho</Button>
          {selected.some(id => !employees.some(e => e.id === id)) && <div className="space-y-2 text-sm text-destructive"><p>Há pessoas do pedido anterior que não constam mais entre os ativos: {people.filter(p => selected.includes(p.employee_id) && !employees.some(e => e.id === p.employee_id)).map(p => p.employee_name).join(", ")}.</p><Button variant="outline" onClick={() => { setSelected(selected.filter(id => employees.some(e => e.id === id))); setDirty(true); }}>Remover indisponíveis da seleção</Button></div>}
        </>}
        <div className="rounded border p-3"><strong>Pedido salvo por equipe</strong>{savedGroups.map(([team, n]) => <div key={team} className="flex justify-between border-b py-1"><span>{team}</span><span>{n}</span></div>)}<div className="flex justify-between pt-2 font-bold"><span>Total de marmitas</span><span>{people.length}</span></div></div>
        {order?.status === "rascunho" && manager && <Button disabled={saving || dirty || people.length === 0} onClick={() => { if (window.confirm(`Fechar e congelar o pedido de ${people.length} marmitas para ${labelDate} (${shift})?`)) void run(() => db.rpc("meals_close", { p_order_id: order.id }), "Pedido fechado"); }}>Fechar pedido</Button>}
        {order?.status === "rascunho" && !manager && <p className="text-sm text-muted-foreground">O gestor de refeições fecha o pedido após conferir as equipes.</p>}
        {order?.status !== "rascunho" && order && <div className="space-y-2"><p className="text-sm">Pedido fechado {order.closed_at ? new Date(order.closed_at).toLocaleString("pt-BR") : ""}. Envie ao fornecedor após conferir.</p><pre className="whitespace-pre-wrap rounded bg-muted p-3 text-sm">{message}</pre><Button variant="outline" onClick={() => void copyMessage()}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar mensagem para fornecedor</Button></div>}
      </CardContent></Card>
      {order?.status === "fechado" && manager && <Card><CardHeader><CardTitle>Conferir entrega</CardTitle></CardHeader><CardContent className="space-y-3"><p>Solicitadas: {people.length}</p>
        <label className="block max-w-xs space-y-1 text-sm">Quantidade recebida<Input type="number" min="0" step="1" value={delivered} onChange={e => setDelivered(e.target.value)} /></label>
        <label className="block space-y-1 text-sm">Observação / justificativa da diferença<Input value={note} onChange={e => setNote(e.target.value)} /></label>
        <Button disabled={saving || !/^\d+$/.test(delivered) || (Number(delivered) !== people.length && !note.trim())} onClick={() => void run(() => db.rpc("meals_deliver", { p_order_id: order.id, p_quantity: Number(delivered), p_note: note }), "Entrega registrada")}>Registrar entrega</Button>
      </CardContent></Card>}
      {order?.status === "entregue" && <Card><CardContent className="pt-6">Solicitadas: <strong>{people.length}</strong> · Entregues: <strong>{order.delivered_quantity}</strong> · Diferença: <strong>{(order.delivered_quantity || 0) - people.length}</strong>{order.delivery_note && <p>Observação: {order.delivery_note}</p>}</CardContent></Card>}
    </>}
  </main>;
}
