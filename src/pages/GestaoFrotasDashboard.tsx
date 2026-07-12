import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, Wrench, AlertTriangle, TrendingUp, Package } from "lucide-react";
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

// Normaliza o status para comparação uniforme
function getStatusNorm(e: Equip): "operacional" | "manutencao" | "inativo" | "disposicao" {
  const s = (e.status || "").toLowerCase().replace(/[_\s]/g, "");
  const setor = (e.setor || "").toLowerCase();
  if (s.includes("manut") || setor.includes("manutenção") || setor === "manutenção") return "manutencao";
  if (s.includes("inativo") || s.includes("inativo") || s.includes("inoperante")) return "inativo";
  if (setor.includes("disposição") || setor.includes("disposicao") || setor === "disposição") return "disposicao";
  return "operacional";
}

// Detecta se é TERCEIRO
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

// Tipos agrupados para os chips (mesma lógica do GestaoFrotasHome)
const GRUPOS_CHIP: { key: string; label: string; tipos: string[] }[] = [
  { key: "caminhao",    label: "Caminhões",       tipos: ["CAMINHÃO BASCULANTE","CAMINHÃO CARROCERIA","CAMINHÃO COMBOIO","CAMINHÃO ESPARGIDOR","CAMINHÃO PIPA","CAMINHÃO PLATAFORMA"] },
  { key: "carreta",     label: "Carretas/Cavalo",  tipos: ["CARRETA CM","CAVALO MECANICO","PRANCHA REBOQUE"] },
  { key: "van",         label: "Vans/Micro",       tipos: ["VAN","MICROÔNIBUS","MICROONIBUS"] },
];

function tipoParaChipKey(tipo: string): string {
  const t = tipo.toUpperCase();
  for (const g of GRUPOS_CHIP) {
    if (g.tipos.some(gt => gt.toUpperCase() === t)) return g.key;
  }
  return tipo; // individual
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({ valor, label, cor, bg }: { valor: string | number; label: string; cor: string; bg: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 14, padding: "14px 18px", flex: 1, minWidth: 100, textAlign: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    }}>
      <p style={{ fontSize: typeof valor === "number" && valor > 999 ? 16 : 26, fontWeight: 900, color: cor, fontFamily: "Montserrat, sans-serif", lineHeight: 1 }}>{valor}</p>
      <p style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>{label}</p>
    </div>
  );
}

// ─── CHIP DE FILTRO ───────────────────────────────────────────────────────────
function Chip({ label, count, ativo, cor, onClick }: { label: string; count: number; ativo: boolean; cor: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
        border: ativo ? `2px solid ${cor}` : "2px solid #e5e7eb",
        background: ativo ? cor : "white",
        color: ativo ? "white" : "#374151",
        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        boxShadow: ativo ? `0 4px 12px ${cor}40` : "0 1px 4px rgba(0,0,0,0.08)",
        transition: "all 0.15s",
      }}
    >
      <span>{label}</span>
      <span style={{
        background: ativo ? "rgba(255,255,255,0.25)" : "#f1f5f9",
        color: ativo ? "white" : "#6b7280",
        borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800
      }}>{count}</span>
    </button>
  );
}

// ─── TABELA DE EQUIPAMENTOS ───────────────────────────────────────────────────
function TabelaEquipamentos({ items, corDestaque }: { items: Equip[]; corDestaque: string }) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 14 }}>
        Nenhum equipamento encontrado.
      </div>
    );
  }

  // Agrupar manutenção no topo
  const sorted = [...items].sort((a, b) => {
    const sa = getStatusNorm(a); const sb = getStatusNorm(b);
    if (sa === "manutencao" && sb !== "manutencao") return -1;
    if (sb === "manutencao" && sa !== "manutencao") return 1;
    return (a.tipo || "").localeCompare(b.tipo || "");
  });

  return (
    <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 100px 1fr 130px 90px 120px 110px",
        background: "#f8fafc", borderBottom: "2px solid #e5e7eb",
        padding: "10px 16px", gap: 8,
      }}>
        {["Frota", "Tipo", "Equipe / Responsável", "Empresa", "Status", "Situação", "Valor/mês"].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
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
            gridTemplateColumns: "90px 100px 1fr 130px 90px 120px 110px",
            padding: "11px 16px", gap: 8,
            borderBottom: "1px solid #f1f5f9",
            background: isManut ? "#fffbeb" : (i % 2 === 0 ? "white" : "#fafbfc"),
            borderLeft: isManut ? `4px solid #f59e0b` : `4px solid transparent`,
          }}>
            {/* Frota */}
            <div>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: "#0A0F2C" }}>
                {e.frota || e.placa || "—"}
              </span>
              {e.placa && e.placa !== e.frota && (
                <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{e.placa}</p>
              )}
            </div>

            {/* Tipo */}
            <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, lineHeight: 1.3 }}>
              {e.tipo || e.nome || "—"}
            </span>

            {/* Equipe / Responsável */}
            <div>
              <p style={{ fontSize: 12, color: "#1e3a5f", fontWeight: 600 }}>{e.setor || "—"}</p>
              {e.condutor_atual && (
                <p style={{ fontSize: 11, color: "#9ca3af" }}>👤 {e.condutor_atual}</p>
              )}
            </div>

            {/* Empresa */}
            <span style={{ fontSize: 12, color: terceiro ? "#1d4ed8" : "#166534", fontWeight: 600 }}>
              {empresa}
            </span>

            {/* Status badge */}
            <div>
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

            {/* Situação */}
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: terceiro ? "#1d4ed8" : "#166534",
              background: terceiro ? "#eff6ff" : "#f0fdf4",
              padding: "3px 10px", borderRadius: 20, display: "inline-block", textAlign: "center"
            }}>
              {terceiro ? "Terceiro" : "Próprio"}
            </span>

            {/* Valor */}
            <span style={{
              fontSize: 12, fontWeight: e.valor_mensal > 0 ? 700 : 400,
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

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function GestaoFrotasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Equip[]>([]);
  const [loading, setLoading] = useState(true);

  // Modo de visualização
  const [modoVis, setModoVis] = useState<"tipo" | "equipe">("tipo");

  // Chip selecionado (key do grupo/tipo ou nome da equipe)
  const [chipSel, setChipSel] = useState<string>("todos");

  // Filtro de status
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "operacional" | "manutencao" | "terceiro">("todos");

  // Busca
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

  // ── KPIs globais ────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = todos.length;
    const terceiros = todos.filter(isTerceiro).length;
    const proprios = total - terceiros;
    const manutencao = todos.filter(e => getStatusNorm(e) === "manutencao").length;
    const custoMensal = todos.filter(isTerceiro).reduce((s, e) => s + (e.valor_mensal || 0), 0);
    return { total, terceiros, proprios, manutencao, custoMensal };
  }, [todos]);

  // ── Chips de tipo (agrupado) ─────────────────────────────────────────────────
  const chipsDoTipo = useMemo(() => {
    const chipMap: Record<string, { label: string; key: string; count: number; cor: string }> = {};

    // Grupos
    for (const g of GRUPOS_CHIP) {
      const count = todos.filter(e => g.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase())).length;
      if (count > 0) chipMap[g.key] = { label: g.label, key: g.key, count, cor: "#0055AA" };
    }

    // Individuais (não em grupo)
    const tiposNoGrupo = GRUPOS_CHIP.flatMap(g => g.tipos.map(t => t.toUpperCase()));
    const tiposIndividuais = [...new Set(
      todos.map(e => (e.tipo || "").toUpperCase()).filter(t => t && !tiposNoGrupo.includes(t))
    )].sort();

    for (const tipo of tiposIndividuais) {
      const count = todos.filter(e => (e.tipo || "").toUpperCase() === tipo).length;
      if (count > 0) chipMap[tipo] = { label: tipo.charAt(0) + tipo.slice(1).toLowerCase(), key: tipo, count, cor: "#6b21a8" };
    }

    return Object.values(chipMap);
  }, [todos]);

  // ── Chips de equipe ──────────────────────────────────────────────────────────
  const chipsDeEquipe = useMemo(() => {
    const equipes = [...new Set(todos.map(e => e.setor).filter(Boolean))].sort();
    return equipes.map(eq => ({
      key: eq,
      label: eq,
      count: todos.filter(e => e.setor === eq).length,
      cor: "#0055AA",
    }));
  }, [todos]);

  // ── Lista filtrada final ─────────────────────────────────────────────────────
  const listaFiltrada = useMemo(() => {
    let lista = todos;

    // Filtro de chip
    if (chipSel !== "todos") {
      if (modoVis === "tipo") {
        const grupo = GRUPOS_CHIP.find(g => g.key === chipSel);
        if (grupo) {
          lista = lista.filter(e => grupo.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase()));
        } else {
          lista = lista.filter(e => (e.tipo || "").toUpperCase() === chipSel.toUpperCase());
        }
      } else {
        lista = lista.filter(e => e.setor === chipSel);
      }
    }

    // Filtro de status
    if (filtroStatus === "manutencao") lista = lista.filter(e => getStatusNorm(e) === "manutencao");
    else if (filtroStatus === "operacional") lista = lista.filter(e => getStatusNorm(e) === "operacional");
    else if (filtroStatus === "terceiro") lista = lista.filter(isTerceiro);

    // Busca
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(e =>
        [e.frota, e.placa, e.tipo, e.nome, e.modelo_completo, e.setor, e.condutor_atual, e.empresa_proprietaria, e.locadora, e.observacoes]
          .some(f => f?.toLowerCase().includes(b))
      );
    }

    return lista;
  }, [todos, chipSel, modoVis, filtroStatus, busca]);

  // KPIs da seleção atual
  const kpiSel = useMemo(() => {
    const terceiros = listaFiltrada.filter(isTerceiro);
    const custo = terceiros.reduce((s, e) => s + (e.valor_mensal || 0), 0);
    const manut = listaFiltrada.filter(e => getStatusNorm(e) === "manutencao").length;
    return { total: listaFiltrada.length, terceiros: terceiros.length, custo, manut };
  }, [listaFiltrada]);

  const chips = modoVis === "tipo" ? chipsDoTipo : chipsDeEquipe;

  // Reset chip ao trocar modo
  function trocarModo(m: "tipo" | "equipe") {
    setModoVis(m);
    setChipSel("todos");
    setBusca("");
    setFiltroStatus("todos");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, sans-serif" }}>

      {/* HEADER */}
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: "white" }}>
            Dashboard de Frotas — Reunião Semanal
          </span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            {todos.length} equipamentos · Terceiros: <strong>{formatBRL(kpis.custoMensal)}/mês</strong>
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── PAINEL DE KPIs ───────────────────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg, #0A0F2C, #0D2066)",
          borderRadius: 20, padding: "24px 28px", marginBottom: 20, color: "white"
        }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>
            Gestão de Frotas — Visão Geral
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 20 }}>
            Selecione o modo de visualização e filtre pelos botões abaixo
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <KpiCard valor={kpis.total}                   label="Total Equipamentos" cor="#00C6FF" bg="rgba(255,255,255,0.09)" />
            <KpiCard valor={kpis.proprios}                label="Próprios"           cor="#22c55e" bg="rgba(255,255,255,0.09)" />
            <KpiCard valor={kpis.terceiros}               label="Terceiros"          cor="#f59e0b" bg="rgba(255,255,255,0.09)" />
            <KpiCard valor={kpis.manutencao}              label="Em Manutenção"      cor="#f97316" bg="rgba(255,255,255,0.09)" />
            <KpiCard valor={formatBRL(kpis.custoMensal)}  label="Custo Mensal"       cor="#f97316" bg="rgba(255,255,255,0.09)" />
          </div>
        </div>

        {/* ── ABAS TIPO / EQUIPE ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => trocarModo("tipo")}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12,
              fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none",
              background: modoVis === "tipo" ? "#0055AA" : "white",
              color: modoVis === "tipo" ? "white" : "#374151",
              boxShadow: modoVis === "tipo" ? "0 4px 14px rgba(0,85,170,0.3)" : "0 1px 4px rgba(0,0,0,0.1)",
            }}
          >
            <Wrench size={15} /> Por Tipo de Equipamento
          </button>
          <button
            onClick={() => trocarModo("equipe")}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12,
              fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none",
              background: modoVis === "equipe" ? "#0055AA" : "white",
              color: modoVis === "equipe" ? "white" : "#374151",
              boxShadow: modoVis === "equipe" ? "0 4px 14px rgba(0,85,170,0.3)" : "0 1px 4px rgba(0,0,0,0.1)",
            }}
          >
            <Users size={15} /> Por Equipe
          </button>
        </div>

        {/* ── CHIPS DE FILTRO ──────────────────────────────────────────────────── */}
        <div style={{
          background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 14,
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)"
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {modoVis === "tipo" ? "Tipo de Equipamento" : "Equipe"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Chip
              label="Todos"
              count={todos.length}
              ativo={chipSel === "todos"}
              cor="#374151"
              onClick={() => setChipSel("todos")}
            />
            {chips.map(c => (
              <Chip
                key={c.key}
                label={c.label}
                count={c.count}
                ativo={chipSel === c.key}
                cor={c.cor}
                onClick={() => setChipSel(c.key)}
              />
            ))}
          </div>
        </div>

        {/* ── BARRA DE BUSCA + FILTROS DE STATUS ──────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Busca */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
            <input
              placeholder="Buscar frota, placa, tipo, equipe, empresa..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 38, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box", background: "white" }}
            />
          </div>

          {/* Filtros rápidos */}
          {[
            { key: "todos",       label: "Todos",        cor: "#374151" },
            { key: "operacional", label: "Operacional",  cor: "#166534" },
            { key: "manutencao",  label: "Manutenção ⚠️", cor: "#92400e" },
            { key: "terceiro",    label: "Locados 💰",    cor: "#1d4ed8" },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key as any)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid",
                borderColor: filtroStatus === f.key ? f.cor : "#e5e7eb",
                background: filtroStatus === f.key ? f.cor : "white",
                color: filtroStatus === f.key ? "white" : "#374151",
              }}>
              {f.label}
            </button>
          ))}

          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
            {kpiSel.total} itens
          </span>
        </div>

        {/* ── MINI KPIs DA SELEÇÃO ─────────────────────────────────────────────── */}
        {chipSel !== "todos" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Total", valor: kpiSel.total, cor: "#0055AA", bg: "#eff6ff" },
              { label: "Terceiros", valor: kpiSel.terceiros, cor: "#d97706", bg: "#fef3c7" },
              { label: "Manutenção", valor: kpiSel.manut, cor: "#b45309", bg: "#fef9c3" },
              ...(kpiSel.custo > 0 ? [{ label: "Custo/mês", valor: formatBRL(kpiSel.custo), cor: "#ea580c", bg: "#fff7ed" }] : []),
            ].map(k => (
              <div key={k.label} style={{
                background: k.bg, borderRadius: 10, padding: "8px 16px",
                display: "flex", alignItems: "center", gap: 8
              }}>
                <span style={{ fontWeight: 900, fontSize: 16, color: k.cor }}>{k.valor}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{k.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── TABELA ──────────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "#9ca3af" }}>Carregando...</div>
        ) : (
          <TabelaEquipamentos items={listaFiltrada} corDestaque="#0055AA" />
        )}

        {/* ── RODAPÉ: RESUMO DE LOCADOS ────────────────────────────────────────── */}
        {filtroStatus !== "manutencao" && kpiSel.custo > 0 && (
          <div style={{
            marginTop: 16, background: "white", borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)"
          }}>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} color="#ea580c" /> Resumo por Empresa (locados na seleção)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(
                listaFiltrada
                  .filter(isTerceiro)
                  .reduce<Record<string, { count: number; custo: number }>>((acc, e) => {
                    const emp = e.empresa_proprietaria || e.locadora || "Sem empresa";
                    if (!acc[emp]) acc[emp] = { count: 0, custo: 0 };
                    acc[emp].count++;
                    acc[emp].custo += (e.valor_mensal || 0);
                    return acc;
                  }, {})
              )
                .sort((a, b) => b[1].custo - a[1].custo)
                .map(([emp, data]) => (
                  <div key={emp} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Package size={13} color="#9ca3af" />
                      <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{emp}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{data.count} equip.</span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#ea580c" }}>{formatBRL(data.custo)}/mês</span>
                  </div>
                ))}
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                <span style={{ fontWeight: 900, fontSize: 15, color: "#ea580c" }}>
                  Total: {formatBRL(kpiSel.custo)}/mês
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
