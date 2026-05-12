import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { CalculadoraFrete } from "@/components/suprimentos/CalculadoraFrete";


export default function SuprimentosHome() {
  return (
    
      <AppLayout title="Suprimentos & Logística">
        <div className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Análise de Frete</h2>
            <p className="text-gray-500">Calcule se compensa enviar veículo próprio ou pagar o frete do fornecedor.</p>
          </div>
          
          <CalculadoraFrete />
        </div>
      </AppLayout>
    
  );
}
