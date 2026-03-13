import { useNavigate } from "react-router-dom";
import { ClipboardList, Cog } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      {/* Brand */}
      <div className="mb-14 text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-foreground">
          Canteiro<span className="text-accent">.</span>{" "}
          <span className="text-primary">Inteligente</span>
        </h1>
        <p className="text-sm text-muted-foreground">Selecione o módulo para continuar</p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-2xl">
        {/* CI Obras — black card */}
        <button
          onClick={() => navigate("/obras")}
          className="group relative flex flex-col items-center justify-center gap-5 rounded-2xl bg-[hsl(0_0%_7%)] border border-border/60 p-12 transition-all duration-300 hover:border-accent/60 hover:shadow-[0_0_40px_-10px_hsl(var(--accent)/0.25)] cursor-pointer"
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
            <ClipboardList className="w-10 h-10 text-accent" />
          </div>
          <div className="text-center space-y-1.5">
            <span className="block text-xl font-display font-bold text-foreground">CI Obras</span>
            <span className="block text-xs text-muted-foreground leading-relaxed">
              RDO — Diário de Obras
            </span>
          </div>
        </button>

        {/* CI Equipamentos — cobalt card */}
        <button
          onClick={() => navigate("/equipamentos")}
          className="group relative flex flex-col items-center justify-center gap-5 rounded-2xl bg-primary border border-primary/40 p-12 transition-all duration-300 hover:border-primary-foreground/30 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)] cursor-pointer"
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-foreground/10 group-hover:bg-primary-foreground/20 transition-colors">
            <Cog className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="text-center space-y-1.5">
            <span className="block text-xl font-display font-bold text-primary-foreground">CI Equipamentos</span>
            <span className="block text-xs text-primary-foreground/70 leading-relaxed">
              Gestão de Equipamentos
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
