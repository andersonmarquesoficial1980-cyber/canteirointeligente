import React from "react";
import { CalculadoraFrete } from "@/components/suprimentos/CalculadoraFrete";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuprimentosHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
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
