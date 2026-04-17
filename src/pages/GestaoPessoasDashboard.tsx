import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Briefcase, Search, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface Funcionario {
  id: string;
  name: string;
  role: string;
  matricula: string;
}

// Normaliza função para agrupamento
function normFunc(role: string): string {
  const r = role?.toUpperCase().trim() || "";
  if (r.includes("ENCARREGADO")) return "ENCARREGADO";
  if (r.includes("APONTADOR")) return "APONTADOR";
  if (r.includes("AJUDANTE")) return "AJUDANTE GERAL";
  if (r.includes("MOTORISTA CARRETEIRO") || r.includes("CARRETEIRO")) return "MOTORISTA CARRETEIRO";
  if (r.includes("MOTORISTA ESPARGIDOR")) return "MOTORISTA ESPARGIDOR";
  if (r.includes("MOTORISTA")) return "MOTORISTA";
  if (r.includes("OPERADOR DE FRESADORA") || r.includes("OPERADOR DE FRESA") || r.includes("OP DE FRESA") || r.includes("FRESA")) return "OPERADOR DE FRESADORA";
  if (r.includes("OPERADOR BOBCAT") || r.includes("BOBCAT")) return "OPERADOR BOBCAT";
  if (r.includes("VIBROACABADORA") || r.includes("VIBRO")) return "OPERADOR VIBROACABADORA";
  if (r.includes("USINA") || r.includes("KMA")) return "OPERADOR USINA KMA";
  if (r.includes("RETROES") || r.includes("RETRO")) return "OPERADOR RETROESCAVADEIRA";
  if (r.includes("OPERADOR DE ROLO") || r.includes("ROLO")) return "OPERADOR DE ROLO";
  if (r.includes("OPERADOR SOLO") || r.includes("OP SOLO")) return "OPERADOR SOLO";
  if (r.includes("OPERADOR")) return "OPERADOR DE MÁQUINAS";
  if (r.includes("SINALEIRO")) return "SINALEIRO";
  if (r.includes("PEDREIRO")) return "PEDREIRO";
  if (r.includes("RASTELEIRO") || r.includes("RASTELE")) return "RASTELEIRO";
  if (r.includes("MARTELETEIRO")) return "MARTELETEIRO";
  if (r.includes("MANGUEIRISTA")) return "MANGUEIRISTA";
  if (r.includes("TEC") && r.includes("SEG")) return "TÉC. SEGURANÇA DO TRABALHO";
  if (r.includes("ASSISTENTE")) return "ASSISTENTE ADMINISTRATIVO";
  if (r.includes("MESISTA")) return "MESISTA";
  if (r.includes("JOVEM")) return "JOVEM APRENDIZ";
  return role?.trim() || "OUTROS";
}

const GRUPO_COR: Record<string, { cor: string; bg: string; emoji: string }> = {
  "ENCARREGADO":               { cor: "#0055AA", bg: "rgba(0,85,170,0.08)", emoji: "👷" },
  "APONTADOR":                 { cor: "#006640", bg: "rgba(0,102,64,0.08)",  emoji: "📋" },
  "AJUDANTE GERAL":            { cor: "#555555", bg: "rgba(85,85,85,0.08)",  emoji: "🔨" },
  "MOTORISTA":                 { cor: "#AA5500", bg: "rgba(170,85,0,0.08)",  emoji: "🚛" },
  "MOTORISTA CARRETEIRO":      { cor: "#AA3300", bg: "rgba(170,51,0,0.08)",  emoji: "🚚" },
  "MOTORISTA ESPARGIDOR":      { cor: "#885500", bg: "rgba(136,85,0,0.08)",  emoji: "🚒" },
  "OPERADOR DE FRESADORA":     { cor: "#CC4400", bg: "rgba(204,68,0,0.08)",  emoji: "⚙️" },
  "OPERADOR BOBCAT":           { cor: "#5500AA", bg: "rgba(85,0,170,0.08)",  emoji: "🚜" },
  "OPERADOR VIBROACABADORA":   { cor: "#006666", bg: "rgba(0,102,102,0.08)", emoji: "🏗️" },
  "OPERADOR USINA KMA":        { cor: "#AA0055", bg: "rgba(170,0,85,0.08)",  emoji: "🏭" },
  "OPERADOR RETROESCAVADEIRA": { cor: "#884400", bg: "rgba(136,68,0,0.08)",  emoji: "🔧" },
  "OPERADOR DE ROLO":          { cor: "#446600", bg: "rgba(68,102,0,0.08)",  emoji: "🛞" },
  "OPERADOR SOLO":             { cor: "#004488", bg: "rgba(0,68,136,0.08)",  emoji: "👤" },
  "OPERADOR DE MÁQUINAS":      { cor: "#664400", bg: "rgba(102,68,0,0.08)",  emoji: "⚒️" },
  "SINALEIRO":                 { cor: "#AA8800", bg: "rgba(170,136,0,0.08)", emoji: "🚦" },
  "PEDREIRO":                  { cor: "#666666", bg: "rgba(102,102,102,0.08)", emoji: "🧱" },
  "RASTELEIRO":                { cor: "#448800", bg: "rgba(68,136,0,0.08)",  emoji: "🌿" },
};

function getInfo(funcao: string) {
  return GRUPO_COR[funcao] || { cor: "#444444", bg: "rgba(68,68,68,0.08)", emoji: "👤" };
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR");
}

// ─── Tabela executiva de funcionários ─────────────────────────────────────────
function TabelaFuncionarios({ titulo, items, onVoltar }: {
  titulo: string; items: Funcionario[]; onVoltar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const filtrados = items.filter(f =>
    !busca || f.name.toLowerCase().includes(busca.toLowerCase()) ||
    (f.matricula || "").includes(busca)
  );

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", borderRadius: 20, padding: "24px 28px", marginBottom: 16, color: "white" }}>
        <button onClick={onVoltar} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 14px", color: "white", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{titulo}</h2>
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 20px" }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#00C6FF", fontFamily: "Montserrat" }}>{items.length}</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Funcionários</p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
        <input placeholder="Buscar nome ou matrícula..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ width: "100%", paddingLeft: 30, paddingRight: 12, height: 36, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{filtrados.length} funcionário{filtrados.length !== 1 ? "s" : ""}</p>

      {/* Tabela */}
      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 90px 1fr 1fr", background: "#f8fafc", borderBottom: "2px solid #e5e7eb", padding: "8px 16px", gap: 8 }}>
          {["Nº", "MATRÍCULA", "NOME", "FUNÇÃO"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
          ))}
        </div>
        {filtrados.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0", fontSize: 13 }}>Nenhum resultado.</p>
        ) : (
          filtrados.map((f, i) => (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: "40px 90px 1fr 1fr", padding: "10px 16px", gap: 8, borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
              <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontFamily: "Montserrat", fontWeight: 700, color: "#0A0F2C" }}>{f.matricula || "—"}</span>
              <span style={{ fontSize: 12, color: "#374151" }}>{f.name}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{f.role}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function GestaoPessoasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<"inicio" | "funcao">("inicio");
  const [funcaoSel, setFuncaoSel] = useState("");
  const [buscaGlobal, setBuscaGlobal] = useState("");

  useEffect(() => {
    supabase.from("employees").select("*").order("name")
      .then(({ data }) => { if (data) setTodos(data); setLoading(false); });
  }, []);

  // Agrupar por função normalizada
  const porFuncao: Record<string, Funcionario[]> = {};
  todos.forEach(f => {
    const g = normFunc(f.role);
    if (!porFuncao[g]) porFuncao[g] = [];
    porFuncao[g].push(f);
  });

  const funcoes = Object.keys(porFuncao).sort();
  const itensFuncao = funcaoSel ? (porFuncao[funcaoSel] || []) : [];

  const filtradosGlobal = buscaGlobal
    ? todos.filter(f => f.name.toLowerCase().includes(buscaGlobal.toLowerCase()) || (f.role || "").toLowerCase().includes(buscaGlobal.toLowerCase()) || (f.matricula || "").includes(buscaGlobal))
    : [];

  function voltar() {
    setModo("inicio"); setFuncaoSel("");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8" }}>
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={modo === "inicio" ? () => navigate("/") : voltar} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: "white" }}>WF Gestão de Pessoas</span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{todos.length} funcionários · {funcoes.length} funções</span>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>

        ) : modo === "funcao" ? (
          <TabelaFuncionarios titulo={funcaoSel} items={itensFuncao} onVoltar={voltar} />

        ) : (
          <div>
            {/* Painel resumo */}
            <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", borderRadius: 24, padding: "28px", color: "white", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 26, marginBottom: 4 }}>Gestão de Pessoas</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>Selecione uma função para a reunião de eficiência</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Total", value: todos.length, cor: "#00C6FF" },
                  { label: "Funções", value: funcoes.length, cor: "#FFB300" },
                  { label: "Com Matrícula", value: todos.filter(f => f.matricula).length, cor: "#22c55e" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 20px", flex: 1, textAlign: "center" }}>
                    <p style={{ fontSize: 28, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Busca global */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9ca3af" }} />
              <input placeholder="Buscar funcionário por nome, função ou matrícula..." value={buscaGlobal} onChange={e => setBuscaGlobal(e.target.value)}
                style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 44, borderRadius: 14, border: "2px solid #e5e7eb", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }} />
            </div>

            {/* Resultado da busca global */}
            {buscaGlobal && filtradosGlobal.length > 0 && (
              <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.07)", marginBottom: 20 }}>
                <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{filtradosGlobal.length} resultado{filtradosGlobal.length !== 1 ? "s" : ""}</span>
                </div>
                {filtradosGlobal.slice(0, 20).map((f, i) => (
                  <div key={f.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr", padding: "9px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 12, background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                    <span style={{ fontFamily: "Montserrat", fontWeight: 700, color: "#0A0F2C" }}>{f.matricula || "—"}</span>
                    <span style={{ color: "#374151" }}>{f.name}</span>
                    <span style={{ color: "#6b7280" }}>{f.role}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cards por função */}
            {!buscaGlobal && (
              <>
                <h3 style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16, color: "#0A0F2C", marginBottom: 12 }}>
                  <Briefcase style={{ display: "inline", width: 18, height: 18, marginRight: 6, color: "#CC4400" }} />
                  Por Função
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {funcoes.map(func => {
                    const itens = porFuncao[func];
                    const info = getInfo(func);
                    return (
                      <button key={func} onClick={() => { setFuncaoSel(func); setModo("funcao"); }}
                        style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 16, padding: "16px 14px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = info.cor; e.currentTarget.style.boxShadow = `0 4px 20px ${info.cor}22`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>{info.emoji}</span>
                          <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 12, color: "#0A0F2C", lineHeight: 1.3 }}>{func}</p>
                        </div>
                        <div style={{ background: info.bg, borderRadius: 10, padding: "6px 10px", display: "inline-block" }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: info.cor, fontFamily: "Montserrat" }}>{itens.length}</span>
                          <span style={{ fontSize: 10, color: info.cor, marginLeft: 4 }}>func.</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
