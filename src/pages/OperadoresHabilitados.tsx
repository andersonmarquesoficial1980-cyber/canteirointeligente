import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";

import logoCi from "@/assets/logo-workflux.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const EQUIPMENT_TYPES = [
  { id: "Fresadora", label: "Fresadora" },
  { id: "Bobcat", label: "Bobcat" },
  { id: "Rolo", label: "Rolo Compactador" },
  { id: "Vibroacabadora", label: "Vibroacabadora" },
  { id: "Usina KMA", label: "Usina Móvel KMA" },
  { id: "Caminhões", label: "Caminhões" },
  { id: "Comboio", label: "Comboio" },
  { id: "Veículo", label: "Veículo de Transporte" },
  { id: "Retro", label: "Linha Amarela" },
  { id: "Carreta", label: "Carreta" },
] as const;

type EquipmentTypeId = (typeof EQUIPMENT_TYPES)[number]["id"];

interface AccessContext {
  role: string | null;
  companyId: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  funcao: string;
}

interface EquipmentTypeOperator {
  id: string;
  equipment_type: EquipmentTypeId;
  funcionario_id: string;
  company_id: string;
}

export default function OperadoresHabilitados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchByType, setSearchByType] = useState<Record<string, string>>({});

  const { data: accessContext, isLoading: loadingAccess } = useQuery({
    queryKey: ["operadores-habilitados-access"],
    queryFn: async (): Promise<AccessContext> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { role: null, companyId: null };
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      return {
        role: (data as any)?.role || null,
        companyId: (data as any)?.company_id || null,
      };
    },
  });

  const canAccess = accessContext?.role === "admin" || accessContext?.role === "superadmin";
  const companyId = accessContext?.companyId || null;

  const { data: funcionarios = [], isLoading: loadingFuncionarios } = useQuery({
    queryKey: ["operadores-habilitados-funcionarios", companyId],
    queryFn: async (): Promise<Funcionario[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("funcionarios" as any)
        .select("id, nome, funcao")
        .eq("company_id", companyId)
        .order("nome", { ascending: true });

      if (error) throw error;
      return (data || []) as Funcionario[];
    },
    enabled: !!companyId,
  });

  const { data: links = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["equipment-type-operators", companyId],
    queryFn: async (): Promise<EquipmentTypeOperator[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("equipment_type_operators" as any)
        .select("id, equipment_type, funcionario_id, company_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as EquipmentTypeOperator[];
    },
    enabled: !!companyId,
  });

  const addMutation = useMutation({
    mutationFn: async ({ equipmentType, funcionarioId }: { equipmentType: EquipmentTypeId; funcionarioId: string }) => {
      if (!companyId) throw new Error("Usuário sem empresa vinculada.");

      const alreadyExists = links.some(
        (entry) => entry.equipment_type === equipmentType && entry.funcionario_id === funcionarioId,
      );

      if (alreadyExists) return;

      const { error } = await supabase.from("equipment_type_operators" as any).insert({
        company_id: companyId,
        equipment_type: equipmentType,
        funcionario_id: funcionarioId,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipment-type-operators", companyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar operador",
        description: error?.message || "Não foi possível salvar o vínculo.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ equipmentType, funcionarioId }: { equipmentType: EquipmentTypeId; funcionarioId: string }) => {
      if (!companyId) throw new Error("Usuário sem empresa vinculada.");

      const { error } = await supabase
        .from("equipment_type_operators" as any)
        .delete()
        .eq("company_id", companyId)
        .eq("equipment_type", equipmentType)
        .eq("funcionario_id", funcionarioId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["equipment-type-operators", companyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover operador",
        description: error?.message || "Não foi possível remover o vínculo.",
        variant: "destructive",
      });
    },
  });

  const operatorsByType = useMemo(() => {
    const byType: Record<string, Funcionario[]> = {};
    const funcionariosById = new Map(funcionarios.map((f) => [f.id, f]));

    for (const type of EQUIPMENT_TYPES) {
      const ids = links
        .filter((entry) => entry.equipment_type === type.id)
        .map((entry) => entry.funcionario_id);
      const uniqueIds = Array.from(new Set(ids));

      byType[type.id] = uniqueIds
        .map((id) => funcionariosById.get(id))
        .filter((f): f is Funcionario => !!f)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }

    return byType;
  }, [funcionarios, links]);

  const loadingData = loadingFuncionarios || loadingLinks;

  if (loadingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-header-gradient text-primary-foreground px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoCi} alt="Workflux" className="h-9 object-contain" />
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-base leading-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Operadores Habilitados
            </h1>
            <p className="text-[11px] text-primary-foreground/75">Gestão de operadores por tipo de equipamento</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 py-5">
        {!companyId && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Nenhuma empresa vinculada ao usuário atual.
          </div>
        )}

        <Accordion type="multiple" className="space-y-3">
          {EQUIPMENT_TYPES.map((type) => {
            const search = (searchByType[type.id] || "").trim().toLowerCase();
            const enabledForType = operatorsByType[type.id] || [];
            const enabledIds = new Set(enabledForType.map((f) => f.id));
            const available = funcionarios.filter((f) => !enabledIds.has(f.id));
            const filteredAvailable = search
              ? available.filter(
                  (f) =>
                    f.nome.toLowerCase().includes(search) ||
                    f.funcao.toLowerCase().includes(search),
                )
              : available;

            return (
              <AccordionItem
                key={type.id}
                value={type.id}
                className="rounded-xl border border-border bg-card shadow-sm px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-left">
                    <span className="font-semibold text-foreground">{type.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {enabledForType.length} habilitado(s)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {enabledForType.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum operador habilitado.</p>
                      ) : (
                        enabledForType.map((funcionario) => (
                          <div
                            key={`${type.id}-${funcionario.id}`}
                            className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{funcionario.nome}</p>
                              <p className="text-xs text-muted-foreground truncate">{funcionario.funcao}</p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeMutation.mutate({ equipmentType: type.id, funcionarioId: funcionario.id })}
                              disabled={removeMutation.isPending || !companyId}
                              aria-label={`Remover ${funcionario.nome}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <Input
                        value={searchByType[type.id] || ""}
                        onChange={(e) =>
                          setSearchByType((prev) => ({
                            ...prev,
                            [type.id]: e.target.value,
                          }))
                        }
                        className="bg-secondary border-border"
                        placeholder="Buscar funcionário para adicionar..."
                        disabled={loadingData || !companyId}
                      />

                      <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                        {filteredAvailable.slice(0, 12).map((funcionario) => (
                          <button
                            type="button"
                            key={`${type.id}-available-${funcionario.id}`}
                            onClick={() => addMutation.mutate({ equipmentType: type.id, funcionarioId: funcionario.id })}
                            disabled={addMutation.isPending || !companyId}
                            className="w-full text-left px-3 py-2 hover:bg-secondary/70 border-b border-border last:border-b-0"
                          >
                            <p className="text-sm font-medium text-foreground">{funcionario.nome}</p>
                            <p className="text-xs text-muted-foreground">{funcionario.funcao}</p>
                          </button>
                        ))}
                        {filteredAvailable.length === 0 && (
                          <p className="px-3 py-3 text-sm text-muted-foreground">
                            Nenhum funcionário disponível para adicionar.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </main>
    </div>
  );
}
