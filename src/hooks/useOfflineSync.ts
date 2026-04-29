import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb } from "@/lib/offlineDb";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type SyncState = {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSync: string | null;
};

const LAST_SYNC_KEY = "workflux:last-sync";

let syncInFlight = false;
let cacheBootstrapped = false;

const subscribers = new Set<(state: SyncState) => void>();

let globalState: SyncState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  syncing: false,
  lastSync: typeof localStorage !== "undefined" ? localStorage.getItem(LAST_SYNC_KEY) : null,
};

function emit() {
  for (const callback of subscribers) {
    callback(globalState);
  }
}

function setGlobalState(patch: Partial<SyncState>) {
  globalState = { ...globalState, ...patch };
  emit();
}

function isRemoteUrl(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

async function refreshPendingCount() {
  const [pendingDiaries, pendingRdos] = await Promise.all([
    offlineDb.pendingDiaries.where("synced").equals(false).count(),
    offlineDb.pendingRdos.where("synced").equals(false).count(),
  ]);

  setGlobalState({ pendingCount: pendingDiaries + pendingRdos });
}

async function cacheMainData() {
  const [funcionariosRes, equipamentosRes, obrasRes, materiaisRes, operadoresRes] = await Promise.all([
    supabase.from("funcionarios").select("*").order("nome"),
    supabase.from("maquinas_frota").select("*").order("frota"),
    supabase.from("ogs_reference").select("*").order("ogs_number", { ascending: false }),
    supabase.from("materiais").select("*").order("nome"),
    (supabase as any).from("equipment_type_operators").select("*"),
  ]);

  if (!funcionariosRes.error) {
    await offlineDb.cachedFuncionarios.clear();
    await offlineDb.cachedFuncionarios.bulkPut(funcionariosRes.data || []);
  }

  if (!equipamentosRes.error) {
    await offlineDb.cachedEquipamentos.clear();
    await offlineDb.cachedEquipamentos.bulkPut(equipamentosRes.data || []);
  }

  if (!obrasRes.error) {
    await offlineDb.cachedObras.clear();
    await offlineDb.cachedObras.bulkPut(obrasRes.data || []);
  }

  if (!materiaisRes.error) {
    await offlineDb.cachedMateriais.clear();
    await offlineDb.cachedMateriais.bulkPut(materiaisRes.data || []);
  }

  if (operadoresRes && !operadoresRes.error && offlineDb.cachedOperadoresHabilitados) {
    try {
      await offlineDb.cachedOperadoresHabilitados.clear();
      await offlineDb.cachedOperadoresHabilitados.bulkPut(operadoresRes.data || []);
    } catch (e) {
      console.error("Erro ao cachear operadores:", e);
    }
  }
}

async function syncPendingDiary(item: any) {
  const payload = item.payload || {};
  const diaryPayload = payload.diaryPayload;
  if (!diaryPayload) {
    throw new Error("Payload de diário offline inválido.");
  }

  const { data: diary, error: diaryError } = await supabase
    .from("equipment_diaries")
    .insert(diaryPayload)
    .select("id")
    .single();

  if (diaryError) throw diaryError;

  const diaryId = diary.id;
  const timeEntries = (payload.timeEntries || []) as any[];
  const validTimeEntries = timeEntries.filter((t) => t.startTime && t.activity);
  if (validTimeEntries.length > 0) {
    const rows = validTimeEntries.map((t) => {
      let description = null;
      if (t.activity === "Manutenção") description = t.maintenanceDetails || null;
      else if (t.activity === "Transporte" && payload.meta?.isCarreta) {
        const parts: string[] = [];
        if (t.transportVazio) {
          parts.push("VAZIO");
        } else {
          const equips = [
            t.transportEquip1 === "Outro" ? t.transportEquip1Custom : t.transportEquip1,
            t.transportEquip2 === "Outro" ? t.transportEquip2Custom : t.transportEquip2,
            t.transportEquip3 === "Outro" ? t.transportEquip3Custom : t.transportEquip3,
          ].filter(Boolean);
          if (equips.length > 0) parts.push(equips.join(", "));
        }
        if (t.origin && t.destination && t.origin === t.destination && t.transportInternalDetails) {
          parts.push(`Trecho: ${t.transportInternalDetails}`);
        }
        if (t.destination === "BASE / PÁTIO CENTRAL" && t.returnReason) {
          parts.push(`Retorno: ${t.returnReason}`);
          if (t.returnReason === "Manutenção / Oficina" && t.returnDetails) {
            parts.push(`Detalhe: ${t.returnDetails}`);
          }
        }
        description = parts.length > 0 ? parts.join(" | ") : null;
      } else if (t.activity === "Transporte") {
        const parts: string[] = [];
        if (t.transportObs) parts.push(t.transportObs);
        if (t.destination === "BASE / PÁTIO CENTRAL" && t.returnReason) {
          parts.push(`Retorno: ${t.returnReason}`);
          if (t.returnReason === "Manutenção / Oficina" && t.returnDetails) {
            parts.push(`Detalhe: ${t.returnDetails}`);
          }
        }
        description = parts.length > 0 ? parts.join(" | ") : null;
      }

      return {
        diary_id: diaryId,
        start_time: t.startTime,
        end_time: t.endTime || null,
        activity: t.activity,
        description,
        origin: t.origin || null,
        destination: t.destination || null,
        ogs_destination: t.transportOgs || null,
      };
    });

    const { error } = await supabase.from("equipment_time_entries").insert(rows);
    if (error) throw error;
  }

  if (payload.meta?.isUsinaKma) {
    const validKma = ((payload.kmaEntries || []) as any[]).filter((e) => e.pesoNominal || e.pesoReal);
    if (validKma.length > 0) {
      const rows = validKma.map((entry) => ({
        equipment_diary_id: diaryId,
        attempt_number: entry.tentativa,
        nominal_weight_usina: entry.pesoNominal ? Number(entry.pesoNominal) : null,
        real_weight_reference: entry.pesoReal ? Number(entry.pesoReal) : null,
        truck_tara: entry.tara ? Number(entry.tara) : null,
        adjustment_factor: entry.fator ? Number(entry.fator) : null,
        ticket_photo_url: isRemoteUrl(entry.ticketPhotoPreview) ? entry.ticketPhotoPreview : null,
      }));
      const { error } = await supabase.from("kma_calibration_entries").insert(rows);
      if (error) throw error;
    }

    const kmaOperation = payload.kmaOperation;
    if (kmaOperation?.operationType) {
      const { error } = await supabase.from("kma_operations").insert({
        diary_id: diaryId,
        operation_type: kmaOperation.operationType,
        cap_type: kmaOperation.capType || null,
        cap_supplier: kmaOperation.capSupplier || null,
        cap_qty_ton: kmaOperation.capQtyTon ? Number(kmaOperation.capQtyTon) : null,
        cap_nf_number: kmaOperation.capNfNumber || null,
        filer_type: kmaOperation.filerType || null,
        filer_supplier: kmaOperation.filerSupplier || null,
        filer_qty_ton: kmaOperation.filerQtyTon ? Number(kmaOperation.filerQtyTon) : null,
        silo1_material: kmaOperation.silo1Material || null,
        silo1_qty: kmaOperation.silo1Qty ? Number(kmaOperation.silo1Qty) : null,
        silo2_material: kmaOperation.silo2Material || null,
        silo2_qty: kmaOperation.silo2Qty ? Number(kmaOperation.silo2Qty) : null,
        water_liters: kmaOperation.waterLiters ? Number(kmaOperation.waterLiters) : null,
        water_supplier: kmaOperation.waterSupplier || null,
        aggregates_supplier: kmaOperation.aggregatesSupplier || null,
        total_volume_machined_ton: kmaOperation.totalVolumeMachinedTon
          ? Number(kmaOperation.totalVolumeMachinedTon)
          : null,
      });
      if (error) throw error;
    }
  }

  if (payload.meta?.isFresadora) {
    const validAreas = ((payload.productionAreas || []) as any[]).filter((a) => a.comp || a.larg);
    if (validAreas.length > 0) {
      const rows = validAreas.map((a) => ({
        diary_id: diaryId,
        length_m: a.comp ? Number(a.comp) : null,
        width_m: a.larg ? Number(a.larg) : null,
        thickness_cm: a.esp ? Number(a.esp) : null,
      }));
      const { error } = await supabase.from("equipment_production_areas").insert(rows);
      if (error) throw error;
    }

    const validBits = ((payload.bits || []) as any[]).filter((b) => b.brand);
    if (validBits.length > 0) {
      const rows = validBits.map((b) => ({
        diary_id: diaryId,
        brand: b.brand,
        quantity: Number(b.quantity) || 0,
        status: b.status,
        horimeter: b.horimeter || null,
      }));
      const { error } = await supabase.from("bit_entries").insert(rows);
      if (error) throw error;
    }
  }

  if ((payload.meta?.isBobcat || payload.meta?.isRetro) && payload.attachmentType) {
    const attachValue =
      payload.meta?.isBobcat && payload.attachmentId
        ? `${payload.attachmentType} — ${payload.attachmentId}`
        : payload.attachmentType;

    await supabase.from("equipment_attachments" as any).insert({
      fleet_id: payload.selectedFleet,
      type: attachValue,
    });
  }

  if (payload.meta?.hasChecklist && Array.isArray(payload.checklistResults) && payload.checklistResults.length > 0) {
    const checklistRows = payload.checklistResults.map((cr: any) => ({
      diary_id: diaryId,
      item_id: cr.itemId,
      status: cr.status,
      observation: cr.observation || null,
      photo_url: isRemoteUrl(cr.photoPreview) ? cr.photoPreview : null,
    }));

    const { error } = await supabase.from("checklist_entries").insert(checklistRows);
    if (error) throw error;
  }

  if (payload.meta?.isPipa || payload.meta?.isEspargidor) {
    const validSupplies = ((payload.tankSupplies || []) as any[]).filter((s) => s.quantity || s.supplier);
    if (validSupplies.length > 0) {
      const rows = validSupplies.map((s) => ({
        diary_id: diaryId,
        quantity: s.quantity ? Number(s.quantity) : null,
        supplier: s.supplier || null,
        emulsion_type: s.emulsionType || null,
        material_type: payload.meta?.isPipa ? "Água" : "Emulsão",
      }));

      const { error } = await supabase.from("truck_tank_supplies").insert(rows);
      if (error) throw error;
    }
  }

  if (payload.meta?.isComboio) {
    if (payload.comboioSaldoInicial || payload.comboioFornecedor) {
      const { error } = await supabase.from("truck_tank_supplies").insert({
        diary_id: diaryId,
        quantity: payload.comboioSaldoInicial ? Number(payload.comboioSaldoInicial) : null,
        supplier: payload.comboioFornecedor || null,
        material_type: "Diesel",
      });
      if (error) throw error;
    }

    const validRefuels = ((payload.comboioRefuels || []) as any[]).filter((r) => r.fleetFueled || r.litersFueled);
    if (validRefuels.length > 0) {
      const rows = validRefuels.map((r) => ({
        diary_id: diaryId,
        equipment_fleet_fueled: r.fleetFueled || null,
        equipment_meter: r.equipmentMeter ? Number(r.equipmentMeter) : null,
        ogs_destination: r.ogsDestination || null,
        liters_fueled: r.litersFueled ? Number(r.litersFueled) : null,
        is_lubricated: !!r.isLubricated,
        is_washed: !!r.isWashed,
        initial_diesel_balance: payload.comboioSaldoInicial ? Number(payload.comboioSaldoInicial) : null,
      }));

      const { error } = await supabase.from("comboio_equipment_refueling").insert(rows);
      if (error) throw error;

      if (!payload.meta?.isDraft) {
        const abastRows = validRefuels
          .filter((r) => r.fleetFueled && r.litersFueled)
          .map((r) => ({
            equipment_fleet: r.fleetFueled,
            equipment_type: r.tipoEquipamento || null,
            data: payload.date,
            hora: r.hora || null,
            litros: Number(r.litersFueled),
            horimetro: r.equipmentMeter ? Number(r.equipmentMeter) : null,
            fonte: "comboio",
            comboio_fleet: payload.normalizedSelectedFleet,
            lubrificado: !!r.isLubricated,
            lavado: !!r.isWashed,
            ogs: r.ogsDestination || null,
            diary_id: diaryId,
          }));

        if (abastRows.length > 0) {
          const { error: abastError } = await supabase.from("abastecimentos").insert(abastRows as any);
          if (abastError) throw abastError;
        }
      }
    }
  }
}

async function syncPendingRdo(item: any) {
  const payload = item.payload || {};
  const rdoPayload = payload.rdoPayload;
  if (!rdoPayload) {
    throw new Error("Payload de RDO offline inválido.");
  }

  const { data: rdo, error: rdoError } = await supabase
    .from("rdo_diarios")
    .insert(rdoPayload)
    .select("id")
    .single();

  if (rdoError) throw rdoError;

  const rdoId = rdo.id;

  if (payload.tipoRdo === "INFRAESTRUTURA") {
    const entries = ((payload.infraProducao || []) as any[])
      .filter((p) => p.comprimento_m || p.largura_m)
      .map((p) => ({
        rdo_id: rdoId,
        tipo_servico: payload.tipoServico || null,
        sentido: p.sentido || null,
        faixa: p.estaca_inicial || null,
        km_inicial: p.estaca_inicial ? parseFloat(p.estaca_inicial) : null,
        km_final: p.estaca_final ? parseFloat(p.estaca_final) : null,
        comprimento_m: p.comprimento_m ? parseFloat(p.comprimento_m) : null,
        largura_m: p.largura_m ? parseFloat(p.largura_m) : null,
        espessura_cm: p.espessura_cm ? parseFloat(p.espessura_cm) : null,
      }));

    if (entries.length > 0) {
      const { error } = await supabase.from("rdo_producao").insert(entries);
      if (error) throw error;
    }
  }

  if (payload.tipoRdo === "CAUQ") {
    const entries = ((payload.producaoCauq?.trechos || []) as any[])
      .filter((t) => t.comprimento_m || t.largura_m || t.tipo_servico)
      .map((t) => ({
        rdo_id: rdoId,
        tipo_servico: t.tipo_servico || null,
        sentido: t.sentido_faixa || null,
        faixa: t.sentido_faixa || null,
        km_inicial: t.estaca_inicial ? parseFloat(t.estaca_inicial) : null,
        km_final: t.estaca_final ? parseFloat(t.estaca_final) : null,
        comprimento_m: t.comprimento_m ? parseFloat(t.comprimento_m) : null,
        largura_m: t.largura_m ? parseFloat(t.largura_m) : null,
        espessura_cm: t.espessura_m ? parseFloat(t.espessura_m) : null,
      }));

    if (entries.length > 0) {
      const { error } = await supabase.from("rdo_producao").insert(entries);
      if (error) throw error;
    }
  }

  const efetivoEntries = ((payload.efetivo || []) as any[])
    .filter((e) => e.funcao)
    .map((e) => ({
      rdo_id: rdoId,
      funcao: e.funcao,
      quantidade: 1,
      entrada: payload.globalEntrada || null,
      saida: payload.globalSaida || null,
    }));

  if (efetivoEntries.length > 0) {
    const { error } = await supabase.from("rdo_efetivo").insert(efetivoEntries);
    if (error) throw error;
  }
}

async function runSync(isOnline: boolean) {
  if (!isOnline || syncInFlight) return;

  syncInFlight = true;
  setGlobalState({ syncing: true });

  try {
    const pendingDiaries = await offlineDb.pendingDiaries.where("synced").equals(false).sortBy("createdAt");
    for (const pendingDiary of pendingDiaries) {
      try {
        await syncPendingDiary(pendingDiary);
        await offlineDb.pendingDiaries.update(pendingDiary.id as number, {
          synced: true,
          syncError: undefined,
        });
        await offlineDb.syncLog.add({
          type: "diary",
          status: "success",
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        await offlineDb.pendingDiaries.update(pendingDiary.id as number, {
          syncError: error?.message || "Falha ao sincronizar diário",
        });
        await offlineDb.syncLog.add({
          type: "diary",
          status: "error",
          timestamp: new Date().toISOString(),
          error: error?.message || "Falha ao sincronizar diário",
        });
      }
    }

    const pendingRdos = await offlineDb.pendingRdos.where("synced").equals(false).sortBy("createdAt");
    for (const pendingRdo of pendingRdos) {
      try {
        await syncPendingRdo(pendingRdo);
        await offlineDb.pendingRdos.update(pendingRdo.id as number, {
          synced: true,
          syncError: undefined,
        });
        await offlineDb.syncLog.add({
          type: "rdo",
          status: "success",
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        await offlineDb.pendingRdos.update(pendingRdo.id as number, {
          syncError: error?.message || "Falha ao sincronizar RDO",
        });
        await offlineDb.syncLog.add({
          type: "rdo",
          status: "error",
          timestamp: new Date().toISOString(),
          error: error?.message || "Falha ao sincronizar RDO",
        });
      }
    }

    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);
    setGlobalState({ lastSync: now });
    await refreshPendingCount();
  } finally {
    setGlobalState({ syncing: false });
    syncInFlight = false;
  }
}

export async function saveDiaryOffline(payload: Record<string, any>, equipmentType: string) {
  await offlineDb.pendingDiaries.add({
    localId: crypto.randomUUID(),
    payload,
    equipmentType,
    createdAt: new Date().toISOString(),
    synced: false,
  });

  await refreshPendingCount();
}

export async function saveRdoOffline(payload: Record<string, any>, rdoType: string) {
  await offlineDb.pendingRdos.add({
    localId: crypto.randomUUID(),
    payload,
    rdoType,
    createdAt: new Date().toISOString(),
    synced: false,
  });

  await refreshPendingCount();
}

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [state, setState] = useState<SyncState>({ ...globalState });

  useEffect(() => {
    subscribers.add(setState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  useEffect(() => {
    setGlobalState({ isOnline });
  }, [isOnline]);

  useEffect(() => {
    refreshPendingCount().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!cacheBootstrapped) {
      cacheBootstrapped = true;
      cacheMainData().catch(() => undefined);
      return;
    }

    if (isOnline) {
      cacheMainData().catch(() => undefined);
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      runSync(true).catch(() => undefined);
    }
  }, [isOnline]);

  return useMemo(
    () => ({
      isOnline: state.isOnline,
      pendingCount: state.pendingCount,
      syncing: state.syncing,
      lastSync: state.lastSync,
    }),
    [state.isOnline, state.pendingCount, state.syncing, state.lastSync],
  );
}
