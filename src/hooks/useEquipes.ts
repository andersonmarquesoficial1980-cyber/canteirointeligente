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
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("employees")
      .select("id, matricula, name, role, equipe, responsavel")
      .eq("status", "ativo")
      .order("name");

    setMembros(
      (data || []).map((e: any) => ({
        id: e.id,
        matricula: e.matricula || "",
        nome: e.name || "",
        funcao: e.role || "",
        equipe: e.equipe || "",
        responsavel: e.responsavel || "",
      }))
    );
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
    // 1. Match exato
    const exato = membros.filter((m) => m.responsavel.trim().toLowerCase() === nome);
    if (exato.length > 0) return exato;
    // 2. O nome selecionado (completo) começa com o valor do campo responsavel (abreviado)
    const parcial = membros.filter((m) => {
      const resp = m.responsavel.trim().toLowerCase();
      return resp.length > 0 && nome.startsWith(resp);
    });
    if (parcial.length > 0) return parcial;
    // 3. O campo responsavel começa com as primeiras palavras do nome selecionado
    const palavras = nome.split(" ").slice(0, 2).join(" ");
    return membros.filter((m) => m.responsavel.trim().toLowerCase().startsWith(palavras));
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
    responsaveis,
    loading,
    getMembrosDoResponsavel,
    getMembrosDeEquipe,
    refetch: fetchAll,
  };
}
