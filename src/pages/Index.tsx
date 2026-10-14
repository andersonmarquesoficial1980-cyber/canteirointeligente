import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Truck, HardHat, ClipboardList, LogOut, ArrowLeft, ChevronRight } from "lucide-react";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-workflux.png";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";

export default function Index() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const isDesktop = useDesktopWorkspace();
  const [loggingOut, setLoggingOut] = useState(false);
  const { trail, goTo } = useNavigationTrail({ label: "WF Obras", resetToHome: true });

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
    try { await supabase.auth.signOut(); } catch {}
    clearTimeout(timeout);
    forceOut();
  };

  const irParaMeusLancamentos = () => {
    // Sinaliza para MeusLancamentos abrir direto na aba RDOs
    try { sessionStorage.setItem("meusLancamentos_aba", "rdos"); } catch {}
    navigate("/meus-lancamentos");
  };

  if (isDesktop) return (
    <div className="min-h-screen bg-page">
      <header className="bg-header-gradient text-primary-foreground">
        <div className="flex items-center gap-4 px-8 py-5">
          <button type="button" onClick={() => navigate("/")} aria-label="Voltar ao Início" className="flex h-12 w-12 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1 min-w-0"><h1 className="text-2xl font-semibold">WF Obras</h1><p className="text-sm text-primary-foreground/90">Apontamento, efetivo e produção</p></div>
          <span className="hidden xl:block truncate text-sm text-primary-foreground/80">{profile?.nome_completo || "Usuário"}</span>
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="rounded-lg px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"><LogOut className="inline h-4 w-4 mr-2" />{loggingOut ? "Saindo..." : "Sair"}</button>
        </div>
        <div className="px-8 pb-3"><NavigationTrail trail={trail} onSelect={goTo} /></div>
      </header>
      <main className="mx-auto max-w-[1680px] px-8 py-8">
        <h2 className="text-lg font-semibold">O que você precisa fazer?</h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Acesse os lançamentos de obra sem sair do menu lateral.</p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <button type="button" onClick={() => navigate("/obras/rdo")} className="flex min-h-28 items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="rounded-lg bg-primary/10 p-3"><FileText className="h-6 w-6 text-primary" /></span>
            <span className="flex-1"><strong className="block">Novo RDO</strong><span className="text-sm text-muted-foreground">Registrar o diário de obra</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button type="button" onClick={irParaMeusLancamentos} className="flex min-h-28 items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="rounded-lg bg-primary/10 p-3"><ClipboardList className="h-6 w-6 text-primary" /></span>
            <span className="flex-1"><strong className="block">Meus Lançamentos (RDOs)</strong><span className="text-sm text-muted-foreground">Consultar e continuar seus registros</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </main>
    </div>
  );

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

      <div className="rounded-xl bg-header-gradient px-3 py-2 shadow-sm">
        <NavigationTrail trail={trail} onSelect={goTo} />
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
        <div className="flex justify-center gap-6 text-muted-foreground/60">
          <Truck className="w-7 h-7" />
          <HardHat className="w-7 h-7" />
          <ClipboardList className="w-7 h-7" />
        </div>
        <Button onClick={() => navigate("/obras/rdo")} size="lg" className="h-14 px-10 text-lg font-bold rounded-xl gap-2 shadow-lg">
          <FileText className="w-6 h-6" /> Novo RDO
        </Button>
      </div>

      {/* Meus Lançamentos — abre direto na aba RDOs */}
      <Button
        variant="outline"
        className="w-full h-12 gap-2 text-sm font-semibold"
        onClick={irParaMeusLancamentos}
      >
        <ClipboardList className="w-5 h-5" />
        Meus Lançamentos (RDOs)
      </Button>
    </div>
  );
}
