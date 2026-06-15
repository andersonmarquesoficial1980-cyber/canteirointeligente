/**
 * whatsapp-send — Envia mensagem via API oficial Meta Cloud API
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_TOKEN = "EAAOLYV9BPj0BRldtLsCOsZB1ZAZB2w4JiMS1ZCoTVdZCEhHm6ZAAGZCpPbym3g3vQv8pbBUSunPjD8QmGVteGMaTHenL2DWDlgzTwBZA8ft30UF5anO8aZAq8RZAhrNXJCFVlUWTpDQ3Nral0SH9KNpJe6m7Qbl16msAnaEZAOwuZCRRSLdN2rZAdVDHQY0Xmx29RYBZCMZCQZDZD";
const PHONE_NUMBER_ID = "1194682490386542";
const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { number, text, conversation_id } = await req.json();

    if (!number || !text) {
      return new Response(JSON.stringify({ ok: false, error: "number e text são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Envia via Meta Cloud API
    const metaResp = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: number,
        type: "text",
        text: { body: text },
      }),
    });

    const metaData = await metaResp.json();

    if (!metaResp.ok) {
      console.error("Meta API error:", JSON.stringify(metaData));
      return new Response(JSON.stringify({ ok: false, error: metaData?.error?.message || "Erro Meta API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const messageId = metaData?.messages?.[0]?.id;
    const timestamp = Math.floor(Date.now() / 1000);

    // Salva mensagem enviada no banco
    if (conversation_id) {
      await supabase.from("wha_messages").insert({
        conversation_id,
        company_id: COMPANY_ID,
        message_id: messageId || `sent_${timestamp}`,
        remote_jid: `${number}@s.whatsapp.net`,
        from_me: true,
        body: text,
        timestamp,
        status: "sent",
      });

      // Atualiza última mensagem da conversa
      await supabase.from("wha_conversations").update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conversation_id);
    }

    return new Response(JSON.stringify({ ok: true, message_id: messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Send error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
