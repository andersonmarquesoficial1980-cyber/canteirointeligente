import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useDesktopWorkspace", () => ({ useDesktopWorkspace: () => state.desktop }));
vi.mock("@/hooks/useSmartBack", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/components/suprimentos/CalculadoraFrete", () => ({ CalculadoraFrete: () => <section aria-label="Calculadora de Frete" /> }));
import SuprimentosHome from "./SuprimentosHome";
afterEach(() => { cleanup(); sessionStorage.clear(); state.desktop = true; });

describe("WF Suprimentos desktop", () => {
  it("oferece cabeçalho e trilha na área de trabalho mantendo a calculadora", () => {
    const { container } = render(<MemoryRouter initialEntries={["/suprimentos"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SuprimentosHome /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "WF Suprimentos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Calculadora de Frete" })).toBeInTheDocument();
    expect(container.querySelector("main")?.className).toContain("max-w-[1680px]");
  });
  it("mantém o cabeçalho claro e a largura anterior no mobile", () => {
    state.desktop = false;
    const { container } = render(<MemoryRouter initialEntries={["/suprimentos"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SuprimentosHome /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Análise de Frete" })).toBeInTheDocument();
    expect(container.querySelector("main")?.className).toContain("max-w-5xl");
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
  });
});
