import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DESTINOS_RAPIDOS, rotuloPendencia, tomPendencia,
  type DestinoRapido, type FormPendenciaRapida, type PendenciaQuadro, type PrioridadePendencia,
} from "@/lib/quadroPendencias";

type Props = {
  pessoa: { id: string; name: string; role: string | null; equipe: string | null } | null;
  abertas: PendenciaQuadro[];
  equipes: string[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (form: FormPendenciaRapida) => void;
};

const campo = "w-full mt-1 h-9 rounded-lg border border-border bg-background px-2 text-sm";
const rotulo = "text-[10px] text-muted-foreground uppercase";

export default function PendenciaRapidaDialog({ pessoa, abertas, equipes, salvando, onFechar, onSalvar }: Props) {
  const [destino, setDestino] = useState<DestinoRapido>("alocar");
  const [prioridade, setPrioridade] = useState<PrioridadePendencia>("normal");
  const [dataEfetiva, setDataEfetiva] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [tipoDemissao, setTipoDemissao] = useState("sem_justa_causa");
  const [equipeSugerida, setEquipeSugerida] = useState("");
  const [substituto, setSubstituto] = useState("");
  const [outroTexto, setOutroTexto] = useState("");
  const [classificacaoNova, setClassificacaoNova] = useState("");
  const [novoSalario, setNovoSalario] = useState("");

  useEffect(() => {
    if (!pessoa) return;
    setDestino(pessoa.equipe?.trim() ? "outro" : "alocar");
    setPrioridade("normal"); setDataEfetiva(""); setJustificativa(""); setTipoDemissao("sem_justa_causa");
    setEquipeSugerida(""); setSubstituto(""); setOutroTexto(""); setClassificacaoNova(""); setNovoSalario("");
  }, [pessoa?.id]);

  return (
    <Dialog open={!!pessoa} onOpenChange={(aberto) => { if (!aberto && !salvando) onFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pendência · {pessoa?.name}</DialogTitle>
          <DialogDescription>
            {pessoa?.role || "Sem função"} · {pessoa?.equipe?.trim() || "Sem equipe"}. Isto registra o que vai acontecer na fila da Gestão de Pessoas;
            não altera o cadastro, o status nem a equipe.
          </DialogDescription>
        </DialogHeader>

        {abertas.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs space-y-1">
            <p className="font-semibold text-amber-900">Já em aberto para este funcionário:</p>
            {abertas.map((p) => (
              <p key={p.id} className="text-amber-900">
                <strong>{rotuloPendencia(p)}</strong>{tomPendencia(p) === "critico" ? " ⚠" : ""} · {p.status === "em_analise" ? "em análise" : "aberta"} · {p.justificativa}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className={rotulo}>O que vai acontecer? *</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value as DestinoRapido)} className={campo}>
              {DESTINOS_RAPIDOS.map((d) => <option key={d.id} value={d.id}>{d.rotulo} — {d.dica}</option>)}
            </select>
          </div>

          {destino === "alocar" && (
            <div>
              <label className={rotulo}>Equipe sugerida *</label>
              <select value={equipeSugerida} onChange={(e) => setEquipeSugerida(e.target.value)} className={campo}>
                <option value="">Selecione…</option>
                {equipes.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
          )}
          {destino === "demitir" && (
            <div>
              <label className={rotulo}>Tipo de demissão</label>
              <select value={tipoDemissao} onChange={(e) => setTipoDemissao(e.target.value)} className={campo}>
                <option value="sem_justa_causa">Sem justa causa</option>
                <option value="com_justa_causa">Com justa causa</option>
                <option value="termino_contrato">Término de contrato</option>
              </select>
            </div>
          )}
          {destino === "substituir" && (
            <div>
              <label className={rotulo}>Substituto sugerido</label>
              <input value={substituto} onChange={(e) => setSubstituto(e.target.value)} className={campo} placeholder="Nome (opcional)" />
            </div>
          )}
          {destino === "classificar" && (
            <div>
              <label className={rotulo}>Nova classificação *</label>
              <input value={classificacaoNova} onChange={(e) => setClassificacaoNova(e.target.value)} className={campo} placeholder="Ex: OPERADOR DE ROLO SR" />
            </div>
          )}
          {destino === "aumento" && (
            <div>
              <label className={rotulo}>Novo salário (R$) *</label>
              <input type="number" step="0.01" value={novoSalario} onChange={(e) => setNovoSalario(e.target.value)} className={campo} placeholder="Ex: 4200.00" />
            </div>
          )}
          {destino === "outro" && (
            <div>
              <label className={rotulo}>Descreva *</label>
              <input value={outroTexto} onChange={(e) => setOutroTexto(e.target.value)} className={campo} placeholder="Ex.: Transferir para outra obra" />
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
          <button onClick={onFechar} disabled={salvando} className="h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button
            disabled={salvando}
            onClick={() => onSalvar({ destino, justificativa, prioridade, dataEfetiva, tipoDemissao, equipeSugerida, substitutoSugerido: substituto, outroTexto, classificacaoNova, novoSalario })}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />} Registrar pendência
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
