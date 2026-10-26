import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PrioridadePendencia } from "@/lib/quadroPendencias";
import {
  TIPOS_EQUIP, rotuloPendenciaEquip,
  type FormPendenciaEquip, type LinhaPendenciaEquip, type TipoPendenciaEquip,
} from "@/lib/quadroFrotasPendencias";

type Props = {
  equipamento: { id: string; frota: string; tipo: string | null; setor: string | null } | null;
  abertas: LinhaPendenciaEquip[];
  equipes: string[];
  salvando: boolean;
  podeResolver: boolean;
  onFechar: () => void;
  onSalvar: (form: FormPendenciaEquip) => void;
  onResolver: (p: LinhaPendenciaEquip, novo: "aprovada" | "cancelada") => void;
};

const campo = "w-full mt-1 h-9 rounded-lg border border-border bg-background px-2 text-sm";
const rotulo = "text-[10px] text-muted-foreground uppercase";

export default function PendenciaEquipamentoDialog({ equipamento, abertas, equipes, salvando, podeResolver, onFechar, onSalvar, onResolver }: Props) {
  const [tipo, setTipo] = useState<TipoPendenciaEquip>("alocar");
  const [prioridade, setPrioridade] = useState<PrioridadePendencia>("normal");
  const [dataEfetiva, setDataEfetiva] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [equipeSugerida, setEquipeSugerida] = useState("");
  const [substituto, setSubstituto] = useState("");
  const [outroTexto, setOutroTexto] = useState("");

  useEffect(() => {
    if (!equipamento) return;
    setTipo(equipamento.setor?.trim() ? "transferir" : "alocar");
    setPrioridade("normal"); setDataEfetiva(""); setJustificativa(""); setEquipeSugerida(""); setSubstituto(""); setOutroTexto("");
  }, [equipamento?.id]);

  return (
    <Dialog open={!!equipamento} onOpenChange={(aberto) => { if (!aberto && !salvando) onFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pendência · {equipamento?.frota}</DialogTitle>
          <DialogDescription>
            {equipamento?.tipo || "Sem tipo"} · {equipamento?.setor?.trim() || "Sem equipe"}. Registra o que vai acontecer com o equipamento;
            não altera o status nem a equipe dele.
          </DialogDescription>
        </DialogHeader>

        {abertas.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs space-y-2">
            <p className="font-semibold text-amber-900">Já em aberto para este equipamento:</p>
            {abertas.map((p) => (
              <div key={p.id} className="space-y-1">
                <p className="text-amber-900"><strong>{rotuloPendenciaEquip(p)}</strong> · {p.prioridade} · {p.justificativa}</p>
                {podeResolver && (
                  <div className="flex gap-2">
                    <button onClick={() => onResolver(p, "aprovada")} disabled={salvando} className="px-2 py-0.5 rounded border border-emerald-400 text-emerald-700 font-semibold hover:bg-emerald-50 disabled:opacity-50">Concluir</button>
                    <button onClick={() => onResolver(p, "cancelada")} disabled={salvando} className="px-2 py-0.5 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className={rotulo}>O que vai acontecer? *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPendenciaEquip)} className={campo}>
              {TIPOS_EQUIP.map((t) => <option key={t.id} value={t.id}>{t.rotulo} — {t.dica}</option>)}
            </select>
          </div>

          {(tipo === "alocar" || tipo === "transferir") && (
            <div>
              <label className={rotulo}>Equipe de destino *</label>
              <select value={equipeSugerida} onChange={(e) => setEquipeSugerida(e.target.value)} className={campo}>
                <option value="">Selecione…</option>
                {equipes.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
          )}
          {tipo === "substituir" && (
            <div>
              <label className={rotulo}>Equipamento substituto</label>
              <input value={substituto} onChange={(e) => setSubstituto(e.target.value)} className={campo} placeholder="Frota (opcional)" />
            </div>
          )}
          {tipo === "outros" && (
            <div>
              <label className={rotulo}>Descreva *</label>
              <input value={outroTexto} onChange={(e) => setOutroTexto(e.target.value)} className={campo} placeholder="Ex.: Trocar pneus antes de alocar" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rotulo}>Prioridade</label>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadePendencia)} className={campo}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className={rotulo}>Data prevista</label>
              <input type="date" value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)} className={campo} />
            </div>
          </div>

          <div>
            <label className={rotulo}>Motivo / justificativa *</label>
            <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3}
              className="w-full mt-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" placeholder="Por que isso vai acontecer?" />
          </div>
        </div>

        <DialogFooter>
          <button onClick={onFechar} disabled={salvando} className="h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50">Fechar</button>
          <button
            disabled={salvando}
            onClick={() => onSalvar({ tipo, justificativa, prioridade, dataEfetiva, equipeSugerida, substituto, outroTexto })}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />} Registrar pendência
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
