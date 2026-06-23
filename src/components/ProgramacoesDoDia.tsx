// ProgramacoesDoDia — componente reutilizável
// Mostra programações de hoje e amanhã em qualquer tela do Workflux
// Sem WhatsApp integrado: botão compartilha via wa.me nativo
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HardHat, ChevronDown, ChevronUp, Share2 } from "lucide-react";

interface Prog {
  id: string;
  data: string;
  equipe: string;
  responsavel: string | null;
  ogs: string | null;
  cliente: string | null;
  local: string | null;
  periodo: string;
  tipo_servico: string | null;
  equipamentos_designados: string[] | null;
  engenheiro_responsavel: string | null;
  obs: string | null;
  status_programacao: string;
  confirmado_manutencao: boolean;
}

function montarTextoWA(prog: Prog): string {
  const data = prog.data ? prog.data.split("-").reverse().join("/") : "?";
  const equips = (prog.equipamentos_designados || []).join(", ") || "—";
  const confirmado = prog.confirmado_manutencao ? "✅ Confirmado pela Manutenção" : "⏳ Aguardando Manutenção";

  let msg = "🏗️ *PROGRAMAÇÃO DE OBRAS — Workflux*\n\n";
  msg += "📅 *Data:* " + data + "\n";
  msg += "👷 *Equipe:* " + prog.equipe + "\n";
  if (prog.responsavel) msg += "🦺 *Encarregado:* " + prog.responsavel + "\n";
  if (prog.engenheiro_responsavel) msg += "👨‍💼 *Engenheiro:* " + prog.engenheiro_responsavel + "\n";
  msg += "🌙 *Período:* " + prog.periodo + "\n";
  if (prog.tipo_servico) msg += "🔧 *Tipo:* " + prog.tipo_servico + "\n";
  if (prog.ogs) msg += "📋 *OGS:* " + prog.ogs + "\n";
  if (prog.cliente) msg += "🏢 *Cliente:* " + prog.cliente + "\n";
  if (prog.local) msg += "📍 *Local:* " + prog.local + "\n";
  msg += "\n🚧 *Equipamentos:* " + equips + "\n";
  msg += "\n" + confirmado;
  if (prog.obs) msg += "\n\n📝 *Obs:* " + prog.obs;
  msg += "\n\n_Enviado via Workflux_";
  return msg;
}

export default function ProgramacoesDoDia() {
  const [progs, setProgs] = useState<Prog[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    const hoje = new Date().toISOString().split("T")[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    (supabase as any)
      .from("ci_programacoes")
      .select("id,data,equipe,responsavel,ogs,cliente,local,periodo,tipo_servico,equipamentos_designados,engenheiro_responsavel,obs,status_programacao,confirmado_manutencao")
      .in("data", [hoje, amanha])
      .neq("status_programacao", "CANCELADO")
      .order("data")
      .order("equipe")
      .then(({ data }: any) => { if (data) setProgs(data); });
  }, []);

  if (progs.length === 0) return null;

  const hoje = new Date().toISOString().split("T")[0];

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const compartilharWA = (prog: Prog) => {
    const texto = montarTextoWA(prog);
    window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
  };

  return (
    <div className="space-y-2">
      {/* Cabeçalho colapsável */}
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <HardHat className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-bold text-foreground flex-1">
          Programação de Obras
        </span>
        <span className="text-xs bg-primary/10 text-primary font-bold rounded-full px-2 py-0.5">
          {progs.length}
        </span>
        {aberto
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {aberto && progs.map(prog => {
        const isHoje = prog.data === hoje;
        const equips = prog.equipamentos_designados || [];
        const isExpanded = expanded.has(prog.id);

        return (
          <div
            key={prog.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              isHoje ? "border-primary/30" : "border-border"
            }`}
          >
            {/* Header do card — clicável para expandir */}
            <button
              onClick={() => toggleExpand(prog.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${
                    isHoje ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {isHoje ? "HOJE" : "AMANHÃ"}
                  </span>
                  {prog.tipo_servico && (
                    <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                      {prog.tipo_servico}
                    </span>
                  )}
                  {prog.confirmado_manutencao && (
                    <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">
                      ✅ Manutenção OK
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-foreground mt-0.5 truncate">{prog.equipe}</p>
                {prog.ogs && (
                  <p className="text-xs text-muted-foreground truncate">
                    OGS {prog.ogs} · {prog.cliente}
                  </p>
                )}
              </div>
              {isExpanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Detalhes expandidos */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  {prog.responsavel && (
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Enc.</span>
                      <span className="text-xs text-foreground">{prog.responsavel}</span>
                    </div>
                  )}
                  {prog.engenheiro_responsavel && (
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Eng.</span>
                      <span className="text-xs text-foreground">{prog.engenheiro_responsavel}</span>
                    </div>
                  )}
                  {prog.local && (
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Local</span>
                      <span className="text-xs text-foreground">{prog.local}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Período</span>
                    <span className="text-xs font-medium text-foreground">{prog.periodo}</span>
                  </div>
                </div>

                {equips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Equipamentos</p>
                    <div className="flex flex-wrap gap-1">
                      {equips.map(f => (
                        <span key={f} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded px-2 py-0.5">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {prog.obs && (
                  <p className="text-xs text-muted-foreground italic">{prog.obs}</p>
                )}

                {/* Botão compartilhar WA nativo */}
                <button
                  onClick={() => compartilharWA(prog)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold active:scale-95 transition-transform"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Compartilhar via WhatsApp
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
