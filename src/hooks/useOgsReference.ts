import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Ordena OGS: 000 sempre no topo, restante decrescente por número */
export function sortOgsData<T extends { ogs_number: string }>(data: T[]): T[] {
  return [...data].sort((a, b) => {
    if (a.ogs_number === "000") return -1;
    if (b.ogs_number === "000") return 1;
    return parseInt(b.ogs_number) - parseInt(a.ogs_number);
  });
}

export function useOgsReference() {
  return useQuery({
    queryKey: ["ogs_reference"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ogs_reference")
        .select("*");
      if (error) throw error;
      // 000 sempre primeiro, resto decrescente por número
      return (data || []).sort((a: any, b: any) => {
        if (a.ogs_number === "000") return -1;
        if (b.ogs_number === "000") return 1;
        return parseInt(b.ogs_number) - parseInt(a.ogs_number);
      });
    },
  });
}
