import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, BarChart3, Loader2, Plus, Share2, Trash2 } from "lucide-react";
import { toLocalISODate } from "@/lib/date-local";
import { Comunicado, DestinoEquipe, intervaloMes, textoComunicado, urlWhatsAppComunicado, validarComunicado } from "@/lib/programacaoComunicado";

type Ogs = { ogs_number: string; client_name: string | null; location_address: string | null };
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
      const [people, works] = await Promise.all([
        supabase.from("employees").select("equipe", { count: "exact" }).eq("company_id", company).eq("origem", "PROPRIO").or("status.is.null,status.neq.demitido").not("equipe", "is", null).limit(1000),
        supabase.from("ogs_reference").select("ogs_number,client_name,location_address").eq("company_id", company).limit(1000),
      ]);
      if (!active) return;
      if (people.error || works.error || (people.count ?? 0) > (people.data?.length ?? 0)) toast({ title: "Falha ou catálogo incompleto", description: people.error?.message || works.error?.message || "A lista excede o limite de consulta.", variant: "destructive" });
      else {
        setEquipes([...new Set((people.data || []).map(p => p.equipe?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt-BR")));
        setOgs((works.data || []) as Ogs[]);
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
      const headers = await supabase.from("programacao_comunicados").select("id,data,created_at,itens", { count: "exact" }).eq("company_id", companyId).gte("data", inicio).lte("data", fim).order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
      if (!active) return;
      if (headers.error || (headers.count ?? 0) > (headers.data?.length ?? 0)) {
        setHistoryError(headers.error?.message || "Histórico excede o limite de consulta. Ajuste o período."); setComunicados([]); setHistoryLoading(false); return;
      }
      if ((headers.data || []).some(h => !Array.isArray(h.itens))) {
        setHistoryError("Histórico inconsistente. Não é seguro compartilhar estes comunicados."); setComunicados([]);
      } else setComunicados((headers.data || []).map(h => ({ id: h.id, data: h.data, created_at: h.created_at, itens: h.itens as DestinoEquipe[] })));
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
      const { data: id, error } = await supabase.rpc("programador_criar_comunicado", {
        p_company_id: companyId, p_data: data,
        p_itens: linhas.map(({ id: _id, ...item }) => item),
      });
      if (error) throw error;
      const head = await supabase.from("programacao_comunicados").select("id,data,created_at").eq("company_id", companyId).eq("id", id).single();
      const children = await supabase.from("ci_programacoes").select("id").eq("company_id", companyId).eq("comunicado_id", id);
      if (head.error || children.error || !head.data || children.data?.length !== linhas.length) throw new Error("Gravado, mas não foi possível conferir todas as equipes. Consulte o histórico antes de criar outro comunicado.");
      const confirmed = { ...head.data, itens: linhas.map(({ id: _id, ...item }) => item) };
      setSaved(confirmed); setMes(data.slice(0, 7));
      const periodo = intervaloMes(data.slice(0, 7));
      setInicio(periodo.inicio); setFim(periodo.fim);
      setLinhas([novaLinha()]);
      toast({ title: "Programação salva", description: "Confira a mensagem e escolha o grupo no WhatsApp." });
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
    <section className="border rounded-xl p-4 sm:p-6 space-y-4 bg-card">
      <h2 className="font-semibold">Novo comunicado</h2>
      <div className="max-w-xs space-y-1"><Label htmlFor="data-programacao">Dia de trabalho</Label><Input id="data-programacao" type="date" value={data} onChange={e => setData(e.target.value)} /></div>
      {linhas.map((linha, i) => <div key={linha.id} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Equipe {i + 1}</h3><Button variant="ghost" size="sm" disabled={linhas.length === 1} onClick={() => setLinhas(prev => prev.filter(l => l.id !== linha.id))} aria-label={`Remover equipe ${i + 1}`}><Trash2 className="w-4 h-4" /></Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Equipe</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.equipe} onChange={e => edit(linha.id, { equipe: e.target.value })}><option value="">Selecione...</option>{equipes.filter(e => e === linha.equipe || !equipesOcupadas.has(e)).map(e => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="space-y-1"><Label>Situação</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.situacao} onChange={e => edit(linha.id, { situacao: e.target.value as Linha["situacao"] })}><option value="TRABALHO">Vai trabalhar</option><option value="FOLGA">Vai folgar</option></select></div>
        </div>
        {linha.situacao === "TRABALHO" && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>OGS / Obra (opcional)</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.ogs} onChange={e => selectOgs(linha.id, e.target.value)}><option value="">Sem OGS</option>{ogs.map(o => <option key={o.ogs_number} value={o.ogs_number}>{o.ogs_number} — {o.client_name}</option>)}</select></div>
            <div className="space-y-1"><Label>Período</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={linha.periodo} onChange={e => edit(linha.id, { periodo: e.target.value })}><option>DIURNO</option><option>NOTURNO</option><option>INTEGRAL</option></select></div>
          </div>
          <div className="space-y-1"><Label>Onde vai trabalhar *</Label><Input value={linha.local} onChange={e => edit(linha.id, { local: e.target.value })} placeholder="Obra, endereço ou ponto de encontro" maxLength={500} /></div>

        </>}
        <div className="space-y-1"><Label>Orientação para esta equipe (opcional)</Label><Textarea value={linha.observacao} onChange={e => edit(linha.id, { observacao: e.target.value })} maxLength={1000} rows={2} /></div>
      </div>)}
      <Button variant="outline" disabled={linhas.length >= 100 || equipesOcupadas.size >= equipes.length} onClick={() => setLinhas(prev => [...prev, novaLinha()])}><Plus className="w-4 h-4 mr-2" />Adicionar outra equipe</Button>
      <div className="border-t pt-4"><Button onClick={salvar} disabled={saving || !equipes.length}>{saving ? "Salvando..." : `Salvar comunicado (${linhas.length} equipe${linhas.length === 1 ? "" : "s"})`}</Button><p className="text-xs text-muted-foreground mt-2">Após salvar, abra a mensagem no WhatsApp, escolha o grupo e confirme o envio. O Workflux não confirma a entrega.</p></div>
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
          <p className="text-xs text-muted-foreground">{c.itens.length} equipe(s) · Registrado em {new Date(c.created_at).toLocaleString("pt-BR")}</p>
        </div>
        <div className="space-y-2 border-y py-3">
          {c.itens.filter(item => !equipeHistorico || item.equipe === equipeHistorico).map(item => <div key={item.equipe} className="text-sm">
            <p><strong>{item.equipe}</strong> — {item.situacao === "FOLGA" ? "FOLGA" : "VAI TRABALHAR"}</p>
            {item.situacao === "TRABALHO" && <p className="text-muted-foreground">Local: {item.local} · {item.periodo}{item.ogs ? ` · OGS ${item.ogs}` : ""}</p>}
            {item.observacao && <p className="text-muted-foreground">Orientação: {item.observacao}</p>}
          </div>)}
        </div>
        {acoesCompartilhar(c, "historico")}
      </article>)}
    </section>
  </div>;
}
