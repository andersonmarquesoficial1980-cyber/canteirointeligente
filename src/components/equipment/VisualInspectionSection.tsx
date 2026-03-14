import { useState, useRef } from "react";
import { Camera, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compressImage } from "@/lib/imageCompression";
import fresadoraDiagram from "@/assets/fresadora-diagram.png";

const DAMAGE_TYPES = ["Arranhão", "Amassado", "Quebrado"] as const;

export interface DamageMarker {
  id: string;
  xPercent: number;
  yPercent: number;
  damageType: string;
  photoFile: File | null;
  photoPreview: string | null;
}

interface Props {
  markers: DamageMarker[];
  onChange: (markers: DamageMarker[]) => void;
}

export function createEmptyMarker(x: number, y: number): DamageMarker {
  return {
    id: crypto.randomUUID(),
    xPercent: x,
    yPercent: y,
    damageType: "",
    photoFile: null,
    photoPreview: null,
  };
}

export default function VisualInspectionSection({ markers, onChange }: Props) {
  const imgRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeMarker, setActiveMarker] = useState<DamageMarker | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const marker = createEmptyMarker(x, y);
    setActiveMarker(marker);
    setDialogOpen(true);
  };

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const touch = e.touches[0];
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    const marker = createEmptyMarker(x, y);
    setActiveMarker(marker);
    setDialogOpen(true);
    e.preventDefault();
  };

  const handleSaveMarker = () => {
    if (!activeMarker || !activeMarker.damageType) return;
    const exists = markers.find((m) => m.id === activeMarker.id);
    if (exists) {
      onChange(markers.map((m) => (m.id === activeMarker.id ? activeMarker : m)));
    } else {
      onChange([...markers, activeMarker]);
    }
    setActiveMarker(null);
    setDialogOpen(false);
  };

  const handleRemoveMarker = (id: string) => {
    onChange(markers.filter((m) => m.id !== id));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeMarker) return;
    const compressed = await compressImage(file, 1);
    const preview = URL.createObjectURL(compressed);
    setActiveMarker({ ...activeMarker, photoFile: compressed, photoPreview: preview });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2">
        INSPEÇÃO VISUAL (360°)
      </h3>

      <p className="text-xs text-muted-foreground">
        Toque no diagrama para marcar avarias encontradas no equipamento.
      </p>

      {/* Diagram with markers */}
      <div
        ref={imgRef}
        className="relative border-2 border-primary rounded-lg overflow-hidden cursor-crosshair select-none"
        onClick={handleImageClick}
        onTouchStart={handleTouch}
      >
        <img
          src={fresadoraDiagram}
          alt="Diagrama da fresadora — toque para marcar avarias"
          className="w-full h-auto pointer-events-none"
          draggable={false}
        />

        {/* Rendered markers */}
        {markers.map((m) => (
          <div
            key={m.id}
            className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center"
            style={{ left: `${m.xPercent}%`, top: `${m.yPercent}%` }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMarker(m);
              setDialogOpen(true);
            }}
          >
            <div className="w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
              <MapPin className="w-3 h-3 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Markers summary */}
      {markers.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-accent uppercase">Avarias marcadas ({markers.length})</span>
          {markers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 bg-secondary/50 border border-border rounded p-2">
              <span className="text-xs text-foreground flex-1">
                #{i + 1} — {m.damageType}
              </span>
              {m.photoPreview && (
                <img src={m.photoPreview} alt="" className="w-8 h-8 rounded object-cover border border-border" />
              )}
              <button
                type="button"
                onClick={() => handleRemoveMarker(m.id)}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Damage detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm">Registrar Avaria</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-accent uppercase">Tipo de Avaria</label>
              <Select
                value={activeMarker?.damageType || ""}
                onValueChange={(v) => activeMarker && setActiveMarker({ ...activeMarker, damageType: v })}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-accent uppercase">Foto da avaria</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-accent text-accent"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                📷 Tirar foto
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhoto}
              />
              {activeMarker?.photoPreview && (
                <img
                  src={activeMarker.photoPreview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded border border-border"
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDialogOpen(false);
                  setActiveMarker(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-primary"
                disabled={!activeMarker?.damageType}
                onClick={handleSaveMarker}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
