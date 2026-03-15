import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/imageCompression";

type ChecklistStatus = "ok" | "nao_ok" | "na";

export interface ChecklistResult {
  itemId: string;
  itemName: string;
  status: ChecklistStatus;
  observation: string;
  photoFile: File | null;
  photoPreview: string | null;
}

interface Props {
  equipmentType?: string;
  results: ChecklistResult[];
  onChange: (results: ChecklistResult[]) => void;
}

export default function ChecklistSection({ equipmentType = "Fresadora", results, onChange }: Props) {
  const { data: items = [] } = useQuery({
    queryKey: ["checklist_items_standard", equipmentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items_standard")
        .select("*")
        .eq("equipment_type", equipmentType)
        .order("item_name");
      if (error) throw error;
      return data as { id: string; item_name: string }[];
    },
  });

  const getResult = (item: { id: string; item_name: string }): ChecklistResult => {
    return results.find((r) => r.itemId === item.id) || {
      itemId: item.id,
      itemName: item.item_name,
      status: "ok" as ChecklistStatus,
      observation: "",
      photoFile: null,
      photoPreview: null,
    };
  };

  const updateResult = (itemId: string, itemName: string, patch: Partial<ChecklistResult>) => {
    const existing = results.find((r) => r.itemId === itemId);
    if (existing) {
      onChange(results.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)));
    } else {
      onChange([...results, { itemId, itemName, status: "ok", observation: "", photoFile: null, photoPreview: null, ...patch }]);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
        Itens de verificação
      </h3>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nenhum item de checklist cadastrado para {equipmentType}.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const result = getResult(item);
          return (
            <ChecklistItem
              key={item.id}
              item={item}
              result={result}
              onUpdate={(patch) => updateResult(item.id, item.item_name, patch)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChecklistItem({
  item,
  result,
  onUpdate,
}: {
  item: { id: string; item_name: string };
  result: ChecklistResult;
  onUpdate: (patch: Partial<ChecklistResult>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 1);
    const preview = URL.createObjectURL(compressed);
    onUpdate({ photoFile: compressed, photoPreview: preview });
  };

  const statusButtons: { value: ChecklistStatus; label: string; color: string; activeColor: string }[] = [
    { value: "ok", label: "C", color: "border-border text-muted-foreground bg-card", activeColor: "bg-emerald-500 text-white border-emerald-500 shadow-sm" },
    { value: "nao_ok", label: "NC", color: "border-border text-muted-foreground bg-card", activeColor: "bg-rose-500 text-white border-rose-500 shadow-sm" },
    { value: "na", label: "NA", color: "border-border text-muted-foreground bg-card", activeColor: "bg-slate-400 text-white border-slate-400 shadow-sm" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground flex-1">{item.item_name}</span>
        <div className="flex gap-1.5">
          {statusButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => onUpdate({ status: btn.value })}
              className={`w-10 h-9 rounded-lg text-xs font-bold border transition-all duration-150 ${
                result.status === btn.value ? btn.activeColor : btn.color
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {result.status === "nao_ok" && (
        <div className="space-y-2 pl-2 border-l-2 border-rose-400 ml-1">
          <div className="flex items-center gap-1.5 text-rose-500 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            NÃO CONFORME — Detalhe a avaria
          </div>
          <Textarea
            value={result.observation}
            onChange={(e) => onUpdate({ observation: e.target.value })}
            placeholder="Descreva a não conformidade..."
            className="bg-secondary border-border min-h-[60px] text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs border-primary text-primary hover:bg-primary/5"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="w-3.5 h-3.5 mr-1" />
              📷 Tirar foto da avaria
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
          </div>
          {result.photoPreview && (
            <img
              src={result.photoPreview}
              alt="Foto da avaria"
              className="w-20 h-20 object-cover rounded-lg border border-border shadow-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}
