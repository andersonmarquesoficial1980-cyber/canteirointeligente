/**
 * WF Gestão de Pessoas — Lista de Funcionários
 * Abas: Todos | Por Função | Por Equipe | Por Responsável | Centro de Custo | Aniversariantes
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Search, ChevronRight, ChevronDown, ChevronUp, X, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOrigemBack } from "@/hooks/useOrigemBack";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Funcionario {
  id: string;
  name: string;
  matricula: string | null;
  role: string | null;
  equipe: string | null;
  responsavel: string | null;
  data_nascimento?: string | null;
  salario?: number | null;
  foto_url?: string | null;
  status?: string | null;
  company_id?: string | null;
}

interface VacationRecordResumo {
  id: string;
  employee_id: string;
  data_inicio: string;
  data_fim: string;
}

interface StatusResumo {
  emFeriasAgora: boolean;
  periodoAtual: { inicio: string; fim: string } | null;
  proximoPeriodo: { inicio: string; fim: string } | null;
}

const STATUS_UI: Record<string, { label: string; bg: string; text: string; border: string }> = {
  ativo: { label: "Ativo", bg: "#dcfce7", text: "#166534", border: "#86efac" },
  ferias: { label: "Em férias", bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" },
  afastado: { label: "Afastado", bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  demitido: { label: "Demitido", bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  programado: { label: "Férias programadas", bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
};

function funcaoBase(role: string | null) {
  if (!role) return "SEM FUNÇÃO";
  return role.trim().toUpperCase();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function ontemISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function emIntervalo(data: string, inicio: string, fim: string) {
  return data >= inicio && data <= fim;
}

function fmtPeriodoCurto(dataISO: string) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function fmtPeriodoCompleto(dataISO: string) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function LinhaFuncionario({
  f,
  index,
  onClickFuncionario,
  mostrarSalario,
  equipesDisponiveis,
  updatingEquipeId,
  updatingStatusId,
  updatingFeriasId,
  statusResumo,
  onChangeEquipe,
  onChangeStatus,
  onRegistrarFeriasInline,
  onEncerrarFeriasAgora,
  onExcluirLancamentoIndevido,
  onProgramarFerias,
}: {
  f: Funcionario;
  index: number;
  onClickFuncionario: (id: string) => void;
  mostrarSalario: boolean;
  equipesDisponiveis: string[];
  updatingEquipeId: string | null;
  updatingStatusId: string | null;
  updatingFeriasId: string | null;
  statusResumo: StatusResumo;
  onChangeEquipe: (id: string, novaEquipe: string) => void;
  onChangeStatus: (f: Funcionario, novoStatus: string) => Promise<void>;
  onRegistrarFeriasInline: (f: Funcionario, inicio: string, fim: string) => Promise<void>;
  onEncerrarFeriasAgora: (f: Funcionario) => Promise<void>;
  onExcluirLancamentoIndevido: (f: Funcionario) => Promise<void>;
  onProgramarFerias: (f: Funcionario) => void;
}) {
  const equipeAtual = (f.equipe || "").trim();
  const statusAtual = (f.status || "ativo").toLowerCase();
  const statusVisual = statusResumo.emFeriasAgora
    ? STATUS_UI.ferias
    : statusResumo.proximoPeriodo
      ? STATUS_UI.programado
      : (STATUS_UI[statusAtual] || STATUS_UI.ativo);

  const [statusEdit, setStatusEdit] = useState<string>(statusResumo.emFeriasAgora ? "ferias" : statusAtual);
  const [abrirFeriasInline, setAbrirFeriasInline] = useState(false);
  const [abrirConfirmacaoEncerrarFerias, setAbrirConfirmacaoEncerrarFerias] = useState(false);
  const [abrirConfirmacaoExcluirLancamento, setAbrirConfirmacaoExcluirLancamento] = useState(false);
  const [feriasInicio, setFeriasInicio] = useState(statusResumo.proximoPeriodo?.inicio || "");
  const [feriasFim, setFeriasFim] = useState(statusResumo.proximoPeriodo?.fim || "");

  useEffect(() => {
    setStatusEdit(statusResumo.emFeriasAgora ? "ferias" : (f.status || "ativo").toLowerCase());
  }, [f.status, statusResumo.emFeriasAgora]);

  useEffect(() => {
    if (statusResumo.proximoPeriodo && !statusResumo.emFeriasAgora) {
      setFeriasInicio(statusResumo.proximoPeriodo.inicio);
      setFeriasFim(statusResumo.proximoPeriodo.fim);
    }
  }, [statusResumo.proximoPeriodo, statusResumo.emFeriasAgora]);

  async function aplicarStatus(valor: string) {
    setStatusEdit(valor);
    if (valor === "ferias") {
      setAbrirFeriasInline(true);
      if (!feriasInicio) setFeriasInicio(hojeISO());
      if (!feriasFim) setFeriasFim(hojeISO());
      return;
    }
    setAbrirFeriasInline(false);
    await onChangeStatus(f, valor);
  }

  async function salvarFeriasInline() {
    await onRegistrarFeriasInline(f, feriasInicio, feriasFim);
    setAbrirFeriasInline(false);
    setStatusEdit("ferias");
  }

  return (
    <div
      style={{
        borderBottom: "1px solid #f1f5f9",
        background: index % 2 === 0 ? "white" : "#fafbfc",
      }}
    >
      <div
        onClick={() => onClickFuncionario(f.id)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", cursor: "pointer",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        {f.foto_url ? (
          <img src={f.foto_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#0055AA,#0077DD)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 14, fontWeight: 800,
          }}>
            {f.name.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {f.name}
            </p>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background: statusVisual.bg,
              color: statusVisual.text,
              border: `1px solid ${statusVisual.border}`,
              whiteSpace: "nowrap",
            }}>
              {statusVisual.label}
            </span>
            {statusResumo.periodoAtual && (
              <span style={{ fontSize: 10, color: "#0369a1", fontWeight: 600 }}>
                {fmtPeriodoCurto(statusResumo.periodoAtual.inicio)} → {fmtPeriodoCurto(statusResumo.periodoAtual.fim)}
              </span>
            )}
            {!statusResumo.periodoAtual && statusResumo.proximoPeriodo && (
              <span style={{ fontSize: 10, color: "#5b21b6", fontWeight: 600 }}>
                programada: {fmtPeriodoCurto(statusResumo.proximoPeriodo.inicio)} → {fmtPeriodoCurto(statusResumo.proximoPeriodo.fim)}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
            {f.role ?? "—"}{f.equipe ? ` · ${f.equipe}` : ""}{f.matricula ? ` · Mat. ${f.matricula}` : ""}
            {mostrarSalario && f.salario ? ` · R$ ${Number(f.salario).toLocaleString("pt-BR")}` : ""}
          </p>
        </div>
        <ChevronRight size={15} color="#d1d5db" style={{ flexShrink: 0 }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr auto",
          alignItems: "center",
          gap: 8,
          padding: "0 16px 10px 16px",
          borderTop: "1px solid #f8fafc",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Equipe:</span>
          <Select
            value={equipeAtual || "__sem_equipe"}
            onValueChange={(valor) => onChangeEquipe(f.id, valor)}
            disabled={updatingEquipeId === f.id}
          >
            <SelectTrigger className="h-8 rounded-lg text-xs bg-white">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__sem_equipe">Sem equipe</SelectItem>
              {equipesDisponiveis.map((eq) => (
                <SelectItem key={`${f.id}-${eq}`} value={eq}>{eq}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Status:</span>
          <Select
            value={statusEdit || "ativo"}
            onValueChange={aplicarStatus}
            disabled={updatingStatusId === f.id || updatingFeriasId === f.id}
          >
            <SelectTrigger className="h-8 rounded-lg text-xs bg-white">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="demitido">Demitido</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {statusResumo.emFeriasAgora && (
            <AlertDialog open={abrirConfirmacaoEncerrarFerias} onOpenChange={setAbrirConfirmacaoEncerrarFerias}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAbrirConfirmacaoEncerrarFerias(true);
                }}
                disabled={updatingFeriasId === f.id || updatingStatusId === f.id}
                className="h-8 px-2.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 text-[11px] font-semibold hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-60"
                title="Encerra o período de férias vigente e volta o colaborador para ativo"
              >
                Encerrar férias agora
              </button>

              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar férias agora?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai encerrar as férias vigentes de <strong>{f.name}</strong>, ajustar o fim do período para ontem e retornar o status para ativo.
                    <br />
                    Essa ação também registra automaticamente o evento no histórico do funcionário.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={async () => {
                      await onEncerrarFeriasAgora(f);
                      setStatusEdit("ativo");
                      setAbrirConfirmacaoEncerrarFerias(false);
                    }}
                  >
                    Sim, encerrar agora
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {(statusResumo.emFeriasAgora || statusResumo.proximoPeriodo) && (
            <AlertDialog open={abrirConfirmacaoExcluirLancamento} onOpenChange={setAbrirConfirmacaoExcluirLancamento}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAbrirConfirmacaoExcluirLancamento(true);
                }}
                disabled={updatingFeriasId === f.id || updatingStatusId === f.id}
                className="h-8 px-2.5 rounded-lg border border-red-300 text-red-700 bg-red-50 text-[11px] font-semibold hover:bg-red-100 transition-colors whitespace-nowrap disabled:opacity-60"
                title="Exclui o lançamento de férias indevido e remove o histórico associado"
              >
                Excluir lançamento indevido
              </button>

              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir lançamento indevido?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Use esta opção quando o período de férias foi lançado por engano para <strong>{f.name}</strong>.
                    <br />
                    O período selecionado será removido e o histórico de férias correspondente também será excluído.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={async () => {
                      await onExcluirLancamentoIndevido(f);
                      setStatusEdit("ativo");
                      setAbrirConfirmacaoExcluirLancamento(false);
                    }}
                  >
                    Sim, excluir lançamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onProgramarFerias(f); }}
            className="h-8 px-2.5 rounded-lg border border-primary/30 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors whitespace-nowrap"
            title="Abrir programação de férias deste funcionário"
          >
            Programar férias
          </button>
        </div>
      </div>

      {abrirFeriasInline && (
        <div
          style={{
            margin: "0 16px 10px 16px",
            border: "1px solid #dbeafe",
            background: "#f8fbff",
            borderRadius: 10,
            padding: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1e3a8a", marginBottom: 8 }}>
            Informe o período de férias
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
            <label style={{ fontSize: 10, color: "#475569" }}>
              Início
              <input
                type="date"
                value={feriasInicio}
                onChange={(e) => setFeriasInicio(e.target.value)}
                style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 8px", marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 10, color: "#475569" }}>
              Fim
              <input
                type="date"
                value={feriasFim}
                onChange={(e) => setFeriasFim(e.target.value)}
                style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid #cbd5e1", padding: "0 8px", marginTop: 4 }}
              />
            </label>
            <button
              onClick={salvarFeriasInline}
              disabled={!feriasInicio || !feriasFim || updatingFeriasId === f.id}
              className="h-8 px-3 rounded-lg bg-primary text-white text-[11px] font-semibold disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              onClick={() => {
                setAbrirFeriasInline(false);
                setStatusEdit(statusResumo.emFeriasAgora ? "ferias" : (f.status || "ativo").toLowerCase());
              }}
              className="h-8 px-3 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(updatingEquipeId === f.id || updatingStatusId === f.id || updatingFeriasId === f.id) && (
        <div style={{ padding: "0 16px 10px", display: "flex", justifyContent: "flex-end" }}>
          <Loader2 size={13} className="animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

function GrupoColapsavel({
  titulo,
  itens,
  corTema,
  onClickFuncionario,
  mostrarSalario,
  equipesDisponiveis,
  updatingEquipeId,
  updatingStatusId,
  updatingFeriasId,
  statusResumoPorFuncionario,
  onChangeEquipe,
  onChangeStatus,
  onRegistrarFeriasInline,
  onEncerrarFeriasAgora,
  onExcluirLancamentoIndevido,
  onProgramarFerias,
}: {
  titulo: string;
  itens: Funcionario[];
  corTema: string;
  onClickFuncionario: (id: string) => void;
  mostrarSalario: boolean;
  equipesDisponiveis: string[];
  updatingEquipeId: string | null;
  updatingStatusId: string | null;
  updatingFeriasId: string | null;
  statusResumoPorFuncionario: Record<string, StatusResumo>;
  onChangeEquipe: (id: string, novaEquipe: string) => void;
  onChangeStatus: (f: Funcionario, novoStatus: string) => Promise<void>;
  onRegistrarFeriasInline: (f: Funcionario, inicio: string, fim: string) => Promise<void>;
  onEncerrarFeriasAgora: (f: Funcionario) => Promise<void>;
  onExcluirLancamentoIndevido: (f: Funcionario) => Promise<void>;
  onProgramarFerias: (f: Funcionario) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 8, boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: corTema, flexShrink: 0 }} />
        <p style={{ flex: 1, fontWeight: 700, fontSize: 13, color: "#1e293b", textAlign: "left" }}>{titulo}</p>
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 6 }}>{itens.length}</span>
        {aberto ? <ChevronUp size={15} color="#94a3b8" /> : <ChevronDown size={15} color="#94a3b8" />}
      </button>
      {aberto && (
        <div style={{ borderTop: "1px solid #f1f5f9" }}>
          {itens.map((f, i) => (
            <LinhaFuncionario
              key={f.id}
              f={f}
              index={i}
              onClickFuncionario={onClickFuncionario}
              mostrarSalario={mostrarSalario}
              equipesDisponiveis={equipesDisponiveis}
              updatingEquipeId={updatingEquipeId}
              updatingStatusId={updatingStatusId}
              updatingFeriasId={updatingFeriasId}
              statusResumo={statusResumoPorFuncionario[f.id] || { emFeriasAgora: false, periodoAtual: null, proximoPeriodo: null }}
              onChangeEquipe={onChangeEquipe}
              onChangeStatus={onChangeStatus}
              onRegistrarFeriasInline={onRegistrarFeriasInline}
              onEncerrarFeriasAgora={onEncerrarFeriasAgora}
              onExcluirLancamentoIndevido={onExcluirLancamentoIndevido}
              onProgramarFerias={onProgramarFerias}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Aba = "lista" | "funcao" | "equipe" | "responsavel" | "centro_custo" | "aniversariantes";

export default function GestaoPessoasEquipe() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const rotaVoltar = useOrigemBack("/gestao-pessoas", { "gestao-frotas": "/gestao-frotas" });
  const origem = searchParams.get("origem") || "";
  const abaParam = searchParams.get("aba") as Aba | null;
  const buscaParam = searchParams.get("q") || "";
  const abaInicial: Aba = abaParam && ["lista", "funcao", "equipe", "responsavel", "centro_custo", "aniversariantes"].includes(abaParam)
    ? abaParam
    : "lista";
  const { isAdmin } = useIsAdmin();
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [vacationRecords, setVacationRecords] = useState<VacationRecordResumo[]>([]);
  const [equipesCadastro, setEquipesCadastro] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [busca, setBusca] = useState(buscaParam);
  const [mostrarSalario, setMostrarSalario] = useState(false);
  const [updatingEquipeId, setUpdatingEquipeId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingFeriasId, setUpdatingFeriasId] = useState<string | null>(null);
  const currentParams = new URLSearchParams();
  if (origem) currentParams.set("origem", origem);
  currentParams.set("aba", aba);
  if (busca.trim()) currentParams.set("q", busca);
  const returnTo = encodeURIComponent(`${location.pathname}?${currentParams.toString()}`);

  useEffect(() => {
    Promise.all([
      supabase.from("employees").select("*").order("name"),
      (supabase as any).from("ci_equipes").select("nome").eq("ativa", true).order("nome"),
      (supabase as any).from("vacation_records").select("id,employee_id,data_inicio,data_fim").order("data_inicio", { ascending: false }),
    ]).then(([employeesResp, equipesResp, feriasResp]) => {
      if (employeesResp.data) setTodos(employeesResp.data as any);
      if (equipesResp?.data) {
        const equipes = (equipesResp.data as any[])
          .map((e) => (e?.nome || "").trim())
          .filter(Boolean);
        setEquipesCadastro(equipes);
      }
      if (feriasResp?.data) {
        setVacationRecords(feriasResp.data as VacationRecordResumo[]);
      }
      setLoading(false);
    });
  }, []);

  const equipesDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    const add = (nome: string | null | undefined) => {
      const limpo = (nome || "").trim();
      if (!limpo) return;
      const chave = limpo.toLocaleLowerCase("pt-BR");
      if (!map.has(chave)) map.set(chave, limpo);
    };

    todos.forEach((f) => add(f.equipe));
    equipesCadastro.forEach((eq) => add(eq));

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [todos, equipesCadastro]);

  const statusResumoPorFuncionario = useMemo(() => {
    const hoje = hojeISO();
    const mapa: Record<string, StatusResumo> = {};

    for (const f of todos) {
      const registros = vacationRecords
        .filter((r) => r.employee_id === f.id)
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

      const atual = registros.find((r) => emIntervalo(hoje, r.data_inicio, r.data_fim));
      const proximo = registros.find((r) => r.data_inicio >= hoje);

      mapa[f.id] = {
        emFeriasAgora: Boolean(atual),
        periodoAtual: atual ? { inicio: atual.data_inicio, fim: atual.data_fim } : null,
        proximoPeriodo: !atual && proximo ? { inicio: proximo.data_inicio, fim: proximo.data_fim } : null,
      };
    }

    return mapa;
  }, [todos, vacationRecords]);

  async function alterarEquipeRapida(funcionarioId: string, novaEquipe: string) {
    const equipeNova = novaEquipe === "__sem_equipe" ? null : novaEquipe;
    const funcAtual = todos.find((f) => f.id === funcionarioId);
    const equipeAnterior = (funcAtual?.equipe || "").trim() || null;

    if ((equipeAnterior || null) === (equipeNova || null)) return;

    setUpdatingEquipeId(funcionarioId);

    try {
      const { error } = await (supabase as any)
        .from("employees")
        .update({
          equipe: equipeNova,
        })
        .eq("id", funcionarioId);

      if (error) {
        toast({
          title: "Erro ao atualizar equipe",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setTodos((prev) => prev.map((f) => (f.id === funcionarioId ? { ...f, equipe: equipeNova } : f)));

      const hoje = new Date().toISOString().slice(0, 10);
      await (supabase as any).from("employee_historico").insert({
        employee_id: funcionarioId,
        company_id: funcAtual?.company_id || null,
        tipo: "mudanca_equipe",
        descricao: `Mudança rápida de equipe: ${equipeAnterior || "Sem equipe"} → ${equipeNova || "Sem equipe"}`,
        data: hoje,
      });

      toast({
        title: "Equipe atualizada",
        description: `${funcAtual?.name || "Funcionário"}: ${equipeAnterior || "Sem equipe"} → ${equipeNova || "Sem equipe"}`,
      });
    } catch (err: any) {
      toast({
        title: "Erro inesperado",
        description: err?.message || "Não foi possível alterar a equipe agora.",
        variant: "destructive",
      });
    } finally {
      setUpdatingEquipeId(null);
    }
  }

  async function alterarStatusRapido(funcionario: Funcionario, novoStatus: string) {
    const statusAnterior = (funcionario.status || "ativo").toLowerCase();
    const statusNormalizado = novoStatus.toLowerCase();

    if (statusAnterior === statusNormalizado) return;

    // Status férias deve ser derivado de período; ao escolher "férias" abre fluxo de datas inline.
    if (statusNormalizado === "ferias") {
      return;
    }

    setUpdatingStatusId(funcionario.id);

    try {
      // Se houver férias vigentes e o usuário mudar para outro status,
      // encerra os registros vigentes para liberar a edição no espelho.
      const hoje = hojeISO();
      const ontem = ontemISO();
      const vigentes = vacationRecords.filter(
        (r) => r.employee_id === funcionario.id && emIntervalo(hoje, r.data_inicio, r.data_fim)
      );

      if (vigentes.length > 0) {
        const ajustes = await Promise.all(
          vigentes.map(async (r) => {
            const payloadRegistro = r.data_inicio > ontem
              ? {
                  data_inicio: ontem,
                  data_fim: ontem,
                  observacao: "Ajuste rápido na lista de funcionários (encerramento de férias vigentes)",
                }
              : {
                  data_fim: ontem,
                  observacao: "Ajuste rápido na lista de funcionários (encerramento de férias vigentes)",
                };

            const { error } = await (supabase as any)
              .from("vacation_records")
              .update(payloadRegistro)
              .eq("id", r.id);

            return { id: r.id, error, payloadRegistro };
          })
        );

        const erroAjuste = ajustes.find((a) => a.error);
        if (erroAjuste?.error) {
          toast({
            title: "Erro ao encerrar férias vigentes",
            description: erroAjuste.error.message,
            variant: "destructive",
          });
          return;
        }

        setVacationRecords((prev) => prev.map((r) => {
          const ajuste = ajustes.find((a) => a.id === r.id);
          if (!ajuste) return r;
          return {
            ...r,
            data_inicio: (ajuste.payloadRegistro as any).data_inicio ?? r.data_inicio,
            data_fim: (ajuste.payloadRegistro as any).data_fim ?? r.data_fim,
          };
        }));
      }

      const payload: Record<string, any> = {
        status: statusNormalizado,
      };

      if (statusNormalizado === "demitido") {
        payload.data_demissao = hoje;
      } else {
        payload.data_demissao = null;
      }

      const statusQuery = (supabase as any)
        .from("employees")
        .update(payload)
        .eq("id", funcionario.id);

      if (funcionario.company_id) {
        statusQuery.eq("company_id", funcionario.company_id);
      }

      const { error } = await statusQuery;

      if (error) {
        toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
        return;
      }

      setTodos((prev) => prev.map((f) => (f.id === funcionario.id ? { ...f, status: statusNormalizado } : f)));

      await (supabase as any).from("employee_historico").insert({
        employee_id: funcionario.id,
        company_id: funcionario.company_id || null,
        tipo: statusNormalizado === "demitido" ? "demissao" : statusNormalizado === "afastado" ? "afastamento" : "outro",
        descricao: `Mudança rápida de status: ${statusAnterior} → ${statusNormalizado}`,
        data: hoje,
      });

      toast({ title: "Status atualizado", description: `${funcionario.name}: ${statusAnterior} → ${statusNormalizado}` });
    } catch (err: any) {
      toast({
        title: "Erro inesperado",
        description: err?.message || "Não foi possível alterar o status agora.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function encerrarFeriasAgora(funcionario: Funcionario) {
    setUpdatingFeriasId(funcionario.id);

    try {
      const hoje = hojeISO();
      const ontem = ontemISO();
      const vigentes = vacationRecords.filter(
        (r) => r.employee_id === funcionario.id && emIntervalo(hoje, r.data_inicio, r.data_fim)
      );

      if (vigentes.length === 0) {
        // fallback: força status ativo mesmo sem registro vigente local
        const fallbackQuery = (supabase as any)
          .from("employees")
          .update({ status: "ativo", data_demissao: null })
          .eq("id", funcionario.id);

        if (funcionario.company_id) fallbackQuery.eq("company_id", funcionario.company_id);
        const { error: fallbackErr } = await fallbackQuery;
        if (fallbackErr) {
          toast({ title: "Erro ao corrigir status", description: fallbackErr.message, variant: "destructive" });
          return;
        }

        setTodos((prev) => prev.map((f) => (f.id === funcionario.id ? { ...f, status: "ativo" } : f)));
        toast({ title: "Status corrigido", description: `${funcionario.name}: marcado como ativo.` });
        return;
      }

      const ajustes = await Promise.all(
        vigentes.map(async (r) => {
          const payloadRegistro = r.data_inicio > ontem
            ? {
                data_inicio: ontem,
                data_fim: ontem,
                observacao: "Encerrado manualmente no espelho de funcionários",
              }
            : {
                data_fim: ontem,
                observacao: "Encerrado manualmente no espelho de funcionários",
              };

          const { error } = await (supabase as any)
            .from("vacation_records")
            .update(payloadRegistro)
            .eq("id", r.id);

          return { id: r.id, error, payloadRegistro };
        })
      );

      const erroAjuste = ajustes.find((a) => a.error);
      if (erroAjuste?.error) {
        toast({
          title: "Erro ao encerrar férias",
          description: erroAjuste.error.message,
          variant: "destructive",
        });
        return;
      }

      const statusQuery = (supabase as any)
        .from("employees")
        .update({ status: "ativo", data_demissao: null })
        .eq("id", funcionario.id);

      if (funcionario.company_id) statusQuery.eq("company_id", funcionario.company_id);

      const { error: errStatus } = await statusQuery;
      if (errStatus) {
        toast({
          title: "Erro ao atualizar status",
          description: errStatus.message,
          variant: "destructive",
        });
        return;
      }

      setVacationRecords((prev) => prev.map((r) => {
        const ajuste = ajustes.find((a) => a.id === r.id);
        if (!ajuste) return r;
        return {
          ...r,
          data_inicio: (ajuste.payloadRegistro as any).data_inicio ?? r.data_inicio,
          data_fim: (ajuste.payloadRegistro as any).data_fim ?? r.data_fim,
        };
      }));

      setTodos((prev) => prev.map((f) => (f.id === funcionario.id ? { ...f, status: "ativo" } : f)));

      await (supabase as any).from("employee_historico").insert({
        employee_id: funcionario.id,
        company_id: funcionario.company_id || null,
        tipo: "retorno",
        descricao: "Encerramento manual de férias no espelho de funcionários",
        data: hoje,
      });

      toast({ title: "Férias encerradas", description: `${funcionario.name} voltou para ativo.` });
    } catch (err: any) {
      toast({
        title: "Erro inesperado",
        description: err?.message || "Não foi possível encerrar as férias agora.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFeriasId(null);
    }
  }

  async function excluirLancamentoIndevido(funcionario: Funcionario) {
    setUpdatingFeriasId(funcionario.id);

    try {
      const hoje = hojeISO();
      const registrosDoFuncionario = vacationRecords
        .filter((r) => r.employee_id === funcionario.id)
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

      const vigente = registrosDoFuncionario.find((r) => emIntervalo(hoje, r.data_inicio, r.data_fim));
      const futuro = registrosDoFuncionario.find((r) => r.data_inicio >= hoje);
      const alvo = vigente || futuro || registrosDoFuncionario[registrosDoFuncionario.length - 1];

      if (!alvo) {
        toast({
          title: "Nenhum lançamento para excluir",
          description: "Não foi encontrado período de férias para este funcionário.",
        });
        return;
      }

      const { error: delErro } = await (supabase as any)
        .from("vacation_records")
        .delete()
        .eq("id", alvo.id);

      if (delErro) {
        toast({ title: "Erro ao excluir lançamento", description: delErro.message, variant: "destructive" });
        return;
      }

      const inicioCurto = fmtPeriodoCurto(alvo.data_inicio);
      const fimCurto = fmtPeriodoCurto(alvo.data_fim);
      const inicioCompleto = fmtPeriodoCompleto(alvo.data_inicio);
      const fimCompleto = fmtPeriodoCompleto(alvo.data_fim);

      const { data: historicosFerias } = await (supabase as any)
        .from("employee_historico")
        .select("id, descricao, data")
        .eq("employee_id", funcionario.id)
        .eq("company_id", funcionario.company_id || "")
        .eq("tipo", "ferias")
        .eq("data", alvo.data_inicio);

      const idsHistoricoParaExcluir = (historicosFerias || [])
        .filter((h: any) => {
          const d = (h?.descricao || "") as string;
          return (
            d.includes(inicioCurto) ||
            d.includes(fimCurto) ||
            d.includes(inicioCompleto) ||
            d.includes(fimCompleto) ||
            d.toLowerCase().includes("férias")
          );
        })
        .map((h: any) => h.id)
        .filter(Boolean);

      if (idsHistoricoParaExcluir.length > 0) {
        await (supabase as any)
          .from("employee_historico")
          .delete()
          .in("id", idsHistoricoParaExcluir);
      }

      const novosRegistros = vacationRecords.filter((r) => r.id !== alvo.id);
      setVacationRecords(novosRegistros);

      const aindaEmFerias = novosRegistros.some((r) => r.employee_id === funcionario.id && emIntervalo(hoje, r.data_inicio, r.data_fim));
      if (!aindaEmFerias) {
        const statusQuery = (supabase as any)
          .from("employees")
          .update({ status: "ativo", data_demissao: null })
          .eq("id", funcionario.id);

        if (funcionario.company_id) statusQuery.eq("company_id", funcionario.company_id);

        await statusQuery;
        setTodos((prev) => prev.map((f) => (f.id === funcionario.id ? { ...f, status: "ativo" } : f)));
      }

      toast({
        title: "Lançamento indevido excluído",
        description: `${funcionario.name}: ${inicioCompleto} → ${fimCompleto} removido${idsHistoricoParaExcluir.length ? " (histórico também removido)" : ""}.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro inesperado",
        description: err?.message || "Não foi possível excluir o lançamento indevido agora.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFeriasId(null);
    }
  }

  async function registrarFeriasInline(funcionario: Funcionario, inicio: string, fim: string) {
    if (!inicio || !fim || fim < inicio) {
      toast({ title: "Período inválido", description: "Informe início/fim válidos.", variant: "destructive" });
      return;
    }

    setUpdatingFeriasId(funcionario.id);

    try {
      const dias = Math.floor((new Date(`${fim}T12:00:00`).getTime() - new Date(`${inicio}T12:00:00`).getTime()) / 86400000) + 1;
      const payload = {
        employee_id: funcionario.id,
        company_id: funcionario.company_id || null,
        vacation_period_id: null,
        tipo: "individual",
        data_inicio: inicio,
        data_fim: fim,
        dias,
        observacao: "Registro rápido pela lista de funcionários",
        registrado_por: "admin",
      };

      const { data, error } = await (supabase as any)
        .from("vacation_records")
        .insert(payload)
        .select("id,employee_id,data_inicio,data_fim")
        .single();

      if (error) {
        toast({ title: "Erro ao registrar férias", description: error.message, variant: "destructive" });
        return;
      }

      await (supabase as any).from("employee_historico").insert({
        employee_id: funcionario.id,
        company_id: funcionario.company_id || null,
        tipo: "ferias",
        descricao: `Férias registradas: ${fmtPeriodoCurto(inicio)} → ${fmtPeriodoCurto(fim)} (${dias}d)`,
        data: inicio,
      });

      const hoje = hojeISO();
      const emFeriasAgora = emIntervalo(hoje, inicio, fim);
      if (emFeriasAgora) {
        const statusFeriasQuery = (supabase as any)
          .from("employees")
          .update({ status: "ferias" })
          .eq("id", funcionario.id);

        if (funcionario.company_id) {
          statusFeriasQuery.eq("company_id", funcionario.company_id);
        }

        await statusFeriasQuery;

        setTodos((prev) => prev.map((f) => (f.id === funcionario.id ? { ...f, status: "ferias" } : f)));
      }

      if (data) {
        setVacationRecords((prev) => [data as VacationRecordResumo, ...prev]);
      }

      toast({ title: "Férias registradas", description: `${funcionario.name}: ${fmtPeriodoCurto(inicio)} → ${fmtPeriodoCurto(fim)}` });
    } catch (err: any) {
      toast({
        title: "Erro inesperado",
        description: err?.message || "Não foi possível registrar férias agora.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFeriasId(null);
    }
  }

  useEffect(() => {
    const next = new URLSearchParams();
    if (origem) next.set("origem", origem);
    next.set("aba", aba);
    if (busca.trim()) next.set("q", busca);
    setSearchParams(next, { replace: true });
  }, [aba, busca, origem, setSearchParams]);

  const porFuncao: Record<string, Funcionario[]> = {};
  const porEquipe: Record<string, Funcionario[]> = {};
  const porResp: Record<string, Funcionario[]> = {};
  const porCentro: Record<string, Funcionario[]> = {};

  todos.forEach(f => {
    const fb = funcaoBase(f.role);
    if (!porFuncao[fb]) porFuncao[fb] = [];
    porFuncao[fb].push(f);
    const eq = f.equipe || "SEM EQUIPE";
    if (!porEquipe[eq]) porEquipe[eq] = [];
    porEquipe[eq].push(f);
    const resp = f.responsavel || "SEM RESPONSÁVEL";
    if (!porResp[resp]) porResp[resp] = [];
    porResp[resp].push(f);
    const cc = (f as any).centro_custo || "SEM CENTRO DE CUSTO";
    if (!porCentro[cc]) porCentro[cc] = [];
    porCentro[cc].push(f);
  });

  const mesAtual = new Date().getMonth() + 1;
  const aniversariantes = todos
    .filter(f => { const n = (f as any).data_nascimento; if (!n) return false; return parseInt(n.split("-")[1]) === mesAtual; })
    .sort((a, b) => parseInt(((a as any).data_nascimento || "").split("-")[2] || "0") - parseInt(((b as any).data_nascimento || "").split("-")[2] || "0"));

  const filtrados = busca
    ? todos.filter(f =>
        f.name.toLowerCase().includes(busca.toLowerCase()) ||
        (f.matricula || "").includes(busca) ||
        (f.equipe || "").toLowerCase().includes(busca.toLowerCase()) ||
        (f.role || "").toLowerCase().includes(busca.toLowerCase()) ||
        ((f as any).centro_custo || "").toLowerCase().includes(busca.toLowerCase())
      )
    : todos;

  const irFuncionario = (id: string) => navigate(`/gestao-pessoas/${id}?returnTo=${returnTo}`);

  const irProgramacaoFerias = (f: Funcionario) => {
    const params = new URLSearchParams();
    if (origem) params.set("origem", origem);
    params.set("q", f.matricula?.trim() || f.name);
    params.set("funcionario_id", f.id);
    params.set("returnTo", `${location.pathname}?${currentParams.toString()}`);
    navigate(`/gestao-pessoas/ferias?${params.toString()}`);
  };

  const ABAS: { id: Aba; label: string; emoji: string; count?: number }[] = [
    { id: "lista",           label: "Todos",           emoji: "👤", count: todos.length },
    { id: "funcao",          label: "Por Função",      emoji: "🔧", count: Object.keys(porFuncao).length },
    { id: "equipe",          label: "Por Equipe",      emoji: "👷", count: Object.keys(porEquipe).length },
    { id: "responsavel",     label: "Por Responsável", emoji: "🧑‍💼", count: Object.keys(porResp).filter(k => k !== "SEM RESPONSÁVEL").length },
    { id: "centro_custo",    label: "Centro de Custo", emoji: "🏢", count: Object.keys(porCentro).filter(k => k !== "SEM CENTRO DE CUSTO").length },
    { id: "aniversariantes", label: "Aniversariantes", emoji: "🎂", count: aniversariantes.length },
  ];

  const corGrupo = (ab: Aba) =>
    ab === "funcao" ? "#0055AA" : ab === "equipe" ? "#006640" : ab === "responsavel" ? "#6D28D9" : ab === "centro_custo" ? "#B45309" : "#374151";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate(rotaVoltar)} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Funcionários</span>
          <span className="block text-[10px] text-primary-foreground/70">{todos.length} cadastrados</span>
        </div>
      </header>

      {/* Resumo */}
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 760, margin: "0 auto" }}>
          {[
            { label: "Total",        value: todos.length,                                                                     cor: "#00C6FF" },
            { label: "Equipes",      value: Object.keys(porEquipe).length,                                                    cor: "#FFB300" },
            { label: "Funções",      value: Object.keys(porFuncao).length,                                                    cor: "#22c55e" },
            { label: "C. Custo",     value: Object.keys(porCentro).filter(k => k !== "SEM CENTRO DE CUSTO").length,          cor: "#B45309" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", flex: 1, textAlign: "center", minWidth: 60 }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div className="flex overflow-x-auto border-b border-border bg-background sticky top-[60px] z-20">
        {ABAS.map(a => (
          <button
            key={a.id}
            onClick={() => { setAba(a.id); setBusca(""); }}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 shrink-0 ${
              aba === a.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{a.emoji}</span>
            <span>{a.label}</span>
            {a.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${aba === a.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {a.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nome, matrícula, função ou equipe..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: "100%", height: 44, borderRadius: 12,
              border: "1.5px solid #e2e8f0", paddingLeft: 36, paddingRight: busca ? 36 : 12,
              fontSize: 13, outline: "none", background: "white", boxSizing: "border-box",
            }}
          />
          {busca && (
            <button onClick={() => setBusca("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>
        ) : (
          <>
            {/* ABA TODOS */}
            {aba === "lista" && (
              <>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
                  {filtrados.length} funcionário{filtrados.length !== 1 ? "s" : ""}{busca ? ` para "${busca}"` : ""}
                </p>
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  {filtrados.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: 13 }}>Nenhum funcionário encontrado</p>
                  ) : filtrados.map((f, i) => (
                    <LinhaFuncionario
                      key={f.id}
                      f={f}
                      index={i}
                      onClickFuncionario={irFuncionario}
                      mostrarSalario={false}
                      equipesDisponiveis={equipesDisponiveis}
                      updatingEquipeId={updatingEquipeId}
                      updatingStatusId={updatingStatusId}
                      updatingFeriasId={updatingFeriasId}
                      statusResumo={statusResumoPorFuncionario[f.id] || { emFeriasAgora: false, periodoAtual: null, proximoPeriodo: null }}
                      onChangeEquipe={alterarEquipeRapida}
                      onChangeStatus={alterarStatusRapido}
                      onRegistrarFeriasInline={registrarFeriasInline}
                      onEncerrarFeriasAgora={encerrarFeriasAgora}
                      onExcluirLancamentoIndevido={excluirLancamentoIndevido}
                      onProgramarFerias={irProgramacaoFerias}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ABAS AGRUPADAS */}
            {(aba === "funcao" || aba === "equipe" || aba === "responsavel" || aba === "centro_custo") && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>
                    {aba === "funcao" ? Object.keys(porFuncao).length : aba === "equipe" ? Object.keys(porEquipe).length : aba === "centro_custo" ? Object.keys(porCentro).length : Object.keys(porResp).length} grupos · {todos.length} funcionários
                  </p>
                  {isAdmin && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: mostrarSalario ? "#f97316" : "#64748b" }}>
                      <input type="checkbox" checked={mostrarSalario} onChange={e => setMostrarSalario(e.target.checked)} style={{ accentColor: "#f97316" }} />
                      Ver salário
                    </label>
                  )}
                </div>
                {Object.entries(
                  aba === "funcao" ? porFuncao : aba === "equipe" ? porEquipe : aba === "centro_custo" ? porCentro : porResp
                )
                  .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
                  .map(([chave, itens]) => (
                    <GrupoColapsavel
                      key={chave}
                      titulo={chave}
                      itens={itens}
                      corTema={corGrupo(aba)}
                      onClickFuncionario={irFuncionario}
                      mostrarSalario={mostrarSalario && isAdmin}
                      equipesDisponiveis={equipesDisponiveis}
                      updatingEquipeId={updatingEquipeId}
                      updatingStatusId={updatingStatusId}
                      updatingFeriasId={updatingFeriasId}
                      statusResumoPorFuncionario={statusResumoPorFuncionario}
                      onChangeEquipe={alterarEquipeRapida}
                      onChangeStatus={alterarStatusRapido}
                      onRegistrarFeriasInline={registrarFeriasInline}
                      onEncerrarFeriasAgora={encerrarFeriasAgora}
                      onExcluirLancamentoIndevido={excluirLancamentoIndevido}
                      onProgramarFerias={irProgramacaoFerias}
                    />
                  ))}
              </>
            )}

            {/* ABA ANIVERSARIANTES */}
            {aba === "aniversariantes" && (
              <>
                <div style={{ background: "linear-gradient(135deg,#0A0F2C,#AA0055)", borderRadius: 16, padding: "16px 20px", color: "white", marginBottom: 16 }}>
                  <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16 }}>🎂 Aniversariantes do Mês</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                    {new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })} · {aniversariantes.length} aniversariante{aniversariantes.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
                  {aniversariantes.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0", fontSize: 13 }}>Nenhum aniversariante este mês.</p>
                  ) : aniversariantes.map((f, i) => {
                    const dia = ((f as any).data_nascimento || "").split("-")[2] || "";
                    return (
                      <div
                        key={f.id}
                        onClick={() => irFuncionario(f.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbfc", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#f0f7ff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "white" : "#fafbfc"; }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#AA0055,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Montserrat", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                          {dia}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{f.name}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{f.role}{f.equipe ? ` · ${f.equipe}` : ""}</p>
                        </div>
                        <ChevronRight size={16} color="#d1d5db" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
