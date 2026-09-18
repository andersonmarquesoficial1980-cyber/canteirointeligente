import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

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

function countItems(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "results", "items", "employees", "records"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v.length;
    }
  }
  return 0;
}

function isManager(profile: { role?: string | null; perfil?: string | null }, targetCompanyId: string) {
  if ((profile.role || "").toLowerCase() === "superadmin") return true;
  if ((profile.role || "").toLowerCase() === "admin") return true;
  return ["Administrador", "Gerente", "RH", "Gestão de Pessoas"].includes(profile.perfil || "")
    && Boolean(targetCompanyId);
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
    const dryRun = body?.dry_run !== false;

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
    if (!isManager(profile, companyId)) {
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

    const endpoint = new URL(endpointPath, baseUrl);

    const startDate = `${competencia.slice(0, 7)}-01`;
    const [yy, mm] = competencia.slice(0, 7).split("-").map(Number);
    const endDate = `${yy}-${String(mm).padStart(2, "0")}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;

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
        "Accept": "application/json",
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

    const itemsCount = countItems(upstreamPayload);

    await adminClient
      .from("pontomais_sync_runs")
      .insert({
        company_id: companyId,
        competencia,
        status: upstreamResp.ok ? "ok" : "erro",
        endpoint: endpoint.toString(),
        http_status: upstreamResp.status,
        items_count: itemsCount,
        payload: { dry_run: dryRun, upstream: upstreamPayload },
        error_message: upstreamResp.ok ? null : `Falha HTTP ${upstreamResp.status}`,
        created_by: authData.user.id,
      });

    if (!upstreamResp.ok) {
      return jsonResponse(502, {
        ok: false,
        error: `Falha ao consultar API PontoMais (${upstreamResp.status})`,
        http_status: upstreamResp.status,
      });
    }

    return jsonResponse(200, {
      ok: true,
      dry_run: dryRun,
      competencia,
      endpoint: endpoint.toString(),
      items_count: itemsCount,
      sample: Array.isArray(upstreamPayload)
        ? upstreamPayload.slice(0, 2)
        : upstreamPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse(500, { ok: false, error: message });
  }
});