import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Construction } from "lucide-react";
import { useEmpreiteiros, useTiposServico, useMateriais } from "@/hooks/useFilteredData";

export interface InfraProducaoEntry {
  id: string;
  sentido: string;
  estaca_inicial: string;
  estaca_final: string;
  comprimento_m: string;
  largura_m: string;
  espessura_cm: string;
  is_retrabalho: boolean;
  material: string;
}

interface Props {
  empreiteiro: string;
  tipoServico: string;
  producao: InfraProducaoEntry[];
  onChangeEmpreiteiro: (v: string) => void;
  onChangeTipoServico: (v: string) => void;
  onChangeProducao: (entries: InfraProducaoEntry[]) => void;
  tipoRdo: string;
}

const emptyEntry = (): InfraProducaoEntry => ({
  id: crypto.randomUUID(), sentido: "", estaca_inicial: "", estaca_final: "",
  comprimento_m: "", largura_m: "", espessura_cm: "", is_retrabalho: false, material: "",
});

export default function SectionInfraestrutura({ empreiteiro, tipoServico, producao, onChangeEmpreiteiro, onChangeTipoServico, onChangeProducao, tipoRdo }: Props) {
  const { data: empreiteiros } = useEmpreiteiros(tipoRdo);
  const { data: servicos } = useTiposServico(tipoRdo);
  const { data: materiais } = useMateriais(tipoRdo);

  const update = (id: string, field: string, value: any) =>
    onChangeProducao(producao.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Construction className="w-5 h-5 text-yellow-500" />
        Infraestrutura
      </h2>

      <div className="rdo-card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Empreiteiro</span>
            <Select value={empreiteiro} onValueChange={onChangeEmpreiteiro}>
              <SelectTrigger className="h-12 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {empreiteiros && empreiteiros.length > 0
                  ? empreiteiros.map(e => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)
                  : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum item cadastrado para este tipo de RDO</p>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Tipo de Serviço</span>
            <Select value={tipoServico} onValueChange={onChangeTipoServico}>
              <SelectTrigger className="h-12 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {servicos && servicos.length > 0
                  ? servicos.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)
                  : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum item cadastrado para este tipo de RDO</p>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-display font-bold pt-1" style={{ color: "hsl(220 70% 30%)" }}>Produção</h3>

      {producao.map((entry, idx) => {
        const comp = parseFloat(entry.comprimento_m) || 0;
        const larg = parseFloat(entry.largura_m) || 0;
        const esp = parseFloat(entry.espessura_cm) || 0;
        const area = comp * larg;
        const volume = area * (esp / 100);
        return (
          <div key={entry.id} className="rdo-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-bold text-primary">Trecho {idx + 1}</span>
              {producao.length > 1 && (
                <button onClick={() => onChangeProducao(producao.filter(e => e.id !== entry.id))} className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <span className="rdo-label">Sentido *</span>
                <Select value={entry.sentido} onValueChange={(v) => update(entry.id, "sentido", v)}>
                  <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRESCENTE">CRESCENTE</SelectItem>
                    <SelectItem value="DECRESCENTE">DECRESCENTE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Estaca Ini.</span>
                <Input inputMode="numeric" value={entry.estaca_inicial} onChange={e => update(entry.id, "estaca_inicial", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Estaca Fin.</span>
                <Input inputMode="numeric" value={entry.estaca_final} onChange={e => update(entry.id, "estaca_final", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <span className="rdo-label">Comp (m)</span>
                <Input type="number" inputMode="decimal" value={entry.comprimento_m} onChange={e => update(entry.id, "comprimento_m", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Larg (m)</span>
                <Input type="number" inputMode="decimal" value={entry.largura_m} onChange={e => update(entry.id, "largura_m", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Esp (cm)</span>
                <Input type="number" inputMode="decimal" value={entry.espessura_cm} onChange={e => update(entry.id, "espessura_cm", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Material</span>
              <Select value={entry.material} onValueChange={(v) => update(entry.id, "material", v)}>
                <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione material..." /></SelectTrigger>
                <SelectContent>
                  {materiais && materiais.length > 0
                    ? materiais.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)
                    : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum material cadastrado</p>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox checked={entry.is_retrabalho} onCheckedChange={v => update(entry.id, "is_retrabalho", !!v)} />
                <span className="text-xs text-muted-foreground">É Retrabalho?</span>
              </div>
              {area > 0 && <span className="text-sm font-bold text-primary">Área: {area.toFixed(2)} m²</span>}
            </div>
          </div>
        );
      })}

      <Button size="sm" onClick={() => onChangeProducao([...producao, emptyEntry()])} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Trecho
      </Button>
    </div>
  );
}
