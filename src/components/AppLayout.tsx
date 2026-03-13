import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import logoFremix from "@/assets/Logo_Fremix.png";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card/95 backdrop-blur px-2 sticky top-0 z-50">
            <SidebarTrigger className="ml-1" />
            <img src={logoFremix} alt="Fremix" className="ml-3 h-6 w-6 object-contain" />
            <span className="ml-2 font-display font-bold text-sm text-foreground">
              Canteiro<span className="text-accent">.</span> <span className="text-primary">Inteligente</span>
            </span>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
