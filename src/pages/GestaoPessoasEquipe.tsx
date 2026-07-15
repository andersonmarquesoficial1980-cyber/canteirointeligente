/**
 * WF Gestão de Pessoas — Lista de Funcionários
 * Abas: Todos | Por Função | Por Equipe | Por Responsável | Centro de Custo | Aniversariantes
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, ChevronRight, ChevronDown, ChevronUp, User, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Funcionario {
  id: string;
  name: string;
  matricula: string | null;
  role: string | null;
  equipe: string | null;
  responsavel: string | null;
  data_nascimento?: string | null;
  salario?: number | null;
  foto_url?: string | null;
  status?: string | null;
}

function funcaoBase(role: string | null) {
  if (!role) return "SEM FUNÇÃO";
  return role.trim().toUpperCase();
}

function LinhaFuncionario({
  f, index, onClickFuncionario, mostrarSalario,
}: { f: Funcionario; index: number; onClickFuncionario: (id: string) => void; mostrarSalario: boolean }) {
  return (
    <div
      onClick={() => onClickFuncionario(f.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px", cursor: "pointer",
        borderBottom: "1px solid #f1f5f9",
        background: index % 2 === 0 ? "white" : "#fafbfc",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
      onMouseLeave={e => { e.currentTarget.style.background = index % 2 === 0 ? "white" : "#fafbfc"; }}
    >
      {f.foto_url ? (
        <img src={f.foto_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#0055AA,#0077DD)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 14, fontWeight: 800,
        }}>
          {f.name.charAt(0)}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {f.name}
        </p>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
          {f.role ?? "—"}{f.equipe ? ` · ${f.equipe}` : ""}{f.matricula ? ` · Mat. ${f.matricula}` : ""}
          {mostrarSalario && f.salario ? ` · R$ ${Number(f.salario).toLocaleString("pt-BR")}` : ""}
        </p>
      </div>
      <ChevronRight size={15} color="#d1d5db" style={{ flexShrink: 0 }} />
    </div>
  );
}

function GrupoColapsavel({
  titulo, itens, corTema, onClickFuncionario, mostrarSalario,
}: {
  titulo: string; itens: Funcionario[]; corTema: string;
  onClickFuncionario: (id: string) => void; mostrarSalario: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 8, boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: corTema, flexShrink: 0 }} />
        <p style={{ flex: 1, fontWeight: 700, fontSize: 13, color: "#1e293b", textAlign: "left" }}>{titulo}</p>
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 6 }}>{itens.length}</span>
        {aberto ? <ChevronUp size={15} color="#94a3b8" /> : <ChevronDown size={15} color="#94a3b8" />}
      </button>
      {aberto && (
        <div style={{ borderTop: "1px solid #f1f5f9" }}>
          {itens.map((f, i) => (
            <LinhaFuncionario key={f.id} f={f} index={i} onClickFuncionario={onClickFuncionario} mostrarSalario={mostrarSalario} />
          ))}
        </div>
      )}
    </div>
  );
}

type Aba = "lista" | "funcao" | "equipe" | "responsavel" | "centro_custo" | "aniversariantes";

export default function GestaoPessoasEquipe() {
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

  const porFuncao: Record<string, Funcionario[]> = {};
  const porEquipe: Record<string, Funcionario[]> = {};
  const porResp: Record<string, Funcionario[]> = {};
  const porCentro: Record<string, Funcionario[]> = {};

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
    const cc = (f as any).centro_custo || "SEM CENTRO DE CUSTO";
    if (!porCentro[cc]) porCentro[cc] = [];
    porCentro[cc].push(f);
  });

  const mesAtual = new Date().getMonth() + 1;
  const aniversariantes = todos
    .filter(f => { const n = (f as any).data_nascimento; if (!n) return false; return parseInt(n.split("-")[1]) === mesAtual; })
    .sort((a, b) => parseInt(((a as any).data_nascimento || "").split("-")[2] || "0") - parseInt(((b as any).data_nascimento || "").split("-")[2] || "0"));

  const filtrados = busca
    ? todos.filter(f =>
        f.name.toLowerCase().includes(busca.toLowerCase()) ||
        (f.matricula || "").includes(busca) ||
        (f.equipe || "").toLowerCase().includes(busca.toLowerCase()) ||
        (f.role || "").toLowerCase().includes(busca.toLowerCase()) ||
        ((f as any).centro_custo || "").toLowerCase().includes(busca.toLowerCase())
      )
    : todos;

  const irFuncionario = (id: string) => navigate(`/gestao-pessoas/${id}`);

  const ABAS: { id: Aba; label: string; emoji: string; count?: number }[] = [
    { id: "lista",           label: "Todos",           emoji: "👤", count: todos.length },
    { id: "funcao",          label: "Por Função",      emoji: "🔧", count: Object.keys(porFuncao).length },
    { id: "equipe",          label: "Por Equipe",      emoji: "👷", count: Object.keys(porEquipe).length },
    { id: "responsavel",     label: "Por Responsável", emoji: "🧑‍💼", count: Object.keys(porResp).filter(k => k !== "SEM RESPONSÁVEL").length },
    { id: "centro_custo",    label: "Centro de Custo", emoji: "🏢", count: Object.keys(porCentro).filter(k => k !== "SEM CENTRO DE CUSTO").length },
    { id: "aniversariantes", label: "Aniversariantes", emoji: "🎂", count: aniversariantes.length },
  ];

  const corGrupo = (ab: Aba) =>
    ab === "funcao" ? "#0055AA" : ab === "equipe" ? "#006640" : ab === "responsavel" ? "#6D28D9" : ab === "centro_custo" ? "#B45309" : "#374151";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/gestao-pessoas")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Funcionários</span>
          <span className="block text-[10px] text-primary-foreground/70">{todos.length} cadastrados</span>
        </div>
      </header>

      {/* Resumo */}
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 760, margin: "0 auto" }}>
          {[
            { label: "Total",        value: todos.length,                                                                     cor: "#00C6FF" },
            { label: "Equipes",      value: Object.keys(porEquipe).length,                                                    cor: "#FFB300" },
            { label: "Funções",      value: Object.keys(porFuncao).length,                                                    cor: "#22c55e" },
            { label: "C. Custo",     value: Object.keys(porCentro).filter(k => k !== "SEM CENTRO DE CUSTO").length,          cor: "#B45309" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", flex: 1, textAlign: "center", minWidth: 60 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Abas */}
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
        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nome, matrícula, função ou equipe..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: "100%", height: 44, borderRadius: 12,
              border: "1.5px solid #e2e8f0", paddingLeft: 36, paddingRight: busca ? 36 : 12,
              fontSize: 13, outline: "none", background: "white", boxSizing: "border-box",
            }}
          />
          {busca && (
            <button onClick={() => setBusca("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>
        ) : (
          <>
            {/* ABA TODOS */}
            {aba === "lista" && (
              <>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
                  {filtrados.length} funcionário{filtrados.length !== 1 ? "s" : ""}{busca ? ` para "${busca}"` : ""}
                </p>
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  {filtrados.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: 13 }}>Nenhum funcionário encontrado</p>
                  ) : filtrados.map((f, i) => (
                    <LinhaFuncionario key={f.id} f={f} index={i} onClickFuncionario={irFuncionario} mostrarSalario={false} />
                  ))}
                </div>
              </>
            )}

            {/* ABAS AGRUPADAS */}
            {(aba === "funcao" || aba === "equipe" || aba === "responsavel" || aba === "centro_custo") && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>
                    {aba === "funcao" ? Object.keys(porFuncao).length : aba === "equipe" ? Object.keys(porEquipe).length : aba === "centro_custo" ? Object.keys(porCentro).length : Object.keys(porResp).length} grupos · {todos.length} funcionários
                  </p>
                  {isAdmin && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: mostrarSalario ? "#f97316" : "#64748b" }}>
                      <input type="checkbox" checked={mostrarSalario} onChange={e => setMostrarSalario(e.target.checked)} style={{ accentColor: "#f97316" }} />
                      Ver salário
                    </label>
                  )}
                </div>
                {Object.entries(
                  aba === "funcao" ? porFuncao : aba === "equipe" ? porEquipe : aba === "centro_custo" ? porCentro : porResp
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

            {/* ABA ANIVERSARIANTES */}
            {aba === "aniversariantes" && (
              <>
                <div style={{ background: "linear-gradient(135deg,#0A0F2C,#AA0055)", borderRadius: 16, padding: "16px 20px", color: "white", marginBottom: 16 }}>
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
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#AA0055,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Montserrat", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
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
          </>
        )}
      </div>
    </div>
  );
}
