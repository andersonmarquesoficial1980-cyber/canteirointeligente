import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ClipboardCheck, Clock, ChevronRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface RdoPendente {
  id: string;
  data: string;
  obra_nome: string;
  preenchido_por: string;
  encarregado: string;
  turno: string;
  tipo_rdo: string;
  status_validacao: string;
}

export default function EngValidacoes() {
  const navigate = useNavigate();
  const [rdos, setRdos] = useState<RdoPendente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: prof }, { data: perms }] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("company_id, nome_completo, perfil, role")
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase as any)
          .from("user_permissions")
          .select("is_admin")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!prof?.company_id) { setLoading(false); return; }

      const perfilNorm = String(prof?.perfil || "").trim().toLowerCase();
      const roleNorm = String(prof?.role || "").trim().toLowerCase();
      const isAdmin =
        roleNorm === "admin" ||
        roleNorm === "superadmin" ||
        roleNorm === "super_admin" ||
        perfilNorm === "administrador" ||
        perfilNorm === "gerente" ||
        !!perms?.is_admin;

      let query = (supabase as any)
        .from("rdo_diarios")
        .select("id, data, obra_nome, preenchido_por, encarregado, turno, tipo_rdo, status_validacao, engenheiro_responsavel")
        .eq("company_id", prof.company_id)
        .in("status_validacao", ["enviado", "aguardando_validacao"])
        .is("validado_por", null)
        .order("data", { ascending: false })
        .limit(50);

      if (!isAdmin) {
        const nomeEng = String(prof?.nome_completo || "").trim();
        if (!nomeEng) {
          setRdos([]);
          setLoading(false);
          return;
        }
        query = query.ilike("engenheiro_responsavel", nomeEng);
      }

      const { data } = await query;
      setRdos(data || []);
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
          <p className="text-xs text-muted-foreground">RDOs aguardando validação do engenheiro responsável</p>
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
          <p className="text-xs text-muted-foreground mt-1">Nenhum RDO aguardando validação.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">{rdos.length} RDO{rdos.length !== 1 ? "s" : ""} aguardando</p>
          {rdos.map(rdo => (
            <button
              key={rdo.id}
              onClick={() => navigate(`/engenharia/validar/${rdo.id}`)}
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
                {statusBadge(rdo.status_validacao)}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
