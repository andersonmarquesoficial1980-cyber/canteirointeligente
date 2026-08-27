import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MembroEquipe {
  id: string;
  matricula: string;
  nome: string;
  funcao: string;
  equipe: string;
  responsavel: string;
}

export function useEquipes() {
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [equipesData, setEquipesData] = useState<{id:string, nome:string, responsavel:string|null, centro_custo:string|null}[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("employees")
      .select("id, matricula, name, role, equipe, responsavel, funcoes(nome)")
      .eq("status", "ativo")
      .order("name");

    setMembros(
      (data || []).map((e: any) => ({
        id: e.id,
        matricula: e.matricula || "",
        nome: e.name || "",
        // Prioridade: função cadastrada > role legado
        funcao: e.funcoes?.nome || e.role || "",
        equipe: e.equipe || "",
        responsavel: e.responsavel || "",
      }))
    );

    const { data: eqsData } = await (supabase as any)
      .from("ci_equipes")
      .select("id, nome, responsavel, centro_custo")
      .eq("ativa", true)
      .order("nome");
    setEquipesData(eqsData || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Retorna todos os membros de um responsável.
   * Tenta match exato primeiro; se não achar, tenta match parcial
   * (o campo responsavel pode ser nome abreviado, ex: "AELSON ROMEU" vs "AELSON ROMEU COUTINHO").
   */
  const getMembrosDoResponsavel = (nomeResponsavel: string): MembroEquipe[] => {
    const nome = nomeResponsavel.trim().toLowerCase();
    // Requer mínimo de 4 caracteres para evitar auto-fill com texto parcial
    if (nome.length < 4) return [];

    // 1) Match exato
    const exato = membros.filter((m) => m.responsavel.trim().toLowerCase() === nome);

    // 2) Match de abreviação (nome selecionado completo começa com responsável abreviado)
    const parcial = membros.filter((m) => {
      const resp = m.responsavel.trim().toLowerCase();
      return resp.length > 0 && nome.startsWith(resp);
    });

    // 3) Match por prefixo de 2 palavras (cobre casos "THIAGO HENRIQUE" vs "THIAGO HENRIQUE F PIMENTEL")
    const palavras = nome.split(" ").filter(Boolean);
    const prefixo = palavras.length >= 2 ? palavras.slice(0, 2).join(" ") : "";
    const porPrefixo = prefixo
      ? membros.filter((m) => m.responsavel.trim().toLowerCase().startsWith(prefixo))
      : [];

    // Combina estratégias e remove duplicados por employee.id
    const combinados = [...exato, ...parcial, ...porPrefixo];
    if (combinados.length === 0) return [];

    const unicos = new Map<string, MembroEquipe>();
    combinados.forEach((m) => {
      if (!unicos.has(m.id)) unicos.set(m.id, m);
    });

    return Array.from(unicos.values());
  };

  /** Retorna todos os membros de uma equipe (case-insensitive) */
  const getMembrosDeEquipe = (nomeEquipe: string): MembroEquipe[] => {
    const nome = nomeEquipe.trim().toLowerCase();
    return membros.filter((m) => m.equipe.trim().toLowerCase() === nome);
  };

  /** Equipes distintas */
  const equipes = [...new Set(membros.map((m) => m.equipe).filter(Boolean))].sort();

  /** Responsáveis distintos */
  const responsaveis = [...new Set(membros.map((m) => m.responsavel).filter(Boolean))].sort();

  return {
    membros,
    equipes,
    equipesData,
    responsaveis,
    loading,
    getMembrosDoResponsavel,
    getMembrosDeEquipe,
    refetch: fetchAll,
  };
}
