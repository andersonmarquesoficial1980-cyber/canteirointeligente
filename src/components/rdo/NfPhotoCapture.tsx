import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tipo: "CAUQ" | "CANTEIRO";
  onExtracted: (data: Record<string, string>, photoUrl: string) => void;
}

export default function NfPhotoCapture({ tipo, onExtracted }: Props) {
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
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year
      const photoUrl = urlData?.signedUrl || "";

      // 2. Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // 3. Call OCR edge function
      const { data, error } = await supabase.functions.invoke("ocr-nota-fiscal", {
        body: { image_base64: base64, tipo },
      });

      if (error) throw error;

      if (data?.extracted && Object.keys(data.extracted).length > 0) {
        toast({ title: "✅ Dados extraídos!", description: "Confira e corrija se necessário." });
        onExtracted(data.extracted, photoUrl);
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
