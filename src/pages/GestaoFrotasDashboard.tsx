import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, Wrench, Package, Maximize2, Minimize2, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── TYPES ─────────────────────────────────────────────────────────────────────

interface Equip {
  id: string; frota: string; placa: string; nome: string; modelo_completo: string;
  tipo: string; setor: string; condutor_atual: string; condicao: string; categoria: string;
  empresa_proprietaria: string; locadora: string; valor_mensal: number; status: string;
  observacoes: string; motivo_manutencao: string; previsao_liberacao: string;
}

type Ferramenta = "nav" | "caneta" | "seta" | "circulo" | "retangulo" | "texto" | "borracha";

interface Forma {
  id: string;
  tipo: "caneta" | "seta" | "circulo" | "retangulo" | "texto";
  cor: string; esp: number;
  pontos?: { x: number; y: number }[];
  x1?: number; y1?: number; x2?: number; y2?: number;
  texto?: string; ts?: string;
  erase?: boolean;
}

// ─── LAYOUT CONSTANTS ──────────────────────────────────────────────────────────
const HEADER_H  = 50;  // px — header apresentação
const TOOLBAR_H = 54;  // px — barra de ferramentas
const SIDEBAR_W = 220; // px — sidebar esquerda

// ─── HELPERS ───────────────────────────────────────────────────────────────────

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

const GRUPOS_CHIP = [
  { key: "caminhao",  label: "Caminhões",      tipos: ["CAMINHÃO BASCULANTE","CAMINHÃO CARROCERIA","CAMINHÃO COMBOIO","CAMINHÃO ESPARGIDOR","CAMINHÃO PIPA","CAMINHÃO PLATAFORMA"] },
  { key: "carreta",   label: "Carretas/Cavalo", tipos: ["CARRETA CM","CAVALO MECANICO","PRANCHA REBOQUE"] },
  { key: "van",       label: "Vans/Micro",      tipos: ["VAN","MICROÔNIBUS","MICROONIBUS"] },
];

// ─── CANVAS DRAWING ────────────────────────────────────────────────────────────

function desenhaSeta(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, cor: string, esp: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(14, esp * 4);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = cor; ctx.fillStyle = cor;
  ctx.lineWidth = esp; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
}

function desenhaForma(ctx: CanvasRenderingContext2D, f: Forma) {
  if (f.tipo === "caneta") {
    if (!f.pontos?.length) return;
    if (f.erase) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = f.cor;
    }
    ctx.lineWidth = f.esp; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    f.pontos.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  } else if (f.tipo === "seta") {
    desenhaSeta(ctx, f.x1!, f.y1!, f.x2!, f.y2!, f.cor, f.esp);
  } else if (f.tipo === "circulo") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = f.cor; ctx.lineWidth = f.esp;
    const cx = (f.x1! + f.x2!) / 2, cy = (f.y1! + f.y2!) / 2;
    const rx = Math.max(1, Math.abs(f.x2! - f.x1!) / 2);
    const ry = Math.max(1, Math.abs(f.y2! - f.y1!) / 2);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (f.tipo === "retangulo") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = f.cor; ctx.lineWidth = f.esp;
    ctx.strokeRect(
      Math.min(f.x1!, f.x2!), Math.min(f.y1!, f.y2!),
      Math.abs(f.x2! - f.x1!), Math.abs(f.y2! - f.y1!)
    );
  } else if (f.tipo === "texto" && f.texto) {
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "bold 15px Inter, sans-serif";
    const m = ctx.measureText(f.texto);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(f.x1! - 5, f.y1! - 19, m.width + 10, 26);
    ctx.fillStyle = f.cor;
    ctx.fillText(f.texto, f.x1!, f.y1!);
    if (f.ts) {
      ctx.font = "10px Inter, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(f.ts, f.x1!, f.y1! + 14);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function redesenhaCanvas(canvas: HTMLCanvasElement, formas: Forma[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  formas.forEach(f => desenhaForma(ctx, f));
}

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

  const cols = "160px 170px 210px 130px 110px 100px 110px";

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", padding: "9px 16px", gap: 8 }}>
        {["Frota", "Tipo", "Equipe / Responsável", "Empresa", "Status", "Situação", "Valor/mês"].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
        ))}
      </div>
      {sorted.map((e, i) => {
        const st = getStatusNorm(e);
        const badge = STATUS_BADGE[st];
        const terceiro = isTerceiro(e);
        const empresa = e.empresa_proprietaria || e.locadora || (terceiro ? "Terceiro" : "—");
        const isManut = st === "manutencao";
        return (
          <div key={e.id} style={{
            display: "grid", gridTemplateColumns: cols, padding: "10px 16px", gap: 8,
            borderBottom: "1px solid #f8fafc",
            background: isManut ? "#fffbeb" : (i % 2 === 0 ? "white" : "#fafbfc"),
            borderLeft: isManut ? "4px solid #f59e0b" : "4px solid transparent",
          }}>
            <div>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: "#0A0F2C", wordBreak: "break-word", lineHeight: 1.2, display: "block" }}>
                {e.frota || e.placa || "—"}
              </span>
              {e.placa && e.placa !== e.frota && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{e.placa}</p>}
            </div>
            <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {e.tipo || e.nome || "—"}
            </span>
            <div style={{ alignSelf: "center", overflow: "hidden" }}>
              <p style={{ fontSize: 12, color: "#1e3a5f", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{e.setor || "—"}</p>
              {e.condutor_atual && <p style={{ fontSize: 11, color: "#9ca3af" }}>👤 {e.condutor_atual}</p>}
            </div>
            <span style={{ fontSize: 12, color: terceiro ? "#1d4ed8" : "#166534", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
              {empresa}
            </span>
            <div style={{ alignSelf: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.cor, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, display: "inline-block" }} />
                {badge.label}
              </span>
              {isManut && e.motivo_manutencao && <p style={{ fontSize: 10, color: "#92400e", marginTop: 3 }}>⚠️ {e.motivo_manutencao}</p>}
              {isManut && e.previsao_liberacao && <p style={{ fontSize: 10, color: "#1d4ed8", marginTop: 1 }}>📅 {fmtDate(e.previsao_liberacao)}</p>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, alignSelf: "center", color: terceiro ? "#1d4ed8" : "#166534", background: terceiro ? "#eff6ff" : "#f0fdf4", padding: "3px 10px", borderRadius: 20, display: "inline-block", textAlign: "center" }}>
              {terceiro ? "Terceiro" : "Próprio"}
            </span>
            <span style={{ fontSize: 12, fontWeight: e.valor_mensal > 0 ? 700 : 400, alignSelf: "center", color: e.valor_mensal > 0 ? "#ea580c" : "#9ca3af" }}>
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

  // Filtros
  const [modoVis, setModoVis]     = useState<"tipo" | "equipe">("tipo");
  const [chipSel, setChipSel]     = useState("todos");
  const [subChipSel, setSubChipSel] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos"|"operacional"|"manutencao"|"terceiro"|"disposicao">("todos");
  const [busca, setBusca]         = useState("");

  // Apresentação
  const [modoApres, setModoApres] = useState(false);
  const [zoom, setZoom]           = useState(1);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("nav");
  const [cor, setCor]             = useState("#ef4444");
  const [esp, setEsp]             = useState(3);
  const [formas, setFormas]       = useState<Forma[]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textVal, setTextVal]     = useState("");

  // Canvas refs
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const isDrawing    = useRef(false);
  const startPt      = useRef({ x: 0, y: 0 });
  const currentPts   = useRef<{ x: number; y: number }[]>([]);
  const formasRef    = useRef<Forma[]>([]);
  formasRef.current  = formas;

  // ── DADOS ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (supabase as any).from("equipamentos").select("*").order("tipo,frota").then(({ data }: any) => {
      if (data) setTodos(data);
      setLoading(false);
    });
  }, []);

  // ── CANVAS: tamanho + redesenho ───────────────────────────────────────────────
  useEffect(() => {
    if (!modoApres) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth  - SIDEBAR_W;
      canvas.height = window.innerHeight - HEADER_H - TOOLBAR_H;
      redesenhaCanvas(canvas, formasRef.current);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [modoApres]);

  useEffect(() => {
    if (!modoApres) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    redesenhaCanvas(canvas, formas);
  }, [formas, modoApres]);

  // ── MEMOS ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const terceiros  = todos.filter(isTerceiro).length;
    const manutencao = todos.filter(e => getStatusNorm(e) === "manutencao").length;
    const custoMensal = todos.filter(isTerceiro).reduce((s, e) => s + (e.valor_mensal || 0), 0);
    return { total: todos.length, terceiros, proprios: todos.length - terceiros, manutencao, custoMensal };
  }, [todos]);

  const chipsDoTipo = useMemo(() => {
    const chips: { key: string; label: string; count: number }[] = [];
    const tiposNoGrupo = GRUPOS_CHIP.flatMap(g => g.tipos.map(t => t.toUpperCase()));
    for (const g of GRUPOS_CHIP) {
      const count = todos.filter(e => g.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase())).length;
      if (count > 0) chips.push({ key: g.key, label: g.label, count });
    }
    const tiposIndiv = [...new Set(todos.map(e => (e.tipo || "").toUpperCase()).filter(t => t && !tiposNoGrupo.includes(t)))].sort();
    for (const tipo of tiposIndiv) {
      const count = todos.filter(e => (e.tipo || "").toUpperCase() === tipo).length;
      if (count > 0) chips.push({ key: tipo, label: tipo.charAt(0) + tipo.slice(1).toLowerCase(), count });
    }
    return chips;
  }, [todos]);

  const chipsDeEquipe = useMemo(() =>
    [...new Set(todos.map(e => e.setor).filter(Boolean))].sort()
      .map(eq => ({ key: eq, label: eq, count: todos.filter(e => e.setor === eq).length })),
  [todos]);

  const listaFiltrada = useMemo(() => {
    let lista = todos;
    if (chipSel !== "todos") {
      if (modoVis === "tipo") {
        const grupo = GRUPOS_CHIP.find(g => g.key === chipSel);
        if (grupo) {
          lista = subChipSel !== "todos"
            ? lista.filter(e => (e.tipo || "").toUpperCase() === subChipSel.toUpperCase())
            : lista.filter(e => grupo.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase()));
        } else {
          lista = lista.filter(e => (e.tipo || "").toUpperCase() === chipSel.toUpperCase());
        }
      } else {
        lista = lista.filter(e => e.setor === chipSel);
      }
    }
    if (filtroStatus === "manutencao")  lista = lista.filter(e => getStatusNorm(e) === "manutencao");
    else if (filtroStatus === "operacional") lista = lista.filter(e => getStatusNorm(e) === "operacional");
    else if (filtroStatus === "terceiro")    lista = lista.filter(isTerceiro);
    else if (filtroStatus === "disposicao") lista = lista.filter(e => getStatusNorm(e) === "disposicao");
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(e =>
        [e.frota, e.placa, e.tipo, e.nome, e.setor, e.condutor_atual, e.empresa_proprietaria, e.locadora]
          .some(f => f?.toLowerCase().includes(b))
      );
    }
    return lista;
  }, [todos, chipSel, subChipSel, modoVis, filtroStatus, busca]);

  const kpiSel = useMemo(() => {
    const t = listaFiltrada.filter(isTerceiro);
    return { total: listaFiltrada.length, terceiros: t.length, custo: t.reduce((s, e) => s + (e.valor_mensal || 0), 0), manut: listaFiltrada.filter(e => getStatusNorm(e) === "manutencao").length };
  }, [listaFiltrada]);

  const chips = modoVis === "tipo" ? chipsDoTipo : chipsDeEquipe;

  const chipLabel = chipSel === "todos"
    ? (modoVis === "tipo" ? "Todos os Equipamentos" : "Todas as Equipes")
    : subChipSel !== "todos"
      ? subChipSel.charAt(0) + subChipSel.slice(1).toLowerCase()
      : (chips.find(c => c.key === chipSel)?.label ?? chipSel);

  function trocarModo(m: "tipo" | "equipe") {
    setModoVis(m); setChipSel("todos"); setSubChipSel("todos"); setBusca(""); setFiltroStatus("todos");
  }

  // ── CANVAS HANDLERS ──────────────────────────────────────────────────────────
  function getPt(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (ferramenta === "nav") return;
    const pt = getPt(e);
    if (ferramenta === "texto") { setTextInput(pt); setTextVal(""); return; }
    isDrawing.current = true;
    startPt.current = pt;
    currentPts.current = [pt];
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || ferramenta === "nav" || ferramenta === "texto") return;
    const pt = getPt(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    formas.forEach(f => desenhaForma(ctx, f));

    if (ferramenta === "caneta") {
      currentPts.current.push(pt);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = cor; ctx.lineWidth = esp; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      currentPts.current.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (ferramenta === "borracha") {
      currentPts.current.push(pt);
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)"; ctx.lineWidth = 26; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      currentPts.current.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    } else if (ferramenta === "seta") {
      desenhaSeta(ctx, startPt.current.x, startPt.current.y, pt.x, pt.y, cor, esp);
    } else if (ferramenta === "circulo") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = cor; ctx.lineWidth = esp;
      const cx = (startPt.current.x + pt.x) / 2, cy = (startPt.current.y + pt.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, Math.abs(pt.x - startPt.current.x) / 2), Math.max(1, Math.abs(pt.y - startPt.current.y) / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ferramenta === "retangulo") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = cor; ctx.lineWidth = esp;
      ctx.strokeRect(Math.min(startPt.current.x, pt.x), Math.min(startPt.current.y, pt.y), Math.abs(pt.x - startPt.current.x), Math.abs(pt.y - startPt.current.y));
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || ferramenta === "nav" || ferramenta === "texto") return;
    isDrawing.current = false;
    const pt = getPt(e);
    const nova: Forma = {
      id: Date.now().toString(),
      tipo: ferramenta === "borracha" ? "caneta" : ferramenta as any,
      cor, esp,
      erase: ferramenta === "borracha",
    };
    if (ferramenta === "caneta" || ferramenta === "borracha") {
      nova.pontos = [...currentPts.current, pt];
    } else {
      nova.x1 = startPt.current.x; nova.y1 = startPt.current.y;
      nova.x2 = pt.x; nova.y2 = pt.y;
    }
    setFormas(prev => [...prev, nova]);
    currentPts.current = [];
  }

  function confirmarTexto() {
    if (!textInput || !textVal.trim()) { setTextInput(null); return; }
    const ts = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setFormas(prev => [...prev, { id: Date.now().toString(), tipo: "texto", cor, esp: 1, x1: textInput.x, y1: textInput.y, texto: textVal.trim(), ts }]);
    setTextInput(null); setTextVal("");
  }

  function exportarAnotacoes() {
    const textos = formas.filter(f => f.tipo === "texto" && f.texto);
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    let txt = "══════════════════════════════════════════\n";
    txt += "  REUNIÃO SEMANAL DE FROTAS — WORKFLUX\n";
    txt += "══════════════════════════════════════════\n";
    txt += `Data     : ${dateStr}\n`;
    txt += `Exportado: ${now.toLocaleTimeString("pt-BR")}\n\n`;
    txt += `FILTRO   : ${chipLabel}\n`;
    txt += `Total    : ${kpiSel.total} equipamento${kpiSel.total !== 1 ? "s" : ""}\n`;
    if (kpiSel.manut > 0)     txt += `Manutenção: ${kpiSel.manut}\n`;
    if (kpiSel.terceiros > 0) txt += `Terceiros : ${kpiSel.terceiros}\n`;
    if (kpiSel.custo > 0)     txt += `Custo loc.: ${formatBRL(kpiSel.custo)}/mês\n`;
    txt += "\n──────────────────────────────────────────\n";
    if (textos.length === 0) {
      txt += "Nenhuma anotação de texto registrada.\n";
    } else {
      txt += `ANOTAÇÕES (${textos.length}):\n──────────────────────────────────────────\n`;
      textos.forEach(a => { txt += `[${a.ts ?? "--:--"}] ${a.texto}\n`; });
    }
    txt += "\n══════════════════════════════════════════\n";
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `reuniao-frotas-${now.toISOString().split("T")[0]}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  const getCursor = () => {
    if (ferramenta === "nav") return "default";
    if (ferramenta === "texto") return "text";
    if (ferramenta === "borracha") return "cell";
    return "crosshair";
  };

  // ── SIDEBAR (shared) ─────────────────────────────────────────────────────────
  function renderSidebar() {
    return (
      <aside style={{ width: SIDEBAR_W, flexShrink: 0, background: "#1e293b", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {[{ key: "tipo", label: "Por Tipo", icon: "⚙️" }, { key: "equipe", label: "Por Equipe", icon: "👥" }].map(m => (
            <button key={m.key} onClick={() => trocarModo(m.key as "tipo" | "equipe")}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, marginBottom: 6, background: modoVis === m.key ? "#0055AA" : "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, color: modoVis === m.key ? "white" : "rgba(255,255,255,0.55)", fontWeight: modoVis === m.key ? 700 : 500, fontSize: 13, boxShadow: modoVis === m.key ? "0 3px 12px rgba(0,85,170,0.4)" : "none", transition: "all 0.15s" }}>
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "10px 8px", flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, paddingLeft: 4 }}>
            {modoVis === "tipo" ? "Tipo" : "Equipe"}
          </p>
          <SideChip label="Todos" count={todos.length} ativo={chipSel === "todos"} manut={todos.filter(e => getStatusNorm(e) === "manutencao").length} onClick={() => setChipSel("todos")} />
          {chips.map(c => (
            <div key={c.key}>
              <SideChip label={c.label} count={c.count} ativo={chipSel === c.key && subChipSel === "todos"}
                manut={modoVis === "tipo"
                  ? (() => { const g = GRUPOS_CHIP.find(g => g.key === c.key); return todos.filter(e => getStatusNorm(e) === "manutencao" && (g ? g.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase()) : (e.tipo || "").toUpperCase() === c.key.toUpperCase())).length; })()
                  : todos.filter(e => e.setor === c.key && getStatusNorm(e) === "manutencao").length}
                onClick={() => { setChipSel(c.key); setSubChipSel("todos"); }}
              />
              {modoVis === "tipo" && chipSel === c.key && (() => {
                const grupo = GRUPOS_CHIP.find(g => g.key === c.key);
                if (!grupo) return null;
                const subs = grupo.tipos.filter(t => todos.some(e => (e.tipo || "").toUpperCase() === t.toUpperCase()));
                if (subs.length <= 1) return null;
                return (
                  <div style={{ paddingLeft: 10, marginBottom: 4 }}>
                    {subs.map(sub => {
                      const lbl = sub.replace("CAMINHÃO ", "").replace("CAMINHAO ", "");
                      return <SideChip key={sub} label={"↳ " + lbl.charAt(0) + lbl.slice(1).toLowerCase()} count={todos.filter(e => (e.tipo || "").toUpperCase() === sub.toUpperCase()).length} ativo={subChipSel === sub} manut={todos.filter(e => (e.tipo || "").toUpperCase() === sub.toUpperCase() && getStatusNorm(e) === "manutencao").length} onClick={() => setSubChipSel(sub)} />;
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Legenda</p>
          {[{ dot: "#16a34a", label: "Operacional" }, { dot: "#f59e0b", label: "Manutenção" }, { dot: "#94a3b8", label: "Disposição" }, { dot: "#ef4444", label: "Inativo" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  // ── CONTEÚDO PRINCIPAL (shared) ──────────────────────────────────────────────
  function renderConteudo() {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "16px 18px", background: "#f0f4f8" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 18, color: "#0A0F2C", margin: 0 }}>{chipLabel}</h2>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {kpiSel.total} equipamento{kpiSel.total !== 1 ? "s" : ""}
              {kpiSel.manut > 0 && <span style={{ color: "#b45309", fontWeight: 700 }}> · ⚠️ {kpiSel.manut} em manutenção</span>}
              {kpiSel.terceiros > 0 && <span style={{ color: "#1d4ed8", fontWeight: 600 }}> · {kpiSel.terceiros} terceiros</span>}
              {kpiSel.custo > 0 && <span style={{ color: "#ea580c", fontWeight: 700 }}> · {formatBRL(kpiSel.custo)}/mês</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "todos", label: "Todos", cor: "#374151" }, { key: "operacional", label: "Operacional", cor: "#166534" },
              { key: "manutencao", label: "Manutenção", cor: "#92400e" }, { key: "disposicao", label: "Disposição", cor: "#475569" },
              { key: "terceiro", label: "Locados", cor: "#1d4ed8" },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltroStatus(f.key as any)}
                style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: filtroStatus === f.key ? f.cor : "#e2e8f0", background: filtroStatus === f.key ? f.cor : "white", color: filtroStatus === f.key ? "white" : "#374151", transition: "all 0.12s" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
          <input placeholder="Buscar frota, placa, tipo, equipe, empresa..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 38, borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }} />
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af", fontSize: 15 }}>Carregando...</div>
        ) : (
          <TabelaEquipamentos items={listaFiltrada} />
        )}
        {!loading && kpiSel.custo > 0 && filtroStatus !== "operacional" && (
          <div style={{ marginTop: 16, background: "white", borderRadius: 14, padding: "14px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, color: "#0A0F2C" }}>
              <Package size={13} color="#ea580c" /> Locados por Empresa
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(
                listaFiltrada.filter(isTerceiro).reduce<Record<string, { count: number; custo: number }>>((acc, e) => {
                  const emp = e.empresa_proprietaria || e.locadora || "Sem empresa";
                  if (!acc[emp]) acc[emp] = { count: 0, custo: 0 };
                  acc[emp].count++; acc[emp].custo += (e.valor_mensal || 0);
                  return acc;
                }, {})
              ).sort((a, b) => b[1].custo - a[1].custo).map(([emp, d]) => (
                <div key={emp} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px", display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>{emp}</span>
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{d.count} equip.</span>
                    {d.custo > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#ea580c" }}>{formatBRL(d.custo)}/mês</span>}
                  </div>
                </div>
              ))}
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 14px", display: "flex", flexDirection: "column", alignSelf: "center" }}>
                <span style={{ fontSize: 10, color: "#9a3412", fontWeight: 700, textTransform: "uppercase" }}>Total</span>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#ea580c" }}>{formatBRL(kpiSel.custo)}/mês</span>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ── MODO APRESENTAÇÃO ────────────────────────────────────────────────────────
  if (modoApres) {
    const nTextos = formas.filter(f => f.tipo === "texto").length;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>

        {/* Canvas de anotação */}
        <canvas ref={canvasRef} style={{ position: "fixed", top: HEADER_H + TOOLBAR_H, left: SIDEBAR_W, zIndex: 10000, pointerEvents: ferramenta !== "nav" ? "all" : "none", cursor: getCursor() }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={e => { if (isDrawing.current) handleMouseUp(e); }} />

        {/* Input de texto flutuante */}
        {textInput && (
          <div style={{ position: "fixed", left: Math.min(textInput.x + SIDEBAR_W, window.innerWidth - 320), top: Math.max(HEADER_H + TOOLBAR_H + 8, textInput.y + HEADER_H + TOOLBAR_H - 88), zIndex: 10002, background: "white", border: "2px solid #0055AA", borderRadius: 12, padding: "12px 16px", boxShadow: "0 10px 40px rgba(0,0,0,0.4)", minWidth: 290 }}>
            <p style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>📝 Nova anotação</p>
            <input autoFocus value={textVal} onChange={e => setTextVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmarTexto(); if (e.key === "Escape") setTextInput(null); }}
              placeholder="Digite aqui e pressione Enter..."
              style={{ border: "none", outline: "none", fontSize: 14, width: "100%", background: "transparent", color: "#0A0F2C" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={confirmarTexto} style={{ flex: 1, padding: "7px 0", background: "#0055AA", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓ Confirmar</button>
              <button onClick={() => setTextInput(null)} style={{ padding: "7px 14px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#64748b" }}>✕</button>
            </div>
          </div>
        )}

        {/* Header apresentação */}
        <header style={{ height: HEADER_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, paddingInline: 16, background: "linear-gradient(135deg, #0A0F2C 0%, #0055AA 100%)", boxShadow: "0 2px 12px rgba(0,0,0,0.35)", zIndex: 9998 }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: "white" }}>
            Dashboard de Frotas — Reunião Semanal
          </span>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
            {[{ v: kpis.total, label: "total", cor: "#93c5fd" }, { v: kpis.proprios, label: "próprios", cor: "#86efac" }, { v: kpis.terceiros, label: "terceiros", cor: "#fcd34d" }, { v: kpis.manutencao, label: "manutenção", cor: "#fb923c" }].map(k => (
              <div key={k.label} style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 16, color: k.cor }}>{k.v}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{k.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 12 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 13, color: "#fb923c" }}>{formatBRL(kpis.custoMensal)}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>locados/mês</span>
            </div>
          </div>
          {/* Zoom */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "3px 8px" }}>
            <button onClick={() => setZoom(z => Math.max(0.6, parseFloat((z - 0.1).toFixed(1))))} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 5px", fontWeight: 300 }}>−</button>
            <span style={{ fontSize: 12, color: "white", fontWeight: 700, minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.5, parseFloat((z + 0.1).toFixed(1))))} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 5px", fontWeight: 300 }}>+</button>
          </div>
          {/* Sair */}
          <button onClick={() => setModoApres(false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 700 }}>
            <Minimize2 size={13} /> Sair
          </button>
        </header>

        {/* Barra de ferramentas de desenho */}
        <div style={{ height: TOOLBAR_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 5, paddingInline: 14, background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 9998, overflowX: "auto" }}>
          {/* Ferramentas */}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", marginRight: 2 }}>Ferramenta</span>
          {[
            { k: "nav",       icon: "🖱️", title: "Navegar (scroll)" },
            { k: "caneta",    icon: "✏️", title: "Caneta livre" },
            { k: "texto",     icon: "T",  title: "Texto / Anotação", mono: true },
            { k: "seta",      icon: "➜",  title: "Seta" },
            { k: "circulo",   icon: "○",  title: "Círculo / Oval" },
            { k: "retangulo", icon: "□",  title: "Retângulo" },
            { k: "borracha",  icon: "✕",  title: "Borracha" },
          ].map(t => (
            <button key={t.k} onClick={() => setFerramenta(t.k as Ferramenta)} title={t.title}
              style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", background: ferramenta === t.k ? "#0055AA" : "rgba(255,255,255,0.07)", color: "white", fontSize: t.mono ? 13 : 16, fontFamily: t.mono ? "monospace" : "inherit", fontWeight: t.mono ? 900 : "normal", boxShadow: ferramenta === t.k ? "0 2px 10px rgba(0,85,170,0.55)" : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {t.icon}
            </button>
          ))}

          <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.1)", marginInline: 6, flexShrink: 0 }} />

          {/* Cores */}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Cor</span>
          {["#ef4444","#f59e0b","#22c55e","#3b82f6","#ffffff","#fbbf24","#a855f7","#000000"].map(c => (
            <button key={c} onClick={() => setCor(c)} title={c}
              style={{ width: 20, height: 20, borderRadius: "50%", border: cor === c ? "3px solid white" : "2px solid rgba(255,255,255,0.15)", background: c, cursor: "pointer", flexShrink: 0, boxShadow: cor === c ? "0 0 0 1px #0055AA, 0 2px 8px rgba(0,0,0,0.4)" : "none" }} />
          ))}

          <div style={{ width: 1, height: 26, background: "rgba(255,255,255,0.1)", marginInline: 6, flexShrink: 0 }} />

          {/* Espessura */}
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Esp.</span>
          {[{ v: 2, w: 5 }, { v: 4, w: 10 }, { v: 7, w: 17 }].map(e => (
            <button key={e.v} onClick={() => setEsp(e.v)} title={`${e.v}px`}
              style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", background: esp === e.v ? "rgba(0,85,170,0.55)" : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: e.w, height: e.v, background: "white", borderRadius: e.v }} />
            </button>
          ))}

          {/* Contador anotações */}
          {nTextos > 0 && (
            <span style={{ fontSize: 11, color: "#86efac", fontWeight: 700, marginLeft: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
              📝 {nTextos} anotaç{nTextos === 1 ? "ão" : "ões"}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Limpar */}
          <button onClick={() => setFormas([])} title="Limpar todas as marcações" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, cursor: "pointer", color: "#fca5a5", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <Trash2 size={12} /> Limpar
          </button>

          {/* Exportar */}
          <button onClick={exportarAnotacoes} title="Exportar anotações de texto (.txt)" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, cursor: "pointer", color: "#86efac", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <Download size={12} /> Exportar
          </button>
        </div>

        {/* Corpo: sidebar + conteúdo com zoom */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {renderSidebar()}
          <div style={{ flex: 1, overflow: "auto", background: "#f0f4f8" }}>
            <div style={{ zoom: zoom }}>
              {renderConteudo()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MODO NORMAL ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      <header className="flex items-center gap-3 px-4 py-2.5 bg-header-gradient shadow-md" style={{ flexShrink: 0 }}>
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-1.5 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: "white" }}>
            Dashboard de Frotas — Reunião Semanal
          </span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[{ v: kpis.total, label: "total", cor: "#93c5fd" }, { v: kpis.proprios, label: "próprios", cor: "#86efac" }, { v: kpis.terceiros, label: "terceiros", cor: "#fcd34d" }, { v: kpis.manutencao, label: "manutenção", cor: "#fb923c" }].map(k => (
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
        {/* Botão Apresentação */}
        <button onClick={() => { setModoApres(true); setFerramenta("nav"); setZoom(1); }}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 9, cursor: "pointer", color: "white", fontSize: 13, fontWeight: 700, transition: "all 0.15s", letterSpacing: "0.01em" }}>
          <Maximize2 size={14} /> Apresentação
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {renderSidebar()}
        {renderConteudo()}
      </div>
    </div>
  );
}

// ─── CHIP LATERAL ─────────────────────────────────────────────────────────────
function SideChip({ label, count, ativo, manut, onClick }: { label: string; count: number; ativo: boolean; manut: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "8px 10px", borderRadius: 9, marginBottom: 4, background: ativo ? "#0055AA" : "rgba(255,255,255,0.04)", border: ativo ? "none" : "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.12s", boxShadow: ativo ? "0 2px 10px rgba(0,85,170,0.35)" : "none" }}>
      <span style={{ fontSize: 12, fontWeight: ativo ? 700 : 500, color: ativo ? "white" : "rgba(255,255,255,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 6 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
        {manut > 0 && <span style={{ fontSize: 10, background: "#f59e0b", color: "white", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>⚠️{manut}</span>}
        <span style={{ fontSize: 11, background: ativo ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)", color: ativo ? "white" : "rgba(255,255,255,0.45)", borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
          {count}
        </span>
      </div>
    </button>
  );
}
