import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RdoDetalhe {
  id: string;
  data: string;
  obra_nome: string;
  preenchido_por: string;
  turno: string;
  clima: string;
  encarregado: string;
  engenheiro_responsavel: string;
  status_validacao: string;
  tipo_rdo: string;
}

export default function EngValidarRdo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rdo, setRdo] = useState<RdoDetalhe | null>(null);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showMotivo, setShowMotivo] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

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

      const [rdoRes, prodRes, equiRes, efetRes] = await Promise.all([
        (supabase as any).from("rdo_diarios").select("*").eq("id", id).single(),
        (supabase as any).from("rdo_producao").select("*").eq("rdo_id", id),
        (supabase as any).from("rdo_equipamentos").select("*").eq("rdo_id", id),
        (supabase as any).from("rdo_efetivo").select("*").eq("rdo_id", id),
      ]);

      const perfilNorm = String(prof?.perfil || "").trim().toLowerCase();
      const roleNorm = String(prof?.role || "").trim().toLowerCase();
      const isAdmin =
        roleNorm === "admin" ||
        roleNorm === "superadmin" ||
        roleNorm === "super_admin" ||
        perfilNorm === "administrador" ||
        perfilNorm === "gerente" ||
        !!perms?.is_admin;

      const nomeEng = String(prof?.nome_completo || "").trim().toLowerCase();
      const engRdo = String((rdoRes.data as any)?.engenheiro_responsavel || "").trim().toLowerCase();
      const canValidate = isAdmin || (!!nomeEng && !!engRdo && nomeEng === engRdo);

      if (!canValidate) {
        setAcessoNegado(true);
        setLoading(false);
        return;
      }

      setAcessoNegado(false);
      setRdo(rdoRes.data);
      setProducoes(prodRes.data || []);
      setEquipamentos(equiRes.data || []);
      setEfetivo(efetRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleValidar = async (acao: "validado" | "rejeitado") => {
    if (acao === "rejeitado" && !motivo.trim()) {
      setShowMotivo(true);
      return;
    }
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("rdo_diarios")
      .update({
        status_validacao: acao,
        validado_por: user?.id,
        validado_em: new Date().toISOString(),
        ...(acao === "rejeitado" ? { motivo_rejeicao_eng: motivo } : {}),
      })
      .eq("id", id);

    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: acao === "validado" ? "RDO validado!" : "RDO rejeitado — enviado para Adm Engenharia",
      variant: acao === "validado" ? "default" : "destructive",
    });
    navigate("/engenharia");
  };

  if (loading) return (
    <>
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </>
  );

  if (acessoNegado) return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Este RDO não está vinculado ao seu usuário como engenheiro responsável.
        </div>
      </div>
    </>
  );

  if (!rdo) return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-muted-foreground">RDO não encontrado.</p>
      </div>
    </>
  );

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Validar RDO</h1>
            <p className="text-xs text-muted-foreground">{rdo.obra_nome}</p>
          </div>
        </div>

        {/* Info geral */}
        <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Informações Gerais</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p className="font-medium">{new Date(rdo.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Turno</p>
              <p className="font-medium capitalize">{rdo.turno || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Apontador</p>
              <p className="font-medium">{rdo.preenchido_por || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Encarregado</p>
              <p className="font-medium">{rdo.encarregado || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engenheiro responsável</p>
              <p className="font-medium">{rdo.engenheiro_responsavel || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clima</p>
              <p className="font-medium">{rdo.clima || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo RDO</p>
              <p className="font-medium">{rdo.tipo_rdo || "—"}</p>
            </div>
          </div>
        </div>

        {/* Produção */}
        {producoes.length > 0 && (
          <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
            <h2 className="text-sm font-semibold">Produção ({producoes.length} item{producoes.length > 1 ? "s" : ""})</h2>
            {producoes.map((p, i) => (
              <div key={p.id || i} className="text-sm border-t border-border pt-2 grid grid-cols-2 gap-1">
                <div><span className="text-xs text-muted-foreground">Tipo: </span>{p.tipo_servico || "—"}</div>
                <div><span className="text-xs text-muted-foreground">Área: </span>{p.area_m2 ? `${p.area_m2} m²` : "—"}</div>
                <div><span className="text-xs text-muted-foreground">Ton: </span>{p.tonelagem ? `${p.tonelagem} t` : "—"}</div>
                <div><span className="text-xs text-muted-foreground">Esp: </span>{p.espessura_cm ? `${p.espessura_cm} cm` : "—"}</div>
              </div>
            ))}
          </div>
        )}

        {/* Equipamentos */}
        {equipamentos.length > 0 && (
          <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
            <h2 className="text-sm font-semibold">Equipamentos ({equipamentos.length})</h2>
            {equipamentos.map((e, i) => (
              <div key={e.id || i} className="text-sm flex justify-between">
                <span className="font-medium">{e.frota}</span>
                <span className="text-muted-foreground">{e.sub_tipo || e.categoria}</span>
              </div>
            ))}
          </div>
        )}

        {/* Efetivo */}
        {efetivo.length > 0 && (
          <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
            <h2 className="text-sm font-semibold">Efetivo ({efetivo.length})</h2>
            {efetivo.map((e, i) => (
              <div key={e.id || i} className="text-sm flex justify-between">
                <span className="font-medium">{e.nome || e.matricula}</span>
                <span className="text-muted-foreground">{e.funcao}</span>
              </div>
            ))}
          </div>
        )}

        {/* Campo de motivo de rejeição */}
        {showMotivo && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm font-semibold">Motivo da rejeição (obrigatório)</p>
            </div>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o problema encontrado no RDO..."
              className="w-full text-sm rounded-xl border border-red-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>
        )}

        {/* Botões de ação */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => { setShowMotivo(true); handleValidar("rejeitado"); }}
            disabled={salvando}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-red-500 text-red-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Rejeitar
          </button>
          <button
            onClick={() => handleValidar("validado")}
            disabled={salvando}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Validar RDO
          </button>
        </div>
      </div>
    </>
  );
}
