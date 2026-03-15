import { useNavigate } from "react-router-dom";
import { ClipboardList, Cog } from "lucide-react";
import logoCi from "@/assets/logo-ci.png";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      {/* Brand */}
      <div className="mb-10 text-center space-y-3">
        <img src={logoCi} alt="Canteiro Inteligente" className="h-28 mx-auto object-contain drop-shadow-lg" />
        <p className="text-xs text-muted-foreground tracking-wide">Plataforma de Gestão e Integração de Campo</p>
      </div>

      {/* Module buttons — stacked vertically */}
      <div className="flex flex-col gap-5 w-full max-w-md">
        <button
          onClick={() => navigate("/obras")}
          className="flex items-center gap-4 rounded-2xl bg-header-gradient text-primary-foreground p-6 transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg cursor-pointer"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
            <ClipboardList className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="text-left">
            <span className="block text-lg font-display font-bold">CI Obras</span>
            <span className="block text-xs text-primary-foreground/70">RDO — Diário de Obras</span>
          </div>
        </button>

        <button
          onClick={() => navigate("/equipamentos")}
          className="flex items-center gap-4 rounded-2xl bg-header-gradient text-primary-foreground p-6 transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg cursor-pointer"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/15 shrink-0">
            <Cog className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="text-left">
            <span className="block text-lg font-display font-bold">CI Equipamentos</span>
            <span className="block text-xs text-primary-foreground/70">Gestão de Equipamentos</span>
          </div>
        </button>
      </div>
    </div>
  );
}
