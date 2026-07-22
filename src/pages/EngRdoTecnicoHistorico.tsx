"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, History, ChevronRight, Loader2 } from "lucide-react";

interface RdoItem {
  id: string;
  ogs_number: string;
  data: string;
  localizacao: string | null;
  equipe: string | null;
  status: string;
  engenheiro_nome: string;
}

interface OgsOption { id: string; ogs_number: string; client_name: string }

export default function EngRdoTecnicoHistorico() {
  const navigate = useNavigate();
  const [rdos, setRdos] = useState<RdoItem[]>([]);
  const [ogsOptions, setOgsOptions] = useState<OgsOption[]>([]);
  const [loading, setLoading] = useState(true);

  const hoje = new Date().toISOString().split("T")[0];
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [filtroOgs, setFiltroOgs] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroInicio, setFiltroInicio] = useState(trintaDiasAtras);
  const [filtroFim, setFiltroFim] = useState(hoje);

  const inputCls = "h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";

  const statusBadge = (s: string) => {
    if (s === "enviado") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Enviado</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Rascunho</span>;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await (supabase as any)
        .from("profiles").select("company_id").eq("user_id", user.id).single();
      const companyId = profile?.company_id;

      // OGSs para filtro
      const { data: ogsData } = await (supabase as any)
        .from("ogs_reference")
        .select("id, ogs_number, client_name")
        .eq("company_id", companyId)
        .order("ogs_number", { ascending: false });
      setOgsOptions(ogsData || []);

      // RDOs
      let query = (supabase as any)
        .from("rdo_engenheiro")
        .select("id, ogs_number, data, localizacao, equipe, status, engenheiro_id")
        .eq("company_id", companyId)
        .gte("data", filtroInicio)
        .lte("data", filtroFim)
        .order("data", { ascending: false });

      if (filtroOgs) query = query.eq("ogs_id", filtroOgs);
      if (filtroStatus) query = query.eq("status", filtroStatus);

      const { data: rdoData } = await query;

      // Buscar nomes dos engenheiros
      const engIds = [...new Set((rdoData || []).map((r: any) => r.engenheiro_id).filter(Boolean))];
      let nomeMap: Record<string, string> = {};
      if (engIds.length > 0) {
        const { data: perfis } = await (supabase as any)
          .from("profiles")
          .select("user_id, nome_completo, email")
          .in("user_id", engIds);
        (perfis || []).forEach((p: any) => {
          nomeMap[p.user_id] = p.nome_completo || p.email || "—";
        });
      }

      setRdos((rdoData || []).map((r: any) => ({
        ...r,
        engenheiro_nome: nomeMap[r.engenheiro_id] || "—",
      })));
      setLoading(false);
    };
    load();
  }, [filtroOgs, filtroStatus, filtroInicio, filtroFim]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Histórico RDO Técnico</h1>
          <p className="text-xs text-muted-foreground">Lançamentos de Engenharia</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
        <h2 className="text-sm font-bold">Filtros</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>De</label>
            <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>Até</label>
            <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} className={`${inputCls} w-full`} />
          </div>
        </div>
        <div>
          <label className={labelCls}>OGS</label>
          <select value={filtroOgs} onChange={e => setFiltroOgs(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todas as obras</option>
            {ogsOptions.map(o => <option key={o.id} value={o.id}>{o.ogs_number} — {o.client_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">Todos</option>
            <option value="enviado">Enviado</option>
            <option value="rascunho">Rascunho</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rdos.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum RDO encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{rdos.length} registro{rdos.length !== 1 ? "s" : ""}</p>
          {rdos.map(rdo => (
            <button
              key={rdo.id}
              onClick={() => navigate(`/engenharia/rdo-tecnico/${rdo.id}`)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-border shadow-sm active:scale-95 transition-transform text-left"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">OGS {rdo.ogs_number}</span>
                  {statusBadge(rdo.status)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(rdo.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  {rdo.localizacao ? ` · ${rdo.localizacao}` : ""}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {rdo.equipe || "Sem equipe"} · {rdo.engenheiro_nome}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
