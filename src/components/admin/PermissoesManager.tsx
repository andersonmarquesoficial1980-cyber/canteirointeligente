import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, UserCog, UserPlus, Search, ChevronDown, ChevronUp, Shield, ShieldCheck } from "lucide-react";

interface Usuario {
  id: string;
  email: string;
  nome: string;
}

interface Perms {
  user_id: string;
  is_admin: boolean;
  modulo_obras: boolean;
  modulo_equipamentos: boolean;
  modulo_rh: boolean;
  modulo_carreteiros: boolean;
  modulo_programador: boolean;
  modulo_demandas: boolean;
  modulo_manutencao: boolean;
  modulo_abastecimento: boolean;
  modulo_documentos: boolean;
  modulo_relatorios: boolean;
  modulo_dashboard: boolean;
  modulo_gestao_frotas: boolean;
  modulo_gestao_pessoas: boolean;
  modulo_suprimentos: boolean;
  modulo_medicoes: boolean;
  modulo_sst: boolean;
  modulo_engenharia: boolean;
  modulo_encarregado: boolean;
  equipamentos_permitidos: string[];
  relatorios_permitidos: string[] | null;
}

const TIPOS_RELATORIO_PERM = [
  { id: "equipamento", label: "🚜 Equipamentos" },
  { id: "rdo", label: "🏗️ Diários de Obra (RDO)" },
  { id: "abastecimento", label: "⛽ Abastecimento" },
  { id: "manutencao", label: "🔧 Manutenção" },
  { id: "transportes", label: "🚛 Transportes (Carreta)" },
  { id: "carreteiros", label: "📋 Carreteiros (Fechamento)" },
  { id: "checklist", label: "✔️ Checklist Pré-Operação" },
  { id: "funcionario", label: "👷 Localização de Funcionário" },
  { id: "equipamentos_rdo", label: "🚜 Localização de Equipamentos (RDO)" },
  { id: "notas_fiscais", label: "📄 Notas Fiscais de Massa" },
  { id: "producao_infra", label: "🏗️ Produção de Infra (RDO)" },
  { id: "producao_pavimentacao", label: "🛣️ Produção de Pavimentação (RDO)" },
  { id: "controle_lancamentos", label: "📊 Controle de Lançamentos" },
];

const TIPOS_EQUIPAMENTO = [
  "Fresadora", "Bobcat", "Rolo", "Vibroacabadora", "Usina KMA",
  "Caminhões", "Comboio", "Veículo", "Retro", "Carreta",
];

const MODULOS = [
  { key: "modulo_obras", label: "WF Obras" },
  { key: "modulo_equipamentos", label: "WF Equipamentos" },
  { key: "modulo_rh", label: "WF RH" },
  { key: "modulo_carreteiros", label: "WF Carreteiros" },
  { key: "modulo_programador", label: "WF Programador" },
  { key: "modulo_demandas", label: "WF Transporte & Logística" },
  { key: "modulo_manutencao", label: "WF Manutenção" },
  { key: "modulo_abastecimento", label: "WF Abastecimento" },
  { key: "modulo_documentos", label: "WF Documentos" },
  { key: "modulo_relatorios", label: "WF Relatórios" },
  { key: "modulo_gestao_frotas", label: "WF Gestão de Frotas" },
  { key: "modulo_gestao_pessoas", label: "WF Gestão de Pessoas" },
  { key: "modulo_suprimentos", label: "WF Suprimentos" },
  { key: "modulo_medicoes", label: "WF Medições" },
  { key: "modulo_sst", label: "WF Segurança do Trabalho" },
  { key: "modulo_engenharia", label: "WF Engenharia" },
  { key: "modulo_encarregado", label: "WF Encarregado" },
  { key: "modulo_dashboard", label: "WF Dashboard" },
  { key: "is_admin", label: "Painel de Controle" },
];

function emptyPerms(userId: string): Perms {
  return {
    user_id: userId, is_admin: false,
    modulo_obras: false, modulo_equipamentos: false, modulo_rh: false,
    modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false,
    modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false,
    modulo_relatorios: false, modulo_dashboard: false,
    modulo_gestao_frotas: false, modulo_gestao_pessoas: false,
    modulo_suprimentos: false, modulo_medicoes: false,
    modulo_sst: false, modulo_engenharia: false, modulo_encarregado: false,
    equipamentos_permitidos: [],
    relatorios_permitidos: null,
  };
}

export default function PermissoesManager() {
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permsMap, setPermsMap] = useState<Record<string, Perms>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvoOk, setSalvoOk] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalConvite, setModalConvite] = useState(false);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [buscaFunc, setBuscaFunc] = useState("");
  const [funcSelecionado, setFuncSelecionado] = useState<any>(null);
  const [conviteEmail, setConviteEmail] = useState("");
  const [conviteSenha, setConviteSenha] = useState("");
  const [convitePerms, setConvitePerms] = useState<Record<string, boolean>>({});
  const [criando, setCriando] = useState(false);
  const [conviteErro, setConviteErro] = useState("");

  useEffect(() => {
    buscarDados();
    // Carregar funcionários para o convite
    supabase.from("employees").select("id, name, role").order("name")
      .then(({ data }) => setFuncionarios(data || []));
  }, []);

  async function criarConvite() {
    if (!funcSelecionado || !conviteEmail || !conviteSenha) {
      setConviteErro("Preencha todos os campos."); return;
    }
    setCriando(true);
    setConviteErro("");
    try {
      // Criar usuário via Edge Function
      const { data: result, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: conviteEmail.trim().toLowerCase(),
          password: conviteSenha,
          nome_completo: funcSelecionado.name,
          perfil: funcSelecionado.role || "Operador",
        },
      });
      const errMsg = result?.error || error?.message;
      if (errMsg) throw new Error(errMsg);

      // Buscar o user_id criado
      const { data: profile } = await supabase
        .from("profiles").select("user_id").eq("email", conviteEmail.trim().toLowerCase()).single();

      if (profile?.user_id) {
        // Salvar permissões
        const permsObj: any = { user_id: profile.user_id, is_admin: false, updated_at: new Date().toISOString() };
        MODULOS.forEach(m => { permsObj[m.key] = convitePerms[m.key] || false; });
        await supabase.from("user_permissions").upsert(permsObj, { onConflict: "user_id" });
      }

      setModalConvite(false);
      setFuncSelecionado(null);
      setConviteEmail("");
      setConviteSenha("");
      setConvitePerms({});
      setBuscaFunc("");
      buscarDados();
    } catch (e: any) {
      setConviteErro(e.message || "Erro ao criar usuário");
    } finally { setCriando(false); }
  }

  async function buscarDados() {
    setLoading(true);
    const [{ data: profiles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("user_id, email, nome_completo, role").order("nome_completo"),
      supabase.from("user_permissions").select("*"),
    ]);

    const users: Usuario[] = (profiles || []).map((p: any) => ({
      id: p.user_id, email: p.email || "", nome: p.nome_completo || p.email || p.user_id,
    }));
    setUsuarios(users);

    const map: Record<string, Perms> = {};
    (perms || []).forEach((p: any) => { map[p.user_id] = p; });
    setPermsMap(map);
    setLoading(false);
  }

  async function salvar(userId: string) {
    setSalvando(userId);
    try {
      const perms = permsMap[userId] || emptyPerms(userId);
      // Separar equipamentos_permitidos (array) do resto para evitar conflito de tipo
      const { equipamentos_permitidos, relatorios_permitidos, ...permsBase } = perms as any;
      const payload = {
        ...permsBase,
        user_id: userId,
        equipamentos_permitidos: equipamentos_permitidos ?? [],
        relatorios_permitidos: relatorios_permitidos ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("user_permissions")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      setSalvoOk(userId);
      setTimeout(() => setSalvoOk(null), 2000);
    } catch (err: any) {
      toast({ title: "Erro ao salvar permissões", description: err.message, variant: "destructive" });
    } finally {
      setSalvando(null);
    }
  }

  function toggle(userId: string, field: keyof Perms) {
    setPermsMap(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || emptyPerms(userId)), [field]: !((prev[userId] || emptyPerms(userId))[field]) },
    }));
  }

  function marcarTodos(userId: string, valor: boolean) {
    const perms = permsMap[userId] || emptyPerms(userId);
    const updated = { ...perms };
    MODULOS.forEach(m => { (updated as any)[m.key] = valor; });
    setPermsMap(prev => ({ ...prev, [userId]: updated }));
  }

  const usuariosFiltrados = useMemo(() => {
    if (!busca.trim()) return usuarios;
    const q = busca.toLowerCase();
    return usuarios.filter(u =>
      u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-base">Permissões de Usuários</h2>
        </div>
        <Button size="sm" onClick={() => setModalConvite(true)} className="gap-1.5 h-8 text-xs">
          <UserPlus className="w-3.5 h-3.5" /> Convidar Funcionário
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9 h-11 rounded-xl bg-secondary border-border"
        />
        {busca && (
          <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">
            ✕
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        {usuariosFiltrados.length} usuário{usuariosFiltrados.length !== 1 ? "s" : ""}{busca ? " encontrado" + (usuariosFiltrados.length !== 1 ? "s" : "") : ""} — clique para expandir e editar
      </p>

      {usuarios.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-6">Nenhum usuário cadastrado.</p>
      )}

      {/* Modal Convidar Funcionário */}
      <Dialog open={modalConvite} onOpenChange={setModalConvite}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display font-bold">Convidar Funcionário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Buscar funcionário */}
            <div className="space-y-1.5">
              <span className="rdo-label">Funcionário *</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome..."
                  value={buscaFunc}
                  onChange={e => { setBuscaFunc(e.target.value); setFuncSelecionado(null); }}
                  className="pl-9 h-11 rounded-xl"
                />
              </div>
              {buscaFunc.length >= 2 && !funcSelecionado && (
                <div className="border border-border rounded-xl max-h-40 overflow-y-auto">
                  {funcionarios
                    .filter(f => f.name.toLowerCase().includes(buscaFunc.toLowerCase()))
                    .slice(0, 10)
                    .map(f => (
                      <button key={f.id} onClick={() => { setFuncSelecionado(f); setBuscaFunc(f.name); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border/50 last:border-0">
                        <p className="font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.role}</p>
                      </button>
                    ))}
                </div>
              )}
              {funcSelecionado && (
                <div className="bg-primary/10 rounded-xl px-3 py-2 text-sm">
                  <p className="font-bold text-primary">{funcSelecionado.name}</p>
                  <p className="text-xs text-muted-foreground">{funcSelecionado.role}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">E-mail de acesso *</span>
              <Input value={conviteEmail} onChange={e => setConviteEmail(e.target.value)} placeholder="email@empresa.com" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Senha *</span>
              <Input type="password" value={conviteSenha} onChange={e => setConviteSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="rdo-label">Módulos de acesso</span>
                <div className="flex gap-2">
                  <button onClick={() => { const p: any = {}; MODULOS.forEach(m => p[m.key] = true); setConvitePerms(p); }} className="text-xs text-primary underline">Todos</button>
                  <button onClick={() => setConvitePerms({})} className="text-xs text-muted-foreground underline">Nenhum</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULOS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer bg-secondary/50 rounded-lg px-2 py-1.5">
                    <input type="checkbox" checked={convitePerms[m.key] || false}
                      onChange={e => setConvitePerms(p => ({ ...p, [m.key]: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-primary" />
                    <span className="text-xs">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {conviteErro && <p className="text-sm text-red-600">{conviteErro}</p>}

            <Button onClick={criarConvite} disabled={criando || !funcSelecionado || !conviteEmail || !conviteSenha}
              className="w-full h-11 rounded-xl font-display font-bold gap-2">
              {criando ? <><Loader2 className="w-4 h-4 animate-spin" />Criando...</> : <><UserPlus className="w-4 h-4" />Criar Acesso</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {usuariosFiltrados.map(u => {
        const perms = permsMap[u.id] || emptyPerms(u.id);
        const isSalvando = salvando === u.id;
        const isSalvo = salvoOk === u.id;
        const isAberto = expandido === u.id;
        const modulosAtivos = MODULOS.filter(m => (perms as any)[m.key]).length;

        return (
          <div key={u.id} className={`border rounded-2xl overflow-hidden transition-all ${isAberto ? "border-primary/30 shadow-sm" : "border-border"}`}>
            {/* Cabeçalho clicável */}
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              onClick={() => setExpandido(isAberto ? null : u.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  perms.is_admin ? "bg-primary/15" : "bg-muted"
                }`}>
                  {perms.is_admin
                    ? <ShieldCheck className="w-4 h-4 text-primary" />
                    : <Shield className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm truncate">{u.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {perms.is_admin ? "Administrador" : `${modulosAtivos} módulo${modulosAtivos !== 1 ? "s" : ""} ativo${modulosAtivos !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isSalvo && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Salvo!</span>}
                {isAberto
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Painel expandido */}
            {isAberto && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">

                {/* Admin toggle */}
                <label className="flex items-center gap-2 cursor-pointer bg-primary/5 rounded-xl px-3 py-2.5 mt-2">
                  <input
                    type="checkbox"
                    checked={perms.is_admin}
                    onChange={() => toggle(u.id, "is_admin")}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-bold text-primary">Administrador (acesso total)</span>
                </label>

                {!perms.is_admin && (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => marcarTodos(u.id, true)} className="text-xs text-primary underline">Marcar todos</button>
                      <span className="text-xs text-muted-foreground">·</span>
                      <button onClick={() => marcarTodos(u.id, false)} className="text-xs text-muted-foreground underline">Desmarcar todos</button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {MODULOS.map(m => (
                        <div key={m.key}>
                          <label className="flex items-center gap-2 cursor-pointer bg-secondary/50 rounded-xl px-3 py-2">
                            <input
                              type="checkbox"
                              checked={(perms as any)[m.key] || false}
                              onChange={() => toggle(u.id, m.key as keyof Perms)}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-xs font-medium">{m.label}</span>
                          </label>
                          {m.key === "modulo_equipamentos" && perms.modulo_equipamentos && (
                            <div className="mt-1 ml-2 space-y-1">
                              <p className="text-[10px] text-muted-foreground font-semibold pl-1">Tipos permitidos (vazio = todos):</p>
                              <div className="grid grid-cols-1 gap-0.5">
                                {TIPOS_EQUIPAMENTO.map(t => (
                                  <label key={t} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-muted/50">
                                    <input
                                      type="checkbox"
                                      checked={(perms.equipamentos_permitidos || []).includes(t)}
                                      onChange={e => {
                                        const atual = perms.equipamentos_permitidos || [];
                                        const novo = e.target.checked ? [...atual, t] : atual.filter(x => x !== t);
                                        setPermsMap(prev => ({ ...prev, [u.id]: { ...prev[u.id], equipamentos_permitidos: novo } }));
                                      }}
                                      className="w-3 h-3 accent-primary"
                                    />
                                    <span className="text-[10px]">{t}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="border-t border-border/50 pt-1 mt-1">
                                <p className="text-[10px] text-muted-foreground font-semibold pl-1 mb-0.5">Funcionalidades extras:</p>
                                <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-muted/50">
                                  <input
                                    type="checkbox"
                                    checked={(perms.equipamentos_permitidos || []).includes("ordens_transporte")}
                                    onChange={e => {
                                      const atual = perms.equipamentos_permitidos || [];
                                      const novo = e.target.checked
                                        ? [...atual, "ordens_transporte"]
                                        : atual.filter(x => x !== "ordens_transporte");
                                      setPermsMap(prev => ({ ...prev, [u.id]: { ...prev[u.id], equipamentos_permitidos: novo } }));
                                    }}
                                    className="w-3 h-3 accent-primary"
                                  />
                                  <span className="text-[10px]">🚛 Ver Ordens de Transporte</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Tipos de relatório permitidos (só aparece se WF Relatórios ativo) */}
                    {perms.modulo_relatorios && (
                      <div className="border border-border/50 rounded-xl p-3 space-y-2 mt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-foreground">📊 Tipos de Relatório Visíveis</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPermsMap(prev => ({ ...prev, [u.id]: { ...prev[u.id], relatorios_permitidos: null } }))}
                              className="text-[10px] text-primary underline"
                            >Todos</button>
                            <button
                              onClick={() => setPermsMap(prev => ({ ...prev, [u.id]: { ...prev[u.id], relatorios_permitidos: [] } }))}
                              className="text-[10px] text-muted-foreground underline"
                            >Nenhum</button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {perms.relatorios_permitidos === null ? "Acesso a todos os tipos" : `${perms.relatorios_permitidos.length} tipo${perms.relatorios_permitidos.length !== 1 ? "s" : ""} selecionado${perms.relatorios_permitidos.length !== 1 ? "s" : ""}`}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {TIPOS_RELATORIO_PERM.map(t => {
                            const todos = perms.relatorios_permitidos === null;
                            const marcado = todos || (perms.relatorios_permitidos || []).includes(t.id);
                            return (
                              <label key={t.id} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-muted/50">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={e => {
                                    const atual = perms.relatorios_permitidos === null
                                      ? TIPOS_RELATORIO_PERM.map(x => x.id)
                                      : [...(perms.relatorios_permitidos || [])];
                                    const novo = e.target.checked
                                      ? [...atual.filter(x => x !== t.id), t.id]
                                      : atual.filter(x => x !== t.id);
                                    setPermsMap(prev => ({ ...prev, [u.id]: { ...prev[u.id], relatorios_permitidos: novo } }));
                                  }}
                                  className="w-3 h-3 accent-primary"
                                />
                                <span className="text-[10px]">{t.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button
                  size="sm"
                  onClick={() => salvar(u.id)}
                  disabled={isSalvando}
                  className={`w-full h-10 rounded-xl font-bold gap-2 mt-1 ${
                    isSalvo ? "bg-green-600 hover:bg-green-600" : ""
                  }`}
                >
                  {isSalvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSalvo ? "Permissões salvas!" : "Salvar Permissões"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
