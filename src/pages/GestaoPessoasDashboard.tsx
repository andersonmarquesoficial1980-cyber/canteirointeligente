import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Briefcase, Search, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Funcionario {
  id: string;
  name: string;
  role: string;
  matricula: string;
  equipe: string;
  responsavel: string;
  data_admissao: string;
}

// Remove sufixos de nível (JR I, PL II, SR III, ESP I, ESPEC I, etc.)
function funcaoBase(role: string): string {
  if (!role) return "OUTROS";
  let r = role.toUpperCase().trim();
  // Remover sufixos de nível
  r = r.replace(/\s+(JR|PL|SR|ESP|ESPEC|ESPECIALIS|ESPECIAL)\s*(I{1,3}|IV|V|VI)?\s*$/i, "").trim();
  r = r.replace(/\s+(A|B)\s*$/i, "").trim();
  // Normalizar variações
  if (r.includes("APONTADOR")) return "APONTADOR DE OBRAS";
  if (r.includes("ENCARREGADO DE INFRAEST") || r.includes("ENC DE INFRAEST")) return "ENCARREGADO DE INFRAESTRUTURA";
  if (r.includes("ENCARREGADO")) return "ENCARREGADO DE OBRAS";
  if (r.includes("AJUDANTE DE MECAN")) return "AJUDANTE DE MECÂNICA";
  if (r.includes("AJUDANTE")) return "AJUDANTE GERAL";
  if (r.includes("LUBRIFICADOR")) return "LUBRIFICADOR";
  if (r.includes("MECANICO DE MAQUINA") || r.includes("MECÂNICO DE MÁQUINA")) return "MECÂNICO DE MÁQUINA";
  if (r.includes("MECANICO") || r.includes("MECÂNICO")) return "MECÂNICO";
  if (r.includes("MOTORISTA CARRETEIRO")) return "MOTORISTA CARRETEIRO";
  if (r.includes("MOTORISTA COMBOIO") || r.includes("MOTORISTA DE COMBOIO")) return "MOTORISTA COMBOIO";
  if (r.includes("MOTORISTA ESPARGIDOR")) return "MOTORISTA ESPARGIDOR";
  if (r.includes("MOTORISTA CAMINHAO BASCULANTE") || r.includes("MOTORISTA CAMINHAO")) return "MOTORISTA CAMINHÃO";
  if (r.includes("MOTORISTA DE CAMINHAO") || r.includes("MOTORISTA CAMINHÃO")) return "MOTORISTA CAMINHÃO";
  if (r.includes("MOTORISTA PIPA")) return "MOTORISTA PIPA";
  if (r.includes("MOTORISTA")) return "MOTORISTA";
  if (r.includes("MOTONIVELADORA")) return "MOTONIVELADORA";
  if (r.includes("OP USINA") || r.includes("OP DE USINA") || r.includes("USINA MOVEL KMA")) return "OPERADOR USINA KMA";
  if (r.includes("VIBROACABADORA") || r.includes("VIBRO")) return "OPERADOR VIBROACABADORA";
  if (r.includes("OPERADOR BOBCAT") || r.includes("BOBCAT")) return "OPERADOR BOBCAT";
  if (r.includes("OPERADOR DE FRESADORA") || r.includes("OPERADOR DE FRESA")) return "OPERADOR DE FRESADORA";
  if (r.includes("OPERADOR DE RETROES") || r.includes("OPERADOR RETROESCAVADEIRA") || r.includes("RETROES")) return "OPERADOR RETROESCAVADEIRA";
  if (r.includes("OPERADOR DE ESCAVADEIRA")) return "OPERADOR DE ESCAVADEIRA";
  if (r.includes("OPERADOR DE PA CARREGADEIRA") || r.includes("PA CARREGADEIRA")) return "OPERADOR PÁ CARREGADEIRA";
  if (r.includes("OPERADOR DE ROLO")) return "OPERADOR DE ROLO";
  if (r.includes("OPERADOR TRATOR ESTEIRA") || r.includes("TRATOR ESTEIRA")) return "OPERADOR TRATOR ESTEIRA";
  if (r.includes("TRATOR AGRICOLA")) return "TRATOR AGRÍCOLA";
  if (r.includes("OPERADOR SOLO")) return "OPERADOR SOLO";
  if (r.includes("OPERADOR DE MAQUINAS") || r.includes("OPERADOR DE MÁQUINAS")) return "OPERADOR DE MÁQUINAS";
  if (r.includes("OPERADOR")) return "OPERADOR";
  if (r.includes("SINALEIRO")) return "SINALEIRO";
  if (r.includes("PEDREIRO")) return "PEDREIRO";
  if (r.includes("RASTELEIRO")) return "RASTELEIRO";
  if (r.includes("MARTELETEIRO")) return "MARTELETEIRO";
  if (r.includes("MANGUEIRISTA")) return "MANGUEIRISTA";
  if (r.includes("TEC") && r.includes("SEG")) return "TÉC. SEG. TRABALHO";
  if (r.includes("MESISTA")) return "MESISTA";
  if (r.includes("AMOXARIFE")) return "AMOXARIFE";
  if (r.includes("CARPINTEIRO")) return "CARPINTEIRO";
  if (r.includes("ELETRICISTA")) return "ELETRICISTA";
  if (r.includes("DESENHISTA")) return "DESENHISTA TÉCNICO";
  if (r.includes("ANALISTA")) return "ANALISTA";
  if (r.includes("ASSISTENTE")) return "ASSISTENTE ADMINISTRATIVO";
  if (r.includes("COMPRADOR")) return "COMPRADOR";
  return r;
}

const FUNCAO_INFO: Record<string, { emoji: string; cor: string; bg: string }> = {
  "ENCARREGADO DE OBRAS":       { emoji: "👷", cor: "#0055AA", bg: "rgba(0,85,170,0.08)" },
  "ENCARREGADO DE INFRAESTRUTURA": { emoji: "🏗️", cor: "#003388", bg: "rgba(0,51,136,0.08)" },
  "APONTADOR DE OBRAS":         { emoji: "📋", cor: "#006640", bg: "rgba(0,102,64,0.08)" },
  "OPERADOR DE FRESADORA":      { emoji: "⚙️", cor: "#CC4400", bg: "rgba(204,68,0,0.08)" },
  "OPERADOR VIBROACABADORA":    { emoji: "🏗️", cor: "#006666", bg: "rgba(0,102,102,0.08)" },
  "OPERADOR BOBCAT":            { emoji: "🚜", cor: "#5500AA", bg: "rgba(85,0,170,0.08)" },
  "OPERADOR USINA KMA":         { emoji: "🏭", cor: "#AA0055", bg: "rgba(170,0,85,0.08)" },
  "OPERADOR RETROESCAVADEIRA":  { emoji: "🔧", cor: "#884400", bg: "rgba(136,68,0,0.08)" },
  "OPERADOR DE ESCAVADEIRA":    { emoji: "🦾", cor: "#664400", bg: "rgba(102,68,0,0.08)" },
  "OPERADOR PÁ CARREGADEIRA":   { emoji: "🚛", cor: "#446600", bg: "rgba(68,102,0,0.08)" },
  "OPERADOR DE ROLO":           { emoji: "🛞", cor: "#004488", bg: "rgba(0,68,136,0.08)" },
  "OPERADOR TRATOR ESTEIRA":    { emoji: "🚧", cor: "#AA6600", bg: "rgba(170,102,0,0.08)" },
  "MOTONIVELADORA":             { emoji: "🏔️", cor: "#558800", bg: "rgba(85,136,0,0.08)" },
  "MOTORISTA CAMINHÃO":         { emoji: "🚚", cor: "#AA3300", bg: "rgba(170,51,0,0.08)" },
  "MOTORISTA CARRETEIRO":       { emoji: "🚛", cor: "#880000", bg: "rgba(136,0,0,0.08)" },
  "MOTORISTA COMBOIO":          { emoji: "⛽", cor: "#AA5500", bg: "rgba(170,85,0,0.08)" },
  "MOTORISTA ESPARGIDOR":       { emoji: "🚒", cor: "#885500", bg: "rgba(136,85,0,0.08)" },
  "MOTORISTA PIPA":             { emoji: "💧", cor: "#0066AA", bg: "rgba(0,102,170,0.08)" },
  "MOTORISTA":                  { emoji: "🚗", cor: "#AA4400", bg: "rgba(170,68,0,0.08)" },
  "AJUDANTE GERAL":             { emoji: "🔨", cor: "#555555", bg: "rgba(85,85,85,0.08)" },
  "SINALEIRO":                  { emoji: "🚦", cor: "#AA8800", bg: "rgba(170,136,0,0.08)" },
  "PEDREIRO":                   { emoji: "🧱", cor: "#666666", bg: "rgba(102,102,102,0.08)" },
  "RASTELEIRO":                 { emoji: "🌿", cor: "#448800", bg: "rgba(68,136,0,0.08)" },
  "MECÂNICO":                   { emoji: "🔩", cor: "#336699", bg: "rgba(51,102,153,0.08)" },
  "TÉC. SEG. TRABALHO":         { emoji: "🦺", cor: "#CC6600", bg: "rgba(204,102,0,0.08)" },
  "LUBRIFICADOR":               { emoji: "🛢️", cor: "#663300", bg: "rgba(102,51,0,0.08)" },
};

function getInfo(func: string) {
  return FUNCAO_INFO[func] || { emoji: "👤", cor: "#444444", bg: "rgba(68,68,68,0.08)" };
}

function fmtBRL(v: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function tempoEmpresa(admissao: string): string {
  if (!admissao) return "";
  const adm = new Date(admissao);
  const hoje = new Date();
  let anos = hoje.getFullYear() - adm.getFullYear();
  let meses = hoje.getMonth() - adm.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  if (anos > 0) return `${anos}a ${meses}m`;
  return `${meses} meses`;
}

// ─── Tabela executiva ──────────────────────────────────────────────────────────
function TabelaExecutiva({ titulo, items, onVoltar, corTema, mostrarSalario, onClickFuncionario }: {
  titulo: string; items: Funcionario[]; onVoltar: () => void; corTema: string; mostrarSalario: boolean; onClickFuncionario?: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");

  // Ordenar: Encarregado primeiro, depois por função, depois por nome
  const ordenados = [...items].sort((a, b) => {
    const fa = funcaoBase(a.role); const fb = funcaoBase(b.role);
    const aEnc = fa.includes("ENCARREGADO") ? 0 : 1;
    const bEnc = fb.includes("ENCARREGADO") ? 0 : 1;
    if (aEnc !== bEnc) return aEnc - bEnc;
    if (fa !== fb) return fa.localeCompare(fb, "pt-BR");
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const filtrados = ordenados.filter(f =>
    !busca || f.name.toLowerCase().includes(busca.toLowerCase()) ||
    (f.matricula || "").includes(busca) ||
    (f.equipe || "").toLowerCase().includes(busca.toLowerCase())
  );

  const totalSalario = items.reduce((s, f) => s + ((f as any).salario || 0), 0);

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, #0A0F2C, ${corTema})`, borderRadius: 20, padding: "24px 28px", marginBottom: 16, color: "white" }}>
        <button onClick={onVoltar} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 14px", color: "white", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 20, marginBottom: 12 }}>{titulo}</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 26, fontWeight: 900, color: "#00C6FF", fontFamily: "Montserrat" }}>{items.length}</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Funcionários</p>
          </div>
          {mostrarSalario && totalSalario > 0 && (
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 18px", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#f97316", fontFamily: "Montserrat" }}>{fmtBRL(totalSalario)}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Custo salarial/mês</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
        <input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ width: "100%", paddingLeft: 30, height: 36, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}</p>

      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "grid", gridTemplateColumns: mostrarSalario ? "36px 80px 1fr 1fr 100px 80px" : "36px 80px 1fr 1fr 1fr", background: "#f8fafc", borderBottom: "2px solid #e5e7eb", padding: "8px 14px", gap: 8 }}>
          {["Nº", "MAT.", "NOME", "FUNÇÃO", ...(mostrarSalario ? ["SALÁRIO", "TEMPO"] : ["EQUIPE / RESP."])].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>
        {filtrados.map((f, i) => {
          const func = funcaoBase(f.role);
          const isEnc = func.includes("ENCARREGADO");
          return (
          <div key={f.id} onClick={() => onClickFuncionario?.(f.id)} style={{ display: "grid", gridTemplateColumns: mostrarSalario ? "36px 80px 1fr 1fr 100px 80px" : "36px 80px 1fr 1fr 1fr", padding: "9px 14px", borderBottom: "1px solid #f1f5f9", background: isEnc ? "#eff6ff" : i % 2 === 0 ? "white" : "#fafbfc", gap: 8, borderLeft: isEnc ? "3px solid #0055AA" : "3px solid transparent", cursor: onClickFuncionario ? "pointer" : "default" }}>
            <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>{i + 1}</span>
            <span style={{ fontSize: 12, fontFamily: "Montserrat", fontWeight: 700, color: "#0A0F2C" }}>{f.matricula || "—"}</span>
            <span style={{ fontSize: 12, color: isEnc ? "#0055AA" : "#374151", fontWeight: isEnc ? 700 : 400 }}>{f.name}</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{f.role}</span>
            {mostrarSalario ? (
              <>
                <span style={{ fontSize: 12, color: "#f97316", fontWeight: 600 }}>{fmtBRL((f as any).salario)}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{tempoEmpresa((f as any).data_admissao)}</span>
              </>
            ) : (
              <div>
                {f.equipe && <p style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>{f.equipe}</p>}
                {f.responsavel && <p style={{ fontSize: 10, color: "#9ca3af" }}>{f.responsavel}</p>}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function GestaoPessoasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [visao, setVisao] = useState<"funcao" | "equipe" | "responsavel">("funcao");
  const [selecao, setSelecao] = useState("");
  const [mostrando, setMostrando] = useState(false);
  const [busca, setBusca] = useState("");
  const [mostrarSalario, setMostrarSalario] = useState(false);
  const [abaAniv, setAbaAniv] = useState(false);

  useEffect(() => {
    supabase.from("employees").select("*").order("name")
      .then(({ data }) => { if (data) setTodos(data as any); setLoading(false); });
  }, []);

  // Grupos por visão
  const porFuncao: Record<string, Funcionario[]> = {};
  const porEquipe: Record<string, Funcionario[]> = {};
  const porResp: Record<string, Funcionario[]> = {};

  todos.forEach(f => {
    const fb = funcaoBase(f.role);
    if (!porFuncao[fb]) porFuncao[fb] = [];
    porFuncao[fb].push(f);

    const eq = f.equipe || "SEM EQUIPE";
    if (!porEquipe[eq]) porEquipe[eq] = [];
    porEquipe[eq].push(f);

    const resp = f.responsavel || "SEM RESPONSÁVEL";
    if (!porResp[resp]) porResp[resp] = [];
    porResp[resp].push(f);
  });

  const grupos = visao === "funcao" ? porFuncao : visao === "equipe" ? porEquipe : porResp;
  const chaves = Object.keys(grupos).sort();

  const itensSel = selecao ? (grupos[selecao] || []) : [];
  const corTema = visao === "funcao" ? (getInfo(selecao).cor || "#0055AA") : visao === "equipe" ? "#0055AA" : "#006640";

  // Aniversariantes do mês
  const mesAtual = new Date().getMonth() + 1;
  const aniversariantes = todos
    .filter(f => {
      const nasc = (f as any).data_nascimento;
      if (!nasc) return false;
      const m = parseInt(nasc.split("-")[1]);
      return m === mesAtual;
    })
    .sort((a, b) => {
      const da = parseInt(((a as any).data_nascimento || "").split("-")[2] || "0");
      const db = parseInt(((b as any).data_nascimento || "").split("-")[2] || "0");
      return da - db;
    });

  const filtradosBusca = busca
    ? todos.filter(f => f.name.toLowerCase().includes(busca.toLowerCase()) || (f.matricula || "").includes(busca) || (f.equipe || "").toLowerCase().includes(busca.toLowerCase()) || (f.role || "").toLowerCase().includes(busca.toLowerCase()))
    : [];

  function voltar() { setMostrando(false); setSelecao(""); }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8" }}>
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={mostrando ? voltar : () => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: "white" }}>WF Gestão de Pessoas</span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{todos.length} funcionários</span>
        </div>
      </header>

      <div style={{ maxWidth: 950, margin: "0 auto", padding: "20px 16px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>

        ) : mostrando ? (
          <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: mostrarSalario ? "#f97316" : "#64748b" }}>
              <input type="checkbox" checked={mostrarSalario} onChange={e => setMostrarSalario(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#f97316" }} />
              Ver salário e tempo de empresa
            </label>
          </div>
          <TabelaExecutiva titulo={selecao} items={itensSel} onVoltar={voltar} corTema={corTema} mostrarSalario={mostrarSalario} onClickFuncionario={(id) => navigate(`/gestao-pessoas/${id}`)} />
          </>

        ) : (
          <div>
            {/* Painel resumo */}
            <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", borderRadius: 24, padding: "28px", color: "white", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 26, marginBottom: 4 }}>Gestão de Pessoas</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>Reunião de Eficiência — visão completa do quadro</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Total", value: todos.length, cor: "#00C6FF" },
                  { label: "Equipes", value: Object.keys(porEquipe).length, cor: "#FFB300" },
                  { label: "Funções", value: Object.keys(porFuncao).length, cor: "#22c55e" },
                  { label: "Responsáveis", value: Object.keys(porResp).filter(k => k !== "SEM RESPONSÁVEL").length, cor: "#f97316" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 18px", flex: 1, textAlign: "center", minWidth: 80 }}>
                    <p style={{ fontSize: 26, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Busca global */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9ca3af" }} />
              <input placeholder="Buscar funcionário por nome, matrícula, função ou equipe..." value={busca} onChange={e => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 44, borderRadius: 14, border: "2px solid #e5e7eb", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" }} />
            </div>

            {busca && filtradosBusca.length > 0 && (
              <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.07)", marginBottom: 20 }}>
                <div style={{ padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                  {filtradosBusca.length} resultado{filtradosBusca.length !== 1 ? "s" : ""}
                </div>
                {filtradosBusca.slice(0, 30).map((f, i) => (
                  <div key={f.id} onClick={() => navigate(`/gestao-pessoas/${f.id}`)} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, background: i % 2 === 0 ? "white" : "#fafbfc", gap: 8, cursor: "pointer" }}>
                    <span style={{ fontFamily: "Montserrat", fontWeight: 700, color: "#0A0F2C" }}>{f.matricula || "—"}</span>
                    <span style={{ color: "#374151" }}>{f.name}</span>
                    <span style={{ color: "#6b7280", fontSize: 11 }}>{f.role}</span>
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>{f.equipe}</span>
                  </div>
                ))}
              </div>
            )}

            {!busca && (
              <>
                {/* Seletor de visão */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {[
                    { key: "funcao", label: "Por Função", emoji: "🔧" },
                    { key: "equipe", label: "Por Equipe", emoji: "👷" },
                    { key: "responsavel", label: "Por Responsável", emoji: "👤" },
                    { key: "aniversariantes", label: `🎂 Aniversariantes (${aniversariantes.length})`, emoji: "" },
                  ].map(v => (
                    <button key={v.key} onClick={() => { if (v.key === 'aniversariantes') setAbaAniv(true); else { setAbaAniv(false); setVisao(v.key as any); } }}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 12, border: "2px solid", cursor: "pointer", fontFamily: "Montserrat", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                        borderColor: (v.key === 'aniversariantes' ? abaAniv : !abaAniv && visao === v.key) ? "#0055AA" : "#e5e7eb",
                        background: (v.key === 'aniversariantes' ? abaAniv : !abaAniv && visao === v.key) ? "#0055AA" : "white",
                        color: (v.key === 'aniversariantes' ? abaAniv : !abaAniv && visao === v.key) ? "white" : "#374151",
                      }}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>

                {/* Cards */}
                {/* Aniversariantes */}
                {abaAniv && (
                  <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.07)", marginBottom: 16 }}>
                    <div style={{ background: "linear-gradient(135deg, #0A0F2C, #AA0055)", padding: "16px 20px", color: "white" }}>
                      <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16 }}>🎂 Aniversariantes do Mês</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })} — {aniversariantes.length} aniversariante{aniversariantes.length !== 1 ? "s" : ""}</p>
                    </div>
                    {aniversariantes.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0", fontSize: 13 }}>Nenhum aniversariante este mês.</p>
                    ) : (
                      aniversariantes.map((f, i) => {
                        const nasc = (f as any).data_nascimento || "";
                        const dia = nasc.split("-")[2] || "";
                        return (
                          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #AA0055, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Montserrat", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                              {dia}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{f.name}</p>
                              <p style={{ fontSize: 11, color: "#9ca3af" }}>{f.role} {f.equipe ? `· ${f.equipe}` : ""}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {!abaAniv && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
                  {chaves.map(chave => {
                    const itens = grupos[chave];
                    const info = visao === "funcao" ? getInfo(chave) : { emoji: visao === "equipe" ? "👷" : "👤", cor: visao === "equipe" ? "#0055AA" : "#006640", bg: visao === "equipe" ? "rgba(0,85,170,0.08)" : "rgba(0,102,64,0.08)" };
                    return (
                      <button key={chave} onClick={() => { setSelecao(chave); setMostrando(true); }}
                        style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 16, padding: "14px 12px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = info.cor; e.currentTarget.style.boxShadow = `0 4px 16px ${info.cor}22`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>{info.emoji}</span>
                          <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 11, color: "#0A0F2C", lineHeight: 1.3 }}>{chave}</p>
                        </div>
                        <div style={{ background: info.bg, borderRadius: 10, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: info.cor, fontFamily: "Montserrat" }}>{itens.length}</span>
                          <span style={{ fontSize: 10, color: info.cor }}>func.</span>
                        </div>
                      </button>
                    );
                  })}
                </div>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
