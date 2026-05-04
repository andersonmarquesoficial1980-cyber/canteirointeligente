import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERFIS_VALIDOS = ["Operador", "Apontador", "Administrador", "Motorista"];

function buildPermissions(perfil: string) {
  const base = {
    is_admin: false,
    modulo_admin: false,
    modulo_obras: false,
    modulo_equipamentos: false,
    modulo_rh: false,
    modulo_carreteiros: false,
    modulo_programador: false,
    modulo_demandas: false,
    modulo_manutencao: false,
    modulo_abastecimento: false,
    modulo_documentos: false,
    modulo_relatorios: false,
    modulo_dashboard: false,
  };

  if (perfil === "Operador" || perfil === "Motorista") {
    return { ...base, modulo_equipamentos: true };
  }

  if (perfil === "Apontador") {
    return { ...base, modulo_obras: true };
  }

  if (perfil === "Administrador") {
    return {
      ...base,
      is_admin: true,
      modulo_admin: true,
      modulo_obras: true,
      modulo_equipamentos: true,
    };
  }

  return base;
}

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

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Apenas superadmin pode criar usuário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, nome_completo, perfil, company_id } = await req.json();

    if (!email || !nome_completo || !perfil || !company_id) {
      throw new Error("Campos obrigatórios: email, nome_completo, perfil, company_id");
    }

    if (!PERFIS_VALIDOS.includes(perfil)) {
      throw new Error("Perfil inválido");
    }

    const defaultPassword = "Workflux@2026";

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
    });

    if (createUserError || !createdUser.user) {
      throw new Error(createUserError?.message || "Erro ao criar usuário no Auth");
    }

    const userId = createdUser.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        nome_completo,
        email,
        perfil,
        company_id,
        status: "ativo",
        senha_temporaria: true,
        role: perfil === "Administrador" ? "admin" : null,
      });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const permissions = buildPermissions(perfil);

    const { error: permissionsError } = await (supabaseAdmin as any)
      .from("user_permissions")
      .upsert(
        {
          user_id: userId,
          ...permissions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (permissionsError) {
      throw new Error(permissionsError.message);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: userId,
          role: perfil === "Administrador" ? "admin" : "apontador",
        },
        { onConflict: "user_id" }
      );

    if (roleError) {
      throw new Error(roleError.message);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, default_password: defaultPassword }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
