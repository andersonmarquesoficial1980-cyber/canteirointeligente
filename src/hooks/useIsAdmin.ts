import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Temporary admin override — remove after fixing roles in DB
const ADMIN_OVERRIDE_EMAILS = ["anderson@fremix.com.br"];

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Temporary override
        if (ADMIN_OVERRIDE_EMAILS.includes(user.email || "")) {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("user_roles" as any)
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        setIsAdmin(!!data);
      } catch {
        // non-blocking
      }
      setLoading(false);
    };
    check();
  }, []);

  return { isAdmin, loading };
}
