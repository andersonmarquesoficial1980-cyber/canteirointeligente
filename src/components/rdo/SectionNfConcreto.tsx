import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Landmark } from "lucide-react";
import NfPhotoCapture from "./NfPhotoCapture";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NfConcretoEntry {
  id: string;
  nf: string;
  quantidade_m3: string;
  tipo_concreto: string;
  fornecedor: string;
  foto_url: string;
}

interface Props {
  entries: NfConcretoEntry[];
  onChange: (entries: NfConcretoEntry[]) => void;
}

const TIPOS_CONCRETO = [
  "FCK 15 MPa",
  "FCK 20 MPa",
  "FCK 25 MPa",
  "FCK 30 MPa",
  "FCK 35 MPa",
  "FCK 40 MPa",
  "Concreto Magro",
  "Concreto Ciclópico",
];

const emptyEntry = (): NfConcretoEntry => ({
  id: crypto.randomUUID(),
  nf: "",
  quantidade_m3: "",
  tipo_concreto: "",
  fornecedor: "",
  foto_url: "",
});

export default function SectionNfConcreto({ entries, onChange }: Props) {
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores_infra"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("*")
        .or("vinculo_rdo.eq.INFRA,vinculo_rdo.eq.TODOS,vinculos.cs.{INFRA},vinculos.cs.{TODOS}")
        .order("nome");
      return data || [];
    },
  });

  const update = (id: string, field: string, value: string) =>
    onChange(entries.map(e => (e.id === id ? { ...e, [field]: value } : e)));

  const handleOcrExtracted = (id: string, data: Record<string, string>, photoUrl: string) => {
    onChange(
      entries.map(e => {
        if (e.id !== id) return e;
        return {
          ...e,
          nf: data.nf || e.nf,
          quantidade_m3: data.quantidade || e.quantidade_m3,
          fornecedor: data.fornecedor || e.fornecedor,
          foto_url: photoUrl || e.foto_url,
        };
      })
    );
  };

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Landmark className="w-5 h-5" style={{ color: "hsl(215 100% 50%)" }} />
        Nota Fiscal de Concreto
      </h2>

      {entries.map((entry, idx) => (
        <div key={entry.id} className="rdo-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-display font-bold text-primary">NF {idx + 1}</span>
            {entries.length > 1 && (
              <button
                onClick={() => onChange(entries.filter(e => e.id !== entry.id))}
                className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <NfPhotoCapture
            tipo="CANTEIRO"
            onExtracted={(data, photoUrl) => handleOcrExtracted(entry.id, data, photoUrl)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Nº NF</span>
              <Input
                inputMode="numeric"
                placeholder="Número"
                value={entry.nf}
                onChange={e => update(entry.id, "nf", e.target.value)}
                className="h-11 bg-white border-border rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Quantidade (m³)</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={entry.quantidade_m3}
                onChange={e => update(entry.id, "quantidade_m3", e.target.value)}
                className="h-11 bg-white border-border rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Concreto</span>
              <Select value={entry.tipo_concreto} onValueChange={v => update(entry.id, "tipo_concreto", v)}>
                <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CONCRETO.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Fornecedor</span>
              <Select value={entry.fornecedor} onValueChange={v => update(entry.id, "fornecedor", v)}>
                <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores && fornecedores.length > 0
                    ? fornecedores.map(f => (
                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                      ))
                    : <p className="text-xs text-muted-foreground p-3 text-center">Nenhum fornecedor cadastrado</p>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {entry.foto_url && (
            <div className="mt-2">
              <img src={entry.foto_url} alt="Foto NF" className="w-full max-h-40 object-contain rounded-xl border border-border" />
            </div>
          )}
        </div>
      ))}

      <Button
        size="sm"
        onClick={() => onChange([...entries, emptyEntry()])}
        className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold"
      >
        <Plus className="w-5 h-5" /> Adicionar NF Concreto
      </Button>
    </div>
  );
}
