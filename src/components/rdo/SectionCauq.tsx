import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import NfPhotoCapture from "./NfPhotoCapture";

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
}

const USINAS = [
  "CLD", "USINAS 2A", "PAVMASS", "USIPAV", "AUPAV", "USICITY",
  "USINAS SP", "ENPAVI", "PEDRIX", "BASALTO PERUS", "USIVIX",
  "GALVANI", "SERVENG", "JOFEGE",
];

const MATERIAIS = ["Binder", "SMA", "FX-1", "Outro"];

const emptyNF = (): NotaFiscalMassaEntry => ({
  id: crypto.randomUUID(), placa: "", usina: "", nf: "", tonelagem: "", tipo_material: "", tipo_material_outro: "",
});

export default function SectionCauq({ entries, onChange }: Props) {
  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  const totalTon = entries.reduce((sum, e) => sum + (parseFloat(e.tonelagem) || 0), 0);

  const handleOcrExtracted = (data: Record<string, string>, photoUrl: string) => {
    const newEntry: NotaFiscalMassaEntry = {
      id: crypto.randomUUID(),
      nf: data.nf || "",
      placa: data.placa || "",
      usina: USINAS.find(u => u.toLowerCase() === (data.usina || "").toLowerCase()) || data.usina || "",
      tonelagem: data.tonelagem || "",
      tipo_material: MATERIAIS.find(m => m.toLowerCase() === (data.tipo_material || "").toLowerCase()) || (data.tipo_material ? "Outro" : ""),
      tipo_material_outro: MATERIAIS.find(m => m.toLowerCase() === (data.tipo_material || "").toLowerCase()) ? "" : (data.tipo_material || ""),
      photo_url: photoUrl,
    };
    onChange([...entries, newEntry]);
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-foreground">🛣️ Notas Fiscais de Massa</h2>

      <NfPhotoCapture tipo="CAUQ" onExtracted={handleOcrExtracted} />

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
              <Label className="text-xs text-muted-foreground">Placa</Label>
              <Input value={entry.placa} onChange={e => update(entry.id, "placa", e.target.value)} className="h-11 bg-secondary border-border uppercase" placeholder="ABC-1234" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Usina</Label>
              <Select value={entry.usina} onValueChange={v => update(entry.id, "usina", v)}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  {USINAS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nº NF</Label>
              <Input inputMode="numeric" value={entry.nf} onChange={e => update(entry.id, "nf", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tonelagem</Label>
              <Input type="number" inputMode="decimal" value={entry.tonelagem} onChange={e => update(entry.id, "tonelagem", e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo Material</Label>
            <Select value={entry.tipo_material} onValueChange={v => {
              const updated = entries.map(e => e.id === entry.id ? { ...e, tipo_material: v, tipo_material_outro: v !== "Outro" ? "" : e.tipo_material_outro } : e);
              onChange(updated);
            }}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {entry.tipo_material === "Outro" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Especifique o Material</Label>
              <Input value={entry.tipo_material_outro} onChange={e => update(entry.id, "tipo_material_outro", e.target.value)} className="h-11 bg-secondary border-border" placeholder="Digite o material..." />
            </div>
          )}
        </div>
      ))}

      <Button size="sm" onClick={() => onChange([...entries, emptyNF()])} className="w-full h-12 gap-2 text-base">
        <Plus className="w-5 h-5" /> Adicionar NF
      </Button>

      {totalTon > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-primary">{totalTon.toFixed(2)} t</p>
        </div>
      )}
    </div>
  );
}
