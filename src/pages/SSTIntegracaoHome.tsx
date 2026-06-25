import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderOpen, Brain, Building2 } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";

const SECOES = [
  {
    id: "documentos-funcionarios",
    icon: FolderOpen,
    label: "Documentos dos Funcionários",
    subtitle: "Pasta global de documentos por funcionário (ASO, NR06, NR18, Ficha EPI...)",
    cor: "#0055AA",
    rota: "/sst/integracao/documentos-funcionarios",
  },
  {
    id: "analise-ia",
    icon: Brain,
    label: "Análise de Documentos com IA",
    subtitle: "Validação automática dos documentos antes de enviar às concessionárias",
    cor: "#7C3AED",
    rota: "/sst/integracao/analise-ia",
  },
  {
    id: "obras",
    icon: Building2,
    label: "Integrações por Obra",
    subtitle: "GRU, MOTIVA, ECOVIAS, AUTOBAN — status de integração e credenciamento",
    cor: "#059669",
    rota: "/sst/integracao/obras",
  },
];

export default function SSTIntegracaoHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/sst")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Integração — SST</span>
          <span className="block text-[10px] text-primary-foreground/70">Gestão de integrações com concessionárias</span>
        </div>
      </header>

      {/* Banner */}
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "20px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            WF Segurança do Trabalho
          </p>
          <h2 style={{ color: "white", fontSize: 18, fontWeight: 900, fontFamily: "Montserrat", marginTop: 4 }}>
            Central de Integrações
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Gerencie documentos dos funcionários, análise por IA e integrações por obra (CCR, MOTIVA, ECOVIAS, AUTOBAN...)
          </p>
        </div>
      </div>

      {/* Seções */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {SECOES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.rota)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "white",
                border: "1.5px solid #e2e8f0",
                borderLeft: `4px solid ${s.cor}`,
                borderRadius: 14,
                padding: "16px 18px",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                transition: "box-shadow 0.15s, transform 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: s.cor + "18",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Icon size={22} color={s.cor} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", fontFamily: "Montserrat" }}>{s.label}</p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.4 }}>{s.subtitle}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
