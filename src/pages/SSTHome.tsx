import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, ClipboardCheck, Calendar, User, CheckCircle, Clock, AlertTriangle, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

interface Inspecao {
  id: string;
  nome_obra: string;
  cliente: string;
  tecnico_responsavel: string;
  data_inspecao: string;
  status: string;
  created_at: string;
}

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = status === "concluido"
    ? { bg: "#dcfce7", color: "#16a34a", icon: <CheckCircle size={12} />, label: "Concluído" }
    : { bg: "#fef3c7", color: "#d97706", icon: <Clock size={12} />, label: "Rascunho" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cfg.bg, color: cfg.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function SSTHome() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const aba = searchParams.get("tab") === "integracao" ? "integracao" : "inspecoes";
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("sst_inspections")
      .select("id,nome_obra,cliente,tecnico_responsavel,data_inspecao,status,created_at")
      .eq("company_id", COMPANY_ID)
      .order("data_inspecao", { ascending: false })
      .limit(100)
      .then(({ data }) => { if (data) setInspecoes(data as any); setLoading(false); });
  }, []);

  const total = inspecoes.length;
  const concluidos = inspecoes.filter(i => i.status === "concluido").length;
  const rascunhos = total - concluidos;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">WF Segurança do Trabalho</span>
          <span className="block text-[10px] text-primary-foreground/70">{total} inspeções</span>
        </div>
        {aba === "inspecoes" && (
          <button onClick={() => navigate("/sst/nova")}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition rounded-lg px-3 py-1.5 text-xs font-bold">
            <Plus size={14} /> Nova
          </button>
        )}
      </header>

      {/* Abas */}
      <div style={{ background: "#0A0F2C", padding: "0 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 0 }}>
          {[
            { id: "inspecoes", label: "Inspeções SST", icon: ClipboardCheck },
            { id: "integracao", label: "Integração", icon: FolderOpen },
          ].map(tab => {
            const Icon = tab.icon;
            const ativo = aba === tab.id;
            return (
              <button key={tab.id}
                onClick={() => setSearchParams(tab.id === "inspecoes" ? {} : { tab: tab.id })}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 16px", border: "none", background: "transparent",
                  color: ativo ? "white" : "rgba(255,255,255,0.45)",
                  fontWeight: ativo ? 700 : 500, fontSize: 12, cursor: "pointer",
                  borderBottom: ativo ? "2px solid #00C6FF" : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo — só aparece na aba inspeções */}
      {aba === "inspecoes" && (
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, maxWidth: 760, margin: "0 auto" }}>
          {[
            { label: "Total", value: total, cor: "#00C6FF" },
            { label: "Concluídas", value: concluidos, cor: "#22c55e" },
            { label: "Rascunhos", value: rascunhos, cor: "#f97316" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Aba Integração */}
      {aba === "integracao" && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            {
              id: "documentos-funcionarios",
              icon: "📁",
              label: "Documentos dos Funcionários",
              subtitle: "Pasta global de documentos por funcionário (ASO, NR06, NR18, Ficha EPI...)",
              cor: "#0055AA",
              rota: "/sst/integracao/documentos-funcionarios",
            },
            {
              id: "analise-ia",
              icon: "🤖",
              label: "Análise de Documentos com IA",
              subtitle: "Validação automática dos documentos antes de enviar às concessionárias",
              cor: "#7C3AED",
              rota: "/sst/integracao/analise-ia",
            },
            {
              id: "obras",
              icon: "🏗️",
              label: "Integrações por Obra",
              subtitle: "GRU, MOTIVA, ECOVIAS, AUTOBAN — status de integração e credenciamento",
              cor: "#059669",
              rota: "/sst/integracao/obras",
            },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => navigate(s.rota)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "white", border: "1.5px solid #e2e8f0",
                borderLeft: `4px solid ${s.cor}`, borderRadius: 14,
                padding: "16px 18px", cursor: "pointer", textAlign: "left",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: s.cor + "18",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontSize: 22,
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", fontFamily: "Montserrat" }}>{s.label}</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.4 }}>{s.subtitle}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Aba Inspeções */}
      {aba === "inspecoes" && (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
        {/* Programações do dia */}
        <div className="mb-4"><ProgramacoesDoDia /></div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Carregando...</p>
        ) : inspecoes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 16px" }}>
            <ClipboardCheck size={48} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>Nenhuma inspeção registrada</p>
            <button onClick={() => navigate("/sst/nova")}
              style={{ marginTop: 16, background: "#0055AA", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Registrar primeira inspeção
            </button>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {inspecoes.map((ins, i) => (
              <div key={ins.id} onClick={() => navigate(`/sst/${ins.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < inspecoes.length - 1 ? "1px solid #f1f5f9" : "none", cursor: "pointer", background: i % 2 === 0 ? "white" : "#fafbfc" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "white" : "#fafbfc"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertTriangle size={18} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins.nome_obra}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3 }}>
                      <Calendar size={10} /> {fmtDate(ins.data_inspecao)}
                    </span>
                    {ins.tecnico_responsavel && (
                      <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3 }}>
                        <User size={10} /> {ins.tecnico_responsavel}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={ins.status} />
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
