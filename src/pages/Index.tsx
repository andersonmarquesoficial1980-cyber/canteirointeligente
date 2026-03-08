import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Truck, MapPin, HardHat, ClipboardList, Plus } from "lucide-react";
import logoFremix from "@/assets/Logo_Fremix.png";

const ADMIN_EMAILS = ["anderson@fremix.com.br"];

export default function Index() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email && ADMIN_EMAILS.includes(data.user.email)) {
        setIsAdmin(true);
      }
    });
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="bg-card rounded-2xl border border-border p-6 md:p-10 text-center space-y-5">
        <img
          src={logoFremix}
          alt="Fremix Pavimentação"
          className="h-16 md:h-20 mx-auto object-contain"
        />
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            RDO Digital — Fremix Pavimentação
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Plataforma oficial para apontamento de obras, gestão de efetivo, controle de frota e produção asfáltica.
          </p>
        </div>

        {/* Industry icons */}
        <div className="flex justify-center gap-6 text-muted-foreground/60">
          <Truck className="w-7 h-7" />
          <HardHat className="w-7 h-7" />
          <ClipboardList className="w-7 h-7" />
          <MapPin className="w-7 h-7" />
        </div>

        {/* CTA */}
        <Button
          onClick={() => navigate("/rdo")}
          size="lg"
          className="h-14 px-10 text-lg font-bold rounded-xl gap-2 shadow-lg"
        >
          <FileText className="w-6 h-6" /> Novo RDO
        </Button>
      </div>

      {/* Admin-only actions */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/frota/novo")}
            className="h-14 flex-col gap-1.5 text-sm font-semibold rounded-xl border-border"
          >
            <Plus className="w-5 h-5" />
            Cadastrar Máquina
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/configuracoes")}
            className="h-14 flex-col gap-1.5 text-sm font-semibold rounded-xl border-border"
          >
            <ClipboardList className="w-5 h-5" />
            Configurações
          </Button>
        </div>
      )}
    </div>
  );
}
