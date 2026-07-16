import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, ClipboardList, AlertTriangle, CheckCircle2, Clock, ChevronRight, HardHat, ArrowLeft, History } from "lucide-react";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import IntegracaoObrasCard from "@/components/IntegracaoObrasCard";

interface RdoPendente {
  id: string;
  data: string;
  obra_nome: string;
  preenchido_por: string;
  status_validacao: string;
  ogs_number?: string;
}

interface MinhaOgs {
  id: string;
  ogs_number: string;
  client_name: string;
}

export default function EngHome() {
  const navigate = useNavigate();
  const [rdosPendentes, setRdosPendentes] = useState<RdoPendente[]>([]);
  const [minhasOgs, setMinhasOgs] = useState<MinhaOgs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar company_id do engenheiro
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prof?.company_id) { setLoading(false); return; }

      // Buscar RDOs pendentes de validação de toda a empresa (status 'enviado' ou 'aguardando_validacao')
      const { data: rdos } = await (supabase as any)
        .from("rdo_diarios")
        .select("id, data, obra_nome, preenchido_por, status_validacao, ogs_id")
        .eq("company_id", prof.company_id)
        .in("status_validacao", ["enviado", "aguardando_validacao"])
        .is("validado_por", null)
        .order("data", { ascending: false })
        .limit(20);

      setRdosPendentes(rdos || []);

      // Buscar OGSs vinculadas (via engenheiro_ogs, se houver)
      const { data: vinculos } = await (supabase as any)
        .from("engenheiro_ogs")
        .select("ogs_id, ogs_reference(id, ogs_number, client_name)")
        .eq("engenheiro_id", user.id)
        .eq("ativo", true);

      const ogs: MinhaOgs[] = (vinculos || []).map((v: any) => ({
        id: v.ogs_reference?.id,
        ogs_number: v.ogs_reference?.ogs_number,
        client_name: v.ogs_reference?.client_name,
      })).filter((o: MinhaOgs) => o.id);

      setMinhasOgs(ogs);
      setLoading(false);
    };
    load();
  }, []);

  const statusBadge = (status: string) => {
    if (status === "aguardando_validacao") return (
      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> Aguardando
      </span>
    );
    if (status === "validado") return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Validado
      </span>
    );
    if (status === "rejeitado") return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" /> Rejeitado
      </span>
    );
    return null;
  };

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">

        {/* Programações do dia */}
        <ProgramacoesDoDia />
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">RDO Engenharia</h1>
            <p className="text-xs text-muted-foreground">Validação e lançamento técnico</p>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/engenharia/rdo-tecnico")}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-primary text-white shadow-sm active:scale-95 transition-transform"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-semibold">Novo RDO Técnico</span>
            <span className="text-xs opacity-80">Lançar produção do dia</span>
          </button>
          <button
            onClick={() => navigate("/engenharia/validacoes")}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-white border border-border shadow-sm active:scale-95 transition-transform relative"
          >
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Validar RDOs</span>
            <span className="text-xs text-muted-foreground">Aprovar ou rejeitar</span>
            {rdosPendentes.length > 0 && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {rdosPendentes.length}
              </span>
            )}
          </button>
        </div>

        {/* Histórico RDO Técnico */}
        <button
          onClick={() => navigate("/engenharia/rdo-tecnico/historico")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-border shadow-sm active:scale-95 transition-transform"
        >
          <History className="w-5 h-5 text-primary" />
          <div className="text-left">
            <span className="text-sm font-semibold text-foreground">Histórico RDO Técnico</span>
            <p className="text-xs text-muted-foreground">Visualizar, exportar PDF e Excel</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </button>

        {/* RDOs pendentes de validação */}
        {rdosPendentes.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Aguardando sua validação ({rdosPendentes.length})
            </h2>
            <div className="space-y-2">
              {rdosPendentes.map(rdo => (
                <button
                  key={rdo.id}
                  onClick={() => navigate(`/engenharia/validar/${rdo.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 shadow-sm active:scale-95 transition-transform text-left"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{rdo.obra_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(rdo.data + "T12:00:00").toLocaleDateString("pt-BR")} · {rdo.preenchido_por || "Apontador"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(rdo.status_validacao)}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Minhas obras */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Minhas Obras</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : minhasOgs.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground text-center">
              Nenhuma obra vinculada. Peça ao administrador para configurar suas OGSs.
            </div>
          ) : (
            <div className="space-y-2">
              {minhasOgs.map(ogs => (
                <div key={ogs.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-border shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{ogs.ogs_number}</p>
                    <p className="text-xs text-muted-foreground">{ogs.client_name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
        <IntegracaoObrasCard />
      </div>
    </>
  );
}
