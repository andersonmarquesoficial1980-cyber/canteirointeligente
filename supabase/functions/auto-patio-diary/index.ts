import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/**
 * Tipos que NÃO geram diário automático.
 * Esses equipamentos ficam vinculados a obras/equipes e não precisam de controle diário de pátio.
 */
const TIPOS_EXCLUIDOS = [
  "BANHEIRO QUÍMICO",
  "CAMINHÃO BASCULANTE",
  "CAMINHÃO PLATAFORMA",
  "CAMINHÃO COMBOIO",
  "CARRETINHA BANHEIRO",
  "COMPRESSOR",
  "GERADOR",
  "MISTURADOR DE ARGAMASSA",
  "PLACA VIBRATÓRIA",
  "PRANCHA REBOQUE",
  "ROMPEDOR ELÉTRICO",
  "ROMPEDOR PNEUMÁTICO",
  "SERRA CLIPPER",
  "TORRE DE ILUMINAÇÃO",
  "VAN",
];

/**
 * Determina work_status e location_address com base no setor do equipamento.
 * - Setor "MANUTENÇÃO" → Manutenção no pátio
 * - Setor "DISPOSIÇÃO" → À disposição no pátio
 * - Demais → No pátio aguardando mobilização
 */
function resolverStatusPatio(setor: string | null): {
  work_status: string;
  location_address: string;
  auto_reason: string;
} {
  const s = (setor || "").toUpperCase();

  if (s.includes("MANUTENÇÃO") || s.includes("MANUTENCAO")) {
    return {
      work_status: "Manutenção",
      location_address: "Pátio Central — Manutenção",
      auto_reason: "Gerado automaticamente — equipamento em manutenção no pátio",
    };
  }

  if (s.includes("DISPOSIÇÃO") || s.includes("DISPOSICAO")) {
    return {
      work_status: "Disposição",
      location_address: "Pátio Central",
      auto_reason: "Gerado automaticamente — equipamento à disposição no pátio",
    };
  }

  return {
    work_status: "No Pátio",
    location_address: "Pátio Central",
    auto_reason: "Gerado automaticamente — equipamento sem apontamento (no pátio)",
  };
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verificar se auto-pátio está habilitado
  const { data: config } = await supabase
    .from("patio_auto_config")
    .select("auto_patio_enabled")
    .eq("company_id", COMPANY_ID)
    .maybeSingle();

  if (!config?.auto_patio_enabled) {
    return json({ message: "Auto-pátio desabilitado." });
  }

  // Data de ontem (o cron roda à 00h UTC = 21h Brasil do dia anterior)
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataOntem = ontem.toISOString().split("T")[0];

  // Buscar todos os equipamentos ativos, excluindo os tipos configurados
  const { data: equipamentos, error: eqErr } = await supabase
    .from("equipamentos")
    .select("id, frota, tipo, setor, company_id")
    .eq("company_id", COMPANY_ID)
    .eq("status", "ativo")
    .not("frota", "is", null);

  if (eqErr || !equipamentos?.length) {
    return json({ error: eqErr?.message ?? "Sem equipamentos", equipamentos: 0 });
  }

  // Filtrar tipos excluídos
  const elegíveis = equipamentos.filter(
    (e: any) => !TIPOS_EXCLUIDOS.includes((e.tipo || "").toUpperCase()),
  );

  if (!elegíveis.length) {
    return json({ message: "Nenhum equipamento elegível.", gerados: 0 });
  }

  // Buscar quais já têm diário ontem (qualquer status, manual ou auto)
  const frotas = elegíveis.map((e: any) => e.frota);
  const { data: diariosExistentes } = await supabase
    .from("equipment_diaries")
    .select("equipment_fleet")
    .eq("date", dataOntem)
    .eq("company_id", COMPANY_ID)
    .in("equipment_fleet", frotas);

  const frotasComDiario = new Set(
    (diariosExistentes || []).map((d: any) => d.equipment_fleet),
  );
  const semDiario = elegíveis.filter((e: any) => !frotasComDiario.has(e.frota));

  if (!semDiario.length) {
    return json({
      message: "Todos os equipamentos elegíveis já têm diário.",
      data: dataOntem,
      gerados: 0,
    });
  }

  let gerados = 0;
  const erros: string[] = [];
  const geradosList: string[] = [];

  for (const eq of semDiario) {
    // Buscar último horímetro/odômetro registrado (diário enviado mais recente)
    const { data: ultimo } = await supabase
      .from("equipment_diaries")
      .select("meter_final, odometer_final")
      .eq("equipment_fleet", eq.frota)
      .eq("company_id", COMPANY_ID)
      .eq("status", "enviado")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const meterVal = ultimo?.meter_final ?? null;
    const odomVal = ultimo?.odometer_final ?? null;

    const { work_status, location_address, auto_reason } = resolverStatusPatio(eq.setor);

    const { error: insertErr } = await supabase
      .from("equipment_diaries")
      .insert({
        company_id: COMPANY_ID,
        date: dataOntem,
        equipment_fleet: eq.frota,
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
        observations: "Diário gerado automaticamente pelo Workflux. Nenhum apontamento manual registrado para esta data.",
      });

    if (insertErr) {
      erros.push(`${eq.frota}: ${insertErr.message}`);
    } else {
      gerados++;
      geradosList.push(`${eq.frota} (${eq.tipo}) → ${work_status}`);
    }
  }

  return json({
    data: dataOntem,
    equipamentos_verificados: elegíveis.length,
    ja_tinham_diario: frotasComDiario.size,
    sem_diario: semDiario.length,
    gerados,
    gerados_lista: geradosList,
    erros,
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
