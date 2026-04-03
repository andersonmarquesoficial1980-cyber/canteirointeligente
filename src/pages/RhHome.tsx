import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bus, MapPin, LogOut, Camera, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import logoCi from "@/assets/logo-ci.png";

const RH_SECTIONS = [
  {
    id: "registrar-ponto",
    label: "Registrar Ponto",
    description: "Ponto facial com GPS e geofencing automático",
    icon: Camera,
    route: "/rh/registrar-ponto",
  },
  {
    id: "espelho-ponto",
    label: "Espelho de Ponto",
    description: "Histórico mensal, horas trabalhadas e extras",
    icon: ClipboardList,
    route: "/rh/espelho-ponto",
  },
  {
    id: "trajeto-vt",
    label: "Trajeto e VT",
    description: "Calcule rotas de transporte público e custo de vale-transporte",
    icon: Bus,
    route: "/rh/trajeto-vt",
  },
  {
    id: "vale-transporte",
    label: "Gestão de VT",
    description: "Tarifas, conduções e custo mensal por funcionário",
    icon: MapPin,
    route: "/vale-transporte",
  },
];
export default function RhHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1">
          <h1 className="font-display font-bold text-base leading-tight">CI RH</h1>
          <p className="text-[10px] text-primary-foreground/70">Gestão de Pessoas</p>
        </div>
        <button
          onClick={async () => {
            try { await supabase.auth.signOut(); } catch {}
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace("/");
          }}
          className="p-1.5 rounded-lg hover:bg-white/10 transition"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {RH_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(section.route)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
