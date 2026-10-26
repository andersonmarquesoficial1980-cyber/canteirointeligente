import { useCallback, useEffect, useState } from "react";
import { LARGURA_PADRAO, limitarLargura } from "@/lib/quadroEquipes";

export const quadroLayoutKey = (companyId: string, userId: string) =>
  `workflux:gestao-pessoas:quadro-equipes-layout:v1:${companyId}:${userId}`;

type Layout = { ordem: string[]; larguras: Record<string, number> };
const VAZIO: Layout = { ordem: [], larguras: {} };

function ler(key: string): Layout {
  try {
    const bruto = JSON.parse(localStorage.getItem(key) || "null");
    if (!bruto || typeof bruto !== "object") return VAZIO;
    const ordem = Array.isArray(bruto.ordem) ? bruto.ordem.filter((v: unknown): v is string => typeof v === "string") : [];
    const larguras: Record<string, number> = {};
    if (bruto.larguras && typeof bruto.larguras === "object") {
      for (const [k, v] of Object.entries(bruto.larguras)) if (typeof v === "number") larguras[k] = limitarLargura(v);
    }
    return { ordem, larguras };
  } catch { return VAZIO; }
}

/** Ordem das colunas e largura de cada uma: preferência local por usuário + empresa; não altera cadastros. */
export function useQuadroEquipesLayout(companyId: string | null, userId: string | null) {
  const key = companyId && userId ? quadroLayoutKey(companyId, userId) : "";
  const [layout, setLayout] = useState<Layout>(VAZIO);
  const [erro, setErro] = useState("");

  useEffect(() => { setLayout(key ? ler(key) : VAZIO); setErro(""); }, [key]);

  const salvar = useCallback((proximo: Layout) => {
    setLayout(proximo);
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(proximo)); setErro(""); }
    catch { setErro("Não foi possível salvar o layout neste navegador; ele pode se perder ao sair."); }
  }, [key]);

  const definirOrdem = useCallback((ordem: string[]) => salvar({ ...layout, ordem }), [layout, salvar]);
  const definirLargura = useCallback((chave: string, px: number | null) => {
    const larguras = { ...layout.larguras };
    if (px === null) delete larguras[chave]; else larguras[chave] = limitarLargura(px);
    salvar({ ...layout, larguras });
  }, [layout, salvar]);
  const definirTodas = useCallback((chaves: string[], px: number) => {
    const larguras = { ...layout.larguras };
    for (const k of chaves) larguras[k] = limitarLargura(px);
    salvar({ ...layout, larguras });
  }, [layout, salvar]);
  const restaurar = useCallback(() => salvar(VAZIO), [salvar]);

  const personalizado = layout.ordem.length > 0 || Object.keys(layout.larguras).length > 0;
  return { ordem: layout.ordem, larguras: layout.larguras, definirOrdem, definirLargura, definirTodas, restaurar, personalizado, erro, LARGURA_PADRAO };
}
