import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Search, X } from "lucide-react";

interface Funcionario {
  id?: string;
  matricula: string;
  name: string;
  role: string;
  equipe: string;
  responsavel: string;
  centro_custo: string;
  data_admissao: string;
  data_nascimento: string;
  salario: string;
  cpf: string;
  rg: string;
  telefone: string;
  email: string;
  status: string;
  obs_geral: string;
  company_id?: string;
}

const EMPTY: Funcionario = {
  matricula: "", name: "", role: "", equipe: "", responsavel: "",
  centro_custo: "", data_admissao: "", data_nascimento: "", salario: "",
  cpf: "", rg: "", telefone: "", email: "", status: "ativo", obs_geral: "",
};

const STATUS_OPTS = ["ativo", "ferias", "afastado", "demitido"];

export default function FuncionariosManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "new" | "edit" }>({ open: false, mode: "new" });
  const [form, setForm] = useState<Funcionario>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("user_id", user.user.id).maybeSingle();
    const cid = (profile as any)?.company_id || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    setCompanyId(cid);

    const [{ data: funcs }, { data: eqs }] = await Promise.all([
      (supabase as any).from("employees").select("*").eq("company_id", cid).order("name"),
      // Buscar equipes sem filtro de company_id para garantir que carregam
      (supabase as any).from("ci_equipes").select("nome").order("nome"),
    ]);
    setItems(funcs || []);
    // Também inclui equipes que já existem nos funcionários (fallback)
    const eqsNomes = (eqs || []).map((e: any) => e.nome);
    const eqsFuncs = [...new Set((funcs || []).map((f: any) => f.equipe).filter(Boolean))] as string[];
    const todasEquipes = [...new Set([...eqsNomes, ...eqsFuncs])].sort();
    setEquipes(todasEquipes);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(f =>
      !q || f.name?.toLowerCase().includes(q) || f.role?.toLowerCase().includes(q) || f.matricula?.includes(q)
    );
  }, [items, search]);

  function openNew() {
    setForm({ ...EMPTY });
    setDialog({ open: true, mode: "new" });
  }

  function openEdit(f: any) {
    setForm({
      id: f.id,
      matricula: f.matricula || "",
      name: f.name || "",
      role: f.role || "",
      equipe: f.equipe || "",
      responsavel: f.responsavel || "",
      centro_custo: f.centro_custo || "",
      data_admissao: f.data_admissao || "",
      data_nascimento: f.data_nascimento || "",
      salario: f.salario?.toString() || "",
      cpf: f.cpf || "",
      rg: f.rg || "",
      telefone: f.telefone || "",
      email: f.email || "",
      status: f.status || "ativo",
      obs_geral: f.obs_geral || "",
      company_id: f.company_id,
    });
    setDialog({ open: true, mode: "edit" });
  }

  function set(field: keyof Funcionario, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  async function salvar() {
    if (!form.name.trim() || !form.role.trim()) {
      toast({ title: "Nome e Função são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      matricula: form.matricula.trim() || null,
      name: form.name.trim().toUpperCase(),
      role: form.role.trim().toUpperCase(),
      equipe: form.equipe.trim() || null,
      responsavel: form.responsavel.trim() || null,
      centro_custo: form.centro_custo.trim() || null,
      data_admissao: form.data_admissao || null,
      data_nascimento: form.data_nascimento || null,
      salario: form.salario ? parseFloat(form.salario) : null,
      cpf: form.cpf.trim() || null,
      rg: form.rg.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      status: form.status,
      obs_geral: form.obs_geral.trim() || null,
      origem: "PROPRIO",
    };

    let error;
    if (dialog.mode === "new") {
      payload.company_id = companyId;
      ({ error } = await (supabase as any).from("employees").insert(payload));
    } else {
      ({ error } = await (supabase as any).from("employees").update(payload).eq("id", form.id));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: dialog.mode === "new" ? "Funcionário cadastrado!" : "Funcionário atualizado!" });
      setDialog({ open: false, mode: "new" });
      load();
    }
    setSaving(false);
  }

  const F = ({ label, field, type = "text", placeholder = "" }: { label: string; field: keyof Funcionario; type?: string; placeholder?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={form[field] as string} onChange={e => set(field, e.target.value)}
        placeholder={placeholder} className="h-10 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, função ou matrícula..." className="pl-9 h-10 rounded-xl" />
        </div>
        <Button onClick={openNew} className="gap-1.5 rounded-xl shrink-0">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} funcionário(s)</p>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filtered.map(f => (
          <div key={f.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.role}{f.matricula ? ` · Mat. ${f.matricula}` : ""}{f.equipe ? ` · ${f.equipe}` : ""}
              </p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openEdit(f)}>
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={dialog.open} onOpenChange={o => setDialog(p => ({ ...p, open: o }))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "new" ? "Novo Funcionário" : "Editar Funcionário"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dados profissionais */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados Profissionais</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><F label="Nome Completo *" field="name" placeholder="NOME COMPLETO" /></div>
                <div className="col-span-2"><F label="Função *" field="role" placeholder="AJUDANTE GERAL" /></div>
                <F label="Matrícula" field="matricula" placeholder="1234" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <select value={form.status} onChange={e => set("status", e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Equipe</Label>
                  <select value={form.equipe} onChange={e => set("equipe", e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm">
                    <option value="">— Selecione —</option>
                    {/* Garante que a equipe atual sempre aparece mesmo se não estiver na lista */}
                    {form.equipe && !equipes.includes(form.equipe) && (
                      <option value={form.equipe}>{form.equipe}</option>
                    )}
                    {equipes.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                    <option value="__digitar">+ Digitar outra equipe</option>
                  </select>
                  {form.equipe === "__digitar" && (
                    <Input autoFocus onChange={e => set("equipe", e.target.value)} placeholder="Digite o nome da equipe" className="h-10 rounded-xl mt-1" />
                  )}
                </div>
                <div className="col-span-2"><F label="Responsável / Encarregado" field="responsavel" placeholder="Nome do encarregado" /></div>
                <div className="col-span-2"><F label="Centro de Custo" field="centro_custo" placeholder="OPERACIONAL DE OBRAS" /></div>
                <F label="Data de Admissão" field="data_admissao" type="date" />
                <F label="Data de Nascimento" field="data_nascimento" type="date" />
                <div className="col-span-2"><F label="Salário (R$)" field="salario" type="number" placeholder="2500.00" /></div>
              </div>
            </div>

            {/* Documentos & Contato */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documentos & Contato</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="CPF" field="cpf" placeholder="000.000.000-00" />
                <F label="RG" field="rg" placeholder="00.000.000-0" />
                <F label="Telefone" field="telefone" placeholder="(11) 99999-9999" />
                <div className="col-span-2"><F label="E-mail" field="email" type="email" placeholder="email@exemplo.com" /></div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <textarea value={form.obs_geral} onChange={e => set("obs_geral", e.target.value)}
                rows={2} placeholder="Observações gerais..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none outline-none" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(p => ({ ...p, open: false }))}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : dialog.mode === "new" ? "Cadastrar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
