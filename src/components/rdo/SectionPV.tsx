import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Plus, Trash2, HardHat, Wrench, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";

export interface PVData {
  cliente: string;
  contrato: string;
  rua: string;
  bairro: string;
  cidade: string;
  modo_execucao: "mecanizado" | "manual";
  equipamento_bobcat: string;
  acoplamento_fc: string;
  compressor: string;
  martelete: string;
  qtd_pvs: string;
  materiais: PVMaterialEntry[];
  fotos_antes: string[];
  fotos_durante: string[];
  fotos_depois: string[];
  observacoes: string;
}

export interface PVMaterialEntry {
  id: string;
  material: string;
  quantidade: string;
  unidade: string;
}

interface SectionPVProps {
  data: PVData;
  onChange: (data: PVData) => void;
}

const CLIENTES_PV = ["PMSP", "SABESP", "COPASA"];
const BOBCATS_PV = ["BC76", "BC80"];
const FC_OPTIONS = ["FC001", "FC002", "FC003", "FC004", "FC005"];
const MATERIAIS_PV = ["Massa Asfáltica (CBUQ)", "Concreto", "Argamassa", "Brita", "Areia", "Outro"];

export default function SectionPV({ data, onChange }: SectionPVProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [activePhotoType, setActivePhotoType] = useState<"antes" | "durante" | "depois">("antes");

  const update = (field: keyof PVData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const updateMaterial = (id: string, field: keyof PVMaterialEntry, value: string) => {
    const updated = data.materiais.map(m => m.id === id ? { ...m, [field]: value } : m);
    update("materiais", updated);
  };

  const addMaterial = () => {
    update("materiais", [...data.materiais, { id: crypto.randomUUID(), material: "", quantidade: "", unidade: "Ton" }]);
  };

  const removeMaterial = (id: string) => {
    if (data.materiais.length <= 1) return;
    update("materiais", data.materiais.filter(m => m.id !== id));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(activePhotoType);
    try {
      const compressed = await compressImage(file);
      const fileName = `pv/${Date.now()}_${activePhotoType}_${file.name}`;
      const { error } = await supabase.storage.from("notas_fiscais").upload(fileName, compressed);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(fileName);
      const key = `fotos_${activePhotoType}` as keyof PVData;
      update(key, [...(data[key] as string[]), urlData.publicUrl]);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploadingPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (type: "antes" | "durante" | "depois", index: number) => {
    const key = `fotos_${type}` as keyof PVData;
    const arr = [...(data[key] as string[])];
    arr.splice(index, 1);
    update(key, arr);
  };

  const triggerPhotoUpload = (type: "antes" | "durante" | "depois") => {
    setActivePhotoType(type);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  return (
    <div className="px-4 space-y-4">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />

      {/* Identificação da Obra */}
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <HardHat className="w-5 h-5 text-primary" />
          Identificação da Obra (PV)
        </h2>

        <div className="space-y-1.5">
          <span className="rdo-label">Cliente *</span>
          <Select value={data.cliente} onValueChange={v => update("cliente", v)}>
            <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {CLIENTES_PV.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="rdo-label">OGS / Contrato</span>
            <Input value={data.contrato} onChange={e => update("contrato", e.target.value)} placeholder="Nº Contrato" className="h-12 text-base bg-white border-border rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <span className="rdo-label">Cidade</span>
            <Input value={data.cidade} onChange={e => update("cidade", e.target.value)} placeholder="Ex: Belo Horizonte" className="h-12 text-base bg-white border-border rounded-xl" />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="rdo-label">Rua</span>
          <Input value={data.rua} onChange={e => update("rua", e.target.value)} placeholder="Nome da rua" className="h-12 text-base bg-white border-border rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <span className="rdo-label">Bairro</span>
          <Input value={data.bairro} onChange={e => update("bairro", e.target.value)} placeholder="Bairro" className="h-12 text-base bg-white border-border rounded-xl" />
        </div>
      </div>

      {/* Modo de Execução */}
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <Wrench className="w-5 h-5 text-primary" />
          Modo de Execução
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => update("modo_execucao", "mecanizado")}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              data.modo_execucao === "mecanizado"
                ? "bg-primary text-primary-foreground border-primary shadow-card"
                : "bg-white text-foreground border-border hover:border-primary/40"
            }`}
          >
            <span className="text-2xl block mb-1">⚙️</span>
            <span className="text-sm font-display font-bold">Mecanizado</span>
          </button>
          <button
            type="button"
            onClick={() => update("modo_execucao", "manual")}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              data.modo_execucao === "manual"
                ? "bg-primary text-primary-foreground border-primary shadow-card"
                : "bg-white text-foreground border-border hover:border-primary/40"
            }`}
          >
            <span className="text-2xl block mb-1">🔨</span>
            <span className="text-sm font-display font-bold">Manual</span>
          </button>
        </div>

        {data.modo_execucao === "mecanizado" && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <span className="rdo-label">Bobcat</span>
              <Select value={data.equipamento_bobcat} onValueChange={v => update("equipamento_bobcat", v)}>
                <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
                  <SelectValue placeholder="Selecione a Bobcat" />
                </SelectTrigger>
                <SelectContent>
                  {BOBCATS_PV.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Acoplamento - Fresadora Cônica *</span>
              <Select value={data.acoplamento_fc} onValueChange={v => update("acoplamento_fc", v)}>
                <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
                  <SelectValue placeholder="Selecione FC" />
                </SelectTrigger>
                <SelectContent>
                  {FC_OPTIONS.map(fc => <SelectItem key={fc} value={fc}>{fc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {data.modo_execucao === "manual" && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground italic">
              💡 Compressor e Martelete devem ser lançados na seção geral de Equipamentos do RDO.
            </p>
          </div>
        )}
      </div>

      {/* Produção */}
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <HardHat className="w-5 h-5 text-primary" />
          Produção
        </h2>
        <div className="space-y-1.5">
          <span className="rdo-label">Quantidade de PVs Executados *</span>
          <Input
            type="number"
            inputMode="numeric"
            value={data.qtd_pvs}
            onChange={e => update("qtd_pvs", e.target.value)}
            placeholder="0"
            className="h-14 text-2xl font-bold text-center bg-white border-border rounded-xl"
          />
        </div>
      </div>

      {/* Materiais */}
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <Wrench className="w-5 h-5 text-primary" />
          Consumo de Materiais
        </h2>
        {data.materiais.map((mat, idx) => (
          <div key={mat.id} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1.5">
              <span className="rdo-label">Material {idx + 1}</span>
              <Select value={mat.material} onValueChange={v => updateMaterial(mat.id, "material", v)}>
                <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAIS_PV.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1.5">
              <span className="rdo-label">Qtd</span>
              <Input inputMode="decimal" value={mat.quantidade} onChange={e => updateMaterial(mat.id, "quantidade", e.target.value)} className="h-12 text-base bg-white border-border rounded-xl" />
            </div>
            <div className="w-20 space-y-1.5">
              <span className="rdo-label">Un.</span>
              <Select value={mat.unidade} onValueChange={v => updateMaterial(mat.id, "unidade", v)}>
                <SelectTrigger className="h-12 text-sm bg-white border-border rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Ton", "m³", "Kg", "L", "Un"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {data.materiais.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeMaterial(mat.id)} className="h-12 w-10 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={addMaterial} className="w-full h-10 gap-2 rounded-xl border-dashed">
          <Plus className="w-4 h-4" /> Adicionar Material
        </Button>
      </div>

      {/* Registro Fotográfico */}
      <div className="rdo-card space-y-4">
        <h2 className="rdo-section-title">
          <ImageIcon className="w-5 h-5 text-primary" />
          Registro Fotográfico
        </h2>

        {(["antes", "durante", "depois"] as const).map(type => {
          const key = `fotos_${type}` as keyof PVData;
          const fotos = data[key] as string[];
          const labels = { antes: "📸 Antes", durante: "🔧 Durante", depois: "✅ Depois" };
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="rdo-label">{labels[type]}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerPhotoUpload(type)}
                  disabled={uploadingPhoto === type}
                  className="gap-1.5 rounded-lg text-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {uploadingPhoto === type ? "Enviando..." : "Foto"}
                </Button>
              </div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt={`${type} ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-border" />
                      <button
                        onClick={() => removePhoto(type, i)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Observações */}
      <div className="rdo-card space-y-2">
        <span className="rdo-label">Observações do PV</span>
        <Textarea
          value={data.observacoes}
          onChange={e => update("observacoes", e.target.value)}
          placeholder="Detalhes adicionais sobre a execução dos poços de visita..."
          className="min-h-[100px] bg-white border-border rounded-xl text-base resize-y"
        />
      </div>
    </div>
  );
}
