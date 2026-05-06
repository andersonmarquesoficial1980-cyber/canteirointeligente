import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, ChevronDown, ChevronUp, Shield, Users } from "lucide-react";

import logoCi from "@/assets/logo-workflux.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Company {
  id: string;
  name: string;
  created_at: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  nome_completo: string;
  perfil: string;
  email: string;
  role: string | null;
  status: string;
  updated_at: string | null;
}

interface CompanyModule {
  id: string;
  company_id: string;
  modulo: string;
  ativo: boolean;
}

// Todos os módulos disponíveis no sistema
const ALL_MODULES = [
  { key: "admin", label: "Painel de Controle", emoji: "⚙️" },
  { key: "equipamentos", label: "Equipamentos", emoji: "🚜" },
  { key: "obras", label: "Obras / RDO", emoji: "🏗️" },
  { key: "programador", label: "Programador", emoji: "📅" },
  { key: "relatorios", label: "Relatórios", emoji: "📊" },
  { key: "demandas", label: "Demandas", emoji: "📨" },
  { key: "rh", label: "RH / VT", emoji: "👥" },
  { key: "carreteiros", label: "Carreteiros", emoji: "🚛" },
  { key: "documentos", label: "Documentos", emoji: "📄" },
];

type PerfilNovoUsuario = "Operador" | "Apontador" | "Administrador" | "Motorista";

interface NovoUsuarioForm {
  nomeCompleto: string;
  login: string;
  perfil: PerfilNovoUsuario;
}

const DEFAULT_NOVO_USUARIO_FORM: NovoUsuarioForm = {
  nomeCompleto: "",
  login: "",
  perfil: "Operador",
};

function formatLastAccess(raw: string | null): string {
  if (!raw) return "Não disponível";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Não disponível";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Record<string, boolean>>({});
  const [expandedNewUserForm, setExpandedNewUserForm] = useState<Record<string, boolean>>({});
  const [updatingModuleKey, setUpdatingModuleKey] = useState<string | null>(null);
  const [creatingUserCompanyId, setCreatingUserCompanyId] = useState<string | null>(null);
  const [newUserForms, setNewUserForms] = useState<Record<string, NovoUsuarioForm>>({});

  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);

  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalActiveModules, setTotalActiveModules] = useState(0);

  const loadData = async () => {
    const [
      companiesResult,
      profilesResult,
      companyModulesResult,
      companiesCountResult,
      usersCountResult,
      activeModulesCountResult,
    ] = await Promise.all([
      supabase.from("companies").select("id, name, created_at").order("name"),
      supabase
        .from("profiles")
        .select("id, user_id, company_id, nome_completo, perfil, email, role, status, updated_at")
        .order("nome_completo"),
      (supabase as any)
        .from("company_modules")
        .select("id, company_id, modulo, ativo")
        .order("modulo"),
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or("email.like.%@workflux.app,email.not.like.%workflux%"),
      (supabase as any)
        .from("company_modules")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true),
    ]);

    if (companiesResult.error || profilesResult.error || companyModulesResult.error) {
      toast({
        title: "Erro ao carregar painel",
        description:
          companiesResult.error?.message || profilesResult.error?.message || companyModulesResult.error?.message,
        variant: "destructive",
      });
      return;
    }

    setCompanies((companiesResult.data ?? []) as Company[]);
    setProfiles((profilesResult.data ?? []) as Profile[]);
    setCompanyModules((companyModulesResult.data ?? []) as CompanyModule[]);

    setTotalCompanies(companiesCountResult.count ?? 0);
    setTotalUsers(usersCountResult.count ?? 0);
    setTotalActiveModules(activeModulesCountResult.count ?? 0);
  };

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !profile || profile.role !== "superadmin") {
        navigate("/", { replace: true });
        return;
      }

      setAuthorized(true);
      await loadData();
      setLoading(false);
    };

    checkAccessAndLoad();
  }, [navigate]);

  const companiesOverview = useMemo(() => {
    return companies.map((company) => {
      const users = profiles.filter((p) => p.company_id === company.id);
      const modules = companyModules.filter((m) => m.company_id === company.id);
      const activeModules = modules.filter((m) => m.ativo);

      const isActive = users.some((u) => u.status === "ativo") || activeModules.length > 0;

      return {
        ...company,
        users,
        modules,
        activeModules,
        status: isActive ? "ativo" : "inativo",
      };
    });
  }, [companies, profiles, companyModules]);

  const toggleDetails = (companyId: string) => {
    setExpandedCompanyIds((prev) => ({ ...prev, [companyId]: !prev[companyId] }));
  };

  const handleToggleModuleByKey = async (companyId: string, moduloKey: string, currentModule: CompanyModule | null) => {
    const key = `${companyId}:${moduloKey}`;
    setUpdatingModuleKey(key);

    let error;
    if (!currentModule) {
      // Criar novo registro habilitado
      const { error: e } = await (supabase as any)
        .from("company_modules")
        .insert({ company_id: companyId, modulo: moduloKey, ativo: true });
      error = e;
    } else {
      const { error: e } = await (supabase as any)
        .from("company_modules")
        .update({ ativo: !currentModule.ativo })
        .eq("id", currentModule.id);
      error = e;
    }

    if (!error) await loadData();
    setUpdatingModuleKey(null);
    if (!error) toast({ title: currentModule ? `${moduloKey} ${currentModule.ativo ? "desativado" : "ativado"}` : `${moduloKey} habilitado` });
    else toast({ title: "Erro", description: error.message, variant: "destructive" });
  };

  // Mantém compatibilidade com código legado
  const handleToggleModule = async (module: CompanyModule) => {
    const key = `${module.company_id}:${module.modulo}`;
    setUpdatingModuleKey(key);

    const { error } = await (supabase as any)
      .from("company_modules")
      .update({ ativo: !module.ativo })
      .eq("id", module.id);

    if (error) {
      toast({
        title: "Erro ao atualizar módulo",
        description: error.message,
        variant: "destructive",
      });
      setUpdatingModuleKey(null);
      return;
    }

    setCompanyModules((prev) => prev.map((m) => (m.id === module.id ? { ...m, ativo: !m.ativo } : m)));
    setTotalActiveModules((prev) => (module.ativo ? Math.max(0, prev - 1) : prev + 1));

    toast({
      title: "Módulo atualizado",
      description: `${module.modulo} ${module.ativo ? "desativado" : "ativado"} com sucesso.`,
    });

    setUpdatingModuleKey(null);
  };

  const getNewUserForm = (companyId: string): NovoUsuarioForm => {
    return newUserForms[companyId] ?? DEFAULT_NOVO_USUARIO_FORM;
  };

  const handleChangeNewUserField = (
    companyId: string,
    field: keyof NovoUsuarioForm,
    value: string
  ) => {
    setNewUserForms((prev) => ({
      ...prev,
      [companyId]: {
        ...getNewUserForm(companyId),
        [field]: value,
      },
    }));
  };

  const handleResetPassword = async (user: Profile) => {
    const newPassword = window.prompt(`Nova senha para ${user.nome_completo} (mínimo 6 caracteres):`, "");
    if (newPassword === null) return;

    const password = newPassword.trim();
    if (password.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.functions.invoke("admin-reset-password", {
      body: {
        user_id: user.user_id,
        new_password: password,
      },
    });

    if (error) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Senha redefinida",
      description: `${user.nome_completo} deverá trocar a senha no próximo acesso.`,
    });
  };

  const handleCreateUser = async (companyId: string) => {
    const form = getNewUserForm(companyId);
    const nomeCompleto = form.nomeCompleto.trim();
    const login = form.login.trim().toLowerCase();

    if (!nomeCompleto || !login) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome completo e login.",
        variant: "destructive",
      });
      return;
    }

    if (login.includes("@")) {
      toast({
        title: "Login inválido",
        description: "Informe apenas o login, sem @workflux.app.",
        variant: "destructive",
      });
      return;
    }

    setCreatingUserCompanyId(companyId);
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: `${login}@workflux.app`,
        nome_completo: nomeCompleto,
        perfil: form.perfil,
        company_id: companyId,
      },
    });
    setCreatingUserCompanyId(null);

    if (error) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Usuário criado",
      description: "Senha inicial: Workflux@2026",
    });

    setNewUserForms((prev) => ({ ...prev, [companyId]: DEFAULT_NOVO_USUARIO_FORM }));
    setExpandedNewUserForm((prev) => ({ ...prev, [companyId]: false }));
    await loadData();
  };

  if (!authorized && loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-300">Carregando painel super admin...</p>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-blue-900/50 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 px-4 py-3 shadow-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
          <img src={logoCi} alt="Workflux" className="h-11 w-11 rounded-full border border-blue-300/30" />
          <div className="flex-1">
            <h1 className="text-lg font-display font-extrabold tracking-tight text-blue-100">Painel Super Admin</h1>
            <p className="text-xs text-blue-200/70">Gestão de empresas clientes do Workflux</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/")}
            className="border-blue-300/30 bg-blue-900/20 text-blue-100 hover:bg-blue-900/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-800/40 bg-slate-900/70">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2 text-blue-200">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">Total de Empresas</span>
              </div>
              <p className="text-3xl font-bold text-white">{totalCompanies}</p>
            </CardContent>
          </Card>

          <Card className="border-blue-800/40 bg-slate-900/70">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2 text-blue-200">
                <Users className="h-4 w-4" />
                <span className="text-sm">Total de Usuários</span>
              </div>
              <p className="text-3xl font-bold text-white">{totalUsers}</p>
            </CardContent>
          </Card>

          <Card className="border-blue-800/40 bg-slate-900/70">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2 text-blue-200">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Total de Módulos Ativos</span>
              </div>
              <p className="text-3xl font-bold text-white">{totalActiveModules}</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          {companiesOverview.length === 0 && (
            <Card className="border-blue-800/40 bg-slate-900/70">
              <CardContent className="p-6 text-sm text-slate-300">Nenhuma empresa encontrada.</CardContent>
            </Card>
          )}

          {companiesOverview.map((company) => {
            const isExpanded = expandedCompanyIds[company.id] === true;

            return (
              <Card key={company.id} className="border-blue-800/40 bg-slate-900/70">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-white">{company.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <Badge className="bg-blue-600/25 text-blue-100 border-blue-500/40">
                          {company.users.length} usuário{company.users.length === 1 ? "" : "s"}
                        </Badge>
                        <Badge className="bg-slate-800 border-slate-700 text-slate-200">
                          {company.activeModules.length > 0
                            ? company.activeModules.map((m) => m.modulo).join(" • ")
                            : "Sem módulos ativos"}
                        </Badge>
                        <Badge
                          className={
                            company.status === "ativo"
                              ? "bg-emerald-700/30 text-emerald-100 border-emerald-600/50"
                              : "bg-rose-700/30 text-rose-100 border-rose-600/50"
                          }
                        >
                          {company.status}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleDetails(company.id)}
                      className="border-blue-300/30 bg-blue-900/20 text-blue-100 hover:bg-blue-900/40"
                    >
                      Ver Detalhes
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-5 space-y-5 border-t border-blue-900/40 pt-5">
                      <div>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-200">Usuários</h3>
                        {company.users.length === 0 ? (
                          <p className="text-sm text-slate-400">Nenhum usuário vinculado.</p>
                        ) : (
                          <div className="space-y-2">
                            {company.users.map((user) => (
                              <div
                                key={user.id}
                                className="flex flex-col gap-2 rounded-lg border border-slate-700/60 bg-slate-900/80 p-3 md:flex-row md:items-center md:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-slate-100">{user.nome_completo}</p>
                                  <p className="text-xs text-slate-400">
                                    {user.email} • {user.perfil || "Sem perfil"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-xs text-slate-400">
                                    Último acesso: {formatLastAccess(user.updated_at)}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 border-amber-500/40 bg-amber-500/10 px-2 text-xs text-amber-100 hover:bg-amber-500/20"
                                    onClick={() => handleResetPassword(user)}
                                  >
                                    🔑 Redefinir
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-700/60 bg-slate-900/80 p-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setExpandedNewUserForm((prev) => ({ ...prev, [company.id]: !prev[company.id] }))
                          }
                          className="border-blue-300/30 bg-blue-900/20 text-blue-100 hover:bg-blue-900/40"
                        >
                          ➕ Novo Usuário
                          {expandedNewUserForm[company.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>

                        {expandedNewUserForm[company.id] && (
                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <Input
                              placeholder="Nome completo"
                              value={getNewUserForm(company.id).nomeCompleto}
                              onChange={(e) => handleChangeNewUserField(company.id, "nomeCompleto", e.target.value)}
                              className="md:col-span-2 border-slate-600 bg-slate-800 text-slate-100"
                            />
                            <Input
                              placeholder="login"
                              value={getNewUserForm(company.id).login}
                              onChange={(e) => handleChangeNewUserField(company.id, "login", e.target.value)}
                              className="border-slate-600 bg-slate-800 text-slate-100"
                            />
                            <select
                              value={getNewUserForm(company.id).perfil}
                              onChange={(e) => handleChangeNewUserField(company.id, "perfil", e.target.value)}
                              className="h-10 rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-100"
                            >
                              <option value="Operador">Operador</option>
                              <option value="Apontador">Apontador</option>
                              <option value="Administrador">Administrador</option>
                              <option value="Motorista">Motorista</option>
                            </select>
                            <div className="md:col-span-4 flex items-center justify-between">
                              <p className="text-xs text-slate-400">E-mail final: {getNewUserForm(company.id).login || "login"}@workflux.app</p>
                              <Button
                                type="button"
                                disabled={creatingUserCompanyId === company.id}
                                onClick={() => handleCreateUser(company.id)}
                                className="bg-emerald-600 text-white hover:bg-emerald-500"
                              >
                                {creatingUserCompanyId === company.id ? "Criando..." : "Criar Usuário"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-200">
                          Módulos &nbsp;
                          <span className="text-blue-400 font-normal normal-case">
                            ({company.modules.filter(m => m.ativo).length} ativos)
                          </span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {ALL_MODULES.map((mod) => {
                            const current = company.modules.find(m => m.modulo === mod.key) || null;
                            const isAtivo = current?.ativo ?? false;
                            const disabled = updatingModuleKey === `${company.id}:${mod.key}`;
                            return (
                              <button
                                key={mod.key}
                                disabled={disabled}
                                onClick={() => handleToggleModuleByKey(company.id, mod.key, current)}
                                className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                                  isAtivo
                                    ? "border-blue-500/60 bg-blue-950/60 text-blue-100"
                                    : "border-slate-700/40 bg-slate-900/40 text-slate-400 opacity-60 hover:opacity-80"
                                } ${disabled ? "cursor-wait" : "cursor-pointer hover:border-blue-400/60"}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{mod.emoji}</span>
                                  <div>
                                    <p className="text-xs font-semibold leading-tight">{mod.label}</p>
                                    <p className="text-[10px] mt-0.5 opacity-70">{isAtivo ? "Ativo" : "Inativo"}</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={isAtivo}
                                  disabled={disabled}
                                  className="pointer-events-none scale-75"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      </main>
    </div>
  );
}
