import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarDataBR } from "@/lib/quadroAlocacao";

export type EstadoMovimento =
  | { tipo: "mover"; nome: string; origem: string | null; destino: string; destinoRotulo: string; emprestado: boolean; permiteTemporario: boolean }
  | { tipo: "retorno"; nome: string; origem: string; destino: string; fimPrevisto: string | null };

export type FormTemporario = { dataInicio: string; dataFim: string; observacao: string };

type Props = {
  estado: EstadoMovimento | null;
  hoje: string;
  salvando: boolean;
  onFechar: () => void;
  onTemporario: (form: FormTemporario) => void;
  onDefinitivo: () => void;
  onRetorno: (dataRetorno: string) => void;
};

const campo = "w-full mt-1 h-9 rounded-lg border border-border bg-background px-2 text-sm";
const rotulo = "text-[10px] text-muted-foreground uppercase";

export default function MovimentoAlocacaoDialog({ estado, hoje, salvando, onFechar, onTemporario, onDefinitivo, onRetorno }: Props) {
  const [modo, setModo] = useState<"temporario" | "definitivo">("temporario");
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState("");
  const [obs, setObs] = useState("");
  const [dataRetorno, setDataRetorno] = useState(hoje);

  useEffect(() => {
    if (!estado) return;
    setModo(estado.tipo === "mover" && estado.permiteTemporario ? "temporario" : "definitivo");
    setDataInicio(hoje); setDataFim(""); setObs(""); setDataRetorno(hoje);
  }, [estado, hoje]);

  const fimInvalido = !!dataFim && dataFim < dataInicio;

  return (
    <Dialog open={!!estado} onOpenChange={(o) => !o && !salvando && onFechar()}>
      <DialogContent className="max-w-md">
        {estado?.tipo === "mover" && (
          <>
            <DialogHeader>
              <DialogTitle>Mover {estado.nome}</DialogTitle>
              <DialogDescription>
                {estado.origem ? `${estado.origem} → ` : ""}{estado.destinoRotulo}
                {estado.emprestado ? " · hoje está emprestado; o empréstimo atual será encerrado." : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {estado.permiteTemporario && (
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={modo === "temporario"} onChange={() => setModo("temporario")} className="mt-1" />
                  <span><b>Temporário</b> — continua da equipe {estado.origem}; o custo dos dias vai para {estado.destinoRotulo}. O retorno é confirmado por você.</span>
                </label>
              )}
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="radio" checked={modo === "definitivo"} onChange={() => setModo("definitivo")} className="mt-1" />
                <span><b>Transferência definitiva</b> — muda a equipe do cadastro para {estado.destinoRotulo}.</span>
              </label>
              {modo === "temporario" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label><span className={rotulo}>Início</span><input type="date" className={campo} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></label>
                  <label><span className={rotulo}>Retorno previsto</span><input type="date" className={campo} value={dataFim} min={dataInicio} onChange={(e) => setDataFim(e.target.value)} /></label>
                  <label className="col-span-2"><span className={rotulo}>Observação (opcional)</span><input className={campo} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
                  {fimInvalido && <p className="col-span-2 text-xs text-red-700">O retorno previsto não pode ser antes do início.</p>}
                  {!dataFim && <p className="col-span-2 text-xs text-amber-700">Sem data de retorno previsto, o sistema não avisa quando terminar.</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <button disabled={salvando} onClick={onFechar} className="h-9 px-3 rounded-lg border border-border text-sm">Cancelar</button>
              <button
                disabled={salvando || (modo === "temporario" && (fimInvalido || !dataInicio))}
                onClick={() => (modo === "temporario" ? onTemporario({ dataInicio, dataFim, observacao: obs }) : onDefinitivo())}
                className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {salvando && <Loader2 size={14} className="animate-spin" />} {modo === "temporario" ? "Alocar temporariamente" : "Transferir definitivamente"}
              </button>
            </DialogFooter>
          </>
        )}
        {estado?.tipo === "retorno" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar retorno de {estado.nome}</DialogTitle>
              <DialogDescription>
                {estado.destino} → {estado.origem}{estado.fimPrevisto ? ` · previsto para ${formatarDataBR(estado.fimPrevisto)}` : ""}. O custo dos dias até aqui fica em {estado.destino}.
              </DialogDescription>
            </DialogHeader>
            <label><span className={rotulo}>Data do retorno</span><input type="date" className={campo} value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} /></label>
            <DialogFooter>
              <button disabled={salvando} onClick={onFechar} className="h-9 px-3 rounded-lg border border-border text-sm">Cancelar</button>
              <button disabled={salvando || !dataRetorno} onClick={() => onRetorno(dataRetorno)} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
                {salvando && <Loader2 size={14} className="animate-spin" />} Confirmar retorno
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
