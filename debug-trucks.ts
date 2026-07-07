import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Ler .env.local
const envLocal = fs.readFileSync(".env.local", "utf-8");
const envVars = Object.fromEntries(
  envLocal
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("="))
);

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function extendedDiagnose() {
  console.log("🔍 DIAGNÓSTICO ESTENDIDO\n");

  // Contar quantos registros há em equipment_diaries
  console.log("1️⃣ Total de registros em equipment_diaries...");
  const { data: allDiaries, error: errAll } = await supabase
    .from("equipment_diaries")
    .select("count", { count: "exact" });

  if (!errAll) {
    const count = allDiaries?.[0]?.count || 0;
    console.log(`   Total: ${count} registros`);

    if (count > 0) {
      // Sample de equipment_type
      const { data: sample } = await supabase
        .from("equipment_diaries")
        .select("equipment_fleet,equipment_type")
        .limit(5);

      console.log("   Amostra de equipment_type e fleet:");
      sample?.forEach((s: any) => {
        console.log(`   - fleet="${s.equipment_fleet}" type="${s.equipment_type}"`);
      });
    }
  }

  // Verificar se rdo_diarios tem dados
  console.log("\n2️⃣ Total de registros em rdo_diarios...");
  const { data: rdoCount, error: errRdo } = await supabase
    .from("rdo_diarios")
    .select("count", { count: "exact" });

  if (!errRdo) {
    const count = rdoCount?.[0]?.count || 0;
    console.log(`   Total: ${count} registros`);

    if (count > 0) {
      // Sample de rdo_diarios
      const { data: sampleRdo } = await supabase
        .from("rdo_diarios")
        .select("id,date,tipo_servico")
        .limit(3);

      console.log("   Amostra:");
      sampleRdo?.forEach((s: any) => {
        console.log(`   - id=${s.id} date=${s.date} tipo_servico=${s.tipo_servico}`);
      });
    }
  }

  // Procurar por "caminhão" em equipment_type com LIMITE e ORDER
  console.log("\n3️⃣ Procurando por variantes de 'Caminhão'...");
  const queries = ['ilike("equipment_type", "%Caminhão%")', 'eq("equipment_type", "Caminhões")'];

  for (let q of ["Caminhão", "Caminhões", "caminhoe", "CAMINHAO"]) {
    const { data, error } = await supabase
      .from("equipment_diaries")
      .select("equipment_type", { count: "exact" })
      .ilike("equipment_type", `%${q}%`)
      .limit(1);

    if (!error) {
      const result = data || [];
      console.log(`   ilike("%${q}%"): ${result.length} registros`);
    }
  }

  // Detalhes completos do relatório
  console.log("\n4️⃣ Procurando no endpoint '/relatorios/equipamento'...");
  // Verificar se há query acessada do navegador
  // Buscar pela frota correta
  const { data: byFleetPattern, error: errPattern } = await supabase
    .from("equipment_diaries")
    .select("equipment_fleet")
    .limit(1000);

  if (!errPattern && byFleetPattern) {
    const fleets = [...new Set((byFleetPattern || []).map((f: any) => f.equipment_fleet).filter(Boolean))];
    console.log(`   Frotas na DB: [${fleets.slice(0, 5).join(", ")}${fleets.length > 5 ? ", ..." : ""}]`);
    console.log(`   Total de frotas: ${fleets.length}`);

    // Procurar pelo padrão esperado
    const expectedPattern = "Caminhões";
    const found = fleets.includes(expectedPattern);
    console.log(`   "${expectedPattern}" existe em frotas? ${found ? "✅ SIM" : "❌ NÃO"}`);
  }

  process.exit(0);
}

extendedDiagnose().catch((err) => {
  console.error("❌ Erro:", err.message);
  process.exit(1);
});
