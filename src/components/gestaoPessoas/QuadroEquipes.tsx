import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Loader2, GripVertical, Eye, EyeOff, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LARGURA_PADRAO, chaveColuna, colunasVisiveis, limitarLargura, montarColunas, moverChave, ordenarColunas, SEM_EQUIPE, type ColunaQuadro, type PessoaQuadro } from "@/lib/quadroEquipes";

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
  /** Ordem salva (chaves), largura por coluna e ações — preferência de visualização, vale para qualquer usuário. */
  ordem: string[];
  larguras: Record<string, number>;
  onOrdem: (ordem: string[]) => void;
  onLargura: (chave: string, px: number | null) => void;
  onLarguraTodas: (chaves: string[], px: number) => void;
  onRestaurarLayout: () => void;
  layoutPersonalizado: boolean;
};

const PREFIXO_COLUNA = "col:";
// Cursor sobre uma coluna decide o destino; se não houver, cai na maior sobreposição.
const colisao: CollisionDetection = (args) => {
  const dentro = pointerWithin(args);
  return dentro.length ? dentro : rectIntersection(args);
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

function Coluna({ coluna, custo, destaqueAtivo, arrastandoColuna, largura, onLargura, onOcultar, children }: {
  coluna: ColunaQuadro<PessoaCard>; custo?: number; destaqueAtivo: boolean; arrastandoColuna: boolean;
  largura: number; onLargura: (px: number | null) => void; onOcultar: () => void; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.chave });
  const { attributes, listeners, setNodeRef: setHandleRef, isDragging } = useDraggable({ id: PREFIXO_COLUNA + coluna.chave });
  const [ao_vivo, setAoVivo] = useState<number | null>(null);
  const largAtual = ao_vivo ?? largura;
  const corDestino = arrastandoColuna ? { bg: "#eff6ff", borda: "#3b82f6" } : { bg: "#ecfdf5", borda: "#10b981" };

  const iniciarRedimensao = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const l0 = largAtual;
    let ultimo = l0;
    const mover = (ev: PointerEvent) => { ultimo = limitarLargura(l0 + ev.clientX - x0); setAoVivo(ultimo); };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      if (ultimo !== l0) onLargura(ultimo);
      setAoVivo(null);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  };

  return (
    <section
      ref={setNodeRef}
      style={{
        position: "relative", width: largAtual, flexShrink: 0, background: isOver ? corDestino.bg : "#f1f5f9", borderRadius: 14, padding: 10,
        border: isOver ? `2px dashed ${corDestino.borda}` : destaqueAtivo ? "2px dashed #cbd5e1" : "2px solid transparent",
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 230px)", opacity: isDragging ? 0.45 : 1,
      }}
    >
      <header style={{ marginBottom: 8, padding: "0 2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            <button
              ref={setHandleRef}
              {...attributes}
              {...listeners}
              title="Arraste para mudar a posição desta equipe"
              aria-label={`Mover coluna ${coluna.nome}`}
              style={{ padding: 2, borderRadius: 6, color: "#94a3b8", cursor: "grab", touchAction: "none", flexShrink: 0 }}
            >
              <GripVertical size={14} />
            </button>
            <h3 style={{ fontSize: 12, fontWeight: 800, color: coluna.chave === SEM_EQUIPE ? "#b45309" : "#065f46", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={coluna.nome}>{coluna.nome}</h3>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, background: "white", borderRadius: 999, padding: "1px 8px", color: "#334155" }}>{coluna.pessoas.length}</span>
            <button onClick={onOcultar} title="Ocultar esta equipe do quadro" aria-label={`Ocultar ${coluna.nome}`} style={{ padding: 3, borderRadius: 6, color: "#94a3b8" }}>
              <EyeOff size={13} />
            </button>
          </span>
        </div>
        {custo !== undefined && <p style={{ fontSize: 10, color: "#0f766e", fontWeight: 700 }}>Custo mensal: {brl(custo)}</p>}
      </header>
      <div data-quadro-lista style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", minHeight: 40 }}>{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Largura da coluna ${coluna.nome}`}
        title="Arraste para ajustar a largura · duplo clique restaura"
        onPointerDown={iniciarRedimensao}
        onDoubleClick={() => onLargura(null)}
        style={{ position: "absolute", top: 0, right: -2, width: 10, height: "100%", cursor: "col-resize", touchAction: "none", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 5 }}
      >
        <span style={{ width: 3, height: 36, borderRadius: 3, background: ao_vivo !== null ? "#10b981" : "#cbd5e1" }} />
      </div>
    </section>
  );
}

export default function QuadroEquipes({ pessoas, catalogo, busca, podeMover, movendoId, custoDe, statusVisual, onMover, onAbrir, ocultas, onAlternarColuna, onMostrarTodas, avisoPreferencia, ordem, larguras, onOrdem, onLargura, onLarguraTodas, onRestaurarLayout, layoutPersonalizado }: Props) {
  const colunasBase = useMemo(() => montarColunas(pessoas, catalogo, busca), [pessoas, catalogo, busca]);
  const todasColunas = useMemo(() => ordenarColunas(colunasBase, ordem), [colunasBase, ordem]);
  const colunas = useMemo(() => colunasVisiveis(todasColunas, ocultas), [todasColunas, ocultas]);
  const totalOcultas = todasColunas.length - colunas.length;
  const quadroRef = useRef<HTMLDivElement>(null);
  const [rolagem, setRolagem] = useState({ esquerda: false, direita: false });

  // Setas só aparecem quando há conteúdo escondido naquele lado.
  useEffect(() => {
    const el = quadroRef.current;
    if (!el) return;
    const atualizar = () => setRolagem({
      esquerda: el.scrollLeft > 1,
      direita: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
    atualizar();
    el.addEventListener("scroll", atualizar, { passive: true });
    const ro = new ResizeObserver(atualizar);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", atualizar); ro.disconnect(); };
  }, [colunas.length]);
  const rolarLado = (sentido: -1 | 1) =>
    quadroRef.current?.scrollBy({ left: sentido * 560, behavior: "smooth" });

  // Roda vertical comum do mouse rola o quadro para o lado (mouse sem roda horizontal).
  // Dentro da lista de cards de uma coluna que ainda rola na vertical, a roda continua rolando a lista.
  useEffect(() => {
    const el = quadroRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      const lista = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-quadro-lista]");
      if (!horizontal && lista && lista.scrollHeight > lista.clientHeight) {
        const noTopo = lista.scrollTop <= 0 && delta < 0;
        const noFim = lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 1 && delta > 0;
        if (!noTopo && !noFim) return;
      }
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const proximo = Math.min(max, Math.max(0, el.scrollLeft + delta));
      if (proximo === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = proximo;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const [arrastando, setArrastando] = useState<PessoaCard | null>(null);
  const [colunaArrastada, setColunaArrastada] = useState<ColunaQuadro<PessoaCard> | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const aoIniciar = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith(PREFIXO_COLUNA)) {
      setColunaArrastada(todasColunas.find((c) => c.chave === id.slice(PREFIXO_COLUNA.length)) || null);
      return;
    }
    setArrastando(pessoas.find((p) => p.id === id) || null);
  };
  const cancelar = () => { setArrastando(null); setColunaArrastada(null); };
  const aoSoltar = (e: DragEndEvent) => {
    const id = String(e.active.id);
    cancelar();
    if (!e.over) return;
    if (id.startsWith(PREFIXO_COLUNA)) {
      // Reordenar é só preferência de visualização: vale para qualquer usuário, não mexe em cadastro.
      const origem = todasColunas.find((c) => c.chave === id.slice(PREFIXO_COLUNA.length));
      const destino = todasColunas.find((c) => c.chave === String(e.over!.id));
      if (!origem || !destino) return;
      const chaves = todasColunas.map(chaveColuna);
      const proximo = moverChave(chaves, chaveColuna(origem), chaveColuna(destino));
      if (proximo.join("|") !== chaves.join("|")) onOrdem(proximo);
      return;
    }
    const pessoa = pessoas.find((p) => p.id === id);
    if (!pessoa || !podeMover) return;
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
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569" }}>
          <span style={{ fontWeight: 700 }}>Largura:</span>
          {([["Estreita", 220], ["Padrão", LARGURA_PADRAO], ["Larga", 380], ["Nome completo", 460]] as const).map(([rotulo, px]) => (
            <button
              key={rotulo}
              onClick={() => onLarguraTodas(colunas.map(chaveColuna), px)}
              className="h-7 px-2 rounded-md border border-slate-300 bg-white font-semibold hover:bg-slate-50"
              title={`Aplicar largura ${px}px em todas as equipes visíveis`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {layoutPersonalizado && (
          <button onClick={onRestaurarLayout} className="text-xs text-slate-600 hover:text-slate-900 underline underline-offset-2">Restaurar ordem e largura</button>
        )}
        {avisoPreferencia && <span style={{ fontSize: 11, color: "#b45309" }}>{avisoPreferencia}</span>}
      </div>
      <DndContext sensors={sensors} collisionDetection={colisao} onDragStart={aoIniciar} onDragEnd={aoSoltar} onDragCancel={cancelar}>
        <div style={{ position: "relative" }}>
        {(["esquerda", "direita"] as const).map((lado) => rolagem[lado] && (
          <button
            key={lado}
            onClick={() => rolarLado(lado === "esquerda" ? -1 : 1)}
            aria-label={lado === "esquerda" ? "Ver equipes à esquerda" : "Ver equipes à direita"}
            title={lado === "esquerda" ? "Equipes à esquerda" : "Equipes à direita"}
            style={{ position: "absolute", top: 120, [lado === "esquerda" ? "left" : "right"]: 4, zIndex: 20, width: 36, height: 36, borderRadius: 999, background: "white", border: "1px solid #cbd5e1", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155" }}
          >
            {lado === "esquerda" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        ))}
        <div ref={quadroRef} style={{ display: "flex", gap: 12, overflowX: "scroll", overflowY: "hidden", paddingBottom: 12, alignItems: "flex-start", width: "100%" }}>
          {colunas.map((c) => (
            <Coluna key={c.chave} coluna={c} destaqueAtivo={!!arrastando || !!colunaArrastada} arrastandoColuna={!!colunaArrastada} largura={larguras[chaveColuna(c)] ?? LARGURA_PADRAO} onLargura={(px) => onLargura(chaveColuna(c), px)} onOcultar={() => onAlternarColuna(chaveColuna(c))} custo={busca.trim() ? undefined : c.pessoas.reduce((acc, p) => acc + custoDe(p), 0)}>
              {c.pessoas.length === 0 && <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>Nenhum funcionário</p>}
              {c.pessoas.map((p) => (
                <Card key={p.id} p={p} podeMover={podeMover} movendo={movendoId === p.id} badge={statusVisual(p)} onAbrir={onAbrir} />
              ))}
            </Coluna>
          ))}
        </div>
        </div>
        <DragOverlay>
          {colunaArrastada && (
            <div style={{ background: "white", border: "2px solid #3b82f6", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
              {colunaArrastada.nome} · {colunaArrastada.pessoas.length}
            </div>
          )}
          {arrastando && <Card p={arrastando} podeMover={false} movendo={false} sobreposto badge={statusVisual(arrastando)} onAbrir={() => undefined} />}
        </DragOverlay>
      </DndContext>
    </>
  );
}
