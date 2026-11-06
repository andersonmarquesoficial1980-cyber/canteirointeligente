import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import RegistrarFalhaModal from "@/components/manutencao/RegistrarFalhaModal";
import {
  ORIGEM_LABEL, adicionarReparo, atualizarFalha, deInputLocal, duracaoHoras, fmtHoras, horasReparo, listarFalhas,
  paraInputLocal, podeGerir, removerReparo, situacaoFalha, validarFalha, validarReparo, type EquipFalha,
} from "@/lib/equipDisponibilidade";

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const fmtDH = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const SITUACOES = [
  { key: "todas", label: "Todas" },
  { key: "aberta", label: "Em aberto" },
  { key: "reparada", label: "Retomaram operação" },
  { key: "cancelada", label: "Canceladas" },
] as const;
const COR: Record<string, string> = {
  aberta: "bg-red-50 text-red-700 border-red-200", reparada: "bg-green-50 text-green-700 border-green-200",
  cancelada: "bg-gray-50 text-gray-500 border-gray-200", pendente: "bg-yellow-50 text-yellow-700 border-yellow-200",
};
const TXT: Record<string, string> = { aberta: "Parado", reparada: "Voltou a operar", cancelada: "Cancelada", pendente: "Aguardando confirmação" };

export default function ManutencaoFalhas() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/manutencao");
  const isDesktop = useDesktopWorkspace();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const [params, setParams] = useSearchParams();
  const de = params.get("de") || diasAtras(30);
  const ate = params.get("ate") || hoje();
  const situacao = params.get("situacao") || "todas";
  const busca = params.get("q") || "";
  const setParam = (k: string, v: string) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const [falhas, setFalhas] = useState<EquipFalha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [gestor, setGestor] = useState(false);

  const buscar = useCallback(async () => {
    if (!profile?.company_id) return;
    setCarregando(true); setErro("");
    try { setFalhas(await listarFalhas(profile.company_id, de, ate)); }
    catch (e: any) { setErro(e?.message || "Não foi possível carregar as falhas."); setFalhas([]); }
    finally { setCarregando(false); }
  }, [profile?.company_id, de, ate]);

  useEffect(() => { buscar(); }, [buscar]);
  useEffect(() => { if (profile?.company_id) podeGerir(profile.company_id).then(setGestor); }, [profile?.company_id]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return falhas.filter(f =>
      (situacao === "todas" || situacaoFalha(f) === situacao) &&
      (!q || `${f.equipamentos?.frota || ""} ${f.ogs_number} ${f.causa}`.toLowerCase().includes(q)));
  }, [falhas, situacao, busca]);

  const detalhe = falhas.find(f => f.id === detalheId) || null;
  const podeEditar = (f: EquipFalha) => gestor || f.created_by === profile?.user_id;

  return (
    <div className={`min-h-screen ${isDesktop ? "bg-page" : "bg-[hsl(210_20%_98%)]"}`}>
      <header className={`flex items-center gap-3 bg-header-gradient shadow-lg ${isDesktop ? "flex-wrap px-8 py-5" : "px-4 py-3"}`}>
        <button onClick={goBack} aria-label="Voltar" className="rounded-lg p-2 text-primary-foreground hover:bg-white/15"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h1 className={`font-display text-primary-foreground ${isDesktop ? "text-2xl font-semibold" : "text-sm font-extrabold"}`}>Falhas e reparos</h1>
          <span className="text-sm text-primary-foreground/80">Paradas de equipamento por quebra</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/manutencao/horarios")} className="gap-1 border-white/30 bg-white/10 text-white hover:bg-white/20">
          <Clock className="h-4 w-4" /> Horários programados
        </Button>
        <Button size="sm" onClick={() => setNovo(true)} className="gap-1 border-0 bg-white/20 text-white hover:bg-white/30">
          <Plus className="h-4 w-4" /> Registrar falha
        </Button>
      </header>

      <div className={`mx-auto space-y-3 ${isDesktop ? "max-w-[1200px] px-8 py-6" : "max-w-2xl px-4 py-4"}`}>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <div><Label htmlFor="f-de" className="text-xs">De</Label><Input id="f-de" type="date" value={de} onChange={e => setParam("de", e.target.value)} /></div>
          <div><Label htmlFor="f-ate" className="text-xs">Até</Label><Input id="f-ate" type="date" value={ate} onChange={e => setParam("ate", e.target.value)} /></div>
          <div className="min-w-[180px] flex-1"><Label htmlFor="f-q" className="text-xs">Frota, obra ou causa</Label><Input id="f-q" value={busca} onChange={e => setParam("q", e.target.value)} placeholder="Buscar" /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {SITUACOES.map(s => (
            <button key={s.key} onClick={() => setParam("situacao", s.key === "todas" ? "" : s.key)}
              className={`rounded-full border px-3 py-1 text-sm ${situacao === s.key ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{s.label}</button>
          ))}
        </div>

        {carregando && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando falhas…</p>}
        {erro && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        {!carregando && !erro && lista.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma falha neste período.</p>}
        {falhas.length >= 500 && <p className="text-xs text-muted-foreground">Mostrando as 500 mais recentes; reduza o período para ver as demais.</p>}

        <ul className="space-y-2">
          {lista.map(f => {
            const sit = situacaoFalha(f);
            return (
              <li key={f.id}>
                <button onClick={() => setDetalheId(f.id)} className="w-full rounded-xl border bg-card p-3 text-left hover:bg-accent/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{f.equipamentos?.frota || "—"}</span>
                    <span className="text-xs text-muted-foreground">OGS {f.ogs_number}</span>
                    <span className={`ml-auto rounded-full border px-2 py-0.5 text-xs ${COR[sit]}`}>{TXT[sit]}</span>
                  </div>
                  <p className="mt-1 text-sm">{f.causa}{f.descricao ? ` — ${f.descricao}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDH(f.parada_inicio)} → {f.parada_fim ? fmtDH(f.parada_fim) : "ainda parado"}
                    {" · "}parado: {fmtHoras(duracaoHoras(f.parada_inicio, f.parada_fim))}
                    {" · "}reparo efetivo: {(f.equip_falha_reparos || []).length ? fmtHoras(horasReparo(f.equip_falha_reparos)) : "não informado"}
                    {" · "}{ORIGEM_LABEL[f.origem]}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <RegistrarFalhaModal open={novo} onClose={() => setNovo(false)} onSaved={buscar} />
      {detalhe && profile?.company_id && (
        <DetalheFalha falha={detalhe} companyId={profile.company_id} userId={profile.user_id} podeEditar={podeEditar(detalhe)}
          onClose={() => setDetalheId(null)} onChanged={buscar} toast={toast} />
      )}
    </div>
  );
}

function DetalheFalha({ falha, companyId, userId, podeEditar, onClose, onChanged, toast }: {
  falha: EquipFalha; companyId: string; userId: string; podeEditar: boolean; onClose: () => void; onChanged: () => void; toast: ReturnType<typeof useToast>["toast"];
}) {
  const [fim, setFim] = useState(paraInputLocal(falha.parada_fim));
  const [rIni, setRIni] = useState("");
  const [rFim, setRFim] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => { setFim(paraInputLocal(falha.parada_fim)); }, [falha.parada_fim]);

  async function exec(acao: () => Promise<void>, ok: string) {
    setOcupado(true); setErro("");
    try { await acao(); toast({ title: ok }); onChanged(); }
    catch (e: any) { setErro(e?.message || "Não foi possível concluir a ação."); }
    finally { setOcupado(false); }
  }

  const salvarRetorno = () => {
    const msg = validarFalha({ equipamentoId: falha.equipamento_id, ogs: falha.ogs_number, causa: falha.causa, inicio: paraInputLocal(falha.parada_inicio), fim });
    if (!fim) { setErro("Informe quando o equipamento voltou a operar."); return; }
    if (msg) { setErro(msg); return; }
    const novoFim = new Date(deInputLocal(fim)!).getTime();
    if ((falha.equip_falha_reparos || []).some(r => new Date(r.reparo_fim).getTime() > novoFim)) {
      setErro("Há trecho de reparo que termina depois deste retorno. Ajuste ou remova o trecho primeiro.");
      return;
    }
    return exec(() => atualizarFalha(falha.id, { parada_fim: deInputLocal(fim) }), "Retorno à operação registrado");
  };
  const addReparo = () => {
    const msg = validarReparo(falha, rIni, rFim);
    if (msg) { setErro(msg); return; }
    return exec(async () => {
      await adicionarReparo({ companyId, falhaId: falha.id, inicioIso: deInputLocal(rIni)!, fimIso: deInputLocal(rFim)!, descricao: rDesc, userId });
      setRIni(""); setRFim(""); setRDesc("");
    }, "Trecho de reparo registrado");
  };

  const reparos = falha.equip_falha_reparos || [];
  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{falha.equipamentos?.frota || "Equipamento"} — {falha.causa}</DialogTitle>
          <DialogDescription>OGS {falha.ogs_number} · parou em {fmtDH(falha.parada_inicio)} · {ORIGEM_LABEL[falha.origem]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {falha.descricao && <p className="text-sm">{falha.descricao}</p>}
          {falha.status === "cancelada" && <p className="text-sm text-muted-foreground">Falha cancelada{falha.motivo_cancelamento ? `: ${falha.motivo_cancelamento}` : ""}.</p>}

          {falha.status !== "cancelada" && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Retorno à operação</h3>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1"><Label htmlFor="d-fim" className="text-xs">Voltou a operar em</Label>
                  <Input id="d-fim" type="datetime-local" value={fim} onChange={e => setFim(e.target.value)} disabled={!podeEditar || ocupado} /></div>
                {podeEditar && <Button onClick={salvarRetorno} disabled={ocupado}>Salvar retorno</Button>}
              </div>
              <p className="text-xs text-muted-foreground">Tempo parado: {fmtHoras(duracaoHoras(falha.parada_inicio, falha.parada_fim))}</p>
            </section>
          )}

          {falha.status !== "cancelada" && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1 text-sm font-semibold"><Wrench className="h-4 w-4" /> Tempo efetivo de reparo</h3>
              <p className="text-xs text-muted-foreground">Registre só o tempo em que o mecânico trabalhou no reparo (espera de peça ou deslocamento ficam de fora). Alimenta o MTTR.</p>
              {reparos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum trecho de reparo informado.</p>}
              <ul className="space-y-1">
                {reparos.map(r => (
                  <li key={r.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                    <span className="flex-1">{fmtDH(r.reparo_inicio)} → {fmtDH(r.reparo_fim)} ({fmtHoras(duracaoHoras(r.reparo_inicio, r.reparo_fim))}){r.descricao ? ` — ${r.descricao}` : ""}</span>
                    {podeEditar && <button aria-label="Remover trecho" disabled={ocupado} onClick={() => exec(() => removerReparo(r.id), "Trecho removido")}><Trash2 className="h-4 w-4 text-destructive" /></button>}
                  </li>
                ))}
              </ul>
              {reparos.length > 0 && <p className="text-xs">Total efetivo: <strong>{fmtHoras(horasReparo(reparos))}</strong></p>}
              {podeEditar && (
                <div className="space-y-2 rounded-md border p-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label htmlFor="r-ini" className="text-xs">Início do reparo</Label><Input id="r-ini" type="datetime-local" value={rIni} onChange={e => setRIni(e.target.value)} /></div>
                    <div><Label htmlFor="r-fim" className="text-xs">Fim do reparo</Label><Input id="r-fim" type="datetime-local" value={rFim} onChange={e => setRFim(e.target.value)} /></div>
                  </div>
                  <Input aria-label="Descrição do reparo" placeholder="O que foi feito (opcional)" value={rDesc} onChange={e => setRDesc(e.target.value)} />
                  <Button size="sm" onClick={addReparo} disabled={ocupado}>Adicionar trecho</Button>
                </div>
              )}
            </section>
          )}

          {podeEditar && falha.status !== "cancelada" && (
            <section className="space-y-2 border-t pt-3">
              {!cancelando ? (
                <Button variant="outline" size="sm" onClick={() => setCancelando(true)}>Lançada por engano? Cancelar falha</Button>
              ) : (
                <>
                  <Label htmlFor="d-motivo" className="text-xs">Motivo do cancelamento</Label>
                  <Textarea id="d-motivo" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={ocupado || !motivo.trim()}
                      onClick={() => exec(() => atualizarFalha(falha.id, { status: "cancelada", motivo_cancelamento: motivo.trim() }), "Falha cancelada")}>Confirmar cancelamento</Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelando(false)}>Voltar</Button>
                  </div>
                </>
              )}
            </section>
          )}
          {!podeEditar && <p className="text-xs text-muted-foreground">Somente quem registrou ou a gestão pode alterar esta falha.</p>}
          {erro && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
