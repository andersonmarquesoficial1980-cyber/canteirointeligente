import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, DollarSign, Truck, Wrench, Users, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Equipamento {
  id: string;
  codigo_custo: string;
  placa: string;
  modelo: string;
  setor: string;
  categoria: string;
  locadora: string;
  valor_mensal: number;
  status: string;
  observacoes: string;
  tipo_veiculo: string;
}

function formatBRL(v: number) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mapa de tipos → subtipos (baseado nos dados reais da planilha)
const TIPO_SUBTIPOS: Record<string, string[]> = {
  caminhao: ["CAMINHÃO BASCULANTE", "CAMINHÃO CARROCERIA", "CAMINHÃO COMBOIO", "CAMINHÃO ESPARGIDOR", "CAMINHÃO PIPA", "CAMINHÃO PLATAFORMA"],
  carreta:  ["CARRETA", "CAVALO MECANICO", "PRANCHA REBOQUE"],
  maquina:  ["FRESADORA", "BOBCAT", "ROLO CHAPA", "ROLO PNEU", "ROLO PÉ DE CARNEIRO", "VIBRO ACABADORA", "USINA MÓVEL", "RETROESCAVADEIRA", "COMPRESSOR", "GERADOR", "SERRA CLIPER", "ROMPEDOR ELÉTRICO", "ROMPEDOR PNEUMATICO", "PLACA VIBRATÓRIA", "SAPO COMPACTADOR", "MISTURADOR DE ARGAMASSA", "COMPACTADOR DE SOLO", "DENSIMETRO", "PMV MÓVEL", "BANHEIRO QUÍMICO", "CARRETINHA BANHEIRO"],
  veiculo_leve: [],
  utilitario:   [],
  van:          [],
  outro:        [],
};

const TIPO_INFO: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  caminhao:     { label: "Caminhões",        emoji: "🚛", color: "#0066CC", bg: "rgba(0,102,204,0.08)" },
  carreta:      { label: "Carretas",         emoji: "🚚", color: "#006640", bg: "rgba(0,102,64,0.08)" },
  maquina:      { label: "Máquinas",         emoji: "⚙️", color: "#CC4400", bg: "rgba(204,68,0,0.08)" },
  veiculo_leve: { label: "Veículos Leves",   emoji: "🚗", color: "#5500CC", bg: "rgba(85,0,204,0.08)" },
  utilitario:   { label: "Utilitários",      emoji: "🛻", color: "#006666", bg: "rgba(0,102,102,0.08)" },
  van:          { label: "Vans",             emoji: "🚐", color: "#884400", bg: "rgba(136,68,0,0.08)" },
  outro:        { label: "Outros",           emoji: "🔧", color: "#444444", bg: "rgba(68,68,68,0.08)" },
};

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  ativo:         { color: "#22c55e", label: "Ativo" },
  inativo:       { color: "#ef4444", label: "Inativo" },
  em_manutencao: { color: "#f59e0b", label: "Manutenção" },
  devolvido:     { color: "#94a3b8", label: "Devolvido" },
};

// ─── Card de equipamento estilo PowerBI ───────────────────────────────────────
function EquipCard({ eq }: { eq: Equipamento }) {
  const st = STATUS_DOT[eq.status] || STATUS_DOT.ativo;
  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#0A0F2C" }}>
          {eq.codigo_custo || eq.placa}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: st.color }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color, display: "inline-block" }} />
          {st.label}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, lineHeight: 1.4 }}>{eq.modelo}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 11 }}>
        {eq.setor && (
          <div><span style={{ color: "#9ca3af" }}>Equipe</span><br /><strong>{eq.setor}</strong></div>
        )}
        <div>
          <span style={{ color: "#9ca3af" }}>Empresa</span><br />
          <strong style={{ color: eq.categoria === "locado" ? "#0066CC" : "#22c55e" }}>
            {eq.categoria === "locado" ? (eq.locadora || "Terceiro") : "Próprio"}
          </strong>
        </div>
        {eq.valor_mensal > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ color: "#9ca3af" }}>Locação mensal</span><br />
            <strong style={{ color: "#f97316", fontSize: 13 }}>{formatBRL(eq.valor_mensal)}</strong>
          </div>
        )}
        {eq.observacoes && (
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={{ color: "#9ca3af" }}>Obs</span><br />
            <span style={{ color: "#6b7280" }}>{eq.observacoes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Painel de lista com cards ─────────────────────────────────────────────────
function PainelLista({ titulo, items, onVoltar }: { titulo: string; items: Equipamento[]; onVoltar: () => void }) {
  const totalMensal = items.filter(i => i.categoria === "locado").reduce((s, i) => s + (i.valor_mensal || 0), 0);
  const terceiros = items.filter(i => i.categoria === "locado").length;

  return (
    <div>
      {/* Cabeçalho do painel */}
      <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", borderRadius: 20, padding: "24px", marginBottom: 16, color: "white" }}>
        <button onClick={onVoltar} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", color: "white", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 22, marginBottom: 4 }}>{titulo}</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#00C6FF" }}>{items.length}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Equipamentos</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#FFB300" }}>{terceiros}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Terceirizados</p>
          </div>
          {totalMensal > 0 && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#f97316" }}>{formatBRL(totalMensal)}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Custo mensal</p>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {items.map(eq => <EquipCard key={eq.id} eq={eq} />)}
      </div>
      {items.length === 0 && (
        <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Nenhum equipamento encontrado.</p>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function GestaoFrotasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<"inicio" | "equipe" | "tipo">("inicio");
  const [step, setStep] = useState<"selecao" | "subtipo" | "lista">("selecao");
  const [tipoSel, setTipoSel] = useState("");
  const [subtipoSel, setSubtipoSel] = useState("");
  const [equipeSel, setEquipeSel] = useState("");

  useEffect(() => {
    supabase.from("frotas_gestao").select("*").order("setor,codigo_custo")
      .then(({ data }) => { if (data) setTodos(data); setLoading(false); });
  }, []);

  const equipes = [...new Set(todos.map(e => e.setor).filter(Boolean))].sort();
  const tipos = [...new Set(todos.map(e => e.tipo_veiculo).filter(Boolean))].sort();
  const totalGeral = todos.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);

  // Itens filtrados para lista final
  const itensFiltrados = (() => {
    if (modo === "equipe") return todos.filter(e => e.setor === equipeSel);
    if (modo === "tipo") {
      if (subtipoSel) return todos.filter(e => e.tipo_veiculo === tipoSel && (e.modelo || "").toUpperCase().includes(subtipoSel.toUpperCase()));
      return todos.filter(e => e.tipo_veiculo === tipoSel);
    }
    return [];
  })();

  const tituloLista = modo === "equipe" ? equipeSel : (subtipoSel || TIPO_INFO[tipoSel]?.label || tipoSel);

  function voltarStep() {
    if (step === "lista" && modo === "tipo" && TIPO_SUBTIPOS[tipoSel]?.length > 0) {
      setStep("subtipo");
    } else {
      setStep("selecao");
      setTipoSel(""); setSubtipoSel(""); setEquipeSel("");
      setModo("inicio");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fa" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => step === "selecao" && modo === "inicio" ? navigate("/gestao-frotas") : voltarStep()}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Dashboard de Frotas</span>
          <span className="block text-[11px] text-primary-foreground/80">{todos.length} equipamentos · {formatBRL(totalGeral)}/mês terceiros</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Carregando...</p>
        ) : step === "lista" ? (
          <PainelLista titulo={tituloLista} items={itensFiltrados} onVoltar={voltarStep} />
        ) : step === "subtipo" ? (
          /* Subtipos do tipo selecionado */
          <div className="space-y-4">
            <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", borderRadius: 20, padding: "24px", color: "white", marginBottom: 8 }}>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 20 }}>{TIPO_INFO[tipoSel]?.label}</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>Selecione o subtipo</p>
            </div>
            {/* Ver todos */}
            <button onClick={() => { setSubtipoSel(""); setStep("lista"); }}
              style={{ width: "100%", background: "white", border: "2px solid #e5e7eb", borderRadius: 16, padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: TIPO_INFO[tipoSel]?.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {TIPO_INFO[tipoSel]?.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 15, color: "#0A0F2C" }}>Todos</p>
                <p style={{ fontSize: 12, color: "#9ca3af" }}>{todos.filter(e => e.tipo_veiculo === tipoSel).length} equipamentos</p>
              </div>
              <ChevronRight className="w-5 h-5" style={{ color: "#d1d5db" }} />
            </button>
            {TIPO_SUBTIPOS[tipoSel]?.map(sub => {
              const count = todos.filter(e => e.tipo_veiculo === tipoSel && (e.modelo || "").toUpperCase().includes(sub.toUpperCase())).length;
              if (count === 0) return null;
              const custo = todos.filter(e => e.tipo_veiculo === tipoSel && (e.modelo || "").toUpperCase().includes(sub.toUpperCase()) && e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);
              return (
                <button key={sub} onClick={() => { setSubtipoSel(sub); setStep("lista"); }}
                  style={{ width: "100%", background: "white", border: "2px solid #e5e7eb", borderRadius: 16, padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: TIPO_INFO[tipoSel]?.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {TIPO_INFO[tipoSel]?.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 15, color: "#0A0F2C" }}>{sub}</p>
                    <p style={{ fontSize: 12, color: "#9ca3af" }}>
                      {count} equipamento{count !== 1 ? "s" : ""}
                      {custo > 0 && <span style={{ color: "#f97316" }}> · {formatBRL(custo)}/mês</span>}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5" style={{ color: "#d1d5db" }} />
                </button>
              );
            })}
          </div>
        ) : (
          /* Tela inicial — escolha entre Equipe ou Tipo */
          <div className="space-y-6">

            {/* Resumo geral estilo PowerBI */}
            <div style={{ background: "linear-gradient(135deg, #0A0F2C 0%, #0D1B4B 60%, #0A2560 100%)", borderRadius: 24, padding: "32px", color: "white" }}>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 24, marginBottom: 4 }}>Gestão de Frotas</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>Visão consolidada de todos os equipamentos</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 16 }}>
                {[
                  { label: "Total", value: todos.length, color: "#00C6FF" },
                  { label: "Terceiros", value: todos.filter(e => e.categoria === "locado").length, color: "#FFB300" },
                  { label: "Próprios", value: todos.filter(e => e.categoria === "proprio").length, color: "#22c55e" },
                  { label: "Custo/mês", value: formatBRL(totalGeral), color: "#f97316", small: true },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 8px" }}>
                    <p style={{ fontSize: item.small ? 18 : 32, fontWeight: 900, color: item.color, fontFamily: "Montserrat" }}>{item.value}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões de modo — grandes, impactantes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={() => setModo(modo === "equipe" ? "inicio" : "equipe")}
                style={{ background: modo === "equipe" ? "linear-gradient(135deg, #0A0F2C, #0066CC)" : "white", border: modo === "equipe" ? "none" : "2px solid #e5e7eb", borderRadius: 20, padding: "24px 16px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transition: "all 0.2s" }}>
                <Users style={{ width: 32, height: 32, margin: "0 auto 8px", color: modo === "equipe" ? "#00C6FF" : "#0066CC" }} />
                <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: modo === "equipe" ? "white" : "#0A0F2C" }}>Por Equipe</p>
                <p style={{ fontSize: 11, color: modo === "equipe" ? "rgba(255,255,255,0.6)" : "#9ca3af", marginTop: 2 }}>{equipes.length} equipes</p>
              </button>
              <button onClick={() => setModo(modo === "tipo" ? "inicio" : "tipo")}
                style={{ background: modo === "tipo" ? "linear-gradient(135deg, #0A0F2C, #CC4400)" : "white", border: modo === "tipo" ? "none" : "2px solid #e5e7eb", borderRadius: 20, padding: "24px 16px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", transition: "all 0.2s" }}>
                <Wrench style={{ width: 32, height: 32, margin: "0 auto 8px", color: modo === "tipo" ? "#FFB300" : "#CC4400" }} />
                <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: modo === "tipo" ? "white" : "#0A0F2C" }}>Por Tipo</p>
                <p style={{ fontSize: 11, color: modo === "tipo" ? "rgba(255,255,255,0.6)" : "#9ca3af", marginTop: 2 }}>{tipos.length} tipos</p>
              </button>
            </div>

            {/* Lista de equipes ou tipos */}
            {modo === "equipe" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {equipes.map(eq => {
                  const itens = todos.filter(e => e.setor === eq);
                  const custo = itens.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);
                  const terceiros = itens.filter(e => e.categoria === "locado").length;
                  return (
                    <button key={eq} onClick={() => { setEquipeSel(eq); setStep("lista"); }}
                      style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 20, padding: "20px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "#00C6FF")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,102,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Users style={{ width: 22, height: 22, color: "#0066CC" }} />
                        </div>
                        <div>
                          <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: "#0A0F2C" }}>{eq}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{itens.length} equipamentos</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1, background: "#f0f9ff", borderRadius: 10, padding: "8px", textAlign: "center" }}>
                          <p style={{ fontSize: 16, fontWeight: 800, color: "#0066CC" }}>{terceiros}</p>
                          <p style={{ fontSize: 10, color: "#9ca3af" }}>Terceiros</p>
                        </div>
                        {custo > 0 && (
                          <div style={{ flex: 2, background: "#fff7ed", borderRadius: 10, padding: "8px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: "#f97316" }}>{formatBRL(custo)}</p>
                            <p style={{ fontSize: 10, color: "#9ca3af" }}>por mês</p>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {modo === "tipo" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {tipos.map(tp => {
                  const info = TIPO_INFO[tp] || { label: tp, emoji: "🔧", color: "#444", bg: "rgba(68,68,68,0.08)" };
                  const itens = todos.filter(e => e.tipo_veiculo === tp);
                  const custo = itens.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);
                  const temSubtipos = (TIPO_SUBTIPOS[tp] || []).length > 0;
                  return (
                    <button key={tp} onClick={() => {
                      setTipoSel(tp);
                      if (temSubtipos) setStep("subtipo");
                      else setStep("lista");
                    }}
                      style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 20, padding: "20px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = info.color)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: info.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                          {info.emoji}
                        </div>
                        <div>
                          <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: "#0A0F2C" }}>{info.label}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{itens.length} equipamentos{temSubtipos ? " · ver subtipos →" : ""}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1, background: info.bg, borderRadius: 10, padding: "8px", textAlign: "center" }}>
                          <p style={{ fontSize: 16, fontWeight: 800, color: info.color }}>{itens.length}</p>
                          <p style={{ fontSize: 10, color: "#9ca3af" }}>Total</p>
                        </div>
                        {custo > 0 && (
                          <div style={{ flex: 2, background: "#fff7ed", borderRadius: 10, padding: "8px", textAlign: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: "#f97316" }}>{formatBRL(custo)}</p>
                            <p style={{ fontSize: 10, color: "#9ca3af" }}>por mês</p>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
