import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface UserProfile {
  user_id: string;
  nome_completo: string;
  perfil: string;
  email: string;
  company_id: string | null;
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
          .select("nome_completo, perfil, company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        // data é tipado como Partial<ProfileRow> | null — sem 'as any'
        const row = data as Pick<ProfileRow, "nome_completo" | "perfil" | "company_id"> | null;

        setProfile({
          user_id: user.id,
          nome_completo: row?.nome_completo || user.email?.split("@")[0] || "Usuário",
          perfil: row?.perfil || "Apontador",
          email: user.email || "",
          company_id: row?.company_id || null,
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
