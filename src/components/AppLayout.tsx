import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import logoCi from "@/assets/logo-ci.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center bg-header-gradient px-2 sticky top-0 z-50 shadow-md">
            <SidebarTrigger className="ml-1 text-primary-foreground hover:bg-white/15" />
            <img src={logoCi} alt="CI" className="h-8 ml-3 object-contain drop-shadow-sm" />
            <div className="ml-2">
              <span className="block font-display font-bold text-sm text-primary-foreground leading-tight">Canteiro Inteligente</span>
              <span className="block text-[10px] text-primary-foreground/75 leading-tight">Plataforma de Gestão</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
