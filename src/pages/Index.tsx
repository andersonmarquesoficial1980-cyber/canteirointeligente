import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Truck, HardHat, ClipboardList, LogOut } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";

export default function Index() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const forceOut = async () => {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) { await r.unregister().catch(() => {}); }
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        for (const k of keys) { await caches.delete(k).catch(() => {}); }
      }
      window.location.replace("/");
    };
    const timeout = setTimeout(forceOut, 2000);
    try {
      await supabase.auth.signOut();
    } catch {}
    clearTimeout(timeout);
    forceOut();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Início
        </button>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{profile?.nome_completo || "Usuário"}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.email || ""}</p>
          <p className="text-xs text-muted-foreground">{profile?.perfil || ""}</p>
        </div>
        <button
          type="button"
          disabled={loggingOut}
          onClick={handleLogout}
          style={{ position: "relative", zIndex: 999 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-destructive/30 text-destructive bg-background hover:bg-destructive/10 text-sm font-medium shrink-0 cursor-pointer disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" /> {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>

      {/* Hero card */}
      <div className="border border-border rounded-2xl p-6 md:p-10 text-center space-y-5 bg-card shadow-sm">
        <img src={logoCi} alt="Workflux" className="h-16 md:h-20 mx-auto object-contain" />
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">
            Workflux
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Módulo de Obras — apontamento, efetivo, produção e relatórios.
          </p>
        </div>

        {/* KPI icons row */}
        <div className="flex justify-center gap-6 text-muted-foreground/60">
          <Truck className="w-7 h-7" />
          <HardHat className="w-7 h-7" />
          <ClipboardList className="w-7 h-7" />
        </div>

        <Button onClick={() => navigate("/obras/rdo")} size="lg" className="h-14 px-10 text-lg font-bold rounded-xl gap-2 shadow-lg">
          <FileText className="w-6 h-6" /> Novo RDO
        </Button>
      </div>
    </div>
  );
}
