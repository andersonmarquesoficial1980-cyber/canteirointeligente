import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { offlineDb } from "./offlineDb";

beforeEach(async () => {
  await offlineDb.pendingDiaries.clear();
  await offlineDb.pendingRdos.clear();
});
afterAll(async () => { await offlineDb.delete(); });

describe("fila offline no IndexedDB real (ambiente isolado)", () => {
  it("persiste, ordena e conta somente os diários e RDOs ainda não sincronizados", async () => {
    await offlineDb.pendingDiaries.bulkAdd([
      { localId: "mais-recente", equipmentType: "fresadora", payload: {}, createdAt: "2026-10-14T12:00:00Z", synced: false },
      { localId: "mais-antigo", equipmentType: "fresadora", payload: {}, createdAt: "2026-10-13T12:00:00Z", synced: false },
      { localId: "finalizado", equipmentType: "fresadora", payload: {}, createdAt: "2026-10-12T12:00:00Z", synced: true },
    ]);
    await offlineDb.pendingRdos.add({ localId: "rdo1", rdoType: "infra", payload: {}, createdAt: "2026-10-14T12:00:00Z", synced: false });

    const diarios = await offlineDb.pendingDiaries.filter((row) => !row.synced).sortBy("createdAt");
    const rdos = await offlineDb.pendingRdos.filter((row) => !row.synced).count();
    expect(diarios.map((row) => row.localId)).toEqual(["mais-antigo", "mais-recente"]);
    expect(rdos).toBe(1);

    await offlineDb.pendingDiaries.update(diarios[0].id!, { synced: true });
    expect(await offlineDb.pendingDiaries.filter((row) => !row.synced).count()).toBe(1);
  });
});
