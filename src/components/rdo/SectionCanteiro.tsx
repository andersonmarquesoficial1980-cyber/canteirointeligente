import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import NfPhotoCapture, { fuzzyMatch } from "./NfPhotoCapture";
import { useFornecedores } from "@/hooks/useFilteredData";

export interface NotaFiscalInsumoEntry {
  id: string;
  nf: string;
  fornecedor: string;
  material: string;
  quantidade: string;
  photo_url?: string;
}

interface Props {
  entries: NotaFiscalInsumoEntry[];
  onChange: (entries: NotaFiscalInsumoEntry[]) => void;
  tipoRdo: string;
}

const emptyNF = (): NotaFiscalInsumoEntry => ({
  id: crypto.randomUUID(), nf: "", fornecedor: "", material: "", quantidade: "",
});

export default function SectionCanteiro({ entries, onChange, tipoRdo }: Props) {
  const { data: fornecedoresData } = useFornecedores(tipoRdo);
  const fornecedores = fornecedoresData?.map(f => f.nome) ?? [];

  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  const handleOcrExtracted = (data: Record<string, string>, photoUrl: string) => {
    const matchedFornecedor = fornecedores.find(f => f === data.fornecedor) || fuzzyMatch(data.fornecedor || "", fornecedores) || data.fornecedor || "";
    
    const newEntry: NotaFiscalInsumoEntry = {
      id: crypto.randomUUID(),
      nf: data.nf || "",
      fornecedor: matchedFornecedor,
      material: data.material || "",
      quantidade: data.quantidade || "",
      photo_url: photoUrl,
    };
    console.log("[SectionCanteiro] OCR entry:", newEntry);
    onChange([...entries, newEntry]);
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">🏭 Notas Fiscais de Insumos</h2>

      <NfPhotoCapture
        tipo="CANTEIRO"
        onExtracted={handleOcrExtracted}
        fornecedoresOptions={fornecedores}
      />

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">NF {idx + 1}</span>
              {entry.photo_url && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">📷 OCR</span>}
            </div>
            {entries.length > 1 && (
              <button onClick={() => onChange(entries.filter(e => e.id !== entry.id))} className="text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nº NF</Label>
              <Input inputMode="numeric" value={entry.nf} onChange={e => update(entry.id, "nf", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fornecedor</Label>
              <Select value={entry.fornecedor} onValueChange={v => update(entry.id, "fornecedor", v)}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.length > 0
                    ? fornecedores.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)
                    : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum item cadastrado para este tipo de RDO</p>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Material</Label>
              <Input value={entry.material} onChange={e => update(entry.id, "material", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Quantidade</Label>
              <Input inputMode="numeric" value={entry.quantidade} onChange={e => update(entry.id, "quantidade", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
        </div>
      ))}

      <Button size="sm" onClick={() => onChange([...entries, emptyNF()])} className="w-full h-12 gap-2 text-base">
        <Plus className="w-5 h-5" /> Adicionar NF
      </Button>
    </div>
  );
}
