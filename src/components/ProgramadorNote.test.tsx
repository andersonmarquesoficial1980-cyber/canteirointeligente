import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProgramadorNote } from "./ProgramadorNote";

describe("observação operacional no Programador", () => {
  it("shows a note indicator and reveals the text on hover, focus or tap", () => {
    render(<ProgramadorNote text="Conferir CNH antes da escala" label="Ana" />);
    const marker = screen.getByRole("button", { name: "Observação de Ana" });
    expect(screen.queryByText("Conferir CNH antes da escala")).toBeNull();
    fireEvent.mouseEnter(marker);
    expect(screen.getByText("Conferir CNH antes da escala")).toBeTruthy();
    fireEvent.mouseLeave(marker);
    expect(screen.queryByText("Conferir CNH antes da escala")).toBeNull();
    fireEvent.click(marker);
    expect(screen.getByText("Conferir CNH antes da escala")).toBeTruthy();
  });
  it("does not show any marker without a note", () => {
    const { container } = render(<ProgramadorNote text={null} label="Beto" />);
    expect(container).toBeEmptyDOMElement();
  });
});
