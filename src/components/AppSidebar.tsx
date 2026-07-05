import { LayoutDashboard, FileText, Truck, Search, Bus } from "lucide-react";
import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import logoCi from "@/assets/logo-workflux.png";

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

// Mapa de módulos contratados → itens do sidebar
// Estes serão filtrados baseado em company_modules do usuário
const moduleItems: Record<string, { title: string; url: string; icon: any }> = {
  "WF Obras": { title: "WF Obras", url: "/obras", icon: FileText },
  "WF Equipamentos": { title: "WF Equipamentos", url: "/equipamentos", icon: FileText },
  "WF Carreteiros": { title: "WF Carreteiros", url: "/carreteiros", icon: Truck },
  "WF Relatórios": { title: "WF Relatórios", url: "/relatorios", icon: FileText },
  "WF Engenharia": { title: "WF Engenharia", url: "/engenharia", icon: FileText },
  "WF RH": { title: "WF RH", url: "/rh", icon: FileText },
  "WF Manutenção": { title: "WF Manutenção", url: "/manutencao", icon: FileText },
  "WF SST": { title: "WF SST", url: "/sst", icon: FileText },
  "WF Suprimentos": { title: "WF Suprimentos", url: "/suprimentos", icon: FileText },
  "WF Gestão de Frotas": { title: "WF Gestão de Frotas", url: "/gestao-frotas", icon: Truck },
  "WF Documentos": { title: "WF Documentos", url: "/documentos", icon: FileText },
  "WF Ponto": { title: "WF Ponto", url: "/ponto", icon: FileText },
  "WF Demandas": { title: "WF Demandas", url: "/demandas", icon: FileText },
  "WF Programador": { title: "WF Programador", url: "/programador", icon: FileText },
  "WF Abastecimento": { title: "WF Abastecimento", url: "/abastecimento", icon: FileText },
};

// Itens sempre visíveis (não controlados por company_modules)
const alwaysVisibleItems = [
  { title: "Hub", url: "/", icon: LayoutDashboard },
  { title: "Diretório", url: "/diretorio", icon: Search },
  { title: "VT Transporte", url: "/vale-transporte", icon: Bus },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { hasModule, loading, isSuperAdmin, modules } = useCompanyModules();
  const [visibleItems, setVisibleItems] = useState(alwaysVisibleItems);

  // Recalcula itens visíveis sempre que modules mudar ou isSuperAdmin mudar
  useEffect(() => {
    if (loading) return; // Aguarda carregamento de módulos

    // Super-admin vê TODOS os módulos
    if (isSuperAdmin) {
      const allItems = [
        ...alwaysVisibleItems,
        ...Object.values(moduleItems)
      ];
      
      // Remove duplicatas por URL
      const seen = new Set<string>();
      setVisibleItems(allItems.filter(item => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      }));
      return;
    }

    // Usuário comum: filtra por company_modules
    const moduleKeys = modules || [];
    const allowedItems = moduleKeys
      .map(moduleId => moduleItems[moduleId])
      .filter(Boolean); // Filtra módulos que existem no map

    const finalItems = [...alwaysVisibleItems, ...allowedItems];
    
    // Remove duplicatas por URL
    const seen = new Set<string>();
    setVisibleItems(finalItems.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }));
  }, [loading, isSuperAdmin, modules]);

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
                  Workflux
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
              {visibleItems.map((item) => (
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
