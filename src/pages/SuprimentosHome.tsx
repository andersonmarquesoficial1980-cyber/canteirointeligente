import React from "react";
import { CalculadoraFrete } from "@/components/suprimentos/CalculadoraFrete";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function DesktopSuprimentosHeader({ goBack }: { goBack: () => void }) {
  const { trail, goTo } = useNavigationTrail({ label: "WF Suprimentos" });
  return (
    <header className="bg-header-gradient text-primary-foreground">
      <div className="flex items-center gap-4 px-8 py-5">
        <button type="button" onClick={goBack} aria-label="Voltar" className="flex h-12 w-12 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ArrowLeft className="h-5 w-5" /></button>
        <div><h1 className="text-2xl font-semibold">WF Suprimentos</h1><p className="text-sm text-primary-foreground/90">Análise de Frete — veículo próprio ou terceirização</p></div>
      </div>
      <div className="px-8 pb-3"><NavigationTrail trail={trail} onSelect={goTo} /></div>
    </header>
  );
}

export default function SuprimentosHome() {
  const goBack = useSmartBack("/");
  const isDesktop = useDesktopWorkspace();

  if (isDesktop) return (
    <div className="min-h-screen bg-page">
      <DesktopSuprimentosHeader goBack={goBack} />
      <main className="mx-auto w-full max-w-[1680px] px-8 py-8"><div className="max-w-5xl"><CalculadoraFrete /></div></main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Análise de Frete</h1>
          <p className="text-sm text-gray-500">Calcule se compensa enviar veículo próprio ou terceirizar</p>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        <CalculadoraFrete />
      </main>
    </div>
  );
}
