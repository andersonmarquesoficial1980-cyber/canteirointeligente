import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useToast } from "@/hooks/use-toast";
import { podeGerir } from "@/lib/equipDisponibilidade";
import {
  fmtNumero, listarProducao, parseNumeroBR, removerApontamento, resumirProducao, salvarToneladas, validarToneladas,
  type LinhaProducao, type TurnoProducao,
} from "@/lib/equipProducao";

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const fmtData = (d: string) => d.split("-").reverse().join("/");
const TODAS = "__todas__";

interface Vibro { id: string; frota: string }
type Aba = "vibroacabadora" | "fresadora";

export default function GestaoFrotasProducao() {
  const goBack = useSmartBack("/gestao-frotas");
  const isDesktop = useDesktopWorkspace();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: ogsData = [] } = useOgsReference();
  const [params, setParams] = useSearchParams();
  const de = params.get("de") || diasAtras(14);
  const ate = params.get("ate") || hoje();
  const ogs = params.get("ogs") || "";
  const aba = (params.get("aba") as Aba) || "vibroacabadora";
  const setParam = (k: string, v: string) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const [linhas, setLinhas] = useState<LinhaProducao[]>([]);
  const [vibros, setVibros] = useState<Vibro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [gestor, setGestor] = useState(false);
  const [edicao, setEdicao] = useState<{ linha: LinhaProducao | null } | null>(null);

  const buscar = useCallback(async () => {
    if (!profile?.company_id) return;
    setCarregando(true); setErro("");
    try { setLinhas(await listarProducao({ companyId: profile.company_id, de, ate, ogs: ogs || undefined })); }
    catch (e: any) { setErro(e?.message || "Não foi possível carregar a produção."); setLinhas([]); }
    finally { setCarregando(false); }
  }, [profile?.company_id, de, ate, ogs]);

  useEffect(() => { buscar(); }, [buscar]);
  useEffect(() => {
    if (!profile?.company_id) return;
    podeGerir(profile.company_id).then(setGestor);
    (supabase as any).from("equipamentos").select("id, frota").eq("company_id", profile.company_id).eq("categoria_rdo", "VIBROACABADORA").order("frota")
      .then(({ data }: any) => setVibros(data || []));
  }, [profile?.company_id]);

  const resumo = useMemo(() => resumirProducao(linhas), [linhas]);
  const visiveis = useMemo(() => linhas.filter(l => l.tipo === aba), [linhas, aba]);

  async function excluir(l: LinhaProducao) {
    if (!l.apontamento_id) return;
    try { await removerApontamento(l.apontamento_id); toast({ title: "Apontamento removido" }); await buscar(); }
    catch (e: any) { setErro(e?.message || "Não foi possível remover."); }
  }

  return (
    <div className={`min-h-screen ${isDesktop ? "bg-page" : "bg-[hsl(210_20%_98%)]"}`}>
      <header className={`flex items-center gap-3 bg-header-gradient shadow-lg ${isDesktop ? "px-8 py-5" : "px-4 py-3"}`}>
        <button onClick={goBack} aria-label="Voltar" className="rounded-lg p-2 text-primary-foreground hover:bg-white/15"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1">
          <h1 className={`font-display text-primary-foreground ${isDesktop ? "text-2xl font-semibold" : "text-sm font-extrabold"}`}>Apontamento de produção</h1>
          <span className="text-sm text-primary-foreground/80">Vibroacabadora (toneladas) e fresadora (metros)</span>
        </div>
        {aba === "vibroacabadora" && (
          <Button size="sm" onClick={() => setEdicao({ linha: null })} className="gap-1 border-0 bg-white/20 text-white hover:bg-white/30"><Plus className="h-4 w-4" /> Novo apontamento</Button>
        )}
      </header>

      <div className={`mx-auto space-y-3 ${isDesktop ? "max-w-[1200px] px-8 py-6" : "max-w-2xl px-4 py-4"}`}>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <div><Label htmlFor="p-de" className="text-xs">De</Label><Input id="p-de" type="date" value={de} onChange={e => setParam("de", e.target.value)} /></div>
          <div><Label htmlFor="p-ate" className="text-xs">Até</Label><Input id="p-ate" type="date" value={ate} onChange={e => setParam("ate", e.target.value)} /></div>
          <div className="min-w-[200px]"><Label htmlFor="p-ogs" className="text-xs">Obra (OGS)</Label>
            <Select value={ogs || TODAS} onValueChange={v => setParam("ogs", v === TODAS ? "" : v)}>
              <SelectTrigger id="p-ogs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={TODAS}>Todas as obras</SelectItem>{ogsData.map((o: any) => <SelectItem key={o.id} value={o.ogs_number}>{o.ogs_number}{o.client_name ? ` — ${o.client_name}` : ""}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setParam("aba", "vibroacabadora")} aria-pressed={aba === "vibroacabadora"}
            className={`rounded-xl border bg-card p-3 text-left ${aba === "vibroacabadora" ? "border-primary ring-1 ring-primary" : ""}`}>
            <p className="text-xs text-muted-foreground">Vibroacabadora</p>
            <p className="text-xl font-bold">{fmtNumero(resumo.toneladas)} t</p>
            <p className="text-xs text-muted-foreground">{resumo.vibroLancados} lançado(s) · {resumo.vibroPendentes} pendente(s)</p>
          </button>
          <button onClick={() => setParam("aba", "fresadora")} aria-pressed={aba === "fresadora"}
            className={`rounded-xl border bg-card p-3 text-left ${aba === "fresadora" ? "border-primary ring-1 ring-primary" : ""}`}>
            <p className="text-xs text-muted-foreground">Fresadora</p>
            <p className="text-xl font-bold">{fmtNumero(resumo.metros)} m</p>
            <p className="text-xs text-muted-foreground">{resumo.fresaLancados} lançado(s) · {resumo.fresaPendentes} pendente(s)</p>
          </button>
        </div>

        {aba === "fresadora" && (
          <p className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">A metragem da fresadora vem do Diário de Equipamento (soma dos comprimentos das frentes fresadas). Para lançar ou corrigir, edite o diário. Assim existe uma única fonte.</p>
        )}
        {erro && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        {carregando && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando produção…</p>}
        {!carregando && !erro && visiveis.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum dia de {aba === "vibroacabadora" ? "vibroacabadora" : "fresadora"} neste período.</p>}

        <ul className="space-y-2">
          {visiveis.map(l => (
            <li key={`${l.equipamento_id}|${l.ogs_number}|${l.data}|${l.turno}`} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2">
              <div className="min-w-[140px]">
                <p className="font-semibold">{l.frota}</p>
                <p className="text-xs text-muted-foreground">{fmtData(l.data)} · {l.turno === "noturno" ? "Noturno" : "Diurno"} · OGS {l.ogs_number}</p>
              </div>
              <div className="ml-auto text-right">
                {l.lancado
                  ? <p className="font-bold">{fmtNumero(l.valor)} {l.unidade}</p>
                  : <p className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">Sem lançamento</p>}
              </div>
              {l.tipo === "vibroacabadora" && (
                <div className="flex gap-1">
                  <Button size="sm" variant={l.lancado ? "outline" : "default"} onClick={() => setEdicao({ linha: l })} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" /> {l.lancado ? "Corrigir" : "Lançar"}
                  </Button>
                  {l.apontamento_id && gestor && <button aria-label="Remover apontamento" onClick={() => excluir(l)}><Trash2 className="h-4 w-4 text-destructive" /></button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {edicao && profile?.company_id && (
        <FormToneladas linha={edicao.linha} vibros={vibros} ogsPadrao={ogs} companyId={profile.company_id} userId={profile.user_id}
          onClose={() => setEdicao(null)} onSaved={() => { setEdicao(null); buscar(); }} />
      )}
    </div>
  );
}

function FormToneladas({ linha, vibros, ogsPadrao, companyId, userId, onClose, onSaved }: {
  linha: LinhaProducao | null; vibros: Vibro[]; ogsPadrao: string; companyId: string; userId: string; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data: ogsData = [] } = useOgsReference();
  const [equip, setEquip] = useState(linha?.equipamento_id || "");
  const [ogs, setOgs] = useState(linha?.ogs_number || ogsPadrao);
  const [data, setData] = useState(linha?.data || hoje());
  const [turno, setTurno] = useState<TurnoProducao>(linha?.turno || "diurno");
  const [ton, setTon] = useState(linha?.valor !== null && linha?.valor !== undefined ? String(linha.valor).replace(".", ",") : "");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const fixo = !!linha; // linha existente: chave do dia é fixa; só a tonelada muda

  async function salvar() {
    if (!equip) { setErro("Selecione a vibroacabadora."); return; }
    if (!ogs) { setErro("Selecione a obra (OGS)."); return; }
    if (!data || data > hoje()) { setErro("Informe uma data válida (não pode ser futura)."); return; }
    const msg = validarToneladas(ton);
    if (msg) { setErro(msg); return; }
    setSalvando(true); setErro("");
    try {
      await salvarToneladas({ companyId, userId, equipamentoId: equip, ogs, data, turno, toneladas: parseNumeroBR(ton)!, observacao: obs, apontamentoId: linha?.apontamento_id });
      toast({ title: "Toneladas registradas" });
      onSaved();
    } catch (e: any) { setErro(e?.message || "Não foi possível salvar."); }
    finally { setSalvando(false); }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v && !salvando) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{linha?.lancado ? "Corrigir toneladas" : "Lançar toneladas"}</DialogTitle>
          <DialogDescription>Toneladas de massa descarregadas pela vibroacabadora no turno.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="t-eq">Vibroacabadora *</Label>
            <Select value={equip} onValueChange={setEquip} disabled={fixo}>
              <SelectTrigger id="t-eq"><SelectValue placeholder="Selecione a frota" /></SelectTrigger>
              <SelectContent>{vibros.map(v => <SelectItem key={v.id} value={v.id}>{v.frota}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label htmlFor="t-ogs">Obra (OGS) *</Label>
            <Select value={ogs} onValueChange={setOgs} disabled={fixo}>
              <SelectTrigger id="t-ogs"><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
              <SelectContent>{ogsData.map((o: any) => <SelectItem key={o.id} value={o.ogs_number}>{o.ogs_number}{o.client_name ? ` — ${o.client_name}` : ""}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="t-data">Data do turno *</Label><Input id="t-data" type="date" value={data} max={hoje()} disabled={fixo} onChange={e => setData(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="t-turno">Turno *</Label>
              <Select value={turno} onValueChange={v => setTurno(v as TurnoProducao)} disabled={fixo}>
                <SelectTrigger id="t-turno"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="diurno">Diurno</SelectItem><SelectItem value="noturno">Noturno</SelectItem></SelectContent>
              </Select></div>
          </div>
          {turno === "noturno" && <p className="text-xs text-muted-foreground">Turno noturno: use a data em que o turno começou.</p>}
          <div className="space-y-1"><Label htmlFor="t-ton">Toneladas descarregadas (t) *</Label>
            <Input id="t-ton" inputMode="decimal" value={ton} onChange={e => setTon(e.target.value)} placeholder="Ex.: 312,45" /></div>
          <div className="space-y-1"><Label htmlFor="t-obs">Observação</Label><Input id="t-obs" maxLength={500} value={obs} onChange={e => setObs(e.target.value)} /></div>
          {erro && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
