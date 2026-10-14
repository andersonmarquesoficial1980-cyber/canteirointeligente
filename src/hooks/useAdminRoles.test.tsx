import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ selects: [] as Array<[string, string]>, employeeIds: [] as string[] }));
vi.mock("./useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: "empresa1" } }) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let selection = "";
    const q = {
      select: (fields: string) => { selection = fields; state.selects.push([table, fields]); return q; },
      eq: () => q, order: () => q, limit: () => q,
      in: (_column: string, ids: string[]) => { state.employeeIds = ids; return q; },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const invalid = table === "user_admin_roles" && selection.includes("employees(");
        const data = table === "user_admin_roles" ? [{ id: "u1", employee_id: "e1", role_id: "r1", assigned_at: "2026-10-01", admin_roles: { name: "RH", description: null } }]
          : table === "employees" ? [{ id: "e1", name: "Ana", matricula: "001" }] : [];
        return Promise.resolve({ data: invalid ? null : data, error: invalid ? { message: "relationship does not exist" } : null }).then(resolve, reject);
      },
    };
    return q;
  },
} }));
import { useAdminRoles } from "./useAdminRoles";
afterEach(() => { cleanup(); state.selects = []; state.employeeIds = []; });

describe("funções administrativas por funcionário", () => {
  it("enriquece nomes pela tabela employees sem depender de relacionamento inexistente", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAdminRoles(), { wrapper });
    await waitFor(() => expect(result.current.userRoles[0]?.employees?.name).toBe("Ana"));
    expect(state.selects.find(([table]) => table === "user_admin_roles")?.[1]).not.toContain("employees(");
    expect(state.employeeIds).toEqual(["e1"]);
    queryClient.clear();
  });
});
