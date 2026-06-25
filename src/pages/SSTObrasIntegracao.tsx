import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Building2, Users, ChevronRight, Clock, X, Settings, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import logoCi from "@/assets/logo-workflux.png";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const CONCESSIONARIAS = ["CCR", "MOTIVA", "ECOVIAS", "AUTOBAN", "INVEPAR", "Aeroporto GRU", "Outra"];

const DOCS_PADRAO = [
  "ASO", "NR06 — Ficha de EPI", "NR18 — Construção Civil",
  "NR35 — Trabalho em Altura", "COVE", "CNH", "RG", "CPF",
  "Comprovante de Residência", "Foto 3×4", "Carteira de Vacinação",
  "Certificado de Treinamento",
];

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  pendente:    { bg: "#fef3c7", color: "#d97706", label: "Pendente" },
  integrado:   { bg: "#dcfce7", color: "#16a34a", label: "Integrado" },
  reprovado:   { bg: "#fee2e2", color: "#dc2626", label: "Reprovado" },
  vencido:     { bg: "#fef3c7", color: "#f97316", label: "Vencido" },
};

const CRED_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  provisorio:  { bg: "#dbeafe", color: "#2563eb", label: "Prov." },
  permanente:  { bg: "#dcfce7", color: "#16a34a", label: "Perm." },
  reprovado:   { bg: "#fee2e2", color: "#dc2626", label: "Reprov." },
};

interface OgsRef {
  id: string;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
}

interface Obra {
  id: string;
  nome_obra: string;
  concessionaria: string | null;
  local: string | null;
  data_inicio: string | null;
  status: string;
  documentos_exigidos: string[];
  validade_meses: number;
  tem_credenciamento: boolean;
  total?: number;
  integrados?: number;
  pendentes?: number;
}

interface Funcionario {
  id: string;
  name: string;
  matricula: string | null;
  role: string | null;
}

interface FuncIntegracao {
  id: string;
  funcionario_id: string;
  obra_id: string;
  status_integracao: string;
  data_integracao: string | null;
  data_vencimento: string | null;
  status_credenciamento: string | null;
  data_credenciamento: string | null;
  vencimento_credenciamento: string | null;
  documentos_pendentes: string[];
  observacoes: string | null;
  funcionario?: Funcionario;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function isVencido(d: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

export default function SSTObrasIntegracao() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraSelecionada, setObraSelecionada] = useState<Obra | null>(null);
  const [funcIntegracoes, setFuncIntegracoes] = useState<FuncIntegracao[]>([]);
  const [funcionariosDisponiveis, setFuncionariosDisponiveis] = useState<Funcionario[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [loadingFuncs, setLoadingFuncs] = useState(false);
  const [ogsList, setOgsList] = useState<OgsRef[]>([]);

  // Modal nova obra
  const [modalObra, setModalObra] = useState(false);
  const [salvandoObra, setSalvandoObra] = useState(false);
  const [ogsId, setOgsId] = useState("");
  const [formObra, setFormObra] = useState({
    nome_obra: "", concessionaria: "", local: "",
    data_inicio: "", validade_meses: "12",
    tem_credenciamento: false, documentos_exigidos: [] as string[],
  });

  // Modal adicionar funcionário
  const [modalFuncionario, setModalFuncionario] = useState(false);
  const [funcSelecionadoId, setFuncSelecionadoId] = useState("");
  const [salvandoFunc, setSalvandoFunc] = useState(false);
  const [formFunc, setFormFunc] = useState({
    status_integracao: "pendente",
    data_integracao: "",
    status_credenciamento: "",
    data_credenciamento: "",
    documentos_pendentes: [] as string[],
    observacoes: "",
  });

  // Modal editar status do funcionário
  const [modalEditarFunc, setModalEditarFunc] = useState(false);
  const [funcEditando, setFuncEditando] = useState<FuncIntegracao | null>(null);
  const [formEditar, setFormEditar] = useState({
    status_integracao: "",
    data_integracao: "",
    data_vencimento: "",
    status_credenciamento: "",
    data_credenciamento: "",
    vencimento_credenciamento: "",
    documentos_pendentes: [] as string[],
    observacoes: "",
  });

  useEffect(() => {
    buscarObras();
    // Carregar lista de OGS
    (supabase as any)
      .from("ogs_reference")
      .select("id, ogs_number, client_name, location_address")
      .order("ogs_number")
      .then(({ data }: any) => { if (data) setOgsList(data); });
  }, []);

  // Quando OGS é selecionada, preenche nome_obra, concessionaria e local automaticamente
  function onSelecionarOgs(id: string) {
    setOgsId(id);
    const ogs = ogsList.find(o => o.id === id);
    if (!ogs) return;
    setFormObra(f => ({
      ...f,
      nome_obra: `OGS ${ogs.ogs_number ?? ""}${ogs.client_name ? ` — ${ogs.client_name}` : ""}`,
      concessionaria: ogs.client_name ?? f.concessionaria,
      local: ogs.location_address ?? f.local,
    }));
  }

  async function buscarObras() {
    setLoadingObras(true);
    const { data: obrasData } = await supabase
      .from("sst_obras_integracao")
      .select("*")
      .order("created_at", { ascending: false });

    if (obrasData) {
      const ids = obrasData.map(o => o.id);
      const { data: funcs } = await supabase
        .from("sst_funcionarios_integracao")
        .select("obra_id, status_integracao")
        .in("obra_id", ids);

      const cont: Record<string, any> = {};
      (funcs ?? []).forEach(f => {
        if (!cont[f.obra_id]) cont[f.obra_id] = { total: 0, integrados: 0, pendentes: 0 };
        cont[f.obra_id].total++;
        if (f.status_integracao === "integrado") cont[f.obra_id].integrados++;
        if (f.status_integracao === "pendente") cont[f.obra_id].pendentes++;
      });

      setObras(obrasData.map(o => ({ ...o, ...cont[o.id] })));
    }
    setLoadingObras(false);
  }

  async function abrirObra(obra: Obra) {
    setObraSelecionada(obra);
    setLoadingFuncs(true);

    const { data: fi } = await supabase
      .from("sst_funcionarios_integracao")
      .select("*")
      .eq("obra_id", obra.id)
      .order("created_at", { ascending: false });

    if (fi && fi.length > 0) {
      const funcIds = fi.map(f => f.funcionario_id);
      const { data: funcs } = await supabase
        .from("employees")
        .select("id,name,matricula,role")
        .in("id", funcIds);

      const funcMap: Record<string, Funcionario> = {};
      (funcs ?? []).forEach(f => { funcMap[f.id] = f; });

      setFuncIntegracoes(fi.map(f => ({ ...f, funcionario: funcMap[f.funcionario_id] })) as FuncIntegracao[]);
    } else {
      setFuncIntegracoes([]);
    }

    // Funcionários disponíveis (não cadastrados ainda nessa obra)
    const cadastrados = (fi ?? []).map(f => f.funcionario_id);
    const { data: todosFunc } = await supabase
      .from("employees")
      .select("id,name,matricula,role")
      .eq("company_id", COMPANY_ID)
      .order("name");

    setFuncionariosDisponiveis((todosFunc ?? []).filter(f => !cadastrados.includes(f.id)));
    setLoadingFuncs(false);
  }

  async function salvarObra() {
    if (!formObra.nome_obra) {
      toast({ title: "Informe o nome da obra", variant: "destructive" });
      return;
    }
    setSalvandoObra(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sst_obras_integracao").insert({
        company_id: COMPANY_ID,
        nome_obra: formObra.nome_obra,
        concessionaria: formObra.concessionaria || null,
        local: formObra.local || null,
        data_inicio: formObra.data_inicio || null,
        validade_meses: parseInt(formObra.validade_meses) || 12,
        tem_credenciamento: formObra.tem_credenciamento,
        documentos_exigidos: formObra.documentos_exigidos,
        created_by: user?.id,
      });
      if (error) {
        toast({ title: "Erro ao criar obra", description: error.message, variant: "destructive" });
        setSalvandoObra(false);
        return;
      }
      toast({ title: "Obra criada com sucesso!" });
      setModalObra(false);
      setOgsId("");
      setFormObra({ nome_obra: "", concessionaria: "", local: "", data_inicio: "", validade_meses: "12", tem_credenciamento: false, documentos_exigidos: [] });
      buscarObras();
    } catch (e: any) {
      toast({ title: "Erro inesperado", description: e?.message, variant: "destructive" });
    }
    setSalvandoObra(false);
  }

  async function salvarFuncionario() {
    if (!obraSelecionada || !funcSelecionadoId) return;
    setSalvandoFunc(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let data_vencimento: string | null = null;
      if (formFunc.data_integracao && obraSelecionada.validade_meses) {
        const d = new Date(formFunc.data_integracao);
        d.setMonth(d.getMonth() + obraSelecionada.validade_meses);
        data_vencimento = d.toISOString().split("T")[0];
      }

      const { error } = await supabase.from("sst_funcionarios_integracao").insert({
        company_id: COMPANY_ID,
        obra_id: obraSelecionada.id,
        funcionario_id: funcSelecionadoId,
        status_integracao: formFunc.status_integracao,
        data_integracao: formFunc.data_integracao || null,
        data_vencimento,
        status_credenciamento: formFunc.status_credenciamento || null,
        data_credenciamento: formFunc.data_credenciamento || null,
        documentos_pendentes: formFunc.documentos_pendentes,
        observacoes: formFunc.observacoes || null,
        created_by: user?.id,
      });

      if (error) {
        toast({ title: "Erro ao adicionar funcionário", description: error.message, variant: "destructive" });
        setSalvandoFunc(false);
        return;
      }

      toast({ title: "Funcionário adicionado!" });
      setModalFuncionario(false);
      setFuncSelecionadoId("");
      setFormFunc({ status_integracao: "pendente", data_integracao: "", status_credenciamento: "", data_credenciamento: "", documentos_pendentes: [], observacoes: "" });
      abrirObra(obraSelecionada);
    } catch (e: any) {
      toast({ title: "Erro inesperado", description: e?.message, variant: "destructive" });
    }
    setSalvandoFunc(false);
  }

  async function salvarEdicaoFunc() {
    if (!funcEditando) return;
    const { error } = await supabase.from("sst_funcionarios_integracao").update({
      status_integracao: formEditar.status_integracao,
      data_integracao: formEditar.data_integracao || null,
      data_vencimento: formEditar.data_vencimento || null,
      status_credenciamento: formEditar.status_credenciamento || null,
      data_credenciamento: formEditar.data_credenciamento || null,
      vencimento_credenciamento: formEditar.vencimento_credenciamento || null,
      documentos_pendentes: formEditar.documentos_pendentes,
      observacoes: formEditar.observacoes || null,
    }).eq("id", funcEditando.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo!" });
    setModalEditarFunc(false);
    if (obraSelecionada) abrirObra(obraSelecionada);
  }

  function abrirEdicaoFunc(fi: FuncIntegracao) {
    setFuncEditando(fi);
    setFormEditar({
      status_integracao: fi.status_integracao,
      data_integracao: fi.data_integracao ?? "",
      data_vencimento: fi.data_vencimento ?? "",
      status_credenciamento: fi.status_credenciamento ?? "",
      data_credenciamento: fi.data_credenciamento ?? "",
      vencimento_credenciamento: fi.vencimento_credenciamento ?? "",
      documentos_pendentes: fi.documentos_pendentes ?? [],
      observacoes: fi.observacoes ?? "",
    });
    setModalEditarFunc(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button
          onClick={() => obraSelecionada ? setObraSelecionada(null) : navigate("/sst/integracao")}
          className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">
            {obraSelecionada ? obraSelecionada.nome_obra : "Integrações por Obra"}
          </span>
          <span className="block text-[10px] text-primary-foreground/70">
            {obraSelecionada ? (obraSelecionada.concessionaria ?? "Sem concessionária") : "CCR, MOTIVA, ECOVIAS, AUTOBAN..."}
          </span>
        </div>
        {!obraSelecionada ? (
          <button onClick={() => setModalObra(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-xs font-bold">
            <Plus size={14} /> Nova Obra
          </button>
        ) : (
          <button onClick={() => setModalFuncionario(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-xs font-bold">
            <Plus size={14} /> Funcionário
          </button>
        )}
      </header>

      {!obraSelecionada ? (
        /* LISTA DE OBRAS */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          {loadingObras ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
          ) : obras.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 16px" }}>
              <Building2 size={48} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Nenhuma obra cadastrada</p>
              <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>Crie uma obra para gerenciar integrações</p>
              <button onClick={() => setModalObra(true)}
                style={{ marginTop: 16, background: "#0055AA", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Criar Primeira Obra
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {obras.map(obra => {
                const statusCor = obra.status === "ativa" ? "#22c55e" : obra.status === "suspensa" ? "#f97316" : "#94a3b8";
                return (
                  <button key={obra.id} onClick={() => abrirObra(obra)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "white", border: "1.5px solid #e2e8f0",
                      borderLeft: `4px solid ${statusCor}`, borderRadius: 14,
                      padding: "14px 16px", cursor: "pointer", textAlign: "left",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f0f7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Building2 size={20} color="#0055AA" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{obra.nome_obra}</p>
                        {obra.concessionaria && (
                          <span style={{ background: "#f0f7ff", color: "#0055AA", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                            {obra.concessionaria}
                          </span>
                        )}
                        {obra.tem_credenciamento && (
                          <span style={{ background: "#f5f3ff", color: "#7c3aed", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                            + Credenciamento
                          </span>
                        )}
                      </div>
                      {obra.local && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{obra.local}</p>}
                      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          <Users size={11} style={{ display: "inline", marginRight: 3 }} />
                          {obra.total ?? 0} func.
                        </span>
                        {(obra.integrados ?? 0) > 0 && (
                          <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>✓ {obra.integrados} integrados</span>
                        )}
                        {(obra.pendentes ?? 0) > 0 && (
                          <span style={{ fontSize: 11, color: "#f97316", fontWeight: 600 }}>⚠ {obra.pendentes} pendentes</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* DETALHE DA OBRA — Lista de funcionários */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          {/* Resumo da obra */}
          <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                {obraSelecionada.local && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{obraSelecionada.local}</p>}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ background: "rgba(255,255,255,0.12)", color: "white", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                    Validade: {obraSelecionada.validade_meses} meses
                  </span>
                  {obraSelecionada.documentos_exigidos?.length > 0 && (
                    <span style={{ background: "rgba(255,255,255,0.12)", color: "white", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {obraSelecionada.documentos_exigidos.length} docs exigidos
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { label: "Total", value: funcIntegracoes.length, cor: "#00C6FF" },
                  { label: "Integrados", value: funcIntegracoes.filter(f => f.status_integracao === "integrado").length, cor: "#22c55e" },
                  { label: "Pendentes", value: funcIntegracoes.filter(f => f.status_integracao === "pendente").length, cor: "#f97316" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                    <p style={{ fontSize: 18, fontWeight: 900, color: s.cor }}>{s.value}</p>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de funcionários na obra */}
          {loadingFuncs ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
          ) : funcIntegracoes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px" }}>
              <Users size={48} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Nenhum funcionário nessa obra ainda</p>
              <button onClick={() => setModalFuncionario(true)}
                style={{ marginTop: 16, background: "#0055AA", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Adicionar Primeiro Funcionário
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {funcIntegracoes.map(fi => {
                const sc = STATUS_CONFIG[fi.status_integracao] ?? STATUS_CONFIG.pendente;
                const vencido = isVencido(fi.data_vencimento);
                return (
                  <div key={fi.id} style={{
                    background: "white", borderRadius: 12,
                    borderLeft: `4px solid ${sc.color}`,
                    padding: "12px 14px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: "linear-gradient(135deg,#0055AA,#0077DD)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", fontSize: 14, fontWeight: 800
                      }}>
                        {fi.funcionario?.name?.charAt(0) ?? "?"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fi.funcionario?.name ?? "—"}</p>
                          <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                            {sc.label}
                          </span>
                          {fi.status_credenciamento && CRED_CONFIG[fi.status_credenciamento] && (
                            <span style={{ background: CRED_CONFIG[fi.status_credenciamento].bg, color: CRED_CONFIG[fi.status_credenciamento].color, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                              Cred. {CRED_CONFIG[fi.status_credenciamento].label}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{fi.funcionario?.role} · Mat. {fi.funcionario?.matricula}</p>
                        <div style={{ display: "flex", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                          {fi.data_integracao && (
                            <span style={{ fontSize: 11, color: "#64748b" }}>Integrado: {fmtDate(fi.data_integracao)}</span>
                          )}
                          {fi.data_vencimento && (
                            <span style={{ fontSize: 11, color: vencido ? "#ef4444" : "#64748b", fontWeight: vencido ? 700 : 400 }}>
                              {vencido ? "⚠ Venceu: " : "Vence: "}{fmtDate(fi.data_vencimento)}
                            </span>
                          )}
                        </div>
                        {fi.documentos_pendentes?.length > 0 && (
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {fi.documentos_pendentes.map(dp => (
                              <span key={dp} style={{ background: "#fef3c7", color: "#d97706", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>
                                ⚠ {dp}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => abrirEdicaoFunc(fi)}
                        style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", flexShrink: 0 }}>
                        <Settings size={13} color="#64748b" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: Nova Obra ─── */}
      <Dialog open={modalObra} onOpenChange={(v) => { setModalObra(v); if (!v) { setOgsId(""); setFormObra({ nome_obra: "", concessionaria: "", local: "", data_inicio: "", validade_meses: "12", tem_credenciamento: false, documentos_exigidos: [] }); } }}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Nova Obra / Integração</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">

            {/* OGS — campo principal, auto-preenche os outros */}
            <div className="space-y-1.5">
              <span className="rdo-label">OGS (Ordem de Serviço)</span>
              <Select value={ogsId} onValueChange={onSelecionarOgs}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione a OGS" />
                </SelectTrigger>
                <SelectContent>
                  {ogsList.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      OGS {o.ogs_number ?? "—"}{o.client_name ? ` — ${o.client_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ogsId && (
                <p style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                  ✓ Nome, cliente e local preenchidos automaticamente
                </p>
              )}
            </div>

            {/* Nome da obra — preenchido automaticamente pela OGS, mas editável */}
            <div className="space-y-1.5">
              <span className="rdo-label">Nome da Obra *</span>
              <Input value={formObra.nome_obra} onChange={e => setFormObra(f => ({ ...f, nome_obra: e.target.value }))}
                placeholder="Ex: Aeroporto GRU — Rempe" className="h-11 rounded-xl" />
            </div>

            {/* Concessionária — preenchida pela OGS (client_name), editável */}
            <div className="space-y-1.5">
              <span className="rdo-label">Concessionária / Cliente</span>
              <Select value={formObra.concessionaria} onValueChange={v => setFormObra(f => ({ ...f, concessionaria: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CONCESSIONARIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Local — preenchido pela OGS (location_address), editável */}
            <div className="space-y-1.5">
              <span className="rdo-label">Local / Endereço</span>
              <Input value={formObra.local} onChange={e => setFormObra(f => ({ ...f, local: e.target.value }))}
                placeholder="Rodovia, bairro, cidade..." className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data de Início</span>
              <Input type="date" value={formObra.data_inicio} onChange={e => setFormObra(f => ({ ...f, data_inicio: e.target.value }))} className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Validade da Integração (meses)</span>
              <Input type="number" min="1" max="60" value={formObra.validade_meses}
                onChange={e => setFormObra(f => ({ ...f, validade_meses: e.target.value }))} className="h-11 rounded-xl" />
            </div>

            <div className="flex items-center gap-3 py-1">
              <input type="checkbox" id="tem_cred" checked={formObra.tem_credenciamento}
                onChange={e => setFormObra(f => ({ ...f, tem_credenciamento: e.target.checked }))}
                className="w-4 h-4" />
              <label htmlFor="tem_cred" className="text-sm font-medium cursor-pointer">
                Esta obra exige credenciamento
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Documentos exigidos (selecione os obrigatórios)</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DOCS_PADRAO.map(d => (
                  <button key={d} type="button"
                    onClick={() => setFormObra(f => ({
                      ...f,
                      documentos_exigidos: f.documentos_exigidos.includes(d)
                        ? f.documentos_exigidos.filter(x => x !== d)
                        : [...f.documentos_exigidos, d]
                    }))}
                    style={{
                      border: "1.5px solid",
                      borderColor: formObra.documentos_exigidos.includes(d) ? "#0055AA" : "#e2e8f0",
                      background: formObra.documentos_exigidos.includes(d) ? "#f0f7ff" : "white",
                      color: formObra.documentos_exigidos.includes(d) ? "#0055AA" : "#64748b",
                      borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer"
                    }}>
                    {formObra.documentos_exigidos.includes(d) ? "✓ " : ""}{d}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={salvarObra} disabled={salvandoObra || !formObra.nome_obra}
              className="w-full h-11 rounded-xl font-display font-bold">
              {salvandoObra ? "Criando..." : "Criar Obra"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Adicionar Funcionário ─── */}
      <Dialog open={modalFuncionario} onOpenChange={setModalFuncionario}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Adicionar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Funcionário *</span>
              <Select value={funcSelecionadoId} onValueChange={setFuncSelecionadoId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                <SelectContent>
                  {funcionariosDisponiveis.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Nenhum funcionário disponível</SelectItem>
                  ) : funcionariosDisponiveis.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}{f.matricula ? ` — ${f.matricula}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Status da Integração</span>
              <Select value={formFunc.status_integracao} onValueChange={v => setFormFunc(f => ({ ...f, status_integracao: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="integrado">Integrado</SelectItem>
                  <SelectItem value="reprovado">Reprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Data da Integração</span>
              <Input type="date" value={formFunc.data_integracao} onChange={e => setFormFunc(f => ({ ...f, data_integracao: e.target.value }))} className="h-11 rounded-xl" />
            </div>
            {obraSelecionada?.tem_credenciamento && (
              <>
                <div className="space-y-1.5">
                  <span className="rdo-label">Status Credenciamento</span>
                  <Select value={formFunc.status_credenciamento} onValueChange={v => setFormFunc(f => ({ ...f, status_credenciamento: v }))}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="provisorio">Provisório</SelectItem>
                      <SelectItem value="permanente">Permanente</SelectItem>
                      <SelectItem value="reprovado">Reprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Data do Credenciamento</span>
                  <Input type="date" value={formFunc.data_credenciamento} onChange={e => setFormFunc(f => ({ ...f, data_credenciamento: e.target.value }))} className="h-11 rounded-xl" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <span className="rdo-label">Documentos Pendentes</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(obraSelecionada?.documentos_exigidos?.length ? obraSelecionada.documentos_exigidos : DOCS_PADRAO.slice(0, 6)).map(d => (
                  <button key={d} type="button"
                    onClick={() => setFormFunc(f => ({
                      ...f,
                      documentos_pendentes: f.documentos_pendentes.includes(d)
                        ? f.documentos_pendentes.filter(x => x !== d)
                        : [...f.documentos_pendentes, d]
                    }))}
                    style={{
                      border: "1.5px solid",
                      borderColor: formFunc.documentos_pendentes.includes(d) ? "#f97316" : "#e2e8f0",
                      background: formFunc.documentos_pendentes.includes(d) ? "#fff7ed" : "white",
                      color: formFunc.documentos_pendentes.includes(d) ? "#f97316" : "#64748b",
                      borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer"
                    }}>
                    {formFunc.documentos_pendentes.includes(d) ? "⚠ " : ""}{d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Observações</span>
              <Input value={formFunc.observacoes} onChange={e => setFormFunc(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Opcional" className="h-11 rounded-xl" />
            </div>
            <Button onClick={salvarFuncionario} disabled={salvandoFunc || !funcSelecionadoId || funcSelecionadoId === "__empty__"}
              className="w-full h-11 rounded-xl font-display font-bold">
              {salvandoFunc ? "Adicionando..." : "Adicionar Funcionário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Editar Status do Funcionário ─── */}
      <Dialog open={modalEditarFunc} onOpenChange={setModalEditarFunc}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">
              Editar — {funcEditando?.funcionario?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Status da Integração</span>
              <Select value={formEditar.status_integracao} onValueChange={v => setFormEditar(f => ({ ...f, status_integracao: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="integrado">Integrado</SelectItem>
                  <SelectItem value="reprovado">Reprovado</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <span className="rdo-label">Data Integração</span>
                <Input type="date" value={formEditar.data_integracao} onChange={e => setFormEditar(f => ({ ...f, data_integracao: e.target.value }))} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Data Vencimento</span>
                <Input type="date" value={formEditar.data_vencimento} onChange={e => setFormEditar(f => ({ ...f, data_vencimento: e.target.value }))} className="h-10 rounded-xl" />
              </div>
            </div>
            {obraSelecionada?.tem_credenciamento && (
              <>
                <div className="space-y-1.5">
                  <span className="rdo-label">Status Credenciamento</span>
                  <Select value={formEditar.status_credenciamento} onValueChange={v => setFormEditar(f => ({ ...f, status_credenciamento: v }))}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Sem credenciamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="provisorio">Provisório</SelectItem>
                      <SelectItem value="permanente">Permanente</SelectItem>
                      <SelectItem value="reprovado">Reprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Data Cred.</span>
                    <Input type="date" value={formEditar.data_credenciamento} onChange={e => setFormEditar(f => ({ ...f, data_credenciamento: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Venc. Cred.</span>
                    <Input type="date" value={formEditar.vencimento_credenciamento} onChange={e => setFormEditar(f => ({ ...f, vencimento_credenciamento: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <span className="rdo-label">Documentos Pendentes</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(obraSelecionada?.documentos_exigidos?.length ? obraSelecionada.documentos_exigidos : DOCS_PADRAO.slice(0, 6)).map(d => (
                  <button key={d} type="button"
                    onClick={() => setFormEditar(f => ({
                      ...f,
                      documentos_pendentes: f.documentos_pendentes.includes(d)
                        ? f.documentos_pendentes.filter(x => x !== d)
                        : [...f.documentos_pendentes, d]
                    }))}
                    style={{
                      border: "1.5px solid",
                      borderColor: formEditar.documentos_pendentes.includes(d) ? "#f97316" : "#e2e8f0",
                      background: formEditar.documentos_pendentes.includes(d) ? "#fff7ed" : "white",
                      color: formEditar.documentos_pendentes.includes(d) ? "#f97316" : "#64748b",
                      borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer"
                    }}>
                    {formEditar.documentos_pendentes.includes(d) ? "⚠ " : ""}{d}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Observações</span>
              <Input value={formEditar.observacoes} onChange={e => setFormEditar(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Opcional" className="h-11 rounded-xl" />
            </div>
            <Button onClick={salvarEdicaoFunc} className="w-full h-11 rounded-xl font-display font-bold">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
