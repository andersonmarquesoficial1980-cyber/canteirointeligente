import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePermissions } from "./usePermissions";

const state = vi.hoisted(() => ({ role: "admin", perms: { is_admin: false, modulo_relatorios: true }, error: null as null | { message: string } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({
        single: async () => ({ data: { role: state.role, company_id: "company" } }),
        maybeSingle: async () => ({ data: state.perms, error: state.error }),
      }) }),
    }),
  },
}));

describe("permissões individuais", () => {
  it("perfil admin legado não ignora as permissões individuais", async () => {
    state.role = "admin";
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions?.is_admin).toBe(false);
    expect(result.current.permissions?.modulo_relatorios).toBe(true);
  });
  it("superadmin continua com acesso total", async () => {
    state.role = "superadmin";
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions?.is_admin).toBe(true);
  });
});
