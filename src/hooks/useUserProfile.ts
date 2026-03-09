import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  nome_completo: string;
  perfil: string;
  email: string;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from("profiles")
          .select("nome_completo, perfil")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile({
          nome_completo: (data as any)?.nome_completo || user.email?.split("@")[0] || "Usuário",
          perfil: (data as any)?.perfil || "Apontador",
          email: user.email || "",
        });
      } catch {
        // non-blocking
      }
      setLoading(false);
    };
    load();
  }, []);

  return { profile, loading };
}
