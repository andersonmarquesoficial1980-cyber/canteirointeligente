import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Upload, FileText, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const TIPOS_DOC = ["CRLV", "Licença Especial", "Nota Fiscal", "Seguro", "Tacógrafo", "AVCB", "Outro"];

interface Doc {
  id: string;
  equipment_fleet: string;
  equipment_type: string;
  tipo_documento: string;
  descricao: string;
  numero_documento: string;
  data_emissao: string;
  data_vencimento: string;
  arquivo_url: string;
  alerta_dias: number;
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function diasRestantes(d: string): number {
  if (!d) return 999;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

export default function ManutencaoDocumentos() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [form, setForm] = useState({ equipment_fleet: "", equipment_type: "", tipo_documento: "", descricao: "", numero_documento: "", data_emissao: "", data_vencimento: "", alerta_dias: "30" });

  useEffect(() => { buscarDocs(); }, []);

  async function buscarDocs() {
    setLoading(true);
    const { data } = await supabase.from("manutencao_documentos").select("*").order("data_vencimento", { ascending: true });
    if (data) setDocs(data);
    setLoading(false);
  }

  async function salvar() {
    if (!form.equipment_fleet || !form.tipo_documento) return;
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let arquivo_url = null;

      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const path = `${form.equipment_fleet}/${Date.now()}_${form.tipo_documento}.${ext}`;
        await supabase.storage.from("manutencao-docs").upload(path, arquivo, { upsert: true });
        const { data: urlData } = supabase.storage.from("manutencao-docs").getPublicUrl(path);
        arquivo_url = urlData.publicUrl;
      }

      await supabase.from("manutencao_documentos").insert({
        equipment_fleet: form.equipment_fleet,
        equipment_type: form.equipment_type || null,
        tipo_documento: form.tipo_documento,
        descricao: form.descricao || null,
        numero_documento: form.numero_documento || null,
        data_emissao: form.data_emissao || null,
        data_vencimento: form.data_vencimento || null,
        arquivo_url,
        alerta_dias: parseInt(form.alerta_dias) || 30,
        created_by: user?.id,
      });

      setModal(false);
      setArquivo(null);
      setForm({ equipment_fleet: "", equipment_type: "", tipo_documento: "", descricao: "", numero_documento: "", data_emissao: "", data_vencimento: "", alerta_dias: "30" });
      buscarDocs();
    } catch (e: any) { console.error(e); }
    finally { setSalvando(false); }
  }

  const f = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/manutencao")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Documentos de Veículos</span>
          <span className="block text-[11px] text-primary-foreground/80">CRLV, Licenças, NFs</span>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setModal(true)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : docs.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum documento cadastrado</p>
          </div>
        ) : (
          docs.map(doc => {
            const dias = diasRestantes(doc.data_vencimento);
            const vencido = dias < 0;
            const alerta = dias >= 0 && dias <= doc.alerta_dias;
            return (
              <div key={doc.id} className={`rdo-card border-l-4 ${vencido ? "border-l-red-500" : alerta ? "border-l-orange-400" : "border-l-green-500"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {vencido ? <AlertTriangle className="w-4 h-4 text-red-500" /> : alerta ? <AlertTriangle className="w-4 h-4 text-orange-400" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                      <span className="font-display font-bold text-sm">{doc.tipo_documento}</span>
                      <span className="text-xs text-muted-foreground">— {doc.equipment_fleet}</span>
                    </div>
                    {doc.descricao && <p className="text-xs text-muted-foreground">{doc.descricao}</p>}
                    {doc.numero_documento && <p className="text-xs text-muted-foreground">Nº {doc.numero_documento}</p>}
                    <div className="flex gap-3 mt-1 text-xs">
                      {doc.data_vencimento && (
                        <span className={vencido ? "text-red-600 font-bold" : alerta ? "text-orange-600 font-semibold" : "text-muted-foreground"}>
                          Vence: {fmtDate(doc.data_vencimento)} {vencido ? "⛔ VENCIDO" : alerta ? `(${dias} dias)` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.arquivo_url && (
                    <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline flex-shrink-0">Ver PDF</a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Novo Documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Frota *</span><Input value={form.equipment_fleet} onChange={e => f("equipment_fleet", e.target.value)} placeholder="Ex: FA14" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><span className="rdo-label">Tipo Equip.</span><Input value={form.equipment_type} onChange={e => f("equipment_type", e.target.value)} placeholder="Ex: Fresadora" className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Documento *</span>
              <Select value={form.tipo_documento} onValueChange={v => f("tipo_documento", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TIPOS_DOC.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><span className="rdo-label">Descrição</span><Input value={form.descricao} onChange={e => f("descricao", e.target.value)} placeholder="Ex: Licença transporte especial" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><span className="rdo-label">Número do Documento</span><Input value={form.numero_documento} onChange={e => f("numero_documento", e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><span className="rdo-label">Emissão</span><Input type="date" value={form.data_emissao} onChange={e => f("data_emissao", e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><span className="rdo-label">Vencimento</span><Input type="date" value={form.data_vencimento} onChange={e => f("data_vencimento", e.target.value)} className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Alertar com quantos dias de antecedência?</span>
              <Select value={form.alerta_dias} onValueChange={v => f("alerta_dias", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Arquivo (PDF ou imagem)</span>
              <label className="flex items-center gap-3 h-11 px-3 border border-border rounded-xl bg-white cursor-pointer hover:bg-muted/50">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground truncate">{arquivo ? arquivo.name : "Clique para anexar"}</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <Button onClick={salvar} disabled={salvando || !form.equipment_fleet || !form.tipo_documento} className="w-full h-11 rounded-xl font-display font-bold gap-2">
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : "Salvar Documento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
