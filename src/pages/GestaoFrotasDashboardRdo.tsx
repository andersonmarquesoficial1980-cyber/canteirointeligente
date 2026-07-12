import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, MapPin, Users, Wrench, CalendarDays, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface RdoRow {
  frota: string;
  tipo: string;
  encarregado: string | null;
  ogs: string | null;
  contratante: string | null;
  local: string | null;
  data: string;
  empresa: string | null;
  condicao: string | null;
}

interface EquipSemRdo {
  frota: string;
  tipo: string;
  setor: string | null;
  empresa: string | null;
  condicao: string | null;
  status: string | null;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hoje() {
  return new Date().toISOString().split("T")[0];
}

function inicioSemana() {
  const d = new Date();
  const dia = d.getDay(); // 0=dom, 1=seg...
  const seg = new Date(d);
  seg.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return seg.toISOString().split("T")[0];
}

function inicioSemanaPassada() {
  const d = new Date();
  const dia = d.getDay();
  const seg = new Date(d);
  seg.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1) - 7);
  return seg.toISOString().split("T")[0];
}

function fimSemanaPassada() {
  const d = new Date();
  const dia = d.getDay();
  const dom = new Date(d);
  dom.setDate(d.getDate() - (dia === 0 ? 0 : dia));
  return dom.toISOString().split("T")[0];
}

function inicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Grupos de tipo (mesmo padrão do dashboard de frotas)
const GRUPOS_CHIP: { key: string; label: string; tipos: string[] }[] = [
  { key: "caminhao",  label: "Caminhões",       tipos: ["CAMINHÃO BASCULANTE","CAMINHÃO CARROCERIA","CAMINHÃO COMBOIO","CAMINHÃO ESPARGIDOR","CAMINHÃO PIPA","CAMINHÃO PLATAFORMA"] },
  { key: "carreta",   label: "Carretas/Cavalo",  tipos: ["CARRETA CM","CAVALO MECANICO","PRANCHA REBOQUE"] },
  { key: "van",       label: "Vans/Micro",       tipos: ["VAN","MICROÔNIBUS","MICROONIBUS"] },
];

function tipoParaChipKey(tipo: string): string {
  const t = (tipo || "").toUpperCase();
  for (const g of GRUPOS_CHIP) {
    if (g.tipos.some(gt => gt.toUpperCase() === t)) return g.key;
  }
  return tipo;
}

// ─── CHIP LATERAL ─────────────────────────────────────────────────────────────
function SideChip({ label, count, ativo, onClick }: {
  label: string; count: number; ativo: boolean; onClick: () => void;
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
      }}>{label}</span>
      <span style={{
        fontSize: 11, background: ativo ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
        color: ativo ? "white" : "rgba(255,255,255,0.45)",
        borderRadius: 20, padding: "1px 7px", fontWeight: 700, flexShrink: 0,
      }}>{count}</span>
    </button>
  );
}

// ─── SUB-CHIP ─────────────────────────────────────────────────────────────────
function SubChip({ label, count, ativo, onClick }: {
  label: string; count: number; ativo: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "6px 10px", borderRadius: 9, marginBottom: 3,
      background: ativo ? "#1d4ed8" : "rgba(255,255,255,0.03)",
      border: ativo ? "none" : "1px solid rgba(255,255,255,0.05)",
      cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
      boxShadow: ativo ? "0 2px 8px rgba(29,78,216,0.35)" : "none",
    }}>
      <span style={{
        fontSize: 11, fontWeight: ativo ? 700 : 400,
        color: ativo ? "white" : "rgba(255,255,255,0.5)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 4,
      }}>↳ {label}</span>
      <span style={{
        fontSize: 10, background: ativo ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
        color: ativo ? "white" : "rgba(255,255,255,0.35)",
        borderRadius: 20, padding: "1px 6px", fontWeight: 700, flexShrink: 0,
      }}>{count}</span>
    </button>
  );
}

// ─── TABELA ────────────────────────────────────────────────────────────────────
function TabelaRdo({ rows, modoSnapshot }: { rows: RdoRow[]; modoSnapshot: boolean }) {
  if (rows.length === 0) {
    return <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 14 }}>Nenhum registro encontrado.</div>;
  }

  // Em snapshot: ordena por tipo depois frota
  // Em período: ordena por data desc depois frota
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    if (modoSnapshot) return (a.tipo || "").localeCompare(b.tipo || "") || (a.frota || "").localeCompare(b.frota || "");
    return b.data.localeCompare(a.data) || (a.frota || "").localeCompare(b.frota || "");
  }), [rows, modoSnapshot]);

  const cols = modoSnapshot
    ? "80px 150px 160px 110px 160px 150px 90px"
    : "80px 150px 80px 160px 110px 160px 150px";

  const headers = modoSnapshot
    ? ["Frota", "Tipo", "Encarregado", "OGS", "Contratante / Local", "Empresa", "Último RDO"]
    : ["Frota", "Tipo", "Data", "Encarregado", "OGS", "Contratante / Local", "Empresa"];

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <div style={{
        display: "grid", gridTemplateColumns: cols,
        background: "#f1f5f9", borderBottom: "2px solid #e2e8f0",
        padding: "9px 16px", gap: 8,
      }}>
        {headers.map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
        ))}
      </div>

      {sorted.map((r, i) => {
        const terceiro = (r.condicao || "").toUpperCase() === "TERCEIRO";
        const localLabel = [r.contratante, r.local].filter(Boolean).join(" · ") || "—";

        const cells = modoSnapshot
          ? [r.frota, r.tipo, r.encarregado, r.ogs, localLabel, r.empresa, fmtDate(r.data)]
          : [r.frota, r.tipo, fmtDate(r.data), r.encarregado, r.ogs, localLabel, r.empresa];

        return (
          <div key={`${r.frota}-${r.data}-${i}`} style={{
            display: "grid", gridTemplateColumns: cols,
            padding: "10px 16px", gap: 8,
            borderBottom: "1px solid #f8fafc",
            background: i % 2 === 0 ? "white" : "#fafbfc",
          }}>
            {/* Frota */}
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#0A0F2C", alignSelf: "center" }}>
              {cells[0] || "—"}
            </span>
            {/* Tipo */}
            <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, alignSelf: "center" }}>
              {cells[1] || "—"}
            </span>
            {/* Data (só em período) ou Encarregado (em snapshot) */}
            <span style={{ fontSize: 12, color: modoSnapshot ? "#1e3a5f" : "#64748b", fontWeight: modoSnapshot ? 600 : 400, alignSelf: "center" }}>
              {cells[2] || "—"}
            </span>
            {/* Encarregado (período) ou OGS (snapshot) */}
            <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600, alignSelf: "center" }}>
              {cells[3] || "—"}
            </span>
            {/* OGS (período) ou Contratante/Local (snapshot) */}
            <span style={{ fontSize: 11, color: "#374151", alignSelf: "center", lineHeight: 1.3 }}>
              {cells[4] || "—"}
            </span>
            {/* Contratante/Local (período) ou Empresa (snapshot) */}
            <span style={{ fontSize: 11, color: "#374151", alignSelf: "center", lineHeight: 1.3 }}>
              {cells[5] || "—"}
            </span>
            {/* Empresa (período) ou Último RDO (snapshot) */}
            <span style={{
              fontSize: modoSnapshot ? 11 : 12, fontWeight: modoSnapshot ? 400 : (terceiro ? 700 : 400),
              color: modoSnapshot ? "#64748b" : (terceiro ? "#1d4ed8" : "#166534"),
              alignSelf: "center"
            }}>
              {cells[6] || "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
type Periodo = "semana" | "semana_passada" | "mes" | "custom";
type ModoVis = "tipo" | "equipe";

export default function GestaoFrotasDashboardRdo() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  // Período — padrão: esta semana
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [dataIni, setDataIni] = useState(inicioSemana());
  const [dataFim, setDataFim] = useState(hoje());
  const [customIni, setCustomIni] = useState(inicioSemana());
  const [customFim, setCustomFim] = useState(hoje());

  // Snapshot vs período completo
  const [modoSnapshot, setModoSnapshot] = useState(true);
  const [mostraSemRdo, setMostraSemRdo] = useState(false);

  // Sidebar
  const [modoVis, setModoVis] = useState<ModoVis>("tipo");
  const [chipSel, setChipSel] = useState("todos");
  const [subChipSel, setSubChipSel] = useState("todos");

  // Busca
  const [busca, setBusca] = useState("");

  // Dados
  const [allRows, setAllRows] = useState<RdoRow[]>([]);
  const [equipSemRdo, setEquipSemRdo] = useState<EquipSemRdo[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState("");

  // Aplica período nos dates
  useEffect(() => {
    if (periodo === "semana") { setDataIni(inicioSemana()); setDataFim(hoje()); }
    else if (periodo === "semana_passada") { setDataIni(inicioSemanaPassada()); setDataFim(fimSemanaPassada()); }
    else if (periodo === "mes") { setDataIni(inicioMes()); setDataFim(hoje()); }
    else { setDataIni(customIni); setDataFim(customFim); }
  }, [periodo, customIni, customFim]);

  // Busca automática quando período muda e company_id disponível
  useEffect(() => {
    if (profile?.company_id && dataIni && dataFim) buscar();
  }, [dataIni, dataFim, profile?.company_id]);

  async function buscar() {
    if (!profile?.company_id) return;
    setLoading(true);

    try {
      // 1. RDOs do período
      const { data: rdos } = await (supabase as any)
        .from("rdo_diarios")
        .select("id, data, encarregado, obra_nome, preenchido_por")
        .eq("company_id", profile.company_id)
        .gte("data", dataIni)
        .lte("data", dataFim);

      if (!rdos || rdos.length === 0) { setAllRows([]); setLoading(false); return; }

      const rdoIds = rdos.map((r: any) => r.id);
      const rdoMap: Record<string, any> = {};
      rdos.forEach((r: any) => { rdoMap[r.id] = r; });

      // 2. Equipamentos dos RDOs
      const { data: equips } = await (supabase as any)
        .from("rdo_equipamentos")
        .select("rdo_id, frota, empresa_dona")
        .in("rdo_id", rdoIds)
        .not("frota", "is", null);

      if (!equips || equips.length === 0) { setAllRows([]); setLoading(false); return; }

      // 3. Enriquecer com dados de equipamentos (tipo, empresa, condicao)
      const frotaNames = [...new Set(equips.map((e: any) => e.frota).filter(Boolean))];
      const { data: maquinas } = await (supabase as any)
        .from("equipamentos")
        .select("frota, tipo, empresa_proprietaria, condicao")
        .in("frota", frotaNames);

      const maqMap: Record<string, any> = {};
      (maquinas || []).forEach((m: any) => { if (m.frota) maqMap[m.frota] = m; });

      // 4. OGS reference (contratante e local)
      const ogsNumbers = [...new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean))];
      let ogsMap: Record<string, any> = {};
      if (ogsNumbers.length > 0) {
        const { data: ogsRefs } = await (supabase as any)
          .from("ogs_reference")
          .select("ogs_number, client_name, location_address")
          .eq("company_id", profile.company_id)
          .in("ogs_number", ogsNumbers);
        (ogsRefs || []).forEach((o: any) => { ogsMap[o.ogs_number] = o; });
      }

      // 5. Montar rows
      const rows: RdoRow[] = equips.map((e: any) => {
        const rdo = rdoMap[e.rdo_id];
        if (!rdo) return null;
        const maq = maqMap[e.frota];
        const ogs = ogsMap[rdo.obra_nome];
        const empresa = e.empresa_dona || maq?.empresa_proprietaria || (maq?.condicao === "PROPRIO" ? "PRÓPRIO" : null);
        return {
          frota: e.frota,
          tipo: maq?.tipo || "—",
          encarregado: rdo.encarregado || null,
          ogs: rdo.obra_nome || null,
          contratante: ogs?.client_name || null,
          local: ogs?.location_address || null,
          data: rdo.data,
          empresa,
          condicao: maq?.condicao || null,
        } as RdoRow;
      }).filter(Boolean);

      setAllRows(rows);
      setLastFetch(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

      // ── SEM APONTAMENTO: equipamentos ativos que NÃO aparecem em nenhum RDO do período ──
      const frotasComRdo = new Set(rows.map(r => r.frota));
      const { data: todosEquip } = await (supabase as any)
        .from("equipamentos")
        .select("frota, tipo, setor, empresa_proprietaria, condicao, status")
        .eq("status", "ativo")
        .not("frota", "is", null);

      const semRdo: EquipSemRdo[] = (todosEquip || [])
        .filter((e: any) => e.frota && !frotasComRdo.has(e.frota))
        .map((e: any) => ({
          frota: e.frota,
          tipo: e.tipo || "—",
          setor: e.setor || null,
          empresa: e.empresa_proprietaria || null,
          condicao: e.condicao || null,
          status: e.status || null,
        }))
        .sort((a: EquipSemRdo, b: EquipSemRdo) => (a.tipo || "").localeCompare(b.tipo || "") || (a.frota || "").localeCompare(b.frota || ""));

      setEquipSemRdo(semRdo);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Snapshot: última aparição por frota
  const snapshotRows = useMemo(() => {
    const map: Record<string, RdoRow> = {};
    for (const r of allRows) {
      if (!map[r.frota] || r.data > map[r.frota].data) map[r.frota] = r;
    }
    return Object.values(map);
  }, [allRows]);

  const baseRows = modoSnapshot ? snapshotRows : allRows;

  // ── Chips de tipo ────────────────────────────────────────────────────────────
  const chipsDoTipo = useMemo(() => {
    const chips: { key: string; label: string; count: number }[] = [];
    const tiposNoGrupo = GRUPOS_CHIP.flatMap(g => g.tipos.map(t => t.toUpperCase()));

    for (const g of GRUPOS_CHIP) {
      const count = baseRows.filter(r => g.tipos.some(t => t.toUpperCase() === (r.tipo || "").toUpperCase())).length;
      if (count > 0) chips.push({ key: g.key, label: g.label, count });
    }
    const indiv = [...new Set(baseRows.map(r => (r.tipo || "").toUpperCase()).filter(t => t && t !== "—" && !tiposNoGrupo.includes(t)))].sort();
    for (const tipo of indiv) {
      const count = baseRows.filter(r => (r.tipo || "").toUpperCase() === tipo).length;
      if (count > 0) chips.push({ key: tipo, label: tipo.charAt(0) + tipo.slice(1).toLowerCase(), count });
    }
    return chips;
  }, [baseRows]);

  // ── Chips de equipe ──────────────────────────────────────────────────────────
  const chipsDeEquipe = useMemo(() => {
    return [...new Set(baseRows.map(r => r.encarregado).filter(Boolean))].sort()
      .map(eq => ({ key: eq!, label: eq!, count: baseRows.filter(r => r.encarregado === eq).length }));
  }, [baseRows]);

  // ── Lista filtrada ───────────────────────────────────────────────────────────
  const listaFiltrada = useMemo(() => {
    let lista = baseRows;

    if (chipSel !== "todos") {
      if (modoVis === "tipo") {
        const grupo = GRUPOS_CHIP.find(g => g.key === chipSel);
        if (grupo) {
          if (subChipSel !== "todos") lista = lista.filter(r => (r.tipo || "").toUpperCase() === subChipSel.toUpperCase());
          else lista = lista.filter(r => grupo.tipos.some(t => t.toUpperCase() === (r.tipo || "").toUpperCase()));
        } else {
          lista = lista.filter(r => (r.tipo || "").toUpperCase() === chipSel.toUpperCase());
        }
      } else {
        lista = lista.filter(r => r.encarregado === chipSel);
      }
    }

    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(r =>
        [r.frota, r.tipo, r.encarregado, r.ogs, r.contratante, r.local, r.empresa]
          .some(f => f?.toLowerCase().includes(b))
      );
    }
    return lista;
  }, [baseRows, chipSel, subChipSel, modoVis, busca]);

  const chips = modoVis === "tipo" ? chipsDoTipo : chipsDeEquipe;

  function trocarModo(m: ModoVis) { setModoVis(m); setChipSel("todos"); setSubChipSel("todos"); setBusca(""); }

  const chipLabel = chipSel === "todos"
    ? (modoVis === "tipo" ? "Todos os Tipos" : "Todas as Equipes")
    : subChipSel !== "todos"
      ? subChipSel.charAt(0) + subChipSel.slice(1).toLowerCase()
      : (chips.find(c => c.key === chipSel)?.label ?? chipSel);

  // KPIs
  const frotasUnicas = new Set(listaFiltrada.map(r => r.frota)).size;
  const encarregadosUnicos = new Set(listaFiltrada.map(r => r.encarregado).filter(Boolean)).size;
  const ogsUnicas = new Set(listaFiltrada.map(r => r.ogs).filter(Boolean)).size;

  const PERIODOS = [
    { key: "semana",         label: "Esta semana" },
    { key: "semana_passada", label: "Semana passada" },
    { key: "mes",            label: "Este mês" },
    { key: "custom",         label: "Personalizado" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-header-gradient shadow-md" style={{ flexShrink: 0 }}>
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-1.5 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={14} color="rgba(255,255,255,0.7)" />
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: "white" }}>
              Localização de Frotas — via RDO
            </span>
          </div>
          {/* KPIs inline */}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {[
              { v: frotasUnicas,       label: "frotas",       cor: "#93c5fd" },
              { v: encarregadosUnicos, label: "equipes",      cor: "#86efac" },
              { v: ogsUnicas,          label: "obras/OGS",    cor: "#fcd34d" },
            ].map(k => (
              <div key={k.label} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 18, color: k.cor }}>{k.v}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{k.label}</span>
              </div>
            ))}
            {lastFetch && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 12 }}>
                atualizado {lastFetch}
              </span>
            )}
          </div>
        </div>
        {/* Refresh */}
        <button onClick={buscar} disabled={loading}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "white" }}>
          <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </header>

      {/* ── BARRA DE PERÍODO ─────────────────────────────────────────────────── */}
      <div style={{
        background: "white", borderBottom: "1px solid #e2e8f0",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0,
      }}>
        <CalendarDays size={14} color="#64748b" />
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Período:</span>

        {PERIODOS.map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1.5px solid", borderColor: periodo === p.key ? "#0055AA" : "#e2e8f0",
              background: periodo === p.key ? "#0055AA" : "white",
              color: periodo === p.key ? "white" : "#374151",
            }}>
            {p.label}
          </button>
        ))}

        {periodo === "custom" && (
          <>
            <input type="date" value={customIni} onChange={e => setCustomIni(e.target.value)}
              style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12 }} />
            <span style={{ fontSize: 12, color: "#64748b" }}>até</span>
            <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)}
              style={{ height: 30, padding: "0 8px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12 }} />
          </>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Visualização:</span>
          {[
            { key: true,  label: "📍 Snapshot (última posição)" },
            { key: false, label: "📋 Período completo" },
          ].map(m => (
            <button key={String(m.key)} onClick={() => setModoSnapshot(m.key)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "1.5px solid", borderColor: modoSnapshot === m.key ? "#0055AA" : "#e2e8f0",
                background: modoSnapshot === m.key ? "#eff6ff" : "white",
                color: modoSnapshot === m.key ? "#0055AA" : "#374151",
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CORPO: SIDEBAR + CONTEÚDO ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 220, flexShrink: 0, background: "#1e293b",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}>
          {/* Toggle tipo / equipe */}
          <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {[
              { key: "tipo",   label: "Por Tipo",  icon: "⚙️" },
              { key: "equipe", label: "Por Equipe", icon: "👥" },
            ].map(m => (
              <button key={m.key} onClick={() => trocarModo(m.key as ModoVis)}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10, marginBottom: 6,
                  background: modoVis === m.key ? "#0055AA" : "rgba(255,255,255,0.06)",
                  border: "none", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 8,
                  color: modoVis === m.key ? "white" : "rgba(255,255,255,0.55)",
                  fontWeight: modoVis === m.key ? 700 : 500, fontSize: 13,
                  boxShadow: modoVis === m.key ? "0 3px 12px rgba(0,85,170,0.4)" : "none",
                }}>
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          {/* Chips */}
          <div style={{ padding: "10px 8px", flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, paddingLeft: 4 }}>
              {modoVis === "tipo" ? "Tipo" : "Equipe"}
            </p>

            <SideChip label="Todos" count={baseRows.length} ativo={chipSel === "todos" && !mostraSemRdo} onClick={() => { setChipSel("todos"); setSubChipSel("todos"); setMostraSemRdo(false); }} />

            {chips.map(c => (
              <div key={c.key}>
                <SideChip
                  label={c.label} count={c.count} ativo={chipSel === c.key && subChipSel === "todos"}
                  onClick={() => { setChipSel(c.key); setSubChipSel("todos"); setMostraSemRdo(false); }}
                />
                {/* Subchips para grupos de caminhão */}
                {modoVis === "tipo" && chipSel === c.key && (() => {
                  const grupo = GRUPOS_CHIP.find(g => g.key === c.key);
                  if (!grupo) return null;
                  const subs = grupo.tipos.filter(t => baseRows.some(r => (r.tipo || "").toUpperCase() === t.toUpperCase()));
                  if (subs.length <= 1) return null;
                  return (
                    <div style={{ paddingLeft: 10, marginBottom: 4 }}>
                      {subs.map(sub => {
                        const count = baseRows.filter(r => (r.tipo || "").toUpperCase() === sub.toUpperCase()).length;
                        const label = sub.replace("CAMINHÃO ", "").replace("CAMINHAO ", "");
                        return (
                          <SubChip
                            key={sub}
                            label={label.charAt(0) + label.slice(1).toLowerCase()}
                            count={count}
                            ativo={subChipSel === sub}
                            onClick={() => setSubChipSel(sub)}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {/* Botão Sem Apontamento */}
          {equipSemRdo.length > 0 && (
            <div style={{ padding: "8px 8px 0" }}>
              <button onClick={() => { setMostraSemRdo(true); setChipSel("todos"); setSubChipSel("todos"); }}
                style={{
                  width: "100%", padding: "9px 10px", borderRadius: 9,
                  background: mostraSemRdo ? "#b91c1c" : "rgba(239,68,68,0.12)",
                  border: mostraSemRdo ? "none" : "1px solid rgba(239,68,68,0.25)",
                  cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  boxShadow: mostraSemRdo ? "0 2px 10px rgba(185,28,28,0.4)" : "none",
                  transition: "all 0.12s",
                }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: mostraSemRdo ? "white" : "#fca5a5" }}>
                  ⚠️ Sem Apontamento
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  background: mostraSemRdo ? "rgba(255,255,255,0.2)" : "rgba(239,68,68,0.25)",
                  color: mostraSemRdo ? "white" : "#fca5a5",
                  borderRadius: 20, padding: "1px 7px",
                }}>
                  {equipSemRdo.length}
                </span>
              </button>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4, paddingLeft: 4, lineHeight: 1.4 }}>
                Ativos sem RDO no período
              </p>
            </div>
          )}

          {/* Legenda */}
          <div style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Modo</p>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              <p>📍 <strong style={{ color: "rgba(255,255,255,0.6)" }}>Snapshot</strong> — última posição de cada frota</p>
              <p>📋 <strong style={{ color: "rgba(255,255,255,0.6)" }}>Período</strong> — todos os registros</p>
            </div>
          </div>
        </aside>

        {/* CONTEÚDO */}
        <main style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

          {/* Título + info */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 18, color: "#0A0F2C", margin: 0 }}>
                {mostraSemRdo ? "⚠️ Sem Apontamento no Período" : chipLabel}
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {fmtDate(dataIni)} a {fmtDate(dataFim)}
                {" · "}
                {mostraSemRdo
                  ? `${equipSemRdo.length} equipamento${equipSemRdo.length !== 1 ? "s" : ""} ativos sem RDO`
                  : modoSnapshot
                    ? `${listaFiltrada.length} frota${listaFiltrada.length !== 1 ? "s" : ""} (última posição)`
                    : `${listaFiltrada.length} registro${listaFiltrada.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Busca */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
            <input
              placeholder="Buscar frota, tipo, encarregado, OGS, local..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: "100%", paddingLeft: 36, paddingRight: 12, height: 38,
                borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13,
                outline: "none", boxSizing: "border-box", background: "white",
              }}
            />
          </div>

          {/* Tabela */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
              <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
              <p style={{ marginTop: 12, fontSize: 14 }}>Carregando dados do RDO...</p>
            </div>
          ) : mostraSemRdo ? (
            /* ── TABELA SEM APONTAMENTO ── */
            <div style={{ background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              {/* Aviso */}
              <div style={{ background: "#fef2f2", borderBottom: "2px solid #fecaca", padding: "12px 16px" }}>
                <p style={{ fontSize: 12, color: "#991b1b", fontWeight: 600 }}>
                  ⚠️ Estes equipamentos estão cadastrados como <strong>ativos</strong> mas não tiveram nenhum apontamento via RDO no período selecionado ({fmtDate(dataIni)} a {fmtDate(dataFim)}).
                </p>
              </div>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "90px 180px 180px 150px 110px",
                background: "#f1f5f9", borderBottom: "2px solid #e2e8f0",
                padding: "9px 16px", gap: 8,
              }}>
                {["Frota", "Tipo", "Equipe / Setor", "Empresa", "Condição"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                ))}
              </div>
              {/* Linhas */}
              {equipSemRdo.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 14 }}>
                  Todos os equipamentos ativos tiveram apontamento no período! 🎉
                </div>
              ) : equipSemRdo.map((e, i) => (
                <div key={`${e.frota}-${i}`} style={{
                  display: "grid", gridTemplateColumns: "90px 180px 180px 150px 110px",
                  padding: "10px 16px", gap: 8,
                  borderBottom: "1px solid #f8fafc",
                  background: i % 2 === 0 ? "white" : "#fafbfc",
                  borderLeft: "4px solid #fca5a5",
                }}>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "#0A0F2C", alignSelf: "center" }}>
                    {e.frota}
                  </span>
                  <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, alignSelf: "center" }}>{e.tipo}</span>
                  <span style={{ fontSize: 12, color: "#1e3a5f", fontWeight: 600, alignSelf: "center" }}>{e.setor || "—"}</span>
                  <span style={{ fontSize: 12, color: "#374151", alignSelf: "center" }}>{e.empresa || "—"}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, alignSelf: "center",
                    color: (e.condicao || "").toUpperCase() === "TERCEIRO" ? "#1d4ed8" : "#166534",
                    background: (e.condicao || "").toUpperCase() === "TERCEIRO" ? "#eff6ff" : "#f0fdf4",
                    padding: "3px 10px", borderRadius: 20, display: "inline-block",
                  }}>
                    {(e.condicao || "").toUpperCase() === "TERCEIRO" ? "Terceiro" : "Próprio"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <TabelaRdo rows={listaFiltrada} modoSnapshot={modoSnapshot} />
          )}
        </main>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
