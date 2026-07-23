/**
 * SST — Documentos dos Funcionários
 * Usa a mesma tabela employee_documentos da FichaFuncionario (GP)
 * Banco único, zero duplicação.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Plus, Upload, FileText, X, ChevronRight, CheckCircle, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogoHomeButton } from "@/components/LogoHomeButton";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// Tipos unificados — mesmos da FichaFuncionario + tipos SST de integração
const TIPOS_DOCUMENTO = [
  // Documentos pessoais (já existentes na ficha)
  "RG", "CPF", "CNH", "CTPS", "PIS/PASEP",
  "Comprovante de Residência", "Certidão de Nascimento", "Certidão de Casamento",
  "Foto",
  // ASOs
  "ASO - Admissional", "ASO - Periódico", "ASO - Demissional",
  // NRs de integração
  "NR06 — Ficha de EPI", "NR18 — Construção Civil",
  "NR35 — Trabalho em Altura", "NR10", "NR11", "NR12",
  // Cursos / certificados
  "COVE", "Habilitação Equipamento",
  "Certificado NR-10", "Certificado NR-35", "Certificado NR-11",
  "Certificado NR-12", "Comprovante Escolar",
  // Outros
  "Contrato de Trabalho", "Outro",
];

interface Employee {
  id: string;
  name: string;
  matricula: string | null;
  role: string | null;
  status: string | null;
  company_id: string | null;
}

// Mesmo shape da FichaFuncionario
interface Documento {
  id: string;
  tipo: string;
  descricao: string | null;
  arquivo_url: string | null;
  validade: string | null;
  status: string;
  created_at: string;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function isVencido(v: string | null) {
  if (!v) return false;
  return new Date(v) < new Date();
}

function isVencendoEm30(v: string | null) {
  if (!v) return false;
  const d30 = new Date();
  d30.setDate(d30.getDate() + 30);
  return new Date(v) <= d30 && new Date(v) >= new Date();
}

function statusLabel(status?: string | null) {
  const s = (status || "ativo").toLowerCase();
  if (s === "ferias") return "Férias";
  if (s === "afastado") return "Afastado";
  if (s === "demitido") return "Demitido";
  return "Ativo";
}

function statusChipStyle(status?: string | null) {
  const s = (status || "ativo").toLowerCase();
  if (s === "demitido") return { bg: "#fee2e2", text: "#b91c1c" };
  if (s === "afastado") return { bg: "#ffedd5", text: "#c2410c" };
  if (s === "ferias") return { bg: "#e0f2fe", text: "#0369a1" };
  return { bg: "#dcfce7", text: "#166534" };
}

export default function SSTFuncionariosDocs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busca, setBusca] = useState("");
  const [funcSelecionado, setFuncSelecionado] = useState<Employee | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [modalNovoDoc, setModalNovoDoc] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ tipo: "ASO - Periódico", descricao: "", validade: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [contagensPorFunc, setContagensPorFunc] = useState<Record<string, number>>({});
  const [vencidosPorFunc, setVencidosPorFunc] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoadingEmps(true);
    (supabase as any)
      .from("employees")
      .select("id,name,matricula,role,status,company_id")
      .eq("company_id", COMPANY_ID)
      .order("name")
      .then(({ data }: any) => {
        if (data) setEmployees(data);
        setLoadingEmps(false);
      });
  }, []);

  // Contagens de docs + vencidos por funcionário
  useEffect(() => {
    if (employees.length === 0) return;
    const ids = employees.map(e => e.id);
    (supabase as any)
      .from("employee_documentos")
      .select("employee_id, validade, status")
      .in("employee_id", ids)
      .eq("status", "ativo")
      .then(({ data }: any) => {
        const cont: Record<string, number> = {};
        const venc: Record<string, number> = {};
        (data ?? []).forEach((d: any) => {
          cont[d.employee_id] = (cont[d.employee_id] ?? 0) + 1;
          if (isVencido(d.validade)) {
            venc[d.employee_id] = (venc[d.employee_id] ?? 0) + 1;
          }
        });
        setContagensPorFunc(cont);
        setVencidosPorFunc(venc);
      });
  }, [employees]);

  useEffect(() => {
    if (!funcSelecionado) return;
    setLoadingDocs(true);
    (supabase as any)
      .from("employee_documentos")
      .select("*")
      .eq("employee_id", funcSelecionado.id)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        if (data) setDocumentos(data as Documento[]);
        setLoadingDocs(false);
      });
  }, [funcSelecionado]);

  async function salvarDocumento() {
    if (!funcSelecionado || !form.tipo) return;
    setSalvando(true);
    try {
      let arquivo_url: string | null = null;

      if (arquivo) {
        const ext = arquivo.name.split(".").pop();
        const path = `funcionarios/documentos/${funcSelecionado.id}/${Date.now()}-${arquivo.name}`;
        const { error: upErr } = await supabase.storage
          .from("sst-fotos")
          .upload(path, arquivo, { upsert: true });
        if (!upErr) {
          arquivo_url = supabase.storage.from("sst-fotos").getPublicUrl(path).data.publicUrl;
        }
      }

      const { error } = await (supabase as any).from("employee_documentos").insert({
        employee_id: funcSelecionado.id,
        company_id: COMPANY_ID,
        tipo: form.tipo,
        descricao: form.descricao.trim() || null,
        arquivo_url,
        validade: form.validade || null,
        status: "ativo",
      });

      if (error) {
        toast({ title: "Erro ao salvar documento", description: error.message, variant: "destructive" });
        setSalvando(false);
        return;
      }

      toast({ title: "Documento salvo!" });
      setModalNovoDoc(false);
      setForm({ tipo: "ASO - Periódico", descricao: "", validade: "" });
      setArquivo(null);

      // Recarregar
      const { data } = await (supabase as any)
        .from("employee_documentos")
        .select("*")
        .eq("employee_id", funcSelecionado.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false });
      if (data) setDocumentos(data as Documento[]);

      setContagensPorFunc(prev => ({
        ...prev,
        [funcSelecionado.id]: (prev[funcSelecionado.id] ?? 0) + 1,
      }));
    } catch (e: any) {
      toast({ title: "Erro inesperado", description: e?.message, variant: "destructive" });
    }
    setSalvando(false);
  }

  async function removerDocumento(doc: Documento) {
    if (!confirm(`Remover documento "${doc.tipo}"?`)) return;
    await (supabase as any).from("employee_documentos").delete().eq("id", doc.id);
    setDocumentos(prev => prev.filter(d => d.id !== doc.id));
    if (funcSelecionado) {
      setContagensPorFunc(prev => ({
        ...prev,
        [funcSelecionado.id]: Math.max(0, (prev[funcSelecionado.id] ?? 1) - 1),
      }));
    }
    toast({ title: "Documento removido" });
  }

  const empsFiltrados = employees.filter(e =>
    e.name.toLowerCase().includes(busca.toLowerCase()) ||
    (e.matricula ?? "").includes(busca)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button
          onClick={() => funcSelecionado ? setFuncSelecionado(null) : navigate("/sst/integracao")}
          className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">
            {funcSelecionado ? funcSelecionado.name : "Documentos dos Funcionários"}
          </span>
          <span className="block text-[10px] text-primary-foreground/70">
            {funcSelecionado
              ? `${funcSelecionado.role ?? ""} · Status: ${statusLabel(funcSelecionado.status)}`
              : "Base única — mesma da ficha do funcionário"}
          </span>
        </div>
        {funcSelecionado && (
          <div className="flex gap-2">
            {/* Ir para ficha completa */}
            <button
              onClick={() => navigate(`/gestao-pessoas/${funcSelecionado.id}`)}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition rounded-lg px-2.5 py-1.5 text-xs font-bold"
              title="Abrir ficha completa">
              <ExternalLink size={12} /> Ficha
            </button>
            <button
              onClick={() => setModalNovoDoc(true)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-xs font-bold">
              <Plus size={14} /> Adicionar
            </button>
          </div>
        )}
      </header>

      {/* Banner informativo — banco único */}
      {!funcSelecionado && (
        <div style={{ background: "#f0f9ff", borderBottom: "1px solid #bae6fd", padding: "10px 16px" }}>
          <p style={{ fontSize: 12, color: "#0369a1", maxWidth: 760, margin: "0 auto" }}>
            ℹ️ Os documentos aqui são os <strong>mesmos</strong> da aba Documentos na ficha do funcionário em Gestão de Pessoas — banco único, sem duplicação.
          </p>
        </div>
      )}

      {!funcSelecionado ? (
        /* ── LISTA DE FUNCIONÁRIOS ── */
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

          {loadingEmps ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
          ) : (
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              {empsFiltrados.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af" }}>
                  <p>Nenhum funcionário encontrado</p>
                </div>
              ) : empsFiltrados.map((emp, i) => {
                const totalDocs = contagensPorFunc[emp.id] ?? 0;
                const vencidos = vencidosPorFunc[emp.id] ?? 0;
                return (
                  <button key={emp.id}
                    onClick={() => setFuncSelecionado(emp)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", width: "100%", textAlign: "left",
                      borderBottom: i < empsFiltrados.length - 1 ? "1px solid #f1f5f9" : "none",
                      background: "transparent", cursor: "pointer",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: vencidos > 0
                        ? "linear-gradient(135deg,#ef4444,#dc2626)"
                        : "linear-gradient(135deg,#0055AA,#0077DD)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontSize: 15, fontWeight: 800,
                    }}>
                      {emp.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {emp.name}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        {emp.role ?? "—"} · Mat. {emp.matricula ?? "—"} · Status: {statusLabel(emp.status)}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {vencidos > 0 && (
                        <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                          ⚠ {vencidos} vencido{vencidos > 1 ? "s" : ""}
                        </span>
                      )}
                      {totalDocs > 0 && (
                        <span style={{ background: "#f0f7ff", color: "#0055AA", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                          {totalDocs} doc{totalDocs !== 1 ? "s" : ""}
                        </span>
                      )}
                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── DOCUMENTOS DO FUNCIONÁRIO ── */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          {/* Card do funcionário */}
          <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>Funcionário</p>
                <p style={{ color: "white", fontSize: 15, fontWeight: 800, marginTop: 2 }}>{funcSelecionado.name}</p>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1 }}>
                  {funcSelecionado.role ?? "—"} · Mat. {funcSelecionado.matricula ?? "—"} · Status: {statusLabel(funcSelecionado.status)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 800,
                    marginBottom: 4,
                    background: statusChipStyle(funcSelecionado.status).bg,
                    color: statusChipStyle(funcSelecionado.status).text,
                  }}
                >
                  {statusLabel(funcSelecionado.status)}
                </span>
                <p style={{ color: "#00C6FF", fontSize: 24, fontWeight: 900 }}>{documentos.length}</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>documentos</p>
              </div>
            </div>
            {/* Alertas */}
            {(() => {
              const venc = documentos.filter(d => isVencido(d.validade)).length;
              const vencBreve = documentos.filter(d => !isVencido(d.validade) && isVencendoEm30(d.validade)).length;
              return (venc > 0 || vencBreve > 0) ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {venc > 0 && (
                    <span style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      ⚠ {venc} vencido{venc > 1 ? "s" : ""}
                    </span>
                  )}
                  {vencBreve > 0 && (
                    <span style={{ background: "rgba(249,115,22,0.2)", color: "#fdba74", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      ⏰ {vencBreve} vencendo em 30 dias
                    </span>
                  )}
                </div>
              ) : null;
            })()}
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
                const vencendo = !vencido && isVencendoEm30(doc.validade);
                const corBorda = vencido ? "#ef4444" : vencendo ? "#f97316" : doc.arquivo_url ? "#22c55e" : "#cbd5e1";
                return (
                  <div key={doc.id} style={{
                    background: "white", borderRadius: 12, padding: "12px 14px",
                    borderLeft: `4px solid ${corBorda}`,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    {/* Ícone status */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: vencido ? "#fef2f2" : vencendo ? "#fff7ed" : doc.arquivo_url ? "#f0fdf4" : "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {vencido
                        ? <AlertTriangle size={16} color="#ef4444" />
                        : vencendo
                        ? <Clock size={16} color="#f97316" />
                        : doc.arquivo_url
                        ? <CheckCircle size={16} color="#22c55e" />
                        : <FileText size={16} color="#94a3b8" />
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{doc.tipo}</p>
                      {doc.descricao && (
                        <p style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{doc.descricao}</p>
                      )}
                      <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                        {doc.validade && (
                          <span style={{
                            fontSize: 11,
                            color: vencido ? "#ef4444" : vencendo ? "#f97316" : "#94a3b8",
                            fontWeight: vencido || vencendo ? 700 : 400,
                          }}>
                            {vencido ? "⚠ Venceu: " : vencendo ? "⏰ Vence: " : "Validade: "}
                            {fmtDate(doc.validade)}
                          </span>
                        )}
                        {!doc.arquivo_url && (
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Sem arquivo</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {doc.arquivo_url && (
                        <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"
                          style={{ background: "#f0f7ff", color: "#0055AA", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                          Ver
                        </a>
                      )}
                      <button onClick={() => removerDocumento(doc)}
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

      {/* ── MODAL: Novo Documento ── */}
      <Dialog open={modalNovoDoc} onOpenChange={v => { setModalNovoDoc(v); if (!v) { setForm({ tipo: "ASO - Periódico", descricao: "", validade: "" }); setArquivo(null); } }}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Adicionar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Documento *</span>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Descrição / Observação</span>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: CNH categoria B, vence 2027" className="h-11 rounded-xl" />
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
                  textAlign: "center", cursor: "pointer",
                  background: arquivo ? "#f0fdf4" : "#f8fafc",
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

            <Button onClick={salvarDocumento} disabled={salvando || !form.tipo}
              className="w-full h-11 rounded-xl font-display font-bold">
              {salvando ? "Salvando..." : "Salvar Documento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
