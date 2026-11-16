import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chaveEquipe } from "@/lib/quadroEquipes";
import {
  COLUNA_AFASTADOS, feriasVigentes, origemDoHistorico, projetarPessoas,
  type AlocacaoAtiva, type FeriasLinha,
} from "@/lib/quadroAlocacao";

/**
 * Fonte ÚNICA da "posição de hoje" do Quadro Pessoas: alocações temporárias ativas + férias vigentes (RH)
 * + origem de quem está em AFASTADOS, projetadas sobre o cadastro (`employees.equipe`).
 * Usada pelo Quadro Pessoas (WF Programador) e pelo relatório "Quadro de Hoje" para nunca divergirem.
 */
export function useQuadroProjecao<T extends { id: string; equipe?: string | null; status?: string | null }>(
  companyId: string | null, funcionarios: readonly T[], hoje: string,
) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoAtiva[]>([]);
  const [feriasLinhas, setFeriasLinhas] = useState<FeriasLinha[]>([]);
  const [origemAfastados, setOrigemAfastados] = useState<Record<string, string>>({});

  // Falha silenciosa = quadro como no cadastro.
  const carregarSituacao = useCallback(async () => {
    if (!companyId) return;
    const db = supabase as any;
    try {
      const [al, fe] = await Promise.all([
        db.from("employee_alocacoes_temporarias").select("id, employee_id, equipe_origem, equipe_destino, data_inicio, data_fim_prevista")
          .eq("company_id", companyId).eq("status", "ativa").limit(2000),
        db.from("vacation_records").select("employee_id, data_inicio, data_fim, workflow_status")
          .eq("company_id", companyId).lte("data_inicio", hoje).gte("data_fim", hoje).limit(2000),
      ]);
      if (!al.error) setAlocacoes((al.data || []) as AlocacaoAtiva[]);
      if (!fe.error) setFeriasLinhas((fe.data || []) as FeriasLinha[]);
    } catch { /* sem a situação de hoje, o quadro mostra o cadastro como antes */ }
  }, [companyId, hoje]);
  useEffect(() => { carregarSituacao(); }, [carregarSituacao]);

  // Quem já está na coluna AFASTADOS por cadastro: a origem vem da última "Mudança rápida de equipe: A → AFASTADOS".
  const idsAfastadosSemOrigem = useMemo(
    () => funcionarios.filter((f) => chaveEquipe(f.status) === "afastado" && chaveEquipe(f.equipe) === chaveEquipe(COLUNA_AFASTADOS)).map((f) => f.id),
    [funcionarios],
  );
  useEffect(() => {
    if (!companyId || idsAfastadosSemOrigem.length === 0) return;
    (supabase as any).from("employee_historico").select("employee_id, descricao, created_at")
      .eq("company_id", companyId).eq("tipo", "mudanca_equipe").in("employee_id", idsAfastadosSemOrigem)
      .order("created_at", { ascending: false }).limit(2000)
      .then(({ data, error }: any) => {
        if (error) return;
        const mapa: Record<string, string> = {};
        for (const h of (data || []) as { employee_id: string; descricao: string }[]) {
          if (mapa[h.employee_id] !== undefined || !/→\s*afastados\s*$/i.test(h.descricao || "")) continue;
          const o = origemDoHistorico(h.descricao);
          if (o) mapa[h.employee_id] = o;
        }
        setOrigemAfastados(mapa);
      });
  }, [companyId, idsAfastadosSemOrigem]);

  const projetadas = useMemo(
    () => projetarPessoas({ funcionarios: funcionarios as any[], alocacoes, ferias: feriasVigentes(feriasLinhas, hoje), origemAfastados, hoje }),
    [funcionarios, alocacoes, feriasLinhas, origemAfastados, hoje],
  );

  return { projetadas, alocacoes, carregarSituacao };
}
