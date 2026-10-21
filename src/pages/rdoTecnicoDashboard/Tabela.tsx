import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 20;

// Página derivada: trocar filtros/seção (resetKey) volta à primeira página (ou à do registro em foco)
// e o total sempre limita a página, então nunca existe página vazia com registros correspondentes.
export function usePagina(total: number, resetKey: string, focusIndex = -1, size = PAGE_SIZE) {
  const [st, setSt] = useState<{ page: number; key: string | null }>({ page: 1, key: null });
  const paginas = Math.max(1, Math.ceil(total / size));
  const base = st.key === resetKey ? st.page : focusIndex >= 0 ? Math.floor(focusIndex / size) + 1 : 1;
  const pagina = Math.min(Math.max(1, base), paginas);
  const inicio = total === 0 ? 0 : (pagina - 1) * size;
  const fim = Math.min(total, inicio + size);
  const ir = (p: number) => setSt({ page: Math.min(Math.max(1, p), paginas), key: resetKey });
  return { pagina, paginas, inicio, fim, ir };
}

export function PaginationBar({ total, inicio, fim, pagina, paginas, ir, rotulo }: {
  total: number; inicio: number; fim: number; pagina: number; paginas: number; ir: (p: number) => void; rotulo: string;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-3 py-1.5 text-xs text-muted-foreground">
      <span data-testid="paginacao-intervalo">{`${total === 0 ? 0 : inicio + 1}–${fim} de ${total} ${rotulo}`}</span>
      <div className="flex items-center gap-2">
        <span data-testid="paginacao-status">{`Página ${pagina} de ${paginas}`}</span>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pagina <= 1} onClick={() => ir(pagina - 1)} aria-label="Página anterior">Anterior</Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pagina >= paginas} onClick={() => ir(pagina + 1)} aria-label="Próxima página">Próxima</Button>
      </div>
    </div>
  );
}

export interface Coluna<T> {
  titulo: string;
  className?: string;
  render: (item: T) => ReactNode;
}

// Tabela com cabeçalho fixo, corpo rolável e rodapé de paginação sempre visível.
// Toda a coleção permanece em `itens`; só a fatia da página é renderizada.
export function TabelaPaginada<T>({ itens, colunas, getKey, resetKey, vazio, rotulo = "registros", minWidth = 720, tamanho = PAGE_SIZE, focusKey, className }: {
  itens: T[];
  colunas: Coluna<T>[];
  getKey: (item: T) => string;
  resetKey: string;
  vazio: string;
  rotulo?: string;
  minWidth?: number;
  tamanho?: number;
  focusKey?: string | null;
  className?: string;
}) {
  const focusIndex = focusKey ? itens.findIndex(i => getKey(i) === focusKey) : -1;
  const pg = usePagina(itens.length, resetKey, focusIndex, tamanho);
  const corpo = useRef<HTMLDivElement>(null);
  // Um único efeito: primeiro volta ao topo, depois localiza o registro em foco (a ordem inversa desfaria a localização).
  useEffect(() => {
    if (!corpo.current) return;
    corpo.current.scrollTop = 0;
    corpo.current.querySelector<HTMLElement>("[data-foco='true']")?.scrollIntoView?.({ block: "nearest" });
  }, [pg.pagina, focusKey]);

  if (itens.length === 0) {
    return <div className={cn("rounded-xl border bg-white px-4 py-8 text-center text-sm text-muted-foreground", className)}>{vazio}</div>;
  }
  const style: CSSProperties = { minWidth };
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white", className)}>
      <div ref={corpo} className="max-h-[65dvh] min-h-0 flex-1 overflow-auto lg:max-h-none">
        <table className="w-full text-sm" style={style}>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              {colunas.map(c => <th key={c.titulo} className={cn("sticky top-0 z-10 bg-slate-100 px-3 py-2 font-semibold", c.className)}>{c.titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {itens.slice(pg.inicio, pg.fim).map(item => {
              const foco = !!focusKey && getKey(item) === focusKey;
              return (
                <tr key={getKey(item)} data-foco={foco ? "true" : undefined} className={cn("border-t align-top", foco && "bg-blue-50")}>
                  {colunas.map(c => <td key={c.titulo} className={cn("px-3 py-2", c.className)}>{c.render(item)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar total={itens.length} inicio={pg.inicio} fim={pg.fim} pagina={pg.pagina} paginas={pg.paginas} ir={pg.ir} rotulo={rotulo} />
    </div>
  );
}

// Prévia de no máximo duas linhas; o texto completo e exato fica no diálogo de detalhes.
export function Previa({ children, testId, className }: { children: ReactNode; testId?: string; className?: string }) {
  return (
    <div data-testid={testId} title={typeof children === "string" ? children : undefined}
      className={cn("line-clamp-2 max-w-[420px] whitespace-pre-wrap break-words", className)}>
      {children}
    </div>
  );
}

export function Interpretar({ children }: { children: ReactNode }) {
  return (
    <details className="shrink-0 rounded-lg border bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
      <summary className="cursor-pointer font-semibold">Como interpretar</summary>
      <div className="mt-1 space-y-1">{children}</div>
    </details>
  );
}
