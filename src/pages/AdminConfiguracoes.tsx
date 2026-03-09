import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const VINCULO_OPTIONS = ["CAUQ", "INFRA", "CANTEIRO", "TODOS"];
const TIPO_USO_OPTIONS = ["Nota Fiscal", "Transporte", "Ambos"];
const CATEGORIAS_EQUIP = ["PEQUENO PORTE", "FRESA/BOB", "VIBRO/ROLO", "LINHA AMARELA", "USINAGEM", "VEÍCULOS EM GERAL"];

// Generic CRUD hook for simple tables
function useCrudTable(tableName: string) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(tableName as any).select("*").order("created_at", { ascending: false });
    if (!error && data) setItems(data as any[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (item: any) => {
    const { error } = await supabase.from(tableName as any).insert(item);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return false; }
    await load();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(tableName as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await load();
  };

  return { items, loading, add, remove, reload: load };
}

// Simple entity form with nome + vinculo_rdo
function EntityManager({ tableName, label }: { tableName: string; label: string }) {
  const { items, add, remove } = useCrudTable(tableName);
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");

  const handleAdd = async () => {
    if (!nome.trim()) return;
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
        {items.map((item: any) => (
          <div key={item.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{item.nome}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{item.vinculo_rdo}</span>
            </div>
            <button onClick={() => remove(item.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro.</p>}
      </div>
    </div>
  );
}

// Machines manager (includes frota, categoria, vinculo_rdo)
function MaquinasManager() {
  const { items, add, remove } = useCrudTable("maquinas_frota");
  const [frota, setFrota] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [vinculo, setVinculo] = useState("TODOS");

  const handleAdd = async () => {
    if (!frota.trim() || !nome.trim()) return;
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

// Users manager
function UsersManager() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("user_roles" as any).select("*").then(({ data }) => {
      if (data) setUsers(data as any[]);
    });
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Gerencie perfis de acesso. Use o painel do Supabase para criar novos usuários.</p>
      <div className="space-y-2">
        {users.map((u: any) => (
          <div key={u.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{u.user_id?.slice(0, 8)}...</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{u.role}</span>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum perfil cadastrado.</p>}
      </div>
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

  const load = async () => {
    const { data } = await supabase.from("ogs_reference").select("*").order("numero_ogs", { ascending: false });
    if (data) setItems(data);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!numero.trim() || !cliente.trim() || !endereco.trim()) return;
    const { error } = await supabase.from("ogs_reference").insert({ numero_ogs: numero.trim(), cliente: cliente.trim(), endereco: endereco.trim() } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEndereco("");
    toast({ title: "✅ Endereço adicionado!" });
    await load();
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("ogs_reference").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">Adicione endereços a uma OGS. Uma mesma OGS pode ter vários endereços.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nº OGS</Label>
            <Input value={numero} onChange={e => setNumero(e.target.value)} className="h-11 bg-secondary border-border" placeholder="OGS-001" />
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
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar Endereço</Button>
      </div>

      <div className="space-y-2">
        {items.map((o: any) => (
          <div key={o.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{o.numero_ogs} — {o.cliente}</p>
              <p className="text-xs text-muted-foreground">{o.endereco}</p>
            </div>
            <button onClick={() => handleDelete(o.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminConfiguracoes() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!isAdmin) { navigate("/"); return null; }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">⚙️ Gerenciamento</h1>
            <p className="text-xs text-muted-foreground">Administração Centralizada</p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4">
        <Tabs defaultValue="maquinas" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary p-1 rounded-xl">
            <TabsTrigger value="maquinas" className="text-xs flex-1 min-w-[80px]">Máquinas</TabsTrigger>
            <TabsTrigger value="tipos_servico" className="text-xs flex-1 min-w-[80px]">Serviços</TabsTrigger>
            <TabsTrigger value="materiais" className="text-xs flex-1 min-w-[80px]">Materiais</TabsTrigger>
            <TabsTrigger value="empreiteiros" className="text-xs flex-1 min-w-[80px]">Empreiteiros</TabsTrigger>
            <TabsTrigger value="fornecedores" className="text-xs flex-1 min-w-[80px]">Fornecedores</TabsTrigger>
            <TabsTrigger value="usinas" className="text-xs flex-1 min-w-[80px]">Usinas</TabsTrigger>
            <TabsTrigger value="ogs" className="text-xs flex-1 min-w-[80px]">OGS</TabsTrigger>
            <TabsTrigger value="usuarios" className="text-xs flex-1 min-w-[80px]">Usuários</TabsTrigger>
            <TabsTrigger value="emails" className="text-xs flex-1 min-w-[80px]">E-mails</TabsTrigger>
          </TabsList>

          <TabsContent value="maquinas"><MaquinasManager /></TabsContent>
          <TabsContent value="tipos_servico"><EntityManager tableName="tipos_servico" label="Tipo de Serviço" /></TabsContent>
          <TabsContent value="materiais"><EntityManager tableName="materiais" label="Material" /></TabsContent>
          <TabsContent value="empreiteiros"><EntityManager tableName="empreiteiros" label="Empreiteiro" /></TabsContent>
          <TabsContent value="fornecedores"><EntityManager tableName="fornecedores" label="Fornecedor" /></TabsContent>
          <TabsContent value="usinas"><EntityManager tableName="usinas" label="Usina" /></TabsContent>
          <TabsContent value="ogs"><OgsManager /></TabsContent>
          <TabsContent value="usuarios"><UsersManager /></TabsContent>
          <TabsContent value="emails"><EmailConfig /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
