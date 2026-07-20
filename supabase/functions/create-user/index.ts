import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERFIL_CANONICO: Record<string, string> = {
  "administrador": "Administrador",
  "gerente": "Gerente",
  "engenheiro": "Engenheiro",
  "encarregado": "Encarregado",
  "seguranca": "Segurança",
  "segurança": "Segurança",
  "manutencao": "Manutenção",
  "manutenção": "Manutenção",
  "gestao de pessoas": "Gestão de Pessoas",
  "gestão de pessoas": "Gestão de Pessoas",
  "gestao de frotas": "Gestão de Frotas",
  "gestão de frotas": "Gestão de Frotas",
  "apontador": "Apontador",
  "operador": "Operador",
  "motorista": "Motorista",
  "usuario": "Usuário",
  "usuário": "Usuário",
};

function canonicalizarPerfil(raw: unknown): string {
  const original = String(raw ?? "").trim();
  if (!original) return "Apontador";
  const normalized = original.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return PERFIL_CANONICO[original.toLowerCase()] || PERFIL_CANONICO[normalized] || "Apontador";
}

const DEFAULT_LOGIN_DOMAIN = "@fremix.workflux.app";

function normalizarEmail(raw: unknown): string {
  const input = String(raw ?? "").trim().toLowerCase();
  if (!input) return input;
  if (!input.includes("@")) return `${input}${DEFAULT_LOGIN_DOMAIN}`;
  const [local, domain] = input.split("@");
  if (domain === "workflux.app") return `${local}${DEFAULT_LOGIN_DOMAIN}`;
  return `${local}@${domain}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Não autenticado");

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    // Also check hardcoded admin email
    const isHardcodedAdmin = caller.email?.toLowerCase() === "anderson@fremix.com.br" || caller.email?.toLowerCase() === "andersonmarquesoficial1980@gmail.com";
    
    // Also check user_permissions.is_admin
    let hasPermAdmin = false;
    if (!roleData && !isHardcodedAdmin) {
      const { data: permData } = await supabaseAdmin
        .from("user_permissions")
        .select("is_admin")
        .eq("user_id", caller.id)
        .maybeSingle();
      hasPermAdmin = permData?.is_admin === true;
    }
    if (!roleData && !isHardcodedAdmin && !hasPermAdmin) throw new Error("Apenas administradores podem gerenciar usuários");

    const body = await req.json();
    const { action } = body;

    // === DELETE USER ===
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id é obrigatório");
      if (user_id === caller.id) throw new Error("Você não pode excluir a si mesmo");

      // Delete profile and role first
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

      // Delete from auth
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteError) throw new Error("Erro ao excluir usuário: " + deleteError.message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UNLOCK USER ===
    if (action === "unlock") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id é obrigatório");
      const { error: unlockError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      });
      if (unlockError) throw new Error("Erro ao desbloquear: " + unlockError.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UPDATE USER ===
    if (action === "update") {
      const { user_id, nome_completo, perfil, password, email: novoEmail } = body;
      if (!user_id) throw new Error("user_id é obrigatório");
      const perfilDb = perfil ? canonicalizarPerfil(perfil) : undefined;
      const emailNormalizado = novoEmail ? normalizarEmail(novoEmail) : "";

      // Atualizar e-mail no Auth (se fornecido)
      if (emailNormalizado) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email: emailNormalizado });
        if (emailError) throw new Error("Erro ao atualizar e-mail: " + emailError.message);
        // Atualizar e-mail no profile também
        await supabaseAdmin.from("profiles").update({ email: emailNormalizado }).eq("user_id", user_id);
      }

      // Update profile
      if (nome_completo || perfilDb) {
        const updates: any = {};
        if (nome_completo) updates.nome_completo = nome_completo;
        if (perfilDb) updates.perfil = perfilDb;
        await supabaseAdmin.from("profiles").update(updates).eq("user_id", user_id);
      }

      // Update role + can_delete + can_create_users
      if (perfilDb) {
        const role = (perfilDb === "Administrador" || perfilDb === "Gerente") ? "admin" : "user";
        const can_delete = perfilDb === "Administrador";
        const can_create_users = perfilDb === "Administrador";

        // Atualizar can_delete e can_create_users no profile
        await supabaseAdmin.from("profiles").update({ perfil: perfilDb, can_delete, can_create_users }).eq("user_id", user_id);

        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (existingRole) {
          await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", user_id);
        } else {
          await supabaseAdmin.from("user_roles").insert({ user_id, role });
        }
      }

      // Reset password
      if (password) {
        if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres");
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
        if (pwError) throw new Error("Erro ao alterar senha: " + pwError.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CREATE USER (default) ===
    const { email, password, nome_completo, perfil, login_original } = body;
    const emailNormalizado = normalizarEmail(email);
    if (!emailNormalizado || !password || !nome_completo || !perfil) {
      throw new Error("Campos obrigatórios: email, password, nome_completo, perfil");
    }
    if (password.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres");
    }

    // Buscar company_id do admin que está criando
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", caller.id)
      .maybeSingle();
    const company_id = callerProfile?.company_id ?? null;

    // Rate limiting: máx 10 criações por admin por hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from("edge_rate_limit")
      .select("id", { count: "exact", head: true })
      .eq("user_id", caller.id)
      .eq("action", "create_user")
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "Limite de 10 criações por hora atingido. Aguarde." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await supabaseAdmin.from("edge_rate_limit").insert({ user_id: caller.id, action: "create_user" });
    // Limpar registros antigos (> 24h) para não acumular
    await supabaseAdmin.from("edge_rate_limit").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    let userId: string;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password,
      email_confirm: true,
      user_metadata: {
        login_original: typeof login_original === "string" && login_original.trim().length > 0
          ? login_original.trim().toLowerCase()
          : emailNormalizado.split("@")[0],
      },
    });

    if (createError) {
      if (createError.message?.includes("already been registered")) {
        // Check if profile already exists for this email
        const { data: existingProfileByEmail } = await supabaseAdmin
          .from("profiles")
          .select("user_id, status")
          .eq("email", emailNormalizado)
          .maybeSingle();

        if (existingProfileByEmail && existingProfileByEmail.status === "ativo") {
          throw new Error("Este e-mail já está cadastrado no sistema.");
        }

        // Reactivate inactive user or link existing auth user
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw new Error("Erro ao buscar usuário existente");
        const existing = listData.users.find((u: any) => u.email === emailNormalizado);
        if (!existing) throw new Error("Usuário não encontrado no Auth");
        userId = existing.id;
      } else {
        throw new Error(createError.message || "Erro ao criar usuário");
      }
    } else {
      userId = newUser.user.id;
    }

    const perfilDb = canonicalizarPerfil(perfil);
    const role = ["Administrador", "Gerente"].includes(perfilDb) ? "admin" : "user";
    const can_delete = perfilDb === "Administrador";
    const can_create_users = perfilDb === "Administrador";
    const normalizedLogin =
      typeof login_original === "string" && login_original.trim().length > 0
        ? login_original.trim().toLowerCase()
        : emailNormalizado.split("@")[0];

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { login_original: normalizedLogin },
    });

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      await supabaseAdmin
        .from("profiles")
        .update({ nome_completo, perfil: perfilDb, email: emailNormalizado, status: "ativo", senha_temporaria: true, can_delete, can_create_users, company_id })
        .eq("user_id", userId);
    } else {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({ user_id: userId, email: emailNormalizado, nome_completo, perfil: perfilDb, status: "ativo", senha_temporaria: true, can_delete, can_create_users, company_id });
      if (profileError) throw new Error("Erro ao criar perfil: " + profileError.message);
    }

    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", userId);
    } else {
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
      if (roleError) throw new Error("Erro ao atribuir perfil: " + roleError.message);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("create-user error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
