import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { namesLikelyMatch } from "@/lib/nameMatch";

interface RdoDetalhe {
  id: string;
  data: string;
  obra_nome: string;
  local?: string | null;
  preenchido_por: string;
  turno: string;
  clima: string;
  encarregado: string;
  engenheiro_responsavel: string;
  engenheiro_responsavel_user_id?: string | null;
  status_validacao: string;
  tipo_rdo: string;
  observacoes_gerais?: string | null;
  motivo_cancelamento?: string | null;
  motivo_rejeicao_eng?: string | null;
}

const toNum = (value: unknown): number => {
  const n = Number.parseFloat(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (value: number, digits = 2) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function splitPipe(value: string | null | undefined): string[] {
  return String(value || "")
    .split("|||")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function EngValidarRdo() {
  const { id } = useParams<{ id: string }>();
  const goBack = useSmartBack("/engenharia/validacoes");
  const { toast } = useToast();

  const [rdo, setRdo] = useState<RdoDetalhe | null>(null);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [nfMassa, setNfMassa] = useState<any[]>([]);
  const [nfConcreto, setNfConcreto] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showMotivo, setShowMotivo] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      const [rdoRes, prodRes, equiRes, efetRes, nfMassaRes, nfConcretoRes] = await Promise.all([
        (supabase as any).from("rdo_diarios").select("*").eq("id", id).single(),
        (supabase as any).from("rdo_producao").select("*").eq("rdo_id", id),
        (supabase as any).from("rdo_equipamentos").select("*").eq("rdo_id", id),
        (supabase as any).from("rdo_efetivo").select("*").eq("rdo_id", id),
        (supabase as any)
          .from("rdo_nf_massa")
          .select("id,nf,usina,tonelagem,tipo_material")
          .eq("rdo_id", id)
          .order("nf", { ascending: true }),
        (supabase as any)
          .from("rdo_nf_concreto")
          .select("id,nf,fornecedor,quantidade_m3,tipo_concreto")
          .eq("rdo_id", id)
          .order("nf", { ascending: true }),
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

      const nomeEng = String(prof?.nome_completo || "").trim();
      const engRdo = String((rdoRes.data as any)?.engenheiro_responsavel || "").trim();
      const engUserId = String((rdoRes.data as any)?.engenheiro_responsavel_user_id || "").trim();
      const canValidate = isAdmin || (engUserId ? engUserId === user.id : namesLikelyMatch(nomeEng, engRdo));

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
      setNfMassa(nfMassaRes.data || []);
      setNfConcreto(nfConcretoRes.data || []);
      setLoading(false);
    };

    load();
  }, [id]);

  const efetivoExpandido = useMemo(() => {
    const rows: Array<{ nome: string; funcao: string; entrada: string; saida: string; matricula: string }> = [];

    efetivo.forEach((e: any) => {
      const nomes = splitPipe(e.nome);
      const matriculas = splitPipe(e.matricula);
      const entrada = e.entrada || "—";
      const saida = e.saida || "—";
      const funcao = e.funcao || "—";

      if (nomes.length > 0) {
        nomes.forEach((nome, idx) => {
          rows.push({
            nome,
            matricula: matriculas[idx] || "—",
            funcao,
            entrada,
            saida,
          });
        });
        return;
      }

      const qtd = Number(e.quantidade) > 0 ? Number(e.quantidade) : 1;
      for (let i = 0; i < qtd; i += 1) {
        rows.push({
          nome: "—",
          matricula: "—",
          funcao,
          entrada,
          saida,
        });
      }
    });

    return rows;
  }, [efetivo]);

  const totalArea = useMemo(
    () =>
      producoes.reduce((sum, p) => {
        if (p.area_m2 != null && p.area_m2 !== "") return sum + toNum(p.area_m2);
        return sum + toNum(p.comprimento_m) * toNum(p.largura_m);
      }, 0),
    [producoes],
  );

  const totalTonProducao = useMemo(() => producoes.reduce((sum, p) => sum + toNum(p.tonelagem), 0), [producoes]);
  const totalTonNfMassa = useMemo(() => nfMassa.reduce((sum, n) => sum + toNum(n.tonelagem), 0), [nfMassa]);
  const totalM3Concreto = useMemo(() => nfConcreto.reduce((sum, n) => sum + toNum(n.quantidade_m3), 0), [nfConcreto]);

  const entradaGlobal = efetivoExpandido[0]?.entrada || "—";
  const saidaGlobal = efetivoExpandido[0]?.saida || "—";

  const handleValidar = async (acao: "validado" | "rejeitado") => {
    if (acao === "rejeitado" && !motivo.trim()) {
      setShowMotivo(true);
      return;
    }

    setSalvando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    goBack();
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  if (acessoNegado)
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Este RDO não está vinculado ao seu usuário como engenheiro responsável.
        </div>
      </div>
    );

  if (!rdo)
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-muted-foreground">RDO não encontrado.</p>
      </div>
    );

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="p-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Validar RDO</h1>
          <p className="text-xs text-muted-foreground">OGS {rdo.obra_nome}</p>
        </div>
      </div>

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
          <div>
            <p className="text-xs text-muted-foreground">Local</p>
            <p className="font-medium">{rdo.local || "—"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-3">Resumo da validação</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
            <p className="text-muted-foreground">Área total</p>
            <p className="text-sm font-bold text-blue-900">{fmt(totalArea)} m²</p>
          </div>
          <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
            <p className="text-muted-foreground">Ton (produção)</p>
            <p className="text-sm font-bold text-blue-900">{fmt(totalTonProducao, 3)} t</p>
          </div>
          <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
            <p className="text-muted-foreground">Ton (NF massa)</p>
            <p className="text-sm font-bold text-blue-900">{fmt(totalTonNfMassa, 3)} t</p>
          </div>
          <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
            <p className="text-muted-foreground">Concreto</p>
            <p className="text-sm font-bold text-blue-900">{fmt(totalM3Concreto, 3)} m³</p>
          </div>
          <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
            <p className="text-muted-foreground">Efetivo</p>
            <p className="text-sm font-bold text-blue-900">{efetivoExpandido.length} pessoas</p>
          </div>
          <div className="rounded-lg bg-white border border-blue-100 px-3 py-2">
            <p className="text-muted-foreground">Equipamentos</p>
            <p className="text-sm font-bold text-blue-900">{equipamentos.length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Produção ({producoes.length} item{producoes.length > 1 ? "s" : ""})</h2>
          <span className="text-xs text-muted-foreground">Total {fmt(totalArea)} m² · {fmt(totalTonProducao, 3)} t</span>
        </div>
        {producoes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem produção lançada.</p>
        ) : (
          producoes.map((p, i) => (
            <div key={p.id || i} className="text-sm border-t border-border pt-2 grid grid-cols-2 gap-1">
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">#{i + 1} Tipo: </span>
                <span className="font-medium">{p.tipo_servico || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Área: </span>
                {p.area_m2 ? `${fmt(toNum(p.area_m2))} m²` : "—"}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Ton: </span>
                {p.tonelagem ? `${fmt(toNum(p.tonelagem), 3)} t` : "—"}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Esp: </span>
                {p.espessura_cm ? `${fmt(toNum(p.espessura_cm))} cm` : "—"}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Trecho: </span>
                {[p.estaca_inicial, p.estaca_final].filter(Boolean).join(" → ") || "—"}
              </div>
            </div>
          ))
        )}
      </div>

      {nfMassa.length > 0 && (
        <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
          <h2 className="text-sm font-semibold">NFs de Massa ({nfMassa.length})</h2>
          {nfMassa.map((n, i) => (
            <div key={n.id || i} className="text-sm grid grid-cols-2 gap-1 border-t border-border pt-2">
              <div>
                <span className="text-xs text-muted-foreground">NF: </span>
                {n.nf || "—"}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Ton: </span>
                {fmt(toNum(n.tonelagem), 3)} t
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Usina/Tipo: </span>
                {[n.usina, n.tipo_material].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {nfConcreto.length > 0 && (
        <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
          <h2 className="text-sm font-semibold">NFs de Concreto ({nfConcreto.length})</h2>
          {nfConcreto.map((n, i) => (
            <div key={n.id || i} className="text-sm grid grid-cols-2 gap-1 border-t border-border pt-2">
              <div>
                <span className="text-xs text-muted-foreground">NF: </span>
                {n.nf || "—"}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Qtd: </span>
                {fmt(toNum(n.quantidade_m3), 3)} m³
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Fornecedor/Tipo: </span>
                {[n.fornecedor, n.tipo_concreto].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {equipamentos.length > 0 && (
        <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
          <h2 className="text-sm font-semibold">Equipamentos ({equipamentos.length})</h2>
          {equipamentos.map((e, i) => (
            <div key={e.id || i} className="text-sm grid grid-cols-2 gap-1 border-t border-border pt-2">
              <div className="font-medium">{e.frota || e.centro_custo || "—"}</div>
              <div className="text-muted-foreground text-right">{e.empresa_dona || "—"}</div>
              <div className="col-span-2 text-muted-foreground">{e.sub_tipo || e.tipo || e.categoria || "—"}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
        <h2 className="text-sm font-semibold">
          Efetivo ({efetivoExpandido.length}) — {entradaGlobal} às {saidaGlobal}
        </h2>
        {efetivoExpandido.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem efetivo informado.</p>
        ) : (
          efetivoExpandido.map((e, i) => (
            <div key={`${e.nome}-${e.funcao}-${i}`} className="text-sm grid grid-cols-12 gap-2 border-t border-border pt-2">
              <div className="col-span-7 font-medium">{i + 1}. {e.nome}</div>
              <div className="col-span-5 text-right text-muted-foreground">{e.funcao}</div>
              <div className="col-span-12 text-xs text-muted-foreground">
                {e.entrada || "—"} às {e.saida || "—"}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl bg-white border border-border p-4 space-y-2">
        <h2 className="text-sm font-semibold">Observações e contexto</h2>
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Observações gerais</p>
          <p className="font-medium whitespace-pre-wrap">{rdo.observacoes_gerais || "—"}</p>
        </div>
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Motivo de cancelamento / folga</p>
          <p className="font-medium whitespace-pre-wrap">{rdo.motivo_cancelamento || "—"}</p>
        </div>
        {rdo.motivo_rejeicao_eng && (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Motivo de rejeição anterior</p>
            <p className="font-medium whitespace-pre-wrap">{rdo.motivo_rejeicao_eng}</p>
          </div>
        )}
      </div>

      {showMotivo && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <p className="text-sm font-semibold">Motivo da rejeição (obrigatório)</p>
          </div>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Descreva o problema encontrado no RDO..."
            className="w-full text-sm rounded-xl border border-red-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex gap-3 max-w-lg mx-auto">
        <button
          onClick={() => {
            setShowMotivo(true);
            handleValidar("rejeitado");
          }}
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
  );
}
