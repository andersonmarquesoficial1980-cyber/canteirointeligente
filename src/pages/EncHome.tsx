import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";
import { ClipboardCheck, AlertTriangle, CheckCircle2, Clock, ChevronRight, HardHat, ArrowLeft, Wrench, TriangleAlert } from "lucide-react";
import ReportarProblemaModal from "@/components/manutencao/ReportarProblemaModal";
import IntegracaoObrasCard from "@/components/IntegracaoObrasCard";

interface RdoPendente {
  id: string;
  data: string;
  obra_nome: string;
  preenchido_por: string;
  ogs_id?: string;
}

interface MinhaOgs {
  id: string;
  ogs_number: string;
  client_name: string;
}

export default function EncHome() {
  const navigate = useNavigate();
  const [rdosPendentes, setRdosPendentes] = useState<RdoPendente[]>([]);
  const [minhasOgs, setMinhasOgs] = useState<MinhaOgs[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportarModal, setShowReportarModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await (supabase as any).from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(prof);

      if (!prof?.company_id) { setLoading(false); return; }

      // Encontrar nome exato do encarregado na tabela employees pelo primeiro+último nome do perfil
      const nameParts = (prof.nome_completo || "")
        .trim()
        .split(/\s+/)
        .filter((p: string) => p.length > 2);

      let nomeEncarregado: string | null = null;
      if (nameParts.length >= 2) {
        const { data: emp } = await (supabase as any)
          .from("employees")
          .select("name")
          .eq("company_id", prof.company_id)
          .ilike("name", `%${nameParts[0]}%`)
          .ilike("name", `%${nameParts[nameParts.length - 1]}%`)
          .maybeSingle();
        nomeEncarregado = emp?.name || null;
      }

      // Buscar RDOs pendentes de validação pelo nome do encarregado
      let rdoQuery = (supabase as any)
        .from("rdo_diarios")
        .select("id, data, obra_nome, preenchido_por, ogs_id")
        .eq("company_id", prof.company_id)
        .eq("validado_encarregado", false)
        .eq("nao_aprovado_encarregado", false)
        .order("data", { ascending: false })
        .limit(20);

      if (nomeEncarregado) {
        rdoQuery = rdoQuery.eq("encarregado", nomeEncarregado);
      }

      const { data: rdos } = await rdoQuery;
      setRdosPendentes(rdos || []);

      // Buscar obras/OGSs vinculadas (via encarregado_ogs, se houver configuração)
      const { data: vinculos } = await (supabase as any)
        .from("encarregado_ogs")
        .select("ogs_id, ogs_reference(id, ogs_number, client_name)")
        .eq("encarregado_id", user.id)
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
            <h1 className="text-lg font-bold text-foreground">Encarregado de Obras</h1>
            <p className="text-xs text-muted-foreground">Validação e acompanhamento</p>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/encarregado/validacoes")}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-primary text-white shadow-sm active:scale-95 transition-transform relative"
          >
            <ClipboardCheck className="w-5 h-5" />
            <span className="text-sm font-semibold">Validar RDOs</span>
            <span className="text-xs opacity-80">Aprovar ou não aprovar</span>
            {rdosPendentes.length > 0 && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {rdosPendentes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/encarregado/equipamentos")}
            className="flex flex-col items-start gap-2 p-4 rounded-2xl bg-white border border-border shadow-sm active:scale-95 transition-transform"
          >
            <Wrench className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Equipamentos</span>
            <span className="text-xs text-muted-foreground">Diários da equipe</span>
          </button>
        </div>

        {/* Reportar Problema */}
        <button
          type="button"
          onClick={() => setShowReportarModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-orange-400 text-orange-500 font-bold text-sm hover:bg-orange-50 transition-colors"
        >
          <TriangleAlert className="w-4 h-4" />
          Reportar Problema no Equipamento
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
                  onClick={() => navigate(`/encarregado/validar/${rdo.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 shadow-sm active:scale-95 transition-transform text-left"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{rdo.obra_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(rdo.data + "T12:00:00").toLocaleDateString("pt-BR")} · {rdo.preenchido_por || "Apontador"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Pendente
                    </span>
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
              Nenhuma obra vinculada. Peça ao administrador para configurar suas obras.
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
      {showReportarModal && (
        <ReportarProblemaModal
          profile={profile}
          onClose={() => setShowReportarModal(false)}
        />
      )}
    </>
  );
}
