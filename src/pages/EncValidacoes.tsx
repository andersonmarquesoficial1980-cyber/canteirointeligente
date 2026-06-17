import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ClipboardCheck, Clock, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";

interface RdoPendente {
  id: string;
  data: string;
  obra_nome: string;
  preenchido_por: string;
  encarregado: string;
  turno: string;
  tipo_rdo: string;
}

export default function EncValidacoes() {
  const navigate = useNavigate();
  const [rdos, setRdos] = useState<RdoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: vinculos } = await (supabase as any)
        .from("encarregado_ogs")
        .select("ogs_id")
        .eq("encarregado_id", user.id)
        .eq("ativo", true);

      const ogsIds = (vinculos || []).map((v: any) => v.ogs_id).filter(Boolean);

      if (ogsIds.length > 0) {
        const { data } = await (supabase as any)
          .from("rdo_diarios")
          .select("id, data, obra_nome, preenchido_por, encarregado, turno, tipo_rdo")
          .in("ogs_id", ogsIds)
          .eq("validado_encarregado", false)
          .eq("nao_aprovado_encarregado", false)
          .order("data", { ascending: false })
          .limit(50);
        setRdos(data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Validar RDOs</h1>
          <p className="text-xs text-muted-foreground">RDOs aguardando sua aprovação</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : rdos.length === 0 ? (
        <div className="rounded-2xl bg-muted/40 border border-border p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhum RDO aguardando sua aprovação.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">{rdos.length} RDO{rdos.length !== 1 ? "s" : ""} aguardando</p>
          {rdos.map(rdo => (
            <button
              key={rdo.id}
              onClick={() => navigate(`/encarregado/validar/${rdo.id}`)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 shadow-sm active:scale-95 transition-transform text-left"
            >
              <div className="space-y-0.5 flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{rdo.obra_nome}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(rdo.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  {rdo.turno && <span className="ml-1 capitalize">· {rdo.turno}</span>}
                  {rdo.tipo_rdo && <span className="ml-1">· {rdo.tipo_rdo}</span>}
                </p>
                {rdo.preenchido_por && (
                  <p className="text-xs text-muted-foreground opacity-70">✍️ {rdo.preenchido_por}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Pendente
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
