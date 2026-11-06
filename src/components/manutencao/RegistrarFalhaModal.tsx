import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import {
  CAUSAS_FALHA, ORIGEM_LABEL, criarFalha, deInputLocal, duracaoHoras, fmtHoras, origemPorPerfil, validarFalha,
  type OrigemFalha,
} from "@/lib/equipDisponibilidade";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pré-preenchimento quando aberto a partir do Diário de Equipamento / OS / Ocorrência. */
  defaults?: { equipamentoId?: string; frota?: string; ogs?: string; diaryId?: string; osId?: string; ocorrenciaId?: string; inicio?: string };
}

interface EquipOpt { id: string; frota: string; tipo: string | null }

export default function RegistrarFalhaModal({ open, onClose, onSaved, defaults }: Props) {
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: ogsData = [] } = useOgsReference();
  const [equipamentos, setEquipamentos] = useState<EquipOpt[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ equipamentoId: "", ogs: "", inicio: "", fim: "", causa: "", descricao: "", origem: "operador" as OrigemFalha });
  const [ainda, setAinda] = useState(true);

  useEffect(() => {
    if (!open) return;
    setErro("");
    setAinda(true);
    setForm({
      equipamentoId: defaults?.equipamentoId || "", ogs: defaults?.ogs || "", inicio: defaults?.inicio || "", fim: "",
      causa: "", descricao: "", origem: origemPorPerfil(profile?.perfil),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults?.equipamentoId, defaults?.ogs, defaults?.inicio, profile?.perfil]);

  useEffect(() => {
    if (!open || !profile?.company_id) return;
    let vivo = true;
    (supabase as any).from("equipamentos").select("id, frota, tipo").eq("company_id", profile.company_id)
      .order("frota").limit(2000)
      .then(({ data }: { data: EquipOpt[] | null }) => { if (vivo) setEquipamentos(data || []); });
    return () => { vivo = false; };
  }, [open, profile?.company_id]);

  // Se veio só a frota (diário), resolve o ID quando a lista carregar.
  useEffect(() => {
    if (!open || form.equipamentoId || !defaults?.frota) return;
    const e = equipamentos.find(x => x.frota === defaults.frota);
    if (e) setForm(f => ({ ...f, equipamentoId: e.id }));
  }, [open, equipamentos, defaults?.frota, form.equipamentoId]);

  const horas = useMemo(
    () => duracaoHoras(deInputLocal(form.inicio), ainda ? null : deInputLocal(form.fim)),
    [form.inicio, form.fim, ainda],
  );

  async function salvar() {
    const msg = validarFalha({ ...form, fim: ainda ? "" : form.fim });
    if (msg) { setErro(msg); return; }
    if (!profile?.company_id) { setErro("Não foi possível identificar sua empresa. Recarregue a página."); return; }
    setSalvando(true);
    setErro("");
    try {
      await criarFalha({
        companyId: profile.company_id, userId: profile.user_id, equipamentoId: form.equipamentoId, ogs: form.ogs,
        inicioIso: deInputLocal(form.inicio)!, fimIso: ainda ? null : deInputLocal(form.fim),
        causa: form.causa, descricao: form.descricao, origem: form.origem,
        diaryId: defaults?.diaryId, osId: defaults?.osId, ocorrenciaId: defaults?.ocorrenciaId,
      });
      toast({ title: "Falha registrada", description: ainda ? "Equipamento marcado como parado. Informe o retorno quando voltar a operar." : undefined });
      onSaved();
      onClose();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar a falha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !salvando) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar falha de equipamento</DialogTitle>
          <DialogDescription>Informe quando o equipamento parou por quebra ou falha. Isso alimenta disponibilidade, MTBF e MTTR.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="falha-equip">Equipamento *</Label>
            <Select value={form.equipamentoId} onValueChange={v => setForm(f => ({ ...f, equipamentoId: v }))}>
              <SelectTrigger id="falha-equip"><SelectValue placeholder="Selecione a frota" /></SelectTrigger>
              <SelectContent>
                {equipamentos.map(e => <SelectItem key={e.id} value={e.id}>{e.frota}{e.tipo ? ` — ${e.tipo}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="falha-ogs">Obra (OGS) *</Label>
            <Select value={form.ogs} onValueChange={v => setForm(f => ({ ...f, ogs: v }))}>
              <SelectTrigger id="falha-ogs"><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
              <SelectContent>
                {ogsData.map((o: any) => <SelectItem key={o.id} value={o.ogs_number}>{o.ogs_number}{o.client_name ? ` — ${o.client_name}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="falha-inicio">Quando parou? *</Label>
            <Input id="falha-inicio" type="datetime-local" value={form.inicio} onChange={e => setForm(f => ({ ...f, inicio: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ainda} onChange={e => setAinda(e.target.checked)} />
              Ainda está parado
            </label>
            {!ainda && (
              <>
                <Label htmlFor="falha-fim">Quando voltou a operar? *</Label>
                <Input id="falha-fim" type="datetime-local" value={form.fim} onChange={e => setForm(f => ({ ...f, fim: e.target.value }))} />
                {horas !== null && <p className="text-xs text-muted-foreground">Tempo parado: {fmtHoras(horas)}</p>}
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="falha-causa">Causa *</Label>
            <Select value={form.causa} onValueChange={v => setForm(f => ({ ...f, causa: v }))}>
              <SelectTrigger id="falha-causa"><SelectValue placeholder="Selecione a causa" /></SelectTrigger>
              <SelectContent>{CAUSAS_FALHA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="falha-desc">O que aconteceu</Label>
            <Textarea id="falha-desc" rows={3} maxLength={2000} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="falha-origem">Quem está registrando</Label>
            <Select value={form.origem} onValueChange={v => setForm(f => ({ ...f, origem: v as OrigemFalha }))}>
              <SelectTrigger id="falha-origem"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["mecanico", "encarregado", "operador"] as const).map(o => <SelectItem key={o} value={o}>{ORIGEM_LABEL[o]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {erro && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Salvando…</> : "Registrar falha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
