import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Cog, Truck, ChevronRight, ShieldCheck, LogOut } from "lucide-react";

import logoCi from "@/assets/logo-ci.png";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await supabase.auth.signOut(); } catch {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute top-[-120px] left-[-80px] w-[320px] h-[320px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-60px] w-[280px] h-[280px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

      {/* Brand */}
      <div className="mb-12 text-center space-y-4 relative z-10">
        <div className="relative inline-block">
          <img
            src={logoCi}
            alt="Canteiro Inteligente"
            className="h-32 mx-auto object-contain drop-shadow-2xl animate-float"
          />
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl -z-10 scale-125" />
        </div>
        <h1 className="text-gradient text-2xl font-display font-extrabold tracking-tight">
          Canteiro Inteligente
        </h1>
        <p className="text-sm text-muted-foreground tracking-wide">
          Plataforma de Gestão e Integração de Campo
        </p>
      </div>

      {/* Logout */}
      <button
        type="button"
        disabled={loggingOut}
        onClick={handleLogout}
        className="absolute top-5 right-5 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 text-destructive bg-background hover:bg-destructive/10 text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors"
      >
        <LogOut className="w-4 h-4" /> {loggingOut ? "Saindo..." : "Sair"}
      </button>

      {/* CRITICAL: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL */}
      {/* @LOCK-UI: Single-column vertical layout — DO NOT change to grid-cols-2 */}
      <div className="flex flex-col gap-3 w-full max-w-lg relative z-10">
        {/* 1. CI Obras */}
        <button
          onClick={() => navigate("/obras")}
          className="group relative flex items-center gap-4 rounded-2xl bg-header-gradient text-primary-foreground p-5 h-20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
            <ClipboardList className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-left">
            <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">CI Obras</span>
            <span className="block text-[10px] text-primary-foreground/70 mt-0.5">Diário de Obras</span>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-foreground/50 ml-auto" />
        </button>

        {/* 2. CI Equipamentos */}
        <button
          onClick={() => navigate("/equipamentos")}
          className="group relative flex items-center gap-4 rounded-2xl bg-header-gradient text-primary-foreground p-5 h-20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
            <Cog className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-left">
            <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">CI Equipamentos</span>
            <span className="block text-[10px] text-primary-foreground/70 mt-0.5">Gestão de Equipamentos</span>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-foreground/50 ml-auto" />
        </button>

        {/* 3. CI Carreteiros — NUNCA REMOVER */}
        <button
          onClick={() => navigate("/carreteiros")}
          className="group relative flex items-center gap-4 rounded-2xl bg-header-gradient text-primary-foreground p-5 h-20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
            <Truck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-left">
            <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">CI Carreteiros</span>
            <span className="block text-[10px] text-primary-foreground/70 mt-0.5">Logística de Materiais</span>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-foreground/50 ml-auto" />
        </button>

        {/* 4. Painel de Controle — admin only, NUNCA REMOVER */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin/configuracoes")}
            className="group relative flex items-center gap-4 rounded-2xl bg-[hsl(220,60%,20%)] text-primary-foreground p-5 h-20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">Painel de Controle</span>
              <span className="block text-[10px] text-primary-foreground/70 mt-0.5">Dashboards e Gestão</span>
            </div>
            <ChevronRight className="w-5 h-5 text-primary-foreground/50 ml-auto" />
          </button>
        )}
      </div>
    </div>
  );
}
