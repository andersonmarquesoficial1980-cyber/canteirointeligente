import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOgsReference() {
  return useQuery({
    queryKey: ["ogs_reference"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ogs_reference")
        .select("*")
        .order("numero_ogs", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
