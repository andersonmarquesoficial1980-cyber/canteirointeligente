import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ selects: [] as Array<[string, string]>, userIds: [] as string[], filters: [] as Array<[string, unknown]> }));
vi.mock("./useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: "empresa1" } }) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let selection = "";
    const q = {
      select: (fields: string) => { selection = fields; state.selects.push([table, fields]); return q; },
      eq: (column: string, value: unknown) => { if (table === "profiles") state.filters.push([column, value]); return q; }, order: () => q, limit: () => q,
      in: (_column: string, ids: string[]) => { state.userIds = ids; return q; },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const invalid = table === "user_admin_roles" && selection.includes("employees(");
        const data = table === "user_admin_roles" ? [{ id: "r1", employee_id: "u1", user_id: "u1", role_id: "funcao1", assigned_at: "2026-10-01", admin_roles: { name: "RH", description: null } }]
          : table === "profiles" ? [{ user_id: "u1", nome_completo: "Ana" }] : [];
        return Promise.resolve({ data: invalid ? null : data, error: invalid ? { message: "relationship does not exist" } : null }).then(resolve, reject);
      },
    };
    return q;
  },
} }));
import { useAdminRoles } from "./useAdminRoles";
afterEach(() => { cleanup(); state.selects = []; state.userIds = []; state.filters = []; });

describe("funções administrativas por conta", () => {
  it("identifica a conta pelo profiles.user_id dentro da empresa, sem assumir employees.id", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAdminRoles(), { wrapper });
    await waitFor(() => expect(result.current.userRoles[0]?.accounts?.name).toBe("Ana"));
    expect(state.selects.find(([table]) => table === "user_admin_roles")?.[1]).not.toContain("employees(");
    expect(state.selects.some(([table]) => table === "profiles")).toBe(true);
    expect(state.selects.some(([table]) => table === "employees")).toBe(false);
    expect(state.filters).toContainEqual(["company_id", "empresa1"]);
    expect(state.userIds).toEqual(["u1"]);
    queryClient.clear();
  });
});
