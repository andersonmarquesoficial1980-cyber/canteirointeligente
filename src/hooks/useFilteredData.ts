import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FilteredItem {
  id: string;
  nome: string;
  vinculo_rdo: string;
  vinculos?: string[] | null;
  tipo_uso?: string;
  tipos_uso?: string[] | null;
}

// CAUQ e PAVIMENTACAO são equivalentes (legado x novo)
const VINCULO_ALIAS: Record<string, string[]> = {
  CAUQ: ["CAUQ", "PAVIMENTACAO", "TODOS"],
  PAVIMENTACAO: ["PAVIMENTACAO", "CAUQ", "TODOS"],
  INFRAESTRUTURA: ["INFRA", "TODOS"],
  INFRA: ["INFRA", "TODOS"],
};

// Tabelas que têm a coluna vinculos[] (array multi-vínculo)
const TABELAS_COM_VINCULOS_ARRAY = ["fornecedores", "materiais"];
const TABELAS_COM_TIPOS_USO_ARRAY = ["materiais"];

function useFilteredTable(tableName: string, tipoRdo: string, tipoUso?: string) {
  return useQuery({
    queryKey: [tableName, tipoRdo, tipoUso],
    queryFn: async () => {
      const aliases = VINCULO_ALIAS[tipoRdo] ?? [tipoRdo, "TODOS"];
      const normalizedAliases = new Set(
        aliases.map((v) => String(v || "").trim().toUpperCase())
      );

      const normalize = (v: string) => String(v || "").trim().toUpperCase();

      const hasArrayValues = (arr: unknown): arr is string[] =>
        Array.isArray(arr) && arr.some((v) => String(v || "").trim() !== "");

      const matchesVinculoWithPriority = (row: any) => {
        const vinculos = row?.vinculos;

        // Prioridade: se vinculos[] existir/preenchido, usa APENAS vinculos[]
        if (hasArrayValues(vinculos)) {
          return vinculos.some((v) => normalizedAliases.has(normalize(v)));
        }

        // Fallback legado: usa vinculo_rdo somente quando não há vinculos[]
        return normalizedAliases.has(normalize(String(row?.vinculo_rdo || "")));
      };

      const matchesTipoUsoWithPriority = (row: any) => {
        if (!tipoUso) return true;

        const normalizedTipoUso = normalize(tipoUso);
        const allowed = new Set([normalizedTipoUso, "AMBOS"]);
        const tiposUso = row?.tipos_uso;

        // Prioridade: se tipos_uso[] existir/preenchido, usa APENAS tipos_uso[]
        if (hasArrayValues(tiposUso)) {
          return tiposUso.some((v) => allowed.has(normalize(v)));
        }

        // Fallback legado: usa tipo_uso somente quando não há tipos_uso[]
        return allowed.has(normalize(String(row?.tipo_uso || "")));
      };

      const legacyOr = aliases.map((a) => `vinculo_rdo.eq.${a}`).join(",");

      // Query ampla + filtro determinístico em memória para garantir prioridade de vinculos[]
      // e evitar vazamento entre módulos quando vinculo_rdo legado estiver em TODOS.
      const orFilter = TABELAS_COM_VINCULOS_ARRAY.includes(tableName)
        ? `${legacyOr},${aliases.map((a) => `vinculos.cs.{${a}}`).join(",")}`
        : legacyOr;

      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .or(orFilter)
        .order("nome");

      if (error) throw error;

      let rows = (data || []) as any[];

      if (TABELAS_COM_VINCULOS_ARRAY.includes(tableName)) {
        rows = rows.filter(matchesVinculoWithPriority);
      }

      if (tipoUso && (tableName === "materiais" || TABELAS_COM_TIPOS_USO_ARRAY.includes(tableName))) {
        rows = rows.filter(matchesTipoUsoWithPriority);
      }

      return rows as unknown as FilteredItem[];
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

export function useEmpreiteiros(_tipoRdo: string) {
  return useQuery({
    queryKey: ["empresas_parceiras", "EMPREITEIRA"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_parceiras" as any)
        .select("id, nome")
        .eq("tipo", "EMPREITEIRA")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as FilteredItem[];
    },
  });
}

export function useFornecedores(tipoRdo: string) {
  return useFilteredTable("fornecedores", tipoRdo);
}

export function useUsinas(tipoRdo: string) {
  return useFilteredTable("usinas", tipoRdo);
}

export function useMaquinasFrotaFiltered(tipoRdo: string) {
  return useQuery({
    queryKey: ["equipamentos_filtered", tipoRdo],
    queryFn: async () => {
      // Busca todos os equipamentos ativos — filtragem por categoria é feita no cliente
      // (equipamentos como fresadoras têm vinculo_rdo="FRESADORA" e não batem com tipoRdo)
      const { data, error } = await supabase
        .from("equipamentos" as any)
        .select("*")
        .in("status", ["ativo", "Operando"])
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!tipoRdo,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    staleTime: 5 * 60 * 1000,
    refetchOnReconnect: true,
  });
}
