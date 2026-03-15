import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Settings } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logoCi from "@/assets/logo-ci.png";

interface Props {
  title: string;
  backTo?: string;
}

export default function EquipmentHeader({ title, backTo = "/equipamentos" }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <img src={logoCi} alt="Canteiro Inteligente" className="h-9 object-contain" />
        <div>
          <span className="block font-display font-bold text-sm text-foreground leading-tight">Canteiro Inteligente</span>
          <span className="block text-[11px] text-muted-foreground leading-tight">{title}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isAdmin && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/configuracoes")}>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
