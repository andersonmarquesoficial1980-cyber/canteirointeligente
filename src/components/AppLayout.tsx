import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import logoCi from "@/assets/logo-ci.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card px-2 sticky top-0 z-50">
            <SidebarTrigger className="ml-1" />
            <img src={logoCi} alt="CI" className="h-6 ml-3 object-contain" />
            <span className="ml-2 font-display font-bold text-sm text-foreground">
              Canteiro Inteligente
            </span>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
