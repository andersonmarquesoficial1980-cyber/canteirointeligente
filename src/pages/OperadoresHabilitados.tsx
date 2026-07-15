import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Settings2, X } from "lucide-react";

import { LogoHomeButton } from "@/components/LogoHomeButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Todos os "tipos" que usam a tabela equipment_type_operators
// Os primeiros são para operadores do diário; "Mecânico" é para WF Manutenção
const ALL_CATEGORIES = [
  // WF Manutenção
  { id: "Mecânico", label: "Mecânicos (WF Manutenção)", section: "manutencao" },
  // Operadores Habilitados (diário)
  { id: "Fresadora",   label: "Fresadora",                   section: "operadores" },
  { id: "Bobcat",      label: "Bobcat",                      section: "operadores" },
  { id: "Rolo",        label: "Rolo Compactador",            section: "operadores" },
  { id: "Vibroacabadora", label: "Vibroacabadora",           section: "operadores" },
  { id: "Usina KMA",   label: "Usina Móvel KMA",             section: "operadores" },
  { id: "Caminhões",   label: "Caminhões",                   section: "operadores" },
  { id: "Comboio",     label: "Comboio",                     section: "operadores" },
  { id: "Veículo",     label: "Veículo de Transporte",       section: "operadores" },
  { id: "Retro",       label: "Linha Amarela",               section: "operadores" },
  { id: "Carreta",     label: "Carreta",                     section: "operadores" },
  // WF Abastecimento
  { id: "Lubrificador", label: "Lubrificadores (WF Abastecimento)", section: "abastecimento" },
] as const;

interface AccessContext { role: string | null; companyId: string | null; }
interface Funcionario { id: string; nome: string; funcao: string; }
interface Link { id: string; equipment_type: string; funcionario_id: string; company_id: string; }

export default function OperadoresHabilitados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchByType, setSearchByType] = useState<Record<string, string>>({});

  const { data: accessContext, isLoading: loadingAccess } = useQuery({
    queryKey: ["operadores-habilitados-access"],
    queryFn: async (): Promise<AccessContext> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { role: null, companyId: null };
      const { data, error } = await supabase.from("profiles").select("role, company_id").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return { role: (data as any)?.role || null, companyId: (data as any)?.company_id || null };
    },
  });

  const canAccess = accessContext?.role === "admin" || accessContext?.role === "superadmin";
  const companyId = accessContext?.companyId || null;

  const { data: funcionarios = [], isLoading: loadingFuncionarios } = useQuery({
    queryKey: ["operadores-habilitados-funcionarios", companyId],
    queryFn: async (): Promise<Funcionario[]> => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("employees").select("id, name, role, status")
        .eq("company_id", companyId).eq("status", "ativo").order("name");
      if (error) throw error;
      return ((data || []) as any[]).map((f: any) => ({ id: f.id, nome: f.name, funcao: f.role ?? "" }));
    },
    enabled: !!companyId,
  });

  const { data: links = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["equipment-type-operators", companyId],
    queryFn: async (): Promise<Link[]> => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from("equipment_type_operators").select("id, equipment_type, funcionario_id, company_id")
        .eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Link[];
    },
    enabled: !!companyId,
  });

  const addMutation = useMutation({
    mutationFn: async ({ equipmentType, funcionarioId }: { equipmentType: string; funcionarioId: string }) => {
      if (!companyId) throw new Error("Usuário sem empresa vinculada.");
      if (links.some(e => e.equipment_type === equipmentType && e.funcionario_id === funcionarioId)) return;
      const { error } = await (supabase as any).from("equipment_type_operators").insert({ company_id: companyId, equipment_type: equipmentType, funcionario_id: funcionarioId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment-type-operators", companyId] }),
    onError: (e: any) => toast({ title: "Erro ao adicionar", description: e?.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ equipmentType, funcionarioId }: { equipmentType: string; funcionarioId: string }) => {
      if (!companyId) throw new Error("Usuário sem empresa vinculada.");
      const { error } = await (supabase as any).from("equipment_type_operators").delete()
        .eq("company_id", companyId).eq("equipment_type", equipmentType).eq("funcionario_id", funcionarioId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment-type-operators", companyId] }),
    onError: (e: any) => toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" }),
  });

  const byCategory = useMemo(() => {
    const map: Record<string, Funcionario[]> = {};
    const byId = new Map(funcionarios.map(f => [f.id, f]));
    for (const cat of ALL_CATEGORIES) {
      map[cat.id] = Array.from(new Set(links.filter(l => l.equipment_type === cat.id).map(l => l.funcionario_id)))
        .map(id => byId.get(id)).filter((f): f is Funcionario => !!f)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }
    return map;
  }, [funcionarios, links]);

  const loading = loadingFuncionarios || loadingLinks;

  if (loadingAccess) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!canAccess) return <Navigate to="/" replace />;

  function AccordionSection({ cats }: { cats: typeof ALL_CATEGORIES }) {
    return (
      <Accordion type="multiple" className="space-y-3">
        {cats.map(cat => {
          const search = (searchByType[cat.id] || "").trim().toLowerCase();
          const habilitados = byCategory[cat.id] || [];
          const habIds = new Set(habilitados.map(f => f.id));
          const disponiveis = funcionarios.filter(f => !habIds.has(f.id));
          const filtrados = search ? disponiveis.filter(f => f.nome.toLowerCase().includes(search) || f.funcao.toLowerCase().includes(search)) : disponiveis;

          return (
            <AccordionItem key={cat.id} value={cat.id} className="rounded-xl border border-border bg-card shadow-sm px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{cat.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{habilitados.length} habilitado(s)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  {/* Habilitados */}
                  <div className="space-y-2">
                    {habilitados.length === 0
                      ? <p className="text-sm text-muted-foreground">Nenhum habilitado.</p>
                      : habilitados.map(f => (
                        <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
                          <div><p className="text-sm font-medium text-foreground">{f.nome}</p><p className="text-xs text-muted-foreground">{f.funcao}</p></div>
                          <Button type="button" size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10"
                            onClick={() => removeMutation.mutate({ equipmentType: cat.id, funcionarioId: f.id })}
                            disabled={removeMutation.isPending}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                  {/* Buscar para adicionar */}
                  <div className="space-y-2">
                    <Input value={searchByType[cat.id] || ""} onChange={e => setSearchByType(p => ({ ...p, [cat.id]: e.target.value }))}
                      className="bg-secondary border-border" placeholder="Buscar funcionário..." disabled={loading || !companyId} />
                    <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                      {filtrados.slice(0, 12).map(f => (
                        <button type="button" key={f.id}
                          onClick={() => addMutation.mutate({ equipmentType: cat.id, funcionarioId: f.id })}
                          disabled={addMutation.isPending} className="w-full text-left px-3 py-2 hover:bg-secondary/70 border-b border-border last:border-b-0">
                          <p className="text-sm font-medium text-foreground">{f.nome}</p>
                          <p className="text-xs text-muted-foreground">{f.funcao}</p>
                        </button>
                      ))}
                      {filtrados.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum disponível.</p>}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  }

  const catsManutencao = ALL_CATEGORIES.filter(c => c.section === "manutencao");
  const catsAbastecimento = ALL_CATEGORIES.filter(c => c.section === "abastecimento");
  const catsOperadores = ALL_CATEGORIES.filter(c => c.section === "operadores");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-header-gradient text-primary-foreground px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition"><ArrowLeft className="h-5 w-5" /></button>
          <LogoHomeButton className="h-9 object-contain" />
          <div className="flex-1">
            <h1 className="font-display font-extrabold text-base leading-tight flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Cadastros do Sistema
            </h1>
            <p className="text-[11px] text-primary-foreground/75">Configure listas e habilitações por módulo</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 py-5 space-y-8">
        {!companyId && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Nenhuma empresa vinculada ao usuário atual.
          </div>
        )}

        <section>
          <h2 className="font-display font-bold text-base mb-1">WF Manutenção</h2>
          <p className="text-sm text-muted-foreground mb-3">Funcionários que aparecem no campo "Mecânico" ao abrir uma Ordem de Serviço.</p>
          <AccordionSection cats={catsManutencao as any} />
        </section>

        <section>
          <h2 className="font-display font-bold text-base mb-1">WF Abastecimento</h2>
          <p className="text-sm text-muted-foreground mb-3">Funcionários que aparecem no campo "Lubrificador" ao lançar um abastecimento.</p>
          <AccordionSection cats={catsAbastecimento as any} />
        </section>

        <section>
          <h2 className="font-display font-bold text-base mb-1">Operadores Habilitados</h2>
          <p className="text-sm text-muted-foreground mb-3">Configure quais funcionários aparecem ao lançar o diário de cada equipamento.</p>
          <AccordionSection cats={catsOperadores as any} />
        </section>
      </main>
    </div>
  );
}
