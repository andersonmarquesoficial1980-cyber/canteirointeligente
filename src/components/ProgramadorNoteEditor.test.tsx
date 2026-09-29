import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProgramadorNoteEditor } from "./ProgramadorNoteEditor";

describe("edição da observação operacional", () => {
  it("edits a specific person's note and only closes after confirmation", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<ProgramadorNoteEditor label="Ana" note="Antes" onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar observação de Ana" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Observação operacional de Ana" }), { target: { value: "Depois" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar observação" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("Depois"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("keeps the editor open on a failed save", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Sem permissão"));
    render(<ProgramadorNoteEditor label="CM06" onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar observação de CM06" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar observação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
