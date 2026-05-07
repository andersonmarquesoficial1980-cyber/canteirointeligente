/**
 * useCanDelete — verifica se o usuário logado pode excluir registros
 * Administrador → true
 * Gerente → false (admin sem permissão de excluir)
 * Outros → false
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCanDelete() {
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setCanDelete(false); setLoading(false); return; }

        const { data } = await supabase
          .from("profiles")
          .select("can_delete, perfil")
          .eq("user_id", user.id)
          .maybeSingle();

        // Super admin (Anderson) sempre pode
        if (user.email === "andersonmarquesoficial1980@gmail.com" || user.email === "anderson@fremix.com.br") {
          setCanDelete(true);
        } else {
          setCanDelete(Boolean((data as any)?.can_delete));
        }
      } catch {
        setCanDelete(false);
      }
      setLoading(false);
    };
    check();
  }, []);

  return { canDelete, loading };
}
