/**
 * ExportButton — só renderiza se o usuário tiver can_export = true.
 * Use no lugar de qualquer botão de PDF/Excel no app.
 */
import { useCanExport } from "@/hooks/useCanExport";
import { Button } from "./button";
import type { ButtonProps } from "./button";

interface ExportButtonProps extends ButtonProps {
  children: React.ReactNode;
}

export function ExportButton({ children, ...props }: ExportButtonProps) {
  const { canExport, loading } = useCanExport();
  if (loading || !canExport) return null;
  return <Button {...props}>{children}</Button>;
}
