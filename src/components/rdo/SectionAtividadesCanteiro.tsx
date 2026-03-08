import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

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
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">🏗️ Atividades de Canteiro</h2>

      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium text-foreground">Teve Usinagem hoje?</Label>
          <Switch checked={teveUsinagem} onCheckedChange={onToggleUsinagem} />
        </div>

        {teveUsinagem ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Total Usinado no Dia (Ton)</Label>
            <Input
              inputMode="decimal"
              value={totalUsinado}
              onChange={e => onChangeTotalUsinado(e.target.value)}
              className="h-12 text-base bg-secondary border-border"
              placeholder="Ex: 350"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Atividades do Canteiro</Label>
            <Textarea
              value={atividadesCanteiro}
              onChange={e => onChangeAtividades(e.target.value)}
              className="min-h-[100px] bg-secondary border-border text-base"
              placeholder="Descreva as atividades realizadas (limpeza, manutenção, etc)..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
