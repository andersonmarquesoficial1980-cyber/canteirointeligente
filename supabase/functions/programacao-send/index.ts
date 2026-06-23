/**
 * programacao-send — Notificação de Programação de Obras via WhatsApp
 * Usa mesma infra do bot RH (Meta Cloud API)
 * Secrets via Supabase: META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID, COMPANY_ID_FREMIX
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWA(phoneId: string, token: string, to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: *** ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("Meta send error:", err);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// deno-lint-ignore no-explicit-any
function montarMensagem(prog: any): string {
  const data = prog.data ? prog.data.split("-").reverse().join("/") : "?";
  const equips = (prog.equipamentos_designados || []).join(", ") || "—";

  let msg = `🏗️ *PROGRAMAÇÃO DE OBRAS — Workflux*\n\n`;
  msg += `📅 *Data:* ${data}\n`;
  msg += `👷 *Equipe:* ${prog.equipe}\n`;
  if (prog.responsavel) msg += `🦺 *Encarregado:* ${prog.responsavel}\n`;
  if (prog.engenheiro_responsavel) msg += `👨‍💼 *Engenheiro:* ${prog.engenheiro_responsavel}\n`;
  msg += `🌙 *Período:* ${prog.periodo}\n`;
  if (prog.tipo_servico) msg += `🔧 *Tipo:* ${prog.tipo_servico}\n`;
  if (prog.ogs) msg += `📋 *OGS:* ${prog.ogs}\n`;
  if (prog.cliente) msg += `🏢 *Cliente:* ${prog.cliente}\n`;
  if (prog.local) msg += `📍 *Local:* ${prog.local}\n`;
  msg += `\n🚧 *Equipamentos:* ${equips}\n`;
  if (prog.obs) msg += `\n📝 *Obs:* ${prog.obs}\n`;
  msg += `\n_Enviado via Workflux_`;

  return msg;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Mesmas constantes do bot RH — hardcoded igual às outras funções
    const META_TOKEN = "EAAOLY...ZDZD";
    const PHONE_ID   = "1194682490386542";
    const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    // Body: { programacao_id, destinatarios: [{ phone, name, conversation_id? }] }
    const { programacao_id, destinatarios } = await req.json();

    if (!programacao_id || !destinatarios?.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "programacao_id e destinatarios são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar programação
    const { data: prog, error: progErr } = await supabase
      .from("ci_programacoes")
      .select("*")
      .eq("id", programacao_id)
      .single();

    if (progErr || !prog) {
      return new Response(
        JSON.stringify({ ok: false, error: "Programação não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const texto = montarMensagem(prog);
    // deno-lint-ignore no-explicit-any
    const resultados: any[] = [];

    for (const dest of destinatarios) {
      const phone = (dest.phone || "").replace(/\D/g, "");
      if (!phone) {
        resultados.push({ name: dest.name, ok: false, error: "sem telefone" });
        continue;
      }

      const r = await sendWA(PHONE_ID, META_TOKEN, phone, texto);
      resultados.push({ name: dest.name, phone, ok: r.ok, error: r.error });

      if (r.ok && dest.conversation_id) {
        await supabase.from("wha_messages").insert({
          conversation_id: dest.conversation_id,
          company_id: COMPANY_ID,
          remote_jid: `${phone}@s.whatsapp.net`,
          from_me: true,
          body: texto,
          status: "sent",
          timestamp: Math.floor(Date.now() / 1000),
        });
        await supabase.from("wha_conversations").update({
          last_message: texto.substring(0, 100),
          last_message_at: new Date().toISOString(),
        }).eq("id", dest.conversation_id);
      }
    }

    // Marcar notificado
    await supabase.from("ci_programacoes").update({
      notificado_em: new Date().toISOString(),
    }).eq("id", programacao_id);

    const enviados = resultados.filter((r) => r.ok).length;

    return new Response(
      JSON.stringify({ ok: true, enviados, total: destinatarios.length, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("programacao-send error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
