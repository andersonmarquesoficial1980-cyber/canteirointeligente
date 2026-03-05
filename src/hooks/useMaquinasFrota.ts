import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMaquinasFrota() {
  return useQuery({
    queryKey: ["maquinas_frota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota" as any)
        .select("*")
        .eq("status", "ativo")
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
  });
}
