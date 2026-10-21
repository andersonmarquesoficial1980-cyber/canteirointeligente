import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TabelaPaginada } from "./Tabela";

const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i-${i}` }));
const colunas = [{ titulo: "ID", render: (i: { id: string }) => i.id }];
const tabela = (n: number, extra: { focusKey?: string | null; resetKey?: string } = {}) => (
  <TabelaPaginada itens={itens(n)} colunas={colunas} getKey={i => i.id} resetKey={extra.resetKey ?? "k"} focusKey={extra.focusKey} vazio="vazio" />
);

// jsdom não implementa rolagem: registra a ordem das chamadas para provar que o foco vence o reset.
function espiarRolagem() {
  const log: string[] = [];
  const proto = HTMLElement.prototype as any;
  const antes = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
  Object.defineProperty(Element.prototype, "scrollTop", { configurable: true, get: () => 0, set: (v: number) => { log.push(`scrollTop=${v}`); } });
  proto.scrollIntoView = function () { log.push(`scrollIntoView:${(this as HTMLElement).textContent}`); };
  return { log, restaurar: () => { if (antes) Object.defineProperty(Element.prototype, "scrollTop", antes); delete proto.scrollIntoView; } };
}

afterEach(() => cleanup());

describe("TabelaPaginada — rolagem e foco", () => {
  it("rola até o registro em foco depois de zerar o topo, nunca o contrário", () => {
    const espia = espiarRolagem();
    try {
      render(tabela(45, { focusKey: "i-25" }));
      expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("21–40 de 45");
      const iFoco = espia.log.findIndex(e => e.startsWith("scrollIntoView"));
      expect(iFoco).toBeGreaterThanOrEqual(0);
      expect(espia.log[iFoco]).toContain("i-25");
      expect(espia.log.slice(iFoco + 1).some(e => e.startsWith("scrollTop"))).toBe(false);
    } finally { espia.restaurar(); }
  });
  it("ao mudar de página sem foco volta ao topo", () => {
    const espia = espiarRolagem();
    try {
      render(tabela(45));
      espia.log.length = 0;
      fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
      expect(espia.log).toContain("scrollTop=0");
    } finally { espia.restaurar(); }
  });
  it("coleção que encolhe ajusta a página e mantém o alvo em foco visível", () => {
    const espia = espiarRolagem();
    try {
      const { rerender } = render(tabela(45));
      fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
      fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
      expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("41–45 de 45");
      rerender(tabela(5));
      expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("1–5 de 5");
      expect(screen.getAllByRole("row")).toHaveLength(6);
      rerender(tabela(30, { focusKey: "i-22", resetKey: "outro" }));
      expect(screen.getByTestId("paginacao-intervalo")).toHaveTextContent("21–30 de 30");
      expect(document.querySelector("[data-foco='true']")).toHaveTextContent("i-22");
      const ultimo = espia.log[espia.log.length - 1];
      expect(ultimo).toBe("scrollIntoView:i-22");
    } finally { espia.restaurar(); }
  });
});
