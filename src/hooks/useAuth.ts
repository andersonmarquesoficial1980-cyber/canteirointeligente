import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/** Force-clear everything and redirect to clean login */
function forceLogout() {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  window.location.replace("/");
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — never stay loading forever (increased for slow connections)
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (_event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        clearTimeout(safetyTimeout);
        return;
      }

      setSession(sess);
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    // Initial session check (non-blocking, sem validações extras)
    supabase.auth.getSession()
      .then(({ data: { session: sess } }) => {
        setSession(sess);
        setLoading(false);
        clearTimeout(safetyTimeout);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
        clearTimeout(safetyTimeout);
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

