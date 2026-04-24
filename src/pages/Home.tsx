// CRITICAL CORE: DO NOT ALTER MODULE ARRAY, VERTICAL LAYOUT OR USER CREATION FLOW.
// STATIC_UI_LOCK: MANDATORY MODULES
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown, LogOut } from "lucide-react";

import logoCi from "@/assets/logo-workflux.png";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { supabase } from "@/integrations/supabase/client";
import { HUB_MODULES } from "@/config/navigation";

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { permissions, loading: loadingPerms } = usePermissions();
  const { hasModule, loading: loadingModules, isSuperAdmin } = useCompanyModules();
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
            alt="Workflux"
            className="h-32 mx-auto object-contain drop-shadow-2xl animate-float"
          />
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl -z-10 scale-125" />
        </div>
        <h1 className="text-gradient text-2xl font-display font-extrabold tracking-tight">
          Workflux
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

      {/* @LOCK-UI: Single-column vertical layout — DO NOT change to grid-cols-2 */}
      <div className="flex flex-col gap-3 w-full max-w-lg relative z-10">
        {HUB_MODULES
          .filter(mod => {
            if (mod.adminOnly && !isAdmin) return false;
            if (loadingPerms || loadingModules) return true; // enquanto carrega, mostra tudo
            // Super-admin (dono do Workflux) vê tudo
            // Admin da empresa vê módulos contratados pela empresa
            if (!hasModule(mod.id)) return false;
            if (isAdmin) return true; // admin da empresa vê todos os módulos liberados
            // Filtrar por permissão individual do usuário
            const permMap: Record<string, keyof typeof permissions> = {
              obras: "modulo_obras",
              equipamentos: "modulo_equipamentos",
              rh: "modulo_rh",
              carreteiros: "modulo_carreteiros",
              programador: "modulo_programador",
              demandas: "modulo_demandas",
              manutencao: "modulo_manutencao",
              abastecimento: "modulo_abastecimento",
              documentos: "modulo_documentos",
              relatorios: "modulo_relatorios",
              dashboard: "modulo_dashboard",
            };
            if (!permissions) return false;
            const permKey = permMap[mod.id];
            if (!permKey) return true;
            return permissions[permKey] === true;
          })
          .map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => navigate(mod.route)}
                className={`group relative flex items-center gap-4 rounded-2xl text-primary-foreground p-5 h-20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer ${
                  mod.id === "admin" ? "bg-[hsl(220,60%,20%)]" : "bg-header-gradient"
                }`}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="text-left">
                  <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">{mod.label}</span>
                  <span className="block text-[10px] text-primary-foreground/70 mt-0.5">{mod.subtitle}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-primary-foreground/50 ml-auto" />
              </button>
            );
          })}

        {isSuperAdmin && (
          <button
            onClick={() => navigate("/super-admin")}
            className="group relative flex items-center gap-4 rounded-2xl text-primary-foreground p-5 h-20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer bg-[hsl(220,65%,24%)]"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">Super Admin</span>
              <span className="block text-[10px] text-primary-foreground/70 mt-0.5">Gestão de Empresas Clientes</span>
            </div>
            <ChevronRight className="w-5 h-5 text-primary-foreground/50 ml-auto" />
          </button>
        )}
      </div>
    </div>
  );
}
