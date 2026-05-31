import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Equipamento {
  id: string;
  company_id: string;
  frota: string;
  nome: string;
  modelo_completo?: string;
  tipo?: string;
  categoria_rdo?: string;
  tipo_veiculo?: string;
  ano?: string;
  placa?: string;
  patrimonio?: string;
  condicao: "PROPRIO" | "TERCEIRO";
  empresa_proprietaria?: string;
  vinculos: string[];
  vinculo_rdo?: string;
  status: string;
  setor?: string;
  condutor_atual?: string;
  local_atual?: string;
  horimetro_atual?: number;
  km_atual?: number;
  observacoes?: string;
  motivo_manutencao?: string;
  previsao_liberacao?: string;
  valor_aquisicao?: number;
  valor_mensal?: number;
  data_inicio_locacao?: string;
  data_fim_locacao?: string;
  periodo_medicao?: string;
  intervalo_troca_oleo_h?: number;
  ultimo_horimetro_oleo?: number;
  created_at: string;
  updated_at: string;
}

export function useEquipamentos(filtroVinculo?: string) {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("equipamentos")
      .select("*")
      .eq("status", "ativo")
      .order("frota");

    if (filtroVinculo && filtroVinculo !== "TODOS") {
      query = query.contains("vinculos", [filtroVinculo]);
    }

    const { data, error } = await query;
    if (!error) setEquipamentos(data || []);
    setLoading(false);
  }, [filtroVinculo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { equipamentos, loading, refetch: fetchAll };
}

// Busca por frota (compatível com referências textuais existentes em rdo_equipamentos)
export async function getEquipamentoByFrota(frota: string): Promise<Equipamento | null> {
  const { data } = await (supabase as any)
    .from("equipamentos")
    .select("*")
    .eq("frota", frota)
    .single();
  return data || null;
}
