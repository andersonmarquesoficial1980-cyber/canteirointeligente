// Rotas que precisam ocupar a tela inteira ou gerar impressão continuam independentes.
// O restante do aplicativo autenticado usa a navegação persistente no desktop.
export function usesDesktopWorkspace(pathname: string) {
  if (/^\/(?:trocar-senha|desbloqueio|verificar-2fa|configurar-2fa|update-password)(?:\/|$)/.test(pathname)) return false;
  if (/^\/carreteiros\/(?:qrcodes|scan)(?:\/|$)/.test(pathname)) return false;
  if (pathname === "/dashboard" || pathname === "/gestao-frotas/dashboard" || pathname === "/gestao-frotas/dashboard-rdo") return false;
  if (/^\/relatorios\/dashboards-obras\/(?:obras|manutencao|frota)(?:\/|$)/.test(pathname)) return false;
  return true;
}
