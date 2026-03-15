import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import NfPhotoCapture from "./NfPhotoCapture";
import { useUsinas, useMateriais } from "@/hooks/useFilteredData";

export interface NotaFiscalMassaEntry {
  id: string;
  placa: string;
  usina: string;
  nf: string;
  tonelagem: string;
  tipo_material: string;
  tipo_material_outro: string;
  photo_url?: string;
}

interface Props {
  entries: NotaFiscalMassaEntry[];
  onChange: (entries: NotaFiscalMassaEntry[]) => void;
  tipoRdo: string;
}

const emptyNF = (): NotaFiscalMassaEntry => ({
  id: crypto.randomUUID(), placa: "", usina: "", nf: "", tonelagem: "", tipo_material: "", tipo_material_outro: "",
});

export default function SectionCauq({ entries, onChange, tipoRdo }: Props) {
  const { data: usinasData } = useUsinas(tipoRdo);
  const { data: materiaisData } = useMateriais(tipoRdo, "Nota Fiscal");

  const usinas = usinasData?.map(u => u.nome) ?? [];
  const materiais = materiaisData?.map(m => m.nome) ?? [];
  const materiaisWithOutro = materiais.length > 0 ? [...materiais, "Outro"] : ["Outro"];

  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  const totalTon = entries.reduce((sum, e) => sum + (parseFloat(e.tonelagem) || 0), 0);

  const handleOcrExtracted = (data: Record<string, string>, photoUrl: string) => {
    const emptyIdx = entries.findIndex(e => !e.nf && !e.placa && !e.tonelagem && !e.usina);
    const ocrData: Partial<NotaFiscalMassaEntry> = {
      nf: data.nf || "", placa: (data.placa || "").toUpperCase(), tonelagem: data.tonelagem || "",
      usina: "", tipo_material: "", tipo_material_outro: "", photo_url: photoUrl,
    };
    let updatedEntries: NotaFiscalMassaEntry[];
    let targetId: string;
    if (emptyIdx >= 0) {
      targetId = entries[emptyIdx].id;
      updatedEntries = entries.map((e, i) => i === emptyIdx ? { ...e, ...ocrData } : e);
    } else {
      targetId = crypto.randomUUID();
      updatedEntries = [...entries, { id: targetId, ...ocrData } as NotaFiscalMassaEntry];
    }
    onChange(updatedEntries);
    setTimeout(() => {
      const newCard = document.querySelector(`[data-entry-id="${targetId}"] [data-usina-trigger]`);
      if (newCard instanceof HTMLElement) newCard.focus();
    }, 200);
  };

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <FileText className="w-5 h-5 text-emerald-500" />
        Notas Fiscais de Massa
      </h2>

      <NfPhotoCapture tipo="CAUQ" onExtracted={handleOcrExtracted} />

      {entries.map((entry, idx) => (
        <div key={entry.id} data-entry-id={entry.id} className="rdo-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-display font-bold text-primary">NF {idx + 1}</span>
              {entry.photo_url && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">📷 OCR</span>}
            </div>
            {entries.length > 1 && (
              <button onClick={() => onChange(entries.filter(e => e.id !== entry.id))} className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Placa</span>
              <Input value={entry.placa} onChange={e => update(entry.id, "placa", e.target.value)} className="h-11 bg-white border-border rounded-xl uppercase" placeholder="ABC-1234" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Usina</span>
              <Select value={entry.usina} onValueChange={v => update(entry.id, "usina", v)}>
                <SelectTrigger data-usina-trigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  {usinas.length > 0
                    ? usinas.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)
                    : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum item cadastrado para este tipo de RDO</p>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Nº NF</span>
              <Input inputMode="numeric" value={entry.nf} onChange={e => update(entry.id, "nf", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Tonelagem</span>
              <Input type="number" inputMode="decimal" value={entry.tonelagem} onChange={e => update(entry.id, "tonelagem", e.target.value)} className="h-11 bg-white border-border rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Tipo Material</span>
            <Select value={entry.tipo_material} onValueChange={v => {
              const updated = entries.map(e => e.id === entry.id ? { ...e, tipo_material: v, tipo_material_outro: v !== "Outro" ? "" : e.tipo_material_outro } : e);
              onChange(updated);
            }}>
              <SelectTrigger className="h-11 bg-white border-border rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {materiaisWithOutro.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {entry.tipo_material === "Outro" && (
            <div className="space-y-1.5">
              <span className="rdo-label">Especifique o Material</span>
              <Input value={entry.tipo_material_outro} onChange={e => update(entry.id, "tipo_material_outro", e.target.value)} className="h-11 bg-white border-border rounded-xl" placeholder="Digite o material..." />
            </div>
          )}
        </div>
      ))}

      <Button size="sm" onClick={() => onChange([...entries, emptyNF()])} className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold">
        <Plus className="w-5 h-5" /> Adicionar NF
      </Button>

      {totalTon > 0 && (
        <div className="rdo-card border-l-4 border-l-emerald-500 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-primary">{totalTon.toFixed(2)} t</p>
        </div>
      )}
    </div>
  );
}
