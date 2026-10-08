import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Crown, LayoutDashboard, User } from "lucide-react";
import logo from "@/assets/logo-workflux.png";
import { useHubAccess, type HubAccess } from "@/hooks/useHubAccess";

export function WorkspaceShell({ access, children }: { access: HubAccess; children: ReactNode }) {
  const linkStyle = ({ isActive }: { isActive: boolean }) => `flex items-center gap-3 rounded-md px-3 py-2.5 min-h-11 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${isActive ? 'bg-white/15 text-white font-semibold' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`;
  return <div className="min-h-screen bg-page lg:pl-64" data-workspace="desktop">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-72 focus:z-50 focus:bg-background focus:p-3">Ir para o conteúdo</a>
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#102A43] text-white border-r border-white/10 print:hidden" aria-label="Navegação do Workflux">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
        <img src={logo} alt="" className="w-9 h-9 object-contain rounded-md" />
        <div><p className="text-lg font-semibold tracking-tight">Workflux</p><p className="text-xs text-slate-300">Campo e gestão</p></div>
      </div>
      <nav aria-label="Módulos" className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
        <NavLink to="/" end className={linkStyle}><LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />Início</NavLink>
        <p className="px-3 pt-5 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Módulos</p>
        {access.loading ? <p role="status" className="px-3 py-4 text-sm text-slate-300">Carregando acessos…</p> : access.modules.map(mod => <NavLink key={mod.id} to={mod.route} className={linkStyle}><mod.icon className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="leading-snug">{mod.label}</span></NavLink>)}
        {access.isSuperAdmin && !access.loading && <NavLink to="/super-admin" className={linkStyle}><Crown className="w-4 h-4 shrink-0" aria-hidden="true" />Super Admin</NavLink>}
      </nav>
      <div className="border-t border-white/10 px-3 py-3 shrink-0"><NavLink to="/perfil" className={linkStyle}><User className="w-4 h-4" aria-hidden="true" />Meu perfil</NavLink></div>
    </aside>
    <div id="workspace-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>
  </div>;
}

// Montado somente no desktop de Relatórios. O fluxo mobile não recebe novas consultas.
export function ReportsWorkspace({ children }: { children: ReactNode }) {
  const access = useHubAccess();
  return <WorkspaceShell access={access}>{children}</WorkspaceShell>;
}
