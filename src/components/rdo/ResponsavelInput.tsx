/**
 * ResponsavelInput — Campo de busca com autocomplete para Responsável do RDO
 * Sugere Encarregados e Engenheiros da tabela employees
 * Ainda permite digitar livremente qualquer nome
 */
import { useState, useEffect, useRef } from "react";
import { User, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Responsavel {
  id: string;
  name: string;
  role: string;
  matricula: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Funções que aparecem como sugestão (responsáveis típicos de obra)
const FUNCOES_RESPONSAVEL = [
  "ENCARREGADO",
  "ENGENHEIRO",
  "APONTADOR",
  "SUPERVISOR",
  "GERENTE",
  "COORDENADOR",
];

function isResponsavel(role: string): boolean {
  const r = role.toUpperCase();
  return FUNCOES_RESPONSAVEL.some(f => r.includes(f));
}

export function ResponsavelInput({ value, onChange, placeholder = "Nome do encarregado ou responsável" }: Props) {
  const [candidatos, setCandidatos] = useState<Responsavel[]>([]);
  const [filtrados, setFiltrados] = useState<Responsavel[]>([]);
  const [aberto, setAberto] = useState(false);
  const [inputFocus, setInputFocus] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Carregar encarregados/engenheiros uma vez
  useEffect(() => {
    supabase
      .from("employees")
      .select("id, name, role, matricula")
      .order("name")
      .then(({ data }) => {
        if (data) {
          const resp = (data as any[]).filter(f => isResponsavel(f.role || ""));
          setCandidatos(resp.map(f => ({
            id: f.id,
            name: f.name,
            role: f.role,
            matricula: f.matricula || "",
          })));
        }
      });
  }, []);

  // Filtrar conforme o usuário digita
  useEffect(() => {
    const q = value.trim().toLowerCase();
    if (!q) {
      // Sem texto: mostrar todos os candidatos (encarregados primeiro)
      setFiltrados(candidatos.slice(0, 15));
    } else {
      const r = candidatos
        .filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.matricula.includes(q)
        )
        .slice(0, 10);
      setFiltrados(r);
    }
  }, [value, candidatos]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selecionar = (c: Responsavel) => {
    onChange(c.name);
    setAberto(false);
  };

  const limpar = () => {
    onChange("");
    setAberto(false);
  };

  const mostrarDropdown = aberto && (filtrados.length > 0 || value.length === 0);

  return (
    <div ref={wrapperRef} className="relative">
      <div className={`flex items-center h-12 rounded-xl border bg-white px-3 gap-2 transition-colors ${inputFocus ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
        <User className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setAberto(true); }}
          onFocus={() => { setInputFocus(true); setAberto(true); }}
          onBlur={() => setInputFocus(false)}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
        {value ? (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); limpar(); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setAberto(o => !o); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {mostrarDropdown && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 rounded-xl border border-border bg-background shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {value.trim() && !candidatos.some(c => c.name.toLowerCase() === value.toLowerCase()) && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); setAberto(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">"{value}"</p>
                <p className="text-[10px] text-muted-foreground">Usar este nome livremente</p>
              </div>
            </button>
          )}

          {filtrados.length === 0 && value.trim() ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum encarregado encontrado — você pode usar qualquer nome acima
            </div>
          ) : (
            <>
              {!value.trim() && (
                <div className="px-3 py-1.5 bg-muted/30 border-b border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Encarregados e Responsáveis</p>
                </div>
              )}
              {filtrados.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selecionar(c); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.role}{c.matricula ? ` · Mat. ${c.matricula}` : ""}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
