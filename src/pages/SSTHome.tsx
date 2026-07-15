import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import ProgramacoesDoDia from "@/components/ProgramacoesDoDia";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const HUB_ITEMS = [
  {
    label: "Inspeções SST",
    desc: "Registro de inspeções, checklists e relatórios fotográficos",
    icon: ClipboardCheck,
    cor: "bg-orange-500/20 text-orange-600",
    rota: "/sst/inspecoes",
  },
  {
    label: "Integração",
    desc: "Documentos dos funcionários, análise por IA e integrações por obra",
    icon: FolderOpen,
    cor: "bg-blue-500/20 text-blue-600",
    rota: "/sst/integracao",
  },
];

export default function SSTHome() {
  const navigate = useNavigate();
  const [totalInspecoes, setTotalInspecoes] = useState<number | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("sst_inspections")
      .select("id", { count: "exact", head: true })
      .eq("company_id", COMPANY_ID)
      .then(({ count }: any) => { if (count !== null) setTotalInspecoes(count); });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">WF Segurança do Trabalho</span>
          <span className="block text-[10px] text-primary-foreground/70">
            {totalInspecoes !== null ? `${totalInspecoes} inspeções` : ""}
          </span>
        </div>
      </header>

      {/* Programações do dia */}
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <ProgramacoesDoDia />
        </div>
      </div>

      {/* Hub de cards */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {HUB_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.rota}
              onClick={() => navigate(item.rota)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left w-full"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.cor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground shrink-0">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
