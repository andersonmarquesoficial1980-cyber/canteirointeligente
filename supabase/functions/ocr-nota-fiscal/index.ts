import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End auth check ---

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_base64, tipo, usinas_list, materiais_list, fornecedores_list } = await req.json();
    if (!image_base64) throw new Error("image_base64 is required");

    const systemPrompt = tipo === "CAUQ"
      ? `You are an expert OCR assistant for Brazilian fiscal notes (Notas Fiscais) of asphalt mass.

EXTRACTION RULES:
1. **NF Number (nf)**: Look for "Nº" or "N°" followed by digits in the top-right area. Example: "054865". Extract ONLY the number digits.
2. **Vehicle Plate (placa)**: Look in the "TRANSPORTADOR" or "DADOS DO VEÍCULO" section for a plate in format ABC1D23 or ABC-1234. Example: "AKZ6E66".
3. **Weight (tonelagem)**: Look for "PESO LÍQUIDO" (not "PESO BRUTO"). Convert kg to tons by dividing by 1000. Example: "22.030,00 kg" → "22.03". Return the numeric value in TONS.
4. **Plant/Usina (usina)**: Look at the "EMITENTE" or "RAZÃO SOCIAL" at the top of the invoice. This is the company that ISSUED the invoice.
${usinas_list?.length ? `   Compare with this list and return the BEST MATCH (case-insensitive, partial match is OK):\n   Available usinas: ${JSON.stringify(usinas_list)}` : ''}
5. **Material Type (tipo_material)**: Look at "DESCRIÇÃO DO PRODUTO" or "DESCRIÇÃO DOS PRODUTOS/SERVIÇOS".
${materiais_list?.length ? `   Compare with this list and return the BEST MATCH (case-insensitive, partial match is OK). Examples: "CBUQ FX-III" should match "FX-III" or "CBUQ". "CONCRETO BETUMINOSO" should match "Binder" if that's closest.\n   Available materials: ${JSON.stringify(materiais_list)}` : ''}

Return ONLY a JSON object (no markdown, no backticks):
{
  "nf": "invoice number (digits only)",
  "placa": "vehicle plate",
  "usina": "best matching usina name from the list, or raw text if no match",
  "tonelagem": "weight in tons (number only, use dot as decimal separator)",
  "tipo_material": "best matching material from the list, or raw text if no match"
}`
      : `You are an expert OCR assistant for Brazilian fiscal notes (Notas Fiscais) of construction supplies.

EXTRACTION RULES:
1. **NF Number (nf)**: Look for "Nº" or "N°" followed by digits. Extract ONLY the number digits.
2. **Supplier (fornecedor)**: Look at the "EMITENTE" or "RAZÃO SOCIAL" at the top.
${fornecedores_list?.length ? `   Compare with this list and return the BEST MATCH (case-insensitive, partial match is OK):\n   Available suppliers: ${JSON.stringify(fornecedores_list)}` : ''}
3. **Material (material)**: Look at "DESCRIÇÃO DO PRODUTO".
4. **Quantity (quantidade)**: Look for "QUANTIDADE" or "QTD". Return the numeric value only.

Return ONLY a JSON object (no markdown, no backticks):
{
  "nf": "invoice number (digits only)",
  "fornecedor": "best matching supplier from the list, or raw text if no match",
  "material": "material description",
  "quantidade": "quantity (number only)"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract data from this Brazilian invoice (Nota Fiscal) photo. Pay special attention to: NF number (top right), vehicle plate (transport section), net weight/peso líquido, issuer/emitente name, and product description." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${response.status}: ${t}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let extracted;
    try {
      extracted = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      extracted = {};
    }

    console.log("OCR extracted:", JSON.stringify(extracted));

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-nota-fiscal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
