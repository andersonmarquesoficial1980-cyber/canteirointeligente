import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// Tipos de pequeno porte — não geram diário automático
const TIPOS_PEQUENO_PORTE = [
  "BANHEIRO QUÍMICO", "CARRETINHA BANHEIRO", "COMPRESSOR", "GERADOR",
  "PLACA VIBRATÓRIA", "ROMPEDOR ELÉTRICO", "ROMPEDOR PNEUMATICO",
  "MISTURADOR DE ARGAMASSA", "SERRA CLIPER", "OUTRO",
];

Deno.serve(async (req) => {
  // Aceita POST ou GET (para cron)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Data de ontem
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataOntem = ontem.toISOString().split("T")[0];

  // Verificar se auto-pátio está habilitado
  const { data: config } = await supabase
    .from("patio_auto_config")
    .select("auto_patio_enabled")
    .eq("company_id", COMPANY_ID)
    .maybeSingle();

  if (!config?.auto_patio_enabled) {
    return new Response(JSON.stringify({ message: "Auto-pátio desabilitado." }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Buscar todos os equipamentos ativos (exceto pequeno porte)
  const { data: equipamentos, error: eqErr } = await supabase
    .from("equipamentos")
    .select("id, frota, tipo, company_id")
    .eq("company_id", COMPANY_ID)
    .eq("status", "ativo")
    .not("tipo", "in", `(${TIPOS_PEQUENO_PORTE.map(t => `"${t}"`).join(",")})`);

  if (eqErr || !equipamentos?.length) {
    return new Response(JSON.stringify({ error: eqErr?.message, equipamentos: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Buscar quais já têm diário ontem
  const frotas = equipamentos.map((e: any) => e.frota);
  const { data: diariosExistentes } = await supabase
    .from("equipment_diaries")
    .select("equipment_fleet")
    .eq("date", dataOntem)
    .eq("company_id", COMPANY_ID)
    .in("equipment_fleet", frotas);

  const frotasComDiario = new Set((diariosExistentes || []).map((d: any) => d.equipment_fleet));
  const semDiario = equipamentos.filter((e: any) => !frotasComDiario.has(e.frota));

  if (!semDiario.length) {
    return new Response(JSON.stringify({ message: "Todos os equipamentos já têm diário.", gerados: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Para cada sem diário, buscar último horímetro e criar diário automático
  let gerados = 0;
  const erros: string[] = [];

  for (const eq of semDiario) {
    // Buscar último diário para pegar horímetro
    const { data: ultimo } = await supabase
      .from("equipment_diaries")
      .select("meter_final, odometer_final")
      .eq("equipment_fleet", eq.frota)
      .eq("company_id", COMPANY_ID)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const meterVal = ultimo?.meter_final ?? null;
    const odomVal = ultimo?.odometer_final ?? null;

    const { error: insertErr } = await supabase
      .from("equipment_diaries")
      .insert({
        company_id: COMPANY_ID,
        date: dataOntem,
        equipment_fleet: eq.frota,
        equipment_type: eq.tipo,
        ogs_number: "000",
        client_name: "INTERNO",
        location_address: "Pátio Central",
        work_status: "No Pátio",
        operator_name: "PÁTIO CENTRAL",
        period: "diurno",
        meter_initial: meterVal,
        meter_final: meterVal,
        odometer_initial: odomVal,
        odometer_final: odomVal,
        is_auto: true,
        auto_reason: "Gerado automaticamente — equipamento sem diário no pátio",
        status: "auto",
      });

    if (insertErr) {
      erros.push(`${eq.frota}: ${insertErr.message}`);
    } else {
      gerados++;
    }
  }

  return new Response(
    JSON.stringify({
      data: dataOntem,
      equipamentos_verificados: equipamentos.length,
      ja_tinham_diario: frotasComDiario.size,
      gerados,
      erros,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
