import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({ programador: true, rpc: vi.fn(async () => ({ data: { funcionarios: 1, equipamentos: 0 }, error: null })), inserts: [] as any[] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ permissions: { modulo_programador: state.programador } }) }));
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => ({ profile: { user_id: "u1", company_id: "c1", nome_completo: "Ana", email: "a@x" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  rpc: (...a: any[]) => (state.rpc as any)(...a),
  from: (t: string) => {
    const res = Promise.resolve({ data: t === "rh_pendencias_funcionario" ? [{ id: "p1", employee_id: "2", tipo: "demissao", status: "aberta", prioridade: "normal", justificativa: "x", data_efetiva: null, payload: {} }] : [], error: null });
    const q: any = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q, insert: async (v: any) => { state.inserts.push([t, v]); return { error: null }; }, then: res.then.bind(res) };
    return q;
  },
} }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
import QuadroPessoas from "./QuadroPessoas";

const gente: any[] = [
  { id: "1", name: "ANA", matricula: "1", role: "AJUDANTE", equipe: "CBUQ01", status: "ativo", company_id: "c1" },
  { id: "2", name: "SEBASTIAO", matricula: "2", role: "OPERADOR", equipe: null, status: "ativo", company_id: "c1" },
];

afterEach(() => { cleanup(); state.programador = true; state.inserts = []; });

describe("QuadroPessoas (espelho no Programador)", () => {
  it("renderiza as colunas e cards a partir da lista recebida, com selo de pendência aberta", async () => {
    render(<QuadroPessoas funcionarios={gente} catalogo={["CBUQ02"]} onAtualizarEquipe={() => undefined} onAbrir={() => undefined} />);
    expect(await screen.findByText("CBUQ01")).toBeTruthy();
    expect(screen.getByText("CBUQ02")).toBeTruthy();
    expect(screen.getByText("SEBASTIAO")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Demitir/)).toBeTruthy());
  });
  it("sem WF Programador mostra modo visualização", async () => {
    state.programador = false;
    render(<QuadroPessoas funcionarios={gente} catalogo={[]} onAtualizarEquipe={() => undefined} onAbrir={() => undefined} />);
    expect(await screen.findByText(/Modo visualização/)).toBeTruthy();
  });
});
