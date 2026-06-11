import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase env vars ausentes");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verificar quem está chamando
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se é admin ou superadmin
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerProfile || !["admin", "superadmin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem usar esta função" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      throw new Error("Campo obrigatório: target_user_id");
    }

    // Não permitir impersonar a si mesmo
    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Não é possível entrar como você mesmo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar magic link para o usuário alvo (não envia email — só pega o token)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: "", // será preenchido abaixo
    });

    // Buscar email do usuário alvo
    const { data: { user: targetUser }, error: targetError } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    if (targetError || !targetUser) {
      throw new Error("Usuário alvo não encontrado");
    }

    if (!targetUser.email) {
      throw new Error("Usuário alvo não possui email");
    }

    // Gerar magic link para o email do usuário alvo
    const { data: magic, error: magicError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email,
    });

    if (magicError || !magic) {
      throw new Error(magicError?.message || "Erro ao gerar link de acesso");
    }

    // Extrair o token do link gerado
    const url = new URL(magic.properties.action_link);
    const hashed_token = url.searchParams.get("token") || url.hash.replace("#", "");

    // Verificar o token para obter a sessão
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: magic.properties.hashed_token,
      type: "magiclink",
    });

    if (sessionError || !sessionData.session) {
      throw new Error(sessionError?.message || "Erro ao criar sessão de impersonation");
    }

    return new Response(JSON.stringify({
      success: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      target_name: targetUser.user_metadata?.nome_completo || targetUser.email,
      target_email: targetUser.email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
