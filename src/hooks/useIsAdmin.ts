import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedFetch, getUserId, peekForUser } from "@/lib/sessionCache";

export function useIsAdmin() {
  const initial = peekForUser<boolean>("isAdmin");
  const [isAdmin, setIsAdmin] = useState(initial ?? false);
  const [loading, setLoading] = useState(initial === undefined);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const userId = await getUserId();
        if (!userId) {
          if (alive) { setIsAdmin(false); setLoading(false); }
          return;
        }
        const admin = await cachedFetch(`isAdmin:${userId}`, async () => {
          const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
          return Boolean(data);
        });
        if (alive) setIsAdmin(admin);
      } catch {
        if (alive) setIsAdmin(false);
      }
      if (alive) setLoading(false);
    };
    check();
    return () => { alive = false; };
  }, []);

  return { isAdmin, loading };
}
