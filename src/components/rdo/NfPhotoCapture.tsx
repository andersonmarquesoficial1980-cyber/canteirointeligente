import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tipo: "CAUQ" | "CANTEIRO";
  onExtracted: (data: Record<string, string>, photoUrl: string) => void;
  /** Lists for fuzzy matching on the AI side */
  usinasOptions?: string[];
  materiaisOptions?: string[];
  fornecedoresOptions?: string[];
}

/** Normalize string for comparison: lowercase, remove accents, trim */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Fuzzy match: find best option from list that contains or is contained in the value */
export function fuzzyMatch(value: string, options: string[]): string | null {
  if (!value || !options.length) return null;
  const nVal = normalize(value);

  // 1. Exact match (case-insensitive)
  const exact = options.find(o => normalize(o) === nVal);
  if (exact) return exact;

  // 2. One contains the other
  const contains = options.find(o => {
    const nOpt = normalize(o);
    return nVal.includes(nOpt) || nOpt.includes(nVal);
  });
  if (contains) return contains;

  // 3. Word overlap scoring
  const valWords = nVal.split(/\s+/);
  let bestScore = 0;
  let bestMatch: string | null = null;
  for (const opt of options) {
    const optWords = normalize(opt).split(/\s+/);
    const overlap = valWords.filter(w => optWords.some(ow => ow.includes(w) || w.includes(ow))).length;
    const score = overlap / Math.max(valWords.length, optWords.length);
    if (score > bestScore && score >= 0.3) {
      bestScore = score;
      bestMatch = opt;
    }
  }

  return bestMatch;
}

export default function NfPhotoCapture({ tipo, onExtracted, usinasOptions, materiaisOptions, fornecedoresOptions }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // 1. Upload to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("notas_fiscais")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("notas_fiscais")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);
      const photoUrl = urlData?.signedUrl || "";

      // 2. Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // 3. Call OCR edge function with reference lists
      const { data, error } = await supabase.functions.invoke("ocr-nota-fiscal", {
        body: {
          image_base64: base64,
          tipo,
          usinas_list: usinasOptions || [],
          materiais_list: materiaisOptions || [],
          fornecedores_list: fornecedoresOptions || [],
        },
      });

      if (error) throw error;

      if (data?.extracted && Object.keys(data.extracted).length > 0) {
        console.log("[OCR] Raw extracted:", data.extracted);

        // Client-side fuzzy match as fallback
        const extracted = { ...data.extracted };
        if (tipo === "CAUQ") {
          if (extracted.usina && usinasOptions?.length) {
            const matched = fuzzyMatch(extracted.usina, usinasOptions);
            if (matched) extracted.usina = matched;
          }
          if (extracted.tipo_material && materiaisOptions?.length) {
            const matched = fuzzyMatch(extracted.tipo_material, materiaisOptions);
            if (matched) extracted.tipo_material = matched;
          }
        } else {
          if (extracted.fornecedor && fornecedoresOptions?.length) {
            const matched = fuzzyMatch(extracted.fornecedor, fornecedoresOptions);
            if (matched) extracted.fornecedor = matched;
          }
        }

        console.log("[OCR] After fuzzy match:", extracted);
        toast({ title: "✅ Dados extraídos!", description: "Confira e corrija se necessário." });
        onExtracted(extracted, photoUrl);
      } else {
        toast({ title: "⚠️ Nenhum dado encontrado", description: "Preencha manualmente.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      toast({ title: "Erro na leitura", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full h-12 gap-2 text-base font-semibold bg-gradient-to-r from-primary to-primary/80"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Lendo dados da nota...
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" /> 📷 Tirar Foto da Nota
          </>
        )}
      </Button>
    </div>
  );
}
