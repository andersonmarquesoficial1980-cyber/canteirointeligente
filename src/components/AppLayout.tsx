import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import logoCi from "@/assets/logo-workflux.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center bg-header-gradient px-3 sticky top-0 z-50 shadow-lg">
            <SidebarTrigger className="ml-1 text-primary-foreground hover:bg-white/15" />
            <div className="relative ml-3">
              <img src={logoCi} alt="CI" className="h-10 object-contain drop-shadow-lg" />
              <div className="absolute inset-0 rounded-full bg-white/20 blur-md -z-10 scale-110" />
            </div>
            <div className="ml-2">
              <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">Workflux</span>
              <span className="block text-[10px] text-primary-foreground/80 font-medium leading-tight">Plataforma de Gestão</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
