import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  diaries: [] as Array<{ synced: boolean; payload: unknown }>,
  rdos: [] as Array<{ synced: boolean }>,
  where: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/offlineDb", () => {
  const table = (rows: Array<{ synced: boolean }>) => ({
    add: async (row: { synced: boolean; payload: unknown }) => { rows.push(row); },
    where: state.where,
    filter: (fn: (item: { synced: boolean }) => boolean) => ({
      count: async () => rows.filter(fn).length,
      sortBy: async () => rows.filter(fn),
    }),
  });
  return { offlineDb: { pendingDiaries: table(state.diaries), pendingRdos: table(state.rdos) } };
});
import { saveDiaryOffline } from "./useOfflineSync";
beforeEach(() => { state.diaries.length = 0; state.rdos.length = 0; state.where.mockReset(); });

describe("fila de sincronização offline", () => {
  it("conta pendências sem consultar o índice booleano inválido do IndexedDB", async () => {
    await expect(saveDiaryOffline({ diaryPayload: { id: "d1" } }, "FRESADORA")).resolves.toBeUndefined();
    expect(state.diaries).toHaveLength(1);
    expect(state.where).not.toHaveBeenCalled();
  });
});
