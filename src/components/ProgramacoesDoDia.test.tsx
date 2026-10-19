import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ProgramacoesDoDia from "./ProgramacoesDoDia";

const state = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, company: "company-1", queryCompany: "" }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { company_id: state.company } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query = {
    select: () => query, eq: (key: string, value: string) => { if (key === "company_id") state.queryCompany = value; return query; },
    in: () => query, neq: () => query, order: () => query,
    limit: async () => ({ data: state.rows, count: state.rows.length, error: null }),
  };
  return query;
} } }));
afterEach(() => { cleanup(); state.rows = []; state.queryCompany = ""; });

describe("Programação de Obras nos módulos", () => {
  it("mostra apenas um cartão fechado com título, contagem e detalhes por equipe ao abrir", async () => {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    state.rows = [
      { id: "1", data: today, equipe: "CBUQ01", status_equipe: "TRABALHOU", local: "Obra A", periodo: "DIURNO", ogs: "2529", cliente: "Fremix", responsavel: "Aelson", engenheiro_responsavel: "Joana", obs: null, comunicado_id: "com-1" },
      { id: "2", data: today, equipe: "CBUQ02", status_equipe: "FOLGA", local: null, periodo: "FOLGA", ogs: null, cliente: null, responsavel: null, engenheiro_responsavel: null, obs: null, comunicado_id: "com-1" },
    ];
    render(<ProgramacoesDoDia />);
    const panel = await screen.findByRole("region", { name: "Programação de Obras" });
    const trigger = within(panel).getByRole("button", { name: /Programação de Obras/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Hoje: 2");
    expect(within(panel).queryByText("CBUQ01")).toBeNull();
    fireEvent.click(trigger);
    expect(within(panel).getByText("CBUQ01")).toBeTruthy();
    expect(within(panel).getByText("CBUQ02")).toBeTruthy();
    expect(within(panel).getByText(/Enc.: Aelson · Eng.: Joana/)).toBeTruthy();
    const link = within(panel).getByRole("link", { name: "Compartilhar programação do dia" });
    expect(decodeURIComponent(link.getAttribute("href") || "")).toContain("CBUQ02");
    expect(state.queryCompany).toBe("company-1");
  });
  it("não mostra programação quando não há empresa", async () => {
    state.company = "";
    render(<ProgramacoesDoDia />);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Programação de Obras" })).toBeNull());
    state.company = "company-1";
  });
  it("mantém cancelamento e motivo visíveis nos módulos e na mensagem atualizada", async () => {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    state.rows = [{ id: "c1", data: today, equipe: "CBUQ01", status_equipe: "CANCELADO", motivo_cancelamento: "Chuva forte", local: null, periodo: "CANCELADO", ogs: null, cliente: null, responsavel: null, engenheiro_responsavel: null, obs: null, comunicado_id: "com-1" }];
    render(<ProgramacoesDoDia />);
    const panel = await screen.findByRole("region", { name: "Programação de Obras" });
    fireEvent.click(within(panel).getByRole("button", { name: /Programação de Obras/ }));
    expect(within(panel).getByText(/Cancelado · Chuva forte/)).toBeTruthy();
    expect(decodeURIComponent(within(panel).getByRole("link", { name: "Compartilhar programação do dia" }).getAttribute("href") || "")).toContain("Motivo: Chuva forte");
  });
});
