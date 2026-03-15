import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logoCi from "@/assets/logo-ci.png";
import iconFresadora from "@/assets/icon-fresadora.png";

const EQUIPMENT_TYPES = [
  { id: "Fresadora", label: "Fresadora", icon: iconFresadora, isImage: true },
  { id: "Bobcat", label: "Bobcat", icon: "🏗️", isImage: false },
  { id: "Rolo", label: "Rolo", icon: "🛞", isImage: false },
  { id: "Vibroacabadora", label: "Vibro", icon: "⚙️", isImage: false },
  { id: "Usina KMA", label: "KMA", icon: "⚖️", isImage: false },
  { id: "Caminhão", label: "Caminhão", icon: "🚛", isImage: false },
  { id: "Comboio", label: "Comboio", icon: "⛽", isImage: false },
  { id: "Veículo", label: "Veículo", icon: "🚗", isImage: false },
  { id: "Retro", label: "Retro", icon: "🦾", isImage: false },
];

export default function EquipmentHome() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  const handleSelect = (typeId: string) => {
    navigate(`/equipamentos/diario?tipo=${encodeURIComponent(typeId)}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with gradient */}
      <header className="flex items-center justify-between px-4 py-3 bg-header-gradient shadow-md">
        <div className="flex items-center gap-3">
          <img src={logoCi} alt="Canteiro Inteligente" className="h-10 object-contain drop-shadow-sm" />
          <div>
            <span className="block font-display font-bold text-sm text-primary-foreground leading-tight">Canteiro Inteligente</span>
            <span className="block text-[11px] text-primary-foreground/75 leading-tight">Gestão de Equipamentos</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/configuracoes")} className="text-primary-foreground hover:bg-white/15">
              <Settings className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} className="text-primary-foreground hover:bg-white/15">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <h2 className="text-lg font-display font-bold text-foreground mb-6">
          Selecione o Equipamento
        </h2>
        <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
          {EQUIPMENT_TYPES.map((eq) => (
            <button
              key={eq.id}
              onClick={() => handleSelect(eq.id)}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-card border border-border p-4 hover:border-primary/60 hover:shadow-card transition-all duration-200 cursor-pointer aspect-square shadow-sm"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                {eq.isImage ? (
                  <img src={eq.icon as string} alt={eq.label} className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-2xl">{eq.icon}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-foreground text-center leading-tight">
                {eq.label}
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          className="mt-8 text-muted-foreground text-sm"
          onClick={() => navigate("/")}
        >
          ← Voltar ao Hub
        </Button>
      </div>
    </div>
  );
}
