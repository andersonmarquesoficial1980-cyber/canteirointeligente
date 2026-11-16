import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { equipesComVagaAberta, vagaEstaAberta, vagasAbertasPorEquipe, type Vaga } from "@/lib/vagasContratacao";
import { chaveEquipe } from "@/lib/quadroEquipes";

export type FuncaoCadastro = { id: string; nome: string };

export type NovaVagaForm = {
  equipe: string;
  funcao_id: string;
  quantidade: number;
  observacao: string;
  prioridade: string;
  motivo: string;
  data_prevista: string;
};

const db = supabase as any;

/**
 * Vagas de contratação (mesma fonte para Gestão de Pessoas e Programador).
 * Leitura direta (RLS por empresa); escrita só pelas RPCs vagas_criar / vaga_atualizar.
 * Se a tabela não existir ou o usuário não puder lê-la, `disponivel` fica false e o recurso some.
 */
export function useVagas(companyId: string | null) {
  const { permissions } = usePermissions();
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoCadastro[]>([]);
  const [disponivel, setDisponivel] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const podeGerir = permissions?.vagas_gestor === true;

  const carregar = useCallback(async () => {
    if (!companyId) return;
    setCarregando(true);
    try {
      const [v, f] = await Promise.all([
        db.from("vagas_contratacao").select("*").eq("company_id", companyId).order("created_at", { ascending: true }).limit(2000),
        db.from("funcoes").select("id, nome").eq("company_id", companyId).neq("ativo", false).order("nome").limit(1000),
      ]);
      if (v.error) { setDisponivel(false); setVagas([]); return; }
      setDisponivel(true);
      setVagas((v.data || []) as Vaga[]);
      if (!f.error) setFuncoes((f.data || []) as FuncaoCadastro[]);
    } catch {
      setDisponivel(false); setVagas([]);
    } finally {
      setCarregando(false);
    }
  }, [companyId]);
  useEffect(() => { carregar(); }, [carregar]);

  const criar = useCallback(async (itens: NovaVagaForm[]) => {
    if (!companyId) throw new Error("Empresa não identificada");
    const { data, error } = await db.rpc("vagas_criar", {
      p_company_id: companyId,
      p_itens: itens.map((i) => ({ ...i, data_prevista: i.data_prevista || null })),
    });
    if (error) throw error;
    await carregar();
    return data as number;
  }, [companyId, carregar]);

  const atualizar = useCallback(async (id: string, campos: Record<string, unknown>) => {
    const { data, error } = await db.rpc("vaga_atualizar", { p_id: id, p_campos: campos });
    if (error) throw error;
    if (!data) throw new Error("O banco não confirmou a alteração da vaga");
    await carregar();
    return data as Vaga;
  }, [carregar]);

  const abertas = useMemo(() => vagas.filter(vagaEstaAberta), [vagas]);
  const porEquipe = useMemo(() => vagasAbertasPorEquipe(vagas), [vagas]);
  const equipesComVaga = useMemo(() => equipesComVagaAberta(vagas), [vagas]);
  const vagasDaColuna = useCallback((chave: string) => porEquipe.get(chaveEquipe(chave)) ?? [], [porEquipe]);

  return { vagas, abertas, funcoes, disponivel, carregando, podeGerir, criar, atualizar, recarregar: carregar, equipesComVaga, vagasDaColuna };
}
