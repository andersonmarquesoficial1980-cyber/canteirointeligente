import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

async function ensureProfile(userId: string, email: string) {
  try {
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
      await supabase.from("user_roles" as any).insert({
        user_id: userId,
        role: "apontador",
      });
    }
  } catch (err) {
    console.warn("ensureProfile failed (non-blocking):", err);
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        if (sess?.user) {
          await ensureProfile(sess.user.id, sess.user.email || "");
        }
        setLoading(false);
        clearTimeout(timeout);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (sess?.user) {
        const { error } = await supabase.auth.getUser();
        if (error) {
          console.warn("Token inválido, limpando sessão:", error.message);
          localStorage.clear();
          sessionStorage.clear();
          setSession(null);
          setLoading(false);
          clearTimeout(timeout);
          return;
        }
        await ensureProfile(sess.user.id, sess.user.email || "");
      }
      setSession(sess);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(() => {
      localStorage.clear();
      sessionStorage.clear();
      setSession(null);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  return { session, loading, signOut };
}
