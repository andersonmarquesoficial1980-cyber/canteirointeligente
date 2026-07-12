/**
 * Hook compartilhado — carrega equipamento_tipos do banco.
 * Usado em: AdminConfiguracoes, GestaoFrotasHome, GestaoFrotasDashboard, GestaoFrotasDashboardRdo
 *
 * Retorna:
 *  - categorias: lista de categorias com seus tipos { key, label, tipos[] }
 *  - tiposFlat: todos os tipos em lista plana { categoria, subtipo, label, tipoValor }
 *  - loading
 *
 * tipoValor = label.toUpperCase() — é o que vai em equipamentos.tipo
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EquipTipo {
  id: string;
  categoria: string;
  subtipo: string;
  label: string;
  icone: string | null;
  ativo: boolean;
  tipoValor: string; // label.toUpperCase() — campo tipo em equipamentos
}

export interface EquipCategoria {
  key: string;         // ex: "CAMINHOES"
  label: string;       // ex: "Caminhões"
  tipos: EquipTipo[];
}

// Labels legíveis para cada categoria (exibição no UI)
const CATEGORIA_LABELS: Record<string, string> = {
  CAMINHOES:     "Caminhões",
  CARRETAS:      "Carretas e Cavalos",
  VEICULOS:      "Veículos de Transporte",
  PAVIMENTACAO:  "Pavimentação",
  FRESAGEM:      "Fresagem",
  USINAGEM:      "Usinagem",
  LINHA_AMARELA: "Linha Amarela",
  PEQUENO_PORTE: "Pequeno Porte",
  SANITARIO:     "Sanitários e Apoio",
};

// Ordem de exibição das categorias
const CATEGORIA_ORDEM = [
  "CAMINHOES", "CARRETAS", "VEICULOS",
  "PAVIMENTACAO", "FRESAGEM", "USINAGEM",
  "LINHA_AMARELA", "PEQUENO_PORTE", "SANITARIO",
];

export function useEquipamentoTipos() {
  const [categorias, setCategorias] = useState<EquipCategoria[]>([]);
  const [tiposFlat, setTiposFlat] = useState<EquipTipo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("equipamento_tipos")
      .select("id, categoria, subtipo, label, icone, ativo")
      .eq("ativo", true)
      .order("categoria")
      .order("label");

    if (!data) { setLoading(false); return; }

    // Enriquecer com tipoValor
    const flat: EquipTipo[] = (data as any[]).map(t => ({
      ...t,
      tipoValor: (t.label as string).toUpperCase(),
    }));

    // Agrupar por categoria na ordem definida
    const map: Record<string, EquipTipo[]> = {};
    flat.forEach(t => {
      if (!map[t.categoria]) map[t.categoria] = [];
      map[t.categoria].push(t);
    });

    const cats: EquipCategoria[] = CATEGORIA_ORDEM
      .filter(k => map[k]?.length)
      .map(k => ({
        key: k,
        label: CATEGORIA_LABELS[k] ?? k,
        tipos: map[k],
      }));

    // Categorias desconhecidas no final
    Object.keys(map).forEach(k => {
      if (!CATEGORIA_ORDEM.includes(k)) {
        cats.push({ key: k, label: CATEGORIA_LABELS[k] ?? k, tipos: map[k] });
      }
    });

    setCategorias(cats);
    setTiposFlat(flat);
    setLoading(false);
  }

  return { categorias, tiposFlat, loading, reload: load };
}
