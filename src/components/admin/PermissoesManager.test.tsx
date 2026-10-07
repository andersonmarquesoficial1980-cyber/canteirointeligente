import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PermissoesManager from "./PermissoesManager";

const state = vi.hoisted(() => ({
  permissionsError: null as null | { message: string },
  rows: [] as Record<string, unknown>[],
  upsert: vi.fn(),
  update: vi.fn(),
  saveResult: null as null | Record<string, unknown>,
  ranges: [] as { table: string; start: number }[],
  rowsByPage: null as null | Record<number, Record<string, unknown>[]>,
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        range: (start: number) => {
          state.ranges.push({ table, start });
          const result = table === "profiles"
            ? { data: [{ user_id: "u1", nome_completo: "Teste Acesso", email: "teste@empresa.com", role: "user", company_id: "c1" }], error: null }
            : { data: state.rowsByPage?.[start] ?? state.rows, error: state.permissionsError };
          const query = { order: () => query, then: (resolve: (x: typeof result) => void) => Promise.resolve(result).then(resolve) };
          return query;
        },
        order: async () => ({ data: [], error: null }),
      }),
      upsert: state.upsert,
      update: (payload: unknown) => {
        state.update(payload);
        const query = { eq: () => query, is: () => query, select: () => ({ maybeSingle: async () => ({ data: state.saveResult, error: null }) }) };
        return query;
      },
    }),
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));

beforeEach(() => {
  state.rows = [];
  state.permissionsError = null;
  state.saveResult = null;
  state.ranges = [];
  state.rowsByPage = null;
  state.upsert.mockReset();
  state.update.mockReset();
  state.toast.mockReset();
});

describe("Painel de Controle — Permissões", () => {
  it("não mostra zero nem permite salvar quando a consulta de permissões falha", async () => {
    state.permissionsError = { message: "Erro temporário de leitura" };
    render(<PermissoesManager />);
    await waitFor(() => expect(screen.getByText(/Erro temporário de leitura/)).toBeTruthy());
    expect(screen.queryByText("0 módulos ativos")).toBeNull();
    expect(screen.queryByRole("button", { name: /Salvar Permissões/ })).toBeNull();
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("não permite transformar ausência de registro em concessões zeradas por um clique em Salvar", async () => {
    render(<PermissoesManager />);
    await waitFor(() => expect(screen.getByText("Teste Acesso")).toBeTruthy());
    fireEvent.click(screen.getByText("Teste Acesso"));
    expect(screen.queryByRole("button", { name: /Salvar Permissões/ })).toBeNull();
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("não confirma salvamento quando a atualização afeta zero linhas", async () => {
    state.rows = [{ user_id: "u1", updated_at: "2026-10-01T12:00:00Z", is_admin: false, modulo_obras: true }];
    render(<PermissoesManager />);
    await waitFor(() => expect(screen.getByText("Teste Acesso")).toBeTruthy());
    fireEvent.click(screen.getByText("Teste Acesso"));
    fireEvent.click(screen.getByText("WF Obras"));
    fireEvent.click(screen.getByRole("button", { name: /Salvar Permissões/ }));
    await waitFor(() => expect(state.toast).toHaveBeenCalled());
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ modulo_obras: false }));
    expect(screen.queryByText("Permissões salvas!")).toBeNull();
  });

  it("não perde permissões que estão na página seguinte do banco", async () => {
    state.rowsByPage = {
      0: Array.from({ length: 500 }, (_, n) => ({ user_id: `other-${n}`, is_admin: false })),
      500: [{ user_id: "u1", is_admin: false, modulo_obras: true }],
    };
    render(<PermissoesManager />);
    await waitFor(() => expect(screen.getByText("1 módulo ativo")).toBeTruthy());
    expect(state.ranges).toContainEqual({ table: "user_permissions", start: 500 });
  });

  it("Marcar todos não concede acesso de administrador", async () => {
    state.rows = [{ user_id: "u1", updated_at: "2026-10-01T12:00:00Z", is_admin: false, modulo_obras: false, equipamentos_permitidos: [], relatorios_permitidos: null }];
    render(<PermissoesManager />);
    await waitFor(() => expect(screen.getByText("Teste Acesso")).toBeTruthy());
    fireEvent.click(screen.getByText("Teste Acesso"));
    fireEvent.click(screen.getByText("Marcar todos"));
    expect((screen.getByLabelText("Administrador (acesso total)") as HTMLInputElement).checked).toBe(false);
  });

  it("salva só o campo alterado sem apagar outras concessões", async () => {
    state.rows = [{ user_id: "u1", updated_at: "2026-10-01T12:00:00Z", is_admin: false, modulo_obras: true, modulo_engenharia: true, equipamentos_permitidos: [], relatorios_permitidos: null }];
    state.saveResult = { ...state.rows[0], modulo_obras: false, updated_at: "2026-10-07T12:00:00Z" };
    render(<PermissoesManager />);
    await waitFor(() => expect(screen.getByText("Teste Acesso")).toBeTruthy());
    fireEvent.click(screen.getByText("Teste Acesso"));
    fireEvent.click(screen.getByText("WF Obras"));
    fireEvent.click(screen.getByRole("button", { name: /Salvar Permissões/ }));
    await waitFor(() => expect(screen.getByText("Permissões salvas!")).toBeTruthy());
    const payload = state.update.mock.calls[0][0];
    expect(payload.modulo_obras).toBe(false);
    expect(payload).not.toHaveProperty("modulo_engenharia");
    expect(payload).not.toHaveProperty("is_admin");
  });
});
