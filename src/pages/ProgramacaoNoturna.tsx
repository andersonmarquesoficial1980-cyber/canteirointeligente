import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, BarChart3, Loader2, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { toLocalISODate } from "@/lib/date-local";
import { Comunicado, DestinoEquipe, diferencasRevisao, intervaloMes, sortOgsDecrescente, textoComunicado, urlWhatsAppComunicado, validarComunicado } from "@/lib/programacaoComunicado";

type Ogs = { ogs_number: string; client_name: string | null; location_address: string | null };
type Responsavel = { id: string; name: string; equipe: string | null; is_encarregado: boolean | null; is_engenheiro: boolean | null };
type Revisao = { id: string; revisao_anterior: number; revisao_nova: number; itens_antes: DestinoEquipe[]; itens_depois: DestinoEquipe[]; alterado_por_nome: string | null; alterado_em: string };
type Linha = DestinoEquipe & { id: string };
const novaLinha = (): Linha => ({ id: crypto.randomUUID(), equipe: "", situacao: "TRABALHO", local: "", ogs: "", cliente: "", periodo: "DIURNO", observacao: "" });
const mesAtual = () => toLocalISODate().slice(0, 7);
const dia = (iso: string) => iso.split("-").reverse().join("/");

export default function ProgramacaoNoturna() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const origem = params.get("origem") || "";
  const goBack = useSmartBack(origem === "gestao-frotas" ? "/gestao-frotas" : "/programador");
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [ogs, setOgs] = useState<Ogs[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [data, setData] = useState(toLocalISODate());
  const [mes, setMes] = useState(mesAtual());
  const [inicio, setInicio] = useState(() => intervaloMes(mesAtual()).inicio);
  const [fim, setFim] = useState(() => intervaloMes(mesAtual()).fim);
  const [equipeHistorico, setEquipeHistorico] = useState("");
  const [mensagemAberta, setMensagemAberta] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [saved, setSaved] = useState<Comunicado | null>(null);
  const [editing, setEditing] = useState<{ id: string; revisao: number } | null>(null);
  const [revisoesAbertas, setRevisoesAbertas] = useState<string | null>(null);
  const [revisoes, setRevisoes] = useState<Record<string, Revisao[]>>({});
  const [erroRevisoes, setErroRevisoes] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setLoading(false); return; }
      const profile = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (profile.error || !profile.data?.company_id) {
        toast({ title: "Empresa não identificada", variant: "destructive" }); setLoading(false); return;
      }
      const company = profile.data.company_id;
      setCompanyId(company);
      const [people, works, supervisors] = await Promise.all([
        supabase.from("employees").select("equipe", { count: "exact" }).eq("company_id", company).eq("origem", "PROPRIO").or("status.is.null,status.neq.demitido").not("equipe", "is", null).limit(1000),
        supabase.from("ogs_reference").select("ogs_number,client_name,location_address", { count: "exact" }).eq("company_id", company).limit(1000),
        supabase.from("employees").select("id,name,equipe,is_encarregado,is_engenheiro", { count: "exact" }).eq("company_id", company).eq("origem", "PROPRIO").eq("status", "ativo").or("is_encarregado.eq.true,is_engenheiro.eq.true").limit(1000),
      ]);
      if (!active) return;
      if (people.error || works.error || supervisors.error || (people.count ?? 0) > (people.data?.length ?? 0) || (works.count ?? 0) > (works.data?.length ?? 0) || (supervisors.count ?? 0) > (supervisors.data?.length ?? 0)) toast({ title: "Falha ou catálogo incompleto", description: people.error?.message || works.error?.message || supervisors.error?.message || "A lista excede o limite de consulta.", variant: "destructive" });
      else {
        setEquipes([...new Set((people.data || []).map(p => p.equipe?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt-BR")));
        setOgs(sortOgsDecrescente((works.data || []) as Ogs[]));
        setResponsaveis((supervisors.data || []) as Responsavel[]);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [toast]);

  useEffect(() => {
    if (!companyId || !inicio || !fim || inicio > fim) {
      setComunicados([]);
      setHistoryLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setHistoryLoading(true); setHistoryError("");
      const headers = await supabase.from("programacao_comunicados").select("id,data,created_at,itens,revisao", { count: "exact" }).eq("company_id", companyId).gte("data", inicio).lte("data", fim).order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
      if (!active) return;
      if (headers.error || (headers.count ?? 0) > (headers.data?.length ?? 0)) {
        setHistoryError(headers.error?.message || "Histórico excede o limite de consulta. Ajuste o período."); setComunicados([]); setHistoryLoading(false); return;
      }
      if ((headers.data || []).some(h => !Array.isArray(h.itens))) {
        setHistoryError("Histórico inconsistente. Não é seguro compartilhar estes comunicados."); setComunicados([]);
      } else setComunicados((headers.data || []).map(h => ({ id: h.id, data: h.data, created_at: h.created_at, revisao: h.revisao, itens: h.itens as DestinoEquipe[] })));
      setHistoryLoading(false);
    })();
    return () => { active = false; };
  }, [companyId, inicio, fim, saved]);

  const equipesOcupadas = useMemo(() => new Set(linhas.map(l => l.equipe).filter(Boolean)), [linhas]);
  const edit = (id: string, patch: Partial<Linha>) => setLinhas(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  const selectOgs = (id: string, number: string) => {
    const obra = ogs.find(o => o.ogs_number === number);
    edit(id, { ogs: number, cliente: obra?.client_name || "", local: obra?.location_address?.split(";")[0]?.trim() || "" });
  };
  const iniciarEdicao = (comunicado: Comunicado) => {
    if (!comunicado.revisao) return;
    if (linhas.some(l => l.equipe || l.ogs || l.local || l.observacao) && !window.confirm("Descartar o rascunho atual para editar este comunicado?")) return;
    setEditing({ id: comunicado.id, revisao: comunicado.revisao });
    setData(comunicado.data);
    setLinhas(comunicado.itens.map(item => ({ ...item, id: crypto.randomUUID() })));
    setSaved(null);
    document.getElementById("form-comunicado")?.scrollIntoView?.({ behavior: "smooth" });
  };
  const descartarEdicao = () => { setEditing(null); setData(toLocalISODate()); setLinhas([novaLinha()]); };
  const mostrarRevisoes = async (comunicado: Comunicado) => {
    if (revisoesAbertas === comunicado.id) { setRevisoesAbertas(null); return; }
    setRevisoesAbertas(comunicado.id); setErroRevisoes("");
    if (!companyId || !comunicado.revisao || comunicado.revisao <= 1 || revisoes[comunicado.id]) return;
    const { data: rows, count, error } = await supabase.from("programacao_comunicado_revisoes")
      .select("id,revisao_anterior,revisao_nova,itens_antes,itens_depois,alterado_por_nome,alterado_em", { count: "exact" })
      .eq("company_id", companyId).eq("comunicado_id", comunicado.id)
      .order("revisao_nova", { ascending: false }).limit(100);
    if (error || (count ?? 0) !== comunicado.revisao - 1 || (count ?? 0) > (rows?.length ?? 0)) {
      setErroRevisoes(error?.message || "Histórico de revisões incompleto. Tente atualizar a página."); return;
    }
    setRevisoes(prev => ({ ...prev, [comunicado.id]: (rows || []) as unknown as Revisao[] }));
  };
  const copiarMensagem = async (comunicado: Comunicado, contexto: string) => {
    try {
      await navigator.clipboard.writeText(textoComunicado(comunicado));
      toast({ title: "Mensagem copiada", description: "Cole no grupo do WhatsApp." });
    } catch {
      const campo = document.getElementById(`mensagem-${contexto}-${comunicado.id}`) as HTMLTextAreaElement | null;
      campo?.select();
      toast({ title: "Cópia automática indisponível", description: "O texto foi selecionado: copie e cole no grupo.", variant: "destructive" });
    }
  };
  const acoesCompartilhar = (comunicado: Comunicado, contexto: string) => <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm"><a href={urlWhatsAppComunicado(comunicado)} target="_blank" rel="noopener noreferrer"><Share2 className="w-4 h-4 mr-2" />Abrir no WhatsApp</a></Button>
      <Button variant="outline" size="sm" onClick={() => setMensagemAberta(prev => prev === `${contexto}-${comunicado.id}` ? null : `${contexto}-${comunicado.id}`)}>{mensagemAberta === `${contexto}-${comunicado.id}` ? "Ocultar mensagem" : "Ver / copiar mensagem"}</Button>
    </div>
    {mensagemAberta === `${contexto}-${comunicado.id}` && <div className="space-y-2">
      <Label htmlFor={`mensagem-${contexto}-${comunicado.id}`}>Mensagem completa para o grupo</Label>
      <Textarea id={`mensagem-${contexto}-${comunicado.id}`} readOnly value={textoComunicado(comunicado)} rows={Math.min(18, 6 + comunicado.itens.length * 4)} className="whitespace-pre-wrap text-sm" />
      <Button variant="secondary" size="sm" onClick={() => copiarMensagem(comunicado, contexto)}>Copiar mensagem</Button>
      <p className="text-xs text-muted-foreground">Se o WhatsApp não abrir neste navegador, copie a mensagem e cole no grupo. Abrir não equivale a enviar.</p>
    </div>}
  </div>;
  const salvar = async () => {
    if (!companyId || saving) return;
    const erro = validarComunicado(linhas);
    if (erro || !data) { toast({ title: erro || "Escolha a data da programação", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const itens = linhas.map(({ id: _id, ...item }) => item);
      const result = editing
        ? await supabase.rpc("programador_editar_comunicado", { p_company_id: companyId, p_comunicado_id: editing.id, p_revisao: editing.revisao, p_itens: itens })
        : await supabase.rpc("programador_criar_comunicado", { p_company_id: companyId, p_data: data, p_itens: itens });
      if (result.error) throw result.error;
      const id = editing ? editing.id : result.data as string;
      const head = await supabase.from("programacao_comunicados").select("id,data,created_at,itens,revisao").eq("company_id", companyId).eq("id", id).single();
      const children = await supabase.from("ci_programacoes").select("equipe,status_equipe,motivo_cancelamento").eq("company_id", companyId).eq("comunicado_id", id);
      const headItems = head.data?.itens as unknown as DestinoEquipe[] | undefined;
      const semCorrespondencia = !Array.isArray(headItems) || headItems.some(item => {
        const linha = children.data?.find(row => row.equipe === item.equipe);
        return !linha || linha.status_equipe !== (item.situacao === "TRABALHO" ? "TRABALHOU" : item.situacao)
          || (item.situacao === "CANCELADO" && linha.motivo_cancelamento !== item.motivo_cancelamento);
      });
      if (head.error || children.error || !head.data || head.data.revisao !== (editing ? editing.revisao + 1 : 1) || children.data?.length !== linhas.length || semCorrespondencia)
        throw new Error("Gravado, mas não foi possível conferir a revisão e todas as equipes. Consulte o histórico antes de tentar novamente.");
      const confirmed: Comunicado = { ...head.data, itens: headItems! };
      setSaved(confirmed); setMes(data.slice(0, 7));
      const periodo = intervaloMes(data.slice(0, 7));
      setInicio(periodo.inicio); setFim(periodo.fim);
      if (editing) { setRevisoes(prev => { const next = { ...prev }; delete next[editing.id]; return next; }); setRevisoesAbertas(null); }
      setEditing(null);
      setLinhas([novaLinha()]);
      toast({ title: editing ? "Correção registrada no histórico" : "Programação salva", description: editing ? "Se já compartilhou, envie a revisão atualizada ao grupo." : "Confira a mensagem e escolha o grupo no WhatsApp." });
      // Compartilhamento deve ser uma ação explícita: pop-ups após RPC podem ser bloqueados.
    } catch (e) { toast({ title: "Não foi possível confirmar a programação", description: (e as Error).message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="inline animate-spin" /> Carregando...</div>;
  if (!companyId) return <p className="p-6">Empresa não identificada. A programação não pode ser criada.</p>;
  return <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-16">
    <header className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={goBack} aria-label="Voltar"><ArrowLeft /></Button>
      <div className="flex-1"><h1 className="text-xl font-bold">Programação de Obras</h1><p className="text-sm text-muted-foreground">Um comunicado para várias equipes, com destino ou folga de cada uma.</p></div>
      <Button variant="outline" onClick={() => navigate(`/programador/relatorio-programacoes${origem ? `?origem=${encodeURIComponent(origem)}` : ""}`)}><BarChart3 className="w-4 h-4 mr-2" />Relatório legado</Button>
    </header>
    <section id="form-comunicado" className="border rounded-xl p-4 sm:p-6 space-y-4 bg-card">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{editing ? `Editando comunicado · revisão ${editing.revisao}` : "Novo comunicado"}</h2>{editing && <Button variant="outline" size="sm" onClick={descartarEdicao}>Descartar edição</Button>}</div>
      {editing && <p className="text-sm text-muted-foreground">Corrija a situação ou os dados de cada equipe. Data e equipes permanecem fixas; cada alteração gera uma revisão no histórico.</p>}
      <div className="max-w-xs space-y-1"><Label htmlFor="data-programacao">Dia de trabalho</Label><Input id="data-programacao" type="date" value={data} disabled={!!editing} onChange={e => setData(e.target.value)} /></div>
      {linhas.map((linha, i) => <div key={linha.id} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Equipe {i + 1}</h3>{!editing && <Button variant="ghost" size="sm" disabled={linhas.length === 1} onClick={() => setLinhas(prev => prev.filter(l => l.id !== linha.id))} aria-label={`Remover equipe ${i + 1}`}><Trash2 className="w-4 h-4" /></Button>}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor={`equipe-${linha.id}`}>{editing ? "Equipe programada" : "Equipe"}</Label><select id={`equipe-${linha.id}`} disabled={!!editing} className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.equipe} onChange={e => edit(linha.id, { equipe: e.target.value })}><option value="">Selecione...</option>{equipes.filter(e => e === linha.equipe || !equipesOcupadas.has(e)).map(e => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor={`situacao-${linha.id}`}>Situação da equipe</Label><select id={`situacao-${linha.id}`} className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.situacao} onChange={e => edit(linha.id, { situacao: e.target.value as Linha["situacao"], motivo_cancelamento: e.target.value === "CANCELADO" ? linha.motivo_cancelamento || "" : "" })}><option value="TRABALHO">Vai trabalhar</option><option value="FOLGA">Vai folgar</option>{editing && <option value="CANCELADO">Cancelado</option>}</select></div>
        </div>
        {editing && linha.situacao === "CANCELADO" && <div className="space-y-1"><Label htmlFor={`motivo-${linha.id}`}>Motivo do cancelamento *</Label><Textarea id={`motivo-${linha.id}`} value={linha.motivo_cancelamento || ""} maxLength={500} rows={2} onChange={e => edit(linha.id, { motivo_cancelamento: e.target.value })} placeholder="Informe por que a equipe não irá trabalhar" /></div>}
        {linha.situacao === "TRABALHO" && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>OGS / Obra (opcional)</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.ogs} onChange={e => selectOgs(linha.id, e.target.value)}><option value="">Sem OGS</option>{ogs.map(o => <option key={o.ogs_number} value={o.ogs_number}>{o.ogs_number} — {o.client_name}</option>)}</select></div>
            <div className="space-y-1"><Label>Período</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.periodo} onChange={e => edit(linha.id, { periodo: e.target.value })}><option>DIURNO</option><option>NOTURNO</option><option>INTEGRAL</option></select></div>
          </div>
          <div className="space-y-1"><Label>Onde vai trabalhar *</Label><Input value={linha.local} onChange={e => edit(linha.id, { local: e.target.value })} placeholder="Obra, endereço ou ponto de encontro" maxLength={500} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Encarregado responsável (opcional)</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.encarregado_id || ""} onChange={e => { const p = responsaveis.find(p => p.id === e.target.value); edit(linha.id, { encarregado_id: p?.id || "", encarregado_nome: p?.name || "" }); }}><option value="">Não definido</option>{responsaveis.filter(p => p.is_encarregado).sort((a, b) => Number(b.equipe === linha.equipe) - Number(a.equipe === linha.equipe) || a.name.localeCompare(b.name, "pt-BR")).map(p => <option key={p.id} value={p.id}>{p.name}{p.equipe ? ` · ${p.equipe}` : ""}</option>)}</select></div>
            <div className="space-y-1"><Label>Engenheiro responsável (opcional)</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.engenheiro_id || ""} onChange={e => { const p = responsaveis.find(p => p.id === e.target.value); edit(linha.id, { engenheiro_id: p?.id || "", engenheiro_nome: p?.name || "" }); }}><option value="">Não definido</option>{responsaveis.filter(p => p.is_engenheiro).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>

        </>}
        <div className="space-y-1"><Label>Orientação para esta equipe (opcional)</Label><Textarea value={linha.observacao} onChange={e => edit(linha.id, { observacao: e.target.value })} maxLength={1000} rows={2} /></div>
      </div>)}
      {!editing && <Button variant="outline" disabled={linhas.length >= 100 || equipesOcupadas.size >= equipes.length} onClick={() => setLinhas(prev => [...prev, novaLinha()])}><Plus className="w-4 h-4 mr-2" />Adicionar outra equipe</Button>}
      <div className="border-t pt-4"><Button onClick={salvar} disabled={saving || !equipes.length}>{saving ? "Salvando..." : editing ? "Salvar correção" : `Salvar comunicado (${linhas.length} equipe${linhas.length === 1 ? "" : "s"})`}</Button><p className="text-xs text-muted-foreground mt-2">{editing ? "Se a mensagem anterior já foi enviada, compartilhe novamente a versão corrigida. O Workflux não altera mensagens do WhatsApp." : "Após salvar, abra a mensagem no WhatsApp, escolha o grupo e confirme o envio. O Workflux não confirma a entrega."}</p></div>
      {saved && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm space-y-2">
        <p className="font-semibold">Programação de Obras · {dia(saved.data)} — {saved.itens.length} equipe(s)</p>
        {acoesCompartilhar(saved, "salvo")}
      </div>}
    </section>
    <section className="border rounded-xl p-4 sm:p-6 space-y-4 bg-card">
      <div><h2 className="font-semibold">Histórico de comunicados</h2><p className="text-xs text-muted-foreground">Programado, não comprovante de execução; ausência de equipe não significa folga.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="space-y-1"><Label htmlFor="mes-programacao">Atalho: mês fechado</Label><Input id="mes-programacao" type="month" value={mes} onChange={e => { setMes(e.target.value); if (/^\d{4}-\d{2}$/.test(e.target.value)) { const p = intervaloMes(e.target.value); setInicio(p.inicio); setFim(p.fim); } }} /></div>
        <div className="space-y-1"><Label htmlFor="inicio-programacao">De</Label><Input id="inicio-programacao" type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="fim-programacao">Até</Label><Input id="fim-programacao" type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="equipe-historico">Equipe</Label><select id="equipe-historico" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={equipeHistorico} onChange={e => setEquipeHistorico(e.target.value)}><option value="">Todas as equipes</option>{[...new Set(comunicados.flatMap(c => c.itens.map(i => i.equipe)))].sort((a, b) => a.localeCompare(b, "pt-BR")).map(e => <option key={e} value={e}>{e}</option>)}</select></div>
      </div>
      {inicio && fim && inicio > fim && <p role="alert" className="text-sm text-destructive">A data inicial não pode ser posterior à data final.</p>}
      {inicio && fim && inicio <= fim && <p className="text-xs text-muted-foreground">Período consultado: {dia(inicio)} a {dia(fim)}</p>}
      {historyLoading && <p>Carregando histórico...</p>}
      {historyError && <p role="alert" className="text-destructive">{historyError}</p>}
      {!historyLoading && !historyError && inicio <= fim && !comunicados.length && <p className="text-sm text-muted-foreground">Nenhum comunicado neste período. Registros antigos individuais permanecem no relatório legado.</p>}
      {!historyLoading && !historyError && comunicados.filter(c => !equipeHistorico || c.itens.some(i => i.equipe === equipeHistorico)).map(c => <article key={c.id} className="border rounded-lg p-4 space-y-3">
        <div>
          <h3 className="font-bold text-base">Programação de Obras · {dia(c.data)}</h3>
          <p className="text-xs text-muted-foreground">{c.itens.length} equipe(s) · Revisão {c.revisao || 1} · Registrado em {new Date(c.created_at).toLocaleString("pt-BR")}</p>
        </div>
        <div className="space-y-2 border-y py-3">
          {c.itens.filter(item => !equipeHistorico || item.equipe === equipeHistorico).map(item => <div key={item.equipe} className="text-sm">
            <p><strong>{item.equipe}</strong> — {item.situacao === "CANCELADO" ? "CANCELADO" : item.situacao === "FOLGA" ? "FOLGA" : "VAI TRABALHAR"}</p>
            {item.situacao === "CANCELADO" && <p className="text-destructive">Motivo: {item.motivo_cancelamento}</p>}
            {item.situacao === "TRABALHO" && <p className="text-muted-foreground">Local: {item.local} · {item.periodo}{item.ogs ? ` · OGS ${item.ogs}` : ""}</p>}
            {item.situacao === "TRABALHO" && (item.encarregado_nome || item.engenheiro_nome) && <p className="text-muted-foreground">{[item.encarregado_nome && `Encarregado: ${item.encarregado_nome}`, item.engenheiro_nome && `Engenheiro: ${item.engenheiro_nome}`].filter(Boolean).join(" · ")}</p>}
            {item.observacao && <p className="text-muted-foreground">Orientação: {item.observacao}</p>}
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={saving || !!editing} onClick={() => iniciarEdicao(c)}><Pencil className="w-4 h-4 mr-1" />Editar comunicado</Button>
          {(c.revisao || 1) > 1 && <Button type="button" variant="outline" size="sm" onClick={() => void mostrarRevisoes(c)}>{revisoesAbertas === c.id ? "Ocultar revisões" : `Ver histórico de alterações (${(c.revisao || 1) - 1})`}</Button>}
        </div>
        {revisoesAbertas === c.id && <div className="rounded-md border bg-muted/30 p-3 space-y-3 text-xs">
          {erroRevisoes && <p role="alert" className="text-destructive">{erroRevisoes}</p>}
          {!erroRevisoes && !revisoes[c.id] && <p>Carregando revisões...</p>}
          {(revisoes[c.id] || []).map(r => <div key={r.id} className="border-b last:border-0 pb-2 space-y-1">
            <p className="font-semibold">Revisão {r.revisao_nova} · {r.alterado_por_nome || "Usuário autorizado"} · {new Date(r.alterado_em).toLocaleString("pt-BR")}</p>
            {diferencasRevisao(r.itens_antes, r.itens_depois).map((mudanca, index) => <p key={`${r.id}-${index}`}>{mudanca}</p>)}
          </div>)}
        </div>}
        {acoesCompartilhar(c, "historico")}
      </article>)}
    </section>
  </div>;
}
