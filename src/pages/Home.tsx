// @LOCK-UI: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Cog, Truck, ShieldCheck, LogOut, type LucideIcon } from "lucide-react";

import logoCi from "@/assets/logo-ci.png";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";

type HubCard = {
  key: "obras" | "equipamentos" | "carreteiros" | "painel";
  title: string;
  subtitle: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  tone: "default" | "carreteiros" | "admin";
};

// CRITICAL: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL
const HUB_CARDS: HubCard[] = [
  {
    key: "obras",
    title: "CI Obras",
    subtitle: "Diário de Obras",
    path: "/obras",
    icon: ClipboardList,
    tone: "default",
  },
  {
    key: "equipamentos",
    title: "CI Equipamentos",
    subtitle: "Gestão de Equipamentos",
    path: "/equipamentos",
    icon: Cog,
    tone: "default",
  },
  {
    key: "carreteiros",
    title: "CI Carreteiros",
    subtitle: "Logística de Materiais",
    path: "/carreteiros",
    icon: Truck,
    tone: "carreteiros",
  },
  {
    key: "painel",
    title: "Painel de Controle",
    subtitle: "Dashboards e Gestão",
    path: "/admin",
    icon: ShieldCheck,
    adminOnly: true,
    tone: "admin",
  },
];

const cardToneClasses: Record<HubCard["tone"], string> = {
  default: "bg-header-gradient text-primary-foreground",
  carreteiros: "bg-primary text-primary-foreground",
  admin: "bg-secondary text-secondary-foreground",
};

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [loggingOut, setLoggingOut] = useState(false);

  const visibleCards = HUB_CARDS.filter((card) => !card.adminOnly || isAdmin);

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
      {/* Layout travado em coluna única (sem grid) */}
      <div className="flex flex-col gap-3 w-full max-w-lg relative z-10">
        {visibleCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.key}
              onClick={() => navigate(card.path)}
              className={`group relative flex w-full items-center gap-4 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-xl hover:shadow-2xl cursor-pointer ${cardToneClasses[card.tone]}`}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 glass shrink-0">
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="block text-sm leading-tight font-display font-extrabold tracking-tight">{card.title}</span>
                <span className="block text-[10px] opacity-80 mt-0.5">{card.subtitle}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
