import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const isHardcodedAdmin = caller.email?.toLowerCase() === "anderson@fremix.com.br";
    if (!roleData && !isHardcodedAdmin) throw new Error("Apenas administradores podem gerenciar usuários");

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

    // === UPDATE USER ===
    if (action === "update") {
      const { user_id, nome_completo, perfil, password } = body;
      if (!user_id) throw new Error("user_id é obrigatório");

      // Update profile
      if (nome_completo || perfil) {
        const updates: any = {};
        if (nome_completo) updates.nome_completo = nome_completo;
        if (perfil) updates.perfil = perfil;
        await supabaseAdmin.from("profiles").update(updates).eq("user_id", user_id);
      }

      // Update role
      if (perfil) {
        const role = perfil === "Administrador" ? "admin" : "apontador";
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
    const { email, password, nome_completo, perfil } = body;
    if (!email || !password || !nome_completo || !perfil) {
      throw new Error("Campos obrigatórios: email, password, nome_completo, perfil");
    }
    if (password.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres");
    }

    let userId: string;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message?.includes("already been registered")) {
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw new Error("Erro ao buscar usuário existente");
        const existing = listData.users.find((u: any) => u.email === email);
        if (!existing) throw new Error("Usuário não encontrado no Auth");
        userId = existing.id;
      } else {
        throw new Error(createError.message || "Erro ao criar usuário");
      }
    } else {
      userId = newUser.user.id;
    }

    const perfilDb = perfil === "Administrador" ? "Administrador" : "Apontador";
    const role = perfil === "Administrador" ? "admin" : "apontador";

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      await supabaseAdmin
        .from("profiles")
        .update({ nome_completo, perfil: perfilDb, email, status: "ativo" })
        .eq("user_id", userId);
    } else {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({ user_id: userId, email, nome_completo, perfil: perfilDb, status: "ativo" });
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
