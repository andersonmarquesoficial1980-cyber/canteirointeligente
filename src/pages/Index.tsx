import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Truck, MapPin, HardHat, ClipboardList, Settings, LogOut } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import logoFremix from "@/assets/Logo_Fremix.png";

export default function Index() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { profile } = useUserProfile();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const forceOut = () => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
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
      {/* Top bar with user info and logout */}
      <div className="flex items-center justify-between">
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

      <div className="bg-card rounded-2xl border border-border p-6 md:p-10 text-center space-y-5">
        <img src={logoFremix} alt="Fremix Pavimentação" className="h-16 md:h-20 mx-auto object-contain" />
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            RDO Digital — Fremix Pavimentação
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Plataforma oficial para apontamento de obras, gestão de efetivo, controle de frota e produção asfáltica.
          </p>
        </div>
        <div className="flex justify-center gap-6 text-muted-foreground/60">
          <Truck className="w-7 h-7" />
          <HardHat className="w-7 h-7" />
          <ClipboardList className="w-7 h-7" />
          <MapPin className="w-7 h-7" />
        </div>
        <Button onClick={() => navigate("/rdo")} size="lg" className="h-14 px-10 text-lg font-bold rounded-xl gap-2 shadow-lg">
          <FileText className="w-6 h-6" /> Novo RDO
        </Button>
      </div>

      {isAdmin && (
        <Button
          variant="outline"
          onClick={() => navigate("/admin/configuracoes")}
          className="w-full h-14 gap-2 text-sm font-semibold rounded-xl border-border"
        >
          <Settings className="w-5 h-5" />
          Configurações
        </Button>
      )}
    </div>
  );
}
