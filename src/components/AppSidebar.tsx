import { LayoutDashboard, FileText, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logoFremix from "@/assets/Logo_Fremix.png";
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
          <img
            src={logoFremix}
            alt="Fremix"
            className="h-9 w-9 rounded-lg object-contain shrink-0"
          />
          {!collapsed && (
            <div>
              <p className="font-display font-bold text-sm text-sidebar-foreground leading-tight">
                Canteiro<span className="text-accent">.</span> <span className="text-primary">Inteligente</span>
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Fremix Pavimentação
              </p>
            </div>
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
