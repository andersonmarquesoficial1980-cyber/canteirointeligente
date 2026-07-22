import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

type ApiClient = {
  id: string;
  company_id: string;
  name: string;
  is_active: boolean;
  allowed_reports: string[];
  rate_limit_per_minute: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const MAX_PAGE_SIZE = 500;
const MAX_RANGE_DAYS = 90;

const REPORT_KEYS = new Set([
  "rdo-fremix",
  "rdo/summary",
  "rdo/details",
  "equipamentos/utilizacao",
  "abastecimento/consumo",
  "producao/infra",
  "producao/pavimentacao",
  "transportes/performance",
]);

function jsonResponse(status: number, payload: Json) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeReportKey(url: URL): string {
  const reportFromQuery = url.searchParams.get("report")?.trim() || "";
  if (reportFromQuery) return reportFromQuery.replace(/^\/+/, "");

  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.findIndex((p) => p === "reports-api-v1");
  if (fnIndex < 0) return "";
  return parts.slice(fnIndex + 1).join("/");
}

function parsePage(url: URL) {
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(
    Math.max(parseInt(url.searchParams.get("page_size") || "200", 10), 1),
    MAX_PAGE_SIZE,
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / 86400000);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const PREFIXO_USINA: Record<string, string> = {
  ELLENCO: "ELL",
  JULIOEJULIO: "JUJ",
  AUPAV: "AUP",
  USICITY: "USI",
  USINASSP: "USP",
  USINASSPPAVIMENTACAOETECNOLOGIALTDA: "USP",
};

function normalizarUsinaKey(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function gerarSiglaAuto(nome: string): string {
  const limpo = normalizarUsinaKey(nome);
  return limpo.slice(0, 3);
}

function prefixoUsina(usina: string | null): string {
  if (!usina) return "";
  const key = normalizarUsinaKey(usina);

  if (key.startsWith("USINASSP")) return "USP"; // trava para variações do cadastro USINAS SP

  return PREFIXO_USINA[key] || gerarSiglaAuto(usina);
}

function nfComPrefixo(nf: string | null, usina: string | null): string | null {
  if (!nf) return null;
  const prefix = prefixoUsina(usina);
  if (!prefix) return nf;
  if (nf.includes("-")) return nf;
  return `${prefix}-${nf}`;
}

async function handleRdoFremix(sb: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const tipoRdo = url.searchParams.get("tipo_rdo")?.trim() || "";
  const { page, pageSize, offset } = parsePage(url);

  let rdoQuery = sb
    .from("rdo_diarios")
    .select("id,data,obra_nome,tipo_rdo,preenchido_por,encarregado", { count: "exact" })
    .eq("company_id", companyId)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false });

  if (tipoRdo) rdoQuery = rdoQuery.eq("tipo_rdo", tipoRdo);

  const [medicoesResp, rdoResp] = await Promise.all([
    sb
      .from("terceiros_medicoes")
      .select("id,obra_id,empresa_id,funcionario_id,servico_id,data_medicao,quantidade,status,observacoes,created_at", { count: "exact" })
      .eq("company_id", companyId)
      .gte("data_medicao", start)
      .lte("data_medicao", end)
      .order("data_medicao", { ascending: false })
      .range(offset, offset + pageSize - 1),
    rdoQuery,
  ]);

  if (medicoesResp.error) throw new Error(medicoesResp.error.message);
  if (rdoResp.error) throw new Error(rdoResp.error.message);

  const medicoes = medicoesResp.data || [];
  const rdos = rdoResp.data || [];
  const rdoIds = rdos.map((r: any) => r.id);

  const obraIds = [...new Set(medicoes.map((m: any) => m.obra_id).filter(Boolean))];
  const obraNumbersFromRdo = [...new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean))];
  const empresaIds = [...new Set(medicoes.map((m: any) => m.empresa_id).filter(Boolean))];
  const funcionarioIds = [...new Set(medicoes.map((m: any) => m.funcionario_id).filter(Boolean))];
  const servicoIds = [...new Set(medicoes.map((m: any) => m.servico_id).filter(Boolean))];

  const [obrasResp, obrasByNumberResp, empresasResp, funcionariosResp, servicosResp, nfResp, producaoResp] = await Promise.all([
    obraIds.length
      ? sb.from("ogs_reference").select("id,ogs_number,client_name,location_address").eq("company_id", companyId).in("id", obraIds)
      : Promise.resolve({ data: [], error: null } as any),
    obraNumbersFromRdo.length
      ? sb.from("ogs_reference").select("ogs_number,client_name,location_address").eq("company_id", companyId).in("ogs_number", obraNumbersFromRdo)
      : Promise.resolve({ data: [], error: null } as any),
    empresaIds.length
      ? sb.from("empresas_parceiras").select("id,nome,razao_social,tipo").eq("company_id", companyId).in("id", empresaIds)
      : Promise.resolve({ data: [], error: null } as any),
    funcionarioIds.length
      ? sb.from("funcionarios_terceiros").select("id,nome,funcao").eq("company_id", companyId).in("id", funcionarioIds)
      : Promise.resolve({ data: [], error: null } as any),
    servicoIds.length
      ? sb.from("terceiros_servicos").select("id,tipo_servico,descricao,unidade,valor_unitario").in("id", servicoIds)
      : Promise.resolve({ data: [], error: null } as any),
    rdoIds.length
      ? sb
          .from("rdo_nf_massa")
          .select("id,rdo_id,nf,placa,usina,tonelagem,tipo_material,created_at", { count: "exact" })
          .in("rdo_id", rdoIds)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1)
      : Promise.resolve({ data: [], error: null, count: 0 } as any),
    rdoIds.length
      ? sb
          .from("rdo_producao")
          .select("id,rdo_id,tipo_servico,sentido,sentido_faixa,comprimento_m,largura_m,espessura_cm,area_m2,volume_m3,tonelagem", { count: "exact" })
          .eq("company_id", companyId)
          .in("rdo_id", rdoIds)
          .order("id", { ascending: false })
          .range(offset, offset + pageSize - 1)
      : Promise.resolve({ data: [], error: null, count: 0 } as any),
  ]);

  if (obrasResp.error) throw new Error(obrasResp.error.message);
  if (obrasByNumberResp.error) throw new Error(obrasByNumberResp.error.message);
  if (empresasResp.error) throw new Error(empresasResp.error.message);
  if (funcionariosResp.error) throw new Error(funcionariosResp.error.message);
  if (servicosResp.error) throw new Error(servicosResp.error.message);
  if (nfResp.error) throw new Error(nfResp.error.message);
  if (producaoResp.error) throw new Error(producaoResp.error.message);

  const obrasMap = new Map<string, any>((obrasResp.data || []).map((o: any) => [o.id, o]));
  const obrasByNumberMap = new Map<string, any>((obrasByNumberResp.data || []).map((o: any) => [o.ogs_number, o]));
  const empresasMap = new Map<string, any>((empresasResp.data || []).map((e: any) => [e.id, e]));
  const funcionariosMap = new Map<string, any>((funcionariosResp.data || []).map((f: any) => [f.id, f]));
  const servicosMap = new Map<string, any>((servicosResp.data || []).map((s: any) => [s.id, s]));
  const rdoMap = new Map<string, any>((rdos || []).map((r: any) => [r.id, r]));

  const medicoesRows = medicoes.map((m: any) => {
    const obra = obrasMap.get(m.obra_id);
    const empresa = empresasMap.get(m.empresa_id);
    const funcionario = funcionariosMap.get(m.funcionario_id);
    const servico = servicosMap.get(m.servico_id);
    const valorUnit = safeNumber(servico?.valor_unitario);
    const quantidade = safeNumber(m.quantidade);
    return {
      id: m.id,
      data_medicao: m.data_medicao,
      status: m.status,
      obra: obra?.ogs_number || null,
      contratante: obra?.client_name || null,
      local: obra?.location_address || null,
      empresa_terceira: empresa?.nome || empresa?.razao_social || null,
      funcionario: funcionario?.nome || null,
      funcao: funcionario?.funcao || null,
      tipo_servico: servico?.tipo_servico || null,
      servico_descricao: servico?.descricao || null,
      unidade: servico?.unidade || null,
      quantidade,
      valor_unitario: valorUnit,
      valor_total_estimado: Number((quantidade * valorUnit).toFixed(2)),
      observacoes: m.observacoes,
      created_at: m.created_at,
    };
  });

  const nfRows = (nfResp.data || []).map((n: any) => {
    const rdo = rdoMap.get(n.rdo_id);
    const ogs = obrasByNumberMap.get(rdo?.obra_nome);
    return {
      id: n.id,
      created_at: n.created_at,
      updated_at: n.created_at,
      data_rdo: rdo?.data || null,
      apontador: rdo?.preenchido_por || rdo?.encarregado || null,
      encarregado: rdo?.encarregado || null,
      obra_nome: rdo?.obra_nome || null,
      contratante: ogs?.client_name || null,
      local: ogs?.location_address || null,
      tipo_rdo: rdo?.tipo_rdo || null,
      nf_numero: n.nf,
      nf: nfComPrefixo(n.nf, n.usina),
      placa: n.placa,
      usina: n.usina,
      tipo_material: n.tipo_material,
      tonelagem: safeNumber(n.tonelagem),
    };
  });

  const producaoRows = (producaoResp.data || []).map((p: any) => {
    const rdo = rdoMap.get(p.rdo_id);
    return {
      id: p.id,
      data_rdo: rdo?.data || null,
      obra_nome: rdo?.obra_nome || null,
      tipo_rdo: rdo?.tipo_rdo || null,
      apontador: rdo?.preenchido_por || rdo?.encarregado || null,
      tipo_servico: p.tipo_servico,
      sentido_faixa: p.sentido_faixa || p.sentido,
      comprimento_m: safeNumber(p.comprimento_m),
      largura_m: safeNumber(p.largura_m),
      espessura_cm: safeNumber(p.espessura_cm),
      area_m2: safeNumber(p.area_m2),
      volume_m3: safeNumber(p.volume_m3),
      tonelagem: safeNumber(p.tonelagem),
    };
  });

  return {
    nome_api: "RDO-FREMIX",
    modulo: "ADM Engenharia",
    pagina: page,
    page_size: pageSize,
    filtro_tipo_rdo: tipoRdo || "TODOS",
    periodo: { start_date: start, end_date: end },
    secoes: {
      medicoes_terceiros: {
        total: medicoesResp.count ?? 0,
        rows: medicoesRows,
      },
      notas_fiscais_massa: {
        total: nfResp.count ?? 0,
        total_tonelagem: Number(nfRows.reduce((s: number, r: any) => s + safeNumber(r.tonelagem), 0).toFixed(2)),
        rows: nfRows,
      },
      producao_rdos: {
        total: producaoResp.count ?? 0,
        total_area_m2: Number(producaoRows.reduce((s: number, r: any) => s + safeNumber(r.area_m2), 0).toFixed(2)),
        total_tonelagem: Number(producaoRows.reduce((s: number, r: any) => s + safeNumber(r.tonelagem), 0).toFixed(2)),
        rows: producaoRows,
      },
    },
  };
}

async function authenticate(
  sb: ReturnType<typeof createClient>,
  apiToken: string,
  companyId: string,
  reportKey: string,
): Promise<{ client: ApiClient | null; error?: string; status?: number }> {
  const apiKeyHash = await sha256Hex(apiToken);

  const { data: client, error } = await sb
    .from("wf_api_clients")
    .select("id,name,company_id,is_active,allowed_reports,rate_limit_per_minute")
    .eq("api_key_hash", apiKeyHash)
    .eq("company_id", companyId)
    .maybeSingle<ApiClient>();

  if (error) return { client: null, error: `Erro ao validar credencial: ${error.message}`, status: 500 };
  if (!client || !client.is_active) return { client: null, error: "Chave de API inválida ou inativa", status: 401 };

  const allowed = client.allowed_reports || [];
  if (allowed.length > 0 && !allowed.includes(reportKey)) {
    return { client: null, error: `Chave sem permissão para o relatório ${reportKey}`, status: 403 };
  }

  const windowStart = new Date(Date.now() - 60 * 1000).toISOString();
  const { count, error: rlError } = await sb
    .from("wf_api_access_logs")
    .select("id", { head: true, count: "exact" })
    .eq("client_id", client.id)
    .gte("created_at", windowStart);

  if (rlError) return { client: null, error: `Erro ao validar rate limit: ${rlError.message}`, status: 500 };

  const limit = client.rate_limit_per_minute || 60;
  if ((count ?? 0) >= limit) {
    return { client: null, error: `Rate limit excedido (${limit}/min)`, status: 429 };
  }

  return { client };
}

async function handleRdoSummary(sb: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const obra = url.searchParams.get("obra");
  const turno = url.searchParams.get("turno");
  const status = url.searchParams.get("status");

  let q = sb
    .from("rdo_diarios")
    .select("id,data,obra_nome,tipo_rdo,turno,status_validacao,preenchido_por,encarregado", { count: "exact" })
    .eq("company_id", companyId)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: true });

  if (obra) q = q.ilike("obra_nome", `%${obra.trim()}%`);
  if (turno) q = q.eq("turno", turno);
  if (status) q = q.eq("status_validacao", status);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const grouped: Record<string, any> = {};
  for (const row of data || []) {
    const key = `${row.data}|${row.obra_nome}|${row.tipo_rdo}|${row.turno}`;
    if (!grouped[key]) {
      grouped[key] = {
        data: row.data,
        obra_nome: row.obra_nome,
        tipo_rdo: row.tipo_rdo,
        turno: row.turno,
        total_rdos: 0,
        enviados: 0,
        pendentes: 0,
      };
    }
    grouped[key].total_rdos += 1;
    if ((row.status_validacao || "").toLowerCase() === "aprovado") grouped[key].enviados += 1;
    else grouped[key].pendentes += 1;
  }

  return {
    total: count ?? 0,
    rows: Object.values(grouped),
  };
}

async function handleRdoDetails(sb: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const obra = url.searchParams.get("obra");
  const encarregado = url.searchParams.get("encarregado");
  const engenheiro = url.searchParams.get("engenheiro_responsavel");
  const status = url.searchParams.get("status");
  const { page, pageSize, offset } = parsePage(url);

  let q = sb
    .from("rdo_diarios")
    .select(
      "id,data,obra_nome,tipo_rdo,turno,clima,preenchido_por,encarregado,engenheiro_responsavel,status_validacao,validado_em,observacoes_gerais",
      { count: "exact" },
    )
    .eq("company_id", companyId)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (obra) q = q.ilike("obra_nome", `%${obra.trim()}%`);
  if (encarregado) q = q.ilike("encarregado", `%${encarregado.trim()}%`);
  if (engenheiro) q = q.ilike("engenheiro_responsavel", `%${engenheiro.trim()}%`);
  if (status) q = q.eq("status_validacao", status);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  return { total: count ?? 0, page, page_size: pageSize, rows: data || [] };
}

async function handleEquipamentosUtilizacao(sb: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const categoria = url.searchParams.get("categoria");
  const tipo = url.searchParams.get("tipo");
  const frota = url.searchParams.get("frota");
  const obra = url.searchParams.get("obra");

  const { data: rdos, error: rdoErr } = await sb
    .from("rdo_diarios")
    .select("id,data,obra_nome")
    .eq("company_id", companyId)
    .gte("data", start)
    .lte("data", end);
  if (rdoErr) throw new Error(rdoErr.message);
  if (!rdos?.length) return { total: 0, rows: [] };

  const rdoIds = rdos.map((r: any) => r.id);
  const rdoMap = new Map<string, any>(rdos.map((r: any) => [r.id, r]));

  let eqQuery = sb
    .from("rdo_equipamentos")
    .select("id,rdo_id,frota,categoria,tipo,sub_tipo,empresa_dona")
    .eq("company_id", companyId)
    .in("rdo_id", rdoIds);

  if (categoria) eqQuery = eqQuery.eq("categoria", categoria);
  if (tipo) eqQuery = eqQuery.eq("tipo", tipo);
  if (frota) eqQuery = eqQuery.eq("frota", frota);

  const { data: equipamentos, error: eqErr } = await eqQuery;
  if (eqErr) throw new Error(eqErr.message);

  const grouped: Record<string, any> = {};
  for (const row of equipamentos || []) {
    const rdo = rdoMap.get(row.rdo_id);
    if (!rdo) continue;
    if (obra && !(rdo.obra_nome || "").toLowerCase().includes(obra.toLowerCase())) continue;

    const key = `${row.frota}|${row.categoria}|${row.tipo}|${row.sub_tipo}|${row.empresa_dona}`;
    if (!grouped[key]) {
      grouped[key] = {
        frota: row.frota,
        categoria: row.categoria,
        tipo: row.tipo,
        sub_tipo: row.sub_tipo,
        empresa_dona: row.empresa_dona,
        dias_com_lancamento: new Set<string>(),
        total_lancamentos: 0,
      };
    }
    grouped[key].total_lancamentos += 1;
    grouped[key].dias_com_lancamento.add(rdo.data);
  }

  const rows = Object.values(grouped).map((g: any) => ({
    frota: g.frota,
    categoria: g.categoria,
    tipo: g.tipo,
    sub_tipo: g.sub_tipo,
    empresa_dona: g.empresa_dona,
    total_lancamentos: g.total_lancamentos,
    dias_com_lancamento: g.dias_com_lancamento.size,
  }));

  return { total: rows.length, rows };
}

async function handleAbastecimentoConsumo(sb: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const frota = url.searchParams.get("frota");
  const comboio = url.searchParams.get("comboio_fleet");

  let q = sb
    .from("abastecimentos")
    .select("id,data,equipment_fleet,equipment_type,litros,comboio_fleet,fornecedor,ogs", { count: "exact" })
    .eq("company_id", companyId)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false });

  if (frota) q = q.eq("equipment_fleet", frota);
  if (comboio) q = q.eq("comboio_fleet", comboio);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  const totalLitros = (data || []).reduce((sum: number, row: any) => sum + safeNumber(row.litros), 0);

  const comboios = [...new Set((data || []).map((r: any) => r.comboio_fleet).filter(Boolean))];
  let saldos: any[] = [];
  if (comboios.length > 0) {
    const { data: saldoData, error: saldoErr } = await sb
      .from("comboio_saldo")
      .select("comboio_fleet,saldo_atual,updated_at")
      .eq("company_id", companyId)
      .in("comboio_fleet", comboios);
    if (saldoErr) throw new Error(saldoErr.message);
    saldos = saldoData || [];
  }

  return {
    total: count ?? 0,
    total_litros: Number(totalLitros.toFixed(2)),
    saldos_comboio: saldos,
    rows: data || [],
  };
}

async function handleProducao(
  sb: ReturnType<typeof createClient>,
  companyId: string,
  url: URL,
  tipoRdo: "INFRAESTRUTURA" | "CAUQ",
) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const obra = url.searchParams.get("obra");
  const servico = url.searchParams.get("tipo_servico");
  const { page, pageSize, offset } = parsePage(url);

  let rdoQ = sb
    .from("rdo_diarios")
    .select("id,data,obra_nome,preenchido_por,encarregado", { count: "exact" })
    .eq("company_id", companyId)
    .eq("tipo_rdo", tipoRdo)
    .gte("data", start)
    .lte("data", end);

  if (obra) rdoQ = rdoQ.ilike("obra_nome", `%${obra.trim()}%`);

  const { data: rdos, error: rdoErr, count } = await rdoQ;
  if (rdoErr) throw new Error(rdoErr.message);
  if (!rdos?.length) return { total: 0, page, page_size: pageSize, rows: [] };

  const rdoIds = rdos.map((r: any) => r.id);
  const rdoMap = new Map<string, any>(rdos.map((r: any) => [r.id, r]));

  let prodQ = sb
    .from("rdo_producao")
    .select("id,rdo_id,tipo_servico,sentido,sentido_faixa,comprimento_m,largura_m,espessura_cm,area_m2,volume_m3,tonelagem")
    .eq("company_id", companyId)
    .in("rdo_id", rdoIds)
    .range(offset, offset + pageSize - 1);

  if (servico) prodQ = prodQ.ilike("tipo_servico", `%${servico.trim()}%`);

  const { data: prods, error: prodErr } = await prodQ;
  if (prodErr) throw new Error(prodErr.message);

  const ogsNumbers = [...new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean))];
  const { data: ogs } = await sb
    .from("ogs_reference")
    .select("ogs_number,location_address")
    .eq("company_id", companyId)
    .in("ogs_number", ogsNumbers);
  const ogsMap = new Map((ogs || []).map((o: any) => [o.ogs_number, o.location_address]));

  const rows = (prods || []).map((p: any) => {
    const rdo = rdoMap.get(p.rdo_id);
    return {
      id: p.id,
      data: rdo?.data,
      obra_nome: rdo?.obra_nome,
      local: ogsMap.get(rdo?.obra_nome) || null,
      apontador: rdo?.preenchido_por || rdo?.encarregado || null,
      tipo_servico: p.tipo_servico,
      sentido_faixa: p.sentido_faixa || p.sentido,
      comprimento_m: safeNumber(p.comprimento_m),
      largura_m: safeNumber(p.largura_m),
      espessura_cm: safeNumber(p.espessura_cm),
      area_m2: safeNumber(p.area_m2),
      volume_m3: safeNumber(p.volume_m3),
      tonelagem: safeNumber(p.tonelagem),
    };
  });

  return { total: count ?? 0, page, page_size: pageSize, rows };
}

async function handleTransportesPerformance(sb: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const start = url.searchParams.get("start_date")!;
  const end = url.searchParams.get("end_date")!;
  const frota = url.searchParams.get("frota");
  const { page, pageSize, offset } = parsePage(url);

  let q = sb
    .from("equipment_diaries")
    .select("id,date,equipment_fleet,operator_name,period,odometer_initial,odometer_final,attachment_type", { count: "exact" })
    .eq("company_id", companyId)
    .eq("equipment_type", "Carreta")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (frota) q = q.ilike("equipment_fleet", `%${frota.trim()}%`);

  const { data: diaries, error, count } = await q;
  if (error) throw new Error(error.message);

  if (!diaries?.length) return { total: 0, page, page_size: pageSize, rows: [] };

  const diaryIds = diaries.map((d: any) => d.id);
  const { data: entries, error: entryErr } = await sb
    .from("equipment_time_entries")
    .select("id,diary_id,start_time,end_time,activity,origin,destination,ogs_destination")
    .eq("company_id", companyId)
    .in("diary_id", diaryIds);
  if (entryErr) throw new Error(entryErr.message);

  const countByDiary: Record<string, number> = {};
  for (const e of entries || []) {
    countByDiary[e.diary_id] = (countByDiary[e.diary_id] || 0) + 1;
  }

  const rows = (diaries || []).map((d: any) => {
    const kmIni = safeNumber(d.odometer_initial);
    const kmFim = safeNumber(d.odometer_final);
    return {
      id: d.id,
      data: d.date,
      frota: d.equipment_fleet,
      operador: d.operator_name,
      turno: d.period,
      prancha: d.attachment_type,
      km_inicial: kmIni,
      km_final: kmFim,
      km_percorrido: kmFim > kmIni ? Number((kmFim - kmIni).toFixed(2)) : 0,
      total_viagens: countByDiary[d.id] || 0,
    };
  });

  return { total: count ?? 0, page, page_size: pageSize, rows };
}

async function insertAccessLog(
  sb: ReturnType<typeof createClient>,
  payload: {
    clientId?: string | null;
    companyId: string;
    reportKey: string;
    statusCode: number;
    durationMs: number;
    rowCount?: number;
    requestPath: string;
    query: Record<string, string>;
    errorMessage?: string;
  },
) {
  await sb.from("wf_api_access_logs").insert({
    client_id: payload.clientId,
    company_id: payload.companyId,
    report_key: payload.reportKey,
    status_code: payload.statusCode,
    duration_ms: payload.durationMs,
    row_count: payload.rowCount ?? null,
    request_path: payload.requestPath,
    query: payload.query,
    error_message: payload.errorMessage ?? null,
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse(405, { error: "Método não suportado. Use GET." });
  }

  const startedAt = Date.now();
  const url = new URL(req.url);
  const reportKey = normalizeReportKey(url);
  const companyId = url.searchParams.get("company_id")?.trim() || "";

  const requestQuery: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    requestQuery[key] = value;
  });

  if (!companyId) return jsonResponse(400, { error: "Parâmetro obrigatório: company_id" });
  if (!reportKey || !REPORT_KEYS.has(reportKey)) {
    return jsonResponse(404, { error: "Relatório não encontrado", available_reports: [...REPORT_KEYS] });
  }

  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  const a = parseDate(startDate);
  const b = parseDate(endDate);
  if (!a || !b) return jsonResponse(400, { error: "Parâmetros obrigatórios: start_date e end_date (YYYY-MM-DD)" });

  if (daysBetween(a, b) > MAX_RANGE_DAYS) {
    return jsonResponse(400, { error: `Janela de consulta excedida. Máximo permitido: ${MAX_RANGE_DAYS} dias` });
  }

  const apiKey = req.headers.get("x-api-key")?.trim() || "";
  if (!apiKey) return jsonResponse(401, { error: "Header obrigatório: x-api-key" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRole);

  const auth = await authenticate(sb, apiKey, companyId, reportKey);
  if (auth.error || !auth.client) {
    await insertAccessLog(sb, {
      companyId,
      reportKey,
      statusCode: auth.status ?? 401,
      durationMs: Date.now() - startedAt,
      requestPath: url.pathname,
      query: requestQuery,
      errorMessage: auth.error,
    }).catch(() => null);
    return jsonResponse(auth.status ?? 401, { error: auth.error });
  }

  let statusCode = 200;
  let responseRows = 0;

  try {
    let result: any;

    switch (reportKey) {
      case "rdo-fremix":
        result = await handleRdoFremix(sb, companyId, url);
        break;
      case "rdo/summary":
        result = await handleRdoSummary(sb, companyId, url);
        break;
      case "rdo/details":
        result = await handleRdoDetails(sb, companyId, url);
        break;
      case "equipamentos/utilizacao":
        result = await handleEquipamentosUtilizacao(sb, companyId, url);
        break;
      case "abastecimento/consumo":
        result = await handleAbastecimentoConsumo(sb, companyId, url);
        break;
      case "producao/infra":
        result = await handleProducao(sb, companyId, url, "INFRAESTRUTURA");
        break;
      case "producao/pavimentacao":
        result = await handleProducao(sb, companyId, url, "CAUQ");
        break;
      case "transportes/performance":
        result = await handleTransportesPerformance(sb, companyId, url);
        break;
      default:
        statusCode = 404;
        result = { error: "Relatório não suportado" };
        break;
    }

    responseRows = Array.isArray(result?.rows) ? result.rows.length : 0;

    await sb
      .from("wf_api_clients")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", auth.client.id);

    await insertAccessLog(sb, {
      clientId: auth.client.id,
      companyId,
      reportKey,
      statusCode,
      durationMs: Date.now() - startedAt,
      rowCount: responseRows,
      requestPath: url.pathname,
      query: requestQuery,
    }).catch(() => null);

    return jsonResponse(statusCode, {
      meta: {
        report: reportKey,
        company_id: companyId,
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      },
      data: result,
    });
  } catch (err: any) {
    statusCode = 500;

    await insertAccessLog(sb, {
      clientId: auth.client.id,
      companyId,
      reportKey,
      statusCode,
      durationMs: Date.now() - startedAt,
      requestPath: url.pathname,
      query: requestQuery,
      errorMessage: err?.message || "Erro interno",
    }).catch(() => null);

    return jsonResponse(500, {
      error: "Falha ao processar relatório",
      detail: err?.message || "Erro interno",
    });
  }
});
