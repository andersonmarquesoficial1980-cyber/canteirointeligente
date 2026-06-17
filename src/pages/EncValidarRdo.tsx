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
  tipo_rdo: string;
  validado_encarregado: boolean;
  nao_aprovado_encarregado: boolean;
  motivo_rejeicao_enc: string | null;
}

export default function EncValidarRdo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rdo, setRdo] = useState<RdoDetalhe | null>(null);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showMotivo, setShowMotivo] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [rdoRes, prodRes, equiRes, efetRes] = await Promise.all([
        (supabase as any).from("rdo_diarios").select("*").eq("id", id).single(),
        (supabase as any).from("rdo_producao").select("*").eq("rdo_id", id),
        (supabase as any).from("rdo_equipamentos").select("*").eq("rdo_id", id),
        (supabase as any).from("rdo_efetivo").select("*").eq("rdo_id", id),
      ]);
      setRdo(rdoRes.data);
      setProducoes(prodRes.data || []);
      setEquipamentos(equiRes.data || []);
      setEfetivo(efetRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleAcao = async (acao: "aprovar" | "nao_aprovar") => {
    if (acao === "nao_aprovar" && !motivo.trim()) {
      setShowMotivo(true);
      return;
    }
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();

    const updateData =
      acao === "aprovar"
        ? {
            validado_encarregado: true,
            nao_aprovado_encarregado: false,
            validado_encarregado_por: user?.id,
            validado_encarregado_em: new Date().toISOString(),
            motivo_rejeicao_enc: null,
          }
        : {
            nao_aprovado_encarregado: true,
            validado_encarregado: false,
            validado_encarregado_por: user?.id,
            validado_encarregado_em: new Date().toISOString(),
            motivo_rejeicao_enc: motivo.trim(),
          };

    const { error } = await (supabase as any)
      .from("rdo_diarios")
      .update(updateData)
      .eq("id", id);

    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: acao === "aprovar" ? "RDO aprovado pelo encarregado!" : "RDO marcado como não aprovado",
      variant: acao === "aprovar" ? "default" : "destructive",
    });
    navigate("/encarregado");
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!rdo) return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <p className="text-muted-foreground">RDO não encontrado.</p>
    </div>
  );

  const jaAvaliado = rdo.validado_encarregado || rdo.nao_aprovado_encarregado;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Validar RDO — Encarregado</h1>
          <p className="text-xs text-muted-foreground">{rdo.obra_nome}</p>
        </div>
      </div>

      {/* Status atual */}
      {jaAvaliado && (
        <div className={`rounded-xl p-3 text-sm font-semibold flex items-center gap-2 ${
          rdo.validado_encarregado
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {rdo.validado_encarregado ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <div>
            <p>{rdo.validado_encarregado ? "Você já aprovou este RDO" : "Você marcou este RDO como não aprovado"}</p>
            {rdo.nao_aprovado_encarregado && rdo.motivo_rejeicao_enc && (
              <p className="text-xs font-normal mt-0.5 opacity-80">Motivo: {rdo.motivo_rejeicao_enc}</p>
            )}
          </div>
        </div>
      )}

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

      {/* Campo de motivo de não aprovação */}
      {showMotivo && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <p className="text-sm font-semibold">Motivo da não aprovação (obrigatório)</p>
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

      {/* Botões de ação — sempre visíveis para permitir mudança de posição */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex gap-3 max-w-lg mx-auto">
        <button
          onClick={() => { setShowMotivo(true); handleAcao("nao_aprovar"); }}
          disabled={salvando}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-red-500 text-red-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Não Aprovar
        </button>
        <button
          onClick={() => handleAcao("aprovar")}
          disabled={salvando}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Aprovar
        </button>
      </div>
    </div>
  );
}
