import { describe, expect, it } from "vitest";
import { usesDesktopWorkspace } from "./desktopRoutes";

describe("desktop workspace routing", () => {
  it("keeps the navigation across module homes and their work pages", () => {
    for (const path of ["/", "/obras", "/obras/rdo", "/meus-lancamentos", "/relatorios", "/relatorios/checklist", "/gestao-pessoas/equipe", "/admin/configuracoes"]) {
      expect(usesDesktopWorkspace(path)).toBe(true);
    }
  });

  it("leaves printable and presentation pages independent", () => {
    for (const path of ["/carreteiros/qrcodes", "/carreteiros/scan/abc", "/relatorios/dashboards-obras/obras", "/gestao-frotas/dashboard", "/verificar-2fa"]) {
      expect(usesDesktopWorkspace(path)).toBe(false);
    }
  });
});
