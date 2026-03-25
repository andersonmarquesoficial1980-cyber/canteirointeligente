import { useNavigate } from "react-router-dom";
import { ClipboardList, Cog, Truck, ChevronRight, ShieldCheck } from "lucide-react";

import logoCi from "@/assets/logo-ci.png";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

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

      {/* Module buttons — giant glassmorphism cards */}
      <div className="flex flex-col gap-6 w-full max-w-md relative z-10">
        <button
          onClick={() => navigate("/obras")}
          className="group relative flex items-center gap-5 rounded-3xl bg-header-gradient text-primary-foreground p-7 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer glow-primary"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 glass shrink-0">
            <ClipboardList className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-left flex-1">
            <span className="block text-[1.75rem] leading-tight font-display font-extrabold tracking-tight">
              CI Obras
            </span>
            <span className="block text-sm text-primary-foreground/70 mt-1">
              RDO — Diário de Obras
            </span>
          </div>
          <ChevronRight className="w-6 h-6 text-primary-foreground/50 group-hover:text-primary-foreground transition-colors" />
        </button>

        <button
          onClick={() => navigate("/equipamentos")}
          className="group relative flex items-center gap-5 rounded-3xl bg-header-gradient text-primary-foreground p-7 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer glow-accent"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 glass shrink-0">
            <Cog className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-left flex-1">
            <span className="block text-[1.75rem] leading-tight font-display font-extrabold tracking-tight">
              CI Equipamentos
            </span>
            <span className="block text-sm text-primary-foreground/70 mt-1">
              Gestão de Equipamentos
            </span>
          </div>
          <ChevronRight className="w-6 h-6 text-primary-foreground/50 group-hover:text-primary-foreground transition-colors" />
        </button>

        {/* CI Carreteiros — card permanente (NUNCA REMOVER) */}
        <button
          onClick={() => navigate("/carreteiros")}
          className="group relative flex items-center gap-5 rounded-3xl bg-header-gradient text-primary-foreground p-7 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer glow-primary"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 glass shrink-0">
            <Truck className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-left flex-1">
            <span className="block text-[1.75rem] leading-tight font-display font-extrabold tracking-tight">
              CI Carreteiros
            </span>
            <span className="block text-sm text-primary-foreground/70 mt-1">
              Logística de Materiais
            </span>
          </div>
          <ChevronRight className="w-6 h-6 text-primary-foreground/50 group-hover:text-primary-foreground transition-colors" />
        </button>

        {/* Painel de Controle — admin only */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin/configuracoes")}
            className="group relative flex items-center gap-5 rounded-3xl bg-header-gradient text-primary-foreground p-7 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl cursor-pointer glow-accent"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 glass shrink-0">
              <ShieldCheck className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="text-left flex-1">
              <span className="block text-[1.75rem] leading-tight font-display font-extrabold tracking-tight">
                Painel de Controle
              </span>
              <span className="block text-sm text-primary-foreground/70 mt-1">
                Dashboards e Gerenciamento
              </span>
            </div>
            <ChevronRight className="w-6 h-6 text-primary-foreground/50 group-hover:text-primary-foreground transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
}
