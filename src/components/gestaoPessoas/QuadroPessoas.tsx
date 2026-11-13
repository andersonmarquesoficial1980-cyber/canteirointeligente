import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useQuadroEquipesOcultas } from "@/hooks/useQuadroEquipesOcultas";
import { useQuadroEquipesLayout } from "@/hooks/useQuadroEquipesLayout";
import QuadroEquipes, { type PessoaCard } from "@/components/gestaoPessoas/QuadroEquipes";
import PendenciaRapidaDialog from "@/components/gestaoPessoas/PendenciaRapidaDialog";
import MovimentoAlocacaoDialog, { type EstadoMovimento, type FormTemporario } from "@/components/gestaoPessoas/MovimentoAlocacaoDialog";
import { applyProgramadorBatch } from "@/lib/programadorBatch";
import { toLocalISODate } from "@/lib/date-local";
import { SEM_EQUIPE, chaveEquipe, prepararMovimento, rotuloEquipe } from "@/lib/quadroEquipes";
import {
  COLUNA_AFASTADOS, COLUNA_FERIAS, ehColunaDoRH, feriasVigentes, origemDoHistorico, projetarPessoas, resumoEquipe,
  type AlocacaoAtiva, type FeriasLinha,
} from "@/lib/quadroAlocacao";
import {
  STATUS_ABERTOS, agruparAbertasPorFuncionario, montarNovaPendencia, rotuloPendencia,
  type FormPendenciaRapida, type PendenciaQuadro,
} from "@/lib/quadroPendencias";

type Props = {
  funcionarios: (PessoaCard & Record<string, any>)[];
  /** Nomes de equipes (colunas vazias também aparecem). */
  catalogo: string[];
  onAtualizarEquipe: (id: string, equipe: string | null) => void;
  onAbrir: (id: string) => void;
  custoDe?: (p: PessoaCard) => number;
  statusVisual?: (p: PessoaCard) => { label: string; bg: string; text: string } | null;
};

const STATUS_PADRAO: Record<string, { label: string; bg: string; text: string }> = {
  ferias: { label: "Férias", bg: "#e0f2fe", text: "#075985" },
  afastado: { label: "Afastado", bg: "#ffedd5", text: "#9a3412" },
};

/**
 * Quadro de Equipes de funcionários como contêiner autônomo (mesmas regras e preferências do quadro
 * da Gestão de Pessoas). Lê/grava a mesma fonte: employees.equipe via programador_aplicar_lote.
 */
export default function QuadroPessoas({ funcionarios, catalogo, onAtualizarEquipe, onAbrir, custoDe, statusVisual }: Props) {
  const { toast } = useToast();
  const { permissions } = usePermissions();
  const { profile } = useUserProfile();
  const podeMover = permissions?.modulo_programador === true;
  const [userId, setUserId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [movendoId, setMovendoId] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<{ pessoa: PessoaCard; de: string | null; para: string | null; alocacaoId?: string } | null>(null);
  const [dialogo, setDialogo] = useState<{ estado: EstadoMovimento; card: PessoaCard } | null>(null);
  const [salvandoMov, setSalvandoMov] = useState(false);
  const hoje = useMemo(() => toLocalISODate(), []);
  const [alocacoes, setAlocacoes] = useState<AlocacaoAtiva[]>([]);
  const [feriasLinhas, setFeriasLinhas] = useState<FeriasLinha[]>([]);
  const [origemAfastados, setOrigemAfastados] = useState<Record<string, string>>({});
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const companyId = funcionarios[0]?.company_id ?? profile?.company_id ?? null;
  const ocultas = useQuadroEquipesOcultas(companyId, userId);
  const layout = useQuadroEquipesLayout(companyId, userId);
  const porId = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  const [pendLinhas, setPendLinhas] = useState<PendenciaQuadro[]>([]);
  const [pessoaPend, setPessoaPend] = useState<PessoaCard | null>(null);
  const [salvandoPend, setSalvandoPend] = useState(false);
  const carregarPend = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await (supabase as any)
      .from("rh_pendencias_funcionario")
      .select("id, employee_id, tipo, status, prioridade, justificativa, data_efetiva, payload, solicitado_por_nome, created_at")
      .eq("company_id", companyId).in("status", [...STATUS_ABERTOS]).order("created_at", { ascending: true }).limit(2000);
    if (!error) setPendLinhas((data || []) as PendenciaQuadro[]);
  }, [companyId]);
  useEffect(() => { carregarPend(); }, [carregarPend]);
  const pendencias = useMemo(() => agruparAbertasPorFuncionario(pendLinhas), [pendLinhas]);

  // Situação de hoje: alocações temporárias ativas e férias vigentes (RH). Falha silenciosa = quadro como no cadastro.
  const carregarSituacao = useCallback(async () => {
    if (!companyId) return;
    const db = supabase as any;
    try {
    const [al, fe] = await Promise.all([
      db.from("employee_alocacoes_temporarias").select("id, employee_id, equipe_origem, equipe_destino, data_inicio, data_fim_prevista")
        .eq("company_id", companyId).eq("status", "ativa").limit(2000),
      db.from("vacation_records").select("employee_id, data_inicio, data_fim, workflow_status")
        .eq("company_id", companyId).lte("data_inicio", hoje).gte("data_fim", hoje).limit(2000),
    ]);
    if (!al.error) setAlocacoes((al.data || []) as AlocacaoAtiva[]);
    if (!fe.error) setFeriasLinhas((fe.data || []) as FeriasLinha[]);
    } catch { /* sem a situação de hoje, o quadro mostra o cadastro como antes */ }
  }, [companyId, hoje]);
  useEffect(() => { carregarSituacao(); }, [carregarSituacao]);

  // Quem já está na coluna AFASTADOS por cadastro: a origem vem da última "Mudança rápida de equipe: A → AFASTADOS".
  const idsAfastadosSemOrigem = useMemo(
    () => funcionarios.filter((f) => chaveEquipe(f.status) === "afastado" && chaveEquipe(f.equipe) === chaveEquipe(COLUNA_AFASTADOS)).map((f) => f.id),
    [funcionarios],
  );
  useEffect(() => {
    if (!companyId || idsAfastadosSemOrigem.length === 0) return;
    (supabase as any).from("employee_historico").select("employee_id, descricao, created_at")
      .eq("company_id", companyId).eq("tipo", "mudanca_equipe").in("employee_id", idsAfastadosSemOrigem)
      .order("created_at", { ascending: false }).limit(2000)
      .then(({ data, error }: any) => {
        if (error) return;
        const mapa: Record<string, string> = {};
        for (const h of (data || []) as { employee_id: string; descricao: string }[]) {
          if (mapa[h.employee_id] !== undefined || !/→\s*afastados\s*$/i.test(h.descricao || "")) continue;
          const o = origemDoHistorico(h.descricao);
          if (o) mapa[h.employee_id] = o;
        }
        setOrigemAfastados(mapa);
      });
  }, [companyId, idsAfastadosSemOrigem]);

  const projetadas = useMemo(
    () => projetarPessoas({ funcionarios, alocacoes, ferias: feriasVigentes(feriasLinhas, hoje), origemAfastados, hoje }),
    [funcionarios, alocacoes, feriasLinhas, origemAfastados, hoje],
  );
  const catalogoQuadro = useMemo(() => [...catalogo, COLUNA_FERIAS, COLUNA_AFASTADOS], [catalogo]);

  const rpc = async (nome: string, args: Record<string, unknown>) => {
    const { data, error } = await (supabase as any).rpc(nome, args);
    if (error) throw error;
    return data;
  };

  // Arraste: férias/afastado vêm do RH; o resto abre a escolha temporário × definitivo (ou confirma retorno).
  function aoMover(card: PessoaCard, destino: string) {
    if (!podeMover) return;
    const atual = porId.get(card.id);
    if (!atual) return;
    if (card.situacao === "ferias" || card.situacao === "afastado") {
      toast({ title: "Situação vem do RH", description: card.situacao === "ferias" ? "Quem está de férias volta sozinho ao fim do período (Programação de Férias)." : "Ajuste o status do afastamento na ficha do funcionário antes de mover.", variant: "destructive" });
      return;
    }
    const destNome = destino === SEM_EQUIPE ? null : destino.trim();
    if (destNome && ehColunaDoRH(destNome)) {
      toast({ title: "Esta coluna é automática", description: "Férias e Afastados são preenchidos pelo RH (Programação de Férias e status na ficha).", variant: "destructive" });
      return;
    }
    if (chaveEquipe(destNome) === chaveEquipe(card.equipe)) return;
    const emprestado = card.situacao === "emprestado";
    const origem = emprestado ? card.equipeOrigem || null : (atual.equipe || "").trim() || null;
    if (emprestado && destNome && chaveEquipe(destNome) === chaveEquipe(origem)) {
      setDialogo({ card, estado: { tipo: "retorno", nome: atual.name, origem: origem || destNome, destino: card.equipe || "", fimPrevisto: card.fimPrevisto ?? null } });
      return;
    }
    setDialogo({ card, estado: { tipo: "mover", nome: atual.name, origem, destino, destinoRotulo: rotuloEquipe(destNome), emprestado, permiteTemporario: !!origem && !!destNome } });
  }

  function aoConfirmarRetorno(card: PessoaCard) {
    if (!podeMover || !card.alocacaoId) return;
    setDialogo({ card, estado: { tipo: "retorno", nome: card.name, origem: card.equipeOrigem || "", destino: card.equipe || "", fimPrevisto: card.fimPrevisto ?? null } });
  }

  async function encerrarAlocacao(card: PessoaCard, data: string, cancelar = false) {
    if (!card.alocacaoId || !companyId) return;
    await rpc("alocacao_temp_encerrar", { p_company_id: companyId, p_alocacao_id: card.alocacaoId, p_data_retorno: data, p_cancelar: cancelar });
  }

  async function confirmarTemporario(form: FormTemporario) {
    if (!dialogo || dialogo.estado.tipo !== "mover" || !companyId) return;
    const { card, estado } = dialogo;
    setSalvandoMov(true);
    try {
      if (card.alocacaoId) await encerrarAlocacao(card, form.dataInicio);
      const id = await rpc("alocacao_temp_criar", {
        p_company_id: companyId, p_employee_id: card.id, p_equipe_destino: estado.destino,
        p_data_inicio: form.dataInicio, p_data_fim_prevista: form.dataFim || null, p_observacao: form.observacao.trim() || null,
      });
      await carregarSituacao();
      setUltimo({ pessoa: card, de: estado.origem, para: estado.destino, alocacaoId: typeof id === "string" ? id : undefined });
      toast({ title: "Alocação temporária registrada", description: `${card.name}: ${rotuloEquipe(estado.origem)} → ${estado.destinoRotulo} (continua da ${rotuloEquipe(estado.origem)})` });
      setDialogo(null);
    } catch (err: any) {
      toast({ title: "Não foi possível alocar", description: err?.message || "Erro inesperado.", variant: "destructive" });
    } finally { setSalvandoMov(false); }
  }

  async function confirmarDefinitivo() {
    if (!dialogo || dialogo.estado.tipo !== "mover") return;
    const { card, estado } = dialogo;
    setSalvandoMov(true);
    try {
      if (card.alocacaoId) await encerrarAlocacao(card, hoje);
      setDialogo(null);
      await mover(porId.get(card.id) as PessoaCard, estado.destino);
      await carregarSituacao();
    } catch (err: any) {
      toast({ title: "Não foi possível transferir", description: err?.message || "Erro inesperado.", variant: "destructive" });
    } finally { setSalvandoMov(false); }
  }

  async function confirmarRetorno(data: string) {
    if (!dialogo) return;
    const { card } = dialogo;
    setSalvandoMov(true);
    try {
      await encerrarAlocacao(card, data);
      await carregarSituacao();
      toast({ title: "Retorno confirmado", description: `${card.name} voltou para ${rotuloEquipe(card.equipeOrigem)}` });
      setDialogo(null);
    } catch (err: any) {
      toast({ title: "Não foi possível confirmar", description: err?.message || "Erro inesperado.", variant: "destructive" });
    } finally { setSalvandoMov(false); }
  }

  async function desfazerUltimo() {
    if (!ultimo) return;
    if (!ultimo.alocacaoId) { await mover(ultimo.pessoa, ultimo.de || SEM_EQUIPE, true); return; }
    setMovendoId(ultimo.pessoa.id);
    try {
      await encerrarAlocacao({ ...ultimo.pessoa, alocacaoId: ultimo.alocacaoId }, hoje, true);
      await carregarSituacao();
      setUltimo(null);
      toast({ title: "Alocação temporária desfeita", description: ultimo.pessoa.name });
    } catch (err: any) {
      toast({ title: "Não foi possível desfazer", description: err?.message || "Erro inesperado.", variant: "destructive" });
    } finally { setMovendoId(null); }
  }

  async function mover(card: PessoaCard, destino: string, desfazer = false) {
    if (!podeMover) return;
    const atual = porId.get(card.id);
    if (!atual) return;
    const de = (atual.equipe || "").trim() || null;
    if (chaveEquipe(de) === chaveEquipe(destino === SEM_EQUIPE ? null : destino)) return;
    setMovendoId(card.id);
    try {
      const mov = prepararMovimento(atual, destino, atual.company_id || null);
      await applyProgramadorBatch(supabase as any, {
        companyId: atual.company_id || null, date: toLocalISODate(), team: mov.equipe || "-", overrideReason: "",
        employees: [mov], equipments: [],
      });
      onAtualizarEquipe(atual.id, mov.equipe);
      // Mesmo texto da troca rápida: a Conferência MDO lê este formato.
      const { error: histErr } = await (supabase as any).from("employee_historico").insert({
        employee_id: atual.id, company_id: atual.company_id || null, tipo: "mudanca_equipe",
        descricao: `Mudança rápida de equipe: ${rotuloEquipe(de)} → ${rotuloEquipe(mov.equipe)}`, data: toLocalISODate(),
      });
      setUltimo(desfazer ? null : { pessoa: atual, de, para: mov.equipe });
      toast({
        title: desfazer ? "Movimento desfeito" : "Equipe atualizada",
        description: `${atual.name}: ${rotuloEquipe(de)} → ${rotuloEquipe(mov.equipe)}${histErr ? " (histórico da ficha não gravado)" : ""}`,
        variant: histErr ? "destructive" : undefined,
      });
    } catch (err: any) {
      toast({ title: "Não foi possível mover", description: err?.message || "Erro inesperado ao mover o funcionário.", variant: "destructive" });
    } finally { setMovendoId(null); }
  }

  async function registrarPend(form: FormPendenciaRapida) {
    const pessoa = pessoaPend && porId.get(pessoaPend.id);
    if (!pessoa?.company_id) return;
    let nova;
    try { nova = montarNovaPendencia(form); }
    catch (err: any) { toast({ title: err?.message || "Dados inválidos", variant: "destructive" }); return; }
    setSalvandoPend(true);
    try {
      const { error } = await (supabase as any).from("rh_pendencias_funcionario").insert({
        company_id: pessoa.company_id, employee_id: pessoa.id, tipo: nova.tipo, status: "aberta", prioridade: nova.prioridade,
        justificativa: nova.justificativa, data_efetiva: nova.data_efetiva, payload: nova.payload,
        solicitado_por_user_id: profile?.user_id || null, solicitado_por_nome: profile?.nome_completo || profile?.email || null,
      });
      if (error) throw error;
      toast({ title: "Pendência registrada", description: `${pessoa.name}: ${rotuloPendencia({ tipo: nova.tipo, payload: nova.payload })}` });
      setPessoaPend(null);
      await carregarPend();
    } catch (err: any) {
      toast({ title: "Erro ao registrar pendência", description: err?.message || "Tente novamente", variant: "destructive" });
    } finally { setSalvandoPend(false); }
  }

  const equipesDisponiveis = useMemo(
    () => Array.from(new Set([...catalogo, ...funcionarios.map((f) => (f.equipe || "").trim()).filter(Boolean)])).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalogo, funcionarios],
  );

  return (
    <div>
      <div style={{ position: "relative", maxWidth: 560, marginBottom: 10 }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#94a3b8" }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, matrícula, função ou equipe…"
          className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-2 text-sm" />
      </div>

      {ultimo && podeMover && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 12 }}>
          <span style={{ flex: 1 }}><b>{ultimo.pessoa.name}</b>: {rotuloEquipe(ultimo.de)} → {rotuloEquipe(ultimo.para)}{ultimo.alocacaoId ? " (temporário)" : ""}</span>
          <button disabled={movendoId !== null} onClick={desfazerUltimo}
            className="px-2 py-1 rounded-md border border-emerald-400 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50">Desfazer</button>
          <button onClick={() => setUltimo(null)} className="p-1 rounded hover:bg-emerald-100" aria-label="Fechar"><X size={14} /></button>
        </div>
      )}

      <QuadroEquipes
        pessoas={projetadas as PessoaCard[]} catalogo={catalogoQuadro} busca={busca} podeMover={podeMover} movendoId={movendoId}
        custoDe={custoDe ?? (() => 0)}
        statusVisual={statusVisual ?? ((p) => (p.situacao === "ferias" ? STATUS_PADRAO.ferias : STATUS_PADRAO[(p.status || "").toLowerCase()] ?? null))}
        onMover={aoMover} resumoColuna={(chave) => resumoEquipe(chave, projetadas)} onConfirmarRetorno={aoConfirmarRetorno} onAbrir={onAbrir}
        ocultas={ocultas.ocultas} onAlternarColuna={ocultas.alternar} onMostrarTodas={ocultas.mostrarTodas}
        avisoPreferencia={ocultas.erro || layout.erro}
        ordem={layout.ordem} larguras={layout.larguras} onOrdem={layout.definirOrdem} onLargura={layout.definirLargura}
        onLarguraTodas={layout.definirTodas} onRestaurarLayout={layout.restaurar} layoutPersonalizado={layout.personalizado}
        modoCards={layout.modoCards} ordemCards={layout.ordemCards} onModoCards={layout.definirModoCards} onOrdemCards={layout.definirOrdemCards}
        pendencias={pendencias} onPendencia={setPessoaPend}
      />
      <MovimentoAlocacaoDialog
        estado={dialogo?.estado ?? null} hoje={hoje} salvando={salvandoMov} onFechar={() => setDialogo(null)}
        onTemporario={confirmarTemporario} onDefinitivo={confirmarDefinitivo} onRetorno={confirmarRetorno}
      />
      <PendenciaRapidaDialog
        pessoa={pessoaPend} abertas={pessoaPend ? pendencias[pessoaPend.id] || [] : []} equipes={equipesDisponiveis}
        salvando={salvandoPend} onFechar={() => setPessoaPend(null)} onSalvar={registrarPend}
      />
    </div>
  );
}
