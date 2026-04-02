import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ArrowLeft, Bus, Plus, Minus, Pencil, Trash2, Save, X, Search, DollarSign, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Tarifa {
  id: string;
  tipo_transporte: string;
  valor_unitario: number;
  ativo: boolean;
}

interface StaffMember {
  id: string;
  nome: string;
  funcao: string;
  turno: string;
}

interface Conducao {
  id: string;
  funcionario_id: string;
  tarifa_id: string;
  quantidade: number;
}

// ─── Tariff Config Tab ───
function TarifasTab({ tarifas, onRefresh }: { tarifas: Tarifa[]; onRefresh: () => void }) {
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newTipo, setNewTipo] = useState("");
  const [newValor, setNewValor] = useState("");

  const handleSave = async (id: string) => {
    const val = parseFloat(editVal.replace(",", "."));
    if (isNaN(val)) return;
    await supabase.from("vt_tarifas").update({ valor_unitario: val } as any).eq("id", id);
    toast({ title: "Tarifa atualizada" });
    setEditId(null);
    onRefresh();
  };

  const handleAdd = async () => {
    if (!newTipo.trim()) return;
    const val = parseFloat(newValor.replace(",", ".")) || 0;
    await supabase.from("vt_tarifas").insert({ tipo_transporte: newTipo.trim(), valor_unitario: val } as any);
    toast({ title: "Tarifa adicionada" });
    setNewTipo("");
    setNewValor("");
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vt_tarifas").delete().eq("id", id);
    toast({ title: "Tarifa removida" });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure os tipos de transporte e seus valores unitários. Quando houver reajuste, basta editar o valor aqui.
      </p>

      {tarifas.map((t) => (
        <Card key={t.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{t.tipo_transporte}</p>
              {editId === t.id ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm">R$</span>
                  <Input
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="w-24 h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={() => handleSave(t.id)}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="text-lg font-bold text-primary">
                  R$ {Number(t.valor_unitario).toFixed(2).replace(".", ",")}
                </p>
              )}
            </div>
            {isAdmin && editId !== t.id && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditId(t.id);
                    setEditVal(String(t.valor_unitario).replace(".", ","));
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {isAdmin && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Adicionar Nova Tarifa</p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: BRT"
                value={newTipo}
                onChange={(e) => setNewTipo(e.target.value)}
                className="flex-1 h-9"
              />
              <div className="flex items-center gap-1">
                <span className="text-sm">R$</span>
                <Input
                  placeholder="0,00"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  className="w-20 h-9"
                />
              </div>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Employee VT Calculator Tab ───
function CalculadoraTab({
  tarifas,
  staff,
  conducoes,
  onRefresh,
}: {
  tarifas: Tarifa[];
  staff: StaffMember[];
  conducoes: Conducao[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? staff.filter((s) => s.nome.toLowerCase().includes(q) || s.funcao.toLowerCase().includes(q))
    : staff;

  const selectedStaff = staff.find((s) => s.id === selectedId);
  const staffConducoes = conducoes.filter((c) => c.funcionario_id === selectedId);

  const custoDiarioIda = useMemo(() => {
    return staffConducoes.reduce((sum, c) => {
      const tarifa = tarifas.find((t) => t.id === c.tarifa_id);
      return sum + (tarifa ? tarifa.valor_unitario * c.quantidade : 0);
    }, 0);
  }, [staffConducoes, tarifas]);

  const custoMensal = custoDiarioIda * 2 * 22;

  const handleQty = async (tarifaId: string, delta: number) => {
    if (!selectedId) return;
    const existing = staffConducoes.find((c) => c.tarifa_id === tarifaId);
    const newQty = (existing ? existing.quantidade : 0) + delta;

    if (newQty <= 0 && existing) {
      await supabase.from("vt_funcionario_conducoes").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase
        .from("vt_funcionario_conducoes")
        .update({ quantidade: newQty } as any)
        .eq("id", existing.id);
    } else if (delta > 0) {
      await supabase.from("vt_funcionario_conducoes").insert({
        funcionario_id: selectedId,
        tarifa_id: tarifaId,
        quantidade: 1,
      } as any);
    }
    onRefresh();
  };

  if (selectedStaff) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{selectedStaff.nome}</CardTitle>
            <p className="text-xs text-muted-foreground">{selectedStaff.funcao}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Selecione as conduções (trecho de ida):</p>

            {tarifas.filter((t) => t.ativo).map((t) => {
              const c = staffConducoes.find((sc) => sc.tarifa_id === t.id);
              const qty = c ? c.quantidade : 0;
              return (
                <div key={t.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium">{t.tipo_transporte}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {Number(t.valor_unitario).toFixed(2).replace(".", ",")} cada
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleQty(t.id, -1)}
                      disabled={qty === 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center font-bold text-sm">{qty}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleQty(t.id, 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span>Custo ida (1 trecho):</span>
                <span className="font-medium">R$ {custoDiarioIda.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Custo diário (ida + volta):</span>
                <span className="font-medium">R$ {(custoDiarioIda * 2).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Custo mensal (22 dias):</span>
                <span className="text-primary">R$ {custoMensal.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário por nome ou função..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} funcionários</p>

      {filtered.map((s) => {
        const sc = conducoes.filter((c) => c.funcionario_id === s.id);
        const custoIda = sc.reduce((sum, c) => {
          const t = tarifas.find((x) => x.id === c.tarifa_id);
          return sum + (t ? t.valor_unitario * c.quantidade : 0);
        }, 0);
        const mensal = custoIda * 2 * 22;

        return (
          <Card
            key={s.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedId(s.id)}
          >
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{s.nome}</p>
                <p className="text-xs text-muted-foreground">{s.funcao}</p>
              </div>
              {mensal > 0 ? (
                <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">
                  R$ {mensal.toFixed(0)}/mês
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground shrink-0">
                  Sem VT
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main Page ───
export default function ValeTransporte() {
  const navigate = useNavigate();
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [conducoes, setConducoes] = useState<Conducao[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [tRes, sRes, cRes] = await Promise.all([
      supabase.from("vt_tarifas").select("*").order("tipo_transporte"),
      supabase.from("aero_pav_gru_staff").select("id,nome,funcao,turno").eq("ativo", true).order("nome"),
      supabase.from("vt_funcionario_conducoes").select("*"),
    ]);
    if (tRes.data) setTarifas(tRes.data as any as Tarifa[]);
    if (sRes.data) setStaff(sRes.data as any as StaffMember[]);
    if (cRes.data) setConducoes(cRes.data as any as Conducao[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalMensal = useMemo(() => {
    return conducoes.reduce((sum, c) => {
      const t = tarifas.find((x) => x.id === c.tarifa_id);
      return sum + (t ? t.valor_unitario * c.quantidade * 2 * 22 : 0);
    }, 0);
  }, [conducoes, tarifas]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Logística de Transporte (VT)</h1>
            </div>
          </div>

          {/* Summary card */}
          <div className="mt-3 flex gap-3">
            <Card className="flex-1">
              <CardContent className="p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Funcionários</p>
                  <p className="font-bold text-sm">{staff.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Custo Total/Mês</p>
                  <p className="font-bold text-sm text-primary">
                    R$ {totalMensal.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <Tabs defaultValue="calculadora">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="calculadora" className="gap-1.5">
              <Users className="h-4 w-4" /> Funcionários
            </TabsTrigger>
            <TabsTrigger value="tarifas" className="gap-1.5">
              <DollarSign className="h-4 w-4" /> Tarifas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculadora" className="mt-4">
            <CalculadoraTab tarifas={tarifas} staff={staff} conducoes={conducoes} onRefresh={loadAll} />
          </TabsContent>

          <TabsContent value="tarifas" className="mt-4">
            <TarifasTab tarifas={tarifas} onRefresh={loadAll} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
