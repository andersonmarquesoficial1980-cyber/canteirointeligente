import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Settings } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import logoCi from "@/assets/logo-workflux.png";

interface Props {
  title: string;
  backTo?: string;
}

export default function EquipmentHeader({ title, backTo = "/equipamentos" }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  const handleBack = () => {
    // Em modo edição vindo de Meus Lançamentos, navigate(-1) volta para a página certa
    // Se não há histórico, cai no backTo como fallback
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(backTo);
    }
  };

  const handleLogout = async () => {
    // Preserva chaves de navegação antes de limpar
    const filtros = sessionStorage.getItem("meusLancamentos_filtros");
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    // Não precisa restaurar — usuário saiu do sistema
    window.location.href = "/";
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-header-gradient sticky top-0 z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="text-primary-foreground hover:bg-white/15">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="relative">
          <img src={logoCi} alt="Workflux" className="h-11 object-contain drop-shadow-lg" />
          <div className="absolute inset-0 rounded-full bg-white/20 blur-md -z-10 scale-110" />
        </div>
        <div>
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">Workflux</span>
          <span className="block text-[11px] text-primary-foreground/80 font-medium leading-tight">{title}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isAdmin && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/configuracoes")} className="text-primary-foreground hover:bg-white/15">
            <Settings className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-white/15">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
