import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  nome_completo: string;
  email: string;
  perfil: 'admin' | 'apontador';
  status: 'ativo' | 'inativo';
  created_at: string;
  updated_at: string;
}

export function useProfile(user?: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
      }

      setProfile(data as Profile);
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  return { profile, loading };
}