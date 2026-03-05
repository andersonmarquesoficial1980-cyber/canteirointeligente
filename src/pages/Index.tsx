import { useNavigate } from "react-router-dom";
import { useMaquinasFrota } from "@/hooks/useMaquinasFrota";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Truck, Wrench, AlertTriangle } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const { data: maquinas, isLoading } = useMaquinasFrota();

  const totalAtivos = maquinas?.length ?? 0;
  const porTipo = maquinas?.reduce((acc, m) => {
    const tipo = m.tipo || "Outros";
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-4">
        <h1 className="text-xl font-display font-bold text-foreground">
          Painel <span className="text-primary">RDO</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Relatório Diário de Obra</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalAtivos}</p>
                <p className="text-xs text-muted-foreground">Equipamentos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{Object.keys(porTipo).length}</p>
                <p className="text-xs text-muted-foreground">Categorias</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Equipment List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Frota Ativa</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
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
                {maquinas.map((m) => (
                  <li key={m.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                      <p className="text-xs text-muted-foreground">Frota: {m.frota}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {m.tipo || "—"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
