import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ClipboardCheck, Clock, ChevronRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const VALIDATION_START_DATE = "2026-07-17";

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
  const location = useLocation();
  const goBack = useSmartBack("/encarregado");
  const [rdos, setRdos] = useState<RdoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar perfil para obter nome_completo e company_id
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("nome_completo, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prof?.company_id) { setLoading(false); return; }

      const normalizeName = (v: string) =>
        String(v || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toUpperCase();

      const perfilNome = normalizeName(prof?.nome_completo || "");

      const { data: encarregadosEmpresa } = await (supabase as any)
        .from("employees")
        .select("name")
        .eq("company_id", prof.company_id)
        .eq("is_encarregado", true);

      const candidatos = (encarregadosEmpresa || [])
        .map((e: any) => String(e?.name || ""))
        .filter(Boolean)
        .filter((nome: string) => normalizeName(nome) === perfilNome);

      const nomeEncarregado = candidatos.length === 1 ? candidatos[0] : null;

      // Segurança: sem vínculo inequívoco, NÃO listar pendências da empresa inteira
      if (!nomeEncarregado) {
        setRdos([]);
        setErroVinculo("Seu usuário não está vinculado de forma única a um encarregado. Peça ao admin para ajustar o cadastro/permissões.");
      } else {
        setErroVinculo(null);
        const { data } = await (supabase as any)
          .from("rdo_diarios")
          .select("id, data, obra_nome, preenchido_por, encarregado, turno, tipo_rdo")
          .eq("company_id", prof.company_id)
          .eq("validado_encarregado", false)
          .eq("nao_aprovado_encarregado", false)
          .eq("encarregado", nomeEncarregado)
          .gte("data", VALIDATION_START_DATE)
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
        <button onClick={goBack} className="p-2 rounded-lg hover:bg-muted">
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
      ) : erroVinculo ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center">
          <AlertTriangle className="w-7 h-7 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-amber-900">Vínculo de encarregado não configurado</p>
          <p className="text-xs text-amber-800 mt-1">{erroVinculo}</p>
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
              onClick={() => navigate(`/encarregado/validar/${rdo.id}?returnTo=${returnTo}`)}
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
