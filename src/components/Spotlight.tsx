/**
 * Spotlight — Busca Global estilo Cmd+K
 * Busca em: funcionários, equipamentos (frotas), OGS, RDOs, abastecimentos
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, User, Truck, ClipboardList, Fuel, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyModules } from "@/hooks/useCompanyModules";

interface SpotlightResult {
  id: string;
  tipo: "funcionario" | "equipamento" | "ogs" | "rdo" | "abastecimento";
  titulo: string;
  subtitulo?: string;
  rota: string;
}

const TIPO_LABEL: Record<SpotlightResult["tipo"], string> = {
  funcionario: "Funcionário",
  equipamento: "Equipamento",
  ogs: "Obra / OGS",
  rdo: "RDO",
  abastecimento: "Abastecimento",
};

const TIPO_ICON: Record<SpotlightResult["tipo"], React.ElementType> = {
  funcionario: User,
  equipamento: Truck,
  ogs: Building2,
  rdo: ClipboardList,
  abastecimento: Fuel,
};

const TIPO_COLOR: Record<SpotlightResult["tipo"], string> = {
  funcionario: "bg-blue-500/20 text-blue-400",
  equipamento: "bg-orange-500/20 text-orange-400",
  ogs: "bg-purple-500/20 text-purple-400",
  rdo: "bg-green-500/20 text-green-400",
  abastecimento: "bg-yellow-500/20 text-yellow-400",
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/30 text-primary-foreground rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function Spotlight() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { isSuperAdmin } = useCompanyModules();

  // Abre com Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Foca o input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  // Debounce da busca
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => buscar(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const buscar = useCallback(async (q: string) => {
    setLoading(true);
    const encontrados: SpotlightResult[] = [];
    const ilike = `%${q}%`;

    try {
      const [empResp, eqResp, ogsResp, rdoResp, absResp] = await Promise.allSettled([
        // Funcionários
        supabase
          .from("employees")
          .select("id, name, role, matricula")
          .or(`name.ilike.${ilike},matricula.ilike.${ilike},role.ilike.${ilike}`)
          .limit(5),

        // Equipamentos / Frotas
        supabase
          .from("maquinas_frota")
          .select("id, frota, nome, tipo")
          .or(`frota.ilike.${ilike},nome.ilike.${ilike},tipo.ilike.${ilike}`)
          .limit(5),

        // OGS / Obras
        supabase
          .from("ogs_reference")
          .select("id, ogs_number, client_name, location_address")
          .or(`ogs_number.ilike.${ilike},client_name.ilike.${ilike},location_address.ilike.${ilike}`)
          .limit(5),

        // RDOs
        supabase
          .from("rdo_diarios")
          .select("id, obra_nome, tipo_rdo, data")
          .ilike("obra_nome", ilike)
          .order("data", { ascending: false })
          .limit(5),

        // Abastecimentos
        supabase
          .from("abastecimentos")
          .select("id, equipment_fleet, ogs, data")
          .or(`equipment_fleet.ilike.${ilike},ogs.ilike.${ilike}`)
          .order("data", { ascending: false })
          .limit(5),
      ]);

      // Funcionários
      if (empResp.status === "fulfilled" && empResp.value.data) {
        empResp.value.data.forEach((e: any) => {
          encontrados.push({
            id: e.id,
            tipo: "funcionario",
            titulo: e.name,
            subtitulo: [e.role, e.matricula].filter(Boolean).join(" · "),
            rota: `/gestao-pessoas`,
          });
        });
      }

      // Equipamentos
      if (eqResp.status === "fulfilled" && eqResp.value.data) {
        eqResp.value.data.forEach((e: any) => {
          encontrados.push({
            id: e.id,
            tipo: "equipamento",
            titulo: `Frota ${e.frota}`,
            subtitulo: [e.tipo, e.nome].filter(Boolean).join(" · "),
            rota: `/relatorio-equipamento/${e.frota}`,
          });
        });
      }

      // OGS
      if (ogsResp.status === "fulfilled" && ogsResp.value.data) {
        ogsResp.value.data.forEach((e: any) => {
          encontrados.push({
            id: e.id,
            tipo: "ogs",
            titulo: `OGS ${e.ogs_number}`,
            subtitulo: [e.client_name, e.location_address].filter(Boolean).join(" · "),
            rota: `/relatorios/rdo/${e.ogs_number}`,
          });
        });
      }

      // RDOs
      if (rdoResp.status === "fulfilled" && rdoResp.value.data) {
        rdoResp.value.data.forEach((e: any) => {
          const data = e.data ? new Date(e.data).toLocaleDateString("pt-BR") : "";
          encontrados.push({
            id: e.id,
            tipo: "rdo",
            titulo: `RDO — OGS ${e.obra_nome}`,
            subtitulo: [e.tipo_rdo, data].filter(Boolean).join(" · "),
            rota: `/visualizar-rdo/${e.id}`,
          });
        });
      }

      // Abastecimentos
      if (absResp.status === "fulfilled" && absResp.value.data) {
        absResp.value.data.forEach((e: any) => {
          const data = e.data ? new Date(e.data).toLocaleDateString("pt-BR") : "";
          encontrados.push({
            id: e.id,
            tipo: "abastecimento",
            titulo: `Abastecimento Frota ${e.equipment_fleet}`,
            subtitulo: [e.ogs, data].filter(Boolean).join(" · "),
            rota: `/abastecimento`,
          });
        });
      }
    } catch {}

    setResults(encontrados);
    setSelected(0);
    setLoading(false);
  }, []);

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      ir(results[selected].rota);
    }
  };

  const ir = (rota: string) => {
    setOpen(false);
    navigate(rota);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-muted/40 text-muted-foreground text-sm hover:bg-muted hover:text-foreground transition-all w-full max-w-lg"
        aria-label="Busca global"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Buscar frota, funcionário, OGS...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] border border-border rounded px-1.5 py-0.5 font-mono opacity-60">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading
            ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
            : <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar frota, funcionário, OGS, RDO..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground font-mono"
          >
            ESC
          </button>
        </div>

        {/* Resultados */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para <strong>"{query}"</strong>
            </div>
          )}

          {results.length > 0 && (
            <ul className="py-2">
              {results.map((r, i) => {
                const Icon = TIPO_ICON[r.tipo];
                const isSelected = i === selected;
                return (
                  <li key={`${r.tipo}-${r.id}`}>
                    <button
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => ir(r.rota)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${TIPO_COLOR[r.tipo]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {highlight(r.titulo, query)}
                        </p>
                        {r.subtitulo && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {highlight(r.subtitulo, query)}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1.5 py-0.5 shrink-0">
                        {TIPO_LABEL[r.tipo]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer dica */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
            <span><kbd className="border border-border rounded px-1 font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="border border-border rounded px-1 font-mono">↵</kbd> abrir</span>
            <span><kbd className="border border-border rounded px-1 font-mono">ESC</kbd> fechar</span>
          </div>
        )}
      </div>
    </div>
  );
}
