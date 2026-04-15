import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Construction } from "lucide-react";
import { useEmpreiteiros, useTiposServico } from "@/hooks/useFilteredData";

export interface InfraProducaoEntry {
  id: string;
  tipo_servico: string;
  sentido: string;
  estaca_inicial: string;
  estaca_final: string;
  comprimento_m: string;
  largura_m: string;
  espessura_cm: string;
  is_retrabalho: boolean;
}

interface Props {
  empreiteiro: string;
  producao: InfraProducaoEntry[];
  onChangeEmpreiteiro: (v: string) => void;
  onChangeProducao: (entries: InfraProducaoEntry[]) => void;
  tipoRdo: string;
}

const TIPOS_SEM_PRODUCAO = ["DEMOLIÇÃO", "REPARO", "LIMPEZA"];

const emptyEntry = (): InfraProducaoEntry => ({
  id: crypto.randomUUID(), tipo_servico: "", sentido: "", estaca_inicial: "", estaca_final: "",
  comprimento_m: "", largura_m: "", espessura_cm: "", is_retrabalho: false,
});

export default function SectionInfraestrutura({ empreiteiro, producao, onChangeEmpreiteiro, onChangeProducao, tipoRdo }: Props) {
  const { data: empreiteiros } = useEmpreiteiros(tipoRdo);
  const { data: servicos } = useTiposServico(tipoRdo);

  const update = (id: string, field: string, value: any) =>
    onChangeProducao(producao.map(e => e.id === id ? { ...e, [field]: value } : e));

  // Tipos de serviço: lista do banco + opções fixas
  const tiposServico = [
    ...(servicos?.map(s => s.nome) ?? []),
    "DEMOLIÇÃO", "REPARO", "LIMPEZA",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Construction className="w-5 h-5 text-yellow-500" />
        Infraestrutura
      </h2>

      <div className="rdo-card space-y-3">
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
            {/* Tipo de Serviço por trecho */}
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Serviço</span>
              <Select value={entry.tipo_servico} onValueChange={v => update(entry.id, "tipo_servico", v)}>
                <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tiposServico.length > 0
                    ? tiposServico.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                    : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum item cadastrado</p>}
                </SelectContent>
              </Select>
            </div>

            {/* Campos de produção — ocultos para DEMOLIÇÃO, REPARO, LIMPEZA */}
            {!TIPOS_SEM_PRODUCAO.includes(entry.tipo_servico) && (
              <>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={entry.is_retrabalho} onCheckedChange={v => update(entry.id, "is_retrabalho", !!v)} />
                    <span className="text-xs text-muted-foreground">É Retrabalho?</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {area > 0 && <span className="text-sm font-bold text-primary">Área: {area.toFixed(2)} m²</span>}
                    {volume > 0 && <span className="text-sm font-bold" style={{ color: "hsl(215 100% 40%)" }}>Volume: {volume.toFixed(3)} m³</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      <Button size="sm" onClick={() => onChangeProducao([...producao, emptyEntry()])} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar Trecho
      </Button>
    </div>
  );
}
