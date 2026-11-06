import { supabase } from "@/integrations/supabase/client";

/**
 * Disponibilidade operacional / MTBF / MTTR — acesso às tabelas `equip_*`.
 * Os tipos gerados do Supabase ainda não incluem essas tabelas; o `any` fica isolado neste arquivo.
 */
const db = supabase as any;

export type OrigemFalha = "mecanico" | "encarregado" | "operador" | "sugestao_diario";
export type StatusFalha = "confirmada" | "pendente_confirmacao" | "cancelada";
export type Turno = "diurno" | "noturno";

export interface EquipReparo { id: string; falha_id: string; reparo_inicio: string; reparo_fim: string; descricao: string | null }
export interface EquipFalha {
  id: string; company_id: string; equipamento_id: string; ogs_number: string;
  parada_inicio: string; parada_fim: string | null; causa: string; descricao: string | null;
  origem: OrigemFalha; status: StatusFalha; motivo_cancelamento: string | null; created_by: string | null;
  equip_falha_reparos?: EquipReparo[];
  equipamentos?: { frota: string; tipo: string | null } | null;
}
export interface EquipHorario {
  id: string; company_id: string; ogs_number: string; turno: Turno; equipamento_id: string | null;
  data: string | null; hora_inicio: string | null; hora_fim: string | null; sem_operacao: boolean; motivo: string | null;
  equipamentos?: { frota: string } | null;
}

export const CAUSAS_FALHA = [
  "Hidráulica", "Elétrica", "Motor", "Transmissão", "Pneu / Esteira", "Freio", "Bits / Dentes (desgaste)",
  "Vazamento", "Superaquecimento", "Falta de peça", "Outro",
] as const;

export const ORIGEM_LABEL: Record<OrigemFalha, string> = {
  mecanico: "Mecânico", encarregado: "Encarregado", operador: "Operador", sugestao_diario: "Sugestão do diário",
};

/** Sugere quem está registrando a partir do perfil; o usuário pode trocar. */
export function origemPorPerfil(perfil?: string | null): Exclude<OrigemFalha, "sugestao_diario"> {
  const p = (perfil || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (p.includes("mecan")) return "mecanico";
  if (p.includes("encarreg")) return "encarregado";
  return "operador";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
export function paraInputLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO (UTC). Vazio/ inválido → null. */
export function deInputLocal(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function duracaoHoras(ini: string | null, fim: string | null): number | null {
  if (!ini || !fim) return null;
  const ms = new Date(fim).getTime() - new Date(ini).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms / 3_600_000 : null;
}

/** Horas de reparo efetivo: une trechos sobrepostos (mesma regra do banco). */
export function horasReparo(reparos: { reparo_inicio: string; reparo_fim: string }[] | undefined | null): number {
  const iv = (reparos || [])
    .map(r => [new Date(r.reparo_inicio).getTime(), new Date(r.reparo_fim).getTime()] as const)
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of iv) {
    if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b);
    else { if (cur) total += cur[1] - cur[0]; cur = [a, b]; }
  }
  if (cur) total += cur[1] - cur[0];
  return total / 3_600_000;
}

export function situacaoFalha(f: Pick<EquipFalha, "status" | "parada_fim">): "cancelada" | "pendente" | "aberta" | "reparada" {
  if (f.status === "cancelada") return "cancelada";
  if (f.status === "pendente_confirmacao") return "pendente";
  return f.parada_fim ? "reparada" : "aberta";
}

export function fmtHoras(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "Sem dados";
  return `${h.toFixed(2).replace(".", ",")} h`;
}

export interface FalhaForm { equipamentoId: string; ogs: string; inicio: string; fim: string; causa: string }

/** Retorna a mensagem de erro (PT) ou null se válido. `inicio`/`fim` em formato datetime-local. */
export function validarFalha(f: FalhaForm, agora: Date = new Date()): string | null {
  if (!f.equipamentoId) return "Selecione o equipamento.";
  if (!f.ogs) return "Selecione a obra (OGS).";
  if (!f.causa.trim()) return "Informe a causa da falha.";
  const ini = deInputLocal(f.inicio);
  if (!ini) return "Informe quando o equipamento parou.";
  const limite = agora.getTime() + 5 * 60_000;
  if (new Date(ini).getTime() > limite) return "O início da parada não pode estar no futuro.";
  if (f.fim) {
    const fim = deInputLocal(f.fim);
    if (!fim) return "Data/hora de retorno inválida.";
    if (new Date(fim).getTime() <= new Date(ini).getTime()) return "O retorno à operação deve ser depois do início da parada.";
    if (new Date(fim).getTime() > limite) return "O retorno à operação não pode estar no futuro.";
  }
  return null;
}

/** Reparo precisa estar dentro da parada (o banco também valida). */
export function validarReparo(
  falha: { parada_inicio: string; parada_fim: string | null }, ini: string, fim: string,
): string | null {
  const i = deInputLocal(ini), f = deInputLocal(fim);
  if (!i || !f) return "Informe início e fim do reparo.";
  if (new Date(f).getTime() <= new Date(i).getTime()) return "O fim do reparo deve ser depois do início.";
  if (new Date(i).getTime() < new Date(falha.parada_inicio).getTime()) return "O reparo não pode começar antes da parada.";
  if (falha.parada_fim && new Date(f).getTime() > new Date(falha.parada_fim).getTime()) {
    return "O reparo não pode terminar depois do retorno à operação.";
  }
  return null;
}

// ---------------------------------------------------------------- sugestão de janela (diários)
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const fmtMin = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
};
const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export interface AmostraJanela { start: string; end: string }
export interface JanelaSugerida { inicio: string; fim: string; amostras: number }

/**
 * Janela típica = mediana dos inícios/fins do trabalho nos diários, arredondada a 15 min.
 * Turno noturno trata horários após a meia-noite como "dia seguinte" antes da mediana.
 * Menos de 3 amostras → null (não sugerir com pouco dado).
 */
export function sugerirJanela(amostras: AmostraJanela[], turno: Turno, minimo = 3): JanelaSugerida | null {
  const validas = amostras.filter(a => a.start && a.end && a.start !== a.end);
  if (validas.length < minimo) return null;
  const inicios: number[] = [];
  const fins: number[] = [];
  for (const a of validas) {
    let s = toMin(a.start);
    let e = toMin(a.end);
    if (turno === "noturno" && s < 720) s += 1440;
    if (e <= s) e += 1440;
    inicios.push(s);
    fins.push(e);
  }
  const arred = (m: number) => Math.round(m / 15) * 15;
  return { inicio: fmtMin(arred(mediana(inicios))), fim: fmtMin(arred(mediana(fins))), amostras: validas.length };
}

// ---------------------------------------------------------------- acesso a dados
async function lerTudo<T>(fabrica: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fabrica(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

export async function listarFalhas(companyId: string, de: string, ate: string, ogs?: string): Promise<EquipFalha[]> {
  let q = db.from("equip_falhas")
    .select("*, equipamentos(frota,tipo), equip_falha_reparos(*)")
    .eq("company_id", companyId)
    .gte("parada_inicio", `${de}T00:00:00`)
    .lte("parada_inicio", `${ate}T23:59:59`)
    .order("parada_inicio", { ascending: false })
    .limit(500);
  if (ogs) q = q.eq("ogs_number", ogs);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as EquipFalha[];
}

export async function criarFalha(p: {
  companyId: string; equipamentoId: string; ogs: string; inicioIso: string; fimIso: string | null;
  causa: string; descricao: string; origem: OrigemFalha; userId: string;
  diaryId?: string | null; osId?: string | null; ocorrenciaId?: string | null;
}): Promise<string> {
  const { data, error } = await db.from("equip_falhas").insert({
    company_id: p.companyId, equipamento_id: p.equipamentoId, ogs_number: p.ogs,
    parada_inicio: p.inicioIso, parada_fim: p.fimIso, causa: p.causa.trim(),
    descricao: p.descricao.trim() || null, origem: p.origem, created_by: p.userId,
    diary_id: p.diaryId || null, os_id: p.osId || null, ocorrencia_id: p.ocorrenciaId || null,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function atualizarFalha(id: string, patch: Partial<Pick<EquipFalha, "parada_inicio" | "parada_fim" | "causa" | "descricao" | "status" | "motivo_cancelamento">>) {
  const { data, error } = await db.from("equip_falhas").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Sem permissão para alterar esta falha (apenas o autor ou a gestão).");
}

export async function adicionarReparo(p: { companyId: string; falhaId: string; inicioIso: string; fimIso: string; descricao: string; userId: string }) {
  const { error } = await db.from("equip_falha_reparos").insert({
    company_id: p.companyId, falha_id: p.falhaId, reparo_inicio: p.inicioIso, reparo_fim: p.fimIso,
    descricao: p.descricao.trim() || null, created_by: p.userId,
  });
  if (error) throw error;
}

export async function removerReparo(id: string) {
  const { data, error } = await db.from("equip_falha_reparos").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Sem permissão para remover este reparo.");
}

export async function listarHorarios(companyId: string): Promise<EquipHorario[]> {
  return lerTudo<EquipHorario>((de, ate) => db.from("equip_horario_programado")
    .select("*, equipamentos(frota)").eq("company_id", companyId)
    .order("ogs_number").order("turno").order("id").range(de, ate));
}

export async function salvarHorario(p: {
  companyId: string; ogs: string; turno: Turno; equipamentoId: string | null; data: string | null;
  inicio: string | null; fim: string | null; semOperacao: boolean; motivo: string; userId: string;
}) {
  const { error } = await db.from("equip_horario_programado").insert({
    company_id: p.companyId, ogs_number: p.ogs, turno: p.turno, equipamento_id: p.equipamentoId, data: p.data,
    hora_inicio: p.semOperacao ? null : p.inicio, hora_fim: p.semOperacao ? null : p.fim,
    sem_operacao: p.semOperacao, motivo: p.motivo.trim() || null, created_by: p.userId,
  });
  if (error) throw error;
}

export async function removerHorario(id: string) {
  const { data, error } = await db.from("equip_horario_programado").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Sem permissão para remover este horário.");
}

export async function podeGerir(companyId: string): Promise<boolean> {
  const { data, error } = await db.rpc("equip_pode_gerir", { p_company_id: companyId });
  return !error && data === true;
}

export interface GrupoJanela { ogs: string; turno: Turno; dias: number; amostras: AmostraJanela[] }

/**
 * Lê diários manuais enviados (Trabalhando/Manutenção, com OGS) dos últimos `dias` dias e agrega,
 * por OGS+turno, início do primeiro e fim do último "Trabalhando" de cada diário.
 */
export async function buscarJanelasDosDiarios(companyId: string, dias = 45): Promise<GrupoJanela[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const diarios = await lerTudo<{ id: string; ogs_number: string; period: string | null; date: string }>((de, ate) =>
    db.from("equipment_diaries").select("id, ogs_number, period, date")
      .eq("company_id", companyId).eq("status", "enviado").eq("is_auto", false)
      .in("work_status", ["Trabalhando", "Manutenção"]).not("ogs_number", "is", null)
      .gte("date", desde).order("id").range(de, ate));
  const porId = new Map(diarios.filter(d => (d.ogs_number || "").trim()).map(d => [d.id, d]));
  const ids = [...porId.keys()];
  const grupos = new Map<string, GrupoJanela & { diasSet: Set<string> }>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from("equipment_time_entries")
      .select("diary_id, start_time, end_time").eq("activity", "Trabalhando")
      .not("start_time", "is", null).not("end_time", "is", null).in("diary_id", ids.slice(i, i + 150));
    if (error) throw error;
    const porDiario = new Map<string, { s: string[]; e: string[] }>();
    for (const t of data || []) {
      const acc = porDiario.get(t.diary_id) || { s: [], e: [] };
      acc.s.push(t.start_time); acc.e.push(t.end_time);
      porDiario.set(t.diary_id, acc);
    }
    for (const [id, acc] of porDiario) {
      const d = porId.get(id)!;
      const turno: Turno = d.period === "noturno" ? "noturno" : "diurno";
      const ogs = d.ogs_number.trim();
      const chave = `${ogs}|${turno}`;
      const g = grupos.get(chave) || { ogs, turno, dias: 0, amostras: [], diasSet: new Set<string>() };
      // início = primeiro "Trabalhando" do diário; fim = último (considerando virada de noite)
      const ini = acc.s.map(toMin);
      const base = turno === "noturno" ? ini.map(m => (m < 720 ? m + 1440 : m)) : ini;
      const iMin = Math.min(...base);
      const start = acc.s[base.indexOf(iMin)];
      const fimsAjust = acc.e.map(e => { let m = toMin(e); if (m <= iMin) m += 1440; return m; });
      const end = acc.e[fimsAjust.indexOf(Math.max(...fimsAjust))];
      g.amostras.push({ start, end });
      g.diasSet.add(d.date);
      g.dias = g.diasSet.size;
      grupos.set(chave, g);
    }
  }
  return [...grupos.values()].map(({ diasSet: _d, ...g }) => g).sort((a, b) => b.dias - a.dias);
}
