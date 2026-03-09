import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  nome_completo: string;
  perfil: string;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("nome_completo, perfil")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setProfile(data as UserProfile);
      setLoading(false);
    };
    load();
  }, []);

  return { profile, loading };
}
