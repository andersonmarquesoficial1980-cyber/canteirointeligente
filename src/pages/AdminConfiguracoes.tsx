import { useState, useEffect, lazy, Suspense, memo } from "react";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { EngenheirosOgsManager } from "@/components/admin/EngenheirosOgsManager";
import { EncEncarregadoOgsManager } from "@/components/admin/EncEncarregadoOgsManager";
function AuditLogViewerAdmin() { return <AuditLogViewer />; }
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, Save, Pencil,
  Users, MapPin, Package, Truck, BarChart3,
  Wrench, Factory, Hammer, Mail, ShieldCheck, LogOut, UserMinus, UserCheck, X, Unlock, Bell,
  Target, ClipboardList, Search, Eye, EyeOff, Shield, FileSpreadsheet, Bus, Receipt, Loader2, HardHat, FileText, Settings, LogIn,
  Briefcase, Building2, Fuel, DollarSign,
} from "lucide-react";
import { useFuncoes } from "@/hooks/useFuncoes";
import { useEmpresasParceiras } from "@/hooks/useEmpresasParceiras";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { startImpersonation } from "@/hooks/useImpersonation";
import UsersManagerExternal from "@/components/admin/UsersManager";
import FuncionariosManager from "@/components/admin/FuncionariosManager";
import CentrosCustoManager from "@/components/admin/CentrosCustoManager";
import EquipesManager from "@/components/admin/EquipesManager";
import EncarregadosManager from "@/components/admin/EncarregadosManager";

import PermissoesManager from "@/components/admin/PermissoesManager";
import AdminRolesPage from "./AdminRolesPage";
import logoCi from "@/assets/logo-workflux.png";

const FleetDashboard = lazy(() => import("./FleetDashboard"));
const UnifiedEquipmentView = lazy(() => import("@/components/admin/UnifiedEquipmentView"));
const WFDashboardsHub = lazy(() => import("./WFDashboards"));

const VINCULO_OPTIONS = [
  "FRESADORA", "BOBCAT", "VIBRO", "KMA",
  "ROLO_CHAPA", "ROLO_PNEU", "ROLO_PE_CARNEIRO",
  "CAMINHAO_PIPA", "CAMINHAO_CARROCERIA", "CAMINHAO_ESPARGIDOR", "CAMINHAO_BASCULANTE",
  "COMBOIO",
  "VEICULO_VAN", "VEICULO_MICROONIBUS",
  "LINHA_AMARELA_RETRO", "LINHA_AMARELA_ESCAVADEIRA", "LINHA_AMARELA_PA",
  "LINHA_AMARELA_MOTO", "LINHA_AMARELA_TRATOR", "LINHA_AMARELA_MINI",
  "CARRETA", "RDO", "TODOS"
];
const VINCULO_LABELS: Record<string, string> = {
  FRESADORA: "Fresadora",
  BOBCAT: "Bobcat",
  VIBRO: "Vibroacabadora",
  KMA: "Usina Móvel KMA",
  ROLO_CHAPA: "🚧 Rolo Chapa",
  ROLO_PNEU: "🚧 Rolo Pneu",
  ROLO_PE_CARNEIRO: "🚧 Rolo Pé de Carneiro",
  CAMINHAO_PIPA: "💧 Caminhão Pipa",
  CAMINHAO_CARROCERIA: "📦 Caminhão Carroceria",
  CAMINHAO_ESPARGIDOR: "🛢️ Caminhão Espargidor",
  CAMINHAO_BASCULANTE: "🚛 Caminhão Basculante",
  CAMINHAO_PLATAFORMA: "🚚 Caminhão Plataforma",
  COMBOIO: "Comboio",
  VEICULO_VAN: "🚐 Van",
  VEICULO_MICROONIBUS: "🚌 Microônibus",
  LINHA_AMARELA_RETRO: "🟡 Retroescavadeira",
  LINHA_AMARELA_ESCAVADEIRA: "🟡 Escavadeira Hidráulica",
  LINHA_AMARELA_PA: "🟡 Pá Carregadeira",
  LINHA_AMARELA_MOTO: "🟡 Motoniveladora",
  LINHA_AMARELA_TRATOR: "🟡 Trator de Esteira",
  LINHA_AMARELA_MINI: "🟡 Mini Escavadeira",
  CARRETA: "Carreta",
  RDO: "RDO",
  TODOS: "Todos",
  // legado — mantidos para compatibilidade
  ROLO: "Rolo (legado)",
  VEICULO: "Veículo (legado)",
  LINHA_AMARELA: "Linha Amarela (legado)",
  CAMINHOES: "Caminhões (legado)",
  PAVIMENTACAO: "RDO Pavimentação",
  INFRA: "RDO Infra",
  CANTEIRO: "RDO Canteiro",
  PIPA: "Caminhão Pipa",
  ESPARGIDOR: "Espargidor",
};
const TIPO_INSUMO_OPTIONS = ["Diesel", "Emulsão", "Água", "Concreto", "Massa Asfáltica", "Insumos", "Outro"];
const TIPO_USO_OPTIONS = ["Nota Fiscal", "Transporte", "Ambos"];
const CATEGORIAS_EQUIP = ["FRESAGEM", "BOBCAT", "VIBROACABADORA", "ROLO COMPACTADOR", "VEÍCULOS", "LINHA AMARELA", "PEQUENO PORTE", "USINA MÓVEL"];

// Generic CRUD hook for simple tables
function useCrudTable(tableName: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const hasNome = ["fornecedores", "tipos_servico", "usinas", "materiais"].includes(tableName);
    const { data, error } = await supabase.from(tableName as any).select("*").order(hasNome ? "nome" : "created_at", { ascending: hasNome ? true : false });
    if (!error && data) setItems(data as any[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tableName]);

  const add = async (item: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sessão expirada", description: "Faça login novamente para continuar.", variant: "destructive" });
        return false;
      }
      const { error } = await supabase.from(tableName as any).insert(item);
      if (error) {
        toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "✅ Adicionado com sucesso!" });
      await load();
      return true;
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const remove = async (id: string) => {
    if (!id) {
      toast({ title: "Erro interno", description: "Identificador não encontrado.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from(tableName as any).delete().eq("id", id);
      if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Removido!" });
      await load();
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
  };

  const update = async (id: string, fields: any) => {
    try {
      const { error } = await supabase.from(tableName as any).update(fields).eq("id", id);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return false; }
      toast({ title: "✅ Atualizado!" });
      await load();
      return true;
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return { items, loading, add, remove, update, reload: load };
}

// Simple entity form with nome + vinculos (multi)
function EntityManager({ tableName, label, vinculoOptions = VINCULO_OPTIONS }: { tableName: string; label: string; vinculoOptions?: string[] }) {
  const { items, loading, add, remove, update } = useCrudTable(tableName);
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculos, setVinculos] = useState<string[]>(["TODOS"]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editVinculos, setEditVinculos] = useState<string[]>(["TODOS"]);

  const toggleVinculo = (v: string, current: string[], set: (x: string[]) => void) => {
    if (v === "TODOS") { set(["TODOS"]); return; }
    const sem = current.filter(x => x !== "TODOS");
    if (sem.includes(v)) {
      const novo = sem.filter(x => x !== v);
      set(novo.length === 0 ? ["TODOS"] : novo);
    } else {
      set([...sem, v]);
    }
  };

  const PillGroup = ({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => {
        const active = selected.includes(v);
        return (
          <button key={v} type="button" onClick={() => onToggle(v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground border-primary"
                     : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
            }`}>
            {VINCULO_LABELS[v] ?? v}
          </button>
        );
      })}
    </div>
  );

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); return; }
    const ok = await add({ nome: nome.trim(), vinculos, vinculo_rdo: vinculos[0] });
    if (ok) { setNome(""); setVinculos(["TODOS"]); }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditNome(item.nome || "");
    setEditVinculos(item.vinculos?.length ? item.vinculos : [item.vinculo_rdo || "TODOS"]);
  };

  const saveEdit = async (id: string) => {
    if (!editNome.trim()) { toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); return; }
    const ok = await update(id, { nome: editNome.trim(), vinculos: editVinculos, vinculo_rdo: editVinculos[0] });
    if (ok) setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder={`Novo ${label}`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Onde aparece (um ou mais)</Label>
          <PillGroup options={vinculoOptions} selected={vinculos} onToggle={v => toggleVinculo(v, vinculos, setVinculos)} />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro.</p>
        ) : items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
            {editingId === item.id ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-9 bg-secondary border-border text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Onde aparece</Label>
                  <PillGroup options={vinculoOptions} selected={editVinculos} onToggle={v => toggleVinculo(v, editVinculos, setEditVinculos)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => saveEdit(item.id)}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <p className="font-medium text-sm text-foreground">{item.nome}</p>
                  <div className="flex flex-wrap gap-1">
                    {(item.vinculos?.length ? item.vinculos : [item.vinculo_rdo || "TODOS"]).map((v: string) => (
                      <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{VINCULO_LABELS[v] ?? v}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(item)} className="text-primary p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Fornecedores manager — multi-vínculo + multi-insumo (arrays) + edição inline
function FornecedoresManager() {
  const { items, loading, add, remove, update } = useCrudTable("fornecedores");
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculos, setVinculos] = useState<string[]>(["TODOS"]);
  const [tipoInsumos, setTipoInsumos] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNomeForn, setEditNomeForn] = useState("");
  const [editVinculos, setEditVinculos] = useState<string[]>([]);
  const [editTipoInsumos, setEditTipoInsumos] = useState<string[]>([]);

  const toggleItem = (v: string, current: string[], set: (x: string[]) => void, todoKey?: string) => {
    if (todoKey && v === todoKey) { set([todoKey]); return; }
    const sem = todoKey ? current.filter(x => x !== todoKey) : current;
    if (sem.includes(v)) {
      const novo = sem.filter(x => x !== v);
      set(todoKey ? (novo.length === 0 ? [todoKey] : novo) : novo);
    } else {
      set([...sem, v]);
    }
  };

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); return; }
    if (vinculos.length === 0) { toast({ title: "Atenção", description: "Selecione ao menos um vínculo.", variant: "destructive" }); return; }
    const ok = await add({
      nome: nome.trim(),
      vinculos,
      vinculo_rdo: vinculos[0],
      tipo_insumos: tipoInsumos,
      tipo_insumo: tipoInsumos[0] ?? null,
    });
    if (ok) { setNome(""); setVinculos(["TODOS"]); setTipoInsumos([]); }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditNomeForn(item.nome || "");
    setEditVinculos(item.vinculos?.length ? item.vinculos : [item.vinculo_rdo || "TODOS"]);
    setEditTipoInsumos(item.tipo_insumos?.length ? item.tipo_insumos : (item.tipo_insumo ? [item.tipo_insumo] : []));
  };

  const saveEdit = async (id: string) => {
    if (!editNomeForn.trim()) { toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); return; }
    if (editVinculos.length === 0) { toast({ title: "Atenção", description: "Selecione ao menos um vínculo.", variant: "destructive" }); return; }
    const ok = await update(id, {
      nome: editNomeForn.trim(),
      vinculos: editVinculos,
      vinculo_rdo: editVinculos[0],
      tipo_insumos: editTipoInsumos,
      tipo_insumo: editTipoInsumos[0] ?? null,
    });
    if (ok) setEditingId(null);
  };

  const PillGroup = ({ options, selected, onToggle, labelMap, todoKey }: {
    options: string[];
    selected: string[];
    onToggle: (v: string) => void;
    labelMap?: Record<string, string>;
    todoKey?: string;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => {
        const active = selected.includes(v);
        return (
          <button key={v} type="button" onClick={() => onToggle(v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground border-primary"
                     : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
            }`}>
            {labelMap?.[v] ?? v}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Formulário de adição */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome do Fornecedor</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Novo Fornecedor" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Onde aparece (um ou mais)</Label>
          <PillGroup options={FORNECEDOR_VINCULO_OPTIONS} selected={vinculos}
            onToggle={v => toggleItem(v, vinculos, setVinculos, "TODOS")}
            labelMap={VINCULO_LABELS} todoKey="TODOS" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipos de Insumo (um ou mais)</Label>
          <PillGroup options={TIPO_INSUMO_OPTIONS} selected={tipoInsumos}
            onToggle={v => toggleItem(v, tipoInsumos, setTipoInsumos)} />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum fornecedor cadastrado.</p>
        ) : items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
            {editingId === item.id ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={editNomeForn} onChange={e => setEditNomeForn(e.target.value)} className="h-9 bg-secondary border-border text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Onde aparece</Label>
                  <PillGroup options={FORNECEDOR_VINCULO_OPTIONS} selected={editVinculos}
                    onToggle={v => toggleItem(v, editVinculos, setEditVinculos, "TODOS")}
                    labelMap={VINCULO_LABELS} todoKey="TODOS" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipos de Insumo</Label>
                  <PillGroup options={TIPO_INSUMO_OPTIONS} selected={editTipoInsumos}
                    onToggle={v => toggleItem(v, editTipoInsumos, setEditTipoInsumos)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => saveEdit(item.id)}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <p className="font-medium text-sm text-foreground">{item.nome}</p>
                  <div className="flex flex-wrap gap-1">
                    {(item.vinculos?.length ? item.vinculos : [item.vinculo_rdo || "TODOS"]).map((v: string) => (
                      <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                        {VINCULO_LABELS[v] ?? v}
                      </span>
                    ))}
                    {(item.tipo_insumos?.length ? item.tipo_insumos : (item.tipo_insumo ? [item.tipo_insumo] : [])).map((t: string) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(item)} className="text-primary p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Machines manager
function MaquinasManager() {
  const { items, loading, add, remove, update } = useCrudTable("equipamentos");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [frota, setFrota] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if ((data as any)?.company_id) setCompanyId((data as any).company_id); });
    });
  }, []);
  const [categoria, setCategoria] = useState("");
  const [condicao, setCondicao] = useState("PROPRIO");
  const [empresa, setEmpresa] = useState("PRÓPRIO");
  const [vinculos, setVinculos] = useState<string[]>(["TODOS"]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrota, setEditFrota] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [editCategoria, setEditCategoria] = useState("");
  const [editEmpresa, setEditEmpresa] = useState("");
  const [editCondicao, setEditCondicao] = useState("PROPRIO");
  const [editVinculos, setEditVinculos] = useState<string[]>(["TODOS"]);

  const toggleVinculo = (v: string, current: string[], set: (x: string[]) => void) => {
    if (v === "TODOS") { set(["TODOS"]); return; }
    const sem = current.filter(x => x !== "TODOS");
    if (sem.includes(v)) {
      const novo = sem.filter(x => x !== v);
      set(novo.length === 0 ? ["TODOS"] : novo);
    } else {
      set([...sem, v]);
    }
  };

  const PillGroup = ({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => {
        const active = selected.includes(v);
        return (
          <button key={v} type="button" onClick={() => onToggle(v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground border-primary"
                     : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
            }`}>
            {VINCULO_LABELS[v] ?? v}
          </button>
        );
      })}
    </div>
  );

  const handleAdd = async () => {
    if (!frota.trim() || !nome.trim()) {
      toast({ title: "Atenção", description: "Preencha Frota e Nome.", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Erro", description: "Empresa não identificada. Faça login novamente.", variant: "destructive" });
      return;
    }
    const ok = await add({ frota: frota.trim(), nome: nome.trim(), tipo: tipo.trim(), categoria_rdo: categoria, condicao, empresa_proprietaria: empresa.trim() || null, vinculos, vinculo_rdo: vinculos[0], status: "ativo", company_id: companyId });
    if (ok) { setFrota(""); setNome(""); setTipo(""); setCategoria(""); setCondicao("PROPRIO"); setEmpresa("PRÓPRIO"); setVinculos(["TODOS"]); }
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setEditFrota(m.frota || "");
    setEditNome(m.nome || "");
    setEditTipo(m.tipo || "");
    setEditCategoria(m.categoria || "");
    setEditCondicao(m.condicao || (m.categoria === 'locado' ? 'TERCEIRO' : 'PROPRIO'));
    setEditEmpresa(m.empresa || "");
    setEditVinculos(m.vinculos?.length ? m.vinculos : [m.vinculo_rdo || "TODOS"]);
  };

  const saveEdit = async (id: string) => {
    if (!editFrota.trim() || !editNome.trim()) { toast({ title: "Atenção", description: "Frota e Nome são obrigatórios.", variant: "destructive" }); return; }
    const ok = await update(id, { frota: editFrota.trim(), nome: editNome.trim(), tipo: editTipo.trim(), categoria_rdo: editCategoria, condicao: editCondicao, empresa_proprietaria: editEmpresa.trim() || null, vinculos: editVinculos, vinculo_rdo: editVinculos[0] });
    if (ok) setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Frota *</Label>
            <Input value={frota} onChange={e => setFrota(e.target.value)} className="h-11 bg-secondary border-border" placeholder="FA12" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome/Modelo *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="WIRTGEN W200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Input value={tipo} onChange={e => setTipo(e.target.value)} className="h-11 bg-secondary border-border" placeholder="FRESADORA" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Condição</Label>
            <Select value={condicao} onValueChange={v => { setCondicao(v); setEmpresa(v === "PROPRIO" ? "PRÓPRIO" : ""); }}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROPRIO">Próprio (Fremix)</SelectItem>
                <SelectItem value="TERCEIRO">Terceiro (Locado/Alugado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Empresa Proprietária</Label>
          <Input value={empresa} onChange={e => setEmpresa(e.target.value)} className="h-11 bg-secondary border-border" placeholder={condicao === "TERCEIRO" ? "Ex: MERGULHÃO, FORMILOC..." : "FREMIX"} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{CATEGORIAS_EQUIP.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Onde aparece (um ou mais)</Label>
          <PillGroup options={VINCULO_OPTIONS} selected={vinculos} onToggle={v => toggleVinculo(v, vinculos, setVinculos)} />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Equipamento</Button>
      </div>
      {/* Busca e filtro */}
      <div className="bg-card rounded-xl border border-border p-3 space-y-2">
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-9 bg-secondary border-border text-sm"
          placeholder="🔍 Buscar por frota, nome ou tipo..."
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterCategoria("")}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              filterCategoria === "" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border"
            }`}>
            Todas
          </button>
          {CATEGORIAS_EQUIP.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategoria(prev => prev === c ? "" : c)}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                filterCategoria === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border"
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : (() => {
          const q = searchQuery.toLowerCase();
          const filtered = items.filter((m: any) => {
            const matchSearch = !q ||
              m.frota?.toLowerCase().includes(q) ||
              m.nome?.toLowerCase().includes(q) ||
              m.tipo?.toLowerCase().includes(q);
            const matchCat = !filterCategoria || (m.categoria_rdo || m.categoria) === filterCategoria;
            return matchSearch && matchCat;
          });
          if (filtered.length === 0) return (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado encontrado.</p>
          );
          return filtered.map((m: any) => (
          <div key={m.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
            {editingId === m.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Frota *</Label><Input value={editFrota} onChange={e => setEditFrota(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Nome/Modelo *</Label><Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Tipo</Label><Input value={editTipo} onChange={e => setEditTipo(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Condição</Label>
                    <Select value={editCondicao} onValueChange={v => { setEditCondicao(v); if (v === "PROPRIO") setEditEmpresa("PRÓPRIO"); }}>
                      <SelectTrigger className="h-9 bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROPRIO">Próprio (Fremix)</SelectItem>
                        <SelectItem value="TERCEIRO">Terceiro (Locado/Alugado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Empresa Proprietária</Label>
                  <Input value={editEmpresa} onChange={e => setEditEmpresa(e.target.value)} className="h-9 bg-secondary border-border text-sm" placeholder={editCondicao === "TERCEIRO" ? "Ex: MERGULHÃO, FORMILOC..." : "FREMIX"} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={editCategoria} onValueChange={setEditCategoria}>
                    <SelectTrigger className="h-9 bg-secondary border-border text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_EQUIP.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Onde aparece</Label>
                  <PillGroup options={VINCULO_OPTIONS} selected={editVinculos} onToggle={v => toggleVinculo(v, editVinculos, setEditVinculos)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => saveEdit(m.id)}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <p className="font-medium text-sm text-foreground">{m.frota} — {m.tipo} ({m.nome})</p>
                  <div className="flex flex-wrap gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${m.condicao === 'TERCEIRO' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{m.condicao === 'TERCEIRO' ? 'Terceiro' : 'Próprio'}</span>
                    {m.empresa_proprietaria && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{m.empresa_proprietaria}</span>}
                    {(m.categoria_rdo || m.categoria) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{m.categoria_rdo || m.categoria}</span>}
                    {(m.vinculos?.length ? m.vinculos : [m.vinculo_rdo || "TODOS"]).map((v: string) => (
                      <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{VINCULO_LABELS[v] ?? v}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => navigate(`/equipamentos/prontuario/${m.id}`)} className="text-blue-600 p-1" title="Prontuário"><FileText className="w-4 h-4" /></button>
                  <button onClick={() => startEdit(m)} className="text-primary p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(m.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
          ));
        })()}
      </div>
    </div>
  );
}

// Email config
function EmailConfig() {
  const { toast } = useToast();
  const [emails, setEmails] = useState<string[]>([""]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracoes_relatorio").select("*").limit(1).single().then(({ data }) => {
      if (data) {
        setConfigId(data.id);
        const arr = (data.emails_destino as string[]) || [];
        setEmails(arr.length > 0 ? arr : [""]);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const validEmails = emails.filter(e => e.trim().length > 0);
    try {
      if (configId) {
        const { error } = await supabase.from("configuracoes_relatorio").update({ emails_destino: validEmails, updated_at: new Date().toISOString() }).eq("id", configId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configuracoes_relatorio").insert({ emails_destino: validEmails });
        if (error) throw error;
      }
      toast({ title: "✅ E-mails salvos!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm text-muted-foreground">E-mails que receberão o relatório ao enviar um RDO.</p>
        {emails.map((email, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail {idx + 1}</Label>
              <Input type="email" value={email} onChange={e => { const u = [...emails]; u[idx] = e.target.value; setEmails(u); }} className="h-11 bg-secondary border-border" placeholder="exemplo@empresa.com.br" />
            </div>
            {emails.length > 1 && (
              <button onClick={() => setEmails(emails.filter((_, i) => i !== idx))} className="text-destructive p-2 mt-5"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={() => setEmails([...emails, ""])} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar E-mail</Button>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base gap-2 font-semibold">
        <Save className="w-5 h-5" /> {saving ? "Salvando..." : "Salvar E-mails"}
      </Button>
    </div>
  );
}

function NotificationPrefsManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [prefsByUserId, setPrefsByUserId] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUsers([]);
        setPrefsByUserId({});
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const myCompanyId = (myProfile as any)?.company_id;
      setCompanyId(myCompanyId || null);

      if (!myCompanyId) {
        setUsers([]);
        setPrefsByUserId({});
        return;
      }

      const [{ data: profilesRows }, { data: prefsRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nome_completo, perfil, status")
          .eq("company_id", myCompanyId)
          .order("nome_completo", { ascending: true }),
        (supabase as any)
          .from("notification_prefs")
          .select("*")
          .eq("company_id", myCompanyId),
      ]);

      const activeUsers = ((profilesRows as any[]) || []).filter((u) => u?.status !== "inativo");
      setUsers(activeUsers);
      const map: Record<string, any> = {};
      ((prefsRows as any[]) || []).forEach((row: any) => {
        if (row?.user_id) map[row.user_id] = row;
      });
      setPrefsByUserId(map);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao carregar preferências.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getPrefValue = (userId: string, key: "notify_rdo" | "notify_diario_equipamento" | "notify_diario_carreta") =>
    Boolean(prefsByUserId[userId]?.[key]);

  const updatePref = async (
    userId: string,
    key: "notify_rdo" | "notify_diario_equipamento" | "notify_diario_carreta",
    value: boolean,
  ) => {
    if (!companyId) return;
    const cache = prefsByUserId[userId] || {};
    const payload = {
      user_id: userId,
      company_id: companyId,
      notify_rdo: key === "notify_rdo" ? value : (cache.notify_rdo ?? false),
      notify_diario_equipamento: key === "notify_diario_equipamento" ? value : (cache.notify_diario_equipamento ?? false),
      notify_diario_carreta: key === "notify_diario_carreta" ? value : (cache.notify_diario_carreta ?? false),
      notify_demanda: cache.notify_demanda ?? true,
      notify_todos_carretas: cache.notify_todos_carretas ?? false,
      updated_at: new Date().toISOString(),
    };

    const savingId = `${userId}:${key}`;
    setSavingKey(savingId);
    try {
      const { data, error } = await (supabase as any)
        .from("notification_prefs")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw error;
      setPrefsByUserId((prev) => ({ ...prev, [userId]: data }));
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Não foi possível atualizar.", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando preferências...</p>;
  }

  if (!companyId) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada ao seu usuário.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-sm text-muted-foreground">
          Configure por usuário quais eventos geram push notification.
        </p>
      </div>

      <div className="space-y-2">
        {users.map((usr: any) => (
          <div key={usr.user_id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div>
              <p className="font-medium text-sm text-foreground">{usr.nome_completo || "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{usr.perfil || "Perfil não informado"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
                <span className="text-sm">Receber push de RDO</span>
                <Switch
                  checked={getPrefValue(usr.user_id, "notify_rdo")}
                  disabled={savingKey === `${usr.user_id}:notify_rdo`}
                  onCheckedChange={(checked) => updatePref(usr.user_id, "notify_rdo", checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
                <span className="text-sm">Push de Diário de Equipamento</span>
                <Switch
                  checked={getPrefValue(usr.user_id, "notify_diario_equipamento")}
                  disabled={savingKey === `${usr.user_id}:notify_diario_equipamento`}
                  onCheckedChange={(checked) => updatePref(usr.user_id, "notify_diario_equipamento", checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
                <span className="text-sm">Push de Diário de Carreta</span>
                <Switch
                  checked={getPrefValue(usr.user_id, "notify_diario_carreta")}
                  disabled={savingKey === `${usr.user_id}:notify_diario_carreta`}
                  onCheckedChange={(checked) => updatePref(usr.user_id, "notify_diario_carreta", checked)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationTargetsManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedSourceUserId, setSelectedSourceUserId] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<"rdo" | "diario_equipamento" | "diario_carreta">("rdo");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [targetsByEvent, setTargetsByEvent] = useState<Record<string, Set<string>>>({
    rdo: new Set<string>(),
    diario_equipamento: new Set<string>(),
    diario_carreta: new Set<string>(),
  });

  const eventSections: Array<{ key: "rdo" | "diario_equipamento" | "diario_carreta"; label: string }> = [
    { key: "rdo", label: "RDO" },
    { key: "diario_equipamento", label: "Diário de Equipamento" },
    { key: "diario_carreta", label: "Diário de Carreta" },
  ];

  // Pré-seleciona o tipo de evento pelo perfil do funcionário selecionado
  const handleSourceUserChange = (userId: string) => {
    setSelectedSourceUserId(userId);
    const user = users.find((u: any) => u.user_id === userId);
    if (!user) return;
    const perfil = user.perfil || "";
    if (perfil === "Apontador") setSelectedEventType("rdo");
    else if (perfil === "Motorista") setSelectedEventType("diario_carreta");
    else setSelectedEventType("diario_equipamento");
  };

  const loadBase = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCompanyId(null);
        setUsers([]);
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const myCompanyId = (myProfile as any)?.company_id;
      setCompanyId(myCompanyId || null);
      if (!myCompanyId) {
        setUsers([]);
        return;
      }

      const { data: profilesRows, error: usersError } = await supabase
        .from("profiles")
        .select("user_id, nome_completo, perfil, status")
        .eq("company_id", myCompanyId)
        .order("nome_completo", { ascending: true });

      if (usersError) throw usersError;
      const activeUsers = ((profilesRows as any[]) || []).filter((u) => u?.status !== "inativo");
      setUsers(activeUsers);

      if (activeUsers.length > 0 && !selectedSourceUserId) {
        setSelectedSourceUserId(activeUsers[0].user_id);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Não foi possível carregar usuários.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadTargets = async (sourceUserId: string, currentCompanyId: string) => {
    if (!sourceUserId || !currentCompanyId) {
      setTargetsByEvent({
        rdo: new Set<string>(),
        diario_equipamento: new Set<string>(),
        diario_carreta: new Set<string>(),
      });
      return;
    }

    try {
      const { data: rows, error } = await (supabase as any)
        .from("notification_targets")
        .select("target_user_id, event_type")
        .eq("company_id", currentCompanyId)
        .eq("source_user_id", sourceUserId);
      if (error) throw error;

      const grouped: Record<string, Set<string>> = {
        rdo: new Set<string>(),
        diario_equipamento: new Set<string>(),
        diario_carreta: new Set<string>(),
      };

      (rows || []).forEach((row: any) => {
        const eventType = row?.event_type;
        const targetUserId = row?.target_user_id;
        if (eventType && targetUserId && grouped[eventType]) {
          grouped[eventType].add(targetUserId);
        }
      });

      setTargetsByEvent(grouped);
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao carregar destinatários.", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!companyId || !selectedSourceUserId) return;
    loadTargets(selectedSourceUserId, companyId);
  }, [companyId, selectedSourceUserId]);

  const toggleTarget = async (
    eventType: "rdo" | "diario_equipamento" | "diario_carreta",
    targetUserId: string,
    checked: boolean,
  ) => {
    if (!companyId || !selectedSourceUserId) return;
    const key = `${eventType}:${targetUserId}`;
    setSavingKey(key);
    try {
      if (checked) {
        const { error } = await (supabase as any)
          .from("notification_targets")
          .upsert(
            {
              company_id: companyId,
              source_user_id: selectedSourceUserId,
              target_user_id: targetUserId,
              event_type: eventType,
            },
            { onConflict: "source_user_id,target_user_id,event_type" },
          );
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("notification_targets")
          .delete()
          .eq("company_id", companyId)
          .eq("source_user_id", selectedSourceUserId)
          .eq("target_user_id", targetUserId)
          .eq("event_type", eventType);
        if (error) throw error;
      }

      setTargetsByEvent((prev) => {
        const next = { ...prev };
        const set = new Set(next[eventType] || []);
        if (checked) set.add(targetUserId);
        else set.delete(targetUserId);
        next[eventType] = set;
        return next;
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message || "Não foi possível atualizar.", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const otherUsers = users.filter((u: any) => u.user_id !== selectedSourceUserId);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando destinatários...</p>;
  }

  if (!companyId) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada ao seu usuário.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-1">
        <p className="text-sm font-semibold text-foreground">🎯 Destinatários por Funcionário</p>
        <p className="text-sm text-muted-foreground">
          Defina quem recebe push quando cada funcionário faz um lançamento
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Selecione o funcionário</Label>
          <Select value={selectedSourceUserId} onValueChange={handleSourceUserChange}>
            <SelectTrigger className="h-11 bg-secondary border-border">
              <SelectValue placeholder="Selecione o funcionário" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.nome_completo || "Usuário"}{u.perfil ? ` — ${u.perfil}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSourceUserId && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tipo de documento</Label>
            <Select value={selectedEventType} onValueChange={(v) => setSelectedEventType(v as any)}>
              <SelectTrigger className="h-11 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventSections.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedSourceUserId && (
        <div className="space-y-3">
          {[eventSections.find(s => s.key === selectedEventType)!].filter(Boolean).map((section) => (
            <div key={section.key} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{section.label}</p>
                <p className="text-xs text-muted-foreground">Marque quem deve receber push quando este funcionário enviar um {section.label}</p>
              </div>
              {otherUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum outro usuário ativo nesta empresa.</p>
              ) : (
                <div className="space-y-2">
                  {otherUsers.map((usr: any) => {
                    const checkId = `${section.key}-${usr.user_id}`;
                    const checked = Boolean(targetsByEvent[section.key]?.has(usr.user_id));
                    const isSaving = savingKey === `${section.key}:${usr.user_id}`;
                    return (
                      <label
                        key={usr.user_id}
                        htmlFor={checkId}
                        className="flex items-center justify-between gap-3 border border-border rounded-lg p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{usr.nome_completo || "Usuário"}</p>
                          <p className="text-xs text-muted-foreground">{usr.perfil || "Perfil não informado"}</p>
                        </div>
                        <input
                          id={checkId}
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          disabled={isSaving}
                          onChange={(e) => toggleTarget(section.key, usr.user_id, e.target.checked)}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Users manager
function UsersManager() {
  const LOGIN_DOMAIN = "@workflux.app";

  // Templates de permissão por perfil — aplicados automaticamente ao criar usuário
  const PERFIL_PERMISSIONS: Record<string, Record<string, boolean>> = {
    "Administrador":      { is_admin: true,  modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: true,  modulo_carreteiros: true,  modulo_programador: true,  modulo_demandas: true,  modulo_manutencao: true,  modulo_abastecimento: true,  modulo_documentos: true,  modulo_relatorios: true,  modulo_dashboard: true  },
    "Gerente":            { is_admin: true,  modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: true,  modulo_carreteiros: true,  modulo_programador: false, modulo_demandas: true,  modulo_manutencao: true,  modulo_abastecimento: true,  modulo_documentos: true,  modulo_relatorios: true,  modulo_dashboard: true  },
    "Engenheiro":         { is_admin: false, modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: true,  modulo_dashboard: false },
    "Encarregado":        { is_admin: false, modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: true,  modulo_dashboard: false, modulo_encarregado: true },
    "Segurança":          { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: true,  modulo_relatorios: false, modulo_dashboard: false },
    "Manutenção":         { is_admin: false, modulo_obras: false, modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: true,  modulo_abastecimento: true,  modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
    "Gestão de Pessoas":  { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: true,  modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
    "Gestão de Frotas":   { is_admin: false, modulo_obras: false, modulo_equipamentos: false, modulo_rh: false, modulo_carreteiros: true,  modulo_programador: false, modulo_demandas: true,  modulo_manutencao: false, modulo_abastecimento: true,  modulo_documentos: false, modulo_relatorios: true,  modulo_dashboard: false },
    "Apontador":          { is_admin: false, modulo_obras: true,  modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
    "Operador":           { is_admin: false, modulo_obras: false, modulo_equipamentos: true,  modulo_rh: false, modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false, modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false, modulo_relatorios: false, modulo_dashboard: false },
  };
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [perfil, setPerfil] = useState("Usuário");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPerfil, setEditPerfil] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deactivating, setDeactivating] = useState<any | null>(null);
  const [deactivatingLoading, setDeactivatingLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [togglingExport, setTogglingExport] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("nome_completo", { ascending: true });
    if (data) setUsers(data as any[]);
  };

  useEffect(() => { load(); }, []);

  const filteredUsers = users
    .filter(u => showInactive ? true : u.status !== "inativo")
    .filter(u => {
      if (!buscaUsuario.trim()) return true;
      const q = buscaUsuario.toLowerCase();
      return (
        (u.nome_completo || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.perfil || "").toLowerCase().includes(q)
      );
    });

  const handleCreate = async () => {
    if (!nome.trim() || !login.trim() || !password.trim()) {
      toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }

    const loginValue = login.trim().toLowerCase();
    const authEmail = loginValue.includes("@") ? loginValue : `${loginValue}${LOGIN_DOMAIN}`;

    setCreating(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", {
        body: { email: authEmail, password, nome_completo: nome.trim(), perfil, login_original: loginValue },
      });

      // Log raw response for debugging
      console.error("RAW create-user response:", { result, invokeError });

      const errorMsg = result?.error || invokeError?.message;
      if (errorMsg) {
        if (errorMsg.includes("already been registered") || errorMsg.includes("já está cadastrado")) {
          throw new Error("Este e-mail já está cadastrado no sistema.");
        }
        if (errorMsg.includes("administradores")) {
          throw new Error("Erro de permissão: seu usuário não está reconhecido como Admin. Verifique a tabela user_roles no Supabase.");
        }
        throw new Error(errorMsg);
      }

      // Aplica template de permissões baseado no perfil escolhido
      if (result?.user_id) {
        const template = PERFIL_PERMISSIONS[perfil];
        if (template) {
          await supabase.from("user_permissions").upsert(
            { user_id: result.user_id, ...template, equipamentos_permitidos: [], updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
        }
      }

      toast({ title: "✅ Usuário cadastrado com sucesso!", description: `Permissões do perfil ${perfil} aplicadas automaticamente.` });
      setNome(""); setLogin(""); setPassword(""); setPerfil("Usuário");
      await load();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleToggleExport = async (u: any) => {
    setTogglingExport(u.user_id);
    const newVal = !u.can_export;
    try {
      await supabase.from("profiles").update({ can_export: newVal }).eq("user_id", u.user_id);
      toast({ title: newVal ? "✅ Exportação liberada" : "🔒 Exportação bloqueada", description: u.nome_completo });
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setTogglingExport(null); }
  };

  const handleUnlock = async (userId: string, email: string) => {
    setUnlocking(userId);
    try {
      // Zerar bloqueio server-side na tabela login_blocks
      await (supabase as any).from("login_blocks").upsert(
        { email, attempts: 0, blocked_until: null, unblocked_by: (await supabase.auth.getUser()).data.user?.id, unblocked_at: new Date().toISOString() },
        { onConflict: "email" }
      );
      toast({ title: "✅ Usuário desbloqueado!", description: `${email} pode fazer login novamente.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setUnlocking(null); }
  };

  const handleImpersonate = async (u: any) => {
    if (!window.confirm(`Entrar como "${u.nome_completo}"?\n\nVocê verá o sistema exatamente como esse usuário. Um banner amarelo ficará visível para voltar ao admin.`)) return;
    setImpersonating(u.user_id);
    try {
      const result = await startImpersonation(u.user_id, u.nome_completo, u.email || "");
      if (!result.success) {
        toast({ title: "Erro ao entrar como usuário", description: result.error, variant: "destructive" });
        setImpersonating(null);
        return;
      }
      // Redirecionar para home após trocar sessão
      window.location.replace("/");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setImpersonating(null);
    }
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setEditNome(u.nome_completo);
    setEditEmail(u.email || "");
    setEditPerfil(u.perfil);
    setEditPassword("");
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.user_id) {
      if (editing && !editing.user_id) toast({ title: "Erro interno", description: "Identificador não encontrado.", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const body: any = { action: "update", user_id: editing.user_id };
      if (editNome.trim()) body.nome_completo = editNome.trim();
      if (editPerfil) body.perfil = editPerfil;
      if (editPassword.trim()) body.password = editPassword;
      if (editEmail.trim() && editEmail.trim().toLowerCase() !== (editing?.email || "").toLowerCase()) {
        body.email = editEmail.trim();
      }
      const { data: result, error: invokeError } = await supabase.functions.invoke("create-user", { body });
      if (invokeError || result?.error) throw new Error(result?.error || invokeError?.message || "Erro ao atualizar");
      toast({ title: "✅ Usuário atualizado!" });
      setEditing(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSavingEdit(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivating) return;
    setDeactivatingLoading(true);
    try {
      // Check self-deactivation
      const { data: { user } } = await supabase.auth.getUser();
      if (user && deactivating.user_id === user.id) {
        toast({ title: "Bloqueado", description: "Você não pode desativar sua própria conta.", variant: "destructive" });
        setDeactivating(null);
        setDeactivatingLoading(false);
        return;
      }

      if (!deactivating.id) {
        toast({ title: "Erro interno", description: "Identificador não encontrado.", variant: "destructive" });
        setDeactivating(null);
        setDeactivatingLoading(false);
        return;
      }
      const newStatus = deactivating.status === "inativo" ? "ativo" : "inativo";
      const { error } = await supabase.from("profiles").update({ status: newStatus } as any).eq("id", deactivating.id);
      if (error) throw error;
      toast({ title: newStatus === "inativo" ? "✅ Usuário desativado!" : "✅ Usuário reativado!" });
      setDeactivating(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setDeactivatingLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Criar Novo Usuário</p>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome Completo *</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Nome do funcionário" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Login (usuário) *</Label>
          <Input type="text" value={login} onChange={e => setLogin(e.target.value)} className="h-11 bg-secondary border-border" placeholder="usuario ou email@empresa.com" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Senha *</Label>
          <div className="relative">
            <Input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-11 bg-secondary border-border pr-10" placeholder="Mínimo 6 caracteres" minLength={6} autoComplete="new-password" />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Perfil de Acesso</Label>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrador">Administrador</SelectItem>
              <SelectItem value="Usuário">Usuário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="w-full h-11 gap-2">
          <Plus className="w-4 h-4" /> {creating ? "Criando..." : "Criar Usuário"}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Usuários Cadastrados <span className="text-muted-foreground font-normal">({filteredUsers.length})</span></p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Mostrar Desativados
        </label>
      </div>

      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={buscaUsuario}
          onChange={e => setBuscaUsuario(e.target.value)}
          placeholder="Buscar por nome, e-mail ou perfil..."
          className="h-10 pl-9 bg-secondary border-border"
        />
      </div>

      <div className="space-y-2">
        {filteredUsers.map((u: any) => {
          const isInactive = u.status === "inativo";
          return (
            <div key={u.id} className={`bg-card rounded-lg border border-border p-3 flex items-center justify-between ${isInactive ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">{u.nome_completo}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{u.perfil}</span>
                  <Badge variant={isInactive ? "destructive" : "default"} className="text-[10px] px-2 py-0.5">
                    {isInactive ? "Inativo" : "Ativo"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-foreground p-1.5" title="Editar usuário"><Pencil className="w-4 h-4" /></button>
                <button
                  onClick={() => handleToggleExport(u)}
                  disabled={togglingExport === u.user_id}
                  className={u.can_export ? "text-green-600 hover:text-green-700 p-1.5" : "text-muted-foreground hover:text-foreground p-1.5"}
                  title={u.can_export ? "Exportação liberada (clique pra bloquear)" : "Liberar exportação PDF/Excel"}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleUnlock(u.user_id, u.email || u.nome_completo)}
                  disabled={unlocking === u.user_id}
                  className="text-amber-500 hover:text-amber-600 p-1.5"
                  title="Desbloquear no servidor (ban do Supabase)"
                >
                  {unlocking === u.user_id
                    ? <span className="w-4 h-4 inline-block animate-spin border-2 border-amber-500 border-t-transparent rounded-full" />
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                  }
                </button>
                <button
                  onClick={() => {
                    const nome = encodeURIComponent(u.nome_completo || u.email || '');
                    const link = `${window.location.origin}/desbloqueio?u=${nome}`;
                    navigator.clipboard.writeText(link).then(() => {
                      // feedback visual temporário
                      const btn = document.getElementById(`unlock-link-${u.user_id}`);
                      if (btn) { btn.style.color = '#16a34a'; setTimeout(() => { if(btn) btn.style.color = ''; }, 2000); }
                    });
                  }}
                  id={`unlock-link-${u.user_id}`}
                  className="text-green-600 hover:text-green-700 p-1.5 transition-colors"
                  title="Copiar link de desbloqueio — mande pro usuário pelo WhatsApp"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                <button
                  onClick={() => handleImpersonate(u)}
                  disabled={impersonating === u.user_id}
                  className="text-blue-500 hover:text-blue-600 p-1.5"
                  title="Entrar como este usuário"
                >
                  {impersonating === u.user_id
                    ? <span className="w-4 h-4 inline-block animate-spin border-2 border-blue-500 border-t-transparent rounded-full" />
                    : <LogIn className="w-4 h-4" />}
                </button>
                <button onClick={() => setDeactivating(u)} className={isInactive ? "text-green-600 p-1.5" : "text-destructive p-1.5"} title={isInactive ? "Reativar" : "Desativar"}>
                  {isInactive ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
        {filteredUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>}
      </div>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="h-11 bg-secondary border-border"
                placeholder="novo@email.com"
              />
              {editEmail.trim().toLowerCase() !== (editing?.email || "").toLowerCase() && editEmail.trim() && (
                <p className="text-[10px] text-yellow-600">⚠️ E-mail será alterado de <strong>{editing?.email}</strong> para <strong>{editEmail}</strong></p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Perfil de Acesso</Label>
              <Select value={editPerfil} onValueChange={setEditPerfil}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Gerente">Gerente</SelectItem>
                  <SelectItem value="Engenheiro">Engenheiro</SelectItem>
                  <SelectItem value="Encarregado">Encarregado de Obras</SelectItem>
                  <SelectItem value="Segurança">Segurança</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Gestão de Pessoas">Gestão de Pessoas</SelectItem>
                  <SelectItem value="Gestão de Frotas">Gestão de Frotas</SelectItem>
                  <SelectItem value="Apontador">Apontador</SelectItem>
                  <SelectItem value="Operador">Operador / Motorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nova Senha (deixe vazio para manter)</Label>
              <div className="relative">
                <Input type={showEditPwd ? "text" : "password"} value={editPassword} onChange={e => setEditPassword(e.target.value)} className="h-11 bg-secondary border-border pr-10" placeholder="Mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowEditPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showEditPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full h-11">
              {savingEdit ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivating} onOpenChange={open => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deactivating?.status === "inativo" ? "Reativar Usuário" : "Desativar Usuário"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.status === "inativo"
                ? <>Deseja reativar <strong>{deactivating?.nome_completo}</strong> ({deactivating?.email})?</>
                : <>Tem certeza que deseja desativar <strong>{deactivating?.nome_completo}</strong> ({deactivating?.email})? O usuário não conseguirá mais acessar o sistema.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deactivatingLoading} className={deactivating?.status === "inativo" ? "bg-green-600 hover:bg-green-700" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}>
              {deactivatingLoading ? "Aguarde..." : deactivating?.status === "inativo" ? "Reativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Memoizado para evitar perda de foco nos inputs ao re-render do pai
const UsersManagerMemo = memo(UsersManager);

// OGS Manager
function OgsManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [numero, setNumero] = useState("");
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("ogs_reference").select("*").order("ogs_number", { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => {
    load();
    // Carregar company_id do usuário logado
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.company_id) setMyCompanyId(data.company_id); });
    });
  }, []);

  const handleAdd = async () => {
    if (!numero.trim() || !cliente.trim() || !endereco.trim()) {
      toast({ title: "Atenção", description: "Preencha OGS, Cliente e Endereço.", variant: "destructive" });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Sessão expirada", variant: "destructive" }); return; }
      if (editingId) {
        if (!editingId) { toast({ title: "Erro interno", description: "Identificador não encontrado.", variant: "destructive" }); return; }
        const { error } = await supabase.from("ogs_reference").update({ ogs_number: numero.trim(), client_name: cliente.trim(), location_address: endereco.trim() } as any).eq("id", editingId);
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
        toast({ title: "✅ OGS atualizada!" });
        setEditingId(null);
      } else {
        const { error } = await supabase.from("ogs_reference").insert({ ogs_number: numero.trim(), client_name: cliente.trim(), location_address: endereco.trim(), company_id: myCompanyId } as any);
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
        toast({ title: "✅ Endereço adicionado!" });
      }
      setNumero(""); setCliente(""); setEndereco("");
      await load();
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
  };

  const formRef = typeof window !== 'undefined' ? { current: null as HTMLDivElement | null } : { current: null as HTMLDivElement | null };
  const openEdit = (o: any) => {
    setEditingId(o.id);
    setNumero(o.ogs_number || "");
    setCliente(o.client_name || "");
    setEndereco(o.location_address || "");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const cancelEdit = () => { setEditingId(null); setNumero(""); setCliente(""); setEndereco(""); };

  const handleDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) {
      toast({ title: "Erro interno", description: "Identificador não encontrado.", variant: "destructive" });
      setDeleteTarget(null);
      return;
    }
    setDeletingLoading(true);
    const { error } = await supabase.from("ogs_reference").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "✅ Removido!" });
    setDeleteTarget(null);
    setDeletingLoading(false);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          {editingId ? "✏️ Editando registro — altere os campos e salve." : "Uma OGS pode ter vários endereços — cadastre um por vez. Ao digitar uma OGS existente, o cliente é preenchido automaticamente."}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nº OGS</Label>
            <Input
              value={numero}
              onChange={e => {
                const v = e.target.value;
                setNumero(v);
                // Auto-preenche cliente se a OGS já existe (só no modo adicionar)
                if (!editingId && v.trim()) {
                  const existente = items.find((o: any) => o.ogs_number === v.trim());
                  if (existente && !cliente) setCliente(existente.client_name || "");
                }
              }}
              className="h-11 bg-secondary border-border"
              placeholder="2535"
              list={editingId ? undefined : "ogs-numeros-list"}
            />
            {!editingId && (
              <datalist id="ogs-numeros-list">
                {[...new Set(items.map((o: any) => o.ogs_number))].map((n: any) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Input value={cliente} onChange={e => setCliente(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Nome do Cliente" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Endereço / Rua</Label>
          <Input value={endereco} onChange={e => setEndereco(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Rua X, Trecho Y" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAdd} className="flex-1 h-11 gap-2 min-w-[140px]">
            {editingId ? <><Save className="w-4 h-4" /> Salvar Alterações</> : <><Plus className="w-4 h-4" /> Adicionar Endereço</>}
          </Button>
          {editingId && (
            <Button
              variant="outline"
              className="h-11 gap-2 border-primary text-primary hover:bg-primary/10"
              onClick={async () => {
                if (!endereco.trim()) { toast({ title: "Informe o endereço da nova rua", variant: "destructive" }); return; }
                const { error } = await supabase.from("ogs_reference").insert({ ogs_number: numero.trim(), client_name: cliente.trim(), location_address: endereco.trim(), company_id: myCompanyId } as any);
                if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
                toast({ title: "✅ Nova rua adicionada!", description: `${numero} — ${endereco}` });
                setEndereco("");
                await load();
              }}
            >
              <Plus className="w-4 h-4" /> Adicionar rua
            </Button>
          )}
          {editingId && <Button variant="outline" onClick={cancelEdit} className="h-11">Cancelar</Button>}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-bold text-primary">📋 Tabela de OGS Cadastradas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs">OGS</th>
                <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs">Cliente</th>
                <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs">Endereço/Local</th>
                <th className="text-right px-4 py-2.5 font-semibold text-foreground text-xs w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o: any) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-foreground">{o.ogs_number}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{o.client_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{o.location_address}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(o)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteTarget(o)} className="text-destructive p-1.5 rounded-md hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Nenhuma OGS cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
            <AlertDialogDescription>Excluir OGS <strong>{deleteTarget?.ogs_number}</strong> — {deleteTarget?.location_address}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deletingLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Truck Registry Manager
function TruckRegistryManager() {
  const { items, loading, add, remove, update } = useCrudTable("truck_registry");
  const { toast } = useToast();
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [vinculos, setVinculos] = useState<string[]>(["TODOS"]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlaca, setEditPlaca] = useState("");
  const [editModelo, setEditModelo] = useState("");
  const [editCor, setEditCor] = useState("");
  const [editFornecedor, setEditFornecedor] = useState("");
  const [editCapacidade, setEditCapacidade] = useState("");
  const [editVinculos, setEditVinculos] = useState<string[]>(["TODOS"]);

  const toggleVinculo = (v: string, current: string[], set: (x: string[]) => void) => {
    if (v === "TODOS") { set(["TODOS"]); return; }
    const sem = current.filter(x => x !== "TODOS");
    if (sem.includes(v)) {
      const novo = sem.filter(x => x !== v);
      set(novo.length === 0 ? ["TODOS"] : novo);
    } else {
      set([...sem, v]);
    }
  };

  const PillGroup = ({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => {
        const active = selected.includes(v);
        return (
          <button key={v} type="button" onClick={() => onToggle(v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              active ? "bg-primary text-primary-foreground border-primary"
                     : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
            }`}>
            {VINCULO_LABELS[v] ?? v}
          </button>
        );
      })}
    </div>
  );

  const handleAdd = async () => {
    if (!placa.trim() || !capacidade.trim()) {
      toast({ title: "Atenção", description: "Preencha Placa e Capacidade (m³).", variant: "destructive" });
      return;
    }
    const ok = await add({ placa: placa.trim().toUpperCase(), modelo: modelo.trim() || null, cor: cor.trim() || null, fornecedor: fornecedor.trim() || null, capacidade_m3: parseFloat(String(capacidade).replace(",", ".")), vinculos });
    if (ok) { setPlaca(""); setModelo(""); setCor(""); setFornecedor(""); setCapacidade(""); setVinculos(["TODOS"]); }
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setEditPlaca(t.placa || "");
    setEditModelo(t.modelo || "");
    setEditCor(t.cor || "");
    setEditFornecedor(t.fornecedor || "");
    setEditCapacidade(String(t.capacidade_m3 ?? ""));
    setEditVinculos(t.vinculos?.length ? t.vinculos : [t.vinculo_rdo || "TODOS"]);
  };

  const saveEdit = async (id: string) => {
    if (!editPlaca.trim() || !editCapacidade.trim()) { toast({ title: "Atenção", description: "Placa e Capacidade são obrigatórios.", variant: "destructive" }); return; }
    const ok = await update(id, { placa: editPlaca.trim().toUpperCase(), modelo: editModelo.trim() || null, cor: editCor.trim() || null, fornecedor: editFornecedor.trim() || null, capacidade_m3: parseFloat(String(editCapacidade).replace(",", ".")), vinculos: editVinculos });
    if (ok) setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Placa *</Label>
            <Input value={placa} onChange={e => setPlaca(e.target.value)} className="h-11 bg-secondary border-border" placeholder="ABC-1234" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Capacidade (m³) *</Label>
            <Input type="number" inputMode="decimal" value={capacidade} onChange={e => setCapacidade(e.target.value)} className="h-11 bg-secondary border-border" placeholder="12" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            <Input value={modelo} onChange={e => setModelo(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Volvo FMX" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <Input value={cor} onChange={e => setCor(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Branco" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fornecedor</Label>
          <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Transportadora X" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Onde aparece (um ou mais)</Label>
          <PillGroup options={VINCULO_OPTIONS} selected={vinculos} onToggle={v => toggleVinculo(v, vinculos, setVinculos)} />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Caminhão</Button>
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum caminhão cadastrado.</p>
        ) : items.map((t: any) => (
          <div key={t.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
            {editingId === t.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Placa *</Label><Input value={editPlaca} onChange={e => setEditPlaca(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Capacidade (m³) *</Label><Input type="number" inputMode="decimal" value={editCapacidade} onChange={e => setEditCapacidade(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Modelo</Label><Input value={editModelo} onChange={e => setEditModelo(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Cor</Label><Input value={editCor} onChange={e => setEditCor(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Fornecedor</Label><Input value={editFornecedor} onChange={e => setEditFornecedor(e.target.value)} className="h-9 bg-secondary border-border text-sm" /></div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Onde aparece</Label>
                  <PillGroup options={VINCULO_OPTIONS} selected={editVinculos} onToggle={v => toggleVinculo(v, editVinculos, setEditVinculos)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => saveEdit(t.id)}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <p className="font-medium text-sm text-foreground">{t.placa} — {t.capacidade_m3} m³</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {t.modelo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.modelo}</span>}
                    {t.cor && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.cor}</span>}
                    {(t.vinculos?.length ? t.vinculos : [t.vinculo_rdo || "TODOS"]).map((v: string) => (
                      <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{VINCULO_LABELS[v] ?? v}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(t)} className="text-primary p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(t.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Material manager
function MateriaisUnificadoManager() {
  const [subTab, setSubTab] = useState<"rdo" | "transporte">("rdo");

  return (
    <div className="space-y-4">
      {/* Cabeçalho descritivo */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-1">
        <p className="text-sm font-semibold text-foreground">📦 Materiais</p>
        <p className="text-xs text-muted-foreground">
          <b>Materiais de RDO</b> aparecem nas Notas Fiscais e consumo dentro do Relatório Diário de Obra.<br />
          <b>Materiais de Transporte</b> são usados pelos motoristas de carreta no módulo Carreteiros.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("rdo")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            subTab === "rdo"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          📋 Materiais de RDO
        </button>
        <button
          onClick={() => setSubTab("transporte")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            subTab === "transporte"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          🚛 Materiais de Transporte
        </button>
      </div>

      {subTab === "rdo" ? <MaterialManager /> : <InsumosMaterialManager />}
    </div>
  );
}

const MATERIAL_VINCULO_OPTIONS = ["CAUQ", "PAVIMENTACAO", "CANTEIRO", "INFRA", "TODOS"];
const FORNECEDOR_VINCULO_OPTIONS = ["CAUQ", "PAVIMENTACAO", "CANTEIRO", "INFRA", "COMBOIO", "ESPARGIDOR", "PIPA", "KMA", "TODOS"];

function MaterialManager() {
  const { items, add, remove, update } = useCrudTable("materiais");
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");
  const [tipoUso, setTipoUso] = useState("Nota Fiscal");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editVinculo, setEditVinculo] = useState("TODOS");
  const [editTipoUso, setEditTipoUso] = useState("Nota Fiscal");

  const PillGroup = ({ options, selected, onSelect, labels }: { options: string[]; selected: string; onSelect: (v: string) => void; labels?: Record<string, string> }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => (
        <button key={v} type="button" onClick={() => onSelect(v)}
          className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
            selected === v ? "bg-primary text-primary-foreground border-primary"
                           : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
          }`}>
          {labels?.[v] ?? v}
        </button>
      ))}
    </div>
  );

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome do material.", variant: "destructive" }); return; }
    const ok = await add({ nome: nome.trim(), vinculo_rdo: vinculo, tipo_uso: tipoUso });
    if (ok) { setNome(""); setVinculo("TODOS"); setTipoUso("Nota Fiscal"); }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditNome(item.nome || "");
    setEditVinculo(item.vinculo_rdo || "TODOS");
    setEditTipoUso(item.tipo_uso || "Nota Fiscal");
  };

  const saveEdit = async (id: string) => {
    if (!editNome.trim()) { toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); return; }
    const ok = await update(id, { nome: editNome.trim(), vinculo_rdo: editVinculo, tipo_uso: editTipoUso });
    if (ok) setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Novo Material" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Onde aparece</Label>
          <PillGroup options={MATERIAL_VINCULO_OPTIONS} selected={vinculo} onSelect={setVinculo} labels={VINCULO_LABELS} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo de Uso</Label>
          <PillGroup options={TIPO_USO_OPTIONS} selected={tipoUso} onSelect={setTipoUso} />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro.</p>}
        {items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 space-y-2">
            {editingId === item.id ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-9 bg-secondary border-border text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Onde aparece</Label>
                  <PillGroup options={MATERIAL_VINCULO_OPTIONS} selected={editVinculo} onSelect={setEditVinculo} labels={VINCULO_LABELS} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo de Uso</Label>
                  <PillGroup options={TIPO_USO_OPTIONS} selected={editTipoUso} onSelect={setEditTipoUso} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => saveEdit(item.id)}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <p className="font-medium text-sm text-foreground">{item.nome}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{VINCULO_LABELS[item.vinculo_rdo] ?? item.vinculo_rdo}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{item.tipo_uso || "Nota Fiscal"}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(item)} className="text-muted-foreground p-1 hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Destinos Manager (trucker_destinations)
function DestinosManager() {
  const { items, add, remove } = useCrudTable("trucker_destinations");
  const { toast } = useToast();
  const [nome, setNome] = useState("");

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome do destino.", variant: "destructive" }); return; }
    const ok = await add({ nome: nome.trim() });
    if (ok) setNome("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome do Destino</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Ex: Canteiro, Bota-fora, Usina" />
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Destino</Button>
      </div>
      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <p className="font-medium text-sm text-foreground">{item.nome}</p>
            <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum destino cadastrado.</p>}
      </div>
    </div>
  );
}

// Insumos / Materiais Manager (insumos_materiais)
const UNIDADE_OPTIONS = ["m³", "Ton", "L", "Kg", "Un"];
function InsumosMaterialManager() {
  const { items, add, remove } = useCrudTable("insumos_materiais");
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("m³");

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome do material.", variant: "destructive" }); return; }
    const ok = await add({ nome: nome.trim().toUpperCase(), unidade_medida: unidade, ativo: true });
    if (ok) { setNome(""); setUnidade("m³"); }
  };

  const toggleAtivo = async (item: any) => {
    if (!item.id) return;
    const { error } = await supabase.from("insumos_materiais" as any).update({ ativo: !item.ativo } as any).eq("id", item.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: item.ativo ? "Material desativado" : "Material reativado" });
    // Force reload
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome do Material</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Ex: RAP ESPUMADO, MASSA ASFÁLTICA" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Unidade de Medida</Label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{UNIDADE_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Material</Button>
      </div>
      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id} className={`bg-card rounded-lg border border-border p-3 flex items-center justify-between ${!item.ativo ? 'opacity-50' : ''}`}>
            <div>
              <p className="font-medium text-sm text-foreground">{item.nome}</p>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.unidade_medida}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleAtivo(item)} className="text-muted-foreground p-1 hover:text-foreground">
                {item.ativo ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </button>
              <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum material cadastrado.</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OPERADORES HABILITADOS
// ═══════════════════════════════════════════════════════════════
const EQUIP_TYPES_FOR_HABILITADOS = [
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
];

const SYSTEM_CATEGORIES_HABILITADOS = [
  { id: "Mecânico", label: "Mecânicos (WF Manutenção)" },
];

const SYSTEM_CATEGORIES_ABASTECIMENTO = [
  { id: "Lubrificador", label: "Lubrificadores (WF Abastecimento)" },
];

function OperadoresHabilitadosManager() {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [searchByType, setSearchByType] = useState<Record<string, string>>({});
  const [openType, setOpenType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("user_id", user.id).maybeSingle();
      let cid = (profile as any)?.company_id || null;
      // Superadmin não tem company_id — busca a primeira empresa
      if (!cid && (profile as any)?.role === "superadmin") {
        const { data: firstCompany } = await supabase.from("companies" as any).select("id").order("created_at").limit(1).maybeSingle();
        cid = (firstCompany as any)?.id || null;
      }
      setCompanyId(cid);

      const [{ data: funcs }, { data: lnks }] = await Promise.all([
        (supabase as any).from("employees").select("id, name, role, status").eq("status","ativo").order("name"),
        cid ? supabase.from("equipment_type_operators" as any).select("id, equipment_type, funcionario_id").eq("company_id", cid) : Promise.resolve({ data: [] }),
      ]);
      setFuncionarios(((funcs || []) as any[]).map((f: any) => ({ id: f.id, nome: f.name, funcao: f.role ?? "" })));
      setLinks((lnks || []) as any[]);
      setLoading(false);
    }
    load();
  }, []);

  const refresh = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("equipment_type_operators" as any).select("id, equipment_type, funcionario_id").eq("company_id", companyId);
    setLinks((data || []) as any[]);
  };

  const addOperador = async (equipType: string, funcId: string) => {
    if (!companyId) {
      toast({ title: "Erro", description: "Company ID não encontrado. Faça login novamente.", variant: "destructive" });
      return;
    }
    const already = links.some(l => l.equipment_type === equipType && l.funcionario_id === funcId);
    if (already) {
      toast({ title: "Já adicionado", description: "Este funcionário já está habilitado para este equipamento." });
      return;
    }
    // Verifica se a sessão ainda está ativa
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("equipment_type_operators" as any).insert({ company_id: companyId, equipment_type: equipType, funcionario_id: funcId });
    if (error) {
      console.error("[addOperador] erro:", error);
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    await refresh();
    setSearchByType(prev => ({ ...prev, [equipType]: "" }));
    toast({ title: "Operador adicionado! ✅" });
  };

  const removeOperador = async (equipType: string, funcId: string) => {
    if (!companyId) return;
    const { error } = await supabase.from("equipment_type_operators" as any).delete().eq("company_id", companyId).eq("equipment_type", equipType).eq("funcionario_id", funcId);
    if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
    await refresh();
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-3">
      {/* ── WF Manutenção ── */}
      <div className="mb-2">
        <p className="text-sm font-semibold text-foreground mb-1">WF Manutenção</p>
        <p className="text-xs text-muted-foreground mb-3">Funcionários que aparecem no campo "Mecânico" ao abrir uma Ordem de Serviço.</p>
        {SYSTEM_CATEGORIES_HABILITADOS.map(({ id, label }) => {
          const habilitados = links.filter(l => l.equipment_type === id).map(l => funcionarios.find(f => f.id === l.funcionario_id)).filter(Boolean);
          const habIds = new Set(habilitados.map((f: any) => f.id));
          const search = (searchByType[id] || "").toLowerCase();
          const disponiveis = funcionarios.filter(f => !habIds.has(f.id) && (!search || f.nome.toLowerCase().includes(search) || f.funcao.toLowerCase().includes(search)));
          const isOpen = openType === id;
          return (
            <div key={id} className="rounded-xl border border-border bg-card">
              <button onClick={() => setOpenType(isOpen ? null : id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{habilitados.length} habilitado(s)</span>
                </div>
                <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {habilitados.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum habilitado. Busque abaixo para adicionar.</p> : (
                    <div className="flex flex-wrap gap-2">
                      {habilitados.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1 text-xs font-medium">
                          {f.nome}<button onClick={() => removeOperador(id, f.id)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <input className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Buscar funcionário para adicionar..." value={searchByType[id] || ""}
                      onChange={e => setSearchByType(prev => ({ ...prev, [id]: e.target.value }))} />
                    {search && (
                      <div className="mt-2 rounded-lg border border-border bg-card max-h-48 overflow-y-auto">
                        {disponiveis.length === 0 ? <p className="text-xs text-muted-foreground px-3 py-2">Nenhum resultado.</p> : disponiveis.map((f: any) => (
                          <button key={f.id} onClick={() => addOperador(id, f.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between">
                            <div><span className="font-medium">{f.nome}</span><span className="text-muted-foreground text-xs ml-2">{f.funcao}</span></div>
                            <span className="text-xs text-primary">+ Adicionar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── WF Abastecimento ── */}
      <div className="mb-2">
        <p className="text-sm font-semibold text-foreground mb-1">WF Abastecimento</p>
        <p className="text-xs text-muted-foreground mb-3">Funcionários que aparecem no campo "Lubrificador" ao lançar um abastecimento.</p>
        {SYSTEM_CATEGORIES_ABASTECIMENTO.map(({ id, label }) => {
          const habilitados = links.filter(l => l.equipment_type === id).map(l => funcionarios.find(f => f.id === l.funcionario_id)).filter(Boolean);
          const habIds = new Set(habilitados.map((f: any) => f.id));
          const search = (searchByType[id] || "").toLowerCase();
          const disponiveis = funcionarios.filter(f => !habIds.has(f.id) && (!search || f.nome.toLowerCase().includes(search) || f.funcao.toLowerCase().includes(search)));
          const isOpen = openType === id;
          return (
            <div key={id} className="rounded-xl border border-border bg-card">
              <button onClick={() => setOpenType(isOpen ? null : id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{habilitados.length} habilitado(s)</span>
                </div>
                <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {habilitados.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum habilitado. Busque abaixo para adicionar.</p> : (
                    <div className="flex flex-wrap gap-2">
                      {habilitados.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1 text-xs font-medium">
                          {f.nome}<button onClick={() => removeOperador(id, f.id)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <input className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Buscar funcionário para adicionar..." value={searchByType[id] || ""}
                      onChange={e => setSearchByType(prev => ({ ...prev, [id]: e.target.value }))} />
                    {search && (
                      <div className="mt-2 rounded-lg border border-border bg-card max-h-48 overflow-y-auto">
                        {disponiveis.length === 0 ? <p className="text-xs text-muted-foreground px-3 py-2">Nenhum resultado.</p> : disponiveis.map((f: any) => (
                          <button key={f.id} onClick={() => addOperador(id, f.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between">
                            <div><span className="font-medium">{f.nome}</span><span className="text-muted-foreground text-xs ml-2">{f.funcao}</span></div>
                            <span className="text-xs text-primary">+ Adicionar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Operadores Habilitados ── */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Operadores Habilitados</p>
        <p className="text-xs text-muted-foreground mb-3">Configure quais funcionários aparecem como opções ao lançar o diário de cada equipamento.</p>
      {EQUIP_TYPES_FOR_HABILITADOS.map(({ id, label }) => {
        const habilitados = links.filter(l => l.equipment_type === id).map(l => funcionarios.find(f => f.id === l.funcionario_id)).filter(Boolean);
        const habIds = new Set(habilitados.map((f: any) => f.id));
        const search = (searchByType[id] || "").toLowerCase();
        const disponiveis = funcionarios.filter(f => !habIds.has(f.id) && (!search || f.nome.toLowerCase().includes(search) || f.funcao.toLowerCase().includes(search)));
        const isOpen = openType === id;

        return (
          <div key={id} className="rounded-xl border border-border bg-card">
            <button
              onClick={() => setOpenType(isOpen ? null : id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{habilitados.length} habilitado(s)</span>
              </div>
              <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {habilitados.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum operador habilitado. Busque abaixo para adicionar.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {habilitados.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1 text-xs font-medium">
                        {f.nome}
                        <button onClick={() => removeOperador(id, f.id)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Buscar funcionário para adicionar..."
                    value={searchByType[id] || ""}
                    onChange={e => setSearchByType(prev => ({ ...prev, [id]: e.target.value }))}
                  />
                  {search && (
                    <div className="mt-2 rounded-lg border border-border bg-card max-h-48 overflow-y-auto">
                      {disponiveis.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2">Nenhum resultado.</p>
                      ) : disponiveis.map((f: any) => (
                        <button
                          key={f.id}
                          onClick={() => addOperador(id, f.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium">{f.nome}</span>
                            <span className="text-muted-foreground text-xs ml-2">{f.funcao}</span>
                          </div>
                          <span className="text-xs text-primary">+ Adicionar</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function formatDateBRShort(dateValue: string): string {
  if (!dateValue) return "--/--/----";
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) return "--/--/----";
  return `${day}/${month}/${year}`;
}

function DesbloqueioLancamentosManager() {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [unlocks, setUnlocks] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<"equipamento" | "rdo">("equipamento");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      let cid = (profile as any)?.company_id || null;
      if (!cid && (profile as any)?.role === "superadmin") {
        const { data: firstCompany } = await supabase
          .from("companies" as any)
          .select("id")
          .order("created_at")
          .limit(1)
          .maybeSingle();
        cid = (firstCompany as any)?.id || null;
      }

      if (!cid) {
        toast({ title: "Empresa não encontrada", description: "Não foi possível identificar a empresa ativa.", variant: "destructive" });
        setLoading(false);
        return;
      }

      setCompanyId(cid);

      const [{ data: profilesData }, { data: unlockData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nome_completo, perfil, role, status")
          .eq("company_id", cid)
          .order("nome_completo"),
        (supabase as any)
          .from("diary_unlock_requests")
          .select("id, user_id, data_liberada, tipo, created_at")
          .eq("company_id", cid)
          .order("created_at", { ascending: false }),
      ]);

      setUsers((profilesData || []) as any[]);
      setUnlocks((unlockData || []) as any[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message || "Falha ao carregar desbloqueios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLiberar = async () => {
    if (!companyId) return;
    if (!selectedUserId || !selectedDate || !selectedTipo) {
      toast({ title: "Campos obrigatórios", description: "Selecione usuário, data e tipo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        setSaving(false);
        return;
      }

      const { error } = await (supabase as any)
        .from("diary_unlock_requests")
        .insert({
          user_id: selectedUserId,
          data_liberada: selectedDate,
          tipo: selectedTipo,
          company_id: companyId,
          liberado_por: user.id,
        });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Já liberado", description: "Este usuário já possui liberação para esta data e tipo." });
          return;
        }
        throw error;
      }

      toast({ title: "✅ Lançamento liberado" });
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro ao liberar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevogar = async (id: string) => {
    if (!id) return;
    const { error } = await (supabase as any).from("diary_unlock_requests").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao revogar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Liberação revogada" });
    await loadData();
  };

  const usersById = users.reduce<Record<string, any>>((acc, current) => {
    acc[current.user_id] = current;
    return acc;
  }, {});

  if (loading) return <div className="py-10 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Usuário</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="h-11 bg-secondary border-border">
              <SelectValue placeholder="Selecione o usuário" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-11 bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={selectedTipo} onValueChange={(value) => setSelectedTipo(value as "equipamento" | "rdo")}>
              <SelectTrigger className="h-11 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equipamento">Diário de Equipamento</SelectItem>
                <SelectItem value="rdo">RDO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleLiberar} disabled={saving} className="w-full h-11 gap-2">
          <Unlock className="w-4 h-4" />
          {saving ? "Liberando..." : "Liberar"}
        </Button>
      </div>

      <div className="space-y-2">
        {unlocks.map((item: any) => {
          const usr = usersById[item.user_id];
          return (
            <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm text-foreground">
                  {usr?.nome_completo || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBRShort(item.data_liberada)} • {item.tipo === "equipamento" ? "Diário de Equipamento" : "RDO"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleRevogar(item.id)}>
                Revogar
              </Button>
            </div>
          );
        })}
        {unlocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma liberação cadastrada.</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TERCEIRIZADOS MANAGER
// ═══════════════════════════════════════════════════════════════
import { useEmpresasTerceiras } from "@/hooks/useEmpresasTerceiras";

function TerceirizadosManager() {
  const { empresas, funcionarios, loading, addEmpresa, removeEmpresa, addFuncionario, removeFuncionario } = useEmpresasTerceiras();
  const { toast } = useToast();

  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [savingEmp, setSavingEmp] = useState(false);

  const [novoFunc, setNovoFunc] = useState("");
  const [empresaFuncId, setEmpresaFuncId] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [savingFunc, setSavingFunc] = useState(false);

  const handleAddEmpresa = async () => {
    if (!novaEmpresa.trim()) return;
    setSavingEmp(true);
    const ok = await addEmpresa(novaEmpresa.trim());
    setSavingEmp(false);
    if (ok) { setNovaEmpresa(""); toast({ title: "Empresa adicionada!" }); }
    else toast({ title: "Erro ao adicionar empresa", variant: "destructive" });
  };

  const handleRemoveEmpresa = async (id: string, nome: string) => {
    if (!confirm(`Remover "${nome}"? Todos os funcionários desta empresa também serão desativados.`)) return;
    const ok = await removeEmpresa(id);
    if (ok) toast({ title: `"${nome}" removida` });
    else toast({ title: "Erro ao remover empresa", variant: "destructive" });
  };

  const handleAddFunc = async () => {
    if (!novoFunc.trim() || !empresaFuncId) return;
    setSavingFunc(true);
    const ok = await addFuncionario(novoFunc.trim(), empresaFuncId);
    setSavingFunc(false);
    if (ok) { setNovoFunc(""); toast({ title: "Funcionário adicionado!" }); }
    else toast({ title: "Erro ao adicionar funcionário", variant: "destructive" });
  };

  const handleRemoveFunc = async (id: string, nome: string) => {
    if (!confirm(`Remover "${nome}"?`)) return;
    const ok = await removeFuncionario(id);
    if (ok) toast({ title: `"${nome}" removido` });
    else toast({ title: "Erro ao remover funcionário", variant: "destructive" });
  };

  const funcsFiltrados = (filterEmpresa && filterEmpresa !== "__all__")
    ? funcionarios.filter(f => f.empresa_id === filterEmpresa)
    : funcionarios;

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Card Empresas */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h3 className="font-display font-bold text-base flex items-center gap-2">
          <Factory className="w-4 h-4 text-amber-600" /> Empresas Terceirizadas
        </h3>

        {/* Adicionar empresa */}
        <div className="flex gap-2">
          <Input
            value={novaEmpresa}
            onChange={e => setNovaEmpresa(e.target.value)}
            placeholder="Nome da empresa"
            className="h-10 bg-secondary border-border flex-1"
            onKeyDown={e => e.key === "Enter" && handleAddEmpresa()}
          />
          <Button onClick={handleAddEmpresa} disabled={savingEmp || !novaEmpresa.trim()} className="h-10 px-4">
            {savingEmp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {/* Lista */}
        <div className="space-y-2">
          {empresas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
          ) : (
            empresas.map(emp => (
              <div key={emp.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm font-medium">{emp.nome}</span>
                <button
                  onClick={() => handleRemoveEmpresa(emp.id, emp.nome)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card Funcionários */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <h3 className="font-display font-bold text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-600" /> Funcionários Terceirizados
        </h3>

        {empresas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre pelo menos uma empresa primeiro.</p>
        ) : (
          <>
            {/* Adicionar funcionário */}
            <div className="space-y-2">
              <Select value={empresaFuncId} onValueChange={setEmpresaFuncId}>
                <SelectTrigger className="h-10 bg-secondary border-border">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={novoFunc}
                  onChange={e => setNovoFunc(e.target.value)}
                  placeholder="Nome do funcionário"
                  className="h-10 bg-secondary border-border flex-1"
                  onKeyDown={e => e.key === "Enter" && handleAddFunc()}
                />
                <Button onClick={handleAddFunc} disabled={savingFunc || !novoFunc.trim() || !empresaFuncId} className="h-10 px-4">
                  {savingFunc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Filtro */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Filtrar por empresa:</p>
              <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                <SelectTrigger className="h-9 bg-secondary border-border text-sm">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {empresas.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista */}
            <div className="space-y-2">
              {funcsFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
              ) : (
                funcsFiltrados.map(func => {
                  const empresa = empresas.find(e => e.id === func.empresa_id);
                  return (
                    <div key={func.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium">{func.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {empresa?.nome || "?"}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveFunc(func.id, func.nome)}
                        className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR MENU ITEMS
// ═══════════════════════════════════════════════════════════════
// CONFIG WF ABASTECIMENTO
// ═══════════════════════════════════════════════════════════════
function AbastecimentoConfigManager() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoMotorista, setNovoMotorista] = useState("");
  const [novoLubrificador, setNovoLubrificador] = useState("");
  const [novoFornecedor, setNovoFornecedor] = useState("");
  const { toast } = useToast();

  useEffect(() => { buscar(); }, []);

  async function buscar() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
    const cid = (profile as any)?.company_id;
    if (!cid) return;
    const { data } = await (supabase as any).from("abastecimento_config").select("*").eq("company_id", cid).maybeSingle();
    if (data) {
      setConfig(data);
    } else {
      // criar row se não existe
      const { data: novo } = await (supabase as any).from("abastecimento_config").insert({ company_id: cid, motoristas: [], lubrificadores: [], fornecedores_diesel: [] }).select().single();
      setConfig(novo);
    }
    setLoading(false);
  }

  async function salvar(campo: string, lista: string[]) {
    if (!config?.id) return;
    setSalvando(true);
    await (supabase as any).from("abastecimento_config").update({ [campo]: lista, updated_at: new Date().toISOString() }).eq("id", config.id);
    setConfig((p: any) => ({ ...p, [campo]: lista }));
    toast({ title: "Salvo!", description: "Configuração atualizada." });
    setSalvando(false);
  }

  function ListaConfig({ campo, label, placeholder }: { campo: string; label: string; placeholder: string }) {
    const lista: string[] = config?.[campo] || [];
    const [novoItem, setNovoItem] = useState("");
    function adicionar() {
      if (!novoItem.trim()) return;
      const nova = [...lista, novoItem.trim().toUpperCase()];
      salvar(campo, nova);
      setNovoItem("");
    }
    function remover(idx: number) {
      salvar(campo, lista.filter((_: string, i: number) => i !== idx));
    }
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-display font-bold text-primary uppercase tracking-wide flex items-center gap-2">
          <Fuel className="w-4 h-4" /> {label}
        </h3>
        <div className="flex gap-2">
          <Input value={novoItem} onChange={e => setNovoItem(e.target.value)} placeholder={placeholder} className="h-9 rounded-xl flex-1" onKeyDown={e => e.key === "Enter" && adicionar()} />
          <Button size="sm" onClick={adicionar} disabled={salvando} className="h-9 rounded-xl gap-1"><Plus className="w-4 h-4" /> Adicionar</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {lista.map((item: string, i: number) => (
            <span key={i} className="flex items-center gap-1 bg-secondary border border-border rounded-full px-3 py-1 text-sm font-medium">
              {item}
              <button onClick={() => remover(i)} className="text-muted-foreground hover:text-destructive ml-1"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {lista.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cadastrado. Adicione acima.</p>}
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6 p-4">
      <div className="rdo-card space-y-3">
        <p className="text-xs text-muted-foreground">
          👤 <strong>Motoristas do Comboio</strong> e <strong>Lubrificadores</strong> são configurados em
          <strong> Painel → Operadores Habilitados</strong>: tipo <em>Comboio</em> (motoristas) e tipo <em>Lubrificador (WF Abastecimento)</em>.
        </p>
      </div>
      <div className="rdo-card space-y-6">
        <ListaConfig campo="fornecedores_diesel" label="Fornecedores de Diesel" placeholder="Ex: POSTO FREMIX" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
const MENU_SECTIONS = [
  { key: "assinatura", label: "Meu Plano / Faturas", icon: Receipt },
  { key: "dashboard", label: "WF Dashboards", icon: BarChart3 },
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "permissoes", label: "Permissões", icon: Users },
  { key: "ogs", label: "OGS / Obras", icon: MapPin },
  { key: "materiais", label: "Materiais", icon: Package },
  { key: "maquinas", label: "Frota (Equipamentos)", icon: Wrench },
  { key: "tipos_equipamento", label: "Tipos de Equipamento", icon: Settings },
  { key: "caminhoes", label: "Frota (Carreteiros)", icon: Truck },
  { key: "funcionarios", label: "Funcionários", icon: Users },
  { key: "equipes", label: "Equipes", icon: Users },
  { key: "centros_custo", label: "Centros de Custo", icon: DollarSign },
  { key: "encarregados", label: "Encarregados de Obra", icon: HardHat },
  { key: "tipos_servico", label: "Tipos de Serviço", icon: Hammer },
  { key: "empresas_parceiras", label: "Empresas Parceiras", icon: Building2 },
  { key: "funcoes", label: "Funções", icon: Briefcase },
  { key: "fornecedores", label: "Fornecedores", icon: Factory },
  { key: "terceirizados", label: "Terceirizados", icon: HardHat },
  // Usinas removidas — migradas para Fornecedores com vínculo PAVIMENTACAO
  { key: "destinos", label: "Destinos (Carreteiro)", icon: MapPin },
  { key: "emails", label: "E-mails", icon: Mail },
  { key: "sst", label: "SST Responsáveis", icon: HardHat },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "destinatarios_notif", label: "Destinatários Push", icon: Target },
  { key: "desbloquear", label: "Desbloquear Lançamentos", icon: Unlock },
  { key: "tarifas_vt", label: "Tarifas de VT", icon: Bus },
  { key: "lixeira", label: "Lixeira (30 dias)", icon: Trash2 },
  { key: "auditoria", label: "Log de Auditoria", icon: Shield },
  { key: "operadores_habilitados", label: "Cadastros do Sistema", icon: ShieldCheck },
  { key: "roles", label: "Admin Roles", icon: ShieldCheck },
  { key: "engenheiros_ogs", label: "Engenheiros por OGS", icon: HardHat },
  { key: "encarregados_ogs", label: "Encarregados por OGS", icon: HardHat },
  { key: "abastecimento_config", label: "WF Abastecimento", icon: Fuel },
];

// ═══════════════════════════════════════════════════════════════
// LIXEIRA MANAGER
// ═══════════════════════════════════════════════════════════════
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// ═══════════════════════════════════════════════════════════════
// ASSINATURA E FATURAS MANAGER
// ═══════════════════════════════════════════════════════════════
function AssinaturaManager() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const { toast } = useToast();

  // Estados do Modal de Checkout
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<{nome: string, valor: number} | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [processandoAssinatura, setProcessandoAssinatura] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.company_id) { setLoading(false); return; }

      const [{ data: comp }, { data: sub }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("company_id", profile.company_id).maybeSingle()
      ]);

      setCompany(comp);
      setSubscription(sub);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleAssinarClick = (plano: string, valor: number) => {
    setPlanoSelecionado({ nome: plano, valor });
    setCheckoutModalOpen(true);
  };

  const confirmarAssinatura = async () => {
    if (!cpfCnpj || cpfCnpj.replace(/\D/g, "").length < 11) {
      toast({ title: "Dados inválidos", description: "Por favor, informe um CPF ou CNPJ válido.", variant: "destructive" });
      return;
    }

    setProcessandoAssinatura(true);
    toast({ title: "Aguarde", description: "Gerando link de pagamento no Asaas..." });
    
    try {
      const { data, error } = await supabase.functions.invoke('asaas-checkout', {
        body: { 
          plano: planoSelecionado?.nome, 
          valor: planoSelecionado?.valor, 
          company_id: company?.id,
          cpfCnpj: cpfCnpj.replace(/\D/g, "")
        }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast({ title: "Erro na assinatura", description: err.message, variant: "destructive" });
      setProcessandoAssinatura(false);
    }
  };

  if (loading) return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const isTrial = !subscription || subscription.status === "trial";
  const diasRestantes = company?.trial_ends_at 
    ? Math.max(0, Math.ceil((new Date(company.trial_ends_at).getTime() - Date.now()) / (1000 * 3600 * 24)))
    : 0;

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-display font-bold">Meu Plano e Faturas</h2>
        <p className="text-sm text-muted-foreground">Gerencie sua assinatura do Workflux.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Status Atual</h3>
          {isTrial ? (
            <div className="mt-1">
              <span className="text-2xl font-bold text-amber-600">Período de Teste</span>
              <p className="text-sm text-muted-foreground mt-1">
                {diasRestantes > 0 ? `Você tem ${diasRestantes} dias restantes no seu teste grátis.` : "Seu período de teste expirou."}
              </p>
            </div>
          ) : (
            <div className="mt-1">
              <span className="text-2xl font-bold text-green-600">Plano {subscription?.plano} (Ativo)</span>
              <p className="text-sm text-muted-foreground mt-1">
                Sua próxima fatura vence em {new Date(subscription?.data_vencimento).toLocaleDateString("pt-BR")}.
              </p>
            </div>
          )}
        </div>
      </div>

      {isTrial && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Escolha seu plano</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Starter */}
            <div className="border border-border rounded-xl p-5 flex flex-col bg-card hover:border-primary/50 transition-colors">
              <h4 className="font-bold text-lg">Starter</h4>
              <p className="text-2xl font-extrabold text-primary mt-2">R$ 497<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              <ul className="text-sm text-muted-foreground mt-4 space-y-2 flex-1">
                <li>✓ Até 15 usuários</li>
                <li>✓ 2 módulos à escolha</li>
                <li>✓ Suporte via WhatsApp</li>
              </ul>
              <Button onClick={() => handleAssinarClick("Starter", 497)} className="mt-6 w-full" variant="outline">Assinar Starter</Button>
            </div>

            {/* Pro */}
            <div className="border-2 border-primary rounded-xl p-5 flex flex-col bg-primary/5 shadow-md relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Mais Popular</div>
              <h4 className="font-bold text-lg text-primary">Pro</h4>
              <p className="text-2xl font-extrabold text-primary mt-2">R$ 897<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              <ul className="text-sm text-foreground mt-4 space-y-2 flex-1 font-medium">
                <li>✓ Até 40 usuários</li>
                <li>✓ 5 módulos à escolha</li>
                <li>✓ Exportação para Protheus</li>
                <li>✓ Suporte prioritário</li>
              </ul>
              <Button onClick={() => handleAssinarClick("Pro", 897)} className="mt-6 w-full bg-primary hover:bg-primary/90 text-white">Assinar Pro</Button>
            </div>

            {/* Business */}
            <div className="border border-border rounded-xl p-5 flex flex-col bg-card hover:border-primary/50 transition-colors">
              <h4 className="font-bold text-lg">Business</h4>
              <p className="text-2xl font-extrabold text-primary mt-2">R$ 1.497<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              <ul className="text-sm text-muted-foreground mt-4 space-y-2 flex-1">
                <li>✓ Usuários Ilimitados</li>
                <li>✓ Todos os módulos</li>
                <li>✓ IA para documentos</li>
                <li>✓ Suporte Dedicado (SLA 4h)</li>
              </ul>
              <Button onClick={() => handleAssinarClick("Business", 1497)} className="mt-6 w-full" variant="outline">Assinar Business</Button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de CPF/CNPJ para Checkout */}
      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quase lá!</DialogTitle>
            <DialogDescription>
              Para gerar sua fatura de assinatura do <strong>Plano {planoSelecionado?.nome}</strong>, precisamos que confirme o seu CPF ou CNPJ.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="cpfCnpj" className="mb-2 block">CPF ou CNPJ</Label>
            <Input 
              id="cpfCnpj"
              placeholder="Digite apenas números..." 
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              disabled={processandoAssinatura}
              className="text-lg"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckoutModalOpen(false)} disabled={processandoAssinatura}>Cancelar</Button>
            <Button onClick={confirmarAssinatura} disabled={processandoAssinatura}>
              {processandoAssinatura && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Continuar para Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TARIFAS VT MANAGER
// ═══════════════════════════════════════════════════════════════
function TarifasVTManager() {
  const { toast } = useToast();
  const [tarifas, setTarifas] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [novoTipo, setNovoTipo] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("vt_tarifas").select("*").order("tipo_transporte");
    if (data) setTarifas(data);
  };

  useEffect(() => { load(); }, []);

  const salvarEdicao = async (id: string) => {
    setSaving(true);
    const valor = parseFloat(editValue.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("vt_tarifas").update({ valor_unitario: valor }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Tarifa atualizada!" });
      setEditingId(null);
      load();
    }
    setSaving(false);
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("vt_tarifas").update({ ativo: !ativo }).eq("id", id);
    load();
  };

  const adicionar = async () => {
    if (!novoTipo.trim()) return;
    const valor = parseFloat(novoValor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    setAdicionando(true);
    const { error } = await supabase.from("vt_tarifas").insert({ tipo_transporte: novoTipo.trim(), valor_unitario: valor, ativo: true });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Tarifa adicionada!" });
      setNovoTipo(""); setNovoValor("");
      load();
    }
    setAdicionando(false);
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-lg font-display font-bold">Tarifas de Vale-Transporte</h2>
        <p className="text-xs text-muted-foreground">Atualize os valores quando houver reajuste das tarifas públicas.</p>
      </div>

      {/* Lista de tarifas */}
      <div className="space-y-2">
        {tarifas.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${!t.ativo ? 'text-muted-foreground line-through' : ''}`}>{t.tipo_transporte}</p>
            </div>
            {editingId === t.id ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-24 h-8 px-2 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <button onClick={() => salvarEdicao(t.id)} disabled={saving} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium">
                  {saving ? "..." : "Salvar"}
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground px-2 py-1.5">Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary">R$ {t.valor_unitario.toFixed(2).replace(".", ",")}</span>
                <button onClick={() => { setEditingId(t.id); setEditValue(String(t.valor_unitario).replace(".", ",")); }} className="text-muted-foreground hover:text-foreground p-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleAtivo(t.id, t.ativo)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {t.ativo ? "Ativo" : "Inativo"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Adicionar nova tarifa */}
      <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar nova tarifa</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Tipo (ex: Ônibus Municipal Cotia)"
            value={novoTipo}
            onChange={e => setNovoTipo(e.target.value)}
            className="sm:col-span-2 h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={novoValor}
              onChange={e => setNovoValor(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none"
            />
          </div>
        </div>
        <button
          onClick={adicionar}
          disabled={adicionando || !novoTipo.trim()}
          className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Adicionar Tarifa
        </button>
      </div>
    </div>
  );
}

function LixeiraManager() {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const { toast } = useToast();

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from("lixeira" as any).select("*").order("created_at", { ascending: false });
    setItens((data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const restaurar = async (item: any) => {
    setRestaurando(item.id);
    try {
      const dados = item.dados;
      if (item.tabela === "rdo_diarios" && dados?.rdo) {
        const { id, ...rdoSemId } = dados.rdo;
        const { data: novoRdo, error } = await supabase.from("rdo_diarios" as any).insert(rdoSemId).select("id").single();
        if (error) throw error;
        const novoId = (novoRdo as any).id;
        // Restaurar efetivo, produção, equipamentos, NFs
        if (dados.efetivo?.length) await supabase.from("rdo_efetivo").insert(dados.efetivo.map((e: any) => { const { id, ...r } = e; return { ...r, rdo_id: novoId }; }));
        if (dados.producao?.length) await supabase.from("rdo_producao" as any).insert(dados.producao.map((e: any) => { const { id, ...r } = e; return { ...r, rdo_id: novoId }; }));
        if (dados.equipamentos?.length) await supabase.from("rdo_equipamentos" as any).insert(dados.equipamentos.map((e: any) => { const { id, ...r } = e; return { ...r, rdo_id: novoId }; }));
        if (dados.nfs?.length) await supabase.from("rdo_nf_massa" as any).insert(dados.nfs.map((e: any) => { const { id, ...r } = e; return { ...r, rdo_id: novoId }; }));
      }
      // Remover da lixeira após restaurar
      await supabase.from("lixeira" as any).delete().eq("id", item.id);
      toast({ title: "✅ Registro restaurado com sucesso!" });
      carregar();
    } catch (e: any) {
      toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" });
    }
    setRestaurando(null);
  };

  const excluirDefinitivo = async (id: string) => {
    if (!confirm("Excluir permanentemente? Não poderá ser recuperado.")) return;
    await supabase.from("lixeira" as any).delete().eq("id", id);
    setItens(prev => prev.filter(i => i.id !== id));
    toast({ title: "Excluído permanentemente" });
  };

  function fmtDateHora(d: string) {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function diasRestantes(expira: string) {
    const diff = new Date(expira).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  const TIPO_LABEL: Record<string, string> = { rdo_diarios: "RDO" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Lixeira <span className="text-muted-foreground font-normal">({itens.length})</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Itens excluídos ficam aqui por 30 dias. Após isso são removidos automaticamente.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Trash2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Lixeira vazia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map(item => {
            const dias = diasRestantes(item.expira_em);
            const dados = item.dados;
            return (
              <div key={item.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold border border-destructive/20">
                        {TIPO_LABEL[item.tabela] || item.tabela}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        dias <= 3 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                      }`}>
                        {dias}d restantes
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1.5">
                      {item.tabela === "rdo_diarios" && dados?.rdo
                        ? `RDO — OGS ${dados.rdo.obra_nome || "-"} — ${dados.rdo.data ? new Date(dados.rdo.data).toLocaleDateString("pt-BR") : "-"}`
                        : `Registro ${item.registro_id.slice(0, 8)}...`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Excluído por {item.excluido_por_nome || "desconhecido"} em {fmtDateHora(item.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => restaurar(item)}
                      disabled={restaurando === item.id}
                      className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {restaurando === item.id ? "..." : "↩ Restaurar"}
                    </button>
                    <button
                      onClick={() => excluirDefinitivo(item.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Excluir permanentemente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SST Responsáveis Manager ──────────────────────────────────────────────────────────────────
const COMPANY_ID_ADMIN = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CARGOS = [
  { key: "engenheiro", label: "Engenheiro da Obra" },
  { key: "encarregado", label: "Encarregado da Obra" },
  { key: "tecnico_sst", label: "Técnico SST" },
  { key: "administrativo", label: "Administrativo" },
];

// ═══════════════════════════════════════════════════════════════
// TIPOS DE EQUIPAMENTO MANAGER
// ═══════════════════════════════════════════════════════════════
const CATEGORIAS_TIPOS = [
  { key: "CAMINHOES", label: "Caminhões" },
  { key: "ROLO", label: "Rolos" },
  { key: "VEICULO", label: "Veículos de Transporte" },
  { key: "LINHA_AMARELA", label: "Linha Amarela" },
];

function TiposEquipamentoManager() {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoriaSel, setCategoriaSel] = useState("CAMINHOES");
  const [novoLabel, setNovoLabel] = useState("");
  const [novoSubtipo, setNovoSubtipo] = useState("");
  const [novoIcone, setNovoIcone] = useState("");
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.company_id) {
            setMyCompanyId(data.company_id);
            loadTipos(data.company_id);
          }
        });
    });
  }, []);

  async function loadTipos(cid: string) {
    setLoading(true);
    const { data } = await (supabase as any).from("equipamento_tipos")
      .select("*").eq("company_id", cid).order("categoria").order("label");
    setTipos(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!novoLabel.trim() || !novoSubtipo.trim()) {
      toast({ title: "Atenção", description: "Preencha o nome e o código do subtipo.", variant: "destructive" });
      return;
    }
    if (!myCompanyId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("equipamento_tipos").insert({
      company_id: myCompanyId,
      categoria: categoriaSel,
      subtipo: novoSubtipo.trim().toUpperCase().replace(/ /g, "_"),
      label: novoLabel.trim(),
      icone: novoIcone.trim() || null,
      ativo: true,
    });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Tipo adicionado!" });
    setNovoLabel(""); setNovoSubtipo(""); setNovoIcone("");
    loadTipos(myCompanyId);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await (supabase as any).from("equipamento_tipos").delete().eq("id", id);
    setDeletingId(null);
    if (myCompanyId) loadTipos(myCompanyId);
  }

  async function handleToggle(id: string, ativo: boolean) {
    await (supabase as any).from("equipamento_tipos").update({ ativo: !ativo }).eq("id", id);
    if (myCompanyId) loadTipos(myCompanyId);
  }

  const tiposFiltrados = tipos.filter(t => t.categoria === categoriaSel);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="font-display font-bold text-base">Tipos de Equipamento</h2>
      </div>
      <p className="text-xs text-muted-foreground">Gerencie os subtipos de cada categoria. Os subtipos controlam a filtragem de frotas no diário de equipamentos.</p>

      {/* Seleção de categoria */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS_TIPOS.map(c => (
          <button key={c.key} onClick={() => setCategoriaSel(c.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              categoriaSel === c.key ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Lista de tipos da categoria */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {tiposFiltrados.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum subtipo cadastrado nessa categoria.</p>
          )}
          {tiposFiltrados.map(t => (
            <div key={t.id} className={`flex items-center justify-between gap-3 border rounded-xl px-3 py-2.5 ${
              t.ativo ? "border-border" : "border-border/40 opacity-50"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">{t.icone || "🔧"}</span>
                <div>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{t.subtipo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(t.id, t.ativo)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                    t.ativo ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}>
                  {t.ativo ? "Ativo" : "Inativo"}
                </button>
                <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                  className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                  {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário para adicionar novo tipo */}
      <div className="border border-dashed border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground">Adicionar subtipo em {CATEGORIAS_TIPOS.find(c => c.key === categoriaSel)?.label}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome exibido *</Label>
            <Input value={novoLabel} onChange={e => setNovoLabel(e.target.value)} placeholder="Ex: Rolo Chapa" className="h-10 rounded-xl bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Emoji (opcional)</Label>
            <Input value={novoIcone} onChange={e => setNovoIcone(e.target.value)} placeholder="Ex: 🚧" className="h-10 rounded-xl bg-secondary border-border" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Código interno * (automático, sem espaços)</Label>
          <Input
            value={novoSubtipo}
            onChange={e => setNovoSubtipo(e.target.value.toUpperCase().replace(/ /g, "_"))}
            placeholder={`Ex: ${categoriaSel}_NOVO_TIPO`}
            className="h-10 rounded-xl bg-secondary border-border font-mono text-xs"
          />
        </div>
        <Button onClick={handleAdd} disabled={saving || !novoLabel.trim() || !novoSubtipo.trim()}
          className="w-full h-10 rounded-xl gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar Subtipo
        </Button>
      </div>
    </div>
  );
}

function SSTResponsaveisManager() {
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("engenheiro");
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("sst_responsaveis" as any).select("*").eq("company_id", COMPANY_ID_ADMIN).order("cargo").order("nome");
    if (data) setLista(data as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function adicionar() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from("sst_responsaveis" as any).insert({ company_id: COMPANY_ID_ADMIN, nome: novoNome.trim().toUpperCase(), cargo: novoCargo });
    if (!error) { setNovoNome(""); toast({ title: "Adicionado!" }); await load(); }
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
    setSalvando(false);
  }

  async function remover(id: string) {
    await supabase.from("sst_responsaveis" as any).delete().eq("id", id);
    await load();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("sst_responsaveis" as any).update({ ativo: !ativo }).eq("id", id);
    await load();
  }

  const porCargo = CARGOS.map(c => ({ ...c, items: lista.filter(l => l.cargo === c.key) }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Responsáveis SST</h2>
        <p className="text-sm text-muted-foreground">Cadastre os nomes que aparecem nos campos de responsáveis no formulário de Inspeção SST.</p>
      </div>

      {/* Adicionar */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs mb-1 block">Nome</Label>
          <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: PLINIO OLIVEIRA" onKeyDown={e => e.key === "Enter" && adicionar()} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Cargo</Label>
          <select value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
            className="h-9 border border-border rounded-md px-3 text-sm bg-background">
            {CARGOS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <Button onClick={adicionar} disabled={salvando || !novoNome.trim()} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* Lista por cargo */}
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : porCargo.map(grupo => (
        <div key={grupo.key} className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-3">{grupo.label}</p>
          {grupo.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum cadastrado</p>
          ) : (
            <div className="space-y-2">
              {grupo.items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                  <span className={`flex-1 text-sm font-medium ${!item.ativo ? 'line-through text-muted-foreground' : ''}`}>{item.nome}</span>
                  <Switch checked={item.ativo} onCheckedChange={() => toggleAtivo(item.id, item.ativo)} />
                  <button onClick={() => remover(item.id)} className="text-destructive hover:text-destructive/80 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// FuncoesManager
// ============================================================
function FuncoesManager() {
  const { toast } = useToast();
  const { funcoes, addFuncao, updateFuncao, removeFuncao } = useFuncoes();
  const [novo, setNovo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!novo.trim()) return;
    setSaving(true);
    const ok = await addFuncao(novo);
    if (ok) { setNovo(""); toast({ title: "Função cadastrada!" }); }
    else toast({ title: "Erro ao cadastrar função", variant: "destructive" });
    setSaving(false);
  }

  async function handleUpdate(id: string) {
    if (!editNome.trim()) return;
    const ok = await updateFuncao(id, editNome);
    if (ok) { setEditId(null); toast({ title: "Função atualizada!" }); }
    else toast({ title: "Erro ao atualizar", variant: "destructive" });
  }

  async function handleRemove(id: string, nome: string) {
    if (!window.confirm(`Inativar função "${nome}"?`)) return;
    const ok = await removeFuncao(id);
    if (ok) toast({ title: "Função inativada" });
    else toast({ title: "Erro ao inativar", variant: "destructive" });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={novo}
          onChange={e => setNovo(e.target.value.toUpperCase())}
          placeholder="Nova função (ex: RASTELEIRO)"
          className="h-10 rounded-xl flex-1"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={saving || !novo.trim()} className="rounded-xl gap-1">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {funcoes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma função cadastrada.</p>}
        {funcoes.map(f => (
          <div key={f.id} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
            {editId === f.id ? (
              <>
                <Input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value.toUpperCase())}
                  className="h-8 rounded-lg flex-1 text-sm"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleUpdate(f.id)}
                />
                <Button size="sm" className="rounded-lg" onClick={() => handleUpdate(f.id)}>Salvar</Button>
                <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setEditId(null)}>Cancelar</Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium">{f.nome}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(f.id); setEditNome(f.nome); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemove(f.id, f.nome)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// EmpresasParceirasManager
// ============================================================
const TIPO_LABELS: Record<string, string> = {
  EMPREITEIRA: "Empreiteira",
  MAO_DE_OBRA: "Mão de Obra",
  AMBAS: "Ambas",
};

function EmpresasParceirasManager() {
  const { toast } = useToast();
  const { empresas, addEmpresa, updateEmpresa, removeEmpresa } = useEmpresasParceiras();
  const [form, setForm] = useState({ nome: "", cnpj: "", contato: "", tipo: "AMBAS" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cnpj: "", contato: "", tipo: "AMBAS" });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.nome.trim()) return;
    setSaving(true);
    const ok = await addEmpresa({ nome: form.nome.trim().toUpperCase(), cnpj: form.cnpj.trim() || null, contato: form.contato.trim() || null, tipo: form.tipo });
    if (ok) { setForm({ nome: "", cnpj: "", contato: "", tipo: "AMBAS" }); toast({ title: "Empresa Parceira cadastrada!" }); }
    else toast({ title: "Erro ao cadastrar", variant: "destructive" });
    setSaving(false);
  }

  async function handleUpdate(id: string) {
    if (!editForm.nome.trim()) return;
    const ok = await updateEmpresa(id, { nome: editForm.nome.trim().toUpperCase(), cnpj: editForm.cnpj.trim() || null, contato: editForm.contato.trim() || null, tipo: editForm.tipo });
    if (ok) { setEditId(null); toast({ title: "Empresa atualizada!" }); }
    else toast({ title: "Erro ao atualizar", variant: "destructive" });
  }

  async function handleRemove(id: string, nome: string) {
    if (!window.confirm(`Inativar empresa "${nome}"?`)) return;
    const ok = await removeEmpresa(id);
    if (ok) toast({ title: "Empresa inativada" });
    else toast({ title: "Erro ao inativar", variant: "destructive" });
  }

  return (
    <div className="space-y-4">
      {/* Formulário novo */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nova Empresa Parceira</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value.toUpperCase() }))} placeholder="CONSTRUTORA X" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">CNPJ</Label>
            <Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Contato</Label>
            <Input value={form.contato} onChange={e => setForm(p => ({ ...p, contato: e.target.value }))} placeholder="(11) 99999-9999" className="h-10 rounded-xl" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm">
              {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={handleAdd} disabled={saving || !form.nome.trim()} className="w-full rounded-xl gap-1">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {empresas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa parceira cadastrada.</p>}
        {empresas.map(e => (
          <div key={e.id} className="bg-card border border-border rounded-xl px-3 py-2.5">
            {editId === e.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Input value={editForm.nome} onChange={ev => setEditForm(p => ({ ...p, nome: ev.target.value.toUpperCase() }))} className="h-8 rounded-lg text-sm" autoFocus />
                  </div>
                  <Input value={editForm.cnpj} onChange={ev => setEditForm(p => ({ ...p, cnpj: ev.target.value }))} placeholder="CNPJ" className="h-8 rounded-lg text-sm" />
                  <Input value={editForm.contato} onChange={ev => setEditForm(p => ({ ...p, contato: ev.target.value }))} placeholder="Contato" className="h-8 rounded-lg text-sm" />
                  <div className="col-span-2">
                    <select value={editForm.tipo} onChange={ev => setEditForm(p => ({ ...p, tipo: ev.target.value }))} className="w-full h-8 rounded-lg border border-border bg-background px-2 text-sm">
                      {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-lg" onClick={() => handleUpdate(e.id)}>Salvar</Button>
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setEditId(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{e.nome}</p>
                  <p className="text-xs text-muted-foreground">{TIPO_LABELS[e.tipo] || e.tipo}{e.cnpj ? ` · ${e.cnpj}` : ""}{e.contato ? ` · ${e.contato}` : ""}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditId(e.id); setEditForm({ nome: e.nome, cnpj: e.cnpj || "", contato: e.contato || "", tipo: e.tipo }); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleRemove(e.id, e.nome)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminConfiguracoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, loading: loadingAdmin } = useIsAdmin();
  const { permissions, loading: loadingPerms } = usePermissions();
  const { isSuperAdmin, loading: loadingModules } = useCompanyModules();
  const activeSection = searchParams.get("section") || "dashboard";
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (activeSection === "lancamentos_admin") {
      navigate("/admin/lancamentos");
    }
  }, [activeSection, navigate]);

  const handleSectionChange = (key: string) => {
    if (key === activeSection) return;
    setTransitioning(true);
    setTimeout(() => {
      setSearchParams({ section: key });
      setTransitioning(false);
    }, 120);
  };

  const loading = loadingAdmin || loadingPerms || loadingModules;
  const hasAccess = isAdmin || isSuperAdmin || permissions?.is_admin === true;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!hasAccess) { navigate("/"); return null; }

  const renderContent = () => {
    switch (activeSection) {
      case "assinatura": return <AssinaturaManager />;
      case "dashboard":
        return (
          <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando dashboards...</p></div>}>
            <WFDashboardsHub />
          </Suspense>
        );
      case "visao_equipamentos":
        return (
          <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>}>
            <UnifiedEquipmentView />
          </Suspense>
        );
      case "usuarios": return <UsersManagerExternal />;
      case "permissoes": return <PermissoesManager />;
      case "ogs": return <OgsManager />;
      case "materiais": return <MateriaisUnificadoManager />;
      case "maquinas": return <MaquinasManager />;
      case "tipos_equipamento": return <TiposEquipamentoManager />;
      case "caminhoes": return <TruckRegistryManager />;
      case "funcionarios": return <FuncionariosManager />;
      case "equipes": return <EquipesManager />;
      case "centros_custo": return <CentrosCustoManager />;
      case "encarregados": return <EncarregadosManager />;
      case "tipos_servico": return <EntityManager tableName="tipos_servico" label="Tipo de Serviço" vinculoOptions={["CAUQ", "PAVIMENTACAO", "INFRA", "RDO", "TODOS"]} />;
      case "empreiteiros": return <EntityManager tableName="empresas_parceiras" label="Empreiteiro" />; // migrado para empresas_parceiras
      case "empresas_parceiras": return <EmpresasParceirasManager />;
      case "funcoes": return <FuncoesManager />;
      case "fornecedores": return <FornecedoresManager />;
      case "terceirizados": return <TerceirizadosManager />;
      // case "usinas": removido — usinas migradas para Fornecedores
      case "destinos": return <DestinosManager />;
      case "emails": return <EmailConfig />;
      case "sst": return <SSTResponsaveisManager />;
      case "notificacoes": return <NotificationPrefsManager />;
      case "destinatarios_notif": return <NotificationTargetsManager />;
      case "desbloquear": return <DesbloqueioLancamentosManager />;

      case "operadores_habilitados": return <OperadoresHabilitadosManager />;
      case "roles": return <AdminRolesPage />;
      case "tarifas_vt": return <TarifasVTManager />;
      case "lixeira": return <LixeiraManager />;
      case "auditoria": return <AuditLogViewerAdmin />;
      case "engenheiros_ogs": return <EngenheirosOgsManager />;
      case "encarregados_ogs": return <EncEncarregadoOgsManager />;
      case "abastecimento_config": return <AbastecimentoConfigManager />;
      default: return null;
    }
  };

  const currentItem = MENU_SECTIONS.find(s => s.key === activeSection);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-header-gradient text-primary-foreground px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoCi} alt="CI" className="h-7 object-contain" />
          <div className="flex-1">
            <h1 className="font-display font-bold text-base leading-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Painel de Controle
            </h1>
            <p className="text-[10px] text-primary-foreground/70">Administração Centralizada</p>
          </div>
          <button
            onClick={async () => { try { await supabase.auth.signOut(); } catch {} localStorage.clear(); sessionStorage.clear(); window.location.replace("/"); }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile tabs (horizontal scroll) */}
      <div className="md:hidden sticky top-[52px] z-40 bg-card border-b border-border overflow-x-auto">
        <div className="flex gap-1 px-2 py-2 min-w-max">
          {MENU_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleSectionChange(item.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation — desktop only */}
        <nav className="w-56 shrink-0 border-r border-border bg-card overflow-y-auto hidden md:block">
          <div className="py-2">
            {MENU_SECTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleSectionChange(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-5xl">
            {currentItem && activeSection !== "dashboard" && (
              <div className="mb-6">
                <h2 className="text-lg font-display font-extrabold text-foreground flex items-center gap-2">
                  {(() => { const Icon = currentItem.icon; return <Icon className="w-5 h-5 text-primary" />; })()}
                  {currentItem.label}
                </h2>
              </div>
            )}
            <div className={`transition-opacity duration-100 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
              {transitioning ? (
                <div className="space-y-3">
                  <div className="h-12 rounded-xl bg-muted animate-pulse" />
                  <div className="h-32 rounded-xl bg-muted animate-pulse" />
                  <div className="h-14 rounded-xl bg-muted animate-pulse" />
                  <div className="h-14 rounded-xl bg-muted animate-pulse" />
                </div>
              ) : renderContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
