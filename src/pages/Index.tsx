import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMaquinasFrota } from "@/hooks/useMaquinasFrota";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Truck, MapPin, AlertTriangle } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const { data: maquinas, isLoading: loadingMaquinas } = useMaquinasFrota();

  const { data: obrasCount, isLoading: loadingObras } = useQuery({
    queryKey: ["obras_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ogs_reference")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

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

  const totalEquip = maquinas?.length ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-5 pb-8 max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Painel de Operações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral do dia {new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => navigate("/rdo")}
          className="h-16 flex-col gap-1.5 text-sm font-semibold rounded-xl"
        >
          <FileText className="w-5 h-5" />
          Novo RDO
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/frota/novo")}
          className="h-16 flex-col gap-1.5 text-sm font-semibold rounded-xl border-border"
        >
          <Plus className="w-5 h-5" />
          Cadastrar Máquina
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loadingMaquinas ? "…" : totalEquip}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Equipamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <MapPin className="w-5 h-5 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loadingObras ? "…" : obrasCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Obras Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loadingRdo ? "…" : rdoCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">RDOs Hoje</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Machines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimas Máquinas</CardTitle>
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
              {maquinas.slice(0, 8).map((m: any) => (
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
