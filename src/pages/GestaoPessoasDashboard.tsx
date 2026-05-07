import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, ChevronRight, Users, Wrench, ShieldCheck,
  User, Bus, MapPin, Camera, ClipboardList, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Funcionario {
  id: string;
  name: string;
  role: string;
  matricula: string;
  equipe: string;
  responsavel: string;
  data_admissao: string;
  data_nascimento: string;
  salario?: number | null;
  obs_geral?: string | null;
  obs_ponto?: string | null;
  status?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtBRL(v: number | null | undefined) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
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
  return `${meses}m`;
}

// Remove sufixos de nível
function funcaoBase(role: string): string {
  if (!role) return "OUTROS";
  let r = role.toUpperCase().trim();
  r = r.replace(/\s+(JR|PL|SR|ESP|ESPEC)\s*(I{1,3}|IV|V)?\s*$/i, "").trim();
  r = r.replace(/\s+(A|B)\s*$/i, "").trim();
  if (r.includes("APONTADOR")) return "APONTADOR DE OBRAS";
  if (r.includes("ENCARREGADO DE INFRAEST")) return "ENCARREGADO DE INFRAESTRUTURA";
  if (r.includes("ENCARREGADO")) return "ENCARREGADO DE OBRAS";
  if (r.includes("AJUDANTE DE MECAN")) return "AJUDANTE DE MECÂNICA";
  if (r.includes("AJUDANTE")) return "AJUDANTE GERAL";
  if (r.includes("MOTORISTA CARRETEIRO")) return "MOTORISTA CARRETEIRO";
  if (r.includes("MOTORISTA COMBOIO") || r.includes("MOTORISTA DE COMBOIO")) return "MOTORISTA COMBOIO";
  if (r.includes("MOTORISTA ESPARGIDOR")) return "MOTORISTA ESPARGIDOR";
  if (r.includes("MOTORISTA CAMINHAO") || r.includes("MOTORISTA CAMINHÃO")) return "MOTORISTA CAMINHÃO";
  if (r.includes("MOTORISTA PIPA")) return "MOTORISTA PIPA";
  if (r.includes("MOTORISTA")) return "MOTORISTA";
  if (r.includes("MOTONIVELADORA")) return "MOTONIVELADORA";
  if (r.includes("OP USINA") || r.includes("USINA MOVEL KMA")) return "OPERADOR USINA KMA";
  if (r.includes("VIBROACABADORA")) return "OPERADOR VIBROACABADORA";
  if (r.includes("OPERADOR BOBCAT") || r.includes("BOBCAT")) return "OPERADOR BOBCAT";
  if (r.includes("OPERADOR DE FRESADORA") || r.includes("OPERADOR DE FRESA")) return "OPERADOR DE FRESADORA";
  if (r.includes("OPERADOR DE RETROES") || r.includes("RETROES")) return "OPERADOR RETROESCAVADEIRA";
  if (r.includes("OPERADOR DE ESCAVADEIRA")) return "OPERADOR DE ESCAVADEIRA";
  if (r.includes("OPERADOR DE PA CARREGADEIRA") || r.includes("PA CARREGADEIRA")) return "OPERADOR PÁ CARREGADEIRA";
  if (r.includes("OPERADOR DE ROLO")) return "OPERADOR DE ROLO";
  if (r.includes("OPERADOR TRATOR ESTEIRA")) return "OPERADOR TRATOR ESTEIRA";
  if (r.includes("LUBRIFICADOR")) return "LUBRIFICADOR";
  if (r.includes("MECANICO DE MAQUINA") || r.includes("MECÂNICO DE MÁQUINA")) return "MECÂNICO DE MÁQUINA";
  if (r.includes("MECANICO") || r.includes("MECÂNICO")) return "MECÂNICO";
  if (r.includes("SINALEIRO")) return "SINALEIRO";
  if (r.includes("PEDREIRO")) return "PEDREIRO";
  if (r.includes("RASTELEIRO")) return "RASTELEIRO";
  if (r.includes("TEC") && r.includes("SEG")) return "TÉC. SEG. TRABALHO";
  if (r.includes("ASSISTENTE")) return "ASSISTENTE ADMINISTRATIVO";
  if (r.includes("ANALISTA")) return "ANALISTA";
  return r;
}

// ─── Linha de funcionário (reutilizável) ──────────────────────────────────────
function LinhaFuncionario({ f, index, onClickFuncionario, mostrarSalario }: {
  f: Funcionario; index: number; onClickFuncionario: (id: string) => void; mostrarSalario?: boolean;
}) {
  const isEnc = funcaoBase(f.role).includes("ENCARREGADO");
  return (
    <div
      onClick={() => onClickFuncionario(f.id)}
      style={{
        display: "grid",
        gridTemplateColumns: mostrarSalario ? "44px 70px 1fr 1fr 110px 70px" : "44px 70px 1fr 1fr",
        padding: "10px 16px",
        borderBottom: "1px solid #f1f5f9",
        background: isEnc ? "#eff6ff" : index % 2 === 0 ? "white" : "#fafbfc",
        borderLeft: isEnc ? "3px solid #0055AA" : "3px solid transparent",
        cursor: "pointer",
        gap: 8,
        alignItems: "center",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
      onMouseLeave={e => { e.currentTarget.style.background = isEnc ? "#eff6ff" : index % 2 === 0 ? "white" : "#fafbfc"; }}
    >
      <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>{index + 1}</span>
      <span style={{ fontSize: 12, fontFamily: "Montserrat", fontWeight: 700, color: "#0A0F2C" }}>{f.matricula || "—"}</span>
      <span style={{ fontSize: 13, color: isEnc ? "#0055AA" : "#1e293b", fontWeight: isEnc ? 700 : 500 }}>{f.name}</span>
      <span style={{ fontSize: 11, color: "#6b7280" }}>{f.role}</span>
      {mostrarSalario && (
        <>
          <span style={{ fontSize: 12, color: "#f97316", fontWeight: 600 }}>{fmtBRL(f.salario)}</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>{tempoEmpresa(f.data_admissao)}</span>
        </>
      )}
    </div>
  );
}

// ─── Grupo colapsável ──────────────────────────────────────────────────────────
function GrupoColapsavel({ titulo, itens, corTema, onClickFuncionario, mostrarSalario }: {
  titulo: string; itens: Funcionario[]; corTema: string;
  onClickFuncionario: (id: string) => void; mostrarSalario: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const filtrados = busca
    ? itens.filter(f => f.name.toLowerCase().includes(busca.toLowerCase()) || (f.matricula || "").includes(busca))
    : itens;

  const ordenados = [...filtrados].sort((a, b) => {
    const fa = funcaoBase(a.role), fb = funcaoBase(b.role);
    const aEnc = fa.includes("ENCARREGADO") ? 0 : 1;
    const bEnc = fb.includes("ENCARREGADO") ? 0 : 1;
    if (aEnc !== bEnc) return aEnc - bEnc;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return (
    <div style={{ borderRadius: 14, border: "1.5px solid #e5e7eb", overflow: "hidden", background: "white", marginBottom: 8 }}>
      {/* Header do grupo */}
      <button
        onClick={() => setAberto(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          background: aberto ? `${corTema}12` : "white", borderBottom: aberto ? "1.5px solid #e5e7eb" : "none",
          cursor: "pointer", border: "none", textAlign: "left", transition: "background 0.15s",
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: corTema, flexShrink: 0 }} />
        <span style={{ flex: 1, fontFamily: "Montserrat", fontWeight: 700, fontSize: 13, color: "#0A0F2C" }}>{titulo}</span>
        <span style={{
          background: `${corTema}18`, color: corTema, borderRadius: 20,
          padding: "2px 10px", fontSize: 12, fontWeight: 700, fontFamily: "Montserrat"
        }}>{itens.length}</span>
        {aberto ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
      </button>

      {/* Lista colapsada */}
      {aberto && (
        <>
          {itens.length > 8 && (
            <div style={{ padding: "8px 16px 4px", position: "relative" }}>
              <Search style={{ position: "absolute", left: 26, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#9ca3af" }} />
              <input
                placeholder="Filtrar neste grupo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ width: "100%", paddingLeft: 28, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}
          {/* Cabeçalho colunas */}
          <div style={{
            display: "grid",
            gridTemplateColumns: mostrarSalario ? "44px 70px 1fr 1fr 110px 70px" : "44px 70px 1fr 1fr",
            padding: "6px 16px", background: "#f8fafc",
            borderBottom: "1px solid #e5e7eb", gap: 8,
          }}>
            {["Nº", "MAT.", "NOME", "FUNÇÃO", ...(mostrarSalario ? ["SALÁRIO", "TEMPO"] : [])].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          {ordenados.map((f, i) => (
            <LinhaFuncionario key={f.id} f={f} index={i} onClickFuncionario={onClickFuncionario} mostrarSalario={mostrarSalario} />
          ))}
          {filtrados.length === 0 && (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "16px 0", fontSize: 13 }}>Nenhum resultado.</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
type Aba = "lista" | "funcao" | "equipe" | "responsavel" | "aniversariantes" | "rh";

export default function GestaoPessoasDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("lista");
  const [busca, setBusca] = useState("");
  const [mostrarSalario, setMostrarSalario] = useState(false);

  useEffect(() => {
    supabase.from("employees").select("*").order("name")
      .then(({ data }) => { if (data) setTodos(data as any); setLoading(false); });
  }, []);

  // Grupos
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

  const mesAtual = new Date().getMonth() + 1;
  const aniversariantes = todos
    .filter(f => { const n = (f as any).data_nascimento; if (!n) return false; return parseInt(n.split("-")[1]) === mesAtual; })
    .sort((a, b) => parseInt(((a as any).data_nascimento || "").split("-")[2] || "0") - parseInt(((b as any).data_nascimento || "").split("-")[2] || "0"));

  // Lista filtrada (aba lista)
  const filtrados = busca
    ? todos.filter(f =>
        f.name.toLowerCase().includes(busca.toLowerCase()) ||
        (f.matricula || "").includes(busca) ||
        (f.equipe || "").toLowerCase().includes(busca.toLowerCase()) ||
        (f.role || "").toLowerCase().includes(busca.toLowerCase())
      )
    : todos;

  const irFuncionario = (id: string) => navigate(`/gestao-pessoas/${id}`);

  const ABAS: { id: Aba; label: string; emoji: string; count?: number }[] = [
    { id: "lista",          label: "Todos",          emoji: "👤", count: todos.length },
    { id: "funcao",         label: "Por Função",     emoji: "🔧", count: Object.keys(porFuncao).length },
    { id: "equipe",         label: "Por Equipe",     emoji: "👷", count: Object.keys(porEquipe).length },
    { id: "responsavel",    label: "Por Responsável",emoji: "🧑‍💼", count: Object.keys(porResp).filter(k => k !== "SEM RESPONSÁVEL").length },
    { id: "aniversariantes",label: "Aniversariantes",emoji: "🎂", count: aniversariantes.length },
    { id: "rh",             label: "WF RH",          emoji: "📋" },
  ];

  const corGrupo = (ab: Aba) =>
    ab === "funcao" ? "#0055AA" : ab === "equipe" ? "#006640" : ab === "responsavel" ? "#6D28D9" : "#374151";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">WF Gestão de Pessoas</span>
          <span className="block text-[10px] text-primary-foreground/70">{todos.length} funcionários</span>
        </div>
      </header>

      {/* Painel resumo */}
      <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", padding: "20px 16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 760, margin: "0 auto" }}>
          {[
            { label: "Total", value: todos.length, cor: "#00C6FF" },
            { label: "Equipes", value: Object.keys(porEquipe).length, cor: "#FFB300" },
            { label: "Funções", value: Object.keys(porFuncao).length, cor: "#22c55e" },
            { label: "Responsáveis", value: Object.keys(porResp).filter(k => k !== "SEM RESPONSÁVEL").length, cor: "#f97316" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 16px", flex: 1, textAlign: "center", minWidth: 70 }}>
              <p style={{ fontSize: 24, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Abas horizontais */}
      <div className="flex overflow-x-auto border-b border-border bg-background sticky top-[60px] z-20">
        {ABAS.map(a => (
          <button
            key={a.id}
            onClick={() => { setAba(a.id); setBusca(""); }}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 shrink-0 ${
              aba === a.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{a.emoji}</span>
            <span>{a.label}</span>
            {a.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${aba === a.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {a.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>
        ) : (
          <>
            {/* ── ABA TODOS (LISTA COMPLETA) ──────────────────────────── */}
            {aba === "lista" && (
              <>
                {/* Busca + toggle salário */}
                <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
                    <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9ca3af" }} />
                    <input
                      placeholder="Buscar por nome, matrícula, função ou equipe..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      style={{ width: "100%", paddingLeft: 36, height: 40, borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", background: "white", boxSizing: "border-box" }}
                    />
                  </div>
                  {isAdmin && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: mostrarSalario ? "#f97316" : "#64748b", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={mostrarSalario} onChange={e => setMostrarSalario(e.target.checked)} style={{ accentColor: "#f97316" }} />
                      Ver salário
                    </label>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{filtrados.length} funcionário{filtrados.length !== 1 ? "s" : ""}</p>

                {/* Tabela */}
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                  {/* Cabeçalho */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: mostrarSalario ? "44px 70px 1fr 1fr 110px 70px" : "44px 70px 1fr 1fr",
                    padding: "8px 16px", background: "#f8fafc",
                    borderBottom: "2px solid #e5e7eb", gap: 8,
                  }}>
                    {["Nº", "MAT.", "NOME", "FUNÇÃO", ...(mostrarSalario ? ["SALÁRIO", "TEMPO"] : [])].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                  {filtrados.map((f, i) => (
                    <LinhaFuncionario key={f.id} f={f} index={i} onClickFuncionario={irFuncionario} mostrarSalario={mostrarSalario} />
                  ))}
                  {filtrados.length === 0 && (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0", fontSize: 13 }}>Nenhum resultado para "{busca}"</p>
                  )}
                </div>
              </>
            )}

            {/* ── ABA AGRUPADA (FUNÇÃO / EQUIPE / RESPONSÁVEL) ───────── */}
            {(aba === "funcao" || aba === "equipe" || aba === "responsavel") && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>
                    {aba === "funcao" ? Object.keys(porFuncao).length : aba === "equipe" ? Object.keys(porEquipe).length : Object.keys(porResp).length} grupos · {todos.length} funcionários
                  </p>
                  {isAdmin && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: mostrarSalario ? "#f97316" : "#64748b" }}>
                      <input type="checkbox" checked={mostrarSalario} onChange={e => setMostrarSalario(e.target.checked)} style={{ accentColor: "#f97316" }} />
                      Ver salário
                    </label>
                  )}
                </div>

                {Object.entries(
                  aba === "funcao" ? porFuncao : aba === "equipe" ? porEquipe : porResp
                )
                  .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
                  .map(([chave, itens]) => (
                    <GrupoColapsavel
                      key={chave}
                      titulo={chave}
                      itens={itens}
                      corTema={corGrupo(aba)}
                      onClickFuncionario={irFuncionario}
                      mostrarSalario={mostrarSalario && isAdmin}
                    />
                  ))}
              </>
            )}

            {/* ── ABA ANIVERSARIANTES ────────────────────────────────── */}
            {aba === "aniversariantes" && (
              <>
                <div style={{ background: "linear-gradient(135deg, #0A0F2C, #AA0055)", borderRadius: 16, padding: "16px 20px", color: "white", marginBottom: 16 }}>
                  <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16 }}>🎂 Aniversariantes do Mês</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                    {new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })} · {aniversariantes.length} aniversariante{aniversariantes.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                  {aniversariantes.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0", fontSize: 13 }}>Nenhum aniversariante este mês.</p>
                  ) : aniversariantes.map((f, i) => {
                    const dia = ((f as any).data_nascimento || "").split("-")[2] || "";
                    return (
                      <div
                        key={f.id}
                        onClick={() => irFuncionario(f.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "white" : "#fafbfc"; }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #AA0055, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Montserrat", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                          {dia}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{f.name}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{f.role}{f.equipe ? ` · ${f.equipe}` : ""}</p>
                        </div>
                        <ChevronRight size={16} color="#d1d5db" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── ABA WF RH ─────────────────────────────────────────── */}
            {aba === "rh" && (
              <>
                <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Módulos operacionais de RH</p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Registrar Ponto", desc: "Ponto facial com GPS e geofencing automático", icon: Camera, rota: "/rh/registrar-ponto", cor: "bg-blue-500/20 text-blue-600" },
                    { label: "Espelho de Ponto", desc: "Histórico mensal, horas trabalhadas e extras", icon: ClipboardList, rota: "/rh/espelho-ponto", cor: "bg-green-500/20 text-green-600" },
                    { label: "Trajeto e VT", desc: "Calcule rotas de transporte público e custo de VT", icon: Bus, rota: "/rh/trajeto-vt", cor: "bg-orange-500/20 text-orange-600" },
                    { label: "Gestão de VT", desc: "Tarifas, conduções e custo mensal por funcionário", icon: MapPin, rota: "/vale-transporte", cor: "bg-purple-500/20 text-purple-600" },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.rota}
                        onClick={() => navigate(item.rota)}
                        className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.cor}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
