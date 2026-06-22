/**
 * whatsapp-webhook — Meta Cloud API + Bot Workflux RH
 *
 * Estados do bot (wha_conversations.bot_state):
 *   menu_principal           → menu inicial
 *   menu_ferias              → submenu férias
 *   menu_vt                  → submenu vale-transporte
 *   menu_ponto               → submenu ponto
 *   aguardando_confirmacao   → confirma transferência para humano
 *   aguardando_humano        → atendente humano em controle
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN   = "fremix_rh_webhook_2026";
const META_TOKEN     = "EAAOLYV9BPj0BRldtLsCOsZB1ZAZB2w4JiMS1ZCoTVdZCEhHm6ZAAGZCpPbym3g3vQv8pbBUSunPjD8QmGVteGMaTHenL2DWDlgzTwBZA8ft30UF5anO8aZAq8RZAhrNXJCFVlUWTpDQ3Nral0SH9KNpJe6m7Qbl16msAnaEZAOwuZCRRSLdN2rZAdVDHQY0Xmx29RYBZCMZCQZDZD";
const PHONE_ID       = "1194682490386542";
const COMPANY_ID     = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Envia mensagem WhatsApp ─────────────────────────────────────────────────
async function sendWA(to: string, text: string) {
  const r = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!r.ok) console.error("Meta send error:", await r.text());
}

// ─── Salva mensagem enviada pelo bot ────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function saveOut(sb: any, convId: string, jid: string, text: string) {
  await sb.from("wha_messages").insert({
    conversation_id: convId, company_id: COMPANY_ID,
    remote_jid: jid, from_me: true, body: text,
    status: "sent", timestamp: Math.floor(Date.now() / 1000),
  });
  await sb.from("wha_conversations")
    .update({ last_message: text, last_message_at: new Date().toISOString() })
    .eq("id", convId);
}

function brl(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

// ─── LÓGICA DO BOT ───────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function bot(sb: any, conv: any, empId: string | null, empName: string | null, mensagem: string) {
  const convId    = conv.id;
  const jid       = conv.remote_jid;
  const phone     = conv.remote_phone;
  const estado    = conv.bot_state ?? "menu_principal";
  const nome      = empName ? empName.split(" ")[0] : "Colaborador";
  const msg       = mensagem.trim().toLowerCase();

  // deno-lint-ignore no-explicit-any
  const reply = async (texto: string, novoEstado?: string) => {
    await sendWA(phone, texto);
    await saveOut(sb, convId, jid, texto);
    if (novoEstado !== undefined) {
      const update: Record<string, unknown> = { bot_state: novoEstado };
      if (novoEstado === "aguardando_humano") update.bot_active = false;
      await sb.from("wha_conversations").update(update).eq("id", convId);
    }
  };

  const MENU_PRINCIPAL = `🏠 *Menu Principal — Workflux RH*\n\nOlá, ${nome}! Como posso te ajudar?\n\n1️⃣ Férias\n2️⃣ Vale Transporte (VT)\n3️⃣ Espelho de Ponto\n4️⃣ Falar com um atendente\n\n_Digite o número da opção._`;

  // Sempre permite voltar
  if (["menu", "0", "voltar", "inicio", "início"].includes(msg)) {
    await reply(MENU_PRINCIPAL, "menu_principal"); return;
  }

  // ── AGUARDANDO HUMANO — bot fora, só atualiza unread ──────────────────────
  if (estado === "aguardando_humano") {
    await sb.from("wha_conversations")
      .update({ unread_count: (conv.unread_count || 0) + 1, last_message: mensagem, last_message_at: new Date().toISOString() })
      .eq("id", convId);
    return;
  }

  // ── MENU PRINCIPAL ────────────────────────────────────────────────────────
  if (estado === "menu_principal") {
    if (["1","ferias","férias"].some(k => msg.includes(k))) {
      await reply(`🏖️ *Férias — Workflux RH*\n\nO que você quer saber?\n\n1️⃣ Saldo disponível\n2️⃣ Histórico de férias\n3️⃣ Agendar / solicitar férias\n0️⃣ Voltar ao menu`, "menu_ferias");
    } else if (["2","vt","vale transporte","transporte","condução"].some(k => msg.includes(k))) {
   await reply(`🚌 *Vale Transporte & Refeição — Workflux RH*\n\nO que você quer saber?\n\n1️⃣ Ver VT e VR cadastrados\n2️⃣ Reclamar VT incorreto\n3️⃣ Dias trabalhados este mês\n0️⃣ Voltar ao menu`, "menu_vt");
    } else if (["3","ponto","espelho","horas"].some(k => msg.includes(k))) {
      await reply(`🕐 *Espelho de Ponto — Workflux RH*\n\nO que você quer saber?\n\n1️⃣ Registros deste mês\n2️⃣ Último registro\n3️⃣ Pontos fora do raio\n0️⃣ Voltar ao menu`, "menu_ponto");
    } else if (["4","atendente","humano","pessoa","falar"].some(k => msg.includes(k))) {
      await reply(`👤 Certo! Vou transferir você para um atendente do RH.\n\nEm breve alguém entrará em contato. 👋\n\n_Digite *menu* a qualquer momento para o bot automático._`, "aguardando_humano");
      await sb.from("wha_conversations").update({ status: "aguardando_humano", unread_count: (conv.unread_count||0)+1 }).eq("id", convId);
    } else {
      await reply(`👋 Olá, ${nome}! Sou o assistente do *Workflux RH*.\n\n${MENU_PRINCIPAL}`, "menu_principal");
    }
    return;
  }

  // ── MENU FÉRIAS ───────────────────────────────────────────────────────────
  if (estado === "menu_ferias") {
    if (!empId) { await reply("⚠️ Seu telefone não está cadastrado. Fale com o RH.\n\n_Digite *menu* para voltar._"); return; }

    // Busca período aquisitivo + registros de férias tiradas
    const { data: periodos } = await sb.from("vacation_periods").select("*").eq("employee_id", empId).order("periodo_inicio", { ascending: false }).limit(5);
    const { data: registros } = await sb.from("vacation_records").select("*").eq("employee_id", empId).order("data_inicio", { ascending: false }).limit(10);
    const ferias = periodos;

    if (["1","2","saldo","historico","histórico"].some(k => msg.includes(k))) {
      if (!ferias?.length) {
        await reply(`ℹ️ *Férias — ${nome}*\n\nAinda não há informações de férias no seu cadastro.\nPara dúvidas, fale com o RH.\n\n_Digite *menu* para voltar._`, "menu_principal");
      } else {
        const p = ferias[0]; // período mais recente
        const saldo = p.dias_direito - p.dias_gozados;
        const txtPeriodo = `${new Date(p.periodo_inicio+"T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(p.periodo_fim+"T12:00:00").toLocaleDateString("pt-BR")}`;
        // registros individuais e coletivos
        const recs = (registros || []).slice(0, 6).map((r: Record<string,string>) => {
          const ini = new Date(r.data_inicio+"T12:00:00").toLocaleDateString("pt-BR");
          const fim = new Date(r.data_fim+"T12:00:00").toLocaleDateString("pt-BR");
          const tipo = r.tipo === "coletiva" ? "Coletiva" : "Individual";
          return `• ${ini} a ${fim} (${r.dias} dias) — ${tipo}`;
        }).join("\n");
        const histTxt = recs || "Nenhum registro encontrado.";
        await reply(
          `🏖️ *Férias — ${nome}*\n\n📅 *Período aquisitivo:* ${txtPeriodo}\n💼 *Direito:* ${p.dias_direito} dias\n✅ *Gozados:* ${p.dias_gozados} dias (${p.dias_coletiva} coletiva)\n🟡 *Saldo disponível:* ${saldo} dias\n\n*Histórico:*\n${histTxt}\n\n_Digite *menu* para voltar._`,
          "menu_principal"
        );
      }
    } else if (["3","agendar","solicitar","marcar"].some(k => msg.includes(k))) {
      await reply(`📅 Para agendar férias um atendente precisa confirmar.\nVou transferir você agora! 👤`, "aguardando_humano");
      await sb.from("wha_conversations").update({ status: "aguardando_humano", unread_count: (conv.unread_count||0)+1 }).eq("id", convId);
    } else {
      await reply(`Não entendi. Escolha:\n\n1️⃣ Saldo disponível\n2️⃣ Histórico de férias\n3️⃣ Agendar / solicitar férias\n0️⃣ Voltar ao menu`);
    }
    return;
  }

  // ── MENU VT ───────────────────────────────────────────────────────────────
  if (estado === "menu_vt") {
    if (!empId) { await reply("⚠️ Seu telefone não está cadastrado. Fale com o RH.\n\n_Digite *menu* para voltar._"); return; }

    const { data: conducoes } = await sb
      .from("vt_funcionario_conducoes")
      .select("*, vt_tarifas(tipo_transporte, valor_unitario)")
      .eq("funcionario_id", empId);

    if (["1","conduções","conducoes","valor","ver","vr","refeição","refeicao"].some(k => msg.includes(k))) {
      // Busca funcionário para pegar obs_geral (VR)
      const { data: empInfo } = await sb.from("employees").select("obs_geral,name").eq("id", empId).single();
      const vrTxt = empInfo?.obs_geral?.includes("R$") ? `\n\n🍽️ *Vale Refeição:* R$ 50,00/dia útil` : "";
      if (!conducoes?.length) {
        await reply(`ℹ️ Nenhuma condução cadastrada para você.\nFale com o RH para regularizar.${vrTxt}\n\n_Digite *menu* para voltar._`, "menu_principal");
      } else {
        let total = 0;
        const linhas = conducoes.map((c: Record<string,unknown>) => {
          const t     = c.vt_tarifas as Record<string,unknown>|null;
          const tipo  = (t?.tipo_transporte as string) || "—";
          const valor = (t?.valor_unitario  as number) || 0;
          const qtd   = (c.quantidade       as number) || 1;
          const sub   = valor * qtd * 2;
          total += sub;
          return `• ${tipo}\n  ${qtd}x ${brl(valor)} × 2 = ${brl(sub)}/dia`;
        }).join("\n\n");
        await reply(`🚌 *Vale Transporte — ${nome}*\n\n${linhas}\n\n💰 *Total VT/dia útil:* ${brl(total)}${vrTxt}\n\n_Digite *menu* para voltar._`, "menu_principal");
      }
    } else if (["2","errado","reclamação","reclamacao","incorreto","problema"].some(k => msg.includes(k))) {
      // Mostra conduções + dias trabalhados para o funcionário comparar
      const hoje = new Date();
      const ini  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-01`;
      const fim  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
      const { data: ponto } = await sb.from("ponto_registros").select("data").eq("staff_id", empId).gte("data", ini).lte("data", fim);
      const dias = new Set((ponto||[]).map((p: Record<string,string>) => p.data)).size;

      const vtResumo = conducoes?.length
        ? conducoes.map((c: Record<string,unknown>) => {
            const t = c.vt_tarifas as Record<string,unknown>|null;
            return `• ${t?.tipo_transporte||"—"} × ${c.quantidade}`;
          }).join("\n")
        : "Nenhuma condução cadastrada";

      await reply(
        `🔍 *Verificação de VT — ${nome}*\n\n*Suas conduções:*\n${vtResumo}\n\n*Dias com ponto registrado este mês:* ${dias} dia(s)\n\nSe estiver incorreto, confirma que quer falar com o RH?\nResponda *sim* ou *menu* para voltar.`,
        "aguardando_confirmacao",
      );
    } else if (["3","dias","trabalhados"].some(k => msg.includes(k))) {
      const hoje = new Date();
      const ini  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-01`;
      const fim  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
      const { data: ponto } = await sb.from("ponto_registros").select("data").eq("staff_id", empId).gte("data", ini).lte("data", fim);
      const dias = new Set((ponto||[]).map((p: Record<string,string>) => p.data)).size;
      const mes  = hoje.toLocaleString("pt-BR", { month: "long", year: "numeric" });
      await reply(`📅 *Dias trabalhados — ${nome}*\n\n*Mês:* ${mes}\n*Dias com ponto:* ${dias} dia(s)\n\n_Seu VT é calculado sobre esses dias._\n\n_Digite *menu* para voltar._`, "menu_principal");
    } else {
      await reply(`Não entendi. Escolha:\n\n1️⃣ Ver conduções e valores\n2️⃣ Reclamar VT incorreto\n3️⃣ Dias trabalhados este mês\n0️⃣ Voltar ao menu`);
    }
    return;
  }

  // ── MENU PONTO ────────────────────────────────────────────────────────────
  if (estado === "menu_ponto") {
    if (!empId) { await reply("⚠️ Seu telefone não está cadastrado. Fale com o RH.\n\n_Digite *menu* para voltar._"); return; }

    const hoje = new Date();
    const ini  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-01`;
    const fim  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
    const { data: ponto } = await sb.from("ponto_registros")
      .select("data,hora,tipo,turno,fora_raio")
      .eq("staff_id", empId).gte("data", ini).lte("data", fim)
      .order("data", { ascending: false }).order("hora", { ascending: false });

    if (["1","registros","todos","mes","mês"].some(k => msg.includes(k))) {
      if (!ponto?.length) {
        await reply(`ℹ️ Nenhum registro este mês.\n\n_Digite *menu* para voltar._`, "menu_principal");
      } else {
        const porDia: Record<string,string[]> = {};
        ponto.forEach((p: Record<string,string>) => {
          if (!porDia[p.data]) porDia[p.data] = [];
          porDia[p.data].push(`${p.tipo==="entrada"?"▶":"⏹"} ${p.hora.slice(0,5)}`);
        });
        const resumo = Object.entries(porDia).slice(0,10).map(([d,t]) => {
          const dt = new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"});
          return `📅 ${dt}: ${t.join(" | ")}`;
        }).join("\n");
        await reply(`🕐 *Ponto — ${nome}*\n\n*${Object.keys(porDia).length} dias este mês:*\n\n${resumo}\n\n_Digite *menu* para voltar._`, "menu_principal");
      }
    } else if (["2","ultimo","último"].some(k => msg.includes(k))) {
      const u = ponto?.[0];
      if (!u) { await reply(`ℹ️ Nenhum registro encontrado.\n\n_Digite *menu* para voltar._`, "menu_principal"); }
      else {
        const dt = new Date(u.data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"});
        await reply(`🕐 *Último registro — ${nome}*\n\n📅 ${dt} às ${u.hora.slice(0,5)}\n⬛ Tipo: ${u.tipo}\n🌙 Turno: ${u.turno||"—"}\n📍 Fora do raio: ${u.fora_raio?"Sim ⚠️":"Não ✅"}\n\n_Digite *menu* para voltar._`, "menu_principal");
      }
    } else if (["3","fora","raio","inconsistencia","inconsistência"].some(k => msg.includes(k))) {
      const fora = (ponto||[]).filter((p: Record<string,unknown>) => p.fora_raio);
      if (!fora.length) {
        await reply(`✅ Sem registros fora do raio este mês!\n\n_Digite *menu* para voltar._`, "menu_principal");
      } else {
        const lista = fora.slice(0,8).map((p: Record<string,string>) => {
          const dt = new Date(p.data+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
          return `⚠️ ${dt} ${p.hora.slice(0,5)} (${p.tipo})`;
        }).join("\n");
        await reply(`⚠️ *Fora do raio — ${nome}*\n\n${lista}\n\nPara solicitar abono, fale com o RH.\n\n_Digite *menu* para voltar._`, "menu_principal");
      }
    } else {
      await reply(`Não entendi. Escolha:\n\n1️⃣ Registros deste mês\n2️⃣ Último registro\n3️⃣ Pontos fora do raio\n0️⃣ Voltar ao menu`);
    }
    return;
  }

  // ── AGUARDANDO CONFIRMAÇÃO ────────────────────────────────────────────────
  if (estado === "aguardando_confirmacao") {
    if (["sim","s","yes"].includes(msg)) {
      await reply(`👤 Transferindo para um atendente do RH. Em breve alguém entrará em contato! 👋\n\n_Para o bot automático, digite *menu*._`, "aguardando_humano");
      await sb.from("wha_conversations").update({ status: "aguardando_humano", unread_count: (conv.unread_count||0)+1 }).eq("id", convId);
    } else {
      await reply(MENU_PRINCIPAL, "menu_principal");
    }
    return;
  }

  // Fallback
  await reply(MENU_PRINCIPAL, "menu_principal");
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY_TOKEN)
      return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
    return new Response("Token inválido", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json();
    const value   = payload?.entry?.[0]?.changes?.[0]?.value;

    if (!value?.messages?.length)
      return new Response(JSON.stringify({ ok: true, skipped: "no_messages" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const msg         = value.messages[0];
    const contactInfo = value?.contacts?.[0];
    const remotePhone: string = msg.from;
    const remoteName: string  = contactInfo?.profile?.name || remotePhone;
    const remoteJid           = `${remotePhone}@s.whatsapp.net`;
    const messageId           = msg.id;
    const timestamp           = parseInt(msg.timestamp) || Math.floor(Date.now() / 1000);

    let body_text = "[mídia]"; let mediaType: string|null = null;
    if      (msg.type==="text")     body_text = msg.text?.body || "";
    else if (msg.type==="image")  { body_text = msg.image?.caption  || "[imagem]";   mediaType="image"; }
    else if (msg.type==="video")  { body_text = msg.video?.caption  || "[vídeo]";    mediaType="video"; }
    else if (msg.type==="audio")  { body_text = "[áudio]";                            mediaType="audio"; }
    else if (msg.type==="document"){ body_text = msg.document?.caption || "[doc]";   mediaType="document"; }
    else if (msg.type==="sticker")  body_text = "[figurinha]";

    // Identifica funcionário pelo telefone
    const { data: empData } = await sb.from("employees").select("id,name")
      .eq("company_id", COMPANY_ID).ilike("telefone", `%${remotePhone.slice(-8)}%`).maybeSingle();

    // Upsert conversa (preserva bot_state e bot_active)
    const { data: conv } = await sb.from("wha_conversations").upsert({
      company_id: COMPANY_ID, remote_jid: remoteJid, remote_phone: remotePhone,
      remote_name: remoteName, instance_name: "fremix-rh",
      employee_id: empData?.id || null,
      last_message: body_text, last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,remote_jid,instance_name", ignoreDuplicates: false })
    .select("id,bot_state,bot_active,status,remote_jid,remote_phone,unread_count").single();

    if (!conv) throw new Error("Falha ao upsert conversa");

    // Salva mensagem recebida
    await sb.from("wha_messages").upsert({
      conversation_id: conv.id, company_id: COMPANY_ID, message_id: messageId,
      remote_jid: remoteJid, from_me: false, body: body_text,
      media_type: mediaType, status: "received", timestamp,
    }, { onConflict: "message_id", ignoreDuplicates: true });

    // Roda bot só para mensagens de texto
    const botAtivo = conv.bot_active !== false;
    if (botAtivo && msg.type === "text" && body_text && !body_text.startsWith("[")) {
      await bot(sb, conv, empData?.id || null, empData?.name || null, body_text);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("Webhook error:", errMsg);
    return new Response(JSON.stringify({ ok: false, error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
