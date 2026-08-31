import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Calendar, Plus, ChevronRight, AlertTriangle,
  CheckCircle, Clock, Users, Search, X, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useSmartBack } from "@/hooks/useSmartBack";
import { DEFAULT_COMPANY_ID } from "@/config/company";

const COMPANY_ID = DEFAULT_COMPANY_ID;

interface Employee {
  id: string;
  name: string;
  matricula: string | null;
  role: string;
  data_admissao: string;
  centro_custo?: string;
  status?: string | null;
}

interface VacationPeriod {
  id: string;
  employee_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  dias_direito: number;
  dias_gozados: number;
  dias_coletiva: number;
  status: string;
}

type VacationWorkflowStatus = "programada" | "aguardando_confirmacao" | "confirmada" | "nao_confirmada";

interface VacationRecord {
  id: string;
  employee_id: string;
  vacation_period_id: string | null;
  tipo: "individual" | "coletiva";
  data_inicio: string;
  data_fim: string;
  dias: number;
  observacao?: string;
  workflow_status?: VacationWorkflowStatus;
  reminder_sent_at?: string | null;
  confirmado_em?: string | null;
  confirmado_por_user_id?: string | null;
  confirmacao_observacao?: string | null;
}

interface EmployeeWithVacation extends Employee {
  periodos: VacationPeriod[];
  records: VacationRecord[];
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function addYears(dateStr: string, years: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
}

function isDateInRange(ref: string, inicio: string, fim: string) {
  return ref >= inicio && ref <= fim;
}

function employeeOnVacationNow(records: VacationRecord[], refDate: string) {
  return records.some((r) => isDateInRange(refDate, r.data_inicio, r.data_fim));
}

function statusColor(status: string) {
  if (status === "gozado") return "#22c55e";
  if (status === "parcial") return "#f97316";
  if (status === "vencido") return "#ef4444";
  return "#3b82f6";
}

function statusLabel(status: string) {
  if (status === "gozado") return "Gozado";
  if (status === "parcial") return "Parcial";
  if (status === "vencido") return "Vencido";
  return "Aberto";
}

function workflowColor(status?: VacationWorkflowStatus) {
  if (status === "confirmada") return "#16a34a";
  if (status === "nao_confirmada") return "#b45309";
  if (status === "aguardando_confirmacao") return "#d97706";
  return "#2563eb";
}

function workflowLabel(status?: VacationWorkflowStatus) {
  if (status === "confirmada") return "Confirmada";
  if (status === "nao_confirmada") return "Não confirmada";
  if (status === "aguardando_confirmacao") return "Aguardando confirmação";
  return "Programada";
}

// ─── Calcula períodos aquisitivos dos últimos 24 meses ───────────────────────
function calcPeriodosEsperados(admissao: string): { inicio: string; fim: string }[] {
  const hoje = new Date();
  const periodos: { inicio: string; fim: string }[] = [];
  const adm = new Date(admissao);

  // Primeiro período começa na data de admissão
  let inicio = new Date(adm);
  for (let i = 0; i < 5; i++) {
    const fim = new Date(inicio);
    fim.setFullYear(fim.getFullYear() + 1);
    fim.setDate(fim.getDate() - 1);

    // Só inclui períodos que terminaram há menos de 24 meses
    const mesesAtras = (hoje.getFullYear() - fim.getFullYear()) * 12 + hoje.getMonth() - fim.getMonth();
    if (mesesAtras <= 24 && inicio <= hoje) {
      periodos.push({
        inicio: inicio.toISOString().split("T")[0],
        fim: fim.toISOString().split("T")[0],
      });
    }
    inicio = new Date(fim);
    inicio.setDate(inicio.getDate() + 1);
    if (inicio > hoje) break;
  }
  return periodos;
}

// ─── Modal de Registro de Férias ─────────────────────────────────────────────
function ModalFerias({
  emp,
  periodos,
  onClose,
  onSaved,
}: {
  emp: Employee;
  periodos: VacationPeriod[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<"individual" | "coletiva">("individual");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [obs, setObs] = useState("");
  const [periodId, setPeriodId] = useState(periodos[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const dias = dataInicio && dataFim ? diffDays(dataInicio, dataFim) + 1 : 0;

  async function salvar() {
    if (!dataInicio || !dataFim || dias <= 0) { setErro("Datas inválidas."); return; }
    setSaving(true); setErro("");
    try {
      const hoje = new Date().toISOString().split("T")[0];
      const reminderBase = new Date(`${dataInicio}T12:00:00`);
      reminderBase.setDate(reminderBase.getDate() - 3);
      const reminderDate = reminderBase.toISOString().split("T")[0];

      const record = {
        employee_id: emp.id,
        company_id: COMPANY_ID,
        vacation_period_id: periodId || null,
        tipo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        dias,
        observacao: obs || null,
        registrado_por: "admin",
        workflow_status: reminderDate <= hoje ? "aguardando_confirmacao" : "programada",
      };
      const { error: errRec } = await supabase.from("vacation_records").insert(record);
      if (errRec) throw errRec;

      // Atualizar período
      if (periodId) {
        const period = periodos.find(p => p.id === periodId);
        if (period) {
          const novoGozados = period.dias_gozados + (tipo === "individual" ? dias : 0);
          const novoColetiva = period.dias_coletiva + (tipo === "coletiva" ? dias : 0);
          const saldo = period.dias_direito - novoGozados - novoColetiva;
          const novoStatus = saldo <= 0 ? "gozado" : novoGozados > 0 || novoColetiva > 0 ? "parcial" : "aberto";
          await supabase.from("vacation_periods").update({
            dias_gozados: novoGozados,
            dias_coletiva: novoColetiva,
            status: novoStatus,
            updated_at: new Date().toISOString(),
          }).eq("id", periodId);
        }
      }

      // Sincronização mínima fase 2: histórico + status quando férias estão vigentes hoje
      const emFeriasAgora = isDateInRange(hoje, dataInicio, dataFim);

      await (supabase as any).from("employee_historico").insert({
        employee_id: emp.id,
        company_id: COMPANY_ID,
        tipo: "ferias",
        descricao: `Férias ${tipo} programadas: ${fmtDate(dataInicio)} → ${fmtDate(dataFim)} (${dias}d)`,
        data: dataInicio,
      });

      if (emFeriasAgora) {
        await supabase
          .from("employees")
          .update({ status: "ferias" })
          .eq("id", emp.id)
          .eq("company_id", COMPANY_ID);
      }
      onSaved();
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540, padding: "24px 20px 32px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16, color: "#0A0F2C" }}>Programar Férias</p>
          <button onClick={onClose}><X size={20} color="#9ca3af" /></button>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 16 }}>{emp.name} · Mat. {emp.matricula ?? "—"}</p>

        {/* Tipo */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["individual", "coletiva"] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${tipo === t ? "#0055AA" : "#e5e7eb"}`,
              background: tipo === t ? "#e8f0ff" : "white", fontWeight: 700, fontSize: 13,
              color: tipo === t ? "#0055AA" : "#6b7280", cursor: "pointer", textTransform: "capitalize"
            }}>
              {t === "individual" ? "🏖️ Individual" : "🏢 Coletiva"}
            </button>
          ))}
        </div>

        {tipo === "coletiva" && (
          <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
            Férias coletivas serão descontadas quando o funcionário tirar férias individuais.
          </div>
        )}

        {/* Período aquisitivo */}
        {periodos.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>PERÍODO AQUISITIVO</label>
            <select value={periodId} onChange={e => setPeriodId(e.target.value)}
              style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, padding: "0 12px" }}>
              <option value="">— Nenhum (registro avulso) —</option>
              {periodos.map(p => (
                <option key={p.id} value={p.id}>
                  {fmtDate(p.periodo_inicio)} → {fmtDate(p.periodo_fim)} · Saldo: {p.dias_direito - p.dias_gozados - p.dias_coletiva}d
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Datas */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>INÍCIO</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, padding: "0 12px", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>FIM</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, padding: "0 12px", boxSizing: "border-box" }} />
          </div>
        </div>

        {dias > 0 && (
          <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, fontWeight: 700, color: "#0055AA" }}>
            {dias} dia{dias !== 1 ? "s" : ""} de férias {tipo === "coletiva" ? "coletivas" : "individuais"}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>OBSERVAÇÃO (opcional)</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
            style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, padding: "10px 12px", resize: "none", boxSizing: "border-box" }} />
        </div>

        {erro && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{erro}</p>}

        <button onClick={salvar} disabled={saving || dias <= 0} style={{
          width: "100%", height: 46, borderRadius: 12, background: saving || dias <= 0 ? "#e5e7eb" : "#0055AA",
          color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: saving ? "wait" : "pointer"
        }}>
          {saving ? "Salvando..." : "Programar Férias"}
        </button>
      </div>
    </div>
  );
}

// ─── Card de funcionário ──────────────────────────────────────────────────────
function CardFuncionario({
  emp,
  onRegistrar,
  onToggle,
  onAbrirFicha,
  onConfirmarProgramacao,
  onMarcarNaoConfirmada,
  expanded,
  canManageWorkflow,
}: {
  emp: EmployeeWithVacation;
  onRegistrar: () => void;
  onToggle: () => void;
  onAbrirFicha: () => void;
  onConfirmarProgramacao: (recordId: string) => void;
  onMarcarNaoConfirmada: (recordId: string) => void;
  expanded: boolean;
  canManageWorkflow: boolean;
}) {
  const periodoAtual = emp.periodos.find(p => p.status !== "gozado") || emp.periodos[0];
  const saldo = periodoAtual ? periodoAtual.dias_direito - periodoAtual.dias_gozados - periodoAtual.dias_coletiva : null;
  const temColetiva = periodoAtual && periodoAtual.dias_coletiva > 0;
  const alerta = saldo !== null && saldo < 0;

  const proxPeriodo = periodoAtual ? addYears(periodoAtual.periodo_fim, 1) : null;
  const hoje = new Date().toISOString().split("T")[0];
  const podeGozan = periodoAtual ? periodoAtual.periodo_fim <= hoje : false;
  const registroPendenteConfirmacao = emp.records.find((r) => {
    const status = r.workflow_status || "programada";
    return (status === "programada" || status === "aguardando_confirmacao") && r.data_inicio >= hoje;
  });

  return (
    <div style={{ background: "white", borderRadius: 14, marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
      {/* Linha principal */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#0055AA,#00C6FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
          {emp.name.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</p>
          <p style={{ fontSize: 11, color: "#9ca3af" }}>Mat. {emp.matricula ?? "—"} · {emp.role}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {saldo !== null ? (
            <p style={{ fontSize: 18, fontWeight: 900, color: alerta ? "#ef4444" : saldo === 0 ? "#22c55e" : "#0055AA", fontFamily: "Montserrat" }}>
              {saldo}d
            </p>
          ) : (
            <p style={{ fontSize: 11, color: "#9ca3af" }}>sem período</p>
          )}
          <p style={{ fontSize: 10, color: "#9ca3af" }}>saldo</p>
        </div>
        {expanded ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 14px 14px" }}>
          {periodoAtual && (
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>PERÍODO AQUISITIVO ATUAL</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 80 }}>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>Início</p>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(periodoAtual.periodo_inicio)}</p>
                </div>
                <div style={{ flex: 1, minWidth: 80 }}>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>Fim</p>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(periodoAtual.periodo_fim)}</p>
                </div>
                <div style={{ flex: 1, minWidth: 60 }}>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>Direito</p>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{periodoAtual.dias_direito}d</p>
                </div>
                <div style={{ flex: 1, minWidth: 60 }}>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>Gozados</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>{periodoAtual.dias_gozados}d</p>
                </div>
                {temColetiva && (
                  <div style={{ flex: 1, minWidth: 60 }}>
                    <p style={{ fontSize: 10, color: "#9ca3af" }}>Coletiva</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#f97316" }}>{periodoAtual.dias_coletiva}d</p>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 60 }}>
                  <p style={{ fontSize: 10, color: "#9ca3af" }}>Saldo</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: alerta ? "#ef4444" : "#0055AA" }}>{saldo}d</p>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: statusColor(periodoAtual.status) + "20", color: statusColor(periodoAtual.status), fontWeight: 700 }}>
                  {statusLabel(periodoAtual.status)}
                </span>
                {podeGozan && periodoAtual.status !== "gozado" && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
                    ⚠️ Pode sair de férias
                  </span>
                )}
              </div>
            </div>
          )}

          {registroPendenteConfirmacao && (
            <div style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 12,
            }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#9a3412", marginBottom: 4 }}>
                ⚠️ Confirmação de programação pendente
              </p>
              <p style={{ fontSize: 12, color: "#7c2d12", marginBottom: 8 }}>
                Período {fmtDate(registroPendenteConfirmacao.data_inicio)} → {fmtDate(registroPendenteConfirmacao.data_fim)}
              </p>
              {canManageWorkflow && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => onConfirmarProgramacao(registroPendenteConfirmacao.id)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: "none",
                      background: "#16a34a",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Confirmar período
                  </button>
                  <button
                    onClick={() => onMarcarNaoConfirmada(registroPendenteConfirmacao.id)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: "1px solid #fdba74",
                      background: "white",
                      color: "#9a3412",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Não ocorrerá
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Histórico de registros */}
          {emp.records.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>HISTÓRICO</p>
              {emp.records.slice(0, 5).map(r => (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: r.tipo === "coletiva" ? "#fef3c7" : "#e8f0ff", color: r.tipo === "coletiva" ? "#92400e" : "#0055AA", fontWeight: 700, flexShrink: 0 }}>
                      {r.tipo === "coletiva" ? "Coletiva" : "Individual"}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: workflowColor(r.workflow_status) + "20", color: workflowColor(r.workflow_status), fontWeight: 700, flexShrink: 0 }}>
                      {workflowLabel(r.workflow_status)}
                    </span>
                    <p style={{ flex: 1, fontSize: 12, color: "#374151" }}>{fmtDate(r.data_inicio)} → {fmtDate(r.data_fim)}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{r.dias}d</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Admissão */}
          <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>
            Admissão: {fmtDate(emp.data_admissao)}
            {proxPeriodo && ` · Próximo período: ${fmtDate(proxPeriodo)}`}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={onAbrirFicha} style={{
              height: 40, borderRadius: 10, background: "#eef2ff",
              color: "#3730a3", fontWeight: 700, fontSize: 13, border: "1px solid #c7d2fe", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              <Users size={15} /> Abrir Ficha
            </button>

            <button onClick={onRegistrar} style={{
              height: 40, borderRadius: 10, background: "#0055AA",
              color: "white", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              <Plus size={15} /> Programar Férias
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ProgramacaoFerias() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const goBack = useSmartBack(origem === "gestao-frotas" ? "/gestao-frotas" : "/gestao-pessoas");
  const buscaInicial = searchParams.get("q") || "";
  const focoFuncionarioId = searchParams.get("funcionario_id") || "";
  const filtroParam = searchParams.get("filtro");
  const filtroInicial: "todos" | "pendente" | "vencido" | "coletiva" | "em_ferias" | "a_confirmar" =
    filtroParam === "pendente" || filtroParam === "vencido" || filtroParam === "coletiva" || filtroParam === "em_ferias" || filtroParam === "a_confirmar"
      ? filtroParam
      : "todos";

  const { isAdmin } = useIsAdmin();
  const [employees, setEmployees] = useState<EmployeeWithVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState(buscaInicial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalEmp, setModalEmp] = useState<Employee | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "vencido" | "coletiva" | "em_ferias" | "a_confirmar">(filtroInicial);
  const [focoAplicado, setFocoAplicado] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const hoje = new Date().toISOString().split("T")[0];

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || "";
    setCurrentUserId(userId);

    const { data: emps } = await supabase
      .from("employees")
      .select("id,name,matricula,role,data_admissao,centro_custo,status")
      .eq("company_id", COMPANY_ID)
      .in("status", ["ativo", "ferias"])
      .order("name");

    const { data: periods } = await (supabase as any)
      .from("vacation_periods")
      .select("*")
      .eq("company_id", COMPANY_ID)
      .order("periodo_inicio", { ascending: false });

    const { data: records } = await (supabase as any)
      .from("vacation_records")
      .select("*")
      .eq("company_id", COMPANY_ID)
      .order("data_inicio", { ascending: false });

    if (isAdmin && userId) {
      try {
        const limite = new Date(`${hoje}T12:00:00`);
        limite.setDate(limite.getDate() + 3);
        const limiteStr = limite.toISOString().split("T")[0];

        const pendentesLembrete = ((records || []) as VacationRecord[]).filter((r) => {
          const status = r.workflow_status || "programada";
          return (status === "programada" || status === "aguardando_confirmacao")
            && r.data_inicio >= hoje
            && r.data_inicio <= limiteStr
            && !r.reminder_sent_at;
        });

        if (pendentesLembrete.length > 0) {
          const { data: perfisDestinatarios } = await (supabase as any)
            .from("profiles")
            .select("user_id,email,perfil,role")
            .eq("company_id", COMPANY_ID)
            .or("perfil.eq.RH,perfil.eq.Gestão de Pessoas,perfil.eq.Administrador,perfil.eq.Gerente,role.eq.admin,email.eq.anderson@fremix.workflux.app,email.eq.andersonmarquesoficial1980@gmail.com");

          const destinatarios = Array.from(new Set(
            ((perfisDestinatarios || []) as any[])
              .map((p) => p.user_id)
              .filter((id) => Boolean(id))
          ));

          for (const registro of pendentesLembrete) {
            const funcionario = (emps || []).find((e) => e.id === registro.employee_id);
            const mensagem = `${funcionario?.name || "Funcionário"} — início em ${fmtDate(registro.data_inicio)}. Confirmar período programado.`;

            for (const destino of destinatarios) {
              supabase.functions.invoke("send-push", {
                body: {
                  user_id: destino,
                  title: "📅 Confirmação de férias programadas",
                  body: mensagem,
                  url: `/programacao-ferias?filtro=a_confirmar&funcionario_id=${registro.employee_id}`,
                },
              }).catch(() => {});
            }

            await (supabase as any)
              .from("vacation_records")
              .update({
                workflow_status: "aguardando_confirmacao",
                reminder_sent_at: new Date().toISOString(),
              })
              .eq("id", registro.id)
              .eq("company_id", COMPANY_ID);
          }
        }
      } catch {
        // notificação é best effort
      }
    }

    const recordsTyped = (records || []) as VacationRecord[];

    const idsEmFeriasPorPeriodo = new Set(
      recordsTyped
        .filter((r) => isDateInRange(hoje, r.data_inicio, r.data_fim))
        .map((r) => r.employee_id)
    );

    const idsAtivoParaFerias = (emps || [])
      .filter((e) => (e.status || "").toLowerCase() === "ativo" && idsEmFeriasPorPeriodo.has(e.id))
      .map((e) => e.id);

    const idsFeriasParaAtivo = (emps || [])
      .filter((e) => (e.status || "").toLowerCase() === "ferias" && !idsEmFeriasPorPeriodo.has(e.id))
      .map((e) => e.id);

    if (idsAtivoParaFerias.length > 0) {
      await supabase
        .from("employees")
        .update({ status: "ferias" })
        .eq("company_id", COMPANY_ID)
        .in("id", idsAtivoParaFerias);
    }

    if (idsFeriasParaAtivo.length > 0) {
      await supabase
        .from("employees")
        .update({ status: "ativo" })
        .eq("company_id", COMPANY_ID)
        .in("id", idsFeriasParaAtivo);
    }

    const result: EmployeeWithVacation[] = (emps || []).map((e) => {
      const statusSincronizado = idsEmFeriasPorPeriodo.has(e.id) ? "ferias" : ((e.status || "ativo").toLowerCase() === "ferias" ? "ativo" : e.status || "ativo");
      return {
        ...e,
        status: statusSincronizado,
        periodos: ((periods || []) as VacationPeriod[]).filter((p) => p.employee_id === e.id),
        records: recordsTyped.filter((r) => r.employee_id === e.id),
      };
    });

    setEmployees(result);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading || focoAplicado || !focoFuncionarioId) return;
    const alvo = employees.find(e => e.id === focoFuncionarioId);
    if (!alvo) {
      setFocoAplicado(true);
      return;
    }

    setExpandedId(alvo.id);
    if (!buscaInicial) {
      setBusca(alvo.matricula?.trim() || alvo.name);
    }
    setFocoAplicado(true);
  }, [loading, focoAplicado, focoFuncionarioId, employees, buscaInicial]);

  const abrirFichaFuncionario = (emp: EmployeeWithVacation) => {
    const retParams = new URLSearchParams();
    if (origem) retParams.set("origem", origem);
    if (busca.trim()) retParams.set("q", busca.trim());
    if (filtro !== "todos") retParams.set("filtro", filtro);
    retParams.set("funcionario_id", emp.id);

    const returnTo = `${location.pathname}?${retParams.toString()}`;
    navigate(`/gestao-pessoas/${emp.id}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const atualizarWorkflowFerias = async (recordId: string, novoStatus: VacationWorkflowStatus) => {
    if (!currentUserId) return;

    await (supabase as any)
      .from("vacation_records")
      .update({
        workflow_status: novoStatus,
        confirmado_em: new Date().toISOString(),
        confirmado_por_user_id: currentUserId,
      })
      .eq("id", recordId)
      .eq("company_id", COMPANY_ID);

    load();
  };

  // Filtros
  const hoje = new Date().toISOString().split("T")[0];
  const filtrados = employees.filter(e => {
    const nome = (e.name ?? "").toLowerCase();
    const matricula = String(e.matricula ?? "");
    const termo = busca.toLowerCase();

    const matchBusca = !busca ||
      nome.includes(termo) ||
      matricula.includes(busca);

    if (!matchBusca) return false;

    const p = e.periodos.find(p => p.status !== "gozado");
    if (filtro === "pendente") return p && p.periodo_fim <= hoje && p.status !== "gozado";
    if (filtro === "vencido") return p && p.status === "vencido";
    if (filtro === "coletiva") return e.records.some(r => r.tipo === "coletiva");
    if (filtro === "em_ferias") return employeeOnVacationNow(e.records, hoje);
    if (filtro === "a_confirmar") return e.records.some((r) => {
      const status = r.workflow_status || "programada";
      return (status === "programada" || status === "aguardando_confirmacao") && r.data_inicio >= hoje;
    });
    return true;
  });

  const totalPendente = employees.filter(e => {
    const p = e.periodos.find(p => p.status !== "gozado");
    return p && p.periodo_fim <= hoje && p.status !== "gozado";
  }).length;

  const totalColetiva = employees.filter(e => e.records.some(r => r.tipo === "coletiva")).length;
  const totalEmFerias = employees.filter(e => employeeOnVacationNow(e.records, hoje)).length;
  const totalAConfirmar = employees.filter((e) => e.records.some((r) => {
    const status = r.workflow_status || "programada";
    return (status === "programada" || status === "aguardando_confirmacao") && r.data_inicio >= hoje;
  })).length;
  const totalStatusFerias = employees.filter(e => (e.status || "").toLowerCase() === "ferias").length;
  const divergenciaStatusVsPeriodo = Math.abs(totalStatusFerias - totalEmFerias);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button
          onClick={goBack}
          className="p-1.5 rounded-lg hover:bg-white/10 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Programação de Férias</span>
          <span className="block text-[10px] text-primary-foreground/70">{employees.length} funcionários</span>
        </div>
      </header>

      {/* Painel resumo */}
      <div style={{ background: "linear-gradient(135deg, #0A0F2C, #0D1B4B)", padding: "16px" }}>
        <div style={{ display: "flex", gap: 10, maxWidth: 760, margin: "0 auto" }}>
          {[
            { label: "Total", value: employees.length, cor: "#00C6FF" },
            { label: "Pendentes", value: totalPendente, cor: "#f97316" },
            { label: "Em férias agora", value: totalEmFerias, cor: "#22c55e" },
            { label: "C. Coletiva", value: totalColetiva, cor: "#a855f7" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: s.cor, fontFamily: "Montserrat" }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex overflow-x-auto border-b border-border bg-background sticky top-[60px] z-20">
        {([
          { id: "todos", label: "Todos" },
          { id: "pendente", label: `⚠️ Pendentes (${totalPendente})` },
          { id: "a_confirmar", label: `🔔 A confirmar (${totalAConfirmar})` },
          { id: "coletiva", label: `🏢 C. Coletiva (${totalColetiva})` },
          { id: "em_ferias", label: `🏖️ Em férias (${totalEmFerias})` },
        ] as const).map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 shrink-0 transition-colors ${filtro === f.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        {totalAConfirmar > 0 && (
          <div style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #fdba74",
            background: "#fff7ed",
            color: "#9a3412",
            fontSize: 12,
            fontWeight: 700,
          }}>
            🔔 {totalAConfirmar} programação(ões) de férias precisam de confirmação prévia do RH/Programador.
          </div>
        )}

        {divergenciaStatusVsPeriodo > 0 && (
          <div style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 12,
            fontWeight: 600,
          }}>
            ⚠️ Há {divergenciaStatusVsPeriodo} divergência(s) entre status e período vigente. O filtro “Em férias” usa período vigente.
          </div>
        )}

        {/* Busca */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9ca3af" }} />
          <input
            placeholder="Buscar por nome ou matrícula..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, height: 40, borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", background: "white", boxSizing: "border-box" }}
          />
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "64px 0" }}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>Nenhum resultado.</p>
        ) : (
          filtrados.map(emp => (
            <CardFuncionario
              key={emp.id}
              emp={emp}
              expanded={expandedId === emp.id}
              onToggle={() => setExpandedId(expandedId === emp.id ? null : emp.id)}
              onRegistrar={() => { setModalEmp(emp); setExpandedId(null); }}
              onAbrirFicha={() => abrirFichaFuncionario(emp)}
              onConfirmarProgramacao={(recordId) => atualizarWorkflowFerias(recordId, "confirmada")}
              onMarcarNaoConfirmada={(recordId) => atualizarWorkflowFerias(recordId, "nao_confirmada")}
              canManageWorkflow={isAdmin}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {modalEmp && (
        <ModalFerias
          emp={modalEmp}
          periodos={employees.find(e => e.id === modalEmp.id)?.periodos || []}
          onClose={() => setModalEmp(null)}
          onSaved={() => { setModalEmp(null); load(); }}
        />
      )}
    </div>
  );
}
