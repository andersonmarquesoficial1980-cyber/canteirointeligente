import { useEffect, useState } from "react";

/**
 * Equipes/setores administrativos (ex.: Financeiro, TI, Jurídico) marcados em Admin > Equipes
 * com `ocultar_operacao = true`. Ficam fora de RDO, Diário de Equipamentos e relatórios de equipe,
 * mas o cadastro e o histórico continuam intactos (nada é excluído).
 * Se a coluna ainda não existir no banco, nada é ocultado.
 */
export const normEquipe = (nome: string | null | undefined): string =>
  String(nome ?? "").trim().toLocaleLowerCase("pt-BR");

const TTL_MS = 60_000;
let cache: { at: number; set: Set<string> } | null = null;
let inflight: Promise<Set<string>> | null = null;

export function invalidarEquipesOcultas() {
  cache = null;
}

export async function loadEquipesOcultas(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.set;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase as any)
        .from("ci_equipes")
        .select("nome")
        .eq("ocultar_operacao", true);
      const set = new Set<string>(error ? [] : (data || []).map((e: any) => normEquipe(e.nome)).filter(Boolean));
      cache = { at: Date.now(), set };
      return set;
    } catch {
      return new Set<string>();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useEquipesOcultas(): Set<string> {
  const [set, setSet] = useState<Set<string>>(() => cache?.set ?? new Set());
  useEffect(() => {
    let vivo = true;
    loadEquipesOcultas().then((s) => vivo && setSet(s));
    return () => { vivo = false; };
  }, []);
  return set;
}

export const equipeVisivel = (nome: string | null | undefined, ocultas: Set<string>) =>
  !ocultas.has(normEquipe(nome));
