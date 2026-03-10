import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/** Force-clear everything and redirect to clean login */
function forceLogout() {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  window.location.replace("/");
}

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

/** Validate that a session is actually usable (token not expired/revoked) */
async function validateSession(sess: Session): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getUser();
    if (error) {
      console.warn("Token inválido:", error.message);
      return false;
    }
    // Also verify profile loads within 3s
    const profileCheck = Promise.race([
      supabase
        .from("profiles")
        .select("id")
        .eq("user_id", sess.user.id)
        .maybeSingle(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("profile_timeout")), 3000)),
    ]);
    await profileCheck;
    return true;
  } catch (err) {
    console.warn("validateSession failed:", err);
    return false;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — never stay loading forever
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        if (_event === "SIGNED_IN" && sess?.user) {
          // Clear stale data on fresh login
          try { sessionStorage.clear(); } catch {}

          const valid = await validateSession(sess);
          if (!valid) {
            console.warn("Sessão inválida após login, forçando logout");
            forceLogout();
            return;
          }
          await ensureProfile(sess.user.id, sess.user.email || "");
        }

        if (_event === "SIGNED_OUT") {
          setSession(null);
          setLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        setSession(sess);
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      if (sess?.user) {
        const valid = await validateSession(sess);
        if (!valid) {
          forceLogout();
          return;
        }
        await ensureProfile(sess.user.id, sess.user.email || "");
      }
      setSession(sess);
      setLoading(false);
      clearTimeout(safetyTimeout);
    }).catch(() => {
      forceLogout();
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    forceLogout();
  };

  return { session, loading, signOut };
}
