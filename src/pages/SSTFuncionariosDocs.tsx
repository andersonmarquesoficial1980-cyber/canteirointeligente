import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Plus, Upload, FileText, X, ChevronRight, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logoCi from "@/assets/logo-workflux.png";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const TIPOS_DOCUMENTO = [
  "ASO", "NR06 — Ficha de EPI", "NR18 — Construção Civil",
  "NR35 — Trabalho em Altura", "COVE", "CNH", "RG", "CPF",
  "Comprovante de Residência", "Foto 3×4", "Carteira de Vacinação",
  "Certificado de Treinamento", "Outro",
];

interface Funcionario {
  id: string;
  name: string;
  matricula: string;
  role: string;
}

interface DocFuncionario {
  id: string;
  funcionario_id: string;
  tipo_documento: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  validade: string | null;
  observacao: string | null;
  created_at: string;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function isVencido(validade: string | null) {
  if (!validade) return false;
  return new Date(validade) < new Date();
}

function isVencendoEm30Dias(validade: string | null) {
  if (!validade) return false;
  const dias30 = new Date();
  dias30.setDate(dias30.getDate() + 30);
  return new Date(validade) <= dias30 && new Date(validade) >= new Date();
}

export default function SSTFuncionariosDocs() {
  const navigate = useNavigate();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState("");
  const [funcSelecionado, setFuncSelecionado] = useState<Funcionario | null>(null);
  const [documentos, setDocumentos] = useState<DocFuncionario[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [modalNovoDoc, setModalNovoDoc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ tipo_documento: "", validade: "", observacao: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [contagensPorFunc, setContagensPorFunc] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("employees")
      .select("id,name,matricula,role")
      .eq("company_id", COMPANY_ID)
      .order("nome")
      .then(({ data }) => {
        if (data) setFuncionarios(data);
      });
  }, []);

  // Contagens de docs por funcionário
  useEffect(() => {
    if (funcionarios.length === 0) return;
    const ids = funcionarios.map(f => f.id);
    supabase
      .from("sst_funcionario_documentos")
      .select("funcionario_id")
      .in("funcionario_id", ids)
      .then(({ data }) => {
        const cont: Record<string, number> = {};
        (data ?? []).forEach(d => {
          cont[d.funcionario_id] = (cont[d.funcionario_id] ?? 0) + 1;
        });
        setContagensPorFunc(cont);
      });
  }, [funcionarios]);

  useEffect(() => {
    if (!funcSelecionado) return;
    setLoadingDocs(true);
    supabase
      .from("sst_funcionario_documentos")
      .select("*")
      .eq("funcionario_id", funcSelecionado.id)
      .order("tipo_documento")
      .then(({ data }) => {
        if (data) setDocumentos(data as DocFuncionario[]);
        setLoadingDocs(false);
      });
  }, [funcSelecionado]);

  async function salvarDocumento() {
    if (!funcSelecionado || !form.tipo_documento) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;

      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const path = `sst-docs/${funcSelecionado.id}/${Date.now()}_${form.tipo_documento.replace(/\s/g, "_")}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, arquivo, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("documentos").getPublicUrl(path);
          arquivo_url = urlData.publicUrl;
          arquivo_nome = arquivo.name;
        }
      }

      await supabase.from("sst_funcionario_documentos").insert({
        company_id: COMPANY_ID,
        funcionario_id: funcSelecionado.id,
        tipo_documento: form.tipo_documento,
        arquivo_url,
        arquivo_nome,
        validade: form.validade || null,
        observacao: form.observacao || null,
        created_by: user?.id,
      });

      setModalNovoDoc(false);
      setForm({ tipo_documento: "", validade: "", observacao: "" });
      setArquivo(null);

      // Recarregar
      const { data } = await supabase
        .from("sst_funcionario_documentos")
        .select("*")
        .eq("funcionario_id", funcSelecionado.id)
        .order("tipo_documento");
      if (data) setDocumentos(data as DocFuncionario[]);

      // Atualizar contagem
      setContagensPorFunc(prev => ({
        ...prev,
        [funcSelecionado.id]: (prev[funcSelecionado.id] ?? 0) + 1,
      }));
    } catch {}
    setUploading(false);
  }

  async function excluirDocumento(doc: DocFuncionario) {
    if (!confirm(`Excluir documento "${doc.tipo_documento}"?`)) return;
    await supabase.from("sst_funcionario_documentos").delete().eq("id", doc.id);
    setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    if (funcSelecionado) {
      setContagensPorFunc(prev => ({
        ...prev,
        [funcSelecionado.id]: Math.max(0, (prev[funcSelecionado.id] ?? 1) - 1),
      }));
    }
  }

  const funcsFiltrados = funcionarios.filter(f =>
    f.name.toLowerCase().includes(busca.toLowerCase()) ||
    f.matricula.includes(busca)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => funcSelecionado ? setFuncSelecionado(null) : navigate("/sst/integracao")}
          className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">
            {funcSelecionado ? funcSelecionado.name : "Documentos dos Funcionários"}
          </span>
          <span className="block text-[10px] text-primary-foreground/70">
            {funcSelecionado ? funcSelecionado.role : "Pasta global de documentos"}
          </span>
        </div>
        {funcSelecionado && (
          <button onClick={() => setModalNovoDoc(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-xs font-bold">
            <Plus size={14} /> Adicionar
          </button>
        )}
      </header>

      {!funcSelecionado ? (
        /* Lista de funcionários */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou matrícula..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-11 rounded-xl"
            />
          </div>
          <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {funcsFiltrados.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af" }}>
                <p>Nenhum funcionário encontrado</p>
              </div>
            ) : funcsFiltrados.map((f, i) => (
              <button key={f.id}
                onClick={() => setFuncSelecionado(f)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", width: "100%", textAlign: "left",
                  borderBottom: i < funcsFiltrados.length - 1 ? "1px solid #f1f5f9" : "none",
                  background: "transparent", cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg,#0055AA,#0077DD)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  color: "white", fontSize: 15, fontWeight: 800
                }}>
                  {f.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{f.role} · Mat. {f.matricula}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {(contagensPorFunc[f.id] ?? 0) > 0 && (
                    <span style={{ background: "#f0f7ff", color: "#0055AA", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                      {contagensPorFunc[f.id]} doc{contagensPorFunc[f.id] !== 1 ? "s" : ""}
                    </span>
                  )}
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Documentos do funcionário selecionado */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          {/* Card de dados do funcionário */}
          <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: 0.8 }}>FUNCIONÁRIO</p>
              <p style={{ color: "white", fontSize: 15, fontWeight: 800, marginTop: 2 }}>{funcSelecionado.name}</p>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 }}>{funcSelecionado.role} · Mat. {funcSelecionado.matricula}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ color: "#00C6FF", fontSize: 24, fontWeight: 900 }}>{documentos.length}</p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>documentos</p>
            </div>
          </div>

          {loadingDocs ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
          ) : documentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <FileText size={48} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Nenhum documento cadastrado</p>
              <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>Adicione os documentos necessários para integração</p>
              <button onClick={() => setModalNovoDoc(true)}
                style={{ marginTop: 16, background: "#0055AA", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Adicionar Documento
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {documentos.map(doc => {
                const vencido = isVencido(doc.validade);
                const vencendo = !vencido && isVencendoEm30Dias(doc.validade);
                const cor = vencido ? "#ef4444" : vencendo ? "#f97316" : "#22c55e";
                const bgCor = vencido ? "#fef2f2" : vencendo ? "#fff7ed" : "#f0fdf4";
                return (
                  <div key={doc.id} style={{
                    background: "white", borderRadius: 12, padding: "12px 14px",
                    borderLeft: `4px solid ${doc.arquivo_url ? cor : "#cbd5e1"}`,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: doc.arquivo_url ? bgCor : "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      {doc.arquivo_url
                        ? (vencido ? <AlertTriangle size={16} color={cor} /> : <CheckCircle size={16} color={cor} />)
                        : <Clock size={16} color="#94a3b8" />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{doc.tipo_documento}</p>
                      <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                        {doc.arquivo_nome && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>📎 {doc.arquivo_nome}</span>
                        )}
                        {doc.validade && (
                          <span style={{ fontSize: 11, color: vencido ? "#ef4444" : vencendo ? "#f97316" : "#94a3b8", fontWeight: vencido || vencendo ? 700 : 400 }}>
                            {vencido ? "⚠ Vencido: " : "Validade: "}{fmtDate(doc.validade)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {doc.arquivo_url && (
                        <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"
                          style={{ background: "#f0f7ff", color: "#0055AA", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                          Ver
                        </a>
                      )}
                      <button onClick={() => excluirDocumento(doc)}
                        style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo Documento */}
      <Dialog open={modalNovoDoc} onOpenChange={setModalNovoDoc}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Adicionar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Documento *</span>
              <Select value={form.tipo_documento} onValueChange={v => setForm(f => ({ ...f, tipo_documento: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Data de Validade</span>
              <Input type="date" value={form.validade} onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Arquivo (PDF ou imagem)</span>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed #cbd5e1", borderRadius: 12, padding: "16px",
                  textAlign: "center", cursor: "pointer", background: arquivo ? "#f0fdf4" : "#f8fafc"
                }}
              >
                <Upload size={20} color={arquivo ? "#22c55e" : "#94a3b8"} style={{ margin: "0 auto 6px" }} />
                <p style={{ fontSize: 12, color: arquivo ? "#22c55e" : "#94a3b8", fontWeight: 600 }}>
                  {arquivo ? arquivo.name : "Clique para selecionar o arquivo"}
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
                onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Observação</span>
              <Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Opcional" className="h-11 rounded-xl" />
            </div>
            <Button onClick={salvarDocumento}
              disabled={uploading || !form.tipo_documento}
              className="w-full h-11 rounded-xl font-display font-bold">
              {uploading ? "Salvando..." : "Salvar Documento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
