import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { LogOut, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logoCi from "@/assets/logo-workflux.png";

import imgFresadora from "@/assets/equip-fresadora.png";
import imgBobcat from "@/assets/equip-bobcat.webp";
import imgRolo from "@/assets/equip-rolo.png";
import imgVibro from "@/assets/equip-vibroacabadora.png";
import imgKma from "@/assets/equip-kma.png";
import imgCaminhao from "@/assets/equip-caminhao.jpg";
import imgComboio from "@/assets/equip-comboio.png";
import imgVeiculo from "@/assets/equip-veiculo.png";
import imgRetro from "@/assets/equip-retro.webp";
import imgCarreta from "@/assets/equip-carreta.avif";

const EQUIPMENT_TYPES = [
  { id: "Fresadora", label: "Fresadora", img: imgFresadora },
  { id: "Bobcat", label: "Bobcat", img: imgBobcat },
  { id: "Rolo", label: "Rolo Compactador", img: imgRolo },
  { id: "Vibroacabadora", label: "Vibroacabadora", img: imgVibro },
  { id: "Usina KMA", label: "Usina Móvel KMA", img: imgKma },
  { id: "Caminhões", label: "Caminhões", img: imgCaminhao },
  { id: "Comboio", label: "Comboio", img: imgComboio },
  { id: "Veículo", label: "Veículo de Transporte", img: imgVeiculo },
  { id: "Retro", label: "Linha Amarela", img: imgRetro },
  { id: "Carreta", label: "Carreta", img: imgCarreta },
];

export default function EquipmentHome() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const { isAdmin } = useIsAdmin();
  const [equipamentosPermitidos, setEquipamentosPermitidos] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("user_permissions").select("equipamentos_permitidos, is_admin")
        .eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data?.is_admin) return;
          if (data?.equipamentos_permitidos?.length > 0) {
            setEquipamentosPermitidos(data.equipamentos_permitidos);
          }
        });
    });
  }, []);

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
    <div className="min-h-screen bg-[hsl(210_20%_98%)] flex flex-col">
      {/* Header with electric gradient */}
      <header className="flex items-center justify-between px-4 py-3 bg-header-gradient shadow-lg">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={logoCi} alt="Workflux" className="h-11 object-contain drop-shadow-lg" />
            <div className="absolute inset-0 rounded-full bg-white/20 blur-md -z-10 scale-110" />
          </div>
          <div>
            <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">Workflux</span>
            <span className="block text-[11px] text-primary-foreground/80 font-medium leading-tight">Gestão de Equipamentos</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} className="text-primary-foreground hover:bg-white/15">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Equipment Cards */}
      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-display font-extrabold text-[hsl(215_80%_22%)] mb-5 text-center">
          Selecione o Equipamento
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {EQUIPMENT_TYPES.filter(eq =>
            equipamentosPermitidos.length === 0 || equipamentosPermitidos.includes(eq.id)
          ).map((eq) => (
            <button
              key={eq.id}
              onClick={() => handleSelect(eq.id)}
              className="group flex items-center gap-3 rounded-2xl bg-white border border-border p-3 hover:border-primary hover:shadow-[0_4px_24px_-4px_hsl(215_80%_50%/0.25)] hover:scale-[1.02] transition-all duration-200 cursor-pointer shadow-[0_2px_12px_-2px_hsl(215_20%_50%/0.12)] text-left"
            >
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 group-hover:border-primary transition-colors">
                  <img src={eq.img} alt={eq.label} className="w-full h-full object-cover" />
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/15 blur-md -z-10 scale-125 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-display font-extrabold text-[hsl(215_80%_22%)] leading-tight truncate">
                  {eq.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>

        {isAdmin && (
          <Button
            variant="outline"
            className="mt-2 w-full h-12 gap-2 text-sm font-semibold border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => navigate("/equipamentos/exportar-protheus")}
          >
            <FileSpreadsheet className="w-5 h-5" />
            Exportar para Protheus
          </Button>
        )}

        <Button
          variant="ghost"
          className="mt-6 w-full text-muted-foreground text-sm font-semibold"
          onClick={() => navigate("/")}
        >
          ← Voltar ao Hub
        </Button>
      </div>
    </div>
  );
}
