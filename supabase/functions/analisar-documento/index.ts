import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  ASO: `Analise este Atestado de Saúde Ocupacional (ASO). Extraia:
1. Nome completo do funcionário
2. Data de emissão (dd/mm/yyyy)
3. Data de validade (dd/mm/yyyy) — se não houver, calcule 1 ano após emissão
4. Se está legível e com assinatura do médico
5. Se está dentro do prazo de validade (considere hoje como referência)
Responda em JSON: {"nome": "", "emissao": "", "validade": "", "legivel": true/false, "assinado": true/false, "dentro_prazo": true/false, "observacao": ""}`,

  OS: `Analise esta Ordem de Serviço (OS) de segurança do trabalho. Extraia:
1. Nome completo do funcionário
2. Data de emissão (dd/mm/yyyy)
3. Se está assinada pelo funcionário e pelo responsável
4. Se está legível
Responda em JSON: {"nome": "", "emissao": "", "assinado_funcionario": true/false, "assinado_responsavel": true/false, "legivel": true/false, "observacao": ""}`,

  "Ficha EPI": `Analise esta Ficha de EPI (Equipamento de Proteção Individual). Extraia:
1. Nome completo do funcionário
2. Data de emissão ou última atualização (dd/mm/yyyy)
3. Se está assinada pelo funcionário
4. Se está legível
5. Se há EPIs listados
Responda em JSON: {"nome": "", "emissao": "", "assinado": true/false, "legivel": true/false, "tem_epis": true/false, "observacao": ""}`,

  DEFAULT: `Analise este documento de segurança do trabalho do tipo "{TIPO}". Extraia:
1. Nome completo do funcionário (se houver)
2. Data de emissão ou validade (dd/mm/yyyy)
3. Se está legível
4. Se está assinado
5. Se aparenta estar completo e válido
Responda em JSON: {"nome": "", "emissao": "", "validade": "", "legivel": true/false, "assinado": true/false, "valido": true/false, "observacao": ""}`,
};

function getPrompt(tipo: string): string {
  return PROMPTS[tipo] || PROMPTS.DEFAULT.replace("{TIPO}", tipo);
}

function determinarStatus(resultado: any, tipo: string): string {
  // Reprovado: ilegível
  if (resultado.legivel === false) return "reprovado";

  // Reprovado: não assinado em doc que exige assinatura
  if (tipo === "OS" && (resultado.assinado_funcionario === false || resultado.assinado_responsavel === false)) {
    return "reprovado";
  }
  if ((tipo === "ASO" || tipo === "Ficha EPI") && resultado.assinado === false) {
    return "reprovado";
  }

  // Reprovado: fora do prazo (ASO)
  if (tipo === "ASO" && resultado.dentro_prazo === false) return "reprovado";

  // Atenção: nome não detectado
  if (!resultado.nome || resultado.nome.trim() === "") return "atencao";

  // Atenção: observação relevante
  if (resultado.observacao && resultado.observacao.length > 10) return "atencao";

  return "aprovado";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { documento_id, arquivo_url, tipo_documento } = await req.json();

    if (!documento_id || !arquivo_url) {
      return new Response(JSON.stringify({ error: "documento_id e arquivo_url são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Chamar GPT-4o Vision
    const prompt = getPrompt(tipo_documento || "DEFAULT");
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: arquivo_url, detail: "high" } },
          ],
        }],
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content ?? "{}";

    // Extrair JSON da resposta
    let resultado: any = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) resultado = JSON.parse(jsonMatch[0]);
    } catch {
      resultado = { observacao: content };
    }

    const status = determinarStatus(resultado, tipo_documento);

    // Atualizar no Supabase
    const { error: updateError } = await supabase
      .from("ci_documentos")
      .update({
        status,
        ia_resultado: resultado,
        ia_nome_detectado: resultado.nome || null,
        ia_validade: resultado.validade || resultado.emissao || null,
        ia_observacao: resultado.observacao || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documento_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, status, resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
