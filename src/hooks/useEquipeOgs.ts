import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chaveOgs, normalizarOgs, type OgsPorEquipe } from "@/lib/quadroHoje";

/**
 * OGS atual por equipe (campo informativo digitado no Quadro Pessoas). Tabela ausente ou sem acesso
 * = `disponivel=false` (o recurso some, o resto do quadro segue igual).
 */
export function useEquipeOgs(companyId: string | null, usuario?: { id?: string | null; nome?: string | null }) {
  const [ogs, setOgs] = useState<OgsPorEquipe>({});
  const [disponivel, setDisponivel] = useState(false);

  const carregar = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await (supabase as any).from("equipe_ogs_quadro")
      .select("equipe_chave, ogs, updated_at, updated_by_nome").eq("company_id", companyId).limit(1000);
    if (error) { setDisponivel(false); return; }
    const mapa: OgsPorEquipe = {};
    for (const r of (data || []) as { equipe_chave: string; ogs: string | null; updated_at: string | null; updated_by_nome: string | null }[]) {
      mapa[r.equipe_chave] = { ogs: r.ogs, atualizadoEm: r.updated_at, atualizadoPor: r.updated_by_nome };
    }
    setOgs(mapa);
    setDisponivel(true);
  }, [companyId]);
  useEffect(() => { carregar(); }, [carregar]);

  /** Grava (ou limpa com vazio) a OGS da equipe. Lança erro com mensagem do banco. */
  const salvar = useCallback(async (equipeNome: string, valor: string) => {
    if (!companyId) throw new Error("Empresa não identificada");
    const chave = chaveOgs(equipeNome);
    const novo = normalizarOgs(valor);
    const { data, error } = await (supabase as any).from("equipe_ogs_quadro").upsert({
      company_id: companyId, equipe_chave: chave, equipe_nome: equipeNome.trim(), ogs: novo,
      updated_by_user_id: usuario?.id ?? null, updated_by_nome: usuario?.nome ?? null,
    }, { onConflict: "company_id,equipe_chave" }).select("updated_at").single();
    if (error) throw error;
    setOgs((prev) => ({ ...prev, [chave]: { ogs: novo, atualizadoEm: data?.updated_at ?? new Date().toISOString(), atualizadoPor: usuario?.nome ?? null } }));
  }, [companyId, usuario?.id, usuario?.nome]);

  return { ogs, disponivel, salvar, recarregar: carregar };
}
