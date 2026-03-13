import { useNavigate } from "react-router-dom";
import { HardHat, Truck } from "lucide-react";
import logoFremix from "@/assets/Logo_Fremix.png";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
         style={{ background: "hsl(220 25% 8%)" }}>
      {/* Logo + brand */}
      <div className="mb-12 text-center space-y-3">
        <img src={logoFremix} alt="Fremix Pavimentação" className="h-16 md:h-20 mx-auto object-contain" />
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">
          RDO<span className="text-primary">.</span>{" "}
          <span className="text-accent">Digital</span>
        </h1>
        <p className="text-sm text-muted-foreground">Selecione o módulo para continuar</p>
      </div>

      {/* Hub buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
        <button
          onClick={() => navigate("/obras")}
          className="group flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 backdrop-blur p-10 transition-all hover:border-primary hover:bg-card/80 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <HardHat className="w-8 h-8 text-primary" />
          </div>
          <span className="text-lg font-display font-bold text-foreground">CI Obras</span>
          <span className="text-xs text-muted-foreground text-center leading-relaxed">
            Diário de obra, efetivo, produção e relatórios
          </span>
        </button>

        <button
          onClick={() => navigate("/equipamentos")}
          className="group flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 backdrop-blur p-10 transition-all hover:border-accent hover:bg-card/80 hover:shadow-lg hover:shadow-accent/10 cursor-pointer"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
            <Truck className="w-8 h-8 text-accent" />
          </div>
          <span className="text-lg font-display font-bold text-foreground">CI Equipamentos</span>
          <span className="text-xs text-muted-foreground text-center leading-relaxed">
            Diário de frota, horímetro e gestão de máquinas
          </span>
        </button>
      </div>
    </div>
  );
}
