import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarios } from "@/hooks/useFuncionarios";

const TIPOS_DOCUMENTO = ["ASO", "OS", "NR11", "NR12", "NR18", "NR20", "NR35", "Ficha EPI", "CNH", "Outro"];

interface Props {
  open: boolean;
  onClose: () => void;
  integracaoId: string;
  onSaved: () => void;
}

export default function NovoDocumentoModal({ open, onClose, integracaoId, onSaved }: Props) {
  const { data: funcionarios } = useFuncionarios();
  const [funcionarioNome, setFuncionarioNome] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!funcionarioNome || !tipoDocumento) {
      setErro("Selecione o funcionário e o tipo de documento.");
      return;
    }
    setErro("");
    setSalvando(true);

    try {
      let arquivo_url: string | null = null;

      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const path = `${integracaoId}/${Date.now()}_${funcionarioNome.replace(/\s/g, "_")}_${tipoDocumento}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("ci-documentos")
          .upload(path, arquivo, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("ci-documentos").getPublicUrl(path);
        arquivo_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("ci_documentos").insert({
        integracao_id: integracaoId,
        funcionario_nome: funcionarioNome,
        tipo_documento: tipoDocumento,
        arquivo_url,
        status: "pendente",
      });

      if (error) throw error;

      setFuncionarioNome("");
      setTipoDocumento("");
      setArquivo(null);
      onSaved();
      onClose();
    } catch (e: any) {
      setErro("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Adicionar Documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="rdo-label">Funcionário *</span>
            <Select value={funcionarioNome} onValueChange={setFuncionarioNome}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {(funcionarios ?? []).map(f => (
                  <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Tipo de Documento *</span>
            <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="rdo-label">Arquivo (foto ou PDF)</span>
            <label className="flex items-center gap-3 h-11 px-3 border border-border rounded-xl bg-white cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {arquivo ? arquivo.name : "Clique para anexar"}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <Button onClick={salvar} disabled={salvando || !funcionarioNome || !tipoDocumento} className="w-full h-11 rounded-xl font-display font-bold gap-2">
            {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar Documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
