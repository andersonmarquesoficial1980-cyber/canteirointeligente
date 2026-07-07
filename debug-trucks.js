#!/usr/bin/env node
/**
 * Script de diagnóstico para verificar dados de Caminhões em equipment_diaries
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Faltam VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
  console.log("🔍 DIAGNÓSTICO: Dados de Caminhões em equipment_diaries\n");

  // Busca registros com equipment_fleet contendo "caminhão"
  console.log("1️⃣ Buscando registros com equipment_fleet ILIKE '%caminhão%'...");
  const { data: byFleet, error: err1 } = await supabase
    .from("equipment_diaries")
    .select("id,date,equipment_fleet,equipment_type,odometer_initial,odometer_final,meter_initial,meter_final")
    .ilike("equipment_fleet", "%caminhão%")
    .limit(3);

  if (err1) {
    console.error("❌ Erro na busca por fleet:", err1);
  } else {
    console.log(`   ✅ Encontrados ${byFleet?.length || 0} registros`);
    if (byFleet && byFleet.length > 0) {
      console.log("   Amostra:");
      byFleet.forEach((row) => {
        console.log(`   - fleet="${row.equipment_fleet}" type="${row.equipment_type}"`);
        console.log(`     odometer_initial=${row.odometer_initial}, odometer_final=${row.odometer_final}`);
        console.log(`     meter_initial=${row.meter_initial}, meter_final=${row.meter_final}`);
      });
    }
  }

  // Busca registros com equipment_type = "Caminhões"
  console.log("\n2️⃣ Buscando registros com equipment_type = 'Caminhões'...");
  const { data: byType, error: err2 } = await supabase
    .from("equipment_diaries")
    .select("id,date,equipment_fleet,equipment_type,odometer_initial,odometer_final,meter_initial,meter_final")
    .eq("equipment_type", "Caminhões")
    .limit(3);

  if (err2) {
    console.error("❌ Erro na busca por type:", err2);
  } else {
    console.log(`   ✅ Encontrados ${byType?.length || 0} registros`);
    if (byType && byType.length > 0) {
      console.log("   Amostra:");
      byType.forEach((row) => {
        console.log(`   - fleet="${row.equipment_fleet}" type="${row.equipment_type}"`);
        console.log(`     odometer_initial=${row.odometer_initial}, odometer_final=${row.odometer_final}`);
        console.log(`     meter_initial=${row.meter_initial}, meter_final=${row.meter_final}`);
      });
    }
  }

  // Quais valores únicos de equipment_fleet existem?
  console.log("\n3️⃣ Valores únicos de equipment_fleet...");
  const { data: fleets, error: err3 } = await supabase
    .from("equipment_diaries")
    .select("equipment_fleet")
    .limit(100);

  if (err3) {
    console.error("❌ Erro ao buscar frotas:", err3);
  } else {
    const unique = [...new Set((fleets || []).map((f) => f.equipment_fleet).filter(Boolean))];
    console.log(`   ✅ Encontradas ${unique.length} frotas diferentes:`);
    unique.slice(0, 10).forEach((f) => console.log(`   - "${f}"`));
    if (unique.length > 10) console.log(`   ... e mais ${unique.length - 10}`);
  }

  // Verificar se há dados em odometer_initial para equipment_type = Caminhões
  console.log("\n4️⃣ Estatísticas para equipment_type = 'Caminhões'...");
  const { data: stats, error: err4 } = await supabase
    .from("equipment_diaries")
    .select("count", { count: "exact" })
    .eq("equipment_type", "Caminhões");

  if (err4) {
    console.error("❌ Erro:", err4);
  } else {
    const count = stats?.[0]?.count || 0;
    console.log(`   Total de Caminhões: ${count}`);

    if (count > 0) {
      // Contar quantos têm odometer_initial preenchido
      const { data: withOdo, error: errOdo } = await supabase
        .from("equipment_diaries")
        .select("count", { count: "exact" })
        .eq("equipment_type", "Caminhões")
        .not("odometer_initial", "is", null);

      if (!errOdo) {
        const odoCount = withOdo?.[0]?.count || 0;
        console.log(`   ✅ Com odometer_initial preenchido: ${odoCount}`);
        console.log(`   ⚠️ SEM odometer_initial: ${count - odoCount}`);
      }

      // Contar quantos têm meter_initial preenchido (pode ser erro também)
      const { data: withMeter, error: errMeter } = await supabase
        .from("equipment_diaries")
        .select("count", { count: "exact" })
        .eq("equipment_type", "Caminhões")
        .not("meter_initial", "is", null);

      if (!errMeter) {
        const meterCount = withMeter?.[0]?.count || 0;
        console.log(`   ⚠️ Com meter_initial preenchido (PROBLEMA se > 0): ${meterCount}`);
      }
    }
  }

  console.log("\n✅ Diagnóstico concluído!");
  process.exit(0);
}

diagnose().catch((err) => {
  console.error("❌ Erro crítico:", err);
  process.exit(1);
});
