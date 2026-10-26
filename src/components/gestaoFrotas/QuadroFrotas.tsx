import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { useQuadroEquipesOcultas } from "@/hooks/useQuadroEquipesOcultas";
import { useQuadroEquipesLayout } from "@/hooks/useQuadroEquipesLayout";
import QuadroEquipes, { type PessoaCard } from "@/components/gestaoPessoas/QuadroEquipes";
import PendenciaEquipamentoDialog from "@/components/gestaoFrotas/PendenciaEquipamentoDialog";
import { agruparAbertasPorFuncionario } from "@/lib/quadroPendencias";
import { montarNovaPendenciaEquip, paraPendenciaQuadro, rotuloPendenciaEquip, type FormPendenciaEquip, type LinhaPendenciaEquip } from "@/lib/quadroFrotasPendencias";
import { useUserProfile } from "@/hooks/useUserProfile";
import { applyProgramadorBatch } from "@/lib/programadorBatch";
import { toLocalISODate } from "@/lib/date-local";
import { SEM_EQUIPE, chaveEquipe, rotuloEquipe } from "@/lib/quadroEquipes";
import {
  badgeStatusEquipamento, custoMensalEquipamento, equipamentoParaCard, estaDevolvido, prepararMovimentoEquipamento,
  type EquipamentoQuadro,
} from "@/lib/quadroFrotas";

const ESCOPO = "gestao-frotas";

type Props = {
  equipamentos: (EquipamentoQuadro & Record<string, any>)[];
  /** Equipes ativas do cadastro central (ci_equipes): viram colunas mesmo vazias. */
  catalogo: string[];
  onAtualizarSetor: (id: string, setor: string | null) => void;
};

/** Quadro de Equipes da Gestão de Frotas: mesmo quadro de pessoas, com equipamentos (equipamentos.setor). */
export default function QuadroFrotas({ equipamentos, catalogo, onAtualizarSetor }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions } = usePermissions();
  const podeMover = permissions?.modulo_programador === true;
  const [userId, setUserId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [movendoId, setMovendoId] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<{ equip: EquipamentoQuadro & Record<string, any>; de: string | null; para: string | null } | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const companyId = equipamentos[0]?.company_id ?? null;
  const { profile } = useUserProfile();

  // Pendências abertas. Se a tabela ainda não existe (migration não aplicada), o quadro segue sem o recurso.
  const [linhasPend, setLinhasPend] = useState<LinhaPendenciaEquip[]>([]);
  const [pendDisponivel, setPendDisponivel] = useState(false);
  const [alvoPend, setAlvoPend] = useState<(EquipamentoQuadro & Record<string, any>) | null>(null);
  const [salvandoPend, setSalvandoPend] = useState(false);
  const carregarPend = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await (supabase as any)
      .from("equip_pendencias")
      .select("id, equipment_id, tipo, status, prioridade, justificativa, data_efetiva, payload, solicitado_por_nome, created_at")
      .eq("company_id", companyId)
      .in("status", ["aberta", "em_analise"])
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) { setPendDisponivel(false); setLinhasPend([]); return; }
    setPendDisponivel(true);
    setLinhasPend((data || []) as LinhaPendenciaEquip[]);
  }, [companyId]);
  useEffect(() => { carregarPend(); }, [carregarPend]);
  const pendencias = useMemo(() => agruparAbertasPorFuncionario(linhasPend.map(paraPendenciaQuadro)), [linhasPend]);
  const podeResolverPend = podeMover || permissions?.is_admin === true;

  async function registrarPend(form: FormPendenciaEquip) {
    if (!alvoPend?.company_id) return;
    let nova;
    try { nova = montarNovaPendenciaEquip(form); }
    catch (err: any) { toast({ title: err?.message || "Dados inválidos", variant: "destructive" }); return; }
    setSalvandoPend(true);
    try {
      const { error } = await (supabase as any).from("equip_pendencias").insert({
        company_id: alvoPend.company_id, equipment_id: alvoPend.id, tipo: nova.tipo, status: "aberta", prioridade: nova.prioridade,
        justificativa: nova.justificativa, data_efetiva: nova.data_efetiva, payload: nova.payload,
        solicitado_por_user_id: profile?.user_id || null, solicitado_por_nome: profile?.nome_completo || profile?.email || null,
      });
      if (error) throw error;
      toast({ title: "Pendência registrada", description: `${alvoPend.frota}: ${rotuloPendenciaEquip({ tipo: nova.tipo, payload: nova.payload })}` });
      setAlvoPend(null);
      await carregarPend();
    } catch (err: any) {
      toast({ title: "Erro ao registrar pendência", description: err?.message || "Tente novamente", variant: "destructive" });
    } finally { setSalvandoPend(false); }
  }

  async function resolverPend(p: LinhaPendenciaEquip, novo: "aprovada" | "cancelada") {
    setSalvandoPend(true);
    try {
      const { error } = await (supabase as any).from("equip_pendencias")
        .update({ status: novo, resolved_at: new Date().toISOString(), resolved_by: profile?.user_id || null }).eq("id", p.id);
      if (error) throw error;
      toast({ title: novo === "aprovada" ? "Pendência concluída" : "Pendência cancelada" });
      await carregarPend();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar pendência", description: err?.message || "Sem permissão ou tente novamente", variant: "destructive" });
    } finally { setSalvandoPend(false); }
  }
  const ocultas = useQuadroEquipesOcultas(companyId, userId, ESCOPO);
  const layout = useQuadroEquipesLayout(companyId, userId, ESCOPO);

  const cards = useMemo(
    () => equipamentos.filter((e) => !estaDevolvido(e.status)).map((e) => equipamentoParaCard(e)) as unknown as PessoaCard[],
    [equipamentos],
  );
  const porId = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);

  async function mover(card: PessoaCard, destino: string, desfazer = false) {
    if (!podeMover) return;
    const atual = porId.get(card.id);
    if (!atual) return;
    const de = (atual.setor || "").trim() || null;
    if (chaveEquipe(de) === chaveEquipe(destino === SEM_EQUIPE ? null : destino)) return;
    setMovendoId(card.id);
    try {
      const mov = prepararMovimentoEquipamento(atual, destino, atual.company_id || null);
      await applyProgramadorBatch(supabase as any, {
        companyId: atual.company_id || null,
        date: toLocalISODate(),
        team: mov.setor || "-",
        overrideReason: "",
        employees: [],
        equipments: [mov],
      });
      onAtualizarSetor(atual.id, mov.setor);
      setUltimo(desfazer ? null : { equip: atual, de, para: mov.setor });
      toast({ title: desfazer ? "Movimento desfeito" : "Equipe atualizada", description: `${atual.frota}: ${rotuloEquipe(de)} → ${rotuloEquipe(mov.setor)}` });
    } catch (err: any) {
      toast({ title: "Não foi possível mover", description: err?.message || "Erro inesperado ao mover o equipamento.", variant: "destructive" });
    } finally {
      setMovendoId(null);
    }
  }

  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ position: "relative", maxWidth: 560, marginBottom: 10 }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#94a3b8" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por frota, placa, tipo ou equipe…"
          className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-2 text-sm"
        />
      </div>

      {ultimo && podeMover && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 12 }}>
          <span style={{ flex: 1 }}><b>{ultimo.equip.frota}</b>: {rotuloEquipe(ultimo.de)} → {rotuloEquipe(ultimo.para)}</span>
          <button
            disabled={movendoId !== null}
            onClick={() => mover(cards.find((c) => c.id === ultimo.equip.id) || (equipamentoParaCard({ ...ultimo.equip, setor: ultimo.para }) as unknown as PessoaCard), ultimo.de || SEM_EQUIPE, true)}
            className="px-2 py-1 rounded-md border border-emerald-400 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50"
          >
            Desfazer
          </button>
          <button onClick={() => setUltimo(null)} className="p-1 rounded hover:bg-emerald-100" aria-label="Fechar"><X size={14} /></button>
        </div>
      )}

      <QuadroEquipes
        pessoas={cards}
        catalogo={catalogo}
        busca={busca}
        podeMover={podeMover}
        movendoId={movendoId}
        custoDe={(p) => { const e = porId.get(p.id); return e ? custoMensalEquipamento(e) : 0; }}
        statusVisual={(p) => badgeStatusEquipamento(p.status)}
        onMover={(card, destino) => mover(card, destino)}
        onAbrir={(id) => navigate(`/gestao-frotas/veiculo/${id}`)}
        ocultas={ocultas.ocultas}
        onAlternarColuna={ocultas.alternar}
        onMostrarTodas={ocultas.mostrarTodas}
        avisoPreferencia={ocultas.erro || layout.erro}
        ordem={layout.ordem}
        larguras={layout.larguras}
        onOrdem={layout.definirOrdem}
        onLargura={layout.definirLargura}
        onLarguraTodas={layout.definirTodas}
        onRestaurarLayout={layout.restaurar}
        layoutPersonalizado={layout.personalizado}
        modoCards={layout.modoCards}
        ordemCards={layout.ordemCards}
        onModoCards={layout.definirModoCards}
        onOrdemCards={layout.definirOrdemCards}
        pendencias={pendDisponivel ? pendencias : undefined}
        onPendencia={pendDisponivel ? (card) => setAlvoPend(porId.get(card.id) ?? null) : undefined}
        rotulos={{
          item: "equipamento", itens: "equipamentos", nenhum: "Nenhum equipamento", agrupar: "Tipo",
          custo: "Locados/mês", programador: "WF Programador",
          iniciais: (p) => (p.name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?",
        }}
      />
      <PendenciaEquipamentoDialog
        equipamento={alvoPend ? { id: alvoPend.id, frota: alvoPend.frota || "", tipo: alvoPend.tipo ?? null, setor: alvoPend.setor ?? null } : null}
        abertas={alvoPend ? linhasPend.filter((l) => l.equipment_id === alvoPend.id) : []}
        equipes={catalogo}
        salvando={salvandoPend}
        podeResolver={podeResolverPend}
        onFechar={() => setAlvoPend(null)}
        onSalvar={registrarPend}
        onResolver={resolverPend}
      />
    </div>
  );
}
