import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AutoReasonCode = "AUTO_MANUTENCAO" | "AUTO_DISPOSICAO" | "AUTO_PATIO";

interface RunPayload {
  company_id?: string;
  target_date?: string; // YYYY-MM-DD
  dry_run?: boolean;
}

interface CompanyResult {
  company_id: string;
  enabled: boolean;
  target_date: string;
  elegiveis: number;
  bloqueados_transporte: number;
  bloqueados_diario_existente: number;
  gerados: number;
  dry_run: boolean;
  preview: Array<{
    frota: string;
    tipo: string | null;
    setor: string | null;
    work_status: string;
    auto_reason: AutoReasonCode;
    location_address: string;
    action: "would_insert" | "inserted" | "skip_transporte" | "skip_diario_existente";
  }>;
  erros: string[];
}

/**
 * Tipos que NÃO geram diário automático.
 * Equipamentos desses grupos costumam estar em operação de obra/equipe.
 */
const TIPOS_EXCLUIDOS = new Set([
  "BANHEIRO QUÍMICO",
  "BANHEIRO QUIMICO",
  "CAMINHÃO BASCULANTE",
  "CAMINHAO BASCULANTE",
  "CAMINHÃO PLATAFORMA",
  "CAMINHAO PLATAFORMA",
  "CAMINHÃO COMBOIO",
  "CAMINHAO COMBOIO",
  "CARRETINHA BANHEIRO",
  "COMPRESSOR",
  "GERADOR",
  "MISTURADOR DE ARGAMASSA",
  "PLACA VIBRATÓRIA",
  "PLACA VIBRATORIA",
  "PRANCHA REBOQUE",
  "ROMPEDOR ELÉTRICO",
  "ROMPEDOR ELETRICO",
  "ROMPEDOR PNEUMÁTICO",
  "ROMPEDOR PNEUMATICO",
  "SERRA CLIPPER",
  "TORRE DE ILUMINAÇÃO",
  "TORRE DE ILUMINACAO",
  "VAN",
]);

function normalize(v: string | null | undefined) {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function yesterdayIsoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function resolveTargetDate(raw?: string) {
  if (!raw) return yesterdayIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return yesterdayIsoDate();
  return raw;
}

function resolverStatusPatio(setor: string | null): {
  work_status: string;
  location_address: string;
  auto_reason: AutoReasonCode;
} {
  const s = normalize(setor);

  if (s.includes("MANUTENCAO")) {
    return {
      work_status: "Manutenção",
      location_address: "Pátio Central — Manutenção",
      auto_reason: "AUTO_MANUTENCAO",
    };
  }

  if (s.includes("DISPOSICAO")) {
    return {
      work_status: "Disposição",
      location_address: "Pátio Central",
      auto_reason: "AUTO_DISPOSICAO",
    };
  }

  return {
    work_status: "No Pátio",
    location_address: "Pátio Central",
    auto_reason: "AUTO_PATIO",
  };
}

async function processCompany(params: {
  supabase: ReturnType<typeof createClient>;
  companyId: string;
  targetDate: string;
  dryRun: boolean;
  enabled: boolean;
}): Promise<CompanyResult> {
  const { supabase, companyId, targetDate, dryRun, enabled } = params;

  const result: CompanyResult = {
    company_id: companyId,
    enabled,
    target_date: targetDate,
    elegiveis: 0,
    bloqueados_transporte: 0,
    bloqueados_diario_existente: 0,
    gerados: 0,
    dry_run: dryRun,
    preview: [],
    erros: [],
  };

  if (!enabled) return result;

  const { data: equipamentos, error: eqErr } = await supabase
    .from("equipamentos")
    .select("id, frota, tipo, setor, status")
    .eq("company_id", companyId)
    .eq("status", "ativo")
    .not("frota", "is", null);

  if (eqErr) {
    result.erros.push(`equipamentos: ${eqErr.message}`);
    return result;
  }

  const elegiveisBase = (equipamentos || []).filter((e: any) => !TIPOS_EXCLUIDOS.has(normalize(e.tipo)));
  result.elegiveis = elegiveisBase.length;

  if (!elegiveisBase.length) return result;

  const frotas = elegiveisBase.map((e: any) => String(e.frota));

  const [diariosExistentesRes, transportesRes] = await Promise.all([
    supabase
      .from("equipment_diaries")
      .select("equipment_fleet")
      .eq("company_id", companyId)
      .eq("date", targetDate)
      .in("equipment_fleet", frotas),
    supabase
      .from("equipamento_transportes")
      .select("equipment_fleet")
      .eq("company_id", companyId)
      .eq("data", targetDate)
      .in("equipment_fleet", frotas),
  ]);

  if (diariosExistentesRes.error) {
    result.erros.push(`diarios_existentes: ${diariosExistentesRes.error.message}`);
    return result;
  }
  if (transportesRes.error) {
    result.erros.push(`transportes: ${transportesRes.error.message}`);
    return result;
  }

  const frotasComDiario = new Set((diariosExistentesRes.data || []).map((d: any) => String(d.equipment_fleet).toUpperCase()));
  const frotasComTransporte = new Set((transportesRes.data || []).map((t: any) => String(t.equipment_fleet).toUpperCase()));

  for (const eq of elegiveisBase) {
    const frota = String(eq.frota || "").trim();
    if (!frota) continue;
    const frotaKey = frota.toUpperCase();

    if (frotasComDiario.has(frotaKey)) {
      result.bloqueados_diario_existente++;
      result.preview.push({
        frota,
        tipo: eq.tipo || null,
        setor: eq.setor || null,
        work_status: "—",
        auto_reason: "AUTO_PATIO",
        location_address: "—",
        action: "skip_diario_existente",
      });
      continue;
    }

    if (frotasComTransporte.has(frotaKey)) {
      result.bloqueados_transporte++;
      result.preview.push({
        frota,
        tipo: eq.tipo || null,
        setor: eq.setor || null,
        work_status: "Em Transporte",
        auto_reason: "AUTO_PATIO",
        location_address: "Em rota",
        action: "skip_transporte",
      });
      continue;
    }

    const { data: ultimo } = await supabase
      .from("equipment_diaries")
      .select("meter_final, odometer_final")
      .eq("equipment_fleet", frota)
      .eq("company_id", companyId)
      .eq("status", "enviado")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const meterVal = ultimo?.meter_final ?? null;
    const odomVal = ultimo?.odometer_final ?? null;

    const { work_status, location_address, auto_reason } = resolverStatusPatio(eq.setor);

    if (dryRun) {
      result.preview.push({
        frota,
        tipo: eq.tipo || null,
        setor: eq.setor || null,
        work_status,
        auto_reason,
        location_address,
        action: "would_insert",
      });
      continue;
    }

    const observations = [
      "Diário gerado automaticamente pelo Workflux.",
      "Fase 2: autopreenchimento controlado.",
      `Motivo: ${auto_reason}.`,
      "Nenhum apontamento manual/diário existente para a data alvo.",
    ].join(" ");

    const { error: insertErr } = await supabase
      .from("equipment_diaries")
      .insert({
        company_id: companyId,
        date: targetDate,
        equipment_fleet: frota,
        equipment_type: eq.tipo,
        equipamento_id: eq.id,
        ogs_number: "000",
        client_name: "PÁTIO CENTRAL",
        location_address,
        work_status,
        operator_name: "AUTOMÁTICO",
        period: "diurno",
        meter_initial: meterVal,
        meter_final: meterVal,
        odometer_initial: odomVal,
        odometer_final: odomVal,
        is_auto: true,
        auto_reason,
        status: "auto",
        observations,
      });

    if (insertErr) {
      result.erros.push(`${frota}: ${insertErr.message}`);
    } else {
      result.gerados++;
      result.preview.push({
        frota,
        tipo: eq.tipo || null,
        setor: eq.setor || null,
        work_status,
        auto_reason,
        location_address,
        action: "inserted",
      });
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: RunPayload = {};
  if (req.method !== "GET") {
    try {
      payload = (await req.json()) as RunPayload;
    } catch {
      payload = {};
    }
  }

  const dryRun = Boolean(payload.dry_run);
  const targetDate = resolveTargetDate(payload.target_date);

  // Se company_id vier no payload, processa só a empresa (respeitando config de enable).
  // Sem company_id: processa todas com auto_patio_enabled = true.
  let companiesToProcess: Array<{ company_id: string; enabled: boolean }> = [];

  if (payload.company_id) {
    const companyId = payload.company_id;
    const { data: cfg } = await supabase
      .from("patio_auto_config")
      .select("auto_patio_enabled")
      .eq("company_id", companyId)
      .maybeSingle();

    companiesToProcess = [{ company_id: companyId, enabled: !!cfg?.auto_patio_enabled }];
  } else {
    const { data: configs, error: cfgErr } = await supabase
      .from("patio_auto_config")
      .select("company_id, auto_patio_enabled")
      .eq("auto_patio_enabled", true);

    if (cfgErr) {
      return json({
        ok: false,
        message: "Falha ao buscar configuração de auto-pátio.",
        error: cfgErr.message,
      }, 500);
    }

    companiesToProcess = (configs || []).map((c: any) => ({
      company_id: String(c.company_id),
      enabled: Boolean(c.auto_patio_enabled),
    }));
  }

  if (!companiesToProcess.length) {
    return json({
      ok: true,
      message: "Nenhuma empresa habilitada para auto-pátio.",
      dry_run: dryRun,
      target_date: targetDate,
      companies: [],
    });
  }

  const results: CompanyResult[] = [];
  for (const c of companiesToProcess) {
    const r = await processCompany({
      supabase,
      companyId: c.company_id,
      targetDate,
      dryRun,
      enabled: c.enabled,
    });
    results.push(r);
  }

  const resumo = results.reduce(
    (acc, r) => {
      acc.empresas++;
      acc.elegiveis += r.elegiveis;
      acc.bloqueados_transporte += r.bloqueados_transporte;
      acc.bloqueados_diario_existente += r.bloqueados_diario_existente;
      acc.gerados += r.gerados;
      acc.erros += r.erros.length;
      return acc;
    },
    {
      empresas: 0,
      elegiveis: 0,
      bloqueados_transporte: 0,
      bloqueados_diario_existente: 0,
      gerados: 0,
      erros: 0,
    },
  );

  return json({
    ok: true,
    dry_run: dryRun,
    target_date: targetDate,
    resumo,
    companies: results,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}
