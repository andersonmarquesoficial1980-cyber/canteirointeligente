import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => true }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { nome_completo: "Anderson", perfil: "Administrador" } }) }));
vi.mock("@/hooks/useNavigationTrail", () => ({ useNavigationTrail: () => ({ trail: [], goTo: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/components/navigation/NavigationTrail", () => ({ NavigationTrail: () => <nav aria-label="Trilha" /> }));
import Index from "./Index";
afterEach(cleanup);

describe("WF Obras no desktop", () => {
  it("mostra o cabeçalho e as ações dentro da área de trabalho", () => {
    render(<MemoryRouter><Index /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "WF Obras" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo RDO/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Meus Lançamentos/ })).toBeInTheDocument();
  });
});
