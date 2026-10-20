import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as XLSX from "xlsx";

const state = vi.hoisted(() => ({ record: {} as Record<string, unknown>, exported: vi.fn() }));
vi.mock("xlsx", async (importOriginal) => ({ ...await importOriginal<typeof import("xlsx")>(), writeFile: state.exported }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "eng-teste" } } }) },
  from: (table: string) => {
    const q = { select: () => q, eq: () => q, single: async () => ({ data: table === "rdo_engenheiro" ? state.record : { nome_completo: "Engenheiro teste" }, error: null }) };
    return q;
  },
} }));
import EngRdoTecnicoDetalhe from "./EngRdoTecnicoDetalhe";

beforeEach(() => {
  state.exported.mockClear();
  state.record = { id: "rdo-teste", engenheiro_id: "eng-teste", ogs_number: "2557", data: "2026-10-20", status: "enviado", houve_producao: false,
    motivo_sem_producao: "Chuva", equipe: "Equipe teste", localizacao: "Rua teste, 20", choveu: true, intensidade_chuva: "Forte",
    houve_ocorrencia: true, descricao_ocorrencia: "Acesso bloqueado", observacoes: "Aguardando liberação", egl_ton: null, rachao_ton: null };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });
async function mount() {
  await act(async () => { render(<MemoryRouter initialEntries={["/rdo/rdo-teste"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/rdo/:id" element={<EngRdoTecnicoDetalhe />} /></Routes>
  </MemoryRouter>); });
  await screen.findByText("Equipe teste");
}
function exportRows() {
  fireEvent.click(screen.getByRole("button", { name: "Excel" }));
  const workbook = state.exported.mock.calls[0][0];
  // Exercise the real XLSX serialization and parse the generated file back.
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const parsed = XLSX.read(bytes, { type: "array" });
  return XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]], { header: 1 }) as unknown[][];
}
describe("RDO Técnico — detalhe e exportações", () => {
  it("mostra contexto completo sem produção e mantém o mesmo conteúdo na impressão", async () => {
    await mount();
    const printPage = document.querySelector(".print-page")!;
    for (const text of ["Equipe teste", "Rua teste, 20", "Forte", "Acesso bloqueado", "Aguardando liberação"]) {
      const element = within(printPage as HTMLElement).getByText(text);
      expect(element.closest(".no-print")).toBeNull();
    }
    expect(screen.queryByRole("heading", { name: "Produção" })).not.toBeInTheDocument();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "PDF / Imprimir" }));
    expect(print).toHaveBeenCalledOnce();
  });
  it("exporta o contexto sem criar uma seção de produção num dia parado", async () => {
    await mount();
    const rows = exportRows();
    for (const row of [["Equipe", "Equipe teste"], ["Localização / Rua", "Rua teste, 20"], ["Choveu no período", "Sim"], ["Nível da chuva", "Forte"], ["Descrição", "Acesso bloqueado"], ["OBSERVAÇÕES", "Aguardando liberação"]]) expect(rows).toContainEqual(row);
    expect(rows.some(row => row[0] === "PRODUÇÃO")).toBe(false);
  });
  it("não inventa intensidade para chuva histórica sem classificação", async () => {
    state.record.intensidade_chuva = null;
    await mount();
    expect(screen.getByText("Não informada")).toBeInTheDocument();
    expect(exportRows()).toContainEqual(["Nível da chuva", "Não informada"]);
  });
  it("inclui EGL e RACHÃO no Excel como no detalhe, preservando o zero", async () => {
    state.record.houve_producao = true;
    state.record.egl_ton = 12.5;
    state.record.rachao_ton = 0;
    await mount();
    expect(screen.getByText("12,5 ton")).toBeInTheDocument();
    expect(screen.getByText("0 ton")).toBeInTheDocument();
    const rows = exportRows();
    expect(rows).toContainEqual(["EGL (ton)", "12,5"]);
    expect(rows).toContainEqual(["RACHÃO (ton)", "0"]);
  });
});
