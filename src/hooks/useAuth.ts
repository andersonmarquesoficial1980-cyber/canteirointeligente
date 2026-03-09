import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

async function ensureProfile(userId: string, email: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    await supabase.from("profiles").insert({
      user_id: userId,
      email: email || "",
      nome_completo: email?.split("@")[0] || "Usuário",
      perfil: "Apontador",
      status: "ativo",
    });
    // Also ensure role exists
    await supabase.from("user_roles" as any).insert({
      user_id: userId,
      role: "apontador",
    });
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await ensureProfile(session.user.id, session.user.email || "");
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await ensureProfile(session.user.id, session.user.email || "");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  return { session, loading, signOut };
}
