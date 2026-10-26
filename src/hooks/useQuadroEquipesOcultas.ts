import { useCallback, useEffect, useState } from "react";

export const quadroOcultasKey = (companyId: string, userId: string, escopo = "gestao-pessoas") =>
  `workflux:${escopo}:quadro-equipes-ocultas:v1:${companyId}:${userId}`;

function ler(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}

/** Preferência local por usuário + empresa: quais colunas do quadro ficam ocultas. Não altera nenhum cadastro. */
export function useQuadroEquipesOcultas(companyId: string | null, userId: string | null, escopo = "gestao-pessoas") {
  const key = companyId && userId ? quadroOcultasKey(companyId, userId, escopo) : "";
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");

  useEffect(() => { setOcultas(key ? new Set(ler(key)) : new Set()); setErro(""); }, [key]);

  const salvar = useCallback((proximo: Set<string>) => {
    setOcultas(proximo);
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify([...proximo])); setErro(""); }
    catch { setErro("Não foi possível salvar a escolha neste navegador; ela pode se perder ao sair."); }
  }, [key]);

  const alternar = useCallback((chave: string) => {
    const proximo = new Set(ocultas);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
    salvar(proximo);
  }, [ocultas, salvar]);

  const mostrarTodas = useCallback(() => salvar(new Set()), [salvar]);
  return { ocultas, alternar, mostrarTodas, erro };
}
