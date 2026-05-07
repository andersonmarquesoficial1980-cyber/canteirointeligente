/**
 * FichaFuncionario — Prontuário completo do funcionário
 * Rota: /gestao-pessoas/:id
 * Abas: Cadastro | Ponto & Frequência | VT & Custos | Histórico
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Clock, Bus, FileText, Plus, Trash2,
  Calendar, Briefcase, Phone, Mail, Shield, Edit2, Check, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "@/hooks/use-toast";
import logoCi from "@/assets/logo-workflux.png";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Funcionario {
  id: string;
  name: string;
  role: string;
  matricula: string;
  equipe: string;
  responsavel: string;
  data_admissao: string;
  data_nascimento: string;
  salario: number | null;
  obs_geral: string | null;
  obs_ponto: string | null;
  cpf?: string | null;
  rg?: string | null;
  status?: string;
  telefone?: string | null;
  email?: string | null;
  foto_url?: string | null;
  company_id?: string | null;
}

interface HistoricoItem {
  id: string;
  tipo: string;
  descricao: string;
  data: string;
  criado_por?: string;
}

interface PontoResumo {
  total_registros: number;
  dias_trabalhados: number;
  faltas: number;
}

const TIPO_HISTORICO = [
  { value: "admissao", label: "Admissão", cor: "bg-green-500" },
  { value: "promocao", label: "Promoção", cor: "bg-blue-500" },
  { value: "mudanca_equipe", label: "Mudança de Equipe", cor: "bg-purple-500" },
  { value: "advertencia", label: "Advertência", cor: "bg-yellow-500" },
  { value: "afastamento", label: "Afastamento", cor: "bg-orange-500" },
  { value: "retorno", label: "Retorno", cor: "bg-teal-500" },
  { value: "ferias", label: "Férias", cor: "bg-sky-500" },
  { value: "aumento", label: "Aumento Salarial", cor: "bg-emerald-500" },
  { value: "demissao", label: "Demissão", cor: "bg-red-500" },
  { value: "outro", label: "Outro", cor: "bg-gray-500" },
];

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  ativo:      { label: "Ativo",      cor: "bg-green-500/20 text-green-400 border-green-500/30" },
  ferias:     { label: "Férias",     cor: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  afastado:   { label: "Afastado",   cor: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  demitido:   { label: "Demitido",   cor: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtBRL(v?: number | null) {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcIdade(nascimento: string) {
  if (!nascimento) return "";
  const n = new Date(nascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - n.getFullYear();
  if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) idade--;
  return `${idade} anos`;
}

function tempoEmpresa(admissao: string) {
  if (!admissao) return "";
  const adm = new Date(admissao);
  const hoje = new Date();
  let anos = hoje.getFullYear() - adm.getFullYear();
  let meses = hoje.getMonth() - adm.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""} e ${meses} mês${meses !== 1 ? "es" : ""}`;
  return `${meses} mês${meses !== 1 ? "es" : ""}`;
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function FichaFuncionario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  const [func, setFunc] = useState<Funcionario | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"cadastro" | "ponto" | "vt" | "historico">("cadastro");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<Funcionario>>({});
  const [salvando, setSalvando] = useState(false);

  // Modal novo histórico
  const [modalHistorico, setModalHistorico] = useState(false);
  const [novoEvento, setNovoEvento] = useState({ tipo: "outro", descricao: "", data: new Date().toISOString().split("T")[0] });
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  // Ponto resumo
  const [pontoResumo, setPontoResumo] = useState<PontoResumo | null>(null);

  // VT
  const [vtTotal, setVtTotal] = useState<number | null>(null);

  useEffect(() => { if (id) carregarTudo(); }, [id]);

  async function carregarTudo() {
    setLoading(true);
    try {
      const [funcResp, histResp, pontoResp] = await Promise.all([
        supabase.from("employees").select("*").eq("id", id!).maybeSingle(),
        supabase.from("employee_historico").select("*").eq("employee_id", id!).order("data", { ascending: false }),
        supabase.from("ponto_registros").select("data").eq("staff_id", id!),
      ]);

      if (funcResp.data) {
        setFunc(funcResp.data as any);
        setForm(funcResp.data as any);
      }

      if (histResp.data) setHistorico(histResp.data as any);

      // Calcular resumo de ponto
      if (pontoResp.data) {
        const diasUnicos = new Set(pontoResp.data.map((p: any) => p.data)).size;
        setPontoResumo({ total_registros: pontoResp.data.length, dias_trabalhados: diasUnicos, faltas: 0 });
      }

      // VT — buscar conduções do funcionário
      const { data: vtData } = await supabase
        .from("vt_funcionario_conducoes")
        .select("quantidade, vt_tarifas(valor)")
        .eq("funcionario_id", id!);

      if (vtData) {
        const total = vtData.reduce((s: number, c: any) => {
          const valor = c.vt_tarifas?.valor || 0;
          return s + valor * c.quantidade * 2; // ida e volta
        }, 0);
        setVtTotal(total);
      }
    } catch {}
    setLoading(false);
  }

  async function salvarEdicao() {
    if (!func) return;
    setSalvando(true);
    const { error } = await supabase.from("employees").update({
      cpf: form.cpf || null,
      rg: form.rg || null,
      status: form.status || "ativo",
      telefone: form.telefone || null,
      email: form.email || null,
      obs_geral: form.obs_geral || null,
    }).eq("id", func.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Salvo com sucesso!" });
      setFunc(prev => prev ? { ...prev, ...form } : prev);
      setEditando(false);
    }
    setSalvando(false);
  }

  async function adicionarEvento() {
    if (!novoEvento.descricao.trim() || !func) return;
    setSalvandoEvento(true);
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", (await supabase.auth.getUser()).data.user?.id!).maybeSingle();
    const { error } = await supabase.from("employee_historico").insert({
      employee_id: func.id,
      company_id: (profile as any)?.company_id,
      tipo: novoEvento.tipo,
      descricao: novoEvento.descricao,
      data: novoEvento.data,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Evento registrado!" });
      setModalHistorico(false);
      setNovoEvento({ tipo: "outro", descricao: "", data: new Date().toISOString().split("T")[0] });
      carregarTudo();
    }
    setSalvandoEvento(false);
  }

  async function removerEvento(eventoId: string) {
    if (!confirm("Remover este evento do histórico?")) return;
    await supabase.from("employee_historico").delete().eq("id", eventoId);
    setHistorico(prev => prev.filter(h => h.id !== eventoId));
    toast({ title: "Evento removido" });
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Carregando ficha...</p>
    </div>
  );

  if (!func) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Funcionário não encontrado.</p>
    </div>
  );

  const statusCfg = STATUS_CONFIG[func.status || "ativo"] || STATUS_CONFIG["ativo"];
  const tipoHistCor = (tipo: string) => TIPO_HISTORICO.find(t => t.value === tipo)?.cor || "bg-gray-500";
  const tipoHistLabel = (tipo: string) => TIPO_HISTORICO.find(t => t.value === tipo)?.label || tipo;

  const ABAS = [
    { id: "cadastro", label: "Cadastro", icon: User },
    { id: "ponto", label: "Ponto", icon: Clock },
    { id: "vt", label: "VT & Custos", icon: Bus },
    { id: "historico", label: "Histórico", icon: FileText },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/gestao-pessoas")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoCi} alt="CI" className="h-7 object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-sm leading-tight truncate">{func.name}</h1>
          <p className="text-[10px] text-primary-foreground/70">Mat. {func.matricula} · {func.role}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusCfg.cor}`}>
          {statusCfg.label}
        </span>
      </header>

      {/* Hero card */}
      <div className="bg-header-gradient/10 border-b border-border px-4 py-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            {func.foto_url
              ? <img src={func.foto_url} alt={func.name} className="w-16 h-16 rounded-2xl object-cover" />
              : <User className="w-8 h-8 text-primary" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-base truncate">{func.name}</p>
            <p className="text-sm text-muted-foreground">{func.role}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {func.equipe} · {tempoEmpresa(func.data_admissao)} de empresa
            </p>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-xl bg-background border border-border p-3 text-center">
            <p className="text-lg font-bold text-foreground">{func.matricula}</p>
            <p className="text-[10px] text-muted-foreground">Matrícula</p>
          </div>
          <div className="rounded-xl bg-background border border-border p-3 text-center">
            <p className="text-lg font-bold text-foreground">{fmtDate(func.data_admissao).slice(3)}</p>
            <p className="text-[10px] text-muted-foreground">Admissão</p>
          </div>
          <div className="rounded-xl bg-background border border-border p-3 text-center">
            <p className="text-lg font-bold text-foreground">{fmtBRL(func.salario)}</p>
            <p className="text-[10px] text-muted-foreground">Salário</p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-border bg-background sticky top-[60px] z-20 overflow-x-auto">
        {ABAS.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                aba === a.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {a.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">

        {/* ── ABA CADASTRO ─────────────────────────────────────────────────── */}
        {aba === "cadastro" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Dados Cadastrais</h2>
              {isAdmin && !editando && (
                <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              {editando && (
                <div className="flex gap-2">
                  <button onClick={() => setEditando(false)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                  <button onClick={salvarEdicao} disabled={salvando} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Check className="w-3.5 h-3.5" /> {salvando ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
              {[
                { label: "Nome Completo", value: func.name, icon: User },
                { label: "Função", value: func.role, icon: Briefcase },
                { label: "Matrícula", value: func.matricula, icon: Shield },
                { label: "Equipe", value: func.equipe || "—", icon: Briefcase },
                { label: "Responsável", value: func.responsavel || "—", icon: User },
                { label: "Centro de Custo", value: (func as any).centro_custo || "—", icon: Briefcase },
                { label: "Data de Admissão", value: fmtDate(func.data_admissao), icon: Calendar },
                { label: "Data de Nascimento", value: `${fmtDate(func.data_nascimento)} (${calcIdade(func.data_nascimento)})`, icon: Calendar },
                { label: "Salário", value: fmtBRL(func.salario), icon: Briefcase },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                  <row.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">{row.label}</p>
                    <p className="text-sm font-medium text-foreground truncate">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Campos editáveis */}
            <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/30">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Documentos & Contato</p>
              </div>
              {[
                { label: "CPF", field: "cpf" as const, icon: Shield, placeholder: "000.000.000-00" },
                { label: "RG", field: "rg" as const, icon: Shield, placeholder: "00.000.000-0" },
                { label: "Telefone", field: "telefone" as const, icon: Phone, placeholder: "(11) 99999-9999" },
                { label: "E-mail", field: "email" as const, icon: Mail, placeholder: "email@exemplo.com" },
              ].map(row => (
                <div key={row.field} className="flex items-center gap-3 px-4 py-3">
                  <row.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">{row.label}</p>
                    {editando
                      ? <input
                          value={(form[row.field] as string) || ""}
                          onChange={e => setForm(p => ({ ...p, [row.field]: e.target.value }))}
                          placeholder={row.placeholder}
                          className="w-full text-sm bg-transparent border-b border-primary/40 outline-none py-0.5 text-foreground"
                        />
                      : <p className="text-sm font-medium text-foreground">{(func as any)[row.field] || "—"}</p>
                    }
                  </div>
                </div>
              ))}

              {/* Status */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground">Status</p>
                  {editando
                    ? <select
                        value={form.status || "ativo"}
                        onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                        className="text-sm bg-background border border-border rounded-lg px-2 py-1 mt-0.5 w-full"
                      >
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    : <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.cor}`}>
                        {statusCfg.label}
                      </span>
                  }
                </div>
              </div>

              {/* Observações */}
              <div className="px-4 py-3">
                <p className="text-[10px] text-muted-foreground mb-1">Observações</p>
                {editando
                  ? <textarea
                      value={form.obs_geral || ""}
                      onChange={e => setForm(p => ({ ...p, obs_geral: e.target.value }))}
                      rows={3}
                      placeholder="Anotações gerais sobre o funcionário..."
                      className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none resize-none"
                    />
                  : <p className="text-sm text-foreground">{func.obs_geral || "—"}</p>
                }
              </div>
            </div>
          </>
        )}

        {/* ── ABA PONTO ────────────────────────────────────────────────────── */}
        {aba === "ponto" && (
          <>
            <h2 className="text-sm font-semibold">Ponto & Frequência</h2>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Dias Trabalhados", value: pontoResumo?.dias_trabalhados ?? "—", cor: "text-green-400" },
                { label: "Registros", value: pontoResumo?.total_registros ?? "—", cor: "text-blue-400" },
                { label: "Faltas", value: pontoResumo?.faltas ?? "—", cor: "text-red-400" },
              ].map(m => (
                <div key={m.label} className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className={`text-2xl font-bold ${m.cor}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {pontoResumo && pontoResumo.total_registros === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum registro de ponto encontrado.</p>
                <p className="text-xs text-muted-foreground mt-1">O módulo de ponto facial ainda não foi utilizado por este funcionário.</p>
              </div>
            ) : null}

            {func.obs_ponto && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="text-xs font-semibold text-yellow-400 mb-1">⚠️ Obs. de Ponto</p>
                <p className="text-sm text-foreground">{func.obs_ponto}</p>
              </div>
            )}
          </>
        )}

        {/* ── ABA VT & CUSTOS ──────────────────────────────────────────────── */}
        {aba === "vt" && (
          <>
            <h2 className="text-sm font-semibold">VT & Custos</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 text-center col-span-2">
                <p className="text-3xl font-bold text-primary">{vtTotal != null ? fmtBRL(vtTotal) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">Custo mensal estimado com VT</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-foreground">{fmtBRL(func.salario)}</p>
                <p className="text-[10px] text-muted-foreground">Salário Base</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-foreground">
                  {func.salario && vtTotal != null ? fmtBRL(func.salario + vtTotal) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Custo Total Est.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <Bus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Configurar conduções de VT</p>
              <button
                onClick={() => navigate("/vale-transporte")}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Abrir Gestão de VT →
              </button>
            </div>
          </>
        )}

        {/* ── ABA HISTÓRICO ─────────────────────────────────────────────────── */}
        {aba === "historico" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Histórico / Prontuário</h2>
              {isAdmin && (
                <button
                  onClick={() => setModalHistorico(true)}
                  className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo evento
                </button>
              )}
            </div>

            {historico.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
                {isAdmin && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Adicione admissão, promoções, mudanças de equipe e outros eventos.
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                {/* Linha do tempo */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4 pl-10">
                  {historico.map(h => (
                    <div key={h.id} className="relative">
                      <div className={`absolute -left-[26px] w-3 h-3 rounded-full ${tipoHistCor(h.tipo)} ring-2 ring-background`} />
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${tipoHistCor(h.tipo)}`}>
                                {tipoHistLabel(h.tipo)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{fmtDate(h.data)}</span>
                            </div>
                            <p className="text-sm text-foreground mt-1.5">{h.descricao}</p>
                          </div>
                          {isAdmin && (
                            <button onClick={() => removerEvento(h.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal novo evento histórico */}
      {modalHistorico && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-background border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base">Novo Evento</h3>
              <button onClick={() => setModalHistorico(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Tipo de evento</label>
                <select
                  value={novoEvento.tipo}
                  onChange={e => setNovoEvento(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full mt-1 text-sm bg-background border border-border rounded-xl px-3 py-2"
                >
                  {TIPO_HISTORICO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data</label>
                <input
                  type="date"
                  value={novoEvento.data}
                  onChange={e => setNovoEvento(p => ({ ...p, data: e.target.value }))}
                  className="w-full mt-1 text-sm bg-background border border-border rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descrição *</label>
                <textarea
                  value={novoEvento.descricao}
                  onChange={e => setNovoEvento(p => ({ ...p, descricao: e.target.value }))}
                  rows={3}
                  placeholder="Descreva o evento..."
                  className="w-full mt-1 text-sm bg-background border border-border rounded-xl px-3 py-2 resize-none outline-none"
                />
              </div>
            </div>

            <button
              onClick={adicionarEvento}
              disabled={salvandoEvento || !novoEvento.descricao.trim()}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm disabled:opacity-50"
            >
              {salvandoEvento ? "Salvando..." : "Registrar evento"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
