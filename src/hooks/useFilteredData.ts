import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FilteredItem {
  id: string;
  nome: string;
  vinculo_rdo: string;
  tipo_uso?: string;
}

function useFilteredTable(tableName: string, tipoRdo: string, tipoUso?: string) {
  return useQuery({
    queryKey: [tableName, tipoRdo, tipoUso],
    queryFn: async () => {
      let query = supabase
        .from(tableName as any)
        .select("*")
        .or(`vinculo_rdo.eq.${tipoRdo},vinculo_rdo.eq.TODOS`)
        .order("nome");

      if (tipoUso && tableName === "materiais") {
        query = query.or(`tipo_uso.eq.${tipoUso},tipo_uso.eq.Ambos`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FilteredItem[];
    },
    enabled: !!tipoRdo,
  });
}

export function useTiposServico(tipoRdo: string) {
  return useFilteredTable("tipos_servico", tipoRdo);
}

export function useMateriais(tipoRdo: string, tipoUso?: string) {
  return useFilteredTable("materiais", tipoRdo, tipoUso);
}

export function useEmpreiteiros(tipoRdo: string) {
  return useFilteredTable("empreiteiros", tipoRdo);
}

export function useFornecedores(tipoRdo: string) {
  return useFilteredTable("fornecedores", tipoRdo);
}

export function useUsinas(tipoRdo: string) {
  return useFilteredTable("usinas", tipoRdo);
}

export function useMaquinasFrotaFiltered(tipoRdo: string) {
  return useQuery({
    queryKey: ["maquinas_frota_filtered", tipoRdo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota" as any)
        .select("*")
        .in("status", ["ativo", "Operando"])
        .or(`vinculo_rdo.eq.${tipoRdo},vinculo_rdo.eq.TODOS`)
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tipoRdo,
  });
}
