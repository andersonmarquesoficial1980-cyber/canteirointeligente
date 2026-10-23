import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManualVacationHistory } from "./ManualVacationHistory";

const props = {
  employee: { id: "employee-1", name: "Operador A", matricula: "123", data_admissao: "2020-01-01" },
  existing: [],
  onClose: vi.fn(),
  onSave: vi.fn(async () => undefined),
};

describe("Histórico manual de férias", () => {
  it("distingue férias já gozadas de uma programação futura e exige a fonte", async () => {
    const save = vi.fn(async () => undefined);
    render(<ManualVacationHistory {...props} onSave={save} today="2026-10-23" />);
    expect(screen.getByText("Registrar férias já gozadas")).toBeInTheDocument();
    expect(screen.getByText(/Este lançamento não homologa saldo/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Início do gozo"), { target: { value: "2025-07-01" } });
    fireEvent.change(screen.getByLabelText("Fim do gozo"), { target: { value: "2025-07-15" } });
    expect(screen.getByRole("button", { name: "Salvar histórico" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Origem da informação"), { target: { value: "Recibo do RH" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar histórico" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ start: "2025-07-01", end: "2025-07-15", source: "Recibo do RH", acquisitionStart: null })));
  });
  it("não salva datas sobrepostas ao histórico existente", () => {
    const save = vi.fn(async () => undefined);
    render(<ManualVacationHistory {...props} existing={[{ start: "2025-07-10", end: "2025-07-20" }]} onSave={save} today="2026-10-23" />);
    fireEvent.change(screen.getByLabelText("Início do gozo"), { target: { value: "2025-07-01" } });
    fireEvent.change(screen.getByLabelText("Fim do gozo"), { target: { value: "2025-07-15" } });
    fireEvent.change(screen.getByLabelText("Origem da informação"), { target: { value: "Recibo do RH" } });
    expect(screen.getByText(/Já há férias cadastradas nesse intervalo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar histórico" })).toBeDisabled();
  });
});
