import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bus, MapPin, ChevronRight, type LucideIcon } from "lucide-react";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useOrigemBack } from "@/hooks/useOrigemBack";

type VTItem = {
  label: string;
  desc: string;
  rota: string;
  icon: LucideIcon;
  cor: string;
};

const VT_ITEMS: VTItem[] = [
  {
    label: "Trajeto e VT",
    desc: "Calcule rotas de transporte público e custo de VT",
    rota: "/rh/trajeto-vt",
    icon: Bus,
    cor: "bg-orange-500/20 text-orange-600",
  },
  {
    label: "Gestão de VT",
    desc: "Tarifas, conduções e custo mensal por funcionário",
    rota: "/vale-transporte",
    icon: MapPin,
    cor: "bg-purple-500/20 text-purple-600",
  },
];

export default function GestaoPessoasGerenciamentoVT() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const origemQuery = origem ? `?origem=${encodeURIComponent(origem)}` : "";
  const rotaVoltar = useOrigemBack("/gestao-pessoas", { "gestao-frotas": "/gestao-frotas" });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate(rotaVoltar)} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Gerenciamento de VT</span>
          <span className="block text-[10px] text-primary-foreground/70">Administração de vale-transporte</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {VT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.rota}
              onClick={() => navigate(`${item.rota}${origemQuery}`)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left w-full"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.cor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
