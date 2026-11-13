import { norm, fleetKey, ogsKey, areaExcluida, statusCadastro } from "./centralOperacoes";

/**
 * Controle de RDO — cobertura diária de equipamentos e funcionários nos RDOs.
 * Funções puras (sem Supabase). "Lançado" = citado em RDO enviado/validado e NÃO automático.
 * O relatório diz "sem registro", nunca "erro": parado/folga/outra obra só é justificado com evidência
 * (diário manual, transporte, alocação do Programador, cadastro em manutenção).
 */

export type CoverageState =
  | "rdo"            // aparece em RDO
  | "justificado"    // sem RDO, mas com justificativa (folga, férias, manutenção, transporte...)
  | "inconsistente"  // sem RDO, mas há evidência de trabalho (diário "Trabalhando" / alocado em obra)
  | "sem_registro"   // dia vencido, nada em lugar nenhum
  | "hoje"           // hoje ainda não está atrasado
  | "futuro"
  | "sem_expediente" // nenhum RDO da empresa nesse dia (domingo, feriado): não cobra
  | "na";            // antes do cadastro / depois da demissão

export interface DayCell { date: string; state: CoverageState; rdo: RdoRef[]; note: string }
export interface RdoRef { rdoId: string; obra: string; ogs: string; equipe: string; apontador: string }

export interface RdoIn {
  id: string; data: string | null; obra_nome: string; ogs_id: string | null; equipe?: string | null;
  encarregado?: string | null; encarregado_employee_id?: string | null;
  status_validacao?: string | null; tipo_rdo?: string | null; apontador?: string | null;
}
export interface OgsIn { id: string; ogs_number: string | null }
export interface RdoEquipIn { rdo_id: string; frota: string | null }
export interface RdoEfetivoIn { rdo_id: string; nome: string | null; employee_id: string | null }
export interface DiaryIn { equipment_fleet: string | null; date: string | null; work_status: string | null; status: string | null; is_auto?: boolean | null; operator_id?: string | null; operator_name?: string | null; operator_solo_id?: string | null; operator_solo?: string | null }
export interface TransportIn { equipment_fleet: string; data: string }
export interface AllocIn { employee_id: string; data: string; tipo: string; ogs_number?: string | null }
export interface EquipIn { id: string; frota: string; nome?: string | null; tipo?: string | null; status?: string | null; created_at?: string | null }
export interface EmployeeIn {
  id: string; name: string; matricula?: string | null; role?: string | null; equipe?: string | null;
  centro_custo?: string | null; origem?: string | null; status?: string | null;
  data_admissao?: string | null; data_demissao?: string | null;
}

export const rdoValido = (r: RdoIn) => !!r.data && norm(r.status_validacao) !== "RASCUNHO" && norm(r.tipo_rdo) !== "AUTOMATICO";
const diarioManual = (d: DiaryIn) => !!d.date && norm(d.status) === "ENVIADO" && d.is_auto !== true;
const trabalhando = (ws: string | null | undefined) => norm(ws) === "TRABALHANDO";

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return out;
  const c = new Date(`${start}T12:00:00Z`); const f = new Date(`${end}T12:00:00Z`);
  while (c <= f) { out.push(c.toISOString().slice(0, 10)); c.setUTCDate(c.getUTCDate() + 1); }
  return out;
}

const splitNomes = (nome: string | null | undefined) => (nome || "").split("|||").map(n => n.trim()).filter(Boolean);

/** Dias do período em que a empresa teve pelo menos 1 RDO válido (senão: sem expediente). */
export function diasComExpediente(rdos: RdoIn[]): Set<string> {
  return new Set(rdos.filter(rdoValido).map(r => r.data as string));
}

function baseState(date: string, hoje: string, expediente: Set<string>, contarSemExpediente: boolean): CoverageState | null {
  if (date > hoje) return "futuro";
  if (!contarSemExpediente && !expediente.has(date) && date < hoje) return "sem_expediente";
  return null;
}

function refOf(r: RdoIn, ogsById: Map<string, OgsIn>): RdoRef {
  const o = r.ogs_id ? ogsById.get(r.ogs_id) : undefined;
  return { rdoId: r.id, obra: r.obra_nome, ogs: ogsKey(o?.ogs_number) || ogsKey(r.obra_nome), equipe: r.equipe || "", apontador: r.apontador || "" };
}

// ─── Equipamentos ────────────────────────────────────────────────────────────

export interface EquipCoverage {
  id: string; frota: string; nome: string; tipo: string; statusCadastro: string;
  cells: DayCell[]; comRdo: number; faltando: string[]; inconsistentes: string[];
  cobrados: number; pct: number | null;
}

export function coberturaEquipamentos(p: {
  equips: EquipIn[]; rdos: RdoIn[]; ogs: OgsIn[]; rdoEquips: RdoEquipIn[]; diarios: DiaryIn[]; transportes: TransportIn[];
  inicio: string; fim: string; hoje: string; contarSemExpediente?: boolean;
}): EquipCoverage[] {
  const days = eachDay(p.inicio, p.fim);
  const expediente = diasComExpediente(p.rdos);
  const ogsById = new Map(p.ogs.map(o => [o.id, o]));
  const rdoById = new Map(p.rdos.filter(rdoValido).map(r => [r.id, r]));
  const byFleetDay = new Map<string, RdoRef[]>();
  for (const e of p.rdoEquips) {
    const r = rdoById.get(e.rdo_id); if (!r || !e.frota) continue;
    const k = `${fleetKey(e.frota)}|${r.data}`;
    const arr = byFleetDay.get(k) || []; arr.push(refOf(r, ogsById)); byFleetDay.set(k, arr);
  }
  const diaryByFleetDay = new Map<string, DiaryIn[]>();
  for (const d of p.diarios) {
    if (!diarioManual(d) || !d.equipment_fleet) continue;
    const k = `${fleetKey(d.equipment_fleet)}|${d.date}`;
    const arr = diaryByFleetDay.get(k) || []; arr.push(d); diaryByFleetDay.set(k, arr);
  }
  const transp = new Set(p.transportes.map(t => `${fleetKey(t.equipment_fleet)}|${t.data}`));

  return p.equips.map((e): EquipCoverage => {
    const fk = fleetKey(e.frota);
    const sc = statusCadastro(e.status);
    const inicioCobranca = e.created_at ? e.created_at.slice(0, 10) : null;
    const cells: DayCell[] = days.map(date => {
      const rdo = byFleetDay.get(`${fk}|${date}`) || [];
      if (rdo.length) return { date, state: "rdo", rdo, note: "" };
      const diarios = diaryByFleetDay.get(`${fk}|${date}`) || [];
      if (diarios.some(d => trabalhando(d.work_status))) {
        return { date, state: "inconsistente", rdo: [], note: "Diário do operador diz Trabalhando, mas o equipamento não está em nenhum RDO" };
      }
      if (diarios.length) return { date, state: "justificado", rdo: [], note: `Diário: ${diarios[0].work_status || "—"}` };
      if (transp.has(`${fk}|${date}`)) return { date, state: "justificado", rdo: [], note: "Em transporte" };
      if (inicioCobranca && date < inicioCobranca) return { date, state: "na", rdo: [], note: "Antes do cadastro" };
      const base = baseState(date, p.hoje, expediente, !!p.contarSemExpediente);
      if (base) return { date, state: base, rdo: [], note: "" };
      if (sc === "MANUTENÇÃO" || sc === "INOPERANTE") return { date, state: "justificado", rdo: [], note: `Cadastro: ${sc}` };
      return { date, state: date === p.hoje ? "hoje" : "sem_registro", rdo: [], note: "" };
    });
    const faltando = cells.filter(c => c.state === "sem_registro").map(c => c.date);
    const inconsistentes = cells.filter(c => c.state === "inconsistente").map(c => c.date);
    const comRdo = cells.filter(c => c.state === "rdo").length;
    const cobrados = comRdo + faltando.length + inconsistentes.length;
    return {
      id: e.id, frota: e.frota, nome: e.nome || "", tipo: (e.tipo || "").trim(), statusCadastro: sc,
      cells, comRdo, faltando, inconsistentes, cobrados, pct: cobrados ? Math.round((comRdo / cobrados) * 100) : null,
    };
  });
}

// ─── Funcionários ────────────────────────────────────────────────────────────

export interface PersonCoverage {
  id: string; nome: string; matricula: string; funcao: string; equipe: string;
  cells: DayCell[]; comRdo: number; faltando: string[]; inconsistentes: string[];
  cobrados: number; pct: number | null;
}

/** Presença em outra fonte que justifica o dia (ex.: RDO Técnico do engenheiro), casada por nome. */
export interface PresencaExtra { nome: string; data: string; nota: string }

export interface PessoaFiltro { incluirAjudantes: boolean; incluirAdm: boolean }

export function pessoaMonitorada(e: EmployeeIn, hoje: string, f: PessoaFiltro): boolean {
  if ((e.origem || "PROPRIO") !== "PROPRIO" || (e.status || "ativo") !== "ativo") return false;
  if (e.data_demissao && e.data_demissao < hoje) return false;
  if (e.data_admissao && /^\d{4}-\d{2}-\d{2}/.test(e.data_admissao) && e.data_admissao.slice(0, 10) > hoje) return false;
  if (!f.incluirAdm && (areaExcluida(e.equipe, e.centro_custo) || /ADMINISTRATIV/.test(norm(e.role)))) return false;
  if (!f.incluirAjudantes && /AJUDANTE/.test(norm(e.role))) return false;
  return true;
}

export function coberturaPessoas(p: {
  pessoas: EmployeeIn[]; rdos: RdoIn[]; ogs: OgsIn[]; efetivo: RdoEfetivoIn[]; diarios: DiaryIn[]; alocacoes: AllocIn[];
  inicio: string; fim: string; hoje: string; filtro: PessoaFiltro; contarSemExpediente?: boolean; extras?: PresencaExtra[];
}): PersonCoverage[] {
  const extraByNome = new Map<string, Map<string, string>>();
  for (const x of p.extras || []) (extraByNome.get(norm(x.nome)) || extraByNome.set(norm(x.nome), new Map()).get(norm(x.nome))!).set(x.data, x.nota);
  const days = eachDay(p.inicio, p.fim);
  const expediente = diasComExpediente(p.rdos);
  const ogsById = new Map(p.ogs.map(o => [o.id, o]));
  const validos = p.rdos.filter(rdoValido);
  const rdoById = new Map(validos.map(r => [r.id, r]));

  type Hit = RdoRef;
  const rdoById_ = new Map<string, Map<string, Hit[]>>(); // employee_id -> date -> refs
  const rdoByNome = new Map<string, Map<string, Hit[]>>(); // nome norm -> date -> refs
  const put = (m: Map<string, Map<string, Hit[]>>, k: string, date: string, ref: Hit) => {
    const dm = m.get(k) || m.set(k, new Map()).get(k)!;
    const arr = dm.get(date) || dm.set(date, []).get(date)!;
    if (!arr.some(x => x.rdoId === ref.rdoId)) arr.push(ref);
  };
  for (const ef of p.efetivo) {
    const r = rdoById.get(ef.rdo_id); if (!r) continue;
    const ref = refOf(r, ogsById); const date = r.data as string;
    if (ef.employee_id) put(rdoById_, ef.employee_id, date, ref);
    for (const n of splitNomes(ef.nome)) put(rdoByNome, norm(n), date, ref);
  }
  for (const r of validos) { // encarregado também é presença
    const ref = refOf(r, ogsById); const date = r.data as string;
    if (r.encarregado_employee_id) put(rdoById_, r.encarregado_employee_id, date, ref);
    if (r.encarregado) put(rdoByNome, norm(r.encarregado), date, ref);
  }
  // Diário de equipamento: operador/motorista
  const diaryById = new Map<string, Map<string, DiaryIn[]>>(); const diaryByNome = new Map<string, Map<string, DiaryIn[]>>();
  const putD = (m: Map<string, Map<string, DiaryIn[]>>, k: string, d: DiaryIn) => {
    const dm = m.get(k) || m.set(k, new Map()).get(k)!; const arr = dm.get(d.date as string) || dm.set(d.date as string, []).get(d.date as string)!; arr.push(d);
  };
  for (const d of p.diarios) {
    if (!diarioManual(d)) continue;
    for (const id of [d.operator_id, d.operator_solo_id]) if (id) putD(diaryById, id, d);
    for (const n of [...splitNomes(d.operator_name), ...splitNomes(d.operator_solo)]) putD(diaryByNome, norm(n), d);
  }
  const allocById = new Map<string, Map<string, AllocIn>>();
  for (const a of p.alocacoes) (allocById.get(a.employee_id) || allocById.set(a.employee_id, new Map()).get(a.employee_id)!).set(a.data, a);

  return p.pessoas.filter(e => pessoaMonitorada(e, p.hoje, p.filtro)).map((e): PersonCoverage => {
    const nk = norm(e.name);
    const adm = e.data_admissao && /^\d{4}-\d{2}-\d{2}/.test(e.data_admissao) ? e.data_admissao.slice(0, 10) : null;
    const cells: DayCell[] = days.map(date => {
      const refs = [...(rdoById_.get(e.id)?.get(date) || []), ...(rdoByNome.get(nk)?.get(date) || [])];
      const uniq = refs.filter((x, i) => refs.findIndex(y => y.rdoId === x.rdoId) === i);
      if (uniq.length) return { date, state: "rdo", rdo: uniq, note: "" };
      if ((adm && date < adm) || (e.data_demissao && date > e.data_demissao)) return { date, state: "na", rdo: [], note: "Fora do vínculo" };
      const extra = extraByNome.get(nk)?.get(date);
      if (extra) return { date, state: "justificado", rdo: [], note: extra };
      const al = allocById.get(e.id)?.get(date);
      if (al && al.tipo !== "obra") return { date, state: "justificado", rdo: [], note: `Programador: ${al.tipo}` };
      const dd = [...(diaryById.get(e.id)?.get(date) || []), ...(diaryByNome.get(nk)?.get(date) || [])];
      if (dd.some(d => !trabalhando(d.work_status))) return { date, state: "justificado", rdo: [], note: `Diário: ${dd.find(d => !trabalhando(d.work_status))?.work_status}` };
      if (dd.length) return { date, state: "inconsistente", rdo: [], note: "Operador em diário de equipamento, mas fora do efetivo de qualquer RDO" };
      if (al) return { date, state: "inconsistente", rdo: [], note: `Alocado em obra no Programador (OGS ${al.ogs_number || "—"}), sem RDO` };
      const base = baseState(date, p.hoje, expediente, !!p.contarSemExpediente);
      if (base) return { date, state: base, rdo: [], note: "" };
      return { date, state: date === p.hoje ? "hoje" : "sem_registro", rdo: [], note: "" };
    });
    const faltando = cells.filter(c => c.state === "sem_registro").map(c => c.date);
    const inconsistentes = cells.filter(c => c.state === "inconsistente").map(c => c.date);
    const comRdo = cells.filter(c => c.state === "rdo").length;
    const cobrados = comRdo + faltando.length + inconsistentes.length;
    return {
      id: e.id, nome: e.name, matricula: e.matricula || "", funcao: e.role || "", equipe: e.equipe || "",
      cells, comRdo, faltando, inconsistentes, cobrados, pct: cobrados ? Math.round((comRdo / cobrados) * 100) : null,
    };
  });
}

// ─── Lançamentos sem vínculo com o cadastro ──────────────────────────────────

export interface SemVinculo {
  tipo: "pessoa" | "equipamento";
  nome: string;
  /** "sem_cadastro": nome não existe no cadastro; "vinculavel": existe no cadastro, mas a linha do RDO está sem employee_id. */
  situacao: "sem_cadastro" | "vinculavel";
  cadastroId?: string; cadastroNome?: string;
  ocorrencias: number; datas: string[]; obras: string[]; apontadores: string[];
}

export function lancamentosSemVinculo(p: {
  rdos: RdoIn[]; ogs: OgsIn[]; efetivo: RdoEfetivoIn[]; rdoEquips: RdoEquipIn[];
  todosFuncionarios: { id: string; name: string }[]; todosEquipamentos: { frota: string }[];
}): SemVinculo[] {
  const rdoById = new Map(p.rdos.filter(rdoValido).map(r => [r.id, r]));
  const byNome = new Map<string, { id: string; name: string }[]>();
  for (const e of p.todosFuncionarios) (byNome.get(norm(e.name)) || byNome.set(norm(e.name), []).get(norm(e.name))!).push(e);
  const frotas = new Set(p.todosEquipamentos.map(e => fleetKey(e.frota)));
  const acc = new Map<string, SemVinculo>();
  const add = (key: string, base: Omit<SemVinculo, "ocorrencias" | "datas" | "obras" | "apontadores">, r: RdoIn) => {
    const cur = acc.get(key) || acc.set(key, { ...base, ocorrencias: 0, datas: [], obras: [], apontadores: [] }).get(key)!;
    cur.ocorrencias++;
    if (r.data && !cur.datas.includes(r.data)) cur.datas.push(r.data);
    if (r.obra_nome && !cur.obras.includes(r.obra_nome)) cur.obras.push(r.obra_nome);
    if (r.apontador && !cur.apontadores.includes(r.apontador)) cur.apontadores.push(r.apontador);
  };
  for (const ef of p.efetivo) {
    const r = rdoById.get(ef.rdo_id); if (!r) continue;
    const nomes = splitNomes(ef.nome);
    nomes.forEach((n, i) => {
      if (i === 0 && ef.employee_id) return; // linha vinculada
      const hit = byNome.get(norm(n));
      if (hit && hit.length === 1) add(`p|vinc|${hit[0].id}`, { tipo: "pessoa", situacao: "vinculavel", nome: n, cadastroId: hit[0].id, cadastroNome: hit[0].name }, r);
      else if (!hit) add(`p|sem|${norm(n)}`, { tipo: "pessoa", situacao: "sem_cadastro", nome: n }, r);
      // homônimos (hit.length > 1): ambíguo, não classifica
    });
  }
  const eqs = p.rdoEquips;
  for (const q of eqs) {
    const r = rdoById.get(q.rdo_id); if (!r || !q.frota) continue;
    if (!frotas.has(fleetKey(q.frota))) add(`e|${fleetKey(q.frota)}`, { tipo: "equipamento", situacao: "sem_cadastro", nome: q.frota }, r);
  }
  return [...acc.values()].map(v => ({ ...v, datas: v.datas.sort() }))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.ocorrencias - a.ocorrencias || a.nome.localeCompare(b.nome, "pt-BR"));
}

// ─── Texto de cobrança ───────────────────────────────────────────────────────

const dd = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export function textoCobranca(kind: "equipamento" | "pessoa", titulo: string, detalhe: string, faltando: string[], inconsistentes: string[]): string {
  const linhas = [`Pendência de lançamento no RDO — ${kind === "equipamento" ? "equipamento" : "funcionário"}`, `${titulo}${detalhe ? ` (${detalhe})` : ""}`];
  if (faltando.length) linhas.push(`Sem registro em RDO nos dias: ${faltando.map(dd).join(", ")}`);
  if (inconsistentes.length) linhas.push(`Há indício de trabalho, mas fora do RDO, nos dias: ${inconsistentes.map(dd).join(", ")}`);
  linhas.push("Se esteve na obra, favor lançar/corrigir o RDO. Se estava parado, de folga ou em outra obra, informar o motivo.");
  return linhas.join("\n");
}
