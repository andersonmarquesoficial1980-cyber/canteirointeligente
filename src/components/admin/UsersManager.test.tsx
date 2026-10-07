import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UsersManager from "./UsersManager";

const state = vi.hoisted(() => ({
  upsert: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
  existingPermission: null as null | { user_id: string },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "test" } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "profiles" ? { company_id: "c1" } : state.existingPermission, error: null }) }), order: async () => ({ data: table === "profiles" ? [{
        id: "p1", user_id: "u1", nome_completo: "Pessoa Teste", email: "teste@fremix.workflux.app",
        perfil: "Usuário", status: "ativo", role: "user",
      }] : [] }) }),
      update: (value: unknown) => { state.update(value); return { eq: async () => ({ error: null }) }; },
      upsert: state.upsert,
      insert: state.insert,
    }),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/hooks/useImpersonation", () => ({ startImpersonation: vi.fn() }));

beforeEach(() => { state.upsert.mockReset(); state.insert.mockReset().mockResolvedValue({ error: null }); state.update.mockReset(); state.toast.mockReset(); state.existingPermission = null; });

describe("edição de usuário não altera permissões", () => {
  it("salvar nome sem mudar perfil não reaplica permissões-padrão", async () => {
    render(<UsersManager />);
    await waitFor(() => expect(screen.getByText("Pessoa Teste")).toBeTruthy());
    fireEvent.click(screen.getByTitle("Editar usuário"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(state.update).toHaveBeenCalled());
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it("reativar cadastro não substitui permissões individuais antigas pelo perfil padrão", async () => {
    state.existingPermission = { user_id: "u1" };
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { user_id: "u1" }, error: null } as never);
    render(<UsersManager />);
    fireEvent.change(screen.getByPlaceholderText("usuario ou email@empresa.com"), { target: { value: "pessoa" } });
    fireEvent.change(screen.getByPlaceholderText("Mínimo 6 caracteres"), { target: { value: "senha-ficticia" } });
    fireEvent.change(screen.getByPlaceholderText("Nome do funcionário"), { target: { value: "Pessoa Teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Usuário" }));
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalled());
    await waitFor(() => expect(state.toast).toHaveBeenCalled());
    expect(state.upsert).not.toHaveBeenCalled();
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("novo usuário ganha permissão inicial com empresa explícita", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { user_id: "u2" }, error: null } as never);
    render(<UsersManager />);
    fireEvent.change(screen.getByPlaceholderText("usuario ou email@empresa.com"), { target: { value: "novo" } });
    fireEvent.change(screen.getByPlaceholderText("Mínimo 6 caracteres"), { target: { value: "senha-ficticia" } });
    fireEvent.change(screen.getByPlaceholderText("Nome do funcionário"), { target: { value: "Pessoa Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Usuário" }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u2", company_id: "c1" })));
    expect(state.upsert).not.toHaveBeenCalled();
  });
});
