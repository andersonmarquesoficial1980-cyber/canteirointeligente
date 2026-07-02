import { supabase } from "@/integrations/supabase/client";

/**
 * Busca equipamentos de um RDO específico
 * Estratégia: Tenta rdo_equipamentos primeiro, depois equipment_diaries
 * @param rdoId - ID do RDO
 * @param rdoData - Data do RDO (para buscar em equipment_diaries)
 * @param ogsNumber - OGS number (para buscar em equipment_diaries)
 * @param companyId - Company ID
 * @returns Lista de equipamentos com estrutura normalizada
 */
export async function fetchEquipmentosRdo(
  rdoId: string,
  rdoData: string,
  ogsNumber: string,
  companyId: string
) {
  try {
    // Tentar rdo_equipamentos primeiro (mais rápido e específico)
    const { data: rdoEquips, error: rdoErr } = await supabase
      .from("rdo_equipamentos")
      .select("frota, categoria, tipo, nome, empresa_dona, rdo_id, patrimonio, sub_tipo")
      .eq("company_id", companyId)
      .eq("rdo_id", rdoId);

    if (rdoErr) {
      console.error("[ERROR] rdo_equipamentos query failed:", rdoErr);
      return [];
    }

    if (rdoEquips && rdoEquips.length > 0) {
      console.log(`[DEBUG] Found ${rdoEquips.length} equipment from rdo_equipamentos`);
      return rdoEquips.map(normalizeEquipment);
    }

    // Fallback: equipment_diaries
    console.log("[DEBUG] No equipment in rdo_equipamentos, trying equipment_diaries...");
    const { data: edEquips, error: edErr } = await supabase
      .from("equipment_diaries")
      .select("equipment_fleet, equipment_type, ogs_number, date, operator_name, period")
      .eq("company_id", companyId)
      .eq("date", rdoData)
      .eq("ogs_number", ogsNumber);

    if (edErr) {
      console.error("[ERROR] equipment_diaries query failed:", edErr);
      return [];
    }

    if (edEquips && edEquips.length > 0) {
      console.log(`[DEBUG] Found ${edEquips.length} equipment from equipment_diaries`);
      return edEquips.map((ed: any) => ({
        frota: ed.equipment_fleet,
        tipo: ed.equipment_type,
        nome: null,
        categoria: null,
        empresa_dona: null,
        patrimonio: null,
        sub_tipo: null,
        _source: "equipment_diaries",
      }));
    }

    console.log("[DEBUG] No equipment found in either table");
    return [];
  } catch (err) {
    console.error("[ERROR] fetchEquipmentosRdo exception:", err);
    return [];
  }
}

/**
 * Normaliza estrutura de equipamento para formato padrão
 */
export function normalizeEquipment(equip: any) {
  return {
    frota: equip.frota || "",
    tipo: equip.tipo || null,
    nome: equip.nome || null,
    categoria: equip.categoria || null,
    empresa_dona: equip.empresa_dona || null,
    patrimonio: equip.patrimonio || null,
    sub_tipo: equip.sub_tipo || null,
    _source: "rdo_equipamentos",
  };
}

/**
 * Formata nome do equipamento para exibição
 * @param equip - Objeto de equipamento normalizado
 * @returns String formatada
 */
export function formatEquipmentName(equip: any): string {
  const parts = [];
  
  if (equip.tipo) parts.push(equip.tipo);
  if (equip.categoria && equip.categoria !== equip.tipo) parts.push(equip.categoria);
  if (equip.sub_tipo) parts.push(`(${equip.sub_tipo})`);
  if (equip.nome) parts.push(`— ${equip.nome}`);
  
  return parts.length > 0 ? parts.join(" ") : "-";
}

/**
 * Busca e mapeia equipamentos para um filtro específico
 * @param filterType - Tipo de filtro (frota/obra/encarregado)
 * @param filterValue - Valor do filtro
 * @param dataIni - Data inicial
 * @param dataFim - Data final
 * @param companyId - Company ID
 * @returns Array de ResultRow normalizado
 */
export async function searchEquipmentosRdo(
  filterType: "frota" | "obra" | "encarregado",
  filterValue: string,
  dataIni: string,
  dataFim: string,
  companyId: string
) {
  // Passo 1: Buscar RDOs
  let rdoQuery = supabase
    .from("rdo_diarios")
    .select("id, data, obra_nome, turno, encarregado, user_id")
    .eq("company_id", companyId);

  if (filterType === "obra") {
    rdoQuery = rdoQuery.ilike("obra_nome", `%${filterValue}%`);
  } else if (filterType === "encarregado") {
    rdoQuery = rdoQuery.eq("encarregado", filterValue);
  }

  if (dataIni) rdoQuery = rdoQuery.gte("data", dataIni);
  if (dataFim) rdoQuery = rdoQuery.lte("data", dataFim);

  const { data: rdos, error: rdoErr } = await rdoQuery;
  if (rdoErr) throw rdoErr;

  if (!rdos || rdos.length === 0) {
    return [];
  }

  // Passo 2: Mapear RDOs por ID
  const rdoMap: Record<string, any> = {};
  const rdoIds: string[] = [];
  
  rdos.forEach((rdo: any) => {
    rdoMap[rdo.id] = rdo;
    rdoIds.push(rdo.id);
  });

  // Passo 3: Buscar equipamentos
  let equipQuery = supabase
    .from("rdo_equipamentos")
    .select("frota, categoria, tipo, nome, empresa_dona, rdo_id")
    .eq("company_id", companyId)
    .in("rdo_id", rdoIds);

  if (filterType === "frota") {
    equipQuery = equipQuery.ilike("frota", `%${filterValue}%`);
  }

  const { data: equips, error: equipErr } = await equipQuery;
  if (equipErr) throw equipErr;

  // Passo 4: Buscar employees para resolver nomes
  const userIds = rdos.map((r: any) => r.user_id).filter(Boolean);
  let employeeMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: emps } = await supabase
      .from("employees")
      .select("id, name")
      .in("id", userIds);

    (emps || []).forEach((e: any) => {
      employeeMap[e.id] = e.name || "N/A";
    });
  }

  // Passo 5: Mapear resultado
  let result: any[] = [];

  if (equips && equips.length > 0) {
    result = equips.map((e: any) => {
      const rdo = rdoMap[e.rdo_id];
      const apontador = (rdo?.user_id && employeeMap[rdo.user_id]) || rdo?.encarregado || null;
      return {
        data: rdo?.data || "",
        ogs: rdo?.obra_nome || "",
        apontador,
        frota: e.frota || "",
        equipamento: e.nome || e.tipo || e.categoria || null,
        empresa: e.empresa_dona || null,
        turno: rdo?.turno || null,
      };
    });
  } else {
    // Sem equipamentos, ainda retorna RDO vazio
    result = rdos.map((rdo: any) => {
      const apontador = (rdo.user_id && employeeMap[rdo.user_id]) || rdo.encarregado || null;
      return {
        data: rdo.data || "",
        ogs: rdo.obra_nome || "",
        apontador,
        frota: "",
        equipamento: null,
        empresa: null,
        turno: rdo.turno || null,
      };
    });
  }

  // Sortear por data descending
  result.sort((a, b) => b.data.localeCompare(a.data));

  return result;
}
