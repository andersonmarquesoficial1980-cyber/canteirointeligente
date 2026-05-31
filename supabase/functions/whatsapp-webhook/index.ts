import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const event = body.event;

    // Só processar mensagens recebidas
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, skipped: event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = body.data;
    if (!data || data.key?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const remoteJid: string = data.key?.remoteJid || "";
    const instanceName: string = body.instance || "fremix-rh";

    // Ignorar grupos
    if (remoteJid.includes("@g.us")) {
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const remotePhone = remoteJid.replace("@s.whatsapp.net", "").replace("+", "");
    const remoteName: string = data.pushName || remotePhone;
    const body_text: string =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      data.message?.documentMessage?.caption ||
      "[mídia]";

    const timestamp: number = data.messageTimestamp || Math.floor(Date.now() / 1000);
    const messageId: string = data.key?.id || "";

    // Verificar se é funcionário cadastrado
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

    // Incrementar unread
    await supabase
      .from("wha_conversations")
      .update({ unread_count: (conv.unread_count || 0) + 1 })
      .eq("id", conv.id);

    // Inserir mensagem
    const mediaType = data.message?.imageMessage ? "image"
      : data.message?.videoMessage ? "video"
      : data.message?.audioMessage ? "audio"
      : data.message?.documentMessage ? "document"
      : null;

    await supabase.from("wha_messages").insert({
      conversation_id: conv.id,
      company_id: COMPANY_ID,
      message_id: messageId,
      remote_jid: remoteJid,
      from_me: false,
      body: body_text,
      media_type: mediaType,
      timestamp,
    });

    return new Response(JSON.stringify({ ok: true, conversation_id: conv.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
