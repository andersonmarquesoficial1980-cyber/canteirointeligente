import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Funcao {
  id: string;
  nome: string;
  ativo: boolean;
}

export function useFuncoes() {
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);

  const getCompanyId = async (): Promise<string | null> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.user.id)
      .single();
    return profile?.company_id ?? null;
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("funcoes")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome");
    setFuncoes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addFuncao = async (nome: string): Promise<boolean> => {
    const companyId = await getCompanyId();
    if (!companyId) return false;
    const { error } = await (supabase as any)
      .from("funcoes")
      .insert({ nome: nome.trim().toUpperCase(), company_id: companyId });
    if (!error) await fetchAll();
    return !error;
  };

  const updateFuncao = async (id: string, nome: string): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from("funcoes")
      .update({ nome: nome.trim().toUpperCase() })
      .eq("id", id);
    if (!error) await fetchAll();
    return !error;
  };

  const removeFuncao = async (id: string): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from("funcoes")
      .update({ ativo: false })
      .eq("id", id);
    if (!error) await fetchAll();
    return !error;
  };

  return { funcoes, loading, reload: fetchAll, addFuncao, updateFuncao, removeFuncao };
}
