import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Loader2, GripVertical, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chaveColuna, colunasVisiveis, montarColunas, SEM_EQUIPE, type ColunaQuadro, type PessoaQuadro } from "@/lib/quadroEquipes";

export type PessoaCard = PessoaQuadro & { foto_url?: string | null };

type Props = {
  pessoas: PessoaCard[];
  catalogo: string[];
  busca: string;
  /** Somente quem tem permissão de Programador arrasta; os demais só visualizam. */
  podeMover: boolean;
  movendoId: string | null;
  custoDe: (p: PessoaCard) => number;
  statusVisual: (p: PessoaCard) => { label: string; bg: string; text: string } | null;
  onMover: (pessoa: PessoaCard, destino: string) => void;
  onAbrir: (id: string) => void;
  ocultas: ReadonlySet<string>;
  onAlternarColuna: (chave: string) => void;
  onMostrarTodas: () => void;
  avisoPreferencia?: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

function Card({ p, podeMover, movendo, badge, onAbrir, sobreposto }: {
  p: PessoaCard; podeMover: boolean; movendo: boolean; sobreposto?: boolean;
  badge: { label: string; bg: string; text: string } | null; onAbrir: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, disabled: !podeMover || movendo });
  return (
    <div
      ref={sobreposto ? undefined : setNodeRef}
      {...(sobreposto ? {} : { ...attributes, ...listeners })}
      onClick={() => !isDragging && onAbrir(p.id)}
      title={podeMover ? "Arraste para outra equipe · clique para abrir a ficha" : "Clique para abrir a ficha"}
      style={{
        background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8, cursor: podeMover ? "grab" : "pointer",
        opacity: isDragging ? 0.35 : movendo ? 0.6 : 1, touchAction: podeMover ? "none" : "auto",
        boxShadow: sobreposto ? "0 8px 24px rgba(0,0,0,0.18)" : "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {podeMover && <GripVertical size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />}
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e2e8f0", color: "#475569", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {iniciais(p.name)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</p>
        <p style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.role || "Sem função"}{p.matricula ? ` · Mat. ${p.matricula}` : ""}
        </p>
      </div>
      {badge && (
        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: badge.bg, color: badge.text, flexShrink: 0 }}>{badge.label}</span>
      )}
      {movendo && <Loader2 size={14} className="animate-spin" color="#64748b" />}
    </div>
  );
}

function Coluna({ coluna, custo, destaqueAtivo, onOcultar, children }: {
  coluna: ColunaQuadro<PessoaCard>; custo?: number; destaqueAtivo: boolean; onOcultar: () => void; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.chave });
  return (
    <section
      ref={setNodeRef}
      style={{
        width: 270, flexShrink: 0, background: isOver ? "#ecfdf5" : "#f1f5f9", borderRadius: 14, padding: 10,
        border: isOver ? "2px dashed #10b981" : destaqueAtivo ? "2px dashed #cbd5e1" : "2px solid transparent",
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 230px)",
      }}
    >
      <header style={{ marginBottom: 8, padding: "0 2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: coluna.chave === SEM_EQUIPE ? "#b45309" : "#065f46", textTransform: "uppercase" }}>{coluna.nome}</h3>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, background: "white", borderRadius: 999, padding: "1px 8px", color: "#334155" }}>{coluna.pessoas.length}</span>
            <button onClick={onOcultar} title="Ocultar esta equipe do quadro" aria-label={`Ocultar ${coluna.nome}`} style={{ padding: 3, borderRadius: 6, color: "#94a3b8" }}>
              <EyeOff size={13} />
            </button>
          </span>
        </div>
        {custo !== undefined && <p style={{ fontSize: 10, color: "#0f766e", fontWeight: 700 }}>Custo mensal: {brl(custo)}</p>}
      </header>
      <div data-quadro-lista style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 40 }}>{children}</div>
    </section>
  );
}

export default function QuadroEquipes({ pessoas, catalogo, busca, podeMover, movendoId, custoDe, statusVisual, onMover, onAbrir, ocultas, onAlternarColuna, onMostrarTodas, avisoPreferencia }: Props) {
  const todasColunas = useMemo(() => montarColunas(pessoas, catalogo, busca), [pessoas, catalogo, busca]);
  const colunas = useMemo(() => colunasVisiveis(todasColunas, ocultas), [todasColunas, ocultas]);
  const totalOcultas = todasColunas.length - colunas.length;
  const quadroRef = useRef<HTMLDivElement>(null);

  // Roda vertical comum do mouse rola o quadro para o lado (mouse sem roda horizontal).
  // Dentro da lista de cards de uma coluna que ainda rola na vertical, a roda continua rolando a lista.
  useEffect(() => {
    const el = quadroRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const lista = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-quadro-lista]");
      if (lista && lista.scrollHeight > lista.clientHeight) {
        const noTopo = lista.scrollTop <= 0 && e.deltaY < 0;
        const noFim = lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 1 && e.deltaY > 0;
        if (!noTopo && !noFim) return;
      }
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const proximo = Math.min(max, Math.max(0, el.scrollLeft + e.deltaY));
      if (proximo === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = proximo;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const [arrastando, setArrastando] = useState<PessoaCard | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const aoIniciar = (e: DragStartEvent) => setArrastando(pessoas.find((p) => p.id === e.active.id) || null);
  const aoSoltar = (e: DragEndEvent) => {
    const pessoa = pessoas.find((p) => p.id === e.active.id);
    setArrastando(null);
    if (!pessoa || !e.over || !podeMover) return;
    onMover(pessoa, String(e.over.id));
  };

  return (
    <>
      {!podeMover && (
        <p style={{ fontSize: 11, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}>
          Modo visualização: somente usuários com acesso ao WF Programador podem mover funcionários entre equipes.
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2">
              <SlidersHorizontal size={13} /> Equipes visíveis ({colunas.length}/{todasColunas.length})
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 6px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Escolha o que aparece no quadro</span>
              <button onClick={onMostrarTodas} disabled={totalOcultas === 0} className="text-[11px] font-semibold text-emerald-700 disabled:opacity-40">Mostrar todas</button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {todasColunas.map((c) => {
                const k = chaveColuna(c);
                const oculta = ocultas.has(k);
                return (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer", fontSize: 12, color: oculta ? "#94a3b8" : "#1e293b" }}>
                    <input type="checkbox" checked={!oculta} onChange={() => onAlternarColuna(k)} style={{ accentColor: "#059669" }} />
                    <span style={{ flex: 1, textTransform: "uppercase", fontWeight: 600 }}>{c.nome}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{c.pessoas.length}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        {totalOcultas > 0 && (
          <button onClick={onMostrarTodas} className="text-xs text-slate-600 inline-flex items-center gap-1 hover:text-slate-900">
            <Eye size={13} /> {totalOcultas} oculta{totalOcultas > 1 ? "s" : ""} · mostrar todas
          </button>
        )}
        {avisoPreferencia && <span style={{ fontSize: 11, color: "#b45309" }}>{avisoPreferencia}</span>}
      </div>
      <DndContext sensors={sensors} onDragStart={aoIniciar} onDragEnd={aoSoltar} onDragCancel={() => setArrastando(null)}>
        <div ref={quadroRef} style={{ display: "flex", gap: 12, overflowX: "scroll", overflowY: "hidden", paddingBottom: 12, alignItems: "flex-start", width: "100%" }}>
          {colunas.map((c) => (
            <Coluna key={c.chave} coluna={c} destaqueAtivo={!!arrastando} onOcultar={() => onAlternarColuna(chaveColuna(c))} custo={busca.trim() ? undefined : c.pessoas.reduce((acc, p) => acc + custoDe(p), 0)}>
              {c.pessoas.length === 0 && <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>Nenhum funcionário</p>}
              {c.pessoas.map((p) => (
                <Card key={p.id} p={p} podeMover={podeMover} movendo={movendoId === p.id} badge={statusVisual(p)} onAbrir={onAbrir} />
              ))}
            </Coluna>
          ))}
        </div>
        <DragOverlay>
          {arrastando && <Card p={arrastando} podeMover={false} movendo={false} sobreposto badge={statusVisual(arrastando)} onAbrir={() => undefined} />}
        </DragOverlay>
      </DndContext>
    </>
  );
}
