import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package, Maximize2, Minimize2, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";

// ─── TYPES ─────────────────────────────────────────────────────────────────────

interface Equip {
  id: string; frota: string; placa: string; nome: string; modelo_completo: string;
  tipo: string; setor: string; condutor_atual: string; condicao: string; categoria: string;
  empresa_proprietaria: string; locadora: string; valor_mensal: number; status: string;
  observacoes: string; motivo_manutencao: string; previsao_liberacao: string;
  // Campos opcionais de localização/obra (nem sempre preenchidos em bases legadas)
  uf?: string;
  estado?: string;
  cidade?: string;
  local?: string;
  obra_nome?: string;
}

type Ferramenta = "nav" | "selecionar" | "caneta" | "seta" | "circulo" | "retangulo" | "texto";

interface Forma {
  id: string;
  tipo: "caneta" | "seta" | "circulo" | "retangulo" | "texto";
  cor: string; esp: number;
  pontos?: { x: number; y: number }[];
  x1?: number; y1?: number; x2?: number; y2?: number;
  texto?: string; ts?: string;
  label?: string; // rótulo opcional para formas desenhadas (circulo, seta, retangulo, caneta)
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function formatBRL(v: number) { if (!v) return "—"; return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDate(d: string) { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }
function normTxt(v: string) {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseValorMensal(v: string): number | null {
  const raw = (v || "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(2));
}

function getStatusNorm(e: Equip): "operacional" | "manutencao" | "inativo" | "disposicao" {
  const s = (e.status || "").toLowerCase().replace(/[_\s]/g, "");
  const setor = (e.setor || "").toLowerCase();

  // Prioridade: status explícito salvo no banco
  if (s.includes("manut")) return "manutencao";
  if (s.includes("disposicao")) return "disposicao";
  if (s.includes("inativo") || s.includes("inoperante")) return "inativo";
  if (s.includes("ativo") || s.includes("operacional")) return "operacional";

  // Fallback legado por setor
  if (setor.includes("manutenção") || setor.includes("manutencao")) return "manutencao";
  if (setor.includes("disposição") || setor.includes("disposicao")) return "disposicao";
  return "operacional";
}
function isTerceiro(e: Equip) { return (e.condicao || "").toUpperCase() === "TERCEIRO" || (e.categoria || "").toLowerCase() === "locado"; }

function getLocalizacaoLabel(e: Equip) {
  return [e.obra_nome, e.local, e.cidade, e.uf || e.estado, e.setor]
    .map(v => (v || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function isForaSP(e: Equip) {
  const uf = (e.uf || "").trim().toUpperCase();
  if (uf) return uf !== "SP";

  const estado = normTxt(e.estado || "");
  if (estado) return estado !== "SP" && estado !== "SAO PAULO";

  // Sem UF/estado confiável, não rotular como fora de SP.
  return false;
}

function hasEquipeDefinida(e: Equip) {
  const setor = (e.setor || "").trim();
  return Boolean(setor && setor !== "—" && !setor.toLowerCase().includes("manutenção / frota"));
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

function TabelaEquipamentos({
  items,
  workshopMode,
  presentationMode = false,
  presentationTvMode = false,
  selectedIds,
  onToggleItem,
  onToggleAllFiltered,
  canEditDashboard,
  equipesCadastro,
  onInlineUpdate,
  inlineSavingId,
  inlineSavedId,
}: {
  items: Equip[];
  workshopMode: boolean;
  presentationMode?: boolean;
  presentationTvMode?: boolean;
  selectedIds: string[];
  onToggleItem: (id: string) => void;
  onToggleAllFiltered: () => void;
  canEditDashboard: boolean;
  equipesCadastro: string[];
  onInlineUpdate: (id: string, changes: { status?: string; setor?: string; valor_mensal?: number }) => Promise<boolean>;
  inlineSavingId: string | null;
  inlineSavedId: string | null;
}) {
  const [editingEquipeId, setEditingEquipeId] = useState<string | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingValorId, setEditingValorId] = useState<string | null>(null);
  const [draftEquipe, setDraftEquipe] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<string>("ativo");
  const [draftValor, setDraftValor] = useState<string>("");

  const sorted = useMemo(() => [...items].sort((a, b) => {
    const sa = getStatusNorm(a), sb = getStatusNorm(b);
    if (sa === "manutencao" && sb !== "manutencao") return -1;
    if (sb === "manutencao" && sa !== "manutencao") return 1;
    return (a.tipo || "").localeCompare(b.tipo || "");
  }), [items]);

  if (!items.length) return <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 15 }}>Nenhum equipamento encontrado.</div>;

  const colBase = "160px 170px 210px 130px 110px 100px 110px";
  const cols = workshopMode ? `40px ${colBase}` : colBase;
  const allSelected = sorted.length > 0 && sorted.every((e) => selectedIds.includes(e.id));

  const podeEditarInline = canEditDashboard && !presentationMode;

  async function salvarValor(id: string) {
    const parsed = parseValorMensal(draftValor);
    if (parsed === null) {
      alert("Informe um valor válido. Ex.: 1350,00");
      return;
    }
    const ok = await onInlineUpdate(id, { valor_mensal: parsed });
    if (ok) setEditingValorId(null);
  }

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: presentationMode ? "auto" : "hidden", maxHeight: presentationMode ? "calc(100vh - 260px)" : undefined, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", padding: "9px 16px", gap: 8, position: "sticky", top: 0, zIndex: 6 }}>
        {workshopMode && (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", position: presentationMode ? "sticky" : "static", left: presentationMode ? 0 : undefined, background: "#f1f5f9", zIndex: presentationMode ? 8 : undefined }}>
            <input type="checkbox" checked={allSelected} onChange={onToggleAllFiltered} />
          </span>
        )}
        {["Frota", "Tipo", "Equipe / Responsável", "Empresa", "Status", "Situação", "Valor/mês"].map((h, idx) => {
          const stickyFrota = presentationMode && idx === 0;
          const stickyStatus = presentationMode && presentationTvMode && idx === 4;
          const stickyStatusLeft = workshopMode ? 710 : 670;
          return (
          <span
            key={h}
            style={{
              fontSize: presentationMode ? (presentationTvMode ? 13 : 12) : 10,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              position: (stickyFrota || stickyStatus) ? "sticky" : "static",
              left: stickyFrota ? (workshopMode ? 48 : 0) : (stickyStatus ? stickyStatusLeft : undefined),
              background: (stickyFrota || stickyStatus) ? "#f1f5f9" : undefined,
              zIndex: stickyFrota ? 7 : (stickyStatus ? 6 : undefined),
            }}
          >
            {h}
          </span>
        )})}
      </div>
      {sorted.map((e, i) => {
        const st = getStatusNorm(e), badge = STATUS_BADGE[st], terceiro = isTerceiro(e), isManut = st === "manutencao", foraSp = isForaSP(e);
        const empresa = e.empresa_proprietaria || e.locadora || (terceiro ? "Terceiro" : "—");
        const isChecked = selectedIds.includes(e.id);
        const rowBg = isChecked
          ? "#dbeafe"
          : isManut
            ? "#fff7ed"
            : foraSp
              ? "#f5f3ff"
              : (i % 2 === 0 ? "white" : "#fafbfc");
        return (
          <div key={e.id} style={{ display: "grid", gridTemplateColumns: cols, padding: presentationTvMode ? "12px 16px" : "10px 16px", gap: 8, borderBottom: "1px solid #f8fafc", background: rowBg, borderLeft: isManut ? "4px solid #f59e0b" : (foraSp ? "4px solid #8b5cf6" : "4px solid transparent") }}>
            {workshopMode && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <input type="checkbox" checked={isChecked} onChange={() => onToggleItem(e.id)} />
              </div>
            )}
            <div style={{ position: presentationMode ? "sticky" : "static", left: presentationMode ? (workshopMode ? 48 : 0) : undefined, zIndex: presentationMode ? 5 : undefined, background: presentationMode ? rowBg : undefined, paddingRight: 6 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: presentationMode ? (presentationTvMode ? 17 : 15) : 12, color: "#0A0F2C", wordBreak: "break-word", lineHeight: 1.2, display: "block" }}>{e.frota || e.placa || "—"}</span>
              {e.placa && e.placa !== e.frota && <p style={{ fontSize: presentationMode ? (presentationTvMode ? 13 : 12) : 10, color: "#9ca3af", marginTop: 1 }}>{e.placa}</p>}
            </div>
            <span style={{ fontSize: presentationMode ? (presentationTvMode ? 15 : 13) : 11, color: "#374151", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.tipo || e.nome || "—"}</span>
            <div style={{ alignSelf: "center", overflow: "hidden" }}>
              {podeEditarInline && editingEquipeId === e.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <select
                    value={draftEquipe}
                    onChange={async (ev) => {
                      const novoSetor = ev.target.value;
                      setDraftEquipe(novoSetor);
                      const ok = await onInlineUpdate(e.id, { setor: novoSetor });
                      if (ok) setEditingEquipeId(null);
                    }}
                    disabled={inlineSavingId === e.id}
                    style={{ height: 30, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 8px", fontSize: 12, background: "#fff" }}
                  >
                    <option value="">Sem equipe</option>
                    {equipesCadastro.map((eq) => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                  <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>Selecione para salvar</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (!podeEditarInline) return;
                      setEditingEquipeId(e.id);
                      setDraftEquipe((e.setor || "").trim());
                    }}
                    disabled={!podeEditarInline || inlineSavingId === e.id}
                    style={{ border: "none", background: "transparent", padding: 0, margin: 0, cursor: podeEditarInline ? "pointer" : "default", textAlign: "left" }}
                  >
                    <p style={{ fontSize: presentationMode ? (presentationTvMode ? 15 : 13) : 12, color: "#1e3a5f", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{e.setor || "—"}</p>
                  </button>
                  {e.condutor_atual && <p style={{ fontSize: presentationMode ? (presentationTvMode ? 13 : 12) : 11, color: "#9ca3af" }}>👤 {e.condutor_atual}</p>}
                  {getLocalizacaoLabel(e) && <p style={{ fontSize: presentationMode ? (presentationTvMode ? 12 : 11) : 10, color: "#64748b", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📍 {getLocalizacaoLabel(e)}</p>}
                </>
              )}
            </div>
            <span style={{ fontSize: presentationMode ? (presentationTvMode ? 14 : 12) : 12, color: terceiro ? "#1d4ed8" : "#166534", fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{empresa}</span>
            <div style={{ alignSelf: "center", position: presentationMode && presentationTvMode ? "sticky" : "static", left: presentationMode && presentationTvMode ? (workshopMode ? 710 : 670) : undefined, background: presentationMode && presentationTvMode ? rowBg : undefined, zIndex: presentationMode && presentationTvMode ? 5 : undefined, paddingRight: presentationMode && presentationTvMode ? 6 : undefined }}>
              {podeEditarInline && editingStatusId === e.id ? (
                <select
                  value={draftStatus}
                  onChange={async (ev) => {
                    const novoStatus = ev.target.value;
                    setDraftStatus(novoStatus);
                    const ok = await onInlineUpdate(e.id, { status: novoStatus });
                    if (ok) setEditingStatusId(null);
                  }}
                  disabled={inlineSavingId === e.id}
                  style={{ height: 30, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 8px", fontSize: 12, background: "#fff", width: "100%" }}
                >
                  <option value="ativo">Operacional</option>
                  <option value="em_manutencao">Manutenção</option>
                  <option value="disposicao">Disposição</option>
                  <option value="inativo">Inativo</option>
                </select>
              ) : (
                <button
                  onClick={() => {
                    if (!podeEditarInline) return;
                    setEditingStatusId(e.id);
                    setDraftStatus(e.status || "ativo");
                  }}
                  disabled={!podeEditarInline || inlineSavingId === e.id}
                  style={{ border: "none", background: "transparent", padding: 0, cursor: podeEditarInline ? "pointer" : "default" }}
                >
                  <span style={{ fontSize: presentationMode ? (presentationTvMode ? 12 : 10) : 10, fontWeight: 700, background: "#f3f4f6", color: "#374151", padding: presentationMode && presentationTvMode ? "4px 10px" : "3px 8px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #e5e7eb" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, display: "inline-block" }} /> {badge.label}
                  </span>
                </button>
              )}
              {inlineSavingId === e.id && <p style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Salvando...</p>}
              {inlineSavingId !== e.id && inlineSavedId === e.id && <p style={{ fontSize: 10, color: "#166534", marginTop: 4 }}>Salvo</p>}
              {foraSp && !isManut && <p style={{ fontSize: presentationMode ? (presentationTvMode ? 11 : 10) : 10, color: "#6d28d9", marginTop: 2, fontWeight: 700 }}>📍 Fora de SP</p>}
              {isManut && e.motivo_manutencao && <p style={{ fontSize: presentationMode ? (presentationTvMode ? 11 : 10) : 10, color: "#92400e", marginTop: 3 }}>⚠️ {e.motivo_manutencao}</p>}
              {isManut && e.previsao_liberacao && <p style={{ fontSize: presentationMode ? (presentationTvMode ? 11 : 10) : 10, color: "#1d4ed8", marginTop: 1 }}>📅 {fmtDate(e.previsao_liberacao)}</p>}
            </div>
            <span style={{ fontSize: presentationMode ? (presentationTvMode ? 12 : 11) : 11, fontWeight: 700, alignSelf: "center", color: terceiro ? "#1d4ed8" : "#166534", background: terceiro ? "#eff6ff" : "#f0fdf4", padding: presentationMode && presentationTvMode ? "4px 12px" : "3px 10px", borderRadius: 20, display: "inline-block", textAlign: "center" }}>{terceiro ? "Terceiro" : "Próprio"}</span>
            <div style={{ alignSelf: "center" }}>
              {podeEditarInline && editingValorId === e.id ? (
                <input
                  value={draftValor}
                  onChange={(ev) => setDraftValor(ev.target.value)}
                  onKeyDown={async (ev) => {
                    if (ev.key === "Enter") {
                      await salvarValor(e.id);
                    }
                    if (ev.key === "Escape") {
                      setEditingValorId(null);
                    }
                  }}
                  placeholder="Ex.: 1350,00 (Enter)"
                  disabled={inlineSavingId === e.id}
                  style={{ width: "100%", height: 30, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 8px", fontSize: 12 }}
                />
              ) : (
                <button
                  onClick={() => {
                    if (!podeEditarInline) return;
                    setEditingValorId(e.id);
                    setDraftValor(e.valor_mensal ? String(e.valor_mensal).replace(".", ",") : "");
                  }}
                  disabled={!podeEditarInline || inlineSavingId === e.id}
                  style={{ border: "none", background: "transparent", padding: 0, cursor: podeEditarInline ? "pointer" : "default" }}
                >
                  <span style={{ fontSize: presentationMode ? (presentationTvMode ? 13 : 12) : 12, fontWeight: e.valor_mensal > 0 ? 700 : 500, color: e.valor_mensal > 0 ? "#374151" : "#9ca3af" }}>{formatBRL(e.valor_mensal)}</span>
                </button>
              )}
            </div>
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
  const { trail, goTo } = useNavigationTrail({ label: "Dashboard de Frotas" });
  const [todos, setTodos]           = useState<Equip[]>([]);
  const [equipesCadastro, setEquipesCadastro] = useState<string[]>([]);
  const [equipesRows, setEquipesRows] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modoVis, setModoVis]       = useState<"tipo" | "equipe">("tipo");
  const [chipSel, setChipSel]       = useState("todos");
  const [subChipSel, setSubChipSel] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos"|"operacional"|"manutencao"|"terceiro"|"disposicao">("todos");
  const [filtroGeo, setFiltroGeo] = useState<"todos" | "sp" | "fora_sp">("todos");
  const [filtroAlocacao, setFiltroAlocacao] = useState<"todos" | "com_equipe" | "sem_equipe">("todos");
  const [workshopMode, setWorkshopMode] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [loteStatus, setLoteStatus] = useState<string>("__manter__");
  const [loteEquipe, setLoteEquipe] = useState<string>("__manter__");
  const [loteLocal, setLoteLocal] = useState<string>("");
  const [loteValorMode, setLoteValorMode] = useState<"__manter__" | "__definir__" | "__zerar__">("__manter__");
  const [loteValorInput, setLoteValorInput] = useState<string>("");
  const [salvandoLote, setSalvandoLote] = useState(false);

  const [canEditDashboard, setCanEditDashboard] = useState(false);
  const [loadingCanEditDashboard, setLoadingCanEditDashboard] = useState(true);
  const [inlineSavingId, setInlineSavingId] = useState<string | null>(null);
  const [inlineSavedId, setInlineSavedId] = useState<string | null>(null);

  const [progData, setProgData] = useState<string>("2026-09-01");
  const [progPeriodo, setProgPeriodo] = useState<string>("INTEGRAL");
  const [progTipoServico, setProgTipoServico] = useState<string>("OUTRO");
  const [progLocalBase, setProgLocalBase] = useState<string>("");
  const [progObs, setProgObs] = useState<string>("");
  const [salvandoProgramacao, setSalvandoProgramacao] = useState(false);
  const [emailsDestino, setEmailsDestino] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string>("");

  const [busca, setBusca]           = useState("");

  // Apresentação
  const [modoApres, setModoApres]   = useState(false);
  const [apresTvMode, setApresTvMode] = useState(true);
  const [apresPreset, setApresPreset] = useState<"diretoria" | "operacional" | "interestadual">("diretoria");
  const [apenasCriticos, setApenasCriticos] = useState(false);
  const [zoom, setZoom]             = useState(1);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("nav");
  const [cor, setCor]               = useState("#ef4444");
  const [esp, setEsp]               = useState(3);
  const [formas, setFormas]         = useState<Forma[]>([]);
  const [formaPreview, setFormaPreview] = useState<Forma | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textInput, setTextInput]   = useState<{ svgX: number; svgY: number; screenX: number; screenY: number } | null>(null);
  const [textVal, setTextVal]       = useState("");
  // Prompt de rótulo após desenhar forma (circulo, seta, retangulo, caneta)
  const [labelPrompt, setLabelPrompt] = useState<{ forma: Forma; screenX: number; screenY: number } | null>(null);
  const [labelVal, setLabelVal]       = useState("");

  // Refs para SVG e interações (sem criar closure stale)
  const svgRef        = useRef<SVGSVGElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function mostrarToast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(""), 2600);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (inlineSavedTimerRef.current) clearTimeout(inlineSavedTimerRef.current);
    };
  }, []);

  async function carregarDadosBase() {
    setLoading(true);
    const [equipRes, equipesRes] = await Promise.all([
      (supabase as any).from("equipamentos").select("*").order("tipo,frota"),
      (supabase as any).from("ci_equipes").select("*").eq("ativa", true).order("nome"),
    ]);

    if (equipRes?.data) setTodos(equipRes.data);
    if (equipesRes?.data) {
      const rows = (equipesRes.data as any[]) || [];
      setEquipesRows(rows);

      const nomes = rows
        .map((e) => (e?.nome || "").trim())
        .filter(Boolean);
      setEquipesCadastro(nomes);

      if (!emailsDestino.trim()) {
        const emails = rows
          .flatMap((e) => [e?.email, e?.responsavel_email, e?.email_responsavel, e?.gestor_email])
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter((v) => /@/.test(v));

        if (emails.length) {
          setEmailsDestino([...new Set(emails)].join(";"));
        }
      }
    }
    setLoading(false);
  }

  async function carregarPermissaoEdicaoDashboard() {
    setLoadingCanEditDashboard(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setCanEditDashboard(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile?.company_id) {
        setCanEditDashboard(false);
        return;
      }

      if (profile.role === "superadmin" || profile.role === "admin") {
        setCanEditDashboard(true);
        return;
      }

      const { data: panelAccessRow } = await (supabase as any)
        .from("user_admin_panel_access")
        .select("can_access_panel, allowed_sections")
        .eq("user_id", userId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (panelAccessRow?.can_access_panel === false) {
        setCanEditDashboard(false);
        return;
      }

      const { data: assignments } = await supabase
        .from("user_admin_roles")
        .select("role_id")
        .eq("is_active", true)
        .or(`employee_id.eq.${userId},user_id.eq.${userId}`);

      const roleIds = (assignments || []).map((a: any) => a.role_id).filter(Boolean);
      if (roleIds.length === 0) {
        setCanEditDashboard(false);
        return;
      }

      const { data: userPermRows } = await (supabase as any)
        .from("user_admin_permissions")
        .select("resource, action")
        .eq("company_id", profile.company_id)
        .eq("user_id", userId);

      let perms: Array<{ resource: string; action: string }> = [];
      if ((userPermRows || []).length > 0) {
        perms = userPermRows as Array<{ resource: string; action: string }>;
      } else {
        const { data: rolePerms } = await supabase
          .from("admin_permissions")
          .select("resource, action")
          .in("role_id", roleIds);
        perms = (rolePerms || []) as Array<{ resource: string; action: string }>;
      }

      const hasManageMaquinas = perms.some((perm) => {
        const resource = String(perm.resource || "");
        const action = String(perm.action || "");
        if (resource === "all" && action === "manage") return true;
        if (resource === "admin_section.maquinas" && (action === "manage" || action === "edit")) return true;
        return false;
      });

      if (!hasManageMaquinas) {
        setCanEditDashboard(false);
        return;
      }

      const allowedSections = Array.isArray(panelAccessRow?.allowed_sections)
        ? (panelAccessRow.allowed_sections as string[])
        : [];

      if (allowedSections.length > 0 && !allowedSections.includes("maquinas")) {
        setCanEditDashboard(false);
        return;
      }

      setCanEditDashboard(true);
    } catch {
      setCanEditDashboard(false);
    } finally {
      setLoadingCanEditDashboard(false);
    }
  }

  // Dados
  useEffect(() => {
    carregarDadosBase();
    carregarPermissaoEdicaoDashboard();
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
      setFormaPreview(null);
      drawRef.current = null;
      // Abre prompt de rótulo (só para formas não-texto)
      setLabelVal("");
      setLabelPrompt({ forma: nova, screenX: e.clientX, screenY: e.clientY });
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

  function confirmarLabel(pular = false) {
    if (!labelPrompt) return;
    const ts = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const forma = pular || !labelVal.trim()
      ? { ...labelPrompt.forma, ts }
      : { ...labelPrompt.forma, label: labelVal.trim(), ts };
    setFormas(prev => [...prev, forma]);
    setLabelPrompt(null);
    setLabelVal("");
  }

  function exportarAnotacoes() {
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

    // Separa textos e formas com rótulo
    const textos   = formas.filter(f => f.tipo === "texto" && f.texto);
    const rotulos  = formas.filter(f => f.tipo !== "texto" && f.label);
    const formaIcon: Record<string, string> = { seta: "→", circulo: "○", retangulo: "□", caneta: "✏" };

    if (textos.length === 0 && rotulos.length === 0) {
      txt += "  (Nenhuma anotação registrada durante a apresentação)\n";
    } else {
      let idx = 1;
      // Mistura textos e formas com rótulo ordenados por ts
      const todos_anot = [
        ...textos.map(a => ({ ts: a.ts ?? "00:00", icon: "📝", conteudo: a.texto! })),
        ...rotulos.map(a => ({ ts: a.ts ?? "00:00", icon: formaIcon[a.tipo] ?? "◉", conteudo: a.label! })),
      ].sort((a, b) => a.ts.localeCompare(b.ts));

      todos_anot.forEach(a => {
        txt += `\n  [${a.ts}] ${a.icon} Anotação ${idx++}:\n`;
        txt += `  ${a.conteudo}\n`;
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

  const equipesCanonMap = useMemo(() => {
    const map = new Map<string, string>();
    equipesCadastro.forEach((nome) => {
      const limpo = (nome || "").trim();
      if (limpo) map.set(normTxt(limpo), limpo);
    });
    return map;
  }, [equipesCadastro]);

  const chipsDeEquipe = useMemo(() => {
    const counts = new Map<string, number>();
    todos.forEach((e) => {
      const bruto = (e.setor || "").trim();
      if (!bruto) return;
      const canon = equipesCanonMap.get(normTxt(bruto)) || bruto;
      counts.set(canon, (counts.get(canon) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([eq, count]) => ({ key: eq, label: eq, count }));
  }, [todos, equipesCanonMap]);

  const listaFiltrada = useMemo(() => {
    let lista = todos;
    if (chipSel !== "todos") {
      if (modoVis === "tipo") {
        const grupo = GRUPOS_CHIP.find(g => g.key === chipSel);
        lista = grupo
          ? (subChipSel !== "todos" ? lista.filter(e => (e.tipo || "").toUpperCase() === subChipSel.toUpperCase()) : lista.filter(e => grupo.tipos.some(t => t.toUpperCase() === (e.tipo || "").toUpperCase())))
          : lista.filter(e => (e.tipo || "").toUpperCase() === chipSel.toUpperCase());
      } else {
        const alvo = normTxt(chipSel);
        lista = lista.filter(e => {
          const bruto = (e.setor || "").trim();
          if (!bruto) return false;
          const canon = equipesCanonMap.get(normTxt(bruto)) || bruto;
          return normTxt(canon) === alvo;
        });
      }
    }

    if (filtroStatus === "manutencao") lista = lista.filter(e => getStatusNorm(e) === "manutencao");
    else if (filtroStatus === "operacional") lista = lista.filter(e => getStatusNorm(e) === "operacional");
    else if (filtroStatus === "terceiro") lista = lista.filter(isTerceiro);
    else if (filtroStatus === "disposicao") lista = lista.filter(e => getStatusNorm(e) === "disposicao");

    if (filtroGeo === "sp") lista = lista.filter(e => !isForaSP(e));
    else if (filtroGeo === "fora_sp") lista = lista.filter(isForaSP);

    if (filtroAlocacao === "com_equipe") lista = lista.filter(hasEquipeDefinida);
    else if (filtroAlocacao === "sem_equipe") lista = lista.filter(e => !hasEquipeDefinida(e));

    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter(e => [
        e.frota, e.placa, e.tipo, e.nome, e.setor, e.condutor_atual,
        e.empresa_proprietaria, e.locadora, e.uf, e.estado, e.cidade, e.local, e.obra_nome,
      ].some(f => f?.toLowerCase().includes(b)));
    }

    return lista;
  }, [todos, chipSel, subChipSel, modoVis, filtroStatus, filtroGeo, filtroAlocacao, busca, equipesCanonMap]);

  const kpiSel = useMemo(() => {
    const t = listaFiltrada.filter(isTerceiro);
    return { total: listaFiltrada.length, terceiros: t.length, custo: t.reduce((s, e) => s + (e.valor_mensal || 0), 0), manut: listaFiltrada.filter(e => getStatusNorm(e) === "manutencao").length };
  }, [listaFiltrada]);

  const kpiWorkshop = useMemo(() => {
    const foraSP = listaFiltrada.filter(isForaSP).length;
    const semEquipe = listaFiltrada.filter((e) => !hasEquipeDefinida(e)).length;
    const comEquipe = listaFiltrada.length - semEquipe;
    const manutCritica = listaFiltrada.filter((e) => getStatusNorm(e) === "manutencao" && isForaSP(e)).length;
    return { foraSP, semEquipe, comEquipe, manutCritica };
  }, [listaFiltrada]);

  const chips = modoVis === "tipo" ? chipsDoTipo : chipsDeEquipe;
  const chipLabel = chipSel === "todos"
    ? (modoVis === "tipo" ? "Todos os Equipamentos" : "Todas as Equipes")
    : subChipSel !== "todos" ? subChipSel.charAt(0) + subChipSel.slice(1).toLowerCase()
    : (chips.find(c => c.key === chipSel)?.label ?? chipSel);

  function trocarModo(m: "tipo" | "equipe") {
    setModoVis(m);
    setChipSel("todos");
    setSubChipSel("todos");
    setBusca("");
    setFiltroStatus("todos");
    setFiltroGeo("todos");
    setFiltroAlocacao("todos");
    setSelecionados([]);
  }

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelecionarFiltrados() {
    const idsFiltro = listaFiltrada.map((e) => e.id);
    const todosDoFiltroSelecionados = idsFiltro.length > 0 && idsFiltro.every((id) => selecionados.includes(id));

    if (todosDoFiltroSelecionados) {
      setSelecionados((prev) => prev.filter((id) => !idsFiltro.includes(id)));
    } else {
      setSelecionados((prev) => [...new Set([...prev, ...idsFiltro])]);
    }
  }

  async function aplicarEdicaoLote() {
    if (loadingCanEditDashboard) {
      alert("Validando permissões... tente novamente em alguns segundos.");
      return;
    }

    if (!canEditDashboard) {
      alert("Você não tem permissão para editar equipamentos neste dashboard.");
      return;
    }

    if (!selecionados.length) {
      alert("Selecione pelo menos 1 equipamento.");
      return;
    }

    const atualizarStatus = loteStatus !== "__manter__";
    const atualizarEquipe = loteEquipe !== "__manter__";
    const atualizarLocal = loteLocal.trim().length > 0;
    const atualizarValor = loteValorMode !== "__manter__";

    let valorMensalParsed: number | null = null;
    if (loteValorMode === "__definir__") {
      valorMensalParsed = parseValorMensal(loteValorInput);
      if (valorMensalParsed === null) {
        alert("Informe um valor mensal válido (ex.: 1350,00).");
        return;
      }
    }

    if (!atualizarStatus && !atualizarEquipe && !atualizarLocal && !atualizarValor) {
      alert("Defina ao menos 1 campo para aplicar no lote.");
      return;
    }

    setSalvandoLote(true);
    try {
      const { data, error } = await (supabase as any).rpc("update_equipamentos_dashboard_lote", {
        p_ids: selecionados,
        p_status: atualizarStatus ? loteStatus : null,
        p_setor: atualizarEquipe ? loteEquipe : null,
        p_local_atual: atualizarLocal ? loteLocal.trim() : null,
        p_valor_mode:
          loteValorMode === "__definir__"
            ? "definir"
            : loteValorMode === "__zerar__"
              ? "zerar"
              : "manter",
        p_valor_mensal: loteValorMode === "__definir__" ? valorMensalParsed : null,
      });

      if (error) throw error;

      const row = Array.isArray(data) && data.length ? data[0] : null;
      const ok = Number(row?.updated_count || 0);
      const fail = Number(row?.denied_count || 0);

      await carregarDadosBase();
      setSelecionados([]);

      if (fail > 0) {
        alert(`Lote finalizado com pendências: ${ok} sucesso(s) e ${fail} bloqueado(s).`);
      } else {
        alert(`Lote aplicado com sucesso em ${ok} equipamento(s).`);
      }
    } catch (err: any) {
      alert(`Falha ao aplicar lote: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSalvandoLote(false);
    }
  }

  async function salvarEdicaoIndividual(id: string, changes: { status?: string; setor?: string; valor_mensal?: number }) {
    if (!canEditDashboard) {
      alert("Você não tem permissão para editar equipamentos neste dashboard.");
      return false;
    }

    setInlineSavingId(id);
    try {
      const { data, error } = await (supabase as any).rpc("update_equipamentos_dashboard_lote", {
        p_ids: [id],
        p_status: typeof changes.status === "string" ? changes.status : null,
        p_setor: typeof changes.setor === "string" ? changes.setor : null,
        p_local_atual: null,
        p_valor_mode: typeof changes.valor_mensal === "number" ? "definir" : "manter",
        p_valor_mensal: typeof changes.valor_mensal === "number" ? changes.valor_mensal : null,
      });

      if (error) throw error;
      const row = Array.isArray(data) && data.length ? data[0] : null;
      const ok = Number(row?.updated_count || 0);
      if (ok <= 0) {
        alert("Edição bloqueada por permissão ou item não encontrado.");
        return false;
      }

      await carregarDadosBase();
      setInlineSavedId(id);
      if (inlineSavedTimerRef.current) clearTimeout(inlineSavedTimerRef.current);
      inlineSavedTimerRef.current = setTimeout(() => setInlineSavedId((prev) => (prev === id ? null : prev)), 1800);
      return true;
    } catch (err: any) {
      alert(`Falha ao salvar edição: ${err?.message || "erro desconhecido"}`);
      return false;
    } finally {
      setInlineSavingId(null);
    }
  }

  async function programarSelecionados() {
    if (!selecionados.length) {
      alert("Selecione os equipamentos para programar.");
      return;
    }

    if (!progData) {
      alert("Defina a data da programação.");
      return;
    }

    const selecionadosRows = todos.filter((e) => selecionados.includes(e.id));
    if (!selecionadosRows.length) {
      alert("Não foi possível montar a programação com a seleção atual.");
      return;
    }

    const grupos = selecionadosRows.reduce<Record<string, Equip[]>>((acc, e) => {
      const equipe = (e.setor || "SEM EQUIPE").trim() || "SEM EQUIPE";
      if (!acc[equipe]) acc[equipe] = [];
      acc[equipe].push(e);
      return acc;
    }, {});

    setSalvandoProgramacao(true);
    try {
      let criadas = 0;

      for (const [equipe, itens] of Object.entries(grupos)) {
        const frotas = itens.map((i) => i.frota || i.placa).filter(Boolean);
        const localInferido = progLocalBase.trim() || itens.map(getLocalizacaoLabel).find(Boolean) || null;

        const payload = {
          data: progData,
          equipe,
          responsavel: null,
          ogs: null,
          cliente: "FREMIX",
          local: localInferido,
          periodo: progPeriodo,
          status_equipe: "TRABALHOU",
          status_programacao: "AGUARDANDO_MANUTENCAO",
          equipamentos_designados: frotas,
          carretas_designadas: [],
          engenheiro_responsavel: null,
          obs: progObs || "Programação criada no Workshop Executivo de Frotas",
          tipo_servico: progTipoServico || "OUTRO",
          confirmado_manutencao: false,
        };

        const { error } = await (supabase as any).from("ci_programacoes").insert(payload);
        if (!error) criadas += 1;
      }

      alert(`Programações futuras criadas: ${criadas} registro(s) em ci_programacoes para ${progData}.`);
    } finally {
      setSalvandoProgramacao(false);
    }
  }

  function getBaseExportRows() {
    if (selecionados.length > 0) {
      const byId = new Map(todos.map((e) => [e.id, e]));
      return selecionados.map((id) => byId.get(id)).filter(Boolean) as Equip[];
    }
    return listaFiltrada;
  }

  function baixarCsvWorkshop(rows: Equip[], fileName?: string) {
    if (!rows.length) return null;

    const header = [
      "Frota",
      "Tipo",
      "Equipe/Setor",
      "Status",
      "Situação",
      "Empresa",
      "Valor/mês",
      "Localização",
      "Fora_SP",
      "Data_programada",
      "Período_programado",
      "Tipo_serviço_programado",
      "Obs_workshop",
    ];

    const body = rows.map((e) => {
      const st = STATUS_BADGE[getStatusNorm(e)]?.label || "—";
      const situacao = isTerceiro(e) ? "Terceiro" : "Próprio";
      const empresa = e.empresa_proprietaria || e.locadora || "";
      return [
        e.frota || e.placa || "",
        e.tipo || "",
        e.setor || "",
        st,
        situacao,
        empresa,
        e.valor_mensal || 0,
        getLocalizacaoLabel(e),
        isForaSP(e) ? "SIM" : "NÃO",
        progData,
        progPeriodo,
        progTipoServico,
        progObs || "",
      ];
    });

    const csv = [header, ...body]
      .map((line) => line.map((v) => `"${String(v ?? "").replaceAll("\"", "\"\"")}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const resolvedName = fileName || `workshop-frotas-${progData}.csv`;
    a.href = url;
    a.download = resolvedName;
    a.click();
    URL.revokeObjectURL(url);
    return resolvedName;
  }

  function exportarWorkshopCsv() {
    const rows = getBaseExportRows();
    if (!rows.length) {
      alert("Sem dados para exportar.");
      return;
    }
    baixarCsvWorkshop(rows);
  }

  function encaminharPorEmail() {
    const rows = getBaseExportRows();
    if (!rows.length) {
      alert("Sem dados para encaminhar.");
      return;
    }

    const destinatarios = emailsDestino
      .split(/[;,\s]+/)
      .map((e) => e.trim())
      .filter((e) => /@/.test(e));

    const total = rows.length;
    const manut = rows.filter((e) => getStatusNorm(e) === "manutencao").length;
    const fora = rows.filter(isForaSP).length;
    const terceiros = rows.filter(isTerceiro).length;

    const equipesComResp = equipesRows
      .map((r) => `${r.nome || "Equipe"}${r.responsavel ? ` (${r.responsavel})` : ""}`)
      .slice(0, 12)
      .join(", ");

    const subject = `Workshop Frotas Fremix — decisões e programação ${progData}`;
    const body = [
      "Prezados,",
      "",
      "Segue consolidado do Workshop Executivo de Frotas:",
      `• Total analisado: ${total}`,
      `• Em manutenção: ${manut}`,
      `• Fora de SP: ${fora}`,
      `• Terceiros: ${terceiros}`,
      `• Programação alvo: ${progData} (${progPeriodo})`,
      progObs ? `• Observação: ${progObs}` : "",
      "",
      "Anexo: CSV exportado pelo Workflux (workshop-frotas).",
      "",
      `Equipes/responsáveis envolvidos: ${equipesComResp || "(preencher)"}`,
      "",
      "Atenciosamente,",
      "Fremix / Workflux",
    ].filter(Boolean).join("\n");

    const to = destinatarios.join(",");
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_self");
  }

  function aplicarPresetApresentacao(preset: "diretoria" | "operacional" | "interestadual") {
    setApresPreset(preset);
    setBusca("");
    setApenasCriticos(false);

    if (preset === "diretoria") {
      setFiltroStatus("todos");
      setFiltroGeo("todos");
      setFiltroAlocacao("todos");
      return;
    }

    if (preset === "operacional") {
      setFiltroStatus("operacional");
      setFiltroGeo("todos");
      setFiltroAlocacao("com_equipe");
      return;
    }

    // Preset transporte interestadual
    setFiltroStatus("todos");
    setFiltroGeo("fora_sp");
    setFiltroAlocacao("todos");
  }

  function montarPautaReuniao() {
    const listaBase = apenasCriticos
      ? listaFiltrada.filter((e) => getStatusNorm(e) === "manutencao" || isForaSP(e))
      : listaFiltrada;

    const terceiros = listaBase.filter(isTerceiro);
    const manut = listaBase.filter((e) => getStatusNorm(e) === "manutencao");
    const foraSp = listaBase.filter(isForaSP);
    const custo = terceiros.reduce((s, e) => s + (e.valor_mensal || 0), 0);

    const topCustos = [...terceiros]
      .sort((a, b) => (b.valor_mensal || 0) - (a.valor_mensal || 0))
      .slice(0, 10);

    const now = new Date();
    const dataGeracao = now.toLocaleString("pt-BR");
    const sep = "=".repeat(64);

    let txt = "";
    txt += `${sep}\n`;
    txt += "PAUTA EXECUTIVA — WORKSHOP DE FROTAS (TRANSPORTE / ALOCAÇÃO)\n";
    txt += `${sep}\n\n`;
    txt += `Gerado em: ${dataGeracao}\n`;
    txt += `Preset ativo: ${apresPreset}\n`;
    txt += `Filtro críticos: ${apenasCriticos ? "SIM" : "NÃO"}\n`;
    txt += `Programação alvo: ${progData} (${progPeriodo})\n\n`;

    txt += "1) NÚMEROS-CHAVE\n";
    txt += `- Equipamentos em tela: ${listaBase.length}\n`;
    txt += `- Fora de SP: ${foraSp.length}\n`;
    txt += `- Em manutenção: ${manut.length}\n`;
    txt += `- Terceiros: ${terceiros.length}\n`;
    txt += `- Custo mensal terceiros: ${formatBRL(custo)}\n\n`;

    txt += "2) ITENS CRÍTICOS PARA DECISÃO\n";
    if (!foraSp.length && !manut.length) {
      txt += "- Nenhum item crítico no filtro atual.\n\n";
    } else {
      const criticos = listaBase
        .filter((e) => getStatusNorm(e) === "manutencao" || isForaSP(e))
        .slice(0, 30);
      criticos.forEach((e) => {
        const frota = e.frota || e.placa || "—";
        const tipo = e.tipo || e.nome || "—";
        const st = STATUS_BADGE[getStatusNorm(e)].label;
        const loc = getLocalizacaoLabel(e) || "(sem local definido)";
        const emp = e.empresa_proprietaria || e.locadora || (isTerceiro(e) ? "Terceiro" : "Próprio");
        txt += `- ${frota} | ${tipo} | ${st} | ${loc} | ${emp}\n`;
      });
      txt += "\n";
    }

    txt += "3) TOP CUSTOS DE LOCAÇÃO (apoio à decisão transportar x alugar)\n";
    if (!topCustos.length) {
      txt += "- Sem locações no filtro atual.\n\n";
    } else {
      topCustos.forEach((e, i) => {
        txt += `${i + 1}. ${e.frota || e.placa || "—"} | ${e.tipo || "—"} | ${formatBRL(e.valor_mensal || 0)}/mês\n`;
      });
      txt += "\n";
    }

    txt += "4) ENCAMINHAMENTOS SUGERIDOS\n";
    txt += "- Validar permanência/transferência dos itens fora de SP.\n";
    txt += "- Priorizar manutenção dos itens críticos com impacto em operação.\n";
    txt += "- Revisar substituição de locados de maior custo.\n";
    txt += "- Fechar programação alvo e responsáveis por equipe.\n\n";

    txt += `${sep}\n`;

    return { txt, now, listaBase, terceiros, manut, foraSp, custo };
  }

  function gerarPautaReuniao() {
    const { txt, now } = montarPautaReuniao();
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pauta-workshop-frotas-${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function gerarPautaEAbrirEmail() {
    const { txt, listaBase, terceiros, manut, foraSp, custo } = montarPautaReuniao();

    const stamp = new Date().toISOString().slice(0, 10);
    const pautaFile = `pauta-workshop-frotas-${stamp}.txt`;
    const csvFile = `workshop-frotas-${progData}.csv`;

    // exporta pauta
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = pautaFile;
    a.click();
    URL.revokeObjectURL(a.href);

    // exporta CSV no mesmo clique
    const rowsCsv = getBaseExportRows();
    if (!rowsCsv.length) {
      mostrarToast("Sem dados no filtro para gerar CSV/e-mail.");
      return;
    }
    baixarCsvWorkshop(rowsCsv, csvFile);

    const destinatarios = emailsDestino
      .split(/[;,\s]+/)
      .map((e) => e.trim())
      .filter((e) => /@/.test(e));

    const subject = `Pauta executiva workshop frotas — ${progData}`;
    const resumo = [
      "Prezados,",
      "",
      "Segue pauta executiva do workshop.",
      "",
      "Anexos para incluir neste e-mail:",
      `1) ${csvFile}`,
      `2) ${pautaFile}`,
      "",
      `• Equipamentos em tela: ${listaBase.length}`,
      `• Fora de SP: ${foraSp.length}`,
      `• Em manutenção: ${manut.length}`,
      `• Terceiros: ${terceiros.length}`,
      `• Custo mensal terceiros: ${formatBRL(custo)}`,
      "",
      "Resumo da pauta:",
      txt.slice(0, 3500),
      "",
      "Atenciosamente,",
      "Fremix / Workflux",
    ].join("\n");

    const to = destinatarios.join(",");
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(resumo)}`;
    window.open(mailto, "_self");
    mostrarToast(`CSV + pauta gerados. E-mail aberto (${csvFile} e ${pautaFile}).`);
  }

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────

  function renderSidebar() {
    return (
      <aside style={{ width: SIDEBAR_W, flexShrink: 0, background: "#1e293b", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {[{ key: "tipo", label: "Por Tipo", icon: "⚙️" }, { key: "equipe", label: "Por Equipe/Setor", icon: "👥" }].map(m => (
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
                  : todos.filter(e => {
                    const bruto = (e.setor || "").trim();
                    if (!bruto) return false;
                    const canon = equipesCanonMap.get(normTxt(bruto)) || bruto;
                    return normTxt(canon) === normTxt(c.key) && getStatusNorm(e) === "manutencao";
                  }).length}
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

  function renderConteudo(presentationClean = false, tvMode = false) {
    const listaExibicao = presentationClean && apenasCriticos
      ? listaFiltrada.filter((e) => getStatusNorm(e) === "manutencao" || isForaSP(e))
      : listaFiltrada;

    const totalExibicao = listaExibicao.length;
    const terceirosExib = listaExibicao.filter(isTerceiro);
    const kpiExib = {
      total: listaExibicao.length,
      terceiros: terceirosExib.length,
      custo: terceirosExib.reduce((s, e) => s + (e.valor_mensal || 0), 0),
      manut: listaExibicao.filter((e) => getStatusNorm(e) === "manutencao").length,
    };
    const criticosNoFiltro = listaFiltrada.filter((e) => getStatusNorm(e) === "manutencao" || isForaSP(e)).length;

    return (
      <main style={{ flex: 1, padding: presentationClean ? (tvMode ? "12px 16px" : "10px 14px") : "16px 18px", background: "#f0f4f8", minHeight: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: presentationClean ? (tvMode ? 28 : 22) : 18, color: "#0A0F2C", margin: 0 }}>
              {presentationClean ? "Painel Executivo de Frotas" : (workshopMode ? "Workshop Executivo — Gestão de Frotas" : chipLabel)}
            </h2>
            <p style={{ fontSize: presentationClean ? (tvMode ? 16 : 14) : 12, color: "#64748b", marginTop: 2 }}>
              {totalExibicao} equipamento{totalExibicao !== 1 ? "s" : ""}
              {kpiExib.manut > 0 && <span style={{ color: "#b45309", fontWeight: 700 }}> · ⚠️ {kpiExib.manut} em manutenção</span>}
              {kpiExib.terceiros > 0 && <span style={{ color: "#1d4ed8", fontWeight: 600 }}> · {kpiExib.terceiros} terceiros</span>}
              {kpiExib.custo > 0 && <span style={{ color: "#ea580c", fontWeight: 700 }}> · {formatBRL(kpiExib.custo)}/mês</span>}
              {presentationClean && apenasCriticos && <span style={{ color: "#7c3aed", fontWeight: 700 }}> · Somente críticos</span>}
            </p>
          </div>
          {!presentationClean && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setWorkshopMode(v => !v)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: "1.5px solid #0f172a",
                background: workshopMode ? "#0f172a" : "white",
                color: workshopMode ? "white" : "#0f172a",
              }}
            >
              {workshopMode ? "Modo Workshop ON" : "Modo Workshop OFF"}
            </button>
            {[{ key: "todos", label: "Todos", cor: "#374151" }, { key: "operacional", label: "Operacional", cor: "#166534" }, { key: "manutencao", label: "Manutenção", cor: "#92400e" }, { key: "disposicao", label: "Disposição", cor: "#475569" }, { key: "terceiro", label: "Locados", cor: "#1d4ed8" }].map(f => (
              <button key={f.key} onClick={() => setFiltroStatus(f.key as any)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: filtroStatus === f.key ? f.cor : "#e2e8f0", background: filtroStatus === f.key ? f.cor : "white", color: filtroStatus === f.key ? "white" : "#374151", transition: "all 0.12s" }}>
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setFiltroGeo((prev) => (prev === "fora_sp" ? "todos" : "fora_sp"))}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: "1.5px solid",
                borderColor: filtroGeo === "fora_sp" ? "#7c3aed" : "#e2e8f0",
                background: filtroGeo === "fora_sp" ? "#7c3aed" : "white",
                color: filtroGeo === "fora_sp" ? "white" : "#374151",
                transition: "all 0.12s",
              }}
              title="Filtra apenas equipamentos com UF/estado confiável fora de SP"
            >
              Somente fora de SP
            </button>
          </div>
          )}
        </div>

        {presentationClean && (
          <>
            <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ key: "todos", label: "Todos", cor: "#374151" }, { key: "operacional", label: "Operacional", cor: "#166534" }, { key: "manutencao", label: "Manutenção", cor: "#92400e" }, { key: "disposicao", label: "Disposição", cor: "#475569" }, { key: "terceiro", label: "Locados", cor: "#1d4ed8" }].map(f => (
                <button key={f.key} onClick={() => setFiltroStatus(f.key as any)} style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid", borderColor: filtroStatus === f.key ? f.cor : "#cbd5e1", background: filtroStatus === f.key ? f.cor : "white", color: filtroStatus === f.key ? "white" : "#334155" }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => aplicarPresetApresentacao("diretoria")}
                style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid", borderColor: apresPreset === "diretoria" ? "#0f172a" : "#cbd5e1", background: apresPreset === "diretoria" ? "#0f172a" : "white", color: apresPreset === "diretoria" ? "white" : "#334155" }}
              >
                Preset Diretoria
              </button>
              <button
                onClick={() => aplicarPresetApresentacao("operacional")}
                style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid", borderColor: apresPreset === "operacional" ? "#0369a1" : "#cbd5e1", background: apresPreset === "operacional" ? "#0369a1" : "white", color: apresPreset === "operacional" ? "white" : "#334155" }}
              >
                Preset Operacional
              </button>
              <button
                onClick={() => aplicarPresetApresentacao("interestadual")}
                style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 700, cursor: "pointer", border: "1.5px solid", borderColor: apresPreset === "interestadual" ? "#7c3aed" : "#cbd5e1", background: apresPreset === "interestadual" ? "#7c3aed" : "white", color: apresPreset === "interestadual" ? "white" : "#334155" }}
              >
                Preset Transporte Interestadual
              </button>
              <button
                onClick={() => {
                  const next = !apenasCriticos;
                  setApenasCriticos(next);
                  if (next) {
                    setFiltroStatus("todos");
                    setFiltroGeo("todos");
                  }
                }}
                style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 800, cursor: "pointer", border: "1.5px solid", borderColor: apenasCriticos ? "#7c3aed" : "#cbd5e1", background: apenasCriticos ? "#7c3aed" : "white", color: apenasCriticos ? "white" : "#334155" }}
              >
                Somente críticos ({criticosNoFiltro})
              </button>
              <button
                onClick={gerarPautaReuniao}
                style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 800, cursor: "pointer", border: "1.5px solid #0f766e", background: "#0f766e", color: "white" }}
              >
                Gerar pauta da reunião
              </button>
              <button
                onClick={gerarPautaEAbrirEmail}
                style={{ padding: tvMode ? "9px 18px" : "7px 16px", borderRadius: 20, fontSize: tvMode ? 15 : 13, fontWeight: 800, cursor: "pointer", border: "1.5px solid #1d4ed8", background: "#1d4ed8", color: "white" }}
              >
                Gerar pauta + abrir e-mail
              </button>
            </div>
          </>
        )}

        {workshopMode && (
          <div style={{ marginBottom: 12, background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
              {[
                { label: "Fora de SP", value: kpiWorkshop.foraSP, tone: "#7c3aed", bg: "#f5f3ff" },
                { label: "Com equipe", value: kpiWorkshop.comEquipe, tone: "#166534", bg: "#f0fdf4" },
                { label: "Sem equipe", value: kpiWorkshop.semEquipe, tone: "#b91c1c", bg: "#fef2f2" },
                { label: "Manut. fora SP", value: kpiWorkshop.manutCritica, tone: "#92400e", bg: "#fffbeb" },
              ].map((k) => (
                <div key={k.label} style={{ borderRadius: 10, padding: "8px 10px", background: k.bg, border: `1px solid ${k.bg}` }}>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{k.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 900, margin: 0, color: k.tone, lineHeight: 1.1 }}>{k.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ key: "todos", label: "Geo: Todos" }, { key: "sp", label: "Geo: São Paulo" }, { key: "fora_sp", label: "Geo: Fora de SP" }].map((g) => (
                <button
                  key={g.key}
                  onClick={() => setFiltroGeo(g.key as any)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 18,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor: filtroGeo === g.key ? "#7c3aed" : "#e2e8f0",
                    background: filtroGeo === g.key ? "#7c3aed" : "white",
                    color: filtroGeo === g.key ? "white" : "#374151",
                  }}
                >
                  {g.label}
                </button>
              ))}

              {[{ key: "todos", label: "Alocação: Todas" }, { key: "com_equipe", label: "Com equipe" }, { key: "sem_equipe", label: "Sem equipe" }].map((a) => (
                <button
                  key={a.key}
                  onClick={() => setFiltroAlocacao(a.key as any)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 18,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor: filtroAlocacao === a.key ? "#0f766e" : "#e2e8f0",
                    background: filtroAlocacao === a.key ? "#0f766e" : "white",
                    color: filtroAlocacao === a.key ? "white" : "#374151",
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!presentationClean && (workshopMode || canEditDashboard) && (
          <div style={{ marginBottom: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                Edição em lote (selecione na tabela) · {selecionados.length} selecionado(s)
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={toggleSelecionarFiltrados} disabled={!canEditDashboard || loadingCanEditDashboard} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #94a3b8", background: "white", cursor: (!canEditDashboard || loadingCanEditDashboard) ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, opacity: (!canEditDashboard || loadingCanEditDashboard) ? 0.6 : 1 }}>
                  Marcar filtrados
                </button>
                <button onClick={() => setSelecionados([])} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 12 }}>
                  Limpar seleção
                </button>
              </div>
            </div>

            {!loadingCanEditDashboard && !canEditDashboard && (
              <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", fontSize: 12, fontWeight: 600 }}>
                Modo leitura: edição de Equipe, Status e Valor liberada somente para administradores com permissão em Roles Admin (seção Frota/Equipamentos).
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr 1fr 1fr auto", gap: 8 }}>
              <select value={loteStatus} onChange={(e) => setLoteStatus(e.target.value)} disabled={!canEditDashboard || loadingCanEditDashboard} style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12, opacity: (!canEditDashboard || loadingCanEditDashboard) ? 0.65 : 1 }}>
                <option value="__manter__">Status: manter atual</option>
                <option value="ativo">Status: Operacional</option>
                <option value="em_manutencao">Status: Em manutenção</option>
                <option value="disposicao">Status: Disposição</option>
                <option value="inativo">Status: Inativo</option>
              </select>

              <select value={loteEquipe} onChange={(e) => setLoteEquipe(e.target.value)} disabled={!canEditDashboard || loadingCanEditDashboard} style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12, opacity: (!canEditDashboard || loadingCanEditDashboard) ? 0.65 : 1 }}>
                <option value="__manter__">Equipe: manter atual</option>
                {equipesCadastro.map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>

              <input
                value={loteLocal}
                onChange={(e) => setLoteLocal(e.target.value)}
                disabled={!canEditDashboard || loadingCanEditDashboard}
                placeholder="Local/obra destino (ex.: Ribeirão Preto - SP / OGS 9981)"
                style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12, opacity: (!canEditDashboard || loadingCanEditDashboard) ? 0.65 : 1 }}
              />

              <select
                value={loteValorMode}
                onChange={(e) => setLoteValorMode(e.target.value as "__manter__" | "__definir__" | "__zerar__")}
                disabled={!canEditDashboard || loadingCanEditDashboard}
                style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12, opacity: (!canEditDashboard || loadingCanEditDashboard) ? 0.65 : 1 }}
              >
                <option value="__manter__">Valor: manter atual</option>
                <option value="__definir__">Valor: definir</option>
                <option value="__zerar__">Valor: zerar</option>
              </select>

              <input
                value={loteValorInput}
                onChange={(e) => setLoteValorInput(e.target.value)}
                disabled={!canEditDashboard || loadingCanEditDashboard || loteValorMode !== "__definir__"}
                placeholder="Ex.: 1350,00"
                style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12, opacity: (!canEditDashboard || loadingCanEditDashboard || loteValorMode !== "__definir__") ? 0.65 : 1 }}
              />

              <button
                onClick={aplicarEdicaoLote}
                disabled={
                  salvandoLote ||
                  selecionados.length === 0 ||
                  !canEditDashboard ||
                  loadingCanEditDashboard
                }
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid #0f172a",
                  background: (salvandoLote || selecionados.length === 0 || !canEditDashboard || loadingCanEditDashboard) ? "#94a3b8" : "#0f172a",
                  color: "white",
                  padding: "0 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: (salvandoLote || selecionados.length === 0 || !canEditDashboard || loadingCanEditDashboard) ? "not-allowed" : "pointer",
                }}
              >
                {salvandoLote ? "Aplicando..." : "Aplicar lote"}
              </button>
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#64748b" }}>
              Selecione as frotas na tabela (checkbox) para habilitar a aplicação em lote.
            </p>
          </div>
        )}

        {!presentationClean && workshopMode && (
          <div style={{ marginBottom: 12, background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#1e3a8a" }}>
                Programação futura dos selecionados
              </p>
              <span style={{ fontSize: 11, color: "#64748b" }}>Base: {selecionados.length} equipamento(s)</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "150px 130px 150px 1.6fr auto", gap: 8 }}>
              <input
                type="date"
                value={progData}
                onChange={(e) => setProgData(e.target.value)}
                style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}
              />

              <select value={progPeriodo} onChange={(e) => setProgPeriodo(e.target.value)} style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}>
                <option value="NOTURNO">Período: NOTURNO</option>
                <option value="DIURNO">Período: DIURNO</option>
                <option value="INTEGRAL">Período: INTEGRAL</option>
              </select>

              <select value={progTipoServico} onChange={(e) => setProgTipoServico(e.target.value)} style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}>
                <option value="OUTRO">Tipo: OUTRO</option>
                <option value="PAVIMENTAÇÃO">PAVIMENTAÇÃO</option>
                <option value="RETRABALHO">RETRABALHO</option>
                <option value="FRESAGEM">FRESAGEM</option>
                <option value="INFRA">INFRA</option>
                <option value="BGS">BGS</option>
              </select>

              <input
                value={progLocalBase}
                onChange={(e) => setProgLocalBase(e.target.value)}
                placeholder="Local base (opcional) — ex.: Uberlândia/MG"
                style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}
              />

              <button
                onClick={programarSelecionados}
                disabled={salvandoProgramacao || selecionados.length === 0}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid #1d4ed8",
                  background: (salvandoProgramacao || selecionados.length === 0) ? "#93c5fd" : "#1d4ed8",
                  color: "white",
                  padding: "0 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: (salvandoProgramacao || selecionados.length === 0) ? "not-allowed" : "pointer",
                }}
              >
                {salvandoProgramacao ? "Programando..." : "Criar programação"}
              </button>
            </div>

            <input
              value={progObs}
              onChange={(e) => setProgObs(e.target.value)}
              placeholder="Observação da programação (opcional)"
              style={{ marginTop: 8, width: "100%", height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}
            />
            <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#64748b" }}>
              A programação só é criada para as frotas marcadas na tabela.
            </p>
          </div>
        )}

        {workshopMode && (
          <div style={{ marginBottom: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
            <p style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
              Exportação e encaminhamento
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
              <input
                value={emailsDestino}
                onChange={(e) => setEmailsDestino(e.target.value)}
                placeholder="Emails dos responsáveis (separar por ; )"
                style={{ height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 12 }}
              />
              <button
                onClick={exportarWorkshopCsv}
                style={{ height: 34, borderRadius: 8, border: "1px solid #0f172a", background: "white", color: "#0f172a", padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Exportar CSV
              </button>
              <button
                onClick={encaminharPorEmail}
                style={{ height: 34, borderRadius: 8, border: "1px solid #065f46", background: "#065f46", color: "white", padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Encaminhar e-mail
              </button>
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#64748b" }}>
              Dica: clique em "Exportar CSV" e anexe no e-mail que será aberto automaticamente.
            </p>
          </div>
        )}

        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: presentationClean ? (tvMode ? 18 : 16) : 14, height: presentationClean ? (tvMode ? 18 : 16) : 14, color: "#9ca3af" }} />
          <input placeholder="Buscar frota, placa, tipo, equipe/setor, empresa..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: presentationClean ? (tvMode ? 52 : 46) : 38, borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: presentationClean ? (tvMode ? 18 : 16) : 13, outline: "none", boxSizing: "border-box", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }} />
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af", fontSize: 15 }}>Carregando...</div>
        ) : (
          <TabelaEquipamentos
            items={listaExibicao}
            workshopMode={!presentationClean && (workshopMode || canEditDashboard)}
            presentationMode={modoApres}
            presentationTvMode={apresTvMode}
            selectedIds={selecionados}
            onToggleItem={toggleSelecionado}
            onToggleAllFiltered={toggleSelecionarFiltrados}
            canEditDashboard={canEditDashboard}
            equipesCadastro={equipesCadastro}
            onInlineUpdate={salvarEdicaoIndividual}
            inlineSavingId={inlineSavingId}
            inlineSavedId={inlineSavedId}
          />
        )}
        {!presentationClean && !loading && kpiSel.custo > 0 && filtroStatus !== "operacional" && (
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
          <button onClick={() => setApresTvMode(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: apresTvMode ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.12)", border: apresTvMode ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)", borderRadius: 8, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 700 }}>
            {apresTvMode ? "TV ON" : "TV OFF"}
          </button>
          <button onClick={() => setModoApres(false)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 700 }}>
            <Minimize2 size={13} /> Sair
          </button>
        </header>

        {/* ── TOOLBAR ── */}
        <div style={{ height: TOOLBAR_H, flexShrink: 0, display: "none", alignItems: "center", gap: 4, paddingInline: 12, background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 9998, overflowX: "auto" }}>
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

        {/* ── CORPO APRESENTAÇÃO LIMPA ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#f0f4f8" }}>
            <div style={{ zoom: zoom, position: "relative", minHeight: "100%" }}>
              {renderConteudo(true, apresTvMode)}
            </div>
          </div>
        </div>

        {/* ── INPUT DE TEXTO: div fixed, sempre alinhado à tela independente de zoom/scroll ── */}
        {false && textInput && (
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

        {/* ── PROMPT DE RÓTULO após desenhar forma ── */}
        {false && labelPrompt && (
          <div style={{
            position: "fixed",
            left: Math.min(labelPrompt.screenX, window.innerWidth - 320),
            top: Math.max(HEADER_H + TOOLBAR_H + 8, Math.min(labelPrompt.screenY - 50, window.innerHeight - 140)),
            zIndex: 10002,
            background: "white", border: "2px solid #f59e0b", borderRadius: 12,
            padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", width: 310,
          }}>
            <p style={{ fontSize: 10, color: "#92400e", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {labelPrompt.forma.tipo === "circulo" ? "○" : labelPrompt.forma.tipo === "seta" ? "→" : labelPrompt.forma.tipo === "retangulo" ? "□" : "✏"} O que você marcou?
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>Opcional — aparece na ata. Pule se não precisar.</p>
            <input
              autoFocus value={labelVal} onChange={e => setLabelVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmarLabel(); if (e.key === "Escape") confirmarLabel(true); e.stopPropagation(); }}
              placeholder="Ex: FA14 — devolver, circulo na frota 22..."
              style={{ border: "none", borderBottom: "1.5px solid #fde68a", outline: "none", fontSize: 13, width: "100%", background: "transparent", color: "#0A0F2C", fontFamily: "Inter, sans-serif", paddingBottom: 4, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => confirmarLabel()} style={{ flex: 1, padding: "7px 0", background: "#f59e0b", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓ Registrar na ata</button>
              <button onClick={() => confirmarLabel(true)} style={{ padding: "7px 12px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, color: "#64748b" }}>Pular</button>
            </div>
          </div>
        )}

        {/* Dica de ferramenta seleção */}
        {false && ferramenta === "selecionar" && !selectedId && (
          <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", color: "white", fontSize: 11, padding: "6px 16px", borderRadius: 20, pointerEvents: "none", zIndex: 10001, whiteSpace: "nowrap" }}>
            Clique para selecionar · Arraste para mover · Del para apagar
          </div>
        )}

        {!!toastMsg && (
          <div style={{
            position: "fixed",
            bottom: 18,
            right: 18,
            zIndex: 10050,
            background: "#0f766e",
            color: "white",
            border: "1px solid #115e59",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            maxWidth: 430,
          }}>
            {toastMsg}
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
        <button onClick={() => { setModoApres(true); setApresTvMode(true); aplicarPresetApresentacao("diretoria"); setWorkshopMode(false); setFerramenta("nav"); setZoom(1); setFormas([]); setSelectedId(null); setBusca(""); }}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 9, cursor: "pointer", color: "white", fontSize: 13, fontWeight: 700, transition: "all 0.15s" }}>
          <Maximize2 size={14} /> Apresentação
        </button>
      </header>
      <div className="px-4 pb-2 bg-header-gradient">
        <NavigationTrail trail={trail} onSelect={goTo} />
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {renderSidebar()}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {renderConteudo()}
        </div>
      </div>
      {!!toastMsg && (
        <div style={{
          position: "fixed",
          bottom: 18,
          right: 18,
          zIndex: 10050,
          background: "#0f766e",
          color: "white",
          border: "1px solid #115e59",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          maxWidth: 430,
        }}>
          {toastMsg}
        </div>
      )}
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
