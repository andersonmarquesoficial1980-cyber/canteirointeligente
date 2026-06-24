import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Search, X, Trash2 } from "lucide-react";
import { useFuncoes } from "@/hooks/useFuncoes";
import { useEmpresasParceiras } from "@/hooks/useEmpresasParceiras";

interface Funcionario {
  id?: string;
  matricula: string;
  name: string;
  role: string;           // nome da função (compatibilidade)
  funcao_id: string;      // FK para funcoes
  empresa_key: string;    // "FREMIX" ou id da empresa parceira
  empresa_nome: string;   // nome para exibição
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
  matricula: "", name: "", role: "", funcao_id: "", empresa_key: "FREMIX",
  empresa_nome: "FREMIX", equipe: "", responsavel: "",
  centro_custo: "", data_admissao: "", data_nascimento: "", salario: "",
  cpf: "", rg: "", telefone: "", email: "", status: "ativo", obs_geral: "",
};

const STATUS_OPTS = ["ativo", "ferias", "afastado", "demitido"];

export default function FuncionariosManager() {
  const { toast } = useToast();
  const { funcoes } = useFuncoes();
  const { empresas: empresasParceiras } = useEmpresasParceiras();
  const [items, setItems] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "new" | "edit" }>({ open: false, mode: "new" });
  const [form, setForm] = useState<Funcionario>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("user_id", user.user.id).maybeSingle();
    const cid = (profile as any)?.company_id || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    setCompanyId(cid);

    const [{ data: funcs }, { data: eqs }] = await Promise.all([
      (supabase as any).from("employees").select("*, funcoes(nome), empresas_parceiras(nome)").eq("company_id", cid).order("name"),
      // Fonte única: tabela ci_equipes do Painel de Controle
      (supabase as any).from("ci_equipes").select("nome").eq("ativa", true).order("nome"),
    ]);
    setItems(funcs || []);
    // SOMENTE equipes cadastradas no Painel de Controle (ci_equipes)
    const todasEquipes = (eqs || []).map((e: any) => e.nome);
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
    // Determinar empresa_key: se tem empresa_parceira_id → usa o id, senão "FREMIX"
    const empresaKey = f.empresa_parceira_id || "FREMIX";
    const empresaNome = f.empresa_nome ||
      (f.empresa_parceira_id ? (empresasParceiras.find(e => e.id === f.empresa_parceira_id)?.nome || "") : "FREMIX");
    setForm({
      id: f.id,
      matricula: f.matricula || "",
      name: f.name || "",
      role: f.role || "",
      funcao_id: f.funcao_id || "",
      empresa_key: empresaKey,
      empresa_nome: empresaNome,
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
    if (!form.name.trim() || !form.funcao_id) {
      toast({ title: "Nome e Função são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Resolver empresa
    const isFremix = form.empresa_key === "FREMIX";
    const empresaParceira = isFremix ? null : empresasParceiras.find(e => e.id === form.empresa_key);
    const funcaoSelecionada = funcoes.find(f => f.id === form.funcao_id);

    const payload: any = {
      matricula: form.matricula.trim() || null,
      name: form.name.trim().toUpperCase(),
      role: funcaoSelecionada?.nome || form.role.trim().toUpperCase(),  // compatibilidade
      funcao_id: form.funcao_id || null,
      origem: isFremix ? "PROPRIO" : "TERCEIRO",
      empresa_parceira_id: isFremix ? null : (form.empresa_key || null),
      empresa_nome: isFremix ? "FREMIX" : (empresaParceira?.nome || null),
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

  async function deletar(f: any) {
    if (!window.confirm(`Excluir "${f.name}" permanentemente?\n\nEssa ação não pode ser desfeita.`)) return;
    setDeleting(f.id);
    const { error } = await (supabase as any).from("employees").delete().eq("id", f.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Funcionário excluído" });
      load();
    }
    setDeleting(null);
  }

  // Campo inline — NÃO usar como componente (<F />) para evitar perda de foco
  // Renderizar diretamente como JSX via função chamada (não como componente React)
  const renderField = (label: string, field: keyof Funcionario, type = "text", placeholder = "") => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={form[field] as string}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
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
                {f.funcoes?.nome || f.role}{f.matricula ? ` · Mat. ${f.matricula}` : ""}{f.equipe ? ` · ${f.equipe}` : ""}{f.empresa_nome && f.empresa_nome !== "FREMIX" ? ` · ${f.empresa_nome}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(f)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletar(f)} disabled={deleting === f.id}>
                {deleting === f.id
                  ? <span className="w-4 h-4 inline-block animate-spin border-2 border-destructive border-t-transparent rounded-full" />
                  : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
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
                <div className="col-span-2">{renderField("Nome Completo *", "name", "text", "NOME COMPLETO")}</div>

                {/* Função — select do cadastro de funções */}
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Função *</Label>
                  <select
                    value={form.funcao_id}
                    onChange={e => set("funcao_id", e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">— Selecione a função —</option>
                    {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>

                {/* Empresa */}
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <select
                    value={form.empresa_key}
                    onChange={e => set("empresa_key", e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="FREMIX">FREMIX (Própria)</option>
                    {empresasParceiras.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>

                {renderField("Matrícula", "matricula", "text", "Opcional para PJ e terceiros")}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <select value={form.status} onChange={e => set("status", e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">Equipe</Label>
                  <select
                    value={form.equipe}
                    onChange={e => set("equipe", e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">— Selecione —</option>
                    {form.equipe && !equipes.includes(form.equipe) && (
                      <option value={form.equipe}>{form.equipe} (legado)</option>
                    )}
                    {equipes.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div className="col-span-2">{renderField("Responsável / Encarregado", "responsavel", "text", "Nome do encarregado")}</div>
                <div className="col-span-2">{renderField("Centro de Custo", "centro_custo", "text", "OPERACIONAL DE OBRAS")}</div>
                {renderField("Data de Admissão", "data_admissao", "date")}
                {renderField("Data de Nascimento", "data_nascimento", "date")}
                <div className="col-span-2">{renderField("Salário (R$)", "salario", "number", "2500.00")}</div>
              </div>
            </div>

            {/* Documentos & Contato */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documentos & Contato</p>
              <div className="grid grid-cols-2 gap-3">
                {renderField("CPF", "cpf", "text", "000.000.000-00")}
                {renderField("RG", "rg", "text", "00.000.000-0")}
                {renderField("Telefone", "telefone", "text", "(11) 99999-9999")}
                <div className="col-span-2">{renderField("E-mail", "email", "email", "email@exemplo.com")}</div>
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
