// Card de acesso rápido às Integrações por Obra (somente leitura)
// Exibido nos WFs: Engenharia, Encarregado, Programador, Gestão de Pessoas
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight } from "lucide-react";

export default function IntegracaoObrasCard() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/integracao-obras")}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", background: "white",
        border: "1.5px solid #e2e8f0",
        borderLeft: "4px solid #059669",
        borderRadius: 14, padding: "14px 16px",
        cursor: "pointer", textAlign: "left",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        marginTop: 12,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.1)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: "#f0fdf4",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Building2 size={20} color="#059669" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Integrações por Obra</p>
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          Ver quem está integrado por obra (GRU, MOTIVA, ECOVIAS...)
        </p>
      </div>
      <ChevronRight size={16} color="#94a3b8" />
    </button>
  );
}
