import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  online: false,
  failParent: false,
  failChild: false,
  failChecklist: false,
  failRdoChild: false,
  insertedParents: [] as Array<Record<string, unknown>>,
  insertedChildren: [] as Array<Record<string, unknown>>,
  insertedChecklist: [] as Array<Record<string, unknown>>,
  insertedRdos: [] as Array<Record<string, unknown>>,
  insertedEfetivo: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/hooks/useOnlineStatus", () => ({ useOnlineStatus: () => state.online }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      upsert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        if (table === "equipment_diaries") {
          if (state.failParent) return Promise.resolve({ error: Error("Servidor indisponível") });
          const parent = payload as Record<string, unknown>;
          if (!state.insertedParents.some((row) => row.id === parent.id)) state.insertedParents.push(parent);
          return Promise.resolve({ error: null });
        }
        if (table === "equipment_time_entries") {
          if (state.failChild) return Promise.resolve({ error: Error("Falha ao salvar apontamento") });
          for (const child of payload as Record<string, unknown>[]) {
            if (!state.insertedChildren.some((row) => row.id === child.id)) state.insertedChildren.push(child);
          }
          return Promise.resolve({ error: null });
        }
        if (table === "checklist_entries") {
          if (state.failChecklist) return Promise.resolve({ error: Error("Falha ao salvar checklist") });
          for (const child of payload as Record<string, unknown>[]) {
            if (!state.insertedChecklist.some((row) => row.id === child.id)) state.insertedChecklist.push(child);
          }
          return Promise.resolve({ error: null });
        }
        if (table === "rdo_diarios" || table === "rdo_efetivo") {
          if (table === "rdo_efetivo" && state.failRdoChild) return Promise.resolve({ error: Error("Falha no efetivo") });
          const destination = table === "rdo_diarios" ? state.insertedRdos : state.insertedEfetivo;
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const row of rows) if (!destination.some((existing) => existing.id === row.id)) destination.push(row);
          return Promise.resolve({ error: null });
        }
        throw new Error(`Gravação inesperada: ${table}`);
      },
      then: (resolve: (result: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return query;
  } },
}));
import { offlineDb } from "@/lib/offlineDb";
import { saveDiaryOffline, saveRdoOffline, useOfflineSync } from "./useOfflineSync";

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  state.online = false;
  state.failParent = false;
  state.failChild = false;
  state.failChecklist = false;
  state.failRdoChild = false;
  state.insertedParents.length = 0;
  state.insertedChildren.length = 0;
  state.insertedChecklist.length = 0;
  state.insertedRdos.length = 0;
  state.insertedEfetivo.length = 0;
  await offlineDb.pendingDiaries.clear();
  await offlineDb.pendingRdos.clear();
  await offlineDb.syncLog.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const example = {
  diaryPayload: { equipment_fleet: "TESTE LOCAL", company_id: "empresa-ficticia", status: "rascunho" },
  timeEntries: [{ startTime: "08:00", activity: "Operação" }],
};

describe("salvar offline e sincronizar quando a conexão volta", () => {
  it("mantém a pendência local até confirmar pai e apontamento no servidor", async () => {
    const { result, rerender } = renderHook(() => useOfflineSync());
    await act(async () => { await saveDiaryOffline(example, "FRESADORA"); });
    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(state.insertedParents).toHaveLength(0);
    state.online = true;
    rerender();
    await waitFor(() => expect(state.insertedChildren).toHaveLength(1));
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(state.insertedParents).toHaveLength(1);
    expect(await offlineDb.pendingDiaries.filter((row) => !row.synced).count()).toBe(0);
  });

  it("não perde a pendência se a gravação remota falhar", async () => {
    state.failParent = true;
    const { result, rerender } = renderHook(() => useOfflineSync());
    await act(async () => { await saveDiaryOffline(example, "FRESADORA"); });
    state.online = true;
    rerender();
    await waitFor(async () => expect((await offlineDb.pendingDiaries.toArray())[0]?.syncError).toBe("Servidor indisponível"));
    expect(state.insertedParents).toHaveLength(0);
    expect(result.current.pendingCount).toBe(1);
  });

  it("não duplica diário nem apontamento quando checklist falha após ambos já terem sido gravados", async () => {
    state.failChecklist = true;
    const { rerender } = renderHook(() => useOfflineSync());
    await act(async () => { await saveDiaryOffline({ ...example, meta: { hasChecklist: true }, checklistResults: [{ itemId: "item-teste", status: "ok", observation: "", photoPreview: null }] }, "FRESADORA"); });
    state.online = true;
    rerender();
    await waitFor(async () => expect((await offlineDb.pendingDiaries.toArray())[0]?.syncError).toBe("Falha ao salvar checklist"));
    state.failChecklist = false;
    state.online = false;
    rerender();
    state.online = true;
    rerender();
    await waitFor(async () => expect((await offlineDb.pendingDiaries.toArray())[0]?.synced).toBe(true));
    expect(state.insertedParents).toHaveLength(1);
    expect(state.insertedChildren).toHaveLength(1);
    expect(state.insertedChecklist).toHaveLength(1);
  });

  it("não duplica RDO quando efetivo falha e depois a fila tenta novamente", async () => {
    state.failRdoChild = true;
    const { rerender } = renderHook(() => useOfflineSync());
    await act(async () => { await saveRdoOffline({
      rdoPayload: { obra_nome: "TESTE LOCAL", company_id: "empresa-ficticia", status_validacao: "enviado" },
      tipoRdo: "RDO", efetivo: [{ funcao: "Operador", nome: "Teste" }],
    }, "RDO"); });
    state.online = true;
    rerender();
    await waitFor(async () => expect((await offlineDb.pendingRdos.toArray())[0]?.syncError).toBe("Falha no efetivo"));
    state.failRdoChild = false;
    state.online = false;
    rerender();
    state.online = true;
    rerender();
    await waitFor(async () => expect((await offlineDb.pendingRdos.toArray())[0]?.synced).toBe(true));
    expect(state.insertedRdos).toHaveLength(1);
    expect(state.insertedEfetivo).toHaveLength(1);
  });
});
