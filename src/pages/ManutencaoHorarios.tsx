import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useToast } from "@/hooks/use-toast";
import {
  buscarJanelasDosDiarios, listarHorarios, podeGerir, removerHorario, salvarHorario, sugerirJanela,
  type EquipHorario, type GrupoJanela, type Turno,
} from "@/lib/equipDisponibilidade";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "—");
const NENHUM = "__nenhum__";

export default function ManutencaoHorarios() {
  const goBack = useSmartBack("/manutencao/falhas");
  const isDesktop = useDesktopWorkspace();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: ogsData = [] } = useOgsReference();
  const [horarios, setHorarios] = useState<EquipHorario[]>([]);
  const [equipamentos, setEquipamentos] = useState<{ id: string; frota: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [gestor, setGestor] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [grupos, setGrupos] = useState<GrupoJanela[] | null>(null);
  const [form, setForm] = useState({ ogs: "", turno: "diurno" as Turno, equipamentoId: NENHUM, data: "", inicio: "07:00", fim: "17:00", semOperacao: false, motivo: "" });

  const carregar = useCallback(async () => {
    if (!profile?.company_id) return;
    setCarregando(true); setErro("");
    try { setHorarios(await listarHorarios(profile.company_id)); }
    catch (e: any) { setErro(e?.message || "Não foi possível carregar os horários."); }
    finally { setCarregando(false); }
  }, [profile?.company_id]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!profile?.company_id) return;
    podeGerir(profile.company_id).then(setGestor);
    (supabase as any).from("equipamentos").select("id, frota").eq("company_id", profile.company_id).order("frota").limit(2000)
      .then(({ data }: any) => setEquipamentos(data || []));
  }, [profile?.company_id]);

  const padroes = useMemo(() => new Set(horarios.filter(h => !h.equipamento_id && !h.data).map(h => `${h.ogs_number}|${h.turno}`)), [horarios]);
  const pendentes = useMemo(() => (grupos || []).filter(g => !padroes.has(`${g.ogs}|${g.turno}`)), [grupos, padroes]);

  async function analisar() {
    if (!profile?.company_id) return;
    setAnalisando(true); setErro("");
    try { setGrupos(await buscarJanelasDosDiarios(profile.company_id, 45)); }
    catch (e: any) { setErro(e?.message || "Não foi possível analisar os diários."); }
    finally { setAnalisando(false); }
  }

  async function salvar() {
    if (!profile?.company_id) return;
    if (!form.ogs) { setErro("Selecione a obra (OGS)."); return; }
    if (form.semOperacao && !form.data) { setErro("'Sem operação' vale para um dia específico: informe a data."); return; }
    if (!form.semOperacao && (!form.inicio || !form.fim || form.inicio === form.fim)) { setErro("Informe início e fim diferentes."); return; }
    setSalvando(true); setErro("");
    try {
      await salvarHorario({
        companyId: profile.company_id, userId: profile.user_id, ogs: form.ogs, turno: form.turno,
        equipamentoId: form.equipamentoId === NENHUM ? null : form.equipamentoId, data: form.data || null,
        inicio: form.inicio, fim: form.fim, semOperacao: form.semOperacao, motivo: form.motivo,
      });
      toast({ title: "Horário programado salvo" });
      await carregar();
    } catch (e: any) {
      setErro(/duplicate|unique|equip_horario_programado_uk/i.test(e?.message || "")
        ? "Já existe um horário para essa combinação (obra, turno, equipamento e dia). Remova o anterior para trocar."
        : e?.message || "Não foi possível salvar.");
    } finally { setSalvando(false); }
  }

  function usarSugestao(g: GrupoJanela) {
    const s = sugerirJanela(g.amostras, g.turno);
    setForm(f => ({ ...f, ogs: g.ogs, turno: g.turno, equipamentoId: NENHUM, data: "", semOperacao: false, inicio: s?.inicio || f.inicio, fim: s?.fim || f.fim }));
    document.getElementById("form-horario")?.scrollIntoView({ behavior: "smooth" });
  }

  async function remover(id: string) {
    try { await removerHorario(id); toast({ title: "Horário removido" }); await carregar(); }
    catch (e: any) { setErro(e?.message || "Não foi possível remover."); }
  }

  return (
    <div className={`min-h-screen ${isDesktop ? "bg-page" : "bg-[hsl(210_20%_98%)]"}`}>
      <header className={`flex items-center gap-3 bg-header-gradient shadow-lg ${isDesktop ? "px-8 py-5" : "px-4 py-3"}`}>
        <button onClick={goBack} aria-label="Voltar" className="rounded-lg p-2 text-primary-foreground hover:bg-white/15"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <h1 className={`font-display text-primary-foreground ${isDesktop ? "text-2xl font-semibold" : "text-sm font-extrabold"}`}>Horários programados</h1>
          <span className="text-sm text-primary-foreground/80">Base do cálculo de disponibilidade por obra e turno</span>
        </div>
      </header>

      <div className={`mx-auto space-y-4 ${isDesktop ? "max-w-[1200px] px-8 py-6" : "max-w-2xl px-4 py-4"}`}>
        {erro && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

        <section className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-sm font-semibold">Obras e turnos sem horário padrão</h2>
            <Button size="sm" variant="outline" onClick={analisar} disabled={analisando} className="gap-1">
              {analisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Analisar diários dos últimos 45 dias
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A sugestão é a mediana do início e do fim do trabalho nos Diários de Equipamento. É só uma ajuda: quem define o horário é a manutenção ou a engenharia.</p>
          {grupos && pendentes.length === 0 && <p className="text-sm text-muted-foreground">Todas as obras/turnos com diário recente já têm horário padrão.</p>}
          <ul className="space-y-1">
            {pendentes.map(g => {
              const s = sugerirJanela(g.amostras, g.turno);
              return (
                <li key={`${g.ogs}|${g.turno}`} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  <span className="font-medium">OGS {g.ogs}</span><span className="capitalize">{g.turno}</span>
                  <span className="text-xs text-muted-foreground">{g.dias} dia(s) com diário</span>
                  <span className="ml-auto text-xs">{s ? `Sugestão: ${s.inicio} às ${s.fim} (${s.amostras} diários)` : "Poucos diários com horário para sugerir"}</span>
                  {gestor && <Button size="sm" variant="outline" onClick={() => usarSugestao(g)}>{s ? "Usar sugestão" : "Preencher"}</Button>}
                </li>
              );
            })}
          </ul>
        </section>

        {gestor ? (
          <section id="form-horario" className="space-y-3 rounded-xl border bg-card p-3">
            <h2 className="text-sm font-semibold">Cadastrar horário</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="h-ogs">Obra (OGS) *</Label>
                <Select value={form.ogs} onValueChange={v => setForm(f => ({ ...f, ogs: v }))}>
                  <SelectTrigger id="h-ogs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{ogsData.map((o: any) => <SelectItem key={o.id} value={o.ogs_number}>{o.ogs_number}{o.client_name ? ` — ${o.client_name}` : ""}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label htmlFor="h-turno">Turno *</Label>
                <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v as Turno }))}>
                  <SelectTrigger id="h-turno"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="diurno">Diurno</SelectItem><SelectItem value="noturno">Noturno</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label htmlFor="h-eq">Equipamento (opcional)</Label>
                <Select value={form.equipamentoId} onValueChange={v => setForm(f => ({ ...f, equipamentoId: v }))}>
                  <SelectTrigger id="h-eq"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value={NENHUM}>Todos da obra (padrão)</SelectItem>{equipamentos.map(e => <SelectItem key={e.id} value={e.id}>{e.frota}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label htmlFor="h-data">Só para o dia (opcional)</Label>
                <Input id="h-data" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.semOperacao} onChange={e => setForm(f => ({ ...f, semOperacao: e.target.checked }))} />
                Sem operação neste dia (não conta como tempo programado)
              </label>
              {!form.semOperacao && (<>
                <div className="space-y-1"><Label htmlFor="h-ini">Início *</Label><Input id="h-ini" type="time" value={form.inicio} onChange={e => setForm(f => ({ ...f, inicio: e.target.value }))} /></div>
                <div className="space-y-1"><Label htmlFor="h-fim">Fim *</Label><Input id="h-fim" type="time" value={form.fim} onChange={e => setForm(f => ({ ...f, fim: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Se o fim for menor que o início (ex.: 22:00 às 04:00), a janela atravessa a meia-noite.</p></div>
              </>)}
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="h-motivo">Motivo / observação</Label><Input id="h-motivo" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} /></div>
            </div>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar horário"}</Button>
          </section>
        ) : (
          <p className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">Você pode consultar os horários. O cadastro é feito pela Manutenção, Engenharia, Gestão de Frotas ou administradores.</p>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Horários cadastrados</h2>
          {carregando && <p role="status" className="text-sm text-muted-foreground">Carregando…</p>}
          {!carregando && horarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário cadastrado ainda. Sem horário, a disponibilidade da obra não é calculada.</p>}
          <ul className="space-y-1">
            {horarios.map(h => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <span className="font-medium">OGS {h.ogs_number}</span>
                <span className="capitalize">{h.turno}</span>
                <span>{h.sem_operacao ? "Sem operação" : `${hhmm(h.hora_inicio)} às ${hhmm(h.hora_fim)}`}</span>
                <span className="text-xs text-muted-foreground">
                  {h.equipamentos?.frota ? `Equip. ${h.equipamentos.frota}` : "Todos da obra"}{h.data ? ` · dia ${h.data.split("-").reverse().join("/")}` : " · padrão"}{h.motivo ? ` · ${h.motivo}` : ""}
                </span>
                {gestor && <button aria-label="Remover horário" className="ml-auto" onClick={() => remover(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
