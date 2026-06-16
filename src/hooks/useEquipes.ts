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
    // 1. Match exato
    const exato = membros.filter((m) => m.responsavel.trim().toLowerCase() === nome);
    if (exato.length > 0) return exato;
    // 2. O nome selecionado (completo) começa com o valor do campo (abreviado)
    // mas exige que o valor tenha pelo menos uma palavra completa (sem match de "gi" para "Givanildo")
    const parcial = membros.filter((m) => {
      const resp = m.responsavel.trim().toLowerCase();
      return resp.length > 0 && nome.startsWith(resp);
    });
    if (parcial.length > 0) return parcial;
    // 3. Match por início — só se tiver pelo menos 2 palavras digitadas
    const palavras = nome.split(" ").filter(Boolean);
    if (palavras.length < 2) return [];
    const prefixo = palavras.slice(0, 2).join(" ");
    return membros.filter((m) => m.responsavel.trim().toLowerCase().startsWith(prefixo));
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
