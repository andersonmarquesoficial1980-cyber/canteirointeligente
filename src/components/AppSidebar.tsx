import { LayoutDashboard, FileText, Truck, Search } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  { title: "CI RDO", url: "/obras", icon: FileText },
  { title: "CI Equipamentos", url: "/equipamentos", icon: FileText },
  { title: "CI Carreteiros", url: "/carreteiros", icon: Truck },
  { title: "Diretório", url: "/diretorio", icon: Search },
];

export function AppSidebar() {
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
              {baseItems.map((item) => (
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
