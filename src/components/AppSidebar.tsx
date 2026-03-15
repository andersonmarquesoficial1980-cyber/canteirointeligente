import { LayoutDashboard, FileText, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logoCi from "@/assets/logo-ci.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const baseItems = [
  { title: "Hub", url: "/", icon: LayoutDashboard },
  { title: "CI Obras", url: "/obras", icon: LayoutDashboard },
  { title: "Novo RDO", url: "/obras/rdo", icon: FileText },
  { title: "CI Equipamentos", url: "/equipamentos", icon: FileText },
];

const adminItems = [
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { isAdmin } = useIsAdmin();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo area */}
        <div className="px-4 py-5 border-b border-sidebar-border flex items-center gap-3">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <img src={logoCi} alt="CI" className="h-8 object-contain" />
              <div>
                <p className="font-display font-bold text-sm text-sidebar-foreground leading-tight">
                  Canteiro Inteligente
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Plataforma de Gestão
                </p>
              </div>
            </div>
          ) : (
            <img src={logoCi} alt="CI" className="h-7 object-contain" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...baseItems, ...(isAdmin ? adminItems : [])].map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
