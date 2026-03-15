import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Factory } from "lucide-react";

interface Props {
  teveUsinagem: boolean;
  onToggleUsinagem: (v: boolean) => void;
  totalUsinado: string;
  onChangeTotalUsinado: (v: string) => void;
  atividadesCanteiro: string;
  onChangeAtividades: (v: string) => void;
}

export default function SectionAtividadesCanteiro({
  teveUsinagem, onToggleUsinagem,
  totalUsinado, onChangeTotalUsinado,
  atividadesCanteiro, onChangeAtividades,
}: Props) {
  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Factory className="w-5 h-5 text-teal-500" />
        Atividades de Canteiro
      </h2>

      <div className="rdo-card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-foreground">Teve Usinagem hoje?</span>
          <Switch checked={teveUsinagem} onCheckedChange={onToggleUsinagem} />
        </div>

        {teveUsinagem ? (
          <div className="space-y-1.5">
            <span className="rdo-label">Total Usinado no Dia (Ton)</span>
            <Input
              inputMode="decimal"
              value={totalUsinado}
              onChange={e => onChangeTotalUsinado(e.target.value)}
              className="h-12 text-base bg-white border-border rounded-xl"
              placeholder="Ex: 350"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="rdo-label">Atividades do Canteiro</span>
            <Textarea
              value={atividadesCanteiro}
              onChange={e => onChangeAtividades(e.target.value)}
              className="min-h-[100px] bg-white border-border text-base rounded-xl"
              placeholder="Descreva as atividades realizadas (limpeza, manutenção, etc)..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
