import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, Wrench, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Equip {
  id: string;
  frota: string;
  placa: string;
  nome: string;
  modelo_completo: string;
  tipo: string;
  setor: string;
  condutor_atual: string;
  condicao: string;
  categoria: string;
  empresa_proprietaria: string;
  locadora: string;
  valor_mensal: number;
  status: string;
  observacoes: string;
  motivo_manutencao: string;
  previsao_liberacao: string;
}

function formatBRL(v: number) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function getStatusNorm(e: Equip): "operacional" | "manutencao" | "inativo" | "disposicao" {
  const s = (e.status || "").toLowerCase().replace(/[_\s]/g, "");
  const setor = (e.setor || "").toLowerCase();
  if (s.includes("manut") || setor.includes("manutenção") || setor === "manutenção") return "manutencao";
  if (s.includes("inativo") || s.includes("inoperante")) return "inativo";
  if (setor.includes("disposição") || setor.includes("disposicao") || setor === "disposição") return "disposicao";
  return "operacional";
}

function isTerceiro(e: Equip) {
  const c = (e.condicao || "").toUpperCase();
  const cat = (e.categoria || "").toLowerCase();
  return c === "TERCEIRO" || cat === "locado";
}

const STATUS_BADGE: Record<string, { bg: string; cor: string; label: string; dot: string }> = {
  operacional: { bg: "#dcfce7", cor: "#166534", label: "Operacional", dot: "#16a34a" },
  manutencao:  { bg: "#fef3c7", cor: "#92400e", label: "Manutenção",  dot: "#f59e0b" },
  inativo:     { bg: "#fee2e2", cor: "#991b1b", label: "Inativo",     dot: "#ef4444" },
  disposicao:  { bg: "#f1f5f9", cor: "#475569", label: "Disposição",  dot: "#94a3b8" },
};

const GRUPOS_CHIP: { key: string; label: string; tipos: string[] }[] = [
  { key: "caminhao",  label: "Caminhões",      tipos: ["CAMINHÃO BASCULANTE","CAMINHÃO CARROCERIA","CAMINHÃO COMBOIO","CAMINHÃO ESPARGIDOR","CAMINHÃO PIPA","CAMINHÃO PLATAFORMA"] },
  { key: "carreta",   label: "Carretas/Cavalo", tipos: ["CARRETA CM","CAVALO MECANICO","PRANCHA REBOQUE"] },
  { key: "van",       label: "Vans/Micro",      tipos: ["VAN","MICROÔNIBUS","MICROONIBUS"] },
];

// ─── TABELA ────────────────────────────────────────────────────────────────────
function TabelaEquipamentos({ items }: { items: Equip[] }) {
  const sorted = useMemo(() => [...items].sort((a, b) => {
    const sa = getStatusNorm(a); const sb = getStatusNorm(b);
    if (sa === "manutencao" && sb !== "manutencao") return -1;
    if (sb === "manutencao" && sa !== "manutencao") return 1;
    return (a.tipo || "").localeCompare(b.tipo || "");
  }), [items]);

  if (items.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 15 }}>Nenhum equipamento encontrado.</div>;
  }

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "88px 140px 1fr 140px 90px 110px 110px",
        background: "#f1f5f9", borderBottom: "2px solid #e2e8f0",
        padding: "9px 16px", gap: 8,
      }}>
        {["Frota", "Tipo", "Equipe / Responsável", "Empresa", "Status", "Situação", "Valor/mês"].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
        ))}
      </div>

      {/* Linhas */}
      {sorted.map((e, i) => {
        const st = getStatusNorm(e);
        const badge = STATUS_BADGE[st];
        const terceiro = isTerceiro(e);
        const empresa = e.empresa_proprietaria || e.locadora || (terceiro ? "Terceiro" : "—");
        const isManut = st === "manutencao";

        return (
          <div key={e.id} style={{
            display: "grid",
            gridTemplateColumns: "88px 140px 1fr 140px 90px 110px 110px",
            padding: "10px 16px", gap: 8,
            borderBottom: "1px solid #f8fafc",
            background: isManut ? "#fffbeb" : (i % 2 === 0 ? "white" : "#fafbfc"),
            borderLeft: isManut ? "4px solid #f59e0b" : "4px solid transparent",
          }}>
            <div>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#0A0F2C" }}>
                {e.frota || e.placa || "—"}
              </span>
              {e.placa && e.placa !== e.frota && (
                <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{e.placa}</p>
              )}
            </div>

            <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, lineHeight: 1.3, alignSelf: "center" }}>
              {e.tipo || e.nome || "—"}
            </span>

            <div style={{ alignSelf: "center" }}>
              <p style={{ fontSize: 12, color: "#1e3a5f", fontWeight: 600 }}>{e.setor || "—"}</p>
              {e.condutor_atual && (
                <p style={{ fontSize: 11, color: "#9ca3af" }}>👤 {e.condutor_atual}</p>
              )}
            </div>

            <span style={{ fontSize: 12, color: terceiro ? "#1d4ed8" : "#166534", fontWeight: 600, alignSelf: "center" }}>
              {empresa}
            </span>

            <div style={{ alignSelf: "center" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.cor,
                padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, display: "inline-block" }} />
                {badge.label}
              </span>
              {isManut && e.motivo_manutencao && (
                <p style={{ fontSize: 10, color: "#92400e", marginTop: 3 }}>⚠️ {e.motivo_manutencao}</p>
              )}
              {isManut && e.previsao_liberacao && (
                <p style={{ fontSize: 10, color: "#1d4ed8", marginTop: 1 }}>📅 {fmtDate(e.previsao_liberacao)}</p>
              )}
            </div>

            <span style={{
              fontSize: 11, fontWeight: 700, alignSelf: "center",
              color: terceiro ? "#1d4ed8" : "#166534",
              background: terceiro ? "#eff6ff" : "#f0fdf4",
              padding: "3px 10px", borderRadius: 20, display: "inline-block", textAlign: "center"
            }}>
              {terceiro ? "Terceiro" : "Próprio"}
            </span>

            <span style={{
              fontSize: 12, fontWeight: e.valor_mensal > 0 ? 700 : 400, alignSelf: "center",
              color: e.valor_mensal > 0 ? "#ea580c" : "#9ca3af"
            }}>
              {formatBRL(e.valor_mensal)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function GestaoFrotasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Equip[]>([]);
  const [loading, setLoading] = useState(true);

  const [modoVis, setModoVis] = useState<"tipo" | "equipe">("tipo");
  const [chipSel, setChipSel] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "operacional" | "manutencao" | "terceiro">("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (supabase as any)
      .from("equipamentos")
      .select("*")
      .order("tipo,frota")
      .then(({ data }: any) => {
        if (data) setTodos(data);
        setLoading(false);
      });
  }, []);

  // KPIs globais
  const kpis = useMemo(() => {
    const terceiros = todos.filter(isTerceiro).length;
    const manutencao = todos.filter(e => getStatusNorm(e) === "manutencao").length;
    const custoMensal = todos.filter(isTerceiro).reduce((s, e) => s + (e.valor_mensal || 0), 0);
    return { total: todos.length, terceiros, proprios: todos.length - terceiros, manutencao, custoMensal };
  }, [todos]);

  // Chips de tipo
  const chipsDoTipo = useMemo(() => {
    const chips: { key: string; label: string; count: number }[] = [];
    const tiposNoGrupo = GRUPOS_CHIP.flatMap(g => g.tipos.map(t => t.toUpperCase()));

    for (const g of GRUPOS_CHIP) {
      const count = todos.filter(e => g.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase())).length;
      if (count > 0) chips.push({ key: g.key, label: g.label, count });
    }
    const tiposIndiv = [...new Set(
      todos.map(e => (e.tipo || "").toUpperCase()).filter(t => t && !tiposNoGrupo.includes(t))
    )].sort();
    for (const tipo of tiposIndiv) {
      const count = todos.filter(e => (e.tipo || "").toUpperCase() === tipo).length;
      if (count > 0) chips.push({ key: tipo, label: tipo.charAt(0) + tipo.slice(1).toLowerCase(), count });
    }
    return chips;
  }, [todos]);

  // Chips de equipe
  const chipsDeEquipe = useMemo(() => {
    return [...new Set(todos.map(e => e.setor).filter(Boolean))]
      .sort()
      .map(eq => ({ key: eq, label: eq, count: todos.filter(e => e.setor === eq).length }));
  }, [todos]);

  // Lista filtrada
  const listaFiltrada = useMemo(() => {
    let lista = todos;
    if (chipSel !== "todos") {
      if (modoVis === "tipo") {
        const grupo = GRUPOS_CHIP.find(g => g.key === chipSel);
        if (grupo) lista = lista.filter(e => grupo.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase()));
        else lista = lista.filter(e => (e.tipo || "").toUpperCase() === chipSel.toUpperCase());
      } else {
        lista = lista.filter(e => e.setor === chipSel);
      }
    }
    if (filtroStatus === "manutencao") lista = lista.filter(e => getStatusNorm(e) === "manutencao");
    else if (filtroStatus === "operacional") lista = lista.filter(e => getStatusNorm(e) === "operacional");
    else if (filtroStatus === "terceiro") lista = lista.filter(isTerceiro);
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(e =>
        [e.frota, e.placa, e.tipo, e.nome, e.setor, e.condutor_atual, e.empresa_proprietaria, e.locadora]
          .some(f => f?.toLowerCase().includes(b))
      );
    }
    return lista;
  }, [todos, chipSel, modoVis, filtroStatus, busca]);

  const kpiSel = useMemo(() => {
    const t = listaFiltrada.filter(isTerceiro);
    return {
      total: listaFiltrada.length,
      terceiros: t.length,
      custo: t.reduce((s, e) => s + (e.valor_mensal || 0), 0),
      manut: listaFiltrada.filter(e => getStatusNorm(e) === "manutencao").length,
    };
  }, [listaFiltrada]);

  const chips = modoVis === "tipo" ? chipsDoTipo : chipsDeEquipe;

  function trocarModo(m: "tipo" | "equipe") {
    setModoVis(m);
    setChipSel("todos");
    setBusca("");
    setFiltroStatus("todos");
  }

  // Label do chip atual
  const chipLabel = chipSel === "todos"
    ? (modoVis === "tipo" ? "Todos os Equipamentos" : "Todas as Equipes")
    : (chips.find(c => c.key === chipSel)?.label ?? chipSel);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER COMPACTO ────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-header-gradient shadow-md" style={{ flexShrink: 0 }}>
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-1.5 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: "white" }}>
            Dashboard de Frotas — Reunião Semanal
          </span>
          {/* KPIs inline no header */}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[
              { v: kpis.total,     label: "total",       cor: "#93c5fd" },
              { v: kpis.proprios,  label: "próprios",    cor: "#86efac" },
              { v: kpis.terceiros, label: "terceiros",   cor: "#fcd34d" },
              { v: kpis.manutencao,label: "manutenção",  cor: "#fb923c" },
            ].map(k => (
              <div key={k.label} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 18, color: k.cor }}>{k.v}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{k.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 16 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 14, color: "#fb923c" }}>{formatBRL(kpis.custoMensal)}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>locados/mês</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CORPO: SIDEBAR + CONTEÚDO ──────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ESQUERDA ─────────────────────────────────────────────────── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: "#1e293b",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* Toggle Tipo / Equipe */}
          <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {[
              { key: "tipo",   label: "Por Tipo",   icon: "⚙️" },
              { key: "equipe", label: "Por Equipe",  icon: "👥" },
            ].map(m => (
              <button key={m.key} onClick={() => trocarModo(m.key as "tipo" | "equipe")}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10, marginBottom: 6,
                  background: modoVis === m.key ? "#0055AA" : "rgba(255,255,255,0.06)",
                  border: "none", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 8,
                  color: modoVis === m.key ? "white" : "rgba(255,255,255,0.55)",
                  fontWeight: modoVis === m.key ? 700 : 500, fontSize: 13,
                  boxShadow: modoVis === m.key ? "0 3px 12px rgba(0,85,170,0.4)" : "none",
                  transition: "all 0.15s",
                }}>
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          {/* Chips de filtro */}
          <div style={{ padding: "10px 8px", flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, paddingLeft: 4 }}>
              {modoVis === "tipo" ? "Tipo" : "Equipe"}
            </p>

            {/* Todos */}
            <SideChip
              label="Todos"
              count={todos.length}
              ativo={chipSel === "todos"}
              manut={todos.filter(e => getStatusNorm(e) === "manutencao").length}
              onClick={() => setChipSel("todos")}
            />

            {chips.map(c => (
              <SideChip
                key={c.key}
                label={c.label}
                count={c.count}
                ativo={chipSel === c.key}
                manut={
                  modoVis === "tipo"
                    ? (() => {
                        const grupo = GRUPOS_CHIP.find(g => g.key === c.key);
                        return todos.filter(e =>
                          getStatusNorm(e) === "manutencao" && (
                            grupo
                              ? grupo.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase())
                              : (e.tipo || "").toUpperCase() === c.key.toUpperCase()
                          )
                        ).length;
                      })()
                    : todos.filter(e => e.setor === c.key && getStatusNorm(e) === "manutencao").length
                }
                onClick={() => setChipSel(c.key)}
              />
            ))}
          </div>

          {/* Legenda de status na parte de baixo */}
          <div style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Legenda</p>
            {[
              { dot: "#16a34a", label: "Operacional" },
              { dot: "#f59e0b", label: "Manutenção" },
              { dot: "#94a3b8", label: "Disposição" },
              { dot: "#ef4444", label: "Inativo" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── CONTEÚDO DIREITO ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

          {/* Título da seleção + mini KPIs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 18, color: "#0A0F2C", margin: 0 }}>
                {chipLabel}
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {kpiSel.total} equipamento{kpiSel.total !== 1 ? "s" : ""}
                {kpiSel.manut > 0 && <span style={{ color: "#b45309", fontWeight: 700 }}> · ⚠️ {kpiSel.manut} em manutenção</span>}
                {kpiSel.terceiros > 0 && <span style={{ color: "#1d4ed8", fontWeight: 600 }}> · {kpiSel.terceiros} terceiros</span>}
                {kpiSel.custo > 0 && <span style={{ color: "#ea580c", fontWeight: 700 }}> · {formatBRL(kpiSel.custo)}/mês</span>}
              </p>
            </div>

            {/* Filtros de status */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { key: "todos",       label: "Todos",       cor: "#374151", bg: "#f1f5f9" },
                { key: "operacional", label: "Operacional", cor: "#166534", bg: "#f0fdf4" },
                { key: "manutencao",  label: "Manutenção",  cor: "#92400e", bg: "#fef9c3" },
                { key: "terceiro",    label: "Locados",     cor: "#1d4ed8", bg: "#eff6ff" },
              ].map(f => (
                <button key={f.key} onClick={() => setFiltroStatus(f.key as any)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid",
                    borderColor: filtroStatus === f.key ? f.cor : "#e2e8f0",
                    background: filtroStatus === f.key ? f.cor : "white",
                    color: filtroStatus === f.key ? "white" : "#374151",
                    transition: "all 0.12s",
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
            <input
              placeholder="Buscar frota, placa, tipo, equipe, empresa..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: "100%", paddingLeft: 36, paddingRight: 12, height: 38,
                borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13,
                outline: "none", boxSizing: "border-box", background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            />
          </div>

          {/* Tabela */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af", fontSize: 15 }}>Carregando...</div>
          ) : (
            <TabelaEquipamentos items={listaFiltrada} />
          )}

          {/* Resumo por empresa (só quando tem terceiros na seleção) */}
          {!loading && kpiSel.custo > 0 && filtroStatus !== "operacional" && (
            <div style={{
              marginTop: 16, background: "white", borderRadius: 14, padding: "14px 18px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)"
            }}>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, color: "#0A0F2C" }}>
                <Package size={13} color="#ea580c" /> Locados por Empresa
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(
                  listaFiltrada.filter(isTerceiro).reduce<Record<string, { count: number; custo: number }>>((acc, e) => {
                    const emp = e.empresa_proprietaria || e.locadora || "Sem empresa";
                    if (!acc[emp]) acc[emp] = { count: 0, custo: 0 };
                    acc[emp].count++;
                    acc[emp].custo += (e.valor_mensal || 0);
                    return acc;
                  }, {})
                ).sort((a, b) => b[1].custo - a[1].custo).map(([emp, d]) => (
                  <div key={emp} style={{
                    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "8px 14px", display: "flex", flexDirection: "column", alignItems: "flex-start"
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>{emp}</span>
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{d.count} equip.</span>
                      {d.custo > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#ea580c" }}>{formatBRL(d.custo)}/mês</span>}
                    </div>
                  </div>
                ))}
                <div style={{
                  background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10,
                  padding: "8px 14px", display: "flex", flexDirection: "column", alignSelf: "center"
                }}>
                  <span style={{ fontSize: 10, color: "#9a3412", fontWeight: 700, textTransform: "uppercase" }}>Total</span>
                  <span style={{ fontWeight: 900, fontSize: 16, color: "#ea580c" }}>{formatBRL(kpiSel.custo)}/mês</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── CHIP LATERAL ─────────────────────────────────────────────────────────────
function SideChip({ label, count, ativo, manut, onClick }: {
  label: string; count: number; ativo: boolean; manut: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "8px 10px", borderRadius: 9, marginBottom: 4,
      background: ativo ? "#0055AA" : "rgba(255,255,255,0.04)",
      border: ativo ? "none" : "1px solid rgba(255,255,255,0.06)",
      cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "all 0.12s",
      boxShadow: ativo ? "0 2px 10px rgba(0,85,170,0.35)" : "none",
    }}>
      <span style={{
        fontSize: 12, fontWeight: ativo ? 700 : 500,
        color: ativo ? "white" : "rgba(255,255,255,0.65)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 6,
      }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
        {manut > 0 && (
          <span style={{ fontSize: 10, background: "#f59e0b", color: "white", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>
            ⚠️{manut}
          </span>
        )}
        <span style={{
          fontSize: 11, background: ativo ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
          color: ativo ? "white" : "rgba(255,255,255,0.45)",
          borderRadius: 20, padding: "1px 7px", fontWeight: 700
        }}>
          {count}
        </span>
      </div>
    </button>
  );
}
