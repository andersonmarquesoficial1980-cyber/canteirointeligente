import Dexie, { type Table } from "dexie";

export interface PendingDiary {
  id?: number;
  localId: string;
  payload: Record<string, any>;
  equipmentType: string;
  createdAt: string;
  synced: boolean;
  syncError?: string;
}

export interface PendingRdo {
  id?: number;
  localId: string;
  payload: Record<string, any>;
  rdoType: string;
  createdAt: string;
  synced: boolean;
  syncError?: string;
}

export interface SyncLogEntry {
  id?: number;
  type: "diary" | "rdo";
  status: "success" | "error";
  timestamp: string;
  error?: string;
}

class WorkfluxOfflineDB extends Dexie {
  pendingDiaries!: Table<PendingDiary>;
  pendingRdos!: Table<PendingRdo>;
  cachedFuncionarios!: Table<any>;
  cachedEquipamentos!: Table<any>;
  cachedObras!: Table<any>;
  cachedMateriais!: Table<any>;
  syncLog!: Table<SyncLogEntry>;

  constructor() {
    super("workflux-offline");
    this.version(1).stores({
      pendingDiaries: "++id, localId, synced, equipmentType, createdAt",
      pendingRdos: "++id, localId, synced, rdoType, createdAt",
      cachedFuncionarios: "id, nome",
      cachedEquipamentos: "id, tipo",
      cachedObras: "id, nome",
      cachedMateriais: "id, nome",
      syncLog: "++id, type, status, timestamp",
    });
  }
}

export const offlineDb = new WorkfluxOfflineDB();
