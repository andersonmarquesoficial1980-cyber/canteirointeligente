import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package, Maximize2, Minimize2, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── TYPES ─────────────────────────────────────────────────────────────────────

interface Equip {
  id: string; frota: string; placa: string; nome: string; modelo_completo: string;
  tipo: string; setor: string; condutor_atual: string; condicao: string; categoria: string;
  empresa_proprietaria: string; locadora: string; valor_mensal: number; status: string;
  observacoes: string; motivo_manutencao: string; previsao_liberacao: string;
}

type Ferramenta = "nav" | "selecionar" | "caneta" | "seta" | "circulo" | "retangulo" | "texto";

interface Forma {
  id: string;
  tipo: "caneta" | "seta" | "circulo" | "retangulo" | "texto";
  cor: string; esp: number;
  pontos?: { x: number; y: number }[];
  x1?: number; y1?: number; x2?: number; y2?: number;
  texto?: string; ts?: string;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function formatBRL(v: number) { if (!v) return "—"; return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDate(d: string) { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }

function getStatusNorm(e: Equip): "operacional" | "manutencao" | "inativo" | "disposicao" {
  const s = (e.status || "").toLowerCase().replace(/[_\s]/g, "");
  const setor = (e.setor || "").toLowerCase();
  if (s.includes("manut") || setor.includes("manutenção") || setor === "manutenção") return "manutencao";
  if (s.includes("inativo") || s.includes("inoperante")) return "inativo";
  if (setor.includes("disposição") || setor.includes("disposicao")) return "disposicao";
  return "operacional";
}
function isTerceiro(e: Equip) { return (e.condicao || "").toUpperCase() === "TERCEIRO" || (e.categoria || "").toLowerCase() === "locado"; }

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

function getBBox(f: Forma): { x: number; y: number; w: number; h: number } {
  const p = Math.max(f.esp, 5);
  if (f.tipo === "caneta" && f.pontos?.length) {
    const xs = f.pontos.map(pt => pt.x), ys = f.pontos.map(pt => pt.y);
    return { x: Math.min(...xs) - p, y: Math.min(...ys) - p, w: Math.max(...xs) - Math.min(...xs) + p * 2, h: Math.max(...ys) - Math.min(...ys) + p * 2 };
  }
  if (f.tipo === "texto") {
    const wEst = Math.max(90, (f.texto?.length ?? 0) * 8.5);
    return { x: (f.x1 ?? 0) - 6, y: (f.y1 ?? 0) - 22, w: wEst + 12, h: 34 };
  }
  const minX = Math.min(f.x1 ?? 0, f.x2 ?? 0), minY = Math.min(f.y1 ?? 0, f.y2 ?? 0);
  const maxX = Math.max(f.x1 ?? 0, f.x2 ?? 0), maxY = Math.max(f.y1 ?? 0, f.y2 ?? 0);
  return { x: minX - p, y: minY - p, w: maxX - minX + p * 2, h: maxY - minY + p * 2 };
}

function translateForma(f: Forma, dx: number, dy: number): Forma {
  if (f.tipo === "caneta") return { ...f, pontos: f.pontos!.map(p => ({ x: p.x + dx, y: p.y + dy })) };
  if (f.tipo === "texto") return { ...f, x1: (f.x1 ?? 0) + dx, y1: (f.y1 ?? 0) + dy };
  return { ...f, x1: (f.x1 ?? 0) + dx, y1: (f.y1 ?? 0) + dy, x2: (f.x2 ?? 0) + dx, y2: (f.y2 ?? 0) + dy };
}

// ─── SVG ARROW ─────────────────────────────────────────────────────────────────

function SvgSeta({ x1, y1, x2, y2, cor, esp }: { x1:number; y1:number; x2:number; y2:number; cor:string; esp:number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const hl = Math.max(14, esp * 4);
  const pts = [
    `${x2},${y2}`,
    `${x2 - hl * Math.cos(angle - Math.PI / 6)},${y2 - hl * Math.sin(angle - Math.PI / 6)}`,
    `${x2 - hl * Math.cos(angle + Math.PI / 6)},${y2 - hl * Math.sin(angle + Math.PI / 6)}`,
  ].join(" ");
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cor} strokeWidth={esp} strokeLinecap="round" />
      <polygon points={pts} fill={cor} />
    </g>
  );
}

// ─── SVG SHAPE ELEMENT ─────────────────────────────────────────────────────────

function SvgFormaEl({
  f, selecionada, ferramenta, onMouseDown,
}: {
  f: Forma; selecionada: boolean; ferramenta: Ferramenta;
  onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
}) {
  const bbox = getBBox(f);
  const isInteractive = ferramenta === "selecionar";

  let shape: React.ReactNode = null;
  if (f.tipo === "caneta" && f.pontos?.length) {
    const d = f.pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    shape = <path d={d} stroke={f.cor} strokeWidth={f.esp} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  } else if (f.tipo === "seta" && f.x1 !== undefined) {
    shape = <SvgSeta x1={f.x1} y1={f.y1!} x2={f.x2!} y2={f.y2!} cor={f.cor} esp={f.esp} />;
  } else if (f.tipo === "circulo" && f.x1 !== undefined) {
    const cx = (f.x1 + f.x2!) / 2, cy = (f.y1! + f.y2!) / 2;
    shape = <ellipse cx={cx} cy={cy} rx={Math.max(1, Math.abs(f.x2! - f.x1) / 2)} ry={Math.max(1, Math.abs(f.y2! - f.y1!) / 2)} stroke={f.cor} strokeWidth={f.esp} fill="none" />;
  } else if (f.tipo === "retangulo" && f.x1 !== undefined) {
    shape = <rect x={Math.min(f.x1, f.x2!)} y={Math.min(f.y1!, f.y2!)} width={Math.abs(f.x2! - f.x1)} height={Math.abs(f.y2! - f.y1!)} stroke={f.cor} strokeWidth={f.esp} fill="none" />;
  } else if (f.tipo === "texto" && f.texto && f.x1 !== undefined) {
    const wEst = Math.max(90, f.texto.length * 8.5);
    shape = (
      <g>
        <rect x={f.x1 - 6} y={f.y1! - 22} width={wEst + 12} height={34} fill="rgba(0,0,0,0.72)" rx={5} />
        <text x={f.x1} y={f.y1!} fill={f.cor} fontSize={14} fontFamily="Inter, sans-serif" fontWeight="bold">{f.texto}</text>
        {f.ts && <text x={f.x1} y={f.y1! + 13} fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="Inter, sans-serif">{f.ts}</text>}
      </g>
    );
  }

  if (!shape) return null;

  return (
    <g
      onMouseDown={isInteractive ? onMouseDown : undefined}
      style={{ cursor: isInteractive ? (selecionada ? "grab" : "pointer") : "default" }}
    >
      {/* Invisible wider hit area */}
      {isInteractive && (
        <rect x={bbox.x} y={bbox.y} width={bbox.w} height={bbox.h} fill="transparent" stroke="none" style={{ cursor: "grab" }} />
      )}
      {shape}
      {selecionada && (
        <rect
          x={bbox.x} y={bbox.y} width={bbox.w} height={bbox.h}
          fill="rgba(0,85,170,0.07)" stroke="#0055AA" strokeWidth={1.5} strokeDasharray="6,3"
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}

// ─── TABELA ────────────────────────────────────────────────────────────────────

function TabelaEquipamentos({ items }: { items: Equip[] }) {
  const sorted = useMemo(() => [...items].sort((a, b) => {
    const sa = getStatusNorm(a), sb = getStatusNorm(b);
    if (sa === "manutencao" && sb !== "manutencao") return -1;
    if (sb === "manutencao" && sa !== "manutencao") return 1;
    return (a.tipo || "").localeCompare(b.tipo || "");
  }), [items]);

  if (!items.length) return <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 15 }}>Nenhum equipamento encontrado.</div>;

  const cols = "160px 170px 210px 130px 110px 100px 110px";
  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", padding: "9px 16px", gap: 8 }}>
        {["Frota", "Tipo", "Equipe / Responsável", "Empresa", "Status", "Situação", "Valor/mês"].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
        ))}
      </div>
      {sorted.map((e, i) => {
        const st = getStatusNorm(e), badge = STATUS_BADGE[st], terceiro = isTerceiro(e), isManut = st === "manutencao";
        const empresa = e.empresa_proprietaria || e.locadora || (terceiro ? "Terceiro" : "—");
        return (
          <div key={e.id} style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", gap: 8, borderBottom: "1px solid #f8fafc", background: isManut ? "#fffbeb" : (i % 2 === 0 ? "white" : "#fafbfc"), borderLeft: isManut ? "4px solid #f59e0b" : "4px solid transparent" }}>
            <div>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: "#0A0F2C", wordBreak: "break-word", lineHeight: 1.2, display: "block" }}>{e.frota || e.placa || "—"}</span>
              {e.placa && e.placa !== e.frota && <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{e.placa}</p>}
            </div>
            <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.tipo || e.nome || "—"}</span>
            <div style={{ alignSelf: "center", overflow: "hidden" }}>
              <p style={{ fontSize: 12, color: "#1e3a5f", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{e.setor || "—"}</p>
              {e.condutor_atual && <p style={{ fontSize: 11, color: "#9ca3af" }}>👤 {e.condutor_atual}</p>}
            </div>
            <span style={{ fontSize: 12, color: terceiro ? "#1d4ed8" : "#166534", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{empresa}</span>
            <div style={{ alignSelf: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.cor, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, display: "inline-block" }} /> {badge.label}
              </span>
              {isManut && e.motivo_manutencao && <p style={{ fontSize: 10, color: "#92400e", marginTop: 3 }}>⚠️ {e.motivo_manutencao}</p>}
              {isManut && e.previsao_liberacao && <p style={{ fontSize: 10, color: "#1d4ed8", marginTop: 1 }}>📅 {fmtDate(e.previsao_liberacao)}</p>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, alignSelf: "center", color: terceiro ? "#1d4ed8" : "#166534", background: terceiro ? "#eff6ff" : "#f0fdf4", padding: "3px 10px", borderRadius: 20, display: "inline-block", textAlign: "center" }}>{terceiro ? "Terceiro" : "Próprio"}</span>
            <span style={{ fontSize: 12, fontWeight: e.valor_mensal > 0 ? 700 : 400, alignSelf: "center", color: e.valor_mensal > 0 ? "#ea580c" : "#9ca3af" }}>{formatBRL(e.valor_mensal)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────

const TOOLBAR_H = 50;
const HEADER_H  = 46;
const SIDEBAR_W = 220;

export default function GestaoFrotasDashboard() {
  const navigate = useNavigate();
  const [todos, setTodos]           = useState<Equip[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modoVis, setModoVis]       = useState<"tipo" | "equipe">("tipo");
  const [chipSel, setChipSel]       = useState("todos");
  const [subChipSel, setSubChipSel] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos"|"operacional"|"manutencao"|"terceiro"|"disposicao">("todos");
  const [busca, setBusca]           = useState("");

  // Apresentação
  const [modoApres, setModoApres]   = useState(false);
  const [zoom, setZoom]             = useState(1);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("nav");
  const [cor, setCor]               = useState("#ef4444");
  const [esp, setEsp]               = useState(3);
  const [formas, setFormas]         = useState<Forma[]>([]);
  const [formaPreview, setFormaPreview] = useState<Forma | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textInput, setTextInput]   = useState<{ svgX: number; svgY: number; screenX: number; screenY: number } | null>(null);
  const [textVal, setTextVal]       = useState("");

  // Refs para SVG e interações (sem criar closure stale)
  const svgRef        = useRef<SVGSVGElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const drawRef       = useRef<{ startPt: { x:number; y:number }; pts: { x:number; y:number }[] } | null>(null);
  const dragRef       = useRef<{ id: string; startPt: { x:number; y:number }; origForma: Forma } | null>(null);
  const zoomRef       = useRef(zoom);
  const ferramentaRef = useRef(ferramenta);
  const corRef        = useRef(cor);
  const espRef        = useRef(esp);
  useEffect(() => { zoomRef.current = zoom; },             [zoom]);
  useEffect(() => { ferramentaRef.current = ferramenta; }, [ferramenta]);
  useEffect(() => { corRef.current = cor; },               [cor]);
  useEffect(() => { espRef.current = esp; },               [esp]);

  // Dados
  useEffect(() => {
    (supabase as any).from("equipamentos").select("*").order("tipo,frota").then(({ data }: any) => {
      if (data) setTodos(data);
      setLoading(false);
    });
  }, []);

  // Delete key para remover selecionado
  useEffect(() => {
    if (!modoApres) return;
    const handle = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.activeElement?.tagName !== "INPUT") {
        setFormas(prev => prev.filter(f => f.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") { setSelectedId(null); setTextInput(null); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [modoApres, selectedId]);

  // Global mousemove/mouseup: garante que arrasto fora do SVG ainda funciona
  useEffect(() => {
    if (!modoApres) return;
    const handleMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const pt = getSvgPtFrom(e.clientX, e.clientY);

      if (dragRef.current) {
        const dx = pt.x - dragRef.current.startPt.x;
        const dy = pt.y - dragRef.current.startPt.y;
        const { id, origForma } = dragRef.current;
        setFormas(prev => prev.map(f => f.id === id ? translateForma(origForma, dx, dy) : f));
        return;
      }
      if (!drawRef.current) return;
      const { startPt, pts } = drawRef.current;
      const ft = ferramentaRef.current;
      if (ft === "caneta") {
        pts.push(pt);
        drawRef.current.pts = pts;
        setFormaPreview({ id: "_p", tipo: "caneta", cor: corRef.current, esp: espRef.current, pontos: [...pts] });
      } else if (ft !== "nav" && ft !== "selecionar" && ft !== "texto") {
        setFormaPreview({ id: "_p", tipo: ft as any, cor: corRef.current, esp: espRef.current, x1: startPt.x, y1: startPt.y, x2: pt.x, y2: pt.y });
      }
    };
    const handleUp = (e: MouseEvent) => {
      if (dragRef.current) { dragRef.current = null; return; }
      if (!drawRef.current) return;
      const pt = getSvgPtFrom(e.clientX, e.clientY);
      const { startPt, pts } = drawRef.current;
      const ft = ferramentaRef.current;
      const nova: Forma = { id: Date.now().toString(), tipo: ft as any, cor: corRef.current, esp: espRef.current };
      if (ft === "caneta") {
        pts.push(pt);
        if (pts.length < 2) { drawRef.current = null; setFormaPreview(null); return; }
        nova.pontos = [...pts];
      } else {
        nova.x1 = startPt.x; nova.y1 = startPt.y; nova.x2 = pt.x; nova.y2 = pt.y;
        if (Math.abs(nova.x2 - nova.x1) < 4 && Math.abs(nova.y2 - nova.y1) < 4) {
          drawRef.current = null; setFormaPreview(null); return;
        }
      }
      setFormas(prev => [...prev, nova]);
      setFormaPreview(null);
      drawRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup",   handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [modoApres]);

  function getSvgPtFrom(clientX: number, clientY: number) {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoomRef.current, y: (clientY - rect.top) / zoomRef.current };
  }

  // SVG events
  function onSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget && ferramentaRef.current === "selecionar") {
      // clicked on a shape child — handled by SvgFormaEl
      return;
    }
    const ft = ferramentaRef.current;
    if (ft === "nav") return;
    if (ft === "selecionar") { setSelectedId(null); return; }
    if (ft === "texto") {
      const pt = getSvgPtFrom(e.clientX, e.clientY);
      setTextInput({ svgX: pt.x, svgY: pt.y, screenX: e.clientX, screenY: e.clientY });
      setTextVal(""); return;
    }
    const pt = getSvgPtFrom(e.clientX, e.clientY);
    drawRef.current = { startPt: pt, pts: [pt] };
    setFormaPreview({ id: "_p", tipo: ft as any, cor: corRef.current, esp: espRef.current, pontos: [pt], x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    e.stopPropagation();
  }

  function onShapeMouseDown(e: React.MouseEvent<SVGGElement>, id: string) {
    e.stopPropagation();
    if (ferramentaRef.current !== "selecionar") return;
    setSelectedId(id);
    const pt = getSvgPtFrom(e.clientX, e.clientY);
    const origForma = formas.find(f => f.id === id)!;
    dragRef.current = { id, startPt: pt, origForma };
  }

  function confirmarTexto() {
    if (!textInput || !textVal.trim()) { setTextInput(null); return; }
    const ts = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setFormas(prev => [...prev, { id: Date.now().toString(), tipo: "texto", cor, esp: 1, x1: textInput.svgX, y1: textInput.svgY, texto: textVal.trim(), ts }]);
    setTextInput(null); setTextVal("");
  }

  function exportarAnotacoes() {
    const textos = formas.filter(f => f.tipo === "texto" && f.texto);
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const hora    = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Equipamentos em manutenção da lista atual
    const emManut  = listaFiltrada.filter(e => getStatusNorm(e) === "manutencao");
    const terceiros = listaFiltrada.filter(isTerceiro);

    const sep  = "─".repeat(52);
    const sep2 = "═".repeat(52);

    let txt = "";
    txt += sep2 + "\n";
    txt += "  ATA DE REUNIÃO SEMANAL — GESTÃO DE FROTAS\n";
    txt += "  Workflux · Fremix Pavimentação\n";
    txt += sep2 + "\n\n";

    txt += `Data      : ${dateStr}\n`;
    txt += `Horário   : ${hora}\n`;
    txt += `Gerado por: Dashboard de Frotas — Workflux\n\n`;

    txt += sep + "\n";
    txt += "1. ESCOPO DA REUNIÃO\n";
    txt += sep + "\n";
    txt += `Filtro ativo : ${chipLabel}\n`;
    txt += `Total analisado : ${kpiSel.total} equipamento${kpiSel.total !== 1 ? "s" : ""}\n`;
    txt += `Operacionais : ${kpiSel.total - kpiSel.manut - listaFiltrada.filter(e => getStatusNorm(e) === "disposicao").length}\n`;
    if (kpiSel.manut > 0)      txt += `Em manutenção: ${kpiSel.manut}\n`;
    if (kpiSel.terceiros > 0)  txt += `Locados (3º) : ${kpiSel.terceiros}\n`;
    if (kpiSel.custo > 0)      txt += `Custo locação: ${formatBRL(kpiSel.custo)}/mês\n`;
    txt += "\n";

    if (emManut.length > 0) {
      txt += sep + "\n";
      txt += "2. EQUIPAMENTOS EM MANUTENÇÃO\n";
      txt += sep + "\n";
      emManut.forEach(e => {
        txt += `• ${e.frota || e.placa || "—"} — ${e.tipo || "—"}`;
        if (e.setor) txt += ` (${e.setor})`;
        txt += "\n";
        if (e.motivo_manutencao) txt += `  Motivo  : ${e.motivo_manutencao}\n`;
        if (e.previsao_liberacao) txt += `  Previsão: ${fmtDate(e.previsao_liberacao)}\n`;
      });
      txt += "\n";
    }

    if (terceiros.length > 0) {
      txt += sep + "\n";
      txt += "3. EQUIPAMENTOS LOCADOS\n";
      txt += sep + "\n";
      // Agrupa por empresa
      const porEmpresa: Record<string, typeof terceiros> = {};
      terceiros.forEach(e => {
        const emp = e.empresa_proprietaria || e.locadora || "Sem empresa";
        if (!porEmpresa[emp]) porEmpresa[emp] = [];
        porEmpresa[emp].push(e);
      });
      Object.entries(porEmpresa).sort((a, b) => a[0].localeCompare(b[0])).forEach(([emp, equips]) => {
        const custoEmp = equips.reduce((s, e) => s + (e.valor_mensal || 0), 0);
        txt += `\n  ${emp}${custoEmp > 0 ? ` — ${formatBRL(custoEmp)}/mês` : ""}:\n`;
        equips.forEach(e => {
          txt += `    • ${e.frota || e.placa || "—"} — ${e.tipo || "—"}`;
          if (e.setor) txt += ` (${e.setor})`;
          if (e.valor_mensal > 0) txt += ` · ${formatBRL(e.valor_mensal)}/mês`;
          txt += "\n";
        });
      });
      txt += `\n  Total locação: ${formatBRL(kpiSel.custo)}/mês\n\n`;
    }

    txt += sep + "\n";
    txt += `${emManut.length > 0 || terceiros.length > 0 ? "4" : "2"}. ANOTAÇÕES DA REUNIÃO\n`;
    txt += sep + "\n";
    if (textos.length === 0) {
      txt += "  (Nenhuma anotação registrada durante a apresentação)\n";
    } else {
      textos.forEach((a, i) => {
        txt += `\n  [${a.ts ?? "--:--"}] Anotação ${i + 1}:\n`;
        txt += `  ${a.texto}\n`;
      });
    }
    txt += "\n";

    txt += sep + "\n";
    txt += `${emManut.length > 0 || terceiros.length > 0 ? "5" : "3"}. ENCERRAMENTO\n`;
    txt += sep + "\n";
    txt += `Reunião encerrada às ${hora} · ${dateStr}\n`;
    txt += "Documento gerado automaticamente pelo Workflux.\n\n";
    txt += sep2 + "\n";

    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ata-reuniao-frotas-${now.toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const getCursor = () => {
    if (ferramenta === "nav") return "default";
    if (ferramenta === "selecionar") return "default";
    if (ferramenta === "texto") return "text";
    return "crosshair";
  };

  // ── MEMOS ─────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const terceiros = todos.filter(isTerceiro).length;
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
    [...new Set(todos.map(e => (e.tipo || "").toUpperCase()).filter(t => t && !tiposNoGrupo.includes(t)))].sort().forEach(tipo => {
      const count = todos.filter(e => (e.tipo || "").toUpperCase() === tipo).length;
      if (count > 0) chips.push({ key: tipo, label: tipo.charAt(0) + tipo.slice(1).toLowerCase(), count });
    });
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
        lista = grupo
          ? (subChipSel !== "todos" ? lista.filter(e => (e.tipo || "").toUpperCase() === subChipSel.toUpperCase()) : lista.filter(e => grupo.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase())))
          : lista.filter(e => (e.tipo || "").toUpperCase() === chipSel.toUpperCase());
      } else { lista = lista.filter(e => e.setor === chipSel); }
    }
    if (filtroStatus === "manutencao")   lista = lista.filter(e => getStatusNorm(e) === "manutencao");
    else if (filtroStatus === "operacional") lista = lista.filter(e => getStatusNorm(e) === "operacional");
    else if (filtroStatus === "terceiro")    lista = lista.filter(isTerceiro);
    else if (filtroStatus === "disposicao") lista = lista.filter(e => getStatusNorm(e) === "disposicao");
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(e => [e.frota, e.placa, e.tipo, e.nome, e.setor, e.condutor_atual, e.empresa_proprietaria, e.locadora].some(f => f?.toLowerCase().includes(b)));
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
    : subChipSel !== "todos" ? subChipSel.charAt(0) + subChipSel.slice(1).toLowerCase()
    : (chips.find(c => c.key === chipSel)?.label ?? chipSel);

  function trocarModo(m: "tipo" | "equipe") { setModoVis(m); setChipSel("todos"); setSubChipSel("todos"); setBusca(""); setFiltroStatus("todos"); }

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────

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
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, paddingLeft: 4 }}>{modoVis === "tipo" ? "Tipo" : "Equipe"}</p>
          <SideChip label="Todos" count={todos.length} ativo={chipSel === "todos"} manut={todos.filter(e => getStatusNorm(e) === "manutencao").length} onClick={() => setChipSel("todos")} />
          {chips.map(c => (
            <div key={c.key}>
              <SideChip label={c.label} count={c.count} ativo={chipSel === c.key && subChipSel === "todos"}
                manut={modoVis === "tipo"
                  ? (() => { const g = GRUPOS_CHIP.find(g => g.key === c.key); return todos.filter(e => getStatusNorm(e) === "manutencao" && (g ? g.tipos.some(t => t.toUpperCase() === (e.tipo||"").toUpperCase()) : (e.tipo||"").toUpperCase() === c.key.toUpperCase())).length; })()
                  : todos.filter(e => e.setor === c.key && getStatusNorm(e) === "manutencao").length}
                onClick={() => { setChipSel(c.key); setSubChipSel("todos"); }}
              />
              {modoVis === "tipo" && chipSel === c.key && (() => {
                const grupo = GRUPOS_CHIP.find(g => g.key === c.key); if (!grupo) return null;
                const subs = grupo.tipos.filter(t => todos.some(e => (e.tipo||"").toUpperCase() === t.toUpperCase()));
                if (subs.length <= 1) return null;
                return (
                  <div style={{ paddingLeft: 10, marginBottom: 4 }}>
                    {subs.map(sub => {
                      const lbl = sub.replace("CAMINHÃO ","").replace("CAMINHAO ","");
                      return <SideChip key={sub} label={"↳ " + lbl.charAt(0) + lbl.slice(1).toLowerCase()} count={todos.filter(e => (e.tipo||"").toUpperCase() === sub.toUpperCase()).length} ativo={subChipSel === sub} manut={todos.filter(e => (e.tipo||"").toUpperCase() === sub.toUpperCase() && getStatusNorm(e) === "manutencao").length} onClick={() => setSubChipSel(sub)} />;
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

  // ── CONTEÚDO ──────────────────────────────────────────────────────────────────

  function renderConteudo() {
    return (
      <main style={{ flex: 1, padding: "16px 18px", background: "#f0f4f8", minHeight: "100%" }}>
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
            {[{ key: "todos", label: "Todos", cor: "#374151" }, { key: "operacional", label: "Operacional", cor: "#166534" }, { key: "manutencao", label: "Manutenção", cor: "#92400e" }, { key: "disposicao", label: "Disposição", cor: "#475569" }, { key: "terceiro", label: "Locados", cor: "#1d4ed8" }].map(f => (
              <button key={f.key} onClick={() => setFiltroStatus(f.key as any)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: filtroStatus === f.key ? f.cor : "#e2e8f0", background: filtroStatus === f.key ? f.cor : "white", color: filtroStatus === f.key ? "white" : "#374151", transition: "all 0.12s" }}>
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
        {loading ? <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af", fontSize: 15 }}>Carregando...</div> : <TabelaEquipamentos items={listaFiltrada} />}
        {!loading && kpiSel.custo > 0 && filtroStatus !== "operacional" && (
          <div style={{ marginTop: 16, background: "white", borderRadius: 14, padding: "14px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6, color: "#0A0F2C" }}>
              <Package size={13} color="#ea580c" /> Locados por Empresa
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(listaFiltrada.filter(isTerceiro).reduce<Record<string, { count: number; custo: number }>>((acc, e) => {
                const emp = e.empresa_proprietaria || e.locadora || "Sem empresa";
                if (!acc[emp]) acc[emp] = { count: 0, custo: 0 };
                acc[emp].count++; acc[emp].custo += (e.valor_mensal || 0); return acc;
              }, {})).sort((a, b) => b[1].custo - a[1].custo).map(([emp, d]) => (
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

  // ── MODO APRESENTAÇÃO ─────────────────────────────────────────────────────────

  if (modoApres) {
    const nTextos = formas.filter(f => f.tipo === "texto").length;
    const selectedForma = formas.find(f => f.id === selectedId);
    const hasFormas = formas.length > 0;

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", overflow: "hidden" }}>

        {/* ── HEADER ── */}
        <header style={{ height: HEADER_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, paddingInline: 14, background: "linear-gradient(135deg, #0A0F2C 0%, #0055AA 100%)", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", zIndex: 9998 }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: "white", whiteSpace: "nowrap" }}>Dashboard de Frotas — Reunião Semanal</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
            {[{ v: kpis.total, l: "total", c: "#93c5fd" }, { v: kpis.proprios, l: "próprios", c: "#86efac" }, { v: kpis.terceiros, l: "terceiros", c: "#fcd34d" }, { v: kpis.manutencao, l: "manutenção", c: "#fb923c" }].map(k => (
              <div key={k.l} style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 16, color: k.c }}>{k.v}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{k.l}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 10 }}>
              <span style={{ fontWeight: 900, fontSize: 12, color: "#fb923c" }}>{formatBRL(kpis.custoMensal)}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>loc./mês</span>
            </div>
          </div>
          {/* Zoom */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "2px 4px" }}>
            <button onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 8px", fontWeight: 300 }}>−</button>
            <span style={{ fontSize: 12, color: "white", fontWeight: 700, minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.5, parseFloat((z + 0.1).toFixed(1))))} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 8px", fontWeight: 300 }}>+</button>
          </div>
          <button onClick={() => setModoApres(false)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 700 }}>
            <Minimize2 size={13} /> Sair
          </button>
        </header>

        {/* ── TOOLBAR ── */}
        <div style={{ height: TOOLBAR_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 4, paddingInline: 12, background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 9998, overflowX: "auto" }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2, whiteSpace: "nowrap" }}>Ferramenta</span>
          {[
            { k: "nav",       icon: "🖱️",  title: "Navegar (scroll)" },
            { k: "selecionar",icon: "↖",   title: "Selecionar / mover / apagar", mono: true },
            { k: "caneta",    icon: "✏️",   title: "Caneta livre" },
            { k: "texto",     icon: "T",    title: "Anotação de texto", mono: true },
            { k: "seta",      icon: "➜",   title: "Seta" },
            { k: "circulo",   icon: "○",    title: "Círculo / Oval" },
            { k: "retangulo", icon: "□",    title: "Retângulo" },
          ].map(t => (
            <button key={t.k} onClick={() => { setFerramenta(t.k as Ferramenta); setSelectedId(null); }} title={t.title}
              style={{ width: 32, height: 32, borderRadius: 7, border: "none", cursor: "pointer", background: ferramenta === t.k ? "#0055AA" : "rgba(255,255,255,0.07)", color: "white", fontSize: t.mono ? 13 : 15, fontFamily: t.mono ? "monospace" : "inherit", fontWeight: t.mono ? 900 : "normal", boxShadow: ferramenta === t.k ? "0 2px 10px rgba(0,85,170,0.55)" : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
              {t.icon}
            </button>
          ))}

          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", marginInline: 5, flexShrink: 0 }} />

          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Cor</span>
          {["#ef4444","#f59e0b","#22c55e","#3b82f6","#ffffff","#fbbf24","#a855f7","#000000"].map(c => (
            <button key={c} onClick={() => setCor(c)}
              style={{ width: 19, height: 19, borderRadius: "50%", border: cor === c ? "3px solid white" : "2px solid rgba(255,255,255,0.15)", background: c, cursor: "pointer", flexShrink: 0, boxShadow: cor === c ? "0 0 0 1px #0055AA" : "none" }} />
          ))}

          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", marginInline: 5, flexShrink: 0 }} />

          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Esp.</span>
          {[{ v: 2, h: 3, w: 14 }, { v: 4, h: 5, w: 14 }, { v: 7, h: 8, w: 14 }].map(s => (
            <button key={s.v} onClick={() => setEsp(s.v)}
              style={{ width: 32, height: 32, borderRadius: 7, border: "none", cursor: "pointer", background: esp === s.v ? "rgba(0,85,170,0.5)" : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: s.w, height: s.h, background: "white", borderRadius: s.h }} />
            </button>
          ))}

          {/* Info selecionado */}
          {selectedForma && (
            <>
              <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", marginInline: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                ✓ {selectedForma.tipo === "texto" ? `"${selectedForma.texto?.substring(0,20)}${(selectedForma.texto?.length ?? 0)>20?"…":""}"` : selectedForma.tipo} selecionado
              </span>
              <button onClick={() => { setFormas(prev => prev.filter(f => f.id !== selectedId)); setSelectedId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 7, cursor: "pointer", color: "#fca5a5", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                <Trash2 size={11} /> Apagar
              </button>
            </>
          )}

          {nTextos > 0 && !selectedForma && (
            <span style={{ fontSize: 10, color: "#86efac", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, marginLeft: 4 }}>📝 {nTextos} anotaç{nTextos === 1 ? "ão" : "ões"}</span>
          )}

          <div style={{ flex: 1 }} />

          {hasFormas && (
            <button onClick={() => { setFormas([]); setSelectedId(null); setFormaPreview(null); }} title="Limpar tudo" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, cursor: "pointer", color: "#fca5a5", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              <Trash2 size={11} /> Limpar
            </button>
          )}
          <button onClick={exportarAnotacoes} title="Exportar anotações (.txt)" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 7, cursor: "pointer", color: "#86efac", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            <Download size={11} /> Exportar
          </button>
        </div>

        {/* ── CORPO: SIDEBAR + CONTEÚDO COM SVG ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {renderSidebar()}

          {/* Área scrollável */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#f0f4f8" }}>
            {/* Wrapper com zoom — SVG fica DENTRO aqui, acompanha tudo */}
            <div style={{ zoom: zoom, position: "relative", minHeight: "100%" }}>
              {renderConteudo()}

              {/* SVG overlay — absolutamente sobre o conteúdo, mesma coordenada */}
              <svg
                ref={svgRef}
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: "100%",
                  pointerEvents: ferramenta !== "nav" ? "all" : "none",
                  cursor: getCursor(),
                  overflow: "visible",
                }}
                onMouseDown={onSvgMouseDown}
                onWheel={e => { scrollRef.current?.scrollBy({ top: e.deltaY, behavior: "auto" }); }}
              >
                {/* Shapes permanentes */}
                {formas.map(f => (
                  <SvgFormaEl
                    key={f.id} f={f}
                    selecionada={selectedId === f.id}
                    ferramenta={ferramenta}
                    onMouseDown={e => onShapeMouseDown(e, f.id)}
                  />
                ))}
                {/* Preview enquanto desenha */}
                {formaPreview && (
                  <SvgFormaEl f={formaPreview} selecionada={false} ferramenta={ferramenta} />
                )}
                {/* Input de texto inline no SVG — removido (usa div fixed abaixo) */}
              </svg>
            </div>
          </div>
        </div>

        {/* ── INPUT DE TEXTO: div fixed, sempre alinhado à tela independente de zoom/scroll ── */}
        {textInput && (
          <div style={{
            position: "fixed",
            left: Math.min(textInput.screenX, window.innerWidth - 310),
            top: Math.max(HEADER_H + TOOLBAR_H + 8, Math.min(textInput.screenY - 40, window.innerHeight - 120)),
            zIndex: 10002,
            background: "white", border: "2px solid #0055AA", borderRadius: 12,
            padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", width: 300,
          }}>
            <p style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>📝 Nova anotação</p>
            <input
              autoFocus value={textVal} onChange={e => setTextVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmarTexto(); if (e.key === "Escape") setTextInput(null); e.stopPropagation(); }}
              placeholder="Digite aqui e pressione Enter..."
              style={{ border: "none", borderBottom: "1.5px solid #e2e8f0", outline: "none", fontSize: 14, width: "100%", background: "transparent", color: "#0A0F2C", fontFamily: "Inter, sans-serif", paddingBottom: 4, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={confirmarTexto} style={{ flex: 1, padding: "7px 0", background: "#0055AA", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓ Confirmar</button>
              <button onClick={() => setTextInput(null)} style={{ padding: "7px 14px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#64748b" }}>✕</button>
            </div>
          </div>
        )}

        {/* Dica de ferramenta seleção */}
        {ferramenta === "selecionar" && !selectedId && (
          <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "white", fontSize: 11, padding: "6px 16px", borderRadius: 20, pointerEvents: "none", zIndex: 10001, whiteSpace: "nowrap" }}>
            Clique para selecionar · Arraste para mover · Del para apagar
          </div>
        )}
      </div>
    );
  }

  // ── MODO NORMAL ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>
      <header className="flex items-center gap-3 px-4 py-2.5 bg-header-gradient shadow-md" style={{ flexShrink: 0 }}>
        <button onClick={() => navigate("/gestao-frotas")} className="text-primary-foreground hover:bg-white/15 p-1.5 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: "white" }}>Dashboard de Frotas — Reunião Semanal</span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[{ v: kpis.total, l: "total", c: "#93c5fd" }, { v: kpis.proprios, l: "próprios", c: "#86efac" }, { v: kpis.terceiros, l: "terceiros", c: "#fcd34d" }, { v: kpis.manutencao, l: "manutenção", c: "#fb923c" }].map(k => (
              <div key={k.l} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 18, color: k.c }}>{k.v}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{k.l}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 16 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 14, color: "#fb923c" }}>{formatBRL(kpis.custoMensal)}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>locados/mês</span>
            </div>
          </div>
        </div>
        <button onClick={() => { setModoApres(true); setFerramenta("nav"); setZoom(1); setFormas([]); setSelectedId(null); }}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 9, cursor: "pointer", color: "white", fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}>
          <Maximize2 size={14} /> Apresentação
        </button>
      </header>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {renderSidebar()}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {renderConteudo()}
        </div>
      </div>
    </div>
  );
}

// ─── CHIP LATERAL ─────────────────────────────────────────────────────────────

function SideChip({ label, count, ativo, manut, onClick }: { label: string; count: number; ativo: boolean; manut: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "8px 10px", borderRadius: 9, marginBottom: 4, background: ativo ? "#0055AA" : "rgba(255,255,255,0.04)", border: ativo ? "none" : "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.12s", boxShadow: ativo ? "0 2px 10px rgba(0,85,170,0.35)" : "none" }}>
      <span style={{ fontSize: 12, fontWeight: ativo ? 700 : 500, color: ativo ? "white" : "rgba(255,255,255,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 6 }}>{label}</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
        {manut > 0 && <span style={{ fontSize: 10, background: "#f59e0b", color: "white", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>⚠️{manut}</span>}
        <span style={{ fontSize: 11, background: ativo ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)", color: ativo ? "white" : "rgba(255,255,255,0.45)", borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>{count}</span>
      </div>
    </button>
  );
}
