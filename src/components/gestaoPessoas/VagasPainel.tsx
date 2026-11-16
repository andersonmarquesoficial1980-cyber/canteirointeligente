import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { useVagas } from "@/hooks/useVagas";
import {
  MOTIVOS, PRIORIDADES, candidatosParaVaga, ordenarVagas, resumoVagas, rotuloMotivo, rotuloPrioridade, rotuloStatusVaga, vagaEstaAberta,
  type Vaga,
} from "@/lib/vagasContratacao";
import { chaveEquipe } from "@/lib/quadroEquipes";

type Pessoa = { id: string; name: string; role: string | null; equipe: string | null; status?: string | null };

type Props = {
  aberto: boolean;
  onFechar: () => void;
  vagas: ReturnType<typeof useVagas>;
  /** Nomes das equipes do quadro (para escolher onde abrir a vaga). */
  equipes: string[];
  funcionarios: Pessoa[];
  /** Coloca o contratado na equipe da vaga (só quem tem WF Programador). Omitir = sem essa opção. */
  onAlocar?: (pessoa: Pessoa, equipe: string) => Promise<void> | void;
};

const campo = "w-full mt-1 h-9 rounded-lg border border-border bg-background px-2 text-sm";
const rotulo = "text-[10px] text-muted-foreground uppercase";
const COR_PRIORIDADE: Record<string, string> = { urgente: "#dc2626", alta: "#ea580c", normal: "#64748b", baixa: "#94a3b8" };

const formVazio = { equipe: "", funcao_id: "", quantidade: 1, observacao: "", prioridade: "normal", motivo: "aumento_efetivo", data_prevista: "" };

export default function VagasPainel({ aberto, onFechar, vagas, equipes, funcionarios, onAlocar }: Props) {
  const { toast } = useToast();
  const [filtroEquipe, setFiltroEquipe] = useState("");
  const [mostrar, setMostrar] = useState<"abertas" | "todas">("abertas");
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState(formVazio);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(formVazio);
  const [contratando, setContratando] = useState<{ id: string; employeeId: string; alocar: boolean } | null>(null);
  const [cancelando, setCancelando] = useState<{ id: string; motivo: string } | null>(null);

  const resumo = useMemo(() => resumoVagas(vagas.vagas), [vagas.vagas]);
  const opcoesEquipe = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of [...equipes, ...vagas.equipesComVaga]) if (e?.trim() && !m.has(chaveEquipe(e))) m.set(chaveEquipe(e), e.trim());
    return [...m.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [equipes, vagas.equipesComVaga]);
  const lista = useMemo(
    () => ordenarVagas(vagas.vagas.filter((v) => (mostrar === "todas" || vagaEstaAberta(v)) && (!filtroEquipe || chaveEquipe(v.equipe) === chaveEquipe(filtroEquipe))))
      .sort((a, b) => a.equipe.localeCompare(b.equipe, "pt-BR")),
    [vagas.vagas, mostrar, filtroEquipe],
  );

  async function executar(chave: string, fn: () => Promise<unknown>, sucesso: string) {
    setOcupado(chave);
    try { await fn(); toast({ title: sucesso }); return true; }
    catch (e: any) { toast({ title: "Não foi possível salvar", description: e?.message || "Erro inesperado", variant: "destructive" }); return false; }
    finally { setOcupado(null); }
  }

  const salvarNovo = async () => {
    if (!form.equipe || !form.funcao_id) { toast({ title: "Escolha a equipe e a função", variant: "destructive" }); return; }
    const ok = await executar("novo", () => vagas.criar([form]), `${form.quantidade} vaga(s) criada(s)`);
    if (ok) { setForm(formVazio); setNovo(false); }
  };

  const abrirEdicao = (v: Vaga) => {
    setEditando(v.id);
    setEditForm({ equipe: v.equipe, funcao_id: v.funcao_id || "", quantidade: 1, observacao: v.observacao || "", prioridade: v.prioridade, motivo: v.motivo, data_prevista: v.data_prevista || "" });
  };
  const salvarEdicao = async (v: Vaga) => {
    const { quantidade: _q, ...campos } = editForm;
    const ok = await executar(v.id, () => vagas.atualizar(v.id, campos), "Vaga atualizada");
    if (ok) setEditando(null);
  };
  const confirmarContratacao = async (v: Vaga) => {
    if (!contratando?.employeeId) { toast({ title: "Escolha o funcionário contratado", variant: "destructive" }); return; }
    const pessoa = funcionarios.find((f) => f.id === contratando.employeeId);
    const ok = await executar(v.id, async () => {
      await vagas.atualizar(v.id, { status: "contratada", employee_id: contratando.employeeId });
      if (contratando.alocar && onAlocar && pessoa && chaveEquipe(pessoa.equipe) !== chaveEquipe(v.equipe)) await onAlocar(pessoa, v.equipe);
    }, "Vaga preenchida");
    if (ok) setContratando(null);
  };
  const confirmarCancelamento = async (v: Vaga) => {
    if (!cancelando?.motivo.trim()) { toast({ title: "Informe o motivo do cancelamento", variant: "destructive" }); return; }
    const ok = await executar(v.id, () => vagas.atualizar(v.id, { status: "cancelada", motivo_cancelamento: cancelando.motivo }), "Vaga cancelada");
    if (ok) setCancelando(null);
  };

  const formCampos = (f: typeof formVazio, set: (x: typeof formVazio) => void, comQuantidade?: boolean) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <label className="col-span-2"><span className={rotulo}>Equipe</span>
        <select className={campo} value={f.equipe} onChange={(e) => set({ ...f, equipe: e.target.value })}>
          <option value="">Selecione…</option>{opcoesEquipe.map((e) => <option key={e} value={e}>{e}</option>)}
        </select></label>
      <label className="col-span-2"><span className={rotulo}>Função</span>
        <select className={campo} value={f.funcao_id} onChange={(e) => set({ ...f, funcao_id: e.target.value })}>
          <option value="">Selecione…</option>{vagas.funcoes.map((fn) => <option key={fn.id} value={fn.id}>{fn.nome}</option>)}
        </select></label>
      {comQuantidade && <label><span className={rotulo}>Quantidade</span>
        <input type="number" min={1} max={50} className={campo} value={f.quantidade} onChange={(e) => set({ ...f, quantidade: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} /></label>}
      <label><span className={rotulo}>Prioridade</span>
        <select className={campo} value={f.prioridade} onChange={(e) => set({ ...f, prioridade: e.target.value })}>{PRIORIDADES.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select></label>
      <label><span className={rotulo}>Motivo</span>
        <select className={campo} value={f.motivo} onChange={(e) => set({ ...f, motivo: e.target.value })}>{MOTIVOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select></label>
      <label><span className={rotulo}>Data prevista</span>
        <input type="date" className={campo} value={f.data_prevista} onChange={(e) => set({ ...f, data_prevista: e.target.value })} /></label>
      <label className="col-span-2 md:col-span-4"><span className={rotulo}>Observação (ex.: Lindeiro)</span>
        <input className={campo} value={f.observacao} onChange={(e) => set({ ...f, observacao: e.target.value })} /></label>
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vagas de contratação</DialogTitle>
          <DialogDescription>
            {resumo.total} vaga(s) em aberto. Uma linha por posição; a mesma lista aparece na Gestão de Pessoas e no Programador.
          </DialogDescription>
        </DialogHeader>

        {resumo.linhas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {resumo.linhas.map((l) => (
              <span key={`${l.equipe}|${l.funcao}`} className="text-[11px] rounded-full bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5">
                {l.equipe} · {l.funcao}: <b>{l.total}</b>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label><span className={rotulo}>Equipe</span>
            <select className={campo + " w-56"} value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)}>
              <option value="">Todas</option>{opcoesEquipe.map((e) => <option key={e} value={e}>{e}</option>)}
            </select></label>
          <label><span className={rotulo}>Mostrar</span>
            <select className={campo + " w-40"} value={mostrar} onChange={(e) => setMostrar(e.target.value as "abertas" | "todas")}>
              <option value="abertas">Em aberto</option><option value="todas">Todas (com encerradas)</option>
            </select></label>
          {vagas.podeGerir && !novo && <button onClick={() => setNovo(true)} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold">+ Nova vaga</button>}
        </div>

        {!vagas.podeGerir && <p className="text-xs text-muted-foreground">Somente leitura: criar e fechar vagas exige a permissão “Vagas de contratação” (Admin → Permissões).</p>}

        {novo && vagas.podeGerir && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-3 space-y-2">
            {formCampos(form, setForm, true)}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setNovo(false); setForm(formVazio); }} className="h-8 px-3 rounded-lg border border-border text-sm">Cancelar</button>
              <button disabled={ocupado === "novo"} onClick={salvarNovo} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                {ocupado === "novo" ? <Loader2 size={14} className="animate-spin" /> : "Criar vaga(s)"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {vagas.carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!vagas.carregando && lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma vaga neste filtro.</p>}
          {lista.map((v) => {
            const aberta = vagaEstaAberta(v);
            const contratado = v.employee_id ? funcionarios.find((f) => f.id === v.employee_id)?.name : null;
            return (
              <div key={v.id} className="rounded-lg border border-border bg-card p-2.5 text-sm" style={{ opacity: aberta ? 1 : 0.7 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-800">{v.equipe}</span>
                  <b>{v.funcao}</b>
                  {v.observacao && <span className="text-xs text-muted-foreground">({v.observacao})</span>}
                  <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 text-white" style={{ background: COR_PRIORIDADE[v.prioridade] }}>{rotuloPrioridade(v.prioridade)}</span>
                  <span className="text-xs text-muted-foreground">{rotuloMotivo(v.motivo)}{v.data_prevista ? ` · prevista ${v.data_prevista.split("-").reverse().join("/")}` : ""}</span>
                  <span className="ml-auto text-xs font-semibold">{rotuloStatusVaga(v.status)}{contratado ? `: ${contratado}` : ""}{v.status === "cancelada" && v.motivo_cancelamento ? ` — ${v.motivo_cancelamento}` : ""}</span>
                </div>
                {aberta && vagas.podeGerir && editando !== v.id && contratando?.id !== v.id && cancelando?.id !== v.id && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {v.status === "aberta" && <button disabled={ocupado === v.id} onClick={() => executar(v.id, () => vagas.atualizar(v.id, { status: "em_selecao" }), "Vaga em seleção")} className="h-7 px-2 rounded-md border border-border text-xs">Em seleção</button>}
                    <button onClick={() => setContratando({ id: v.id, employeeId: "", alocar: !!onAlocar })} className="h-7 px-2 rounded-md border border-emerald-400 text-emerald-700 text-xs font-semibold">Contratar</button>
                    <button onClick={() => abrirEdicao(v)} className="h-7 px-2 rounded-md border border-border text-xs">Editar</button>
                    <button onClick={() => setCancelando({ id: v.id, motivo: "" })} className="h-7 px-2 rounded-md border border-red-300 text-red-700 text-xs">Cancelar vaga</button>
                  </div>
                )}
                {editando === v.id && (
                  <div className="mt-2 space-y-2">
                    {formCampos(editForm, setEditForm)}
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditando(null)} className="h-8 px-3 rounded-lg border border-border text-sm">Fechar</button>
                      <button disabled={ocupado === v.id} onClick={() => salvarEdicao(v)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">Salvar</button>
                    </div>
                  </div>
                )}
                {contratando?.id === v.id && (
                  <div className="mt-2 space-y-2">
                    <label><span className={rotulo}>Funcionário contratado (já cadastrado)</span>
                      <select className={campo} value={contratando.employeeId} onChange={(e) => setContratando({ ...contratando, employeeId: e.target.value })}>
                        <option value="">Selecione…</option>
                        {candidatosParaVaga(funcionarios, v).map((f) => <option key={f.id} value={f.id}>{f.name} — {f.role || "sem função"} — {f.equipe || "sem equipe"}</option>)}
                      </select></label>
                    {onAlocar && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={contratando.alocar} onChange={(e) => setContratando({ ...contratando, alocar: e.target.checked })} /> Alocar na equipe {v.equipe} (se ainda não estiver)</label>}
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setContratando(null)} className="h-8 px-3 rounded-lg border border-border text-sm">Voltar</button>
                      <button disabled={ocupado === v.id} onClick={() => confirmarContratacao(v)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">Confirmar contratação</button>
                    </div>
                  </div>
                )}
                {cancelando?.id === v.id && (
                  <div className="mt-2 space-y-2">
                    <label><span className={rotulo}>Motivo do cancelamento</span>
                      <input className={campo} value={cancelando.motivo} onChange={(e) => setCancelando({ ...cancelando, motivo: e.target.value })} /></label>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setCancelando(null)} className="h-8 px-3 rounded-lg border border-border text-sm">Voltar</button>
                      <button disabled={ocupado === v.id} onClick={() => confirmarCancelamento(v)} className="h-8 px-3 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Cancelar vaga</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type BotaoProps = Props & { rotuloExtra?: string };

/** Botão “Vagas” (com contador) + painel; estado controlado pelo host para o cartão da coluna também abrir. */
export function VagasBotao({ aberto, onFechar, onAbrir, ...resto }: Omit<BotaoProps, "aberto"> & { aberto: boolean; onAbrir: () => void }) {
  if (!resto.vagas.disponivel) return null;
  return (
    <>
      <button type="button" onClick={onAbrir} className="h-9 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-semibold hover:bg-amber-100">
        Vagas a contratar: {resto.vagas.abertas.length}
      </button>
      <VagasPainel aberto={aberto} onFechar={onFechar} {...resto} />
    </>
  );
}
