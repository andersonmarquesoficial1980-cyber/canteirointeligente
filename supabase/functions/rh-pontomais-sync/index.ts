import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type GenericRow = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, payload: Json) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeDoc(value: string): string {
  const raw = String(value || "").replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) {
    const semZero = raw.replace(/^0+/, "");
    return semZero || "0";
  }
  return raw;
}

function toNumberHours(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

  const raw = String(value).trim();
  if (!raw || raw === "-") return 0;

  const signal = raw.startsWith("-") ? -1 : 1;
  const stripped = raw.replace(/^[-+]/, "");

  // formato HH:MM
  const hhmm = stripped.match(/^(\d{1,3}):(\d{2})$/);
  if (hhmm) {
    const hh = Number(hhmm[1] || 0);
    const mm = Number(hhmm[2] || 0);
    return Number(((signal * (hh + (mm / 60)))).toFixed(2));
  }

  // formato decimal pt-BR/en-US
  const dec = stripped.includes(",")
    ? stripped.replace(/\./g, "").replace(",", ".")
    : stripped;
  const num = Number(dec);
  if (Number.isFinite(num)) return Number((signal * num).toFixed(2));

  return 0;
}

function isManager(profile: { role?: string | null; perfil?: string | null }) {
  if ((profile.role || "").toLowerCase() === "superadmin") return true;
  if ((profile.role || "").toLowerCase() === "admin") return true;
  return ["Administrador", "Gerente", "RH", "Gestão de Pessoas"].includes(profile.perfil || "");
}

function extractReportRows(
  upstreamPayload: unknown,
  fixedHeaders: string[] = [
    "name",
    "registration_number",
    "date",
    "extra_time",
    "missing_time",
    "interval_time",
    "regular_time",
    "time_balance",
  ],
): GenericRow[] {
  const payload = (upstreamPayload && typeof upstreamPayload === "object")
    ? (upstreamPayload as Record<string, unknown>)
    : {};

  const data = payload.data;
  if (!Array.isArray(data)) return [];

  if (data.length === 0) return [];

  // Cenário 1: já veio como objeto
  if (typeof data[0] === "object" && !Array.isArray(data[0]) && data[0] !== null) {
    return data as GenericRow[];
  }

  // Cenário 2: matriz (array de arrays)
  const matrix = data as unknown[];

  let rows: unknown[][] = [];
  let headers = fixedHeaders;

  const first = matrix[0];
  if (Array.isArray(first) && first.length > 0) {
    const firstNorm = first.map((v) => normalizeText(String(v ?? "")));
    const looksHeader = firstNorm.includes("name") || firstNorm.includes("nome") || firstNorm.includes("employee_name");
    if (looksHeader) {
      headers = first.map((v) => normalizeText(String(v ?? "")).replace(/\s+/g, "_"));
      rows = matrix.slice(1).filter((r) => Array.isArray(r)) as unknown[][];
    } else {
      rows = matrix.filter((r) => Array.isArray(r)) as unknown[][];
    }
  }

  return rows
    .filter((row) => row.some((v) => String(v ?? "").trim() !== ""))
    .map((row) => {
      const obj: GenericRow = {};
      headers.forEach((h, idx) => { obj[h] = row[idx]; });
      return obj;
    });
}

function toIsoDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(?:[A-Za-zÀ-ÿ]{3},\s*)?(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function extractTimeMarks(value: unknown): string[] {
  let candidates: string[] = [];

  if (Array.isArray(value)) {
    candidates = value
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const obj = item as Record<string, unknown>;
        return String(obj.csv_value || obj.value || "");
      })
      .filter(Boolean);
  } else {
    const raw = String(value || "");
    if (raw) {
      candidates = (raw.match(/\b\d{1,2}:\d{2}\b/g) || []);
    }
  }

  return candidates
    .map((t) => String(t).trim())
    .map((t) => t.split(":").map(Number))
    .filter(([h, m]) => Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h < 24 && m >= 0 && m < 60)
    .map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

function expandNestedRows(rows: GenericRow[]): GenericRow[] {
  const out: GenericRow[] = [];
  for (const row of rows) {
    const asObj = (row && typeof row === "object") ? (row as Record<string, unknown>) : {};

    const parentCtx: Record<string, unknown> = {
      employee_name: asObj.employee_name ?? asObj.name ?? null,
      registration_number: asObj.registration_number ?? asObj.matricula ?? null,
      team_name: asObj.team_name ?? asObj.team ?? null,
    };

    const mergeCtx = (child: GenericRow): GenericRow => ({
      ...parentCtx,
      ...child,
      employee_name: child.employee_name ?? child.name ?? parentCtx.employee_name,
      registration_number: child.registration_number ?? child.matricula ?? parentCtx.registration_number,
      team_name: child.team_name ?? child.team ?? parentCtx.team_name,
    });

    if (Array.isArray(asObj.data)) {
      out.push(...(asObj.data as GenericRow[]).map(mergeCtx));
      continue;
    }

    const dateObj = asObj.date;
    if (dateObj && typeof dateObj === "object" && Array.isArray((dateObj as Record<string, unknown>).data)) {
      out.push(...(((dateObj as Record<string, unknown>).data as GenericRow[]).map(mergeCtx)));
      continue;
    }

    out.push(row);
  }
  return out;
}

function minuteOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60) + m;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Método não permitido" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Configuração do Supabase ausente no ambiente" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(401, { ok: false, error: "Token de autenticação ausente" });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(401, { ok: false, error: "Usuário não autenticado" });
    }

    const body = await req.json().catch(() => ({}));
    const companyId = String(body?.company_id || "").trim();
    const competencia = String(body?.competencia || "").trim();
    // Segurança operacional: por padrão, sempre importa.
    // Só aceita dry-run quando explicitamente solicitado com force_dry_run=true.
    const dryRun = body?.dry_run === true && body?.force_dry_run === true;

    if (!companyId || !competencia) {
      return jsonResponse(400, { ok: false, error: "company_id e competencia são obrigatórios" });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("company_id, role, perfil")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse(403, { ok: false, error: "Perfil não encontrado" });
    }

    const isSuperAdmin = (profile.role || "").toLowerCase() === "superadmin";
    const sameCompany = profile.company_id === companyId;
    if (!isSuperAdmin && !sameCompany) {
      return jsonResponse(403, { ok: false, error: "Sem permissão para esta empresa" });
    }
    if (!isManager(profile)) {
      return jsonResponse(403, { ok: false, error: "Sem permissão de gestão para sincronizar" });
    }

    const baseUrl = String(body?.base_url || Deno.env.get("PONTOMAIS_BASE_URL") || "https://api.pontomais.com.br").trim();
    const endpointPath = String(body?.endpoint_path || Deno.env.get("PONTOMAIS_ENDPOINT_PATH") || "/external_api/v1/reports/time_balances").trim();
    const token = String(Deno.env.get("PONTOMAIS_TOKEN") || "").trim();
    const authHeaderName = String(Deno.env.get("PONTOMAIS_AUTH_HEADER") || "access-token").trim();
    const authPrefix = String(Deno.env.get("PONTOMAIS_AUTH_PREFIX") || "");

    if (!token) {
      return jsonResponse(400, {
        ok: false,
        error: "Integração não configurada. Defina o secret PONTOMAIS_TOKEN",
      });
    }

    const startDate = `${competencia.slice(0, 7)}-01`;
    const [yy, mm] = competencia.slice(0, 7).split("-").map(Number);
    const endDate = `${yy}-${String(mm).padStart(2, "0")}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;

    const endpoint = new URL(endpointPath, baseUrl);
    const reportBody = {
      report: {
        start_date: startDate,
        end_date: endDate,
        group_by: "team",
        row_filters: "",
        columns: "name,registration_number,date,extra_time,missing_time,interval_time,regular_time,time_balance",
        format: "json",
      },
    };

    const upstreamResp = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        [authHeaderName]: `${authPrefix}${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(reportBody),
    });

    const raw = await upstreamResp.text();
    let upstreamPayload: unknown = raw;
    try {
      upstreamPayload = JSON.parse(raw);
    } catch {
      upstreamPayload = { raw };
    }

    if (!upstreamResp.ok) {
      await adminClient
        .from("pontomais_sync_runs")
        .insert({
          company_id: companyId,
          competencia: startDate,
          status: "erro",
          endpoint: endpoint.toString(),
          http_status: upstreamResp.status,
          items_count: 0,
          payload: { dry_run: dryRun, report_body: reportBody, upstream: upstreamPayload },
          error_message: `Falha HTTP ${upstreamResp.status}`,
          created_by: authData.user.id,
        });

      return jsonResponse(502, {
        ok: false,
        error: `Falha ao consultar API PontoMais (${upstreamResp.status})`,
        http_status: upstreamResp.status,
      });
    }

    let reportRows = expandNestedRows(extractReportRows(upstreamPayload, [
      "name",
      "registration_number",
      "date",
      "extra_time",
      "missing_time",
      "interval_time",
      "regular_time",
      "time_balance",
    ]));
    let rowSource = "report_time_balances";

    // Fallback 1: tentar relatório de horas extras quando time_balances vier vazio.
    if (reportRows.length === 0) {
      const extraEndpoint = new URL("/external_api/v1/reports/extra_times", baseUrl);
      const extraBody = {
        report: {
          start_date: startDate,
          end_date: endDate,
          group_by: "team",
          row_filters: "",
          columns: "employee_name,registration_number,team_name,date,time_cards,regular_time,extra_time,motive",
          format: "json",
        },
      };

      const extraResp = await fetch(extraEndpoint.toString(), {
        method: "POST",
        headers: {
          [authHeaderName]: `${authPrefix}${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(extraBody),
      });

      if (extraResp.ok) {
        const extraPayload = await extraResp.json().catch(() => ({}));
        const extraRows = expandNestedRows(extractReportRows(extraPayload, [
          "employee_name",
          "registration_number",
          "team_name",
          "date",
          "time_cards",
          "regular_time",
          "extra_time",
          "motive",
        ]));
        if (extraRows.length > 0) {
          reportRows = extraRows;
          rowSource = "report_extra_times";
        }
      }
    }

    // Fallback 2: se ainda vazio, cria base com colaboradores ativos da API
    // para exibir o mês no WF mesmo sem lançamentos de banco no período.
    if (reportRows.length === 0) {
      const empEndpoint = new URL("/external_api/v1/employees", baseUrl);
      empEndpoint.searchParams.set("active", "true");
      empEndpoint.searchParams.set("count", "true");
      empEndpoint.searchParams.set("page", "1");
      empEndpoint.searchParams.set("per_page", "500");

      const empResp = await fetch(empEndpoint.toString(), {
        method: "GET",
        headers: {
          [authHeaderName]: `${authPrefix}${token}`,
          Accept: "application/json",
        },
      });

      if (empResp.ok) {
        const empJson = await empResp.json().catch(() => ({}));
        const pmEmployees = Array.isArray(empJson?.employees)
          ? empJson.employees as Array<Record<string, unknown>>
          : [];

        reportRows = pmEmployees
          .map((e) => ({
            name: String(e.name || "").trim(),
            registration_number: String(e.registration_number || "").trim(),
            team_name: String((e.team as Record<string, unknown> | undefined)?.name || "").trim(),
            extra_time: 0,
            missing_time: 0,
            regular_time: 0,
            time_balance: 0,
          }))
          .filter((r) => r.name);

        if (reportRows.length > 0) {
          rowSource = "employees_fallback_zero_balances";
        }
      }
    }

    const { data: employeesData } = await adminClient
      .from("employees")
      .select("id, name, matricula")
      .eq("company_id", companyId);

    const employees = (employeesData || []) as Array<{ id: string; name: string | null; matricula: string | null }>;
    const employeeIdByName = new Map<string, string>();
    const employeeIdByMatricula = new Map<string, string>();

    for (const e of employees) {
      if (e.name) employeeIdByName.set(normalizeText(e.name), e.id);
      if (e.matricula) employeeIdByMatricula.set(normalizeDoc(e.matricula), e.id);
    }

    const resolveEmployeeId = (row: GenericRow): string | null => {
      const nome = String(row.employee_name ?? row.name ?? row.employee ?? "").trim();
      const registration = String(row.registration_number ?? row.matricula ?? "").trim();
      const byMat = registration ? employeeIdByMatricula.get(normalizeDoc(registration)) : undefined;
      if (byMat) return byMat;
      const byName = nome ? employeeIdByName.get(normalizeText(nome)) : undefined;
      return byName || null;
    };

    let punchesInserted = 0;
    let punchesRowsRead = 0;
    let punchesSkipNoEmployee = 0;
    let punchesSkipNoDate = 0;
    let punchesSkipFewMarks = 0;

    // Tentativa de importar batidas detalhadas do PontoMais para preencher ponto_registros.
    const timeCardsEndpoint = new URL("/external_api/v1/reports/time_cards", baseUrl);
    const timeCardsBody = {
      report: {
        start_date: startDate,
        end_date: endDate,
        group_by: "team",
        row_filters: "",
        columns: "employee_name,registration_number,team_name,date,time_cards,regular_time,extra_time,missing_time",
        format: "json",
      },
    };

    let timeCardsRows: GenericRow[] = [];
    const tcResp = await fetch(timeCardsEndpoint.toString(), {
      method: "POST",
      headers: {
        [authHeaderName]: `${authPrefix}${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(timeCardsBody),
    });

    if (tcResp.ok) {
      const tcPayload = await tcResp.json().catch(() => ({}));
      timeCardsRows = expandNestedRows(extractReportRows(tcPayload, [
        "employee_name",
        "registration_number",
        "team_name",
        "date",
        "time_cards",
        "regular_time",
        "extra_time",
        "missing_time",
      ]));
    }

    // Preferimos as linhas já normalizadas do extra_times quando essa for a fonte do resumo.
    // O endpoint time_cards pode retornar estrutura inconsistente para batidas detalhadas.
    if (rowSource === "report_extra_times" && reportRows.length > 0) {
      timeCardsRows = reportRows;
    }

    // fallback pragmático: usar linhas do extra_times quando vierem com time_cards
    if (timeCardsRows.length === 0 && rowSource === "report_extra_times") {
      timeCardsRows = reportRows.filter((r) => String(r.time_cards || "").trim() !== "");
    }

    punchesRowsRead = timeCardsRows.length;

    if (!dryRun && timeCardsRows.length > 0) {
      const { data: existingRegsData } = await adminClient
        .from("ponto_registros")
        .select("staff_id, data, hora, tipo")
        .eq("company_id", companyId)
        .gte("data", startDate)
        .lte("data", endDate);

      const existingRegs = (existingRegsData || []) as Array<{ staff_id: string; data: string; hora: string; tipo: string }>;
      const existingKeys = new Set(existingRegs.map((r) => `${r.staff_id}|${r.data}|${String(r.hora).slice(0, 5)}|${r.tipo}`));

      const punchInserts: Array<Record<string, unknown>> = [];
      const stagedKeys = new Set<string>();

      for (const row of timeCardsRows) {
        const employeeId = resolveEmployeeId(row);
        if (!employeeId) {
          punchesSkipNoEmployee += 1;
          continue;
        }
        const dateIso = toIsoDate(row.date);
        if (!dateIso) {
          punchesSkipNoDate += 1;
          continue;
        }
        const marks = extractTimeMarks(row.time_cards);
        if (marks.length < 2) {
          punchesSkipFewMarks += 1;
          continue;
        }

        for (let i = 0; i < marks.length; i += 1) {
          const hhmm = marks[i];
          const tipo = i % 2 === 0 ? "entrada" : "saida";
          const key = `${employeeId}|${dateIso}|${hhmm}|${tipo}`;
          if (existingKeys.has(key) || stagedKeys.has(key)) continue;
          stagedKeys.add(key);

          punchInserts.push({
            company_id: companyId,
            staff_id: employeeId,
            data: dateIso,
            hora: `${hhmm}:00`,
            tipo,
            turno: null,
            metodo: "pontomais_sync",
          });
        }
      }

      if (punchInserts.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < punchInserts.length; i += chunkSize) {
          const chunk = punchInserts.slice(i, i + chunkSize);
          const { error: insErr } = await adminClient.from("ponto_registros").insert(chunk);
          if (insErr) {
            return jsonResponse(500, { ok: false, error: `Falha ao importar batidas PontoMais: ${insErr.message}` });
          }
        }
      }

      punchesInserted = punchInserts.length;
    }

    const aggregated = new Map<string, {
      colaborador_nome: string;
      registration_number: string;
      equipe_nome: string | null;
      credito_horas: number;
      debito_horas: number;
      horas_normais: number;
      total_horas_extras_horas: number;
      rows: GenericRow[];
      employee_id: string | null;
    }>();

    for (const row of reportRows) {
      const nome = String(row.name ?? row.employee_name ?? row.employee ?? "").trim();
      if (!nome || nome.includes("[object")) continue;

      const registration = String(row.registration_number ?? row.matricula ?? "").trim();
      const team = String(row.team_name ?? row.team ?? row.group ?? "").trim() || null;

      const extra = Math.max(0, toNumberHours(row.extra_time));
      const missing = Math.max(0, toNumberHours(row.missing_time));
      const regular = Math.max(0, toNumberHours(row.regular_time));

      const key = `${normalizeText(nome)}|${normalizeDoc(registration)}`;
      if (!aggregated.has(key)) {
        const employeeId = (registration && employeeIdByMatricula.get(normalizeDoc(registration)))
          || employeeIdByName.get(normalizeText(nome))
          || null;

        aggregated.set(key, {
          colaborador_nome: nome,
          registration_number: registration,
          equipe_nome: team,
          credito_horas: 0,
          debito_horas: 0,
          horas_normais: 0,
          total_horas_extras_horas: 0,
          rows: [],
          employee_id: employeeId,
        });
      }

      const acc = aggregated.get(key)!;
      acc.credito_horas = Number((acc.credito_horas + extra).toFixed(2));
      acc.debito_horas = Number((acc.debito_horas + missing).toFixed(2));
      acc.horas_normais = Number((acc.horas_normais + regular).toFixed(2));
      acc.total_horas_extras_horas = Number((acc.total_horas_extras_horas + extra).toFixed(2));
      if (!acc.equipe_nome && team) acc.equipe_nome = team;
      acc.rows.push(row);
    }

    // Se veio apenas fallback zerado, recalcula resumo a partir de ponto_registros do mês.
    if (rowSource === "employees_fallback_zero_balances") {
      const { data: regsData } = await adminClient
        .from("ponto_registros")
        .select("staff_id, data, hora, tipo")
        .eq("company_id", companyId)
        .gte("data", startDate)
        .lte("data", endDate)
        .order("staff_id")
        .order("data")
        .order("hora");

      const regs = (regsData || []) as Array<{ staff_id: string; data: string; hora: string; tipo: string }>;
      if (regs.length > 0) {
        const employeeById = new Map(employees.map((e) => [e.id, e]));
        const teamByName = new Map<string, string>();
        for (const row of reportRows) {
          const nome = String(row.name ?? row.employee_name ?? row.employee ?? "").trim();
          const team = String(row.team_name ?? row.team ?? row.group ?? "").trim();
          if (nome && team && !teamByName.has(normalizeText(nome))) {
            teamByName.set(normalizeText(nome), team);
          }
        }

        const byStaffDate = new Map<string, { entradas: string[]; saidas: string[] }>();
        for (const r of regs) {
          const key = `${r.staff_id}|${r.data}`;
          if (!byStaffDate.has(key)) byStaffDate.set(key, { entradas: [], saidas: [] });
          const hour = String(r.hora).slice(0, 5);
          if (r.tipo === "entrada") byStaffDate.get(key)!.entradas.push(hour);
          if (r.tipo === "saida") byStaffDate.get(key)!.saidas.push(hour);
        }

        const recalc = new Map<string, {
          colaborador_nome: string;
          registration_number: string;
          equipe_nome: string | null;
          credito_horas: number;
          debito_horas: number;
          horas_normais: number;
          total_horas_extras_horas: number;
          rows: GenericRow[];
          employee_id: string | null;
        }>();

        for (const [key, value] of byStaffDate.entries()) {
          const [staffId] = key.split("|");
          const entradas = value.entradas.sort((a, b) => minuteOfDay(a) - minuteOfDay(b));
          const saidas = value.saidas.sort((a, b) => minuteOfDay(a) - minuteOfDay(b));
          const pairs = Math.min(entradas.length, saidas.length);
          if (pairs <= 0) continue;

          let totalMin = 0;
          for (let i = 0; i < pairs; i += 1) {
            let diff = minuteOfDay(saidas[i]) - minuteOfDay(entradas[i]);
            if (diff < 0) diff += 24 * 60;
            totalMin += diff;
          }

          const worked = Number((totalMin / 60).toFixed(2));
          const credito = Math.max(Number((worked - 8).toFixed(2)), 0);
          const debito = Math.max(Number((8 - worked).toFixed(2)), 0);
          const normais = Math.max(Number((Math.min(worked, 8)).toFixed(2)), 0);

          const employee = employeeById.get(staffId);
          const nome = (employee?.name || `STAFF ${staffId}`).trim();
          const registration = String(employee?.matricula || "").trim();
          const team = teamByName.get(normalizeText(nome)) || null;
          const sumKey = `${normalizeText(nome)}|${normalizeDoc(registration)}`;

          if (!recalc.has(sumKey)) {
            recalc.set(sumKey, {
              colaborador_nome: nome,
              registration_number: registration,
              equipe_nome: team,
              credito_horas: 0,
              debito_horas: 0,
              horas_normais: 0,
              total_horas_extras_horas: 0,
              rows: [],
              employee_id: staffId,
            });
          }

          const acc = recalc.get(sumKey)!;
          acc.credito_horas = Number((acc.credito_horas + credito).toFixed(2));
          acc.debito_horas = Number((acc.debito_horas + debito).toFixed(2));
          acc.horas_normais = Number((acc.horas_normais + normais).toFixed(2));
          acc.total_horas_extras_horas = Number((acc.total_horas_extras_horas + credito).toFixed(2));
        }

        if (recalc.size > 0) {
          aggregated.clear();
          for (const [k, v] of recalc.entries()) aggregated.set(k, v);
          rowSource = "ponto_registros_recalc";
        }
      }
    }

    const upsertRows = Array.from(aggregated.values()).map((item) => ({
      company_id: companyId,
      employee_id: item.employee_id,
      competencia: startDate,
      periodo_inicio: startDate,
      periodo_fim: endDate,
      colaborador_nome: item.colaborador_nome,
      equipe_nome: item.equipe_nome,
      fonte_pdf: null,
      credito_horas: item.credito_horas,
      debito_horas: item.debito_horas,
      horas_normais: item.horas_normais,
      he_70_horas: item.total_horas_extras_horas,
      he_100_horas: 0,
      adicional_noturno_horas: 0,
      total_horas_extras_horas: item.total_horas_extras_horas,
      payload: {
        source: `pontomais_api_${rowSource}`,
        row_source: rowSource,
        registration_number: item.registration_number,
        rows_count: item.rows.length,
        sample_rows: item.rows.slice(0, 3),
        imported_at: new Date().toISOString(),
      },
    }));

    if (!dryRun) {
      await adminClient
        .from("ponto_he_resumo_mensal")
        .delete()
        .eq("company_id", companyId)
        .eq("competencia", startDate)
        .ilike("colaborador_nome", "[object%");

      // Quando vier dado real da API, remove lixo de fallback zerado antigo
      // para não misturar 445 linhas zeradas com poucos colaboradores importados.
      if (rowSource !== "employees_fallback_zero_balances" && upsertRows.length > 0) {
        await adminClient
          .from("ponto_he_resumo_mensal")
          .delete()
          .eq("company_id", companyId)
          .eq("competencia", startDate)
          .filter("payload->>row_source", "eq", "employees_fallback_zero_balances");
      }
    }

    if (!dryRun && upsertRows.length > 0) {
      const { error: upsertError } = await adminClient
        .from("ponto_he_resumo_mensal")
        .upsert(upsertRows, { onConflict: "company_id,competencia,colaborador_nome" });

      if (upsertError) {
        await adminClient
          .from("pontomais_sync_runs")
          .insert({
            company_id: companyId,
            competencia: startDate,
            status: "erro",
            endpoint: endpoint.toString(),
            http_status: upstreamResp.status,
            items_count: 0,
            payload: {
              dry_run: dryRun,
              report_body: reportBody,
              rows_lidas: reportRows.length,
              rows_agrupadas: upsertRows.length,
              upsert_error: upsertError.message,
            },
            error_message: `Falha no upsert: ${upsertError.message}`,
            created_by: authData.user.id,
          });

        return jsonResponse(500, {
          ok: false,
          error: `Falha ao gravar no banco: ${upsertError.message}`,
        });
      }
    }

    await adminClient
      .from("pontomais_sync_runs")
      .insert({
        company_id: companyId,
        competencia: startDate,
        status: "ok",
        endpoint: endpoint.toString(),
        http_status: upstreamResp.status,
        items_count: upsertRows.length,
        payload: {
          dry_run: dryRun,
          report_body: reportBody,
          rows_lidas: reportRows.length,
          row_source: rowSource,
          rows_agrupadas: upsertRows.length,
          punches_rows_lidas: punchesRowsRead,
          punches_inseridas: punchesInserted,
          punches_skip_no_employee: punchesSkipNoEmployee,
          punches_skip_no_date: punchesSkipNoDate,
          punches_skip_few_marks: punchesSkipFewMarks,
          sample: upsertRows.slice(0, 2),
          upstream_meta: (upstreamPayload as Record<string, unknown>)?.meta || null,
          upstream_heading: (upstreamPayload as Record<string, unknown>)?.heading || null,
        },
        error_message: null,
        created_by: authData.user.id,
      });

    return jsonResponse(200, {
      ok: true,
      dry_run: dryRun,
      competencia: startDate,
      endpoint: endpoint.toString(),
      rows_lidas: reportRows.length,
      rows_agrupadas: upsertRows.length,
      items_count: upsertRows.length,
      row_source: rowSource,
      punches_rows_lidas: punchesRowsRead,
      punches_inseridas: punchesInserted,
      punches_skip_no_employee: punchesSkipNoEmployee,
      punches_skip_no_date: punchesSkipNoDate,
      punches_skip_few_marks: punchesSkipFewMarks,
      imported_count: dryRun ? 0 : upsertRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse(500, { ok: false, error: message });
  }
});