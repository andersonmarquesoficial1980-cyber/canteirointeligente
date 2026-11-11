import { findMeterGaps, type MeterDiary } from "./equipmentDiaryAudit";

/**
 * Central de Operações — regra ÚNICA de "situação do dia" de equipamentos, pessoas e obras.
 * Funções puras (sem Supabase) para que todas as abas usem os mesmos números.
 *
 * Regras:
 *  - Diário "lançado" = status "enviado" e NÃO automático (is_auto). Diário automático de pátio
 *    serve só como pista de localização, nunca conta como lançamento.
 *  - Equipamento "monitorado" = cadastro ativo (OPERACIONAL). Em manutenção aparece, mas não gera alerta.
 *  - Pessoa "monitorada" = origem PROPRIO, ativa, fora das áreas administrativas (mesma regra do
 *    WF Programador / RPC programador_pendencias). RDO automático e rascunho não contam.
 */

export const norm = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
export const fleetKey = (s: string | null | undefined) => norm(s).replace(/[^A-Z0-9]/g, "");
export const ogsKey = (s: string | null | undefined) => norm(s).replace(/^OGS[-\s:]*/i, "");

/** Dias corridos entre duas datas ISO (YYYY-MM-DD). */
export function diffDays(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

// ─── Equipamentos ────────────────────────────────────────────────────────────

export interface EquipamentoBase {
  id: string; frota: string; nome?: string | null; tipo?: string | null;
  status?: string | null; setor?: string | null; local_atual?: string | null;
}
export interface DiarioLite {
  equipment_fleet: string | null; date: string | null; work_status: string | null;
  ogs_number: string | null; operator_name: string | null; status: string | null;
  is_auto?: boolean | null; period?: string | null; created_by?: string | null;
}
export interface TransporteLite {
  equipment_fleet: string; data: string; origem_ogs?: string | null; destino_ogs?: string | null;
}

export type StatusOperacao = "trabalhando" | "disposicao" | "manutencao" | "transporte" | "folga" | "patio" | "sem_info";
export type EstadoLancamento = "ok_hoje" | "atrasado" | "nunca" | "isento" | "sem_historico";

export interface EquipamentoSituacao {
  id: string; frota: string; nome: string; tipo: string; equipe: string;
  statusCadastro: "OPERACIONAL" | "MANUTENÇÃO" | "INOPERANTE" | "DEVOLVER" | "DEVOLVIDO";
  monitorado: boolean;
  statusOperacao: StatusOperacao;
  ogs: string; local: string; operador: string;
  ultimoDiario: string | null; diasSemDiario: number | null;
  semDiarioHoje: boolean;
  estado: EstadoLancamento;
  fonte: "diario" | "diario_auto" | "transporte" | "cadastro" | "nenhuma";
}

export function statusCadastro(statusDb?: string | null): EquipamentoSituacao["statusCadastro"] {
  const s = (statusDb || "").toLowerCase();
  if (s === "em_manutencao" || s.includes("manut")) return "MANUTENÇÃO";
  if (s === "inativo" || s.includes("inoperante")) return "INOPERANTE";
  if (s === "devolvido") return "DEVOLVIDO";
  if (s === "devolver" || s === "disposicao") return "DEVOLVER";
  return "OPERACIONAL";
}

export function statusOperacaoDe(workStatus: string | null | undefined): StatusOperacao {
  const s = norm(workStatus);
  if (!s) return "sem_info";
  if (s.startsWith("TRABALH")) return "trabalhando";
  if (s.includes("MANUT") || s.includes("INOPER")) return "manutencao";
  if (s.includes("TRANSP")) return "transporte";
  if (s.includes("FOLGA")) return "folga";
  if (s.includes("DISPOS")) return "disposicao";
  if (s.includes("PATIO") || s.includes("BASE")) return "patio";
  return "disposicao";
}

/**
 * Tipos que NÃO lançam diário por natureza (banheiro, torre, compressor...): tipo com 3+ unidades
 * ativas e nenhuma com diário enviado na janela. Detectado pelos dados, sem lista fixa.
 */
export function tiposSemDiario(equips: EquipamentoBase[], diarios: DiarioLite[], minUnidades = 3): Set<string> {
  const comDiario = new Set(diarios.filter((d) => norm(d.status) === "ENVIADO" && d.is_auto !== true).map((d) => fleetKey(d.equipment_fleet)));
  const tot = new Map<string, number>(); const com = new Map<string, number>();
  for (const e of equips) {
    if (statusCadastro(e.status) !== "OPERACIONAL") continue;
    const t = norm(e.tipo); if (!t) continue;
    tot.set(t, (tot.get(t) || 0) + 1);
    if (comDiario.has(fleetKey(e.frota))) com.set(t, (com.get(t) || 0) + 1);
  }
  return new Set([...tot].filter(([t, n]) => n >= minUnidades && !com.get(t)).map(([t]) => t));
}

const lancado = (d: DiarioLite) => norm(d.status) === "ENVIADO" && d.is_auto !== true && !!d.date;

export function situacaoEquipamentos(
  equips: EquipamentoBase[], diarios: DiarioLite[], transportes: TransporteLite[], hoje: string, limiteDias = 2,
): EquipamentoSituacao[] {
  const semDiarioPorNatureza = tiposSemDiario(equips, diarios);
  const diariosPorFrota = new Map<string, DiarioLite[]>();
  for (const d of diarios) {
    if (!d.date || norm(d.status) === "RASCUNHO") continue;
    const k = fleetKey(d.equipment_fleet);
    if (!k) continue;
    (diariosPorFrota.get(k) || diariosPorFrota.set(k, []).get(k)!).push(d);
  }
  const transpPorFrota = new Map<string, TransporteLite>();
  for (const t of transportes) {
    const k = fleetKey(t.equipment_fleet);
    const cur = transpPorFrota.get(k);
    if (!cur || t.data > cur.data) transpPorFrota.set(k, t);
  }

  return equips.map((e) => {
    const k = fleetKey(e.frota);
    const sc = statusCadastro(e.status);
    const monitorado = sc === "OPERACIONAL" && !semDiarioPorNatureza.has(norm(e.tipo));
    const todos = (diariosPorFrota.get(k) || []).sort((a, b) => (b.date! + (b.period || "")).localeCompare(a.date! + (a.period || "")));
    const manual = todos.find(lancado) || null;
    const ultimoAuto = todos.find((d) => d.is_auto === true) || null;
    const ref = manual || ultimoAuto;
    const tr = transpPorFrota.get(k);

    let statusOperacao: StatusOperacao = "sem_info";
    let ogs = ""; let local = ""; let operador = "";
    let fonte: EquipamentoSituacao["fonte"] = "nenhuma";
    const transpRecente = tr && (!ref || tr.data > ref.date!);
    if (transpRecente) {
      statusOperacao = "transporte"; ogs = tr!.destino_ogs || ""; local = `Transporte ${tr!.origem_ogs || "?"} → ${tr!.destino_ogs || "?"}`; fonte = "transporte";
    } else if (ref) {
      statusOperacao = ref.is_auto ? "patio" : statusOperacaoDe(ref.work_status);
      ogs = ref.ogs_number || ""; operador = ref.operator_name || ""; fonte = ref.is_auto ? "diario_auto" : "diario";
    } else if (e.setor || e.local_atual) {
      local = e.local_atual || e.setor || ""; fonte = "cadastro";
    }
    if (sc === "MANUTENÇÃO") statusOperacao = "manutencao";

    const ultimoDiario = manual?.date || null;
    const diasSemDiario = ultimoDiario ? Math.max(0, diffDays(ultimoDiario, hoje)) : null;
    const semDiarioHoje = !todos.some((d) => lancado(d) && d.date === hoje);
    let estado: EstadoLancamento;
    if (!monitorado) estado = "isento";
    else if (!semDiarioHoje) estado = "ok_hoje";
    else if (ultimoDiario === null) estado = "nunca";
    else estado = (diasSemDiario ?? 0) >= limiteDias ? "atrasado" : "ok_hoje";

    return {
      id: e.id, frota: e.frota, nome: e.nome || "", tipo: e.tipo || "", equipe: e.setor || "",
      statusCadastro: sc, monitorado, statusOperacao, ogs, local, operador,
      ultimoDiario, diasSemDiario, semDiarioHoje, estado, fonte,
    };
  });
}

// ─── Pessoas ─────────────────────────────────────────────────────────────────

export interface EmployeeBase {
  id: string; name: string; matricula?: string | null; role?: string | null; equipe?: string | null;
  centro_custo?: string | null; origem?: string | null; status?: string | null;
  data_admissao?: string | null; data_demissao?: string | null;
}
export type FontePresenca = "rdo" | "diario" | "rdo_tecnico" | "programador";
export const FONTE_LABEL: Record<FontePresenca, string> = {
  rdo: "Citado em RDO", diario: "Diário de equipamento", rdo_tecnico: "RDO Técnico", programador: "Alocado no Programador",
};
/** Uma "aparição" da pessoa em algum lançamento. `fonte` omitida = RDO (compatibilidade). */
export interface PresencaRdo { employee_id: string | null; nome: string | null; data: string; obra: string; ogs: string; equipe: string; fonte?: FontePresenca }

/** Mesma exclusão de áreas do WF Programador (wf_auto_rdo_area_excluida + GRU/COPASA). */
export function areaExcluida(equipe: string | null | undefined, cc: string | null | undefined): boolean {
  const joined = norm(`${equipe || ""} | ${cc || ""}`);
  if (/(ADMINISTRATIV|CONTABIL|DEMITID|DEPARTAMENTO DE TI|(^| )TI( |$)|FACILIT|FINANCEIR|GESTAO DE PESSOAS|JURIDIC|MANUTENCAO|MASSA FRIA|SEGURANCA|SUPRIMENT|COMERCIAL|ESCRITORIO)/.test(joined)) return true;
  if (/(GRU|COPASA)/.test(norm(equipe)) || /(GRU|COPASA)/.test(norm(cc))) return true;
  return cc === "2529" || cc === "2339";
}

export interface PessoaSituacao {
  id: string; nome: string; matricula: string; funcao: string; equipe: string;
  /** Última vez que apareceu em QUALQUER lançamento, e em qual. */
  ultimaData: string | null; ultimaFonte: FontePresenca | null; diasSemRegistro: number | null;
  ultimaObra: string; ultimaOgs: string;
  fontes: Partial<Record<FontePresenca, string>>;
  /** Compat: igual a diasSemRegistro. */
  diasSemRdo: number | null;
  semRegistroHoje: boolean; semRdoHoje: boolean; estado: EstadoLancamento;
}

/**
 * Presença = aparecer em QUALQUER lançamento: citado no RDO (equipe do apontador), operador/motorista no
 * diário de equipamento, engenheiro no RDO Técnico ou alocado pelo Programador (folga, férias, atestado...).
 * Alerta ("atrasado") só quando já apareceu na janela mas está há N+ dias sem aparecer em NENHUM lançamento.
 * Quem não aparece em nada na janela = "sem_historico" (provável fora de campo; não é alerta).
 */
export function situacaoPessoas(
  pessoas: EmployeeBase[], presencas: PresencaRdo[], hoje: string, limiteDias = 4, incluirAreasExcluidas = false,
): PessoaSituacao[] {
  type Acc = { ultimo?: PresencaRdo; fontes: Partial<Record<FontePresenca, string>>; hoje: boolean };
  const porId = new Map<string, Acc>(); const porNome = new Map<string, Acc>();
  const toca = (m: Map<string, Acc>, k: string, p: PresencaRdo) => {
    const a = m.get(k) || m.set(k, { fontes: {}, hoje: false }).get(k)!;
    const f = p.fonte || "rdo";
    if (!a.ultimo || p.data > a.ultimo.data) a.ultimo = { ...p, fonte: f };
    if (!a.fontes[f] || p.data > a.fontes[f]!) a.fontes[f] = p.data;
    if (p.data === hoje) a.hoje = true;
  };
  for (const p of presencas) {
    if (p.employee_id) toca(porId, p.employee_id, p);
    const nk = norm(p.nome); if (nk) toca(porNome, nk, p);
  }
  const out: PessoaSituacao[] = [];
  for (const e of pessoas) {
    if ((e.origem || "PROPRIO") !== "PROPRIO" || (e.status || "ativo") !== "ativo") continue;
    if (e.data_demissao && e.data_demissao < hoje) continue;
    if (e.data_admissao && /^\d{4}-\d{2}-\d{2}/.test(e.data_admissao) && e.data_admissao.slice(0, 10) > hoje) continue;
    if (!incluirAreasExcluidas && (areaExcluida(e.equipe, e.centro_custo) || /ADMINISTRATIV|AJUDANTE/.test(norm(e.role)))) continue; // ajudantes nem sempre são citados em RDO nem lançam diário
    const a = porId.get(e.id); const b = porNome.get(norm(e.name));
    const fontes: Partial<Record<FontePresenca, string>> = {};
    for (const acc of [a, b]) for (const [f, d] of Object.entries(acc?.fontes || {})) if (!fontes[f as FontePresenca] || d! > fontes[f as FontePresenca]!) fontes[f as FontePresenca] = d;
    const ult = !a?.ultimo ? b?.ultimo : !b?.ultimo ? a.ultimo : a.ultimo.data >= b.ultimo.data ? a.ultimo : b.ultimo;
    const hojeOk = !!(a?.hoje || b?.hoje);
    const dias = ult ? Math.max(0, diffDays(ult.data, hoje)) : null;
    const estado: EstadoLancamento = hojeOk ? "ok_hoje" : !ult ? "sem_historico" : (dias ?? 0) >= limiteDias ? "atrasado" : "ok_hoje";
    out.push({
      id: e.id, nome: e.name, matricula: e.matricula || "", funcao: e.role || "", equipe: e.equipe || "",
      ultimaData: ult?.data || null, ultimaFonte: (ult?.fonte as FontePresenca) || null, diasSemRegistro: dias, diasSemRdo: dias,
      ultimaObra: ult?.obra || "", ultimaOgs: ult?.ogs || "", fontes, semRegistroHoje: !hojeOk, semRdoHoje: !hojeOk, estado,
    });
  }
  return out;
}

// ─── Obras ───────────────────────────────────────────────────────────────────

export interface RdoLite { data: string | null; obra_nome: string; ogs_id: string | null; equipe?: string | null; status_validacao?: string | null; tipo_rdo?: string | null }
export interface OgsLite { id: string; ogs_number: string | null; client_name?: string | null; location_address?: string | null }
export interface ObraSituacao {
  ogs: string; nome: string; cliente: string;
  rdoHoje: number; ultimoRdo: string | null; diasSemRdo: number | null;
  equipamentosHoje: number; pessoasHoje: number; estado: "rdo_hoje" | "sem_rdo_hoje" | "parada";
}

export function situacaoObras(
  ogsList: OgsLite[], rdos: RdoLite[], diarios: DiarioLite[], pessoasPorOgsHoje: Map<string, number>, hoje: string, janelaAtivaDias = 14,
): ObraSituacao[] {
  const byId = new Map(ogsList.map((o) => [o.id, o]));
  const map = new Map<string, ObraSituacao>();
  const get = (key: string, nome: string, cliente: string) => {
    let o = map.get(key);
    if (!o) { o = { ogs: key, nome, cliente, rdoHoje: 0, ultimoRdo: null, diasSemRdo: null, equipamentosHoje: 0, pessoasHoje: 0, estado: "parada" }; map.set(key, o); }
    return o;
  };
  for (const r of rdos) {
    if (!r.data || norm(r.status_validacao) === "RASCUNHO") continue;
    const ref = r.ogs_id ? byId.get(r.ogs_id) : undefined;
    const key = ogsKey(ref?.ogs_number) || ogsKey(r.obra_nome);
    if (!key || /SEM ATIVIDADE/.test(key)) continue;
    const o = get(key, r.obra_nome, ref?.client_name || "");
    if (r.data === hoje) o.rdoHoje += 1;
    if (!o.ultimoRdo || r.data > o.ultimoRdo) o.ultimoRdo = r.data;
  }
  const eqHoje = new Map<string, Set<string>>();
  for (const d of diarios) {
    if (d.date !== hoje || norm(d.status) === "RASCUNHO" || d.is_auto === true) continue;
    const k = ogsKey(d.ogs_number); if (!k) continue;
    (eqHoje.get(k) || eqHoje.set(k, new Set()).get(k)!).add(fleetKey(d.equipment_fleet));
  }
  for (const [k, set] of eqHoje) { const o = map.get(k); if (o) o.equipamentosHoje = set.size; }
  for (const [k, n] of pessoasPorOgsHoje) { const o = map.get(k); if (o) o.pessoasHoje = n; }
  for (const o of map.values()) {
    o.diasSemRdo = o.ultimoRdo ? Math.max(0, diffDays(o.ultimoRdo, hoje)) : null;
    o.estado = o.rdoHoje > 0 ? "rdo_hoje" : (o.diasSemRdo ?? 999) <= janelaAtivaDias ? "sem_rdo_hoje" : "parada";
  }
  return [...map.values()].filter((o) => o.estado !== "parada").sort((a, b) => a.estado.localeCompare(b.estado) || a.nome.localeCompare(b.nome));
}

// ─── Resumo (KPIs da aba Hoje) ───────────────────────────────────────────────

export interface ResumoCentral {
  equipMonitorados: number; equipComDiarioHoje: number; equipAtrasados: number; equipNunca: number;
  porStatus: Record<StatusOperacao, number>; emManutencao: number;
  pessoasMonitoradas: number; pessoasComRdoHoje: number; pessoasAtrasadas: number; pessoasSemHistorico: number;
  obrasAtivas: number; obrasComRdoHoje: number;
}

export function resumoCentral(eq: EquipamentoSituacao[], pe: PessoaSituacao[], ob: ObraSituacao[]): ResumoCentral {
  const mon = eq.filter((e) => e.monitorado);
  const porStatus: Record<StatusOperacao, number> = { trabalhando: 0, disposicao: 0, manutencao: 0, transporte: 0, folga: 0, patio: 0, sem_info: 0 };
  eq.filter((e) => e.monitorado || e.statusCadastro === "MANUTENÇÃO" || e.statusCadastro === "INOPERANTE").forEach((e) => { porStatus[e.statusOperacao] += 1; });
  return {
    equipMonitorados: mon.length,
    equipComDiarioHoje: mon.filter((e) => !e.semDiarioHoje).length,
    equipAtrasados: mon.filter((e) => e.estado === "atrasado").length,
    equipNunca: mon.filter((e) => e.estado === "nunca").length,
    porStatus,
    emManutencao: eq.filter((e) => e.statusCadastro === "MANUTENÇÃO" || e.statusCadastro === "INOPERANTE").length,
    pessoasMonitoradas: pe.length,
    pessoasComRdoHoje: pe.filter((p) => !p.semRdoHoje).length,
    pessoasAtrasadas: pe.filter((p) => p.estado === "atrasado").length,
    pessoasSemHistorico: pe.filter((p) => p.estado === "sem_historico").length,
    obrasAtivas: ob.length,
    obrasComRdoHoje: ob.filter((o) => o.estado === "rdo_hoje").length,
  };
}

// ─── Medidores (horímetro / odômetro) ────────────────────────────────────────

export interface SaltoMedidor {
  frota: string; tipo: "regressao" | "salto"; medidor: "horimetro" | "odometro";
  dataAnterior: string; dataAtual: string; finalAnterior: number; inicialAtual: number; diferenca: number;
  operador: string;
}

/**
 * Continuidade de medidor por frota (reaproveita findMeterGaps).
 *  - regressão (diferença < 0): medidor voltou — provável erro de digitação (ex.: zero a mais).
 *  - salto (diferença > 0): rodou/trabalhou sem diário entre um lançamento e outro.
 * Tolerâncias evitam ruído de arredondamento (padrão: 5 h de horímetro, 50 km de odômetro).
 */
export function saltosMedidor(rows: MeterDiary[], desde: string, tolHoras = 5, tolKm = 50): SaltoMedidor[] {
  const out: SaltoMedidor[] = [];
  for (const g of findMeterGaps(rows)) {
    if (!g.current.date || g.current.date < desde) continue;
    const km = g.kind === "odometer";
    if (Math.abs(g.difference) < (km ? tolKm : tolHoras)) continue;
    out.push({
      frota: g.current.equipment_fleet, tipo: g.difference < 0 ? "regressao" : "salto", medidor: km ? "odometro" : "horimetro",
      dataAnterior: g.previous.date, dataAtual: g.current.date,
      finalAnterior: (km ? g.previous.odometer_final : g.previous.meter_final) as number,
      inicialAtual: (km ? g.current.odometer_initial : g.current.meter_initial) as number,
      diferenca: g.difference, operador: g.current.operator_name || "",
    });
  }
  return out.sort((a, b) => b.dataAtual.localeCompare(a.dataAtual) || a.frota.localeCompare(b.frota));
}

// ─── Onde estão (agrupamento por obra) ───────────────────────────────────────

export interface GrupoLocal { chave: string; titulo: string; itens: EquipamentoSituacao[]; porStatus: Partial<Record<StatusOperacao, number>> }

/** Agrupa por OGS (diário/transporte) ou, na falta, pelo local/equipe do cadastro. Sem localização → "Sem localização". */
export function agruparPorLocal(eq: EquipamentoSituacao[]): GrupoLocal[] {
  const m = new Map<string, GrupoLocal>();
  for (const e of eq) {
    const ogs = ogsKey(e.ogs);
    const chave = ogs ? `OGS ${ogs}` : e.local || e.equipe ? `Cadastro: ${e.local || e.equipe}` : "Sem localização";
    const g = m.get(chave) || m.set(chave, { chave, titulo: chave, itens: [], porStatus: {} }).get(chave)!;
    g.itens.push(e); g.porStatus[e.statusOperacao] = (g.porStatus[e.statusOperacao] || 0) + 1;
  }
  const ordem = (g: GrupoLocal) => (g.chave.startsWith("OGS") ? 0 : g.chave === "Sem localização" ? 2 : 1);
  return [...m.values()].sort((a, b) => ordem(a) - ordem(b) || b.itens.length - a.itens.length);
}

// ─── Cruzamento Transporte × Diário × RDO ────────────────────────────────────

export interface TransporteCompleto {
  id: string; equipment_fleet: string; data: string;
  origem_ogs: string | null; origem_descricao: string | null; destino_ogs: string | null; destino_descricao: string | null;
  transportador_nome: string | null; meter_no_transporte: number | null; odometer_no_transporte: number | null;
}
export interface DiarioCruz { equipment_fleet: string | null; date: string | null; ogs_number: string | null; status: string | null; is_auto?: boolean | null;
  meter_initial?: number | null; meter_final?: number | null; odometer_initial?: number | null; odometer_final?: number | null }
/** Equipamento citado em RDO enviado: data + OGS do RDO + frota. */
export interface RdoEquipCruz { data: string; ogs: string; frota: string }

export type TipoCruzamento = "sem_registro_no_destino" | "mudou_de_obra_sem_transporte";
export interface Cruzamento {
  tipo: TipoCruzamento; frota: string; data: string; detalhe: string; obra: string; transportador: string;
}

/** OGS "de verdade": '__OUTROS__', vazio e base/pátio não são obra. */
export const ogsReal = (v: string | null | undefined): string => {
  const k = ogsKey(v);
  return !k || /^0+$/.test(k) || k.startsWith("__OUTROS") || /^BASE|PATIO/.test(k) ? "" : k;
};
const addDia = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);
const num = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);

/**
 * Regras (validadas com o Anderson):
 *  - __OUTROS__ nos dois lados = movimentação interna da obra (não é troca de obra, não cobra nada).
 *  - Destino com OGS diferente da origem: exige diário OU RDO do equipamento nessa OGS de D a D+2.
 *  - Equipamento aparece em OGS diferente da anterior (diário × diário) sem transporte no intervalo.
 *  - Medidor do transporte NÃO é cruzado: nos dados reais o campo repete o mesmo valor em equipamentos diferentes.
 */
export function cruzarTransportes(
  transportes: TransporteCompleto[], diarios: DiarioCruz[], rdoEquip: RdoEquipCruz[], desde: string, hoje: string,
  tolKm = 50, tolHoras = 5,
): Cruzamento[] {
  const out: Cruzamento[] = [];
  const dia = diarios.filter((d) => d.date && norm(d.status) === "ENVIADO" && d.is_auto !== true)
    .map((d) => ({ ...d, f: fleetKey(d.equipment_fleet), o: ogsReal(d.ogs_number), date: d.date! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const porFrota = new Map<string, typeof dia>();
  for (const d of dia) (porFrota.get(d.f) || porFrota.set(d.f, []).get(d.f)!).push(d);
  const rdoSet = new Set(rdoEquip.map((r) => `${fleetKey(r.frota)}|${r.data}|${ogsReal(r.ogs)}`));
  const trPorFrota = new Map<string, TransporteCompleto[]>();
  for (const t of transportes) (trPorFrota.get(fleetKey(t.equipment_fleet)) || trPorFrota.set(fleetKey(t.equipment_fleet), []).get(fleetKey(t.equipment_fleet))!).push(t);

  for (const t of transportes) {
    if (t.data < desde) continue;
    const f = fleetKey(t.equipment_fleet);
    const origem = ogsReal(t.origem_ogs), destino = ogsReal(t.destino_ogs);
    const base = { frota: t.equipment_fleet, data: t.data, transportador: t.transportador_nome || "" };

    // 1) transportado para outra obra e nada confirma que chegou
    if (destino && destino !== origem && diffDays(t.data, hoje) >= 2) {
      const confirma = [0, 1, 2].some((k) => {
        const d = addDia(t.data, k);
        return (porFrota.get(f) || []).some((x) => x.date === d && x.o === destino) || rdoSet.has(`${f}|${d}|${destino}`);
      });
      if (!confirma) out.push({ ...base, tipo: "sem_registro_no_destino", obra: destino, detalhe: `Transportado para a OGS ${destino}${t.destino_descricao ? ` (${t.destino_descricao.trim()})` : ""}, mas não há diário nem RDO dele nessa obra em até 2 dias.` });
    }

  }

  // 2) mudou de obra entre dois diários sem nenhum transporte no intervalo
  for (const [f, lista] of porFrota) {
    const trs = trPorFrota.get(f) || [];
    for (let i = 1; i < lista.length; i++) {
      const a = lista[i - 1], b = lista[i];
      if (b.date < desde || !a.o || !b.o || a.o === b.o) continue;
      if (trs.some((t) => t.data >= addDia(a.date, -1) && t.data <= addDia(b.date, 1))) continue;
      out.push({ tipo: "mudou_de_obra_sem_transporte", frota: b.equipment_fleet || f, data: b.date, obra: b.o, transportador: "", detalhe: `Diário em ${a.o} (${a.date.split("-").reverse().join("/")}) e depois em ${b.o}, sem transporte registrado entre eles.` });
    }
  }
  return out.sort((x, y) => y.data.localeCompare(x.data) || x.frota.localeCompare(y.frota));
}
