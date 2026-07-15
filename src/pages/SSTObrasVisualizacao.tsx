import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Users, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { LogoHomeButton } from "@/components/LogoHomeButton";

// Tela somente leitura — visível para Engenharia, Gestão de Pessoas, Programador e Encarregado
// WF Segurança do Trabalho é quem alimenta. Os outros só visualizam.

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  pendente:  { bg: "#fef3c7", color: "#d97706", label: "Pendente" },
  integrado: { bg: "#dcfce7", color: "#16a34a", label: "Integrado" },
  reprovado: { bg: "#fee2e2", color: "#dc2626", label: "Reprovado" },
  vencido:   { bg: "#fef3c7", color: "#f97316", label: "Vencido" },
};

const CRED_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  provisorio: { bg: "#dbeafe", color: "#2563eb", label: "Cred. Prov." },
  permanente: { bg: "#dcfce7", color: "#16a34a", label: "Cred. Perm." },
  reprovado:  { bg: "#fee2e2", color: "#dc2626", label: "Cred. Repr." },
};

interface Obra {
  id: string;
  nome_obra: string;
  concessionaria: string | null;
  local: string | null;
  status: string;
  tem_credenciamento: boolean;
  total?: number;
  integrados?: number;
  pendentes?: number;
}

interface FuncIntegracao {
  id: string;
  funcionario_id: string;
  status_integracao: string;
  data_integracao: string | null;
  data_vencimento: string | null;
  status_credenciamento: string | null;
  vencimento_credenciamento: string | null;
  documentos_pendentes: string[];
  funcionario?: { name: string; matricula: string; role: string };
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

export default function SSTObrasVisualizacao() {
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraSelecionada, setObraSelecionada] = useState<Obra | null>(null);
  const [funcIntegracoes, setFuncIntegracoes] = useState<FuncIntegracao[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [loadingFuncs, setLoadingFuncs] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => { buscarObras(); }, []);

  async function buscarObras() {
    setLoadingObras(true);
    const { data: obrasData } = await supabase
      .from("sst_obras_integracao")
      .select("id,nome_obra,concessionaria,local,status,tem_credenciamento")
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
    setBusca("");

    const { data: fi } = await supabase
      .from("sst_funcionarios_integracao")
      .select("id,funcionario_id,status_integracao,data_integracao,data_vencimento,status_credenciamento,vencimento_credenciamento,documentos_pendentes")
      .eq("obra_id", obra.id)
      .order("created_at", { ascending: false });

    if (fi && fi.length > 0) {
      const funcIds = fi.map(f => f.funcionario_id);
      const { data: funcs } = await supabase
        .from("employees")
        .select("id,name,matricula,role")
        .in("id", funcIds);
      const funcMap: Record<string, any> = {};
      (funcs ?? []).forEach(f => { funcMap[f.id] = f; });
      setFuncIntegracoes(fi.map(f => ({ ...f, funcionario: funcMap[f.funcionario_id] })) as FuncIntegracao[]);
    } else {
      setFuncIntegracoes([]);
    }
    setLoadingFuncs(false);
  }

  const funcsFiltrados = funcIntegracoes.filter(fi =>
    !busca ||
    fi.funcionario?.name?.toLowerCase().includes(busca.toLowerCase()) ||
    fi.funcionario?.matricula?.includes(busca)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => obraSelecionada ? setObraSelecionada(null) : navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">
            {obraSelecionada ? obraSelecionada.nome_obra : "Integrações por Obra"}
          </span>
          <span className="block text-[10px] text-primary-foreground/70">
            {obraSelecionada ? (obraSelecionada.concessionaria ?? "") : "Visualização — SST"}
          </span>
        </div>
        {/* Badge somente leitura */}
        <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
          👁 Visualização
        </span>
      </header>

      {!obraSelecionada ? (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          {/* Info banner */}
          <div style={{ background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <p style={{ fontSize: 12, color: "#1d4ed8", lineHeight: 1.5 }}>
              Esta tela é <strong>somente leitura</strong>. O WF Segurança do Trabalho gerencia e atualiza as integrações.
            </p>
          </div>

          {loadingObras ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
          ) : obras.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 16px" }}>
              <Building2 size={48} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Nenhuma obra de integração cadastrada</p>
              <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>O setor de SST ainda não criou nenhuma obra.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {obras.map(obra => {
                const statusCor = obra.status === "ativa" ? "#22c55e" : "#94a3b8";
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
                          {obra.total ?? 0} funcionários
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
        /* DETALHE — Lista funcionários somente leitura */
        <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
          {/* Resumo */}
          <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div>
                {obraSelecionada.local && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{obraSelecionada.local}</p>}
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

          {/* Busca */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar funcionário..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>

          {loadingFuncs ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
          ) : funcsFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Users size={40} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
              <p style={{ color: "#9ca3af", fontSize: 13 }}>Nenhum funcionário{busca ? " encontrado" : " nessa obra"}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {funcsFiltrados.map(fi => {
                const sc = STATUS_CONFIG[fi.status_integracao] ?? STATUS_CONFIG.pendente;
                const vencido = isVencido(fi.data_vencimento);
                return (
                  <div key={fi.id} style={{
                    background: "white", borderRadius: 12,
                    borderLeft: `4px solid ${sc.color}`,
                    padding: "12px 14px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
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
                            {CRED_CONFIG[fi.status_credenciamento].label}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        {fi.funcionario?.role} · Mat. {fi.funcionario?.matricula}
                      </p>
                      <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                        {fi.data_integracao && (
                          <span style={{ fontSize: 11, color: "#64748b" }}>Integrado: {fmtDate(fi.data_integracao)}</span>
                        )}
                        {fi.data_vencimento && (
                          <span style={{ fontSize: 11, color: vencido ? "#ef4444" : "#64748b", fontWeight: vencido ? 700 : 400 }}>
                            {vencido ? "⚠ Venceu: " : "Vence: "}{fmtDate(fi.data_vencimento)}
                          </span>
                        )}
                        {fi.vencimento_credenciamento && (
                          <span style={{ fontSize: 11, color: isVencido(fi.vencimento_credenciamento) ? "#ef4444" : "#64748b" }}>
                            Cred. vence: {fmtDate(fi.vencimento_credenciamento)}
                          </span>
                        )}
                      </div>
                      {fi.documentos_pendentes?.length > 0 && (
                        <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {fi.documentos_pendentes.map(dp => (
                            <span key={dp} style={{ background: "#fef3c7", color: "#d97706", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>
                              ⚠ {dp}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
