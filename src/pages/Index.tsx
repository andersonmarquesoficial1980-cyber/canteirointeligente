import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMaquinasFrota } from "@/hooks/useMaquinasFrota";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Truck, ClipboardList, AlertTriangle } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const { data: maquinas, isLoading: loadingMaquinas } = useMaquinasFrota();

  const today = new Date().toISOString().split("T")[0];

  const { data: rdoCount, isLoading: loadingRdo } = useQuery({
    queryKey: ["rdo_count_today", today],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rdo_diarios")
        .select("*", { count: "exact", head: true })
        .eq("data", today);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="p-4 space-y-4 pb-8">
      <h1 className="text-xl font-display font-bold text-foreground">Dashboard de Obras</h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => navigate("/rdo")}
          className="h-20 flex-col gap-2 text-base font-semibold rounded-xl"
        >
          <FileText className="w-6 h-6" />
          Novo RDO
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/frota/novo")}
          className="h-20 flex-col gap-2 text-base font-semibold rounded-xl border-border"
        >
          <Plus className="w-6 h-6" />
          Cadastrar Máquina
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {loadingRdo ? "…" : rdoCount}
              </p>
              <p className="text-xs text-muted-foreground">RDOs Hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {loadingMaquinas ? "…" : maquinas?.length ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Equipamentos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Machines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimas Máquinas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingMaquinas ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">Carregando...</p>
          ) : !maquinas?.length ? (
            <div className="px-6 pb-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/frota/novo")}>
                Cadastrar primeiro
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {maquinas.slice(0, 10).map((m: any) => (
                <li key={m.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">Frota: {m.frota}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{m.tipo || "—"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
