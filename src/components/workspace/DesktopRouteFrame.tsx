import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { ReportsWorkspace } from "./WorkspaceShell";
import { usesDesktopWorkspace } from "./desktopRoutes";

// Acima das rotas: a barra não é recriada a cada troca de página.
// Sem barra no mobile, em autenticação ou nas telas de impressão/apresentação.
export function DesktopRouteFrame({ children }: { children: ReactNode }) {
  const desktop = useDesktopWorkspace();
  const { pathname } = useLocation();
  if (!desktop || !usesDesktopWorkspace(pathname)) return <>{children}</>;
  return <ReportsWorkspace>{children}</ReportsWorkspace>;
}
