import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, Users, Wrench, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  motivo_manutencao: string;
  previsao_liberacao: string;
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function formatBRL(v: number) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TIPO_SUBTIPOS: Record<string, string[]> = {
  caminhao: ["CAMINHÃO BASCULANTE", "CAMINHÃO CARROCERIA", "CAMINHÃO COMBOIO", "CAMINHÃO ESPARGIDOR", "CAMINHÃO PIPA", "CAMINHÃO PLATAFORMA"],
  carreta:  ["CARRETA", "CAVALO MECANICO", "PRANCHA REBOQUE"],
  maquina:  ["FRESADORA", "BOBCAT", "ROLO CHAPA", "ROLO PNEU", "ROLO PÉ DE CARNEIRO", "VIBRO ACABADORA", "USINA MÓVEL", "RETROESCAVADEIRA", "COMPRESSOR", "GERADOR", "SERRA CLIPER", "ROMPEDOR ELÉTRICO", "ROMPEDOR PNEUMATICO", "PLACA VIBRATÓRIA", "SAPO COMPACTADOR", "MISTURADOR DE ARGAMASSA", "COMPACTADOR DE SOLO", "DENSIMETRO", "PMV MÓVEL", "BANHEIRO QUÍMICO", "CARRETINHA BANHEIRO"],
};

const TIPO_INFO: Record<string, { label: string; emoji: string; cor: string }> = {
  caminhao:     { label: "Caminhões",      emoji: "🚛", cor: "#0055AA" },
  carreta:      { label: "Carretas",       emoji: "🚚", cor: "#005533" },
  maquina:      { label: "Máquinas",       emoji: "⚙️",  cor: "#AA3300" },
  veiculo_leve: { label: "Veículos Leves", emoji: "🚗", cor: "#5500AA" },
  utilitario:   { label: "Utilitários",    emoji: "🛻", cor: "#005566" },
  van:          { label: "Vans",           emoji: "🚐", cor: "#884400" },
  outro:        { label: "Outros",         emoji: "🔧", cor: "#555555" },
};

const STATUS_CONFIG: Record<string, { bg: string; cor: string; label: string }> = {
  ativo:          { bg: "#dcfce7", cor: "#166534", label: "Ativo" },
  inativo:        { bg: "#fee2e2", cor: "#991b1b", label: "Inativo" },
  em_manutencao:  { bg: "#fef9c3", cor: "#854d0e", label: "Manutenção" },
  devolvido:      { bg: "#f1f5f9", cor: "#64748b", label: "Devolvido" },
};

// ─── TABELA EXECUTIVA ─────────────────────────────────────────────────────────
function TabelaExecutiva({ titulo, subtitulo, items, corTema }: {
  titulo: string; subtitulo: string; items: Equipamento[]; corTema: string;
}) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const totalMensal = items.filter(i => i.categoria === "locado").reduce((s, i) => s + (i.valor_mensal || 0), 0);
  const emManutencao = items.filter(i => i.status === "em_manutencao").length;
  const terceiros = items.filter(i => i.categoria === "locado").length;

  const filtrados = items.filter(eq => {
    const bOk = !busca || [eq.codigo_custo, eq.placa, eq.modelo, eq.setor, eq.locadora, eq.observacoes]
      .some(f => f?.toLowerCase().includes(busca.toLowerCase()));
    const sOk = filtroStatus === "todos" || eq.status === filtroStatus;
    return bOk && sOk;
  });

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Cabeçalho executivo */}
      <div style={{
        background: `linear-gradient(135deg, #0A0F2C, ${corTema})`,
        borderRadius: 20, padding: "28px 32px", marginBottom: 20, color: "white"
      }}>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 26, marginBottom: 2 }}>{titulo}</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 20 }}>{subtitulo}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Total", value: items.length, cor: "#00C6FF" },
            { label: "Terceiros", value: terceiros, cor: "#FFB300" },
            { label: "Em Manutenção", value: emManutencao, cor: "#f97316" },
            ...(totalMensal > 0 ? [{ label: "Custo Mensal", value: formatBRL(totalMensal), cor: "#f97316" }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 20px", minWidth: 100, textAlign: "center" }}>
              <p style={{ fontSize: typeof s.value === "number" ? 28 : 18, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: "100%", paddingLeft: 30, paddingRight: 12, height: 36, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        {["todos", "ativo", "em_manutencao", "inativo"].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            style={{
              padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: filtroStatus === s ? corTema : "#f1f5f9",
              color: filtroStatus === s ? "white" : "#64748b",
            }}>
            {s === "todos" ? "Todos" : s === "ativo" ? "Ativos" : s === "em_manutencao" ? "Manutenção" : "Inativos"}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center", marginLeft: 4 }}>{filtrados.length} equipamentos</span>
      </div>

      {/* Tabela */}
      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.07)" }}>
        {/* Header da tabela */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 90px 120px 130px 110px 120px",
          background: "#f8fafc", borderBottom: "2px solid #e5e7eb",
          padding: "10px 16px", gap: 8,
        }}>
          {["Frota", "Modelo / Tipo", "Status", "Equipe", "Empresa", "Valor/mês", "Obs / Prev. Liberação"].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
          ))}
        </div>

        {/* Linhas */}
        {filtrados.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0", fontSize: 13 }}>Nenhum equipamento encontrado.</p>
        ) : (
          filtrados.map((eq, i) => {
            const st = STATUS_CONFIG[eq.status] || STATUS_CONFIG.ativo;
            const isManut = eq.status === "em_manutencao";
            return (
              <div key={eq.id} style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 90px 120px 130px 110px 120px",
                padding: "12px 16px", gap: 8,
                borderBottom: "1px solid #f1f5f9",
                background: i % 2 === 0 ? "white" : "#fafbfc",
                borderLeft: isManut ? "4px solid #f97316" : "4px solid transparent",
              }}>
                <span style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 13, color: "#0A0F2C" }}>
                  {eq.codigo_custo || eq.placa}
                </span>
                <div>
                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.3 }}>{eq.modelo}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: st.bg, color: st.cor, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{eq.setor || "—"}</span>
                <span style={{ fontSize: 12, color: eq.categoria === "locado" ? "#0055AA" : "#166534", fontWeight: 600 }}>
                  {eq.categoria === "locado" ? (eq.locadora || "Terceiro") : "Próprio"}
                </span>
                <span style={{ fontSize: 12, color: eq.valor_mensal > 0 ? "#f97316" : "#9ca3af", fontWeight: eq.valor_mensal > 0 ? 700 : 400 }}>
                  {formatBRL(eq.valor_mensal)}
                </span>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {isManut && eq.motivo_manutencao && (
                    <p style={{ color: "#b45309", marginBottom: 2 }}>⚠️ {eq.motivo_manutencao}</p>
                  )}
                  {isManut && eq.previsao_liberacao && (
                    <p style={{ color: "#0055AA" }}>📅 Prev: {fmtDate(eq.previsao_liberacao)}</p>
                  )}
                  {!isManut && eq.observacoes && <p>{eq.observacoes}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function GestaoFrotasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<"inicio" | "equipe_sel" | "tipo_sel" | "subtipo" | "lista">("inicio");
  const [equipeSel, setEquipeSel] = useState("");
  const [tipoSel, setTipoSel] = useState("");
  const [subtipoSel, setSubtipoSel] = useState("");

  useEffect(() => {
    supabase.from("frotas_gestao").select("*").order("setor,codigo_custo")
      .then(({ data }) => { if (data) setTodos(data); setLoading(false); });
  }, []);

  const equipes = [...new Set(todos.map(e => e.setor).filter(Boolean))].sort();
  const tipos = [...new Set(todos.map(e => e.tipo_veiculo).filter(Boolean))].sort();
  const totalGeral = todos.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);

  const itensFiltrados = (() => {
    if (modo === "lista") {
      if (equipeSel) return todos.filter(e => e.setor === equipeSel);
      if (subtipoSel) return todos.filter(e => e.tipo_veiculo === tipoSel && (e.modelo || "").toUpperCase().includes(subtipoSel.toUpperCase()));
      if (tipoSel) return todos.filter(e => e.tipo_veiculo === tipoSel);
    }
    return todos;
  })();

  const tituloLista = equipeSel ? equipeSel : (subtipoSel || TIPO_INFO[tipoSel]?.label || tipoSel);
  const corTema = equipeSel ? "#0055AA" : (TIPO_INFO[tipoSel]?.cor || "#0055AA");

  function voltar() {
    if (modo === "lista" && subtipoSel) { setSubtipoSel(""); setModo("subtipo"); }
    else if (modo === "lista") { setEquipeSel(""); setTipoSel(""); setModo("inicio"); }
    else if (modo === "subtipo") { setTipoSel(""); setModo("tipo_sel"); }
    else { setModo("inicio"); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={modo === "inicio" ? () => navigate("/gestao-frotas") : voltar}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: "white" }}>
            Dashboard de Frotas
          </span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            {todos.length} equipamentos · Terceiros: <strong>{formatBRL(totalGeral)}/mês</strong>
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>

        ) : modo === "lista" ? (
          <TabelaExecutiva
            titulo={tituloLista}
            subtitulo={equipeSel ? `Equipe · ${itensFiltrados.length} equipamentos` : `${TIPO_INFO[tipoSel]?.emoji || ""} Tipo de Equipamento`}
            items={itensFiltrados}
            corTema={corTema}
          />

        ) : modo === "subtipo" ? (
          <div>
            <div style={{ background: `linear-gradient(135deg, #0A0F2C, ${TIPO_INFO[tipoSel]?.cor})`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, color: "white" }}>
              <h2 style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 24 }}>{TIPO_INFO[tipoSel]?.label}</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>Selecione o subtipo</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { setSubtipoSel(""); setModo("lista"); }}
                style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 22 }}>{TIPO_INFO[tipoSel]?.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 14 }}>Todos — {TIPO_INFO[tipoSel]?.label}</p>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>{todos.filter(e => e.tipo_veiculo === tipoSel).length} equipamentos</p>
                </div>
                <ChevronLeft style={{ transform: "rotate(180deg)", color: "#d1d5db" }} />
              </button>
              {TIPO_SUBTIPOS[tipoSel]?.map(sub => {
                const count = todos.filter(e => e.tipo_veiculo === tipoSel && (e.modelo || "").toUpperCase().includes(sub.toUpperCase())).length;
                if (count === 0) return null;
                return (
                  <button key={sub} onClick={() => { setSubtipoSel(sub); setModo("lista"); }}
                    style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 22 }}>{TIPO_INFO[tipoSel]?.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 14 }}>{sub}</p>
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>{count} equipamentos</p>
                    </div>
                    <ChevronLeft style={{ transform: "rotate(180deg)", color: "#d1d5db" }} />
                  </button>
                );
              })}
            </div>
          </div>

        ) : (
          /* TELA INICIAL */
          <div>
            {/* Painel resumo */}
            <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", borderRadius: 24, padding: "32px", color: "white", marginBottom: 28 }}>
              <h2 style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 28, marginBottom: 4 }}>Gestão de Frotas</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 24 }}>Selecione uma visualização para a reunião de eficiência</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Total Equipamentos", value: todos.length, cor: "#00C6FF" },
                  { label: "Terceirizados", value: todos.filter(e => e.categoria === "locado").length, cor: "#FFB300" },
                  { label: "Próprios", value: todos.filter(e => e.categoria === "proprio").length, cor: "#22c55e" },
                  { label: "Em Manutenção", value: todos.filter(e => e.status === "em_manutencao").length, cor: "#f97316" },
                  { label: "Custo Mensal", value: formatBRL(totalGeral), cor: "#f97316" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 16, padding: "16px 20px", minWidth: 100, textAlign: "center", flex: 1 }}>
                    <p style={{ fontSize: typeof s.value === "number" ? 30 : 18, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Por Equipe */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16, color: "#0A0F2C", marginBottom: 12 }}>
                <Users style={{ display: "inline", width: 18, height: 18, marginRight: 6, color: "#0055AA" }} />
                Visualizar por Equipe
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {equipes.map(eq => {
                  const itens = todos.filter(e => e.setor === eq);
                  const custo = itens.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);
                  const manut = itens.filter(e => e.status === "em_manutencao").length;
                  return (
                    <button key={eq} onClick={() => { setEquipeSel(eq); setModo("lista"); }}
                      style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 16, padding: "18px 16px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#0055AA"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,85,170,0.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}>
                      <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 14, color: "#0A0F2C", marginBottom: 8 }}>{eq}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, background: "#eff6ff", color: "#0055AA", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>{itens.length} equip.</span>
                        {manut > 0 && <span style={{ fontSize: 11, background: "#fff7ed", color: "#c2410c", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>⚠️ {manut} manut.</span>}
                      </div>
                      {custo > 0 && <p style={{ fontSize: 12, color: "#f97316", fontWeight: 700, marginTop: 6 }}>{formatBRL(custo)}/mês</p>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Por Tipo */}
            <div>
              <h3 style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16, color: "#0A0F2C", marginBottom: 12 }}>
                <Wrench style={{ display: "inline", width: 18, height: 18, marginRight: 6, color: "#AA3300" }} />
                Visualizar por Tipo de Equipamento
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {tipos.map(tp => {
                  const info = TIPO_INFO[tp] || { label: tp, emoji: "🔧", cor: "#555" };
                  const itens = todos.filter(e => e.tipo_veiculo === tp);
                  const custo = itens.filter(e => e.categoria === "locado").reduce((s, e) => s + (e.valor_mensal || 0), 0);
                  const manut = itens.filter(e => e.status === "em_manutencao").length;
                  const temSub = (TIPO_SUBTIPOS[tp] || []).length > 0;
                  return (
                    <button key={tp} onClick={() => { setTipoSel(tp); setModo(temSub ? "subtipo" : "lista"); }}
                      style={{ background: "white", border: "2px solid #e5e7eb", borderRadius: 16, padding: "18px 16px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = info.cor; e.currentTarget.style.boxShadow = `0 4px 20px ${info.cor}22`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>{info.emoji}</span>
                        <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 13, color: "#0A0F2C" }}>{info.label}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, background: `${info.cor}18`, color: info.cor, padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>{itens.length} equip.</span>
                        {manut > 0 && <span style={{ fontSize: 11, background: "#fff7ed", color: "#c2410c", padding: "3px 8px", borderRadius: 20, fontWeight: 600 }}>⚠️ {manut}</span>}
                        {temSub && <span style={{ fontSize: 11, color: "#9ca3af" }}>ver subtipos →</span>}
                      </div>
                      {custo > 0 && <p style={{ fontSize: 12, color: "#f97316", fontWeight: 700, marginTop: 6 }}>{formatBRL(custo)}/mês</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
