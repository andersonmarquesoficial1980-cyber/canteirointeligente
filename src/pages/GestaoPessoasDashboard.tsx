import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, ChevronRight, Wrench,
  User, Bus, MapPin, Camera, ClipboardList, ChevronDown, ChevronUp,
  MessageSquare, CheckSquare, Clock, Calendar, Smartphone, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import IntegracaoObrasCard from "@/components/IntegracaoObrasCard";

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

// ─── Linha de funcionário ─────────────────────────────────────────────────────
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

// ─── Bloco fixo de ferramentas RH ─────────────────────────────────────────────
const RH_ITEMS = [
  { label: "Registrar Ponto",      desc: "Ponto facial com GPS e geofencing automático",         icon: Camera,       rota: "/rh/registrar-ponto",          cor: "bg-blue-500/20 text-blue-600" },
  { label: "Espelho de Ponto",     desc: "Histórico mensal, horas trabalhadas e extras",          icon: ClipboardList, rota: "/rh/espelho-ponto",            cor: "bg-green-500/20 text-green-600" },
  { label: "Trajeto e VT",         desc: "Calcule rotas de transporte público e custo de VT",    icon: Bus,          rota: "/rh/trajeto-vt",               cor: "bg-orange-500/20 text-orange-600" },
  { label: "Gestão de VT",         desc: "Tarifas, conduções e custo mensal por funcionário",    icon: MapPin,       rota: "/vale-transporte",             cor: "bg-purple-500/20 text-purple-600" },
  { label: "Solicitações de Ponto",desc: "Ajuste de ponto e abono de falta",                     icon: MessageSquare,rota: "/rh/solicitacoes",             cor: "bg-yellow-500/20 text-yellow-600" },
  { label: "Aprovações",           desc: "Aprovar ou reprovar solicitações da equipe",           icon: CheckSquare,  rota: "/rh/aprovacoes",               cor: "bg-teal-500/20 text-teal-600" },
  { label: "Banco de Horas",       desc: "Saldo de horas por funcionário no mês",                icon: Clock,        rota: "/rh/banco-horas",              cor: "bg-indigo-500/20 text-indigo-600" },
  { label: "Programação de Férias",desc: "Controle de férias, coletivas e saldo por funcionário",icon: Calendar,    rota: "/gestao-pessoas/ferias",       cor: "bg-green-500/20 text-green-600" },
  { label: "WhatsApp RH",          desc: "Inbox de mensagens dos funcionários via WhatsApp",     icon: Smartphone,   rota: "/gestao-pessoas/whatsapp",     cor: "bg-green-600/20 text-green-700" },
];

function BlocoRH({ onNavigate }: { onNavigate: (rota: string) => void }) {
  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        📋 Ponto &amp; VT
      </p>
      <div className="flex flex-col gap-2">
        {RH_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.rota}
              onClick={() => onNavigate(item.rota)}
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
    </div>
  );
}

// ─── Busca de funcionário com dropdown ────────────────────────────────────────
function BuscaFuncionario({ todos, onSelect }: { todos: Funcionario[]; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const resultados = q.trim().length >= 2
    ? todos.filter(f =>
        f.name.toLowerCase().includes(q.toLowerCase()) ||
        (f.matricula || "").includes(q) ||
        (f.role || "").toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8)
    : [];

  // fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        🔍 Buscar Funcionário
      </p>
      <div style={{ position: "relative" }}>
        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9ca3af", pointerEvents: "none" }} />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          placeholder="Nome, matrícula ou função..."
          style={{
            width: "100%", paddingLeft: 36, paddingRight: q ? 36 : 12,
            height: 42, borderRadius: 12, border: "1.5px solid #e5e7eb",
            fontSize: 13, outline: "none", background: "white", boxSizing: "border-box",
          }}
        />
        {q && (
          <button
            onClick={() => { setQ(""); setAberto(false); }}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {aberto && resultados.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", marginTop: 4, overflow: "hidden",
        }}>
          {resultados.map((f, i) => (
            <button
              key={f.id}
              onClick={() => { onSelect(f.id); setQ(""); setAberto(false); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", background: i % 2 === 0 ? "white" : "#fafbfc",
                border: "none", borderBottom: i < resultados.length - 1 ? "1px solid #f1f5f9" : "none",
                cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f0f7ff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "#fafbfc"; }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: "50%", background: "#0055AA18",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <User size={16} color="#0055AA" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 1 }}>{f.name}</p>
                <p style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Mat. {f.matricula || "—"} · {f.role}</p>
              </div>
              <ChevronRight size={14} color="#d1d5db" />
            </button>
          ))}
        </div>
      )}
      {aberto && q.trim().length >= 2 && resultados.length === 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "white", borderRadius: 12, border: "1.5px solid #e5e7eb",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", marginTop: 4, padding: "14px",
          textAlign: "center", fontSize: 13, color: "#9ca3af",
        }}>
          Nenhum funcionário encontrado.
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
type Aba = "lista" | "funcao" | "equipe" | "responsavel" | "centro_custo" | "aniversariantes";

export default function GestaoPessoasDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("employees").select("*").order("name")
      .then(({ data }) => { if (data) setTodos(data as any); setLoading(false); });
  }, []);

  // Todos os cards do hub — ordem exata do print
  const HUB_ITEMS = [
    {
      label: "Cadastro de Equipe",
      desc: "Por função, por equipe, Centro de Custo e Aniversariantes",
      icon: User,
      cor: "bg-blue-500/15 text-blue-600",
      rota: "/gestao-pessoas/equipe",
    },
    { label: "Registrar Ponto",       desc: "Ponto facial com GPS e geofencing automático",          icon: Camera,        cor: "bg-blue-500/20 text-blue-600",    rota: "/rh/registrar-ponto" },
    { label: "Espelho de Ponto",      desc: "Histórico mensal, horas trabalhadas e extras",           icon: ClipboardList,  cor: "bg-green-500/20 text-green-600",  rota: "/rh/espelho-ponto" },
    { label: "Trajeto e VT",          desc: "Calcule rotas de transporte público e custo de VT",     icon: Bus,            cor: "bg-orange-500/20 text-orange-600", rota: "/rh/trajeto-vt" },
    { label: "Gestão de VT",          desc: "Tarifas, conduções e custo mensal por funcionário",     icon: MapPin,         cor: "bg-purple-500/20 text-purple-600", rota: "/vale-transporte" },
    { label: "Solicitações de Ponto", desc: "Ajuste de ponto e abono de falta",                      icon: MessageSquare,  cor: "bg-yellow-500/20 text-yellow-600", rota: "/rh/solicitacoes" },
    { label: "Aprovações",            desc: "Aprovar ou reprovar solicitações da equipe",            icon: CheckSquare,    cor: "bg-teal-500/20 text-teal-600",    rota: "/rh/aprovacoes" },
    { label: "Banco de Horas",        desc: "Saldo de horas por funcionário no mês",                 icon: Clock,          cor: "bg-indigo-500/20 text-indigo-600", rota: "/rh/banco-horas" },
    { label: "Programação de Férias", desc: "Controle de férias, coletivas e saldo por funcionário", icon: Calendar,       cor: "bg-green-500/20 text-green-600",  rota: "/gestao-pessoas/ferias" },
    { label: "WhatsApp RH",           desc: "Inbox de mensagens dos funcionários via WhatsApp",      icon: Smartphone,     cor: "bg-green-600/20 text-green-700",  rota: "/gestao-pessoas/whatsapp" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">WF Gestão de Pessoas</span>
          <span className="block text-[10px] text-primary-foreground/70">
            {loading ? "Carregando..." : `${todos.length} funcionários`}
          </span>
        </div>
      </header>

      {/* Programações do dia */}
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <ProgramacoesDoDia />
        </div>
      </div>

      {/* Hub de cards */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {HUB_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.rota}
              onClick={() => navigate(item.rota)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left w-full"
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

        {/* Card Integrações por Obra */}
        <IntegracaoObrasCard />
      </div>
    </div>
  );
}

