import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, ClipboardList, MessageSquare, CheckSquare, Clock, ChevronRight, type LucideIcon } from "lucide-react";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useSmartBack } from "@/hooks/useSmartBack";

type PontoItem = {
  label: string;
  desc: string;
  rota: string;
  icon: LucideIcon;
  cor: string;
};

const PONTO_ITEMS: PontoItem[] = [
  {
    label: "Registrar Ponto",
    desc: "Ponto facial com GPS e geofencing automático",
    rota: "/rh/registrar-ponto",
    icon: Camera,
    cor: "bg-blue-500/20 text-blue-600",
  },
  {
    label: "Espelho de Ponto",
    desc: "Histórico mensal, horas trabalhadas e extras",
    rota: "/rh/espelho-ponto",
    icon: ClipboardList,
    cor: "bg-green-500/20 text-green-600",
  },
  {
    label: "Solicitações de Ponto",
    desc: "Ajuste de ponto e abono de falta",
    rota: "/rh/solicitacoes",
    icon: MessageSquare,
    cor: "bg-yellow-500/20 text-yellow-600",
  },
  {
    label: "Aprovações",
    desc: "Aprovar ou reprovar solicitações da equipe",
    rota: "/rh/aprovacoes",
    icon: CheckSquare,
    cor: "bg-teal-500/20 text-teal-600",
  },
  {
    label: "Banco de Horas",
    desc: "Saldo de horas por funcionário no mês",
    rota: "/rh/banco-horas",
    icon: Clock,
    cor: "bg-indigo-500/20 text-indigo-600",
  },
];

export default function GestaoPessoasGerenciamentoPonto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const origemQuery = origem ? `?origem=${encodeURIComponent(origem)}` : "";
  const goBack = useSmartBack(origem === "gestao-frotas" ? "/gestao-frotas" : "/gestao-pessoas");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm">Gerenciamento de Ponto</span>
          <span className="block text-[10px] text-primary-foreground/70">Administração de ponto dos funcionários</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {PONTO_ITEMS.map((item) => {
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
