/**
 * AuditLogViewer — Logs de auditoria no Painel de Controle
 * Mostra quem fez o quê e quando
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const ACAO_CONFIG: Record<string, { label: string; cor: string }> = {
  DELETE:  { label: "Excluiu",  cor: "bg-red-500/15 text-red-500 border-red-500/30" },
  UPDATE:  { label: "Editou",   cor: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  CREATE:  { label: "Criou",    cor: "bg-green-500/15 text-green-600 border-green-500/30" },
  LOGIN:   { label: "Login",    cor: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  EXPORT:  { label: "Exportou", cor: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  RESTORE: { label: "Restaurou",cor: "bg-teal-500/15 text-teal-500 border-teal-500/30" },
};

const TABELA_LABEL: Record<string, string> = {
  rdo_diarios: "RDO",
  equipment_diaries: "Diário de Equipamento",
  employees: "Funcionário",
  profiles: "Usuário",
  maquinas_frota: "Frota",
  abastecimentos: "Abastecimento",
};

function fmtDateTime(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const POR_PAGINA = 50;

  const carregar = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);

    if (filtroAcao) query = query.eq("acao", filtroAcao);

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [pagina, filtroAcao]);

  const filtrados = busca.trim()
    ? logs.filter(l =>
        (l.user_nome || "").toLowerCase().includes(busca.toLowerCase()) ||
        (l.tabela || "").toLowerCase().includes(busca.toLowerCase()) ||
        (l.acao || "").toLowerCase().includes(busca.toLowerCase()) ||
        (l.registro_id || "").includes(busca)
      )
    : logs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Log de Auditoria</p>
          <p className="text-xs text-muted-foreground">Todas as ações críticas do sistema</p>
        </div>
        <button onClick={carregar} className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por usuário, tabela..."
            className="h-9 pl-8 pr-3 w-full text-xs bg-secondary border border-border rounded-xl outline-none"
          />
        </div>
        <select
          value={filtroAcao}
          onChange={e => { setFiltroAcao(e.target.value); setPagina(0); }}
          className="h-9 px-3 text-xs bg-secondary border border-border rounded-xl outline-none"
        >
          <option value="">Todas as ações</option>
          {Object.entries(ACAO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtrados.map(log => {
            const acao = ACAO_CONFIG[log.acao] || { label: log.acao, cor: "bg-muted text-muted-foreground border-border" };
            const tabelaLabel = TABELA_LABEL[log.tabela] || log.tabela;
            const isExpanded = expandido === log.id;
            const temDetalhes = log.dados_antes || log.dados_depois;

            return (
              <div key={log.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div
                  className={`flex items-center gap-3 px-4 py-3 ${temDetalhes ? "cursor-pointer hover:bg-muted/30" : ""}`}
                  onClick={() => temDetalhes && setExpandido(isExpanded ? null : log.id)}
                >
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${acao.cor}`}>
                    {acao.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      <span className="font-bold">{log.user_nome || "Desconhecido"}</span>
                      {" "}{acao.label.toLowerCase()}{" "}
                      <span className="text-primary">{tabelaLabel}</span>
                      {log.registro_id && <span className="text-muted-foreground"> #{log.registro_id.slice(0, 8)}</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtDateTime(log.created_at)}</p>
                  </div>
                  {temDetalhes && (
                    isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>

                {isExpanded && temDetalhes && (
                  <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/20">
                    {log.dados_antes && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Antes</p>
                        <pre className="text-[10px] bg-background rounded-lg p-2 overflow-x-auto text-foreground border border-border">
                          {JSON.stringify(log.dados_antes, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.dados_depois && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Depois</p>
                        <pre className="text-[10px] bg-background rounded-lg p-2 overflow-x-auto text-foreground border border-border">
                          {JSON.stringify(log.dados_depois, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          <button
            disabled={pagina === 0}
            onClick={() => setPagina(p => p - 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
          >← Anterior</button>
          <button
            disabled={logs.length < POR_PAGINA}
            onClick={() => setPagina(p => p + 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
          >Próximo →</button>
        </div>
      </div>
    </div>
  );
}
