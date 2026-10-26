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
import { applyProgramadorBatch } from "@/lib/programadorBatch";
import { toLocalISODate } from "@/lib/date-local";
import { SEM_EQUIPE, chaveEquipe, prepararMovimento, rotuloEquipe } from "@/lib/quadroEquipes";
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
  const [ultimo, setUltimo] = useState<{ pessoa: PessoaCard; de: string | null; para: string | null } | null>(null);
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
          <span style={{ flex: 1 }}><b>{ultimo.pessoa.name}</b>: {rotuloEquipe(ultimo.de)} → {rotuloEquipe(ultimo.para)}</span>
          <button disabled={movendoId !== null} onClick={() => mover(ultimo.pessoa, ultimo.de || SEM_EQUIPE, true)}
            className="px-2 py-1 rounded-md border border-emerald-400 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50">Desfazer</button>
          <button onClick={() => setUltimo(null)} className="p-1 rounded hover:bg-emerald-100" aria-label="Fechar"><X size={14} /></button>
        </div>
      )}

      <QuadroEquipes
        pessoas={funcionarios} catalogo={catalogo} busca={busca} podeMover={podeMover} movendoId={movendoId}
        custoDe={custoDe ?? (() => 0)}
        statusVisual={statusVisual ?? ((p) => STATUS_PADRAO[(p.status || "").toLowerCase()] ?? null)}
        onMover={(card, destino) => mover(card, destino)} onAbrir={onAbrir}
        ocultas={ocultas.ocultas} onAlternarColuna={ocultas.alternar} onMostrarTodas={ocultas.mostrarTodas}
        avisoPreferencia={ocultas.erro || layout.erro}
        ordem={layout.ordem} larguras={layout.larguras} onOrdem={layout.definirOrdem} onLargura={layout.definirLargura}
        onLarguraTodas={layout.definirTodas} onRestaurarLayout={layout.restaurar} layoutPersonalizado={layout.personalizado}
        modoCards={layout.modoCards} ordemCards={layout.ordemCards} onModoCards={layout.definirModoCards} onOrdemCards={layout.definirOrdemCards}
        pendencias={pendencias} onPendencia={setPessoaPend}
      />
      <PendenciaRapidaDialog
        pessoa={pessoaPend} abertas={pessoaPend ? pendencias[pessoaPend.id] || [] : []} equipes={equipesDisponiveis}
        salvando={salvandoPend} onFechar={() => setPessoaPend(null)} onSalvar={registrarPend}
      />
    </div>
  );
}
