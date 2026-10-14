import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const mock = vi.hoisted(() => ({ revokeRole: vi.fn() }));
vi.mock("@/hooks/useAdminRoles", () => ({ useAdminRoles: () => ({
  roles: [], rolesLoading: false, permissions: [], userRoles: [{
    id: "u1", employee_id: "e1", role_id: "r1", employees: { name: "Ana", matricula: "001" },
    admin_roles: { name: "RH", description: "RH" }, scope_sector: null, assigned_at: "2026-10-01",
  }], userRolesLoading: false, auditLog: [],
  createRole: vi.fn(), createRoleLoading: false, addPermission: vi.fn(), addPermissionLoading: false,
  assignRole: vi.fn(), assignRoleLoading: false, revokeRole: mock.revokeRole, revokeRoleLoading: false,
}) }));
import { AdminRolesManager } from "./AdminRolesManager";
afterEach(() => { cleanup(); mock.revokeRole.mockReset(); });

describe("revogação de função administrativa", () => {
  it("pede confirmação antes de revogar e não apresenta ações duplicadas", () => {
    render(<AdminRolesManager />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Atribuições" }), { button: 0, ctrlKey: false });
    expect(screen.getAllByRole("button", { name: "Revogar" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    expect(mock.revokeRole).not.toHaveBeenCalled();
    expect(screen.getByText("Revogar Role?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mock.revokeRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revogar" }));
    expect(mock.revokeRole).toHaveBeenCalledExactlyOnceWith("u1");
  });
});
