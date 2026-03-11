import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        const { data } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        setIsAdmin(Boolean(data));
      } catch {
        setIsAdmin(false);
      }
      setLoading(false);
    };

    check();
  }, []);

  return { isAdmin, loading };
}

