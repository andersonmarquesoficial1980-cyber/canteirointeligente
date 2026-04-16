import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, UserCog, UserPlus, Search } from "lucide-react";

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
  equipamentos_permitidos: string[];
}

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
  { key: "modulo_demandas", label: "WF Demandas" },
  { key: "modulo_manutencao", label: "WF Manutenção" },
  { key: "modulo_abastecimento", label: "WF Abastecimento" },
  { key: "modulo_documentos", label: "WF Documentos" },
  { key: "modulo_relatorios", label: "WF Relatórios" },
  { key: "modulo_dashboard", label: "Painel Admin" },
];

function emptyPerms(userId: string): Perms {
  return {
    user_id: userId, is_admin: false,
    modulo_obras: false, modulo_equipamentos: false, modulo_rh: false,
    modulo_carreteiros: false, modulo_programador: false, modulo_demandas: false,
    modulo_manutencao: false, modulo_abastecimento: false, modulo_documentos: false,
    modulo_relatorios: false, modulo_dashboard: false,
    equipamentos_permitidos: [],
  };
}

export default function PermissoesManager() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permsMap, setPermsMap] = useState<Record<string, Perms>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvoOk, setSalvoOk] = useState<string | null>(null);
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
    const perms = permsMap[userId] || emptyPerms(userId);
    await supabase.from("user_permissions").upsert({ ...perms, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSalvando(null);
    setSalvoOk(userId);
    setTimeout(() => setSalvoOk(null), 2000);
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

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary" />
          <h2 className="font-display font-bold text-base">Permissões de Usuários</h2>
        </div>
        <Button size="sm" onClick={() => setModalConvite(true)} className="gap-1.5 h-8 text-xs">
          <UserPlus className="w-3.5 h-3.5" /> Convidar Funcionário
        </Button>
      </div>

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

      {usuarios.map(u => {
        const perms = permsMap[u.id] || emptyPerms(u.id);
        const isSalvando = salvando === u.id;
        const isSalvo = salvoOk === u.id;

        return (
          <div key={u.id} className="border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-display font-bold text-sm">{u.nome}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Button
                size="sm"
                onClick={() => salvar(u.id)}
                disabled={isSalvando}
                className={`gap-1.5 h-8 text-xs ${isSalvo ? "bg-green-600 hover:bg-green-600" : ""}`}
              >
                {isSalvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {isSalvo ? "Salvo!" : "Salvar"}
              </Button>
            </div>

            {/* Admin toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-primary/5 rounded-xl px-3 py-2">
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
                      {/* Sub-seleção de tipos de equipamento */}
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
                                    const novo = e.target.checked
                                      ? [...atual, t]
                                      : atual.filter(x => x !== t);
                                    setPermsMap(prev => ({ ...prev, [u.id]: { ...prev[u.id], equipamentos_permitidos: novo } }));
                                  }}
                                  className="w-3 h-3 accent-primary"
                                />
                                <span className="text-[10px]">{t}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
