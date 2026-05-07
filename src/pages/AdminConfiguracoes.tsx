import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
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
  Target, ClipboardList, Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import FuncionariosManager from "@/components/admin/FuncionariosManager";
import AeroPavStaffManager from "@/components/admin/AeroPavStaffManager";
import PermissoesManager from "@/components/admin/PermissoesManager";
import logoCi from "@/assets/logo-workflux.png";

const FleetDashboard = lazy(() => import("./FleetDashboard"));
const UnifiedEquipmentView = lazy(() => import("@/components/admin/UnifiedEquipmentView"));

const VINCULO_OPTIONS = ["PAVIMENTACAO", "INFRA", "CANTEIRO", "COMBOIO", "PIPA", "ESPARGIDOR", "TODOS"];
const VINCULO_LABELS: Record<string, string> = {
  PAVIMENTACAO: "RDO Pavimentação",
  CAUQ: "RDO Pavimentação (legado)",
  INFRA: "RDO Infra",
  CANTEIRO: "RDO Canteiro",
  COMBOIO: "Comboio",
  PIPA: "Caminhão Pipa",
  ESPARGIDOR: "Espargidor",
  TODOS: "Todos",
};
const TIPO_INSUMO_OPTIONS = ["Diesel", "Emulsão", "Água", "Concreto", "Massa Asfáltica", "Insumos", "Outro"];
const TIPO_USO_OPTIONS = ["Nota Fiscal", "Transporte", "Ambos"];
const CATEGORIAS_EQUIP = ["PEQUENO PORTE", "FRESA/BOB", "VIBRO/ROLO", "LINHA AMARELA", "USINAGEM", "VEÍCULOS EM GERAL"];

// Generic CRUD hook for simple tables
function useCrudTable(tableName: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const hasNome = ["fornecedores", "tipos_servico", "empreiteiros", "usinas", "materiais"].includes(tableName);
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

// Simple entity form with nome + vinculo_rdo
function EntityManager({ tableName, label }: { tableName: string; label: string }) {
  const { items, loading, add, remove } = useCrudTable(tableName);
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome.", variant: "destructive" }); return; }
    const ok = await add({ nome: nome.trim(), vinculo_rdo: vinculo });
    if (ok) { setNome(""); setVinculo("TODOS"); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder={`Novo ${label}`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Vincular ao RDO</Label>
          <Select value={vinculo} onValueChange={setVinculo}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VINCULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{item.nome}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.vinculo_rdo}</span>
            </div>
            <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
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
    setEditVinculos(item.vinculos?.length ? item.vinculos : [item.vinculo_rdo || "TODOS"]);
    setEditTipoInsumos(item.tipo_insumos?.length ? item.tipo_insumos : (item.tipo_insumo ? [item.tipo_insumo] : []));
  };

  const saveEdit = async (id: string) => {
    if (editVinculos.length === 0) { toast({ title: "Atenção", description: "Selecione ao menos um vínculo.", variant: "destructive" }); return; }
    const ok = await update(id, {
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
          <PillGroup options={VINCULO_OPTIONS} selected={vinculos}
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
                <p className="font-medium text-sm text-foreground">{item.nome}</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Onde aparece</Label>
                  <PillGroup options={VINCULO_OPTIONS} selected={editVinculos}
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
  const { items, add, remove } = useCrudTable("maquinas_frota");
  const { toast } = useToast();
  const [frota, setFrota] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");

  const handleAdd = async () => {
    if (!frota.trim() || !nome.trim()) {
      toast({ title: "Atenção", description: "Preencha Frota e Nome.", variant: "destructive" });
      return;
    }
    const ok = await add({ frota: frota.trim(), nome: nome.trim(), tipo: tipo.trim(), categoria, empresa: empresa.trim(), vinculo_rdo: vinculo, status: "ativo" });
    if (ok) { setFrota(""); setNome(""); setTipo(""); setCategoria(""); setEmpresa(""); setVinculo("TODOS"); }
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
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Input value={empresa} onChange={e => setEmpresa(e.target.value)} className="h-11 bg-secondary border-border" placeholder="PRÓPRIO" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{CATEGORIAS_EQUIP.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vincular ao RDO</Label>
            <Select value={vinculo} onValueChange={setVinculo}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{VINCULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Máquina</Button>
      </div>
      <div className="space-y-2">
        {items.map((m: any) => (
          <div key={m.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{m.frota} — {m.tipo || m.categoria} ({m.nome})</p>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{m.categoria}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{m.vinculo_rdo || "TODOS"}</span>
              </div>
            </div>
            <button onClick={() => remove(m.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
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
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [perfil, setPerfil] = useState("Apontador");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editPerfil, setEditPerfil] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deactivating, setDeactivating] = useState<any | null>(null);
  const [deactivatingLoading, setDeactivatingLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState("");

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

      toast({ title: "✅ Usuário cadastrado com sucesso!" });
      setNome(""); setLogin(""); setPassword(""); setPerfil("Apontador");
      await load();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setEditNome(u.nome_completo);
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
      if (editNome.trim() && editNome !== editing.nome_completo) body.nome_completo = editNome.trim();
      if (editPerfil && editPerfil !== editing.perfil) body.perfil = editPerfil;
      if (editPassword.trim()) body.password = editPassword;
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
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Nome do funcionário" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Login (usuário) *</Label>
          <Input type="text" value={login} onChange={e => setLogin(e.target.value)} className="h-11 bg-secondary border-border" placeholder="usuario ou email@empresa.com" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Senha *</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Mínimo 6 caracteres" minLength={6} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Perfil de Acesso</Label>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrador">Administrador</SelectItem>
              <SelectItem value="Apontador">Apontador</SelectItem>
              <SelectItem value="Operador">Operador / Motorista</SelectItem>
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
                <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-foreground p-1.5"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeactivating(u)} className={isInactive ? "text-green-600 p-1.5" : "text-destructive p-1.5"}>
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
              <Input value={editing?.email || ""} disabled className="h-11 bg-muted border-border" />
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
                  <SelectItem value="Apontador">Apontador</SelectItem>
                  <SelectItem value="Operador">Operador / Motorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nova Senha (deixe vazio para manter)</Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Mínimo 6 caracteres" />
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

  const load = async () => {
    const { data } = await supabase.from("ogs_reference").select("*").order("ogs_number", { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => { load(); }, []);

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
        const { error } = await supabase.from("ogs_reference").insert({ ogs_number: numero.trim(), client_name: cliente.trim(), location_address: endereco.trim() });
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
        toast({ title: "✅ Endereço adicionado!" });
      }
      setNumero(""); setCliente(""); setEndereco("");
      await load();
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (o: any) => {
    setEditingId(o.id);
    setNumero(o.ogs_number || "");
    setCliente(o.client_name || "");
    setEndereco(o.location_address || "");
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
          {editingId ? "✏️ Editando registro — altere os campos e salve." : "Adicione endereços a uma OGS. Uma mesma OGS pode ter vários endereços."}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nº OGS</Label>
            <Input value={numero} onChange={e => setNumero(e.target.value)} className="h-11 bg-secondary border-border" placeholder="2535" />
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
        <div className="flex gap-2">
          <Button onClick={handleAdd} className="flex-1 h-11 gap-2">
            {editingId ? <><Save className="w-4 h-4" /> Salvar Alterações</> : <><Plus className="w-4 h-4" /> Adicionar Endereço</>}
          </Button>
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
  const { items, add, remove } = useCrudTable("truck_registry");
  const { toast } = useToast();
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [capacidade, setCapacidade] = useState("");

  const handleAdd = async () => {
    if (!placa.trim() || !capacidade.trim()) {
      toast({ title: "Atenção", description: "Preencha Placa e Capacidade (m³).", variant: "destructive" });
      return;
    }
    const ok = await add({ placa: placa.trim().toUpperCase(), modelo: modelo.trim() || null, cor: cor.trim() || null, fornecedor: fornecedor.trim() || null, capacidade_m3: parseFloat(capacidade) });
    if (ok) { setPlaca(""); setModelo(""); setCor(""); setFornecedor(""); setCapacidade(""); }
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
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Caminhão</Button>
      </div>
      <div className="space-y-2">
        {items.map((t: any) => (
          <div key={t.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{t.placa} — {t.capacidade_m3} m³</p>
              <div className="flex gap-2 mt-0.5 flex-wrap">
                {t.modelo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.modelo}</span>}
                {t.cor && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.cor}</span>}
                {t.fornecedor && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{t.fornecedor}</span>}
              </div>
            </div>
            <button onClick={() => remove(t.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum caminhão cadastrado.</p>}
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

function MaterialManager() {
  const { items, add, remove } = useCrudTable("materiais");
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");
  const [tipoUso, setTipoUso] = useState("Nota Fiscal");

  const handleAdd = async () => {
    if (!nome.trim()) { toast({ title: "Atenção", description: "Preencha o nome do material.", variant: "destructive" }); return; }
    const ok = await add({ nome: nome.trim(), vinculo_rdo: vinculo, tipo_uso: tipoUso });
    if (ok) { setNome(""); setVinculo("TODOS"); setTipoUso("Nota Fiscal"); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="Novo Material" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vincular ao RDO</Label>
            <Select value={vinculo} onValueChange={setVinculo}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{VINCULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de Uso</Label>
            <Select value={tipoUso} onValueChange={setTipoUso}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPO_USO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>
      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{item.nome}</p>
              <div className="flex gap-2 mt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.vinculo_rdo}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{item.tipo_uso || "Nota Fiscal"}</span>
              </div>
            </div>
            <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro.</p>}
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
        supabase.from("funcionarios" as any).select("id, nome, funcao").order("nome"),
        cid ? supabase.from("equipment_type_operators" as any).select("id, equipment_type, funcionario_id").eq("company_id", cid) : Promise.resolve({ data: [] }),
      ]);
      setFuncionarios((funcs || []) as any[]);
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
      <p className="text-sm text-muted-foreground mb-4">Configure quais funcionários aparecem como opções ao lançar o diário de cada equipamento.</p>
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
// SIDEBAR MENU ITEMS
// ═══════════════════════════════════════════════════════════════
const MENU_SECTIONS = [
  { key: "dashboard", label: "Dashboards", icon: BarChart3 },
  { key: "visao_equipamentos", label: "Visão Equipamentos", icon: Wrench },
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "permissoes", label: "Permissões", icon: Users },
  { key: "ogs", label: "OGS / Obras", icon: MapPin },
  { key: "materiais", label: "Materiais", icon: Package },
  { key: "maquinas", label: "Frota (Máquinas)", icon: Wrench },
  { key: "caminhoes", label: "Frota (Caminhões)", icon: Truck },
  { key: "funcionarios", label: "Funcionários", icon: Users },
  { key: "tipos_servico", label: "Tipos de Serviço", icon: Hammer },
  { key: "empreiteiros", label: "Empreiteiros", icon: Hammer },
  { key: "fornecedores", label: "Fornecedores", icon: Factory },
  // Usinas removidas — migradas para Fornecedores com vínculo PAVIMENTACAO
  { key: "destinos", label: "Destinos (Carreteiro)", icon: MapPin },
  { key: "emails", label: "E-mails", icon: Mail },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "destinatarios_notif", label: "Destinatários Push", icon: Target },
  { key: "desbloquear", label: "Desbloquear Lançamentos", icon: Unlock },
  { key: "lancamentos_admin", label: "Lançamentos", icon: ClipboardList },
  { key: "aeropav_staff", label: "Equipe AEROPAV", icon: Users },
  { key: "operadores_habilitados", label: "Operadores Habilitados", icon: ShieldCheck },
];

export default function AdminConfiguracoes() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();
  const [activeSection, setActiveSection] = useState("dashboard");
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
      setActiveSection(key);
      setTransitioning(false);
    }, 120);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin) { navigate("/"); return null; }

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando dashboard...</p></div>}>
            <FleetDashboard />
          </Suspense>
        );
      case "visao_equipamentos":
        return (
          <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando...</p></div>}>
            <UnifiedEquipmentView />
          </Suspense>
        );
      case "usuarios": return <UsersManager />;
      case "permissoes": return <PermissoesManager />;
      case "ogs": return <OgsManager />;
      case "materiais": return <MateriaisUnificadoManager />;
      case "maquinas": return <MaquinasManager />;
      case "caminhoes": return <TruckRegistryManager />;
      case "funcionarios": return <FuncionariosManager />;
      case "tipos_servico": return <EntityManager tableName="tipos_servico" label="Tipo de Serviço" />;
      case "empreiteiros": return <EntityManager tableName="empreiteiros" label="Empreiteiro" />;
      case "fornecedores": return <FornecedoresManager />;
      // case "usinas": removido — usinas migradas para Fornecedores
      case "destinos": return <DestinosManager />;
      case "emails": return <EmailConfig />;
      case "notificacoes": return <NotificationPrefsManager />;
      case "destinatarios_notif": return <NotificationTargetsManager />;
      case "desbloquear": return <DesbloqueioLancamentosManager />;
      case "aeropav_staff": return <AeroPavStaffManager />;
      case "operadores_habilitados": return <OperadoresHabilitadosManager />;
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
