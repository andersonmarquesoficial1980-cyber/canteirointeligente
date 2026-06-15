/**
 * whatsapp-webhook — API Oficial Meta (Cloud API)
 * Recebe mensagens do WhatsApp Business e salva nas tabelas wha_conversations + wha_messages
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "fremix_rh_webhook_2026";
const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Verificação do webhook (GET) ──────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado pela Meta ✅");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Token inválido", { status: 403 });
  }

  // ── Recepção de mensagens (POST) ──────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    // Estrutura da API oficial Meta
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Só processa mensagens recebidas
    if (!value?.messages || value.messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const msg = value.messages[0];
    const contactInfo = value?.contacts?.[0];

    const remotePhone: string = msg.from; // ex: "5511999999999"
    const remoteName: string = contactInfo?.profile?.name || remotePhone;
    const remoteJid: string = `${remotePhone}@s.whatsapp.net`;
    const messageId: string = msg.id;
    const timestamp: number = parseInt(msg.timestamp) || Math.floor(Date.now() / 1000);
    const instanceName = "fremix-rh";

    // Extrai texto da mensagem
    let body_text = "[mídia]";
    let mediaType: string | null = null;

    if (msg.type === "text") {
      body_text = msg.text?.body || "";
    } else if (msg.type === "image") {
      body_text = msg.image?.caption || "[imagem]";
      mediaType = "image";
    } else if (msg.type === "video") {
      body_text = msg.video?.caption || "[vídeo]";
      mediaType = "video";
    } else if (msg.type === "audio") {
      body_text = "[áudio]";
      mediaType = "audio";
    } else if (msg.type === "document") {
      body_text = msg.document?.caption || "[documento]";
      mediaType = "document";
    } else if (msg.type === "sticker") {
      body_text = "[figurinha]";
    }

    // Verifica se é funcionário cadastrado pelo telefone
    const { data: empData } = await supabase
      .from("employees")
      .select("id, name")
      .eq("company_id", COMPANY_ID)
      .ilike("telefone", `%${remotePhone.slice(-8)}%`)
      .maybeSingle();

    // Upsert da conversa
    const { data: conv, error: convErr } = await supabase
      .from("wha_conversations")
      .upsert({
        company_id: COMPANY_ID,
        remote_jid: remoteJid,
        remote_name: remoteName,
        remote_phone: remotePhone,
        instance_name: instanceName,
        employee_id: empData?.id || null,
        last_message: body_text,
        last_message_at: new Date(timestamp * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "company_id,remote_jid,instance_name",
        ignoreDuplicates: false,
      })
      .select("id, unread_count")
      .single();

    if (convErr) throw convErr;

    // Incrementa não lidas
    await supabase
      .from("wha_conversations")
      .update({ unread_count: (conv.unread_count || 0) + 1 })
      .eq("id", conv.id);

    // Insere mensagem (ignora duplicata por message_id)
    const { error: msgErr } = await supabase
      .from("wha_messages")
      .upsert({
        conversation_id: conv.id,
        company_id: COMPANY_ID,
        message_id: messageId,
        remote_jid: remoteJid,
        from_me: false,
        body: body_text,
        media_type: mediaType,
        timestamp,
      }, { onConflict: "message_id", ignoreDuplicates: true });

    if (msgErr) throw msgErr;

    console.log(`✅ Mensagem recebida de ${remoteName} (${remotePhone}): ${body_text}`);

    return new Response(JSON.stringify({ ok: true, conversation_id: conv.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    const stack = e instanceof Error ? e.stack : '';
    console.error("Webhook error:", msg, stack);
    return new Response(JSON.stringify({ ok: false, error: msg, detail: stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
