import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Phone, Save, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";

interface CandidatoForm {
  nome: string;
  funcao: string;
  idade: string;
  indicacao: string;
  telefone_1: string;
  telefone_2: string;
  status_candidatura: "triagem" | "aprovado" | "reprovado" | "teste" | "contratado" | "standby";
  data_entrevista: string;
  data_teste: string;
  resultado_teste: string;
  motivo_reprovacao: string;
  observacoes: string;
}

const EMPTY_FORM: CandidatoForm = {
  nome: "",
  funcao: "",
  idade: "",
  indicacao: "",
  telefone_1: "",
  telefone_2: "",
  status_candidatura: "triagem",
  data_entrevista: "",
  data_teste: "",
  resultado_teste: "",
  motivo_reprovacao: "",
  observacoes: "",
};

export default function FichaCandidato() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const goBack = useSmartBack("/gestao-pessoas/candidatos");
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const isNovo = id === "novo";
  const [loading, setLoading] = useState(!isNovo);
  const [salvando, setSalvando] = useState(false);
  const [candidatoId, setCandidatoId] = useState<string | null>(isNovo ? null : id || null);
  const [form, setForm] = useState<CandidatoForm>(EMPTY_FORM);

  useEffect(() => {
    if (!id || isNovo) return;

    const carregar = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("rh_candidatos")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!data) {
        toast({ title: "Candidato não encontrado", variant: "destructive" });
        navigate("/gestao-pessoas/candidatos", { replace: true });
        return;
      }

      setForm({
        nome: data.nome || "",
        funcao: data.funcao || "",
        idade: data.idade ? String(data.idade) : "",
        indicacao: data.indicacao || "",
        telefone_1: data.telefone_1 || "",
        telefone_2: data.telefone_2 || "",
        status_candidatura: data.status_candidatura || "triagem",
        data_entrevista: data.data_entrevista || "",
        data_teste: data.data_teste || "",
        resultado_teste: data.resultado_teste || "",
        motivo_reprovacao: data.motivo_reprovacao || "",
        observacoes: data.observacoes || "",
      });
      setCandidatoId(data.id);
      setLoading(false);
    };

    carregar();
  }, [id, isNovo, navigate, toast]);

  const titulo = useMemo(() => {
    if (isNovo) return "Novo Candidato";
    return form.nome || "Ficha do Candidato";
  }, [form.nome, isNovo]);

  async function salvar() {
    if (!profile?.company_id) {
      toast({ title: "Perfil sem empresa vinculada", variant: "destructive" });
      return;
    }

    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSalvando(true);

    const payload = {
      company_id: profile.company_id,
      nome: form.nome.trim().toUpperCase(),
      funcao: form.funcao.trim() || null,
      idade: form.idade.trim() ? Number(form.idade) : null,
      indicacao: form.indicacao.trim() || null,
      telefone_1: form.telefone_1.trim() || null,
      telefone_2: form.telefone_2.trim() || null,
      status_candidatura: form.status_candidatura,
      data_entrevista: form.data_entrevista || null,
      data_teste: form.data_teste || null,
      resultado_teste: form.resultado_teste.trim() || null,
      motivo_reprovacao: form.motivo_reprovacao.trim() || null,
      observacoes: form.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
      created_by: profile.user_id,
    };

    let nextId = candidatoId;
    if (!candidatoId) {
      const { data, error } = await (supabase as any)
        .from("rh_candidatos")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        toast({ title: "Erro ao criar candidato", description: error.message, variant: "destructive" });
        setSalvando(false);
        return;
      }
      nextId = data.id;
      setCandidatoId(nextId);
      toast({ title: "✅ Candidato criado" });
    } else {
      const { error } = await (supabase as any)
        .from("rh_candidatos")
        .update(payload)
        .eq("id", candidatoId)
        .eq("company_id", profile.company_id);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        setSalvando(false);
        return;
      }
      toast({ title: "✅ Ficha atualizada" });
    }

    setSalvando(false);
    if (id === "novo" && nextId) {
      const origemQuery = origem ? `?origem=${encodeURIComponent(origem)}` : "";
      navigate(`/gestao-pessoas/candidatos/${nextId}${origemQuery}`, { replace: true });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando ficha...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-sm leading-tight truncate">{titulo}</h1>
          <p className="text-[10px] text-primary-foreground/70">WF Gestão de Pessoas · Banco de Candidatos</p>
        </div>
        <button
          onClick={salvar}
          disabled={salvando}
          className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> {salvando ? "Salvando..." : "Salvar"}
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserRound className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Dados do candidato</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nome*">
              <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} className="input" />
            </Field>
            <Field label="Função">
              <input value={form.funcao} onChange={(e) => setForm((p) => ({ ...p, funcao: e.target.value }))} className="input" />
            </Field>
            <Field label="Idade">
              <input value={form.idade} onChange={(e) => setForm((p) => ({ ...p, idade: e.target.value.replace(/[^0-9]/g, "") }))} className="input" />
            </Field>
            <Field label="Indicação">
              <input value={form.indicacao} onChange={(e) => setForm((p) => ({ ...p, indicacao: e.target.value }))} className="input" />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Contato</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Telefone principal">
              <input value={form.telefone_1} onChange={(e) => setForm((p) => ({ ...p, telefone_1: e.target.value }))} className="input" placeholder="(xx) xxxxx-xxxx" />
            </Field>
            <Field label="Telefone recado (2º número)">
              <input value={form.telefone_2} onChange={(e) => setForm((p) => ({ ...p, telefone_2: e.target.value }))} className="input" placeholder="(xx) xxxxx-xxxx" />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Processo seletivo</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <Field label="Status da candidatura">
              <select
                value={form.status_candidatura}
                onChange={(e) => setForm((p) => ({ ...p, status_candidatura: e.target.value as any }))}
                className="input"
              >
                <option value="triagem">Triagem</option>
                <option value="teste">Em teste</option>
                <option value="aprovado">Aprovado</option>
                <option value="reprovado">Reprovado</option>
                <option value="standby">Stand-by</option>
                <option value="contratado">Contratado</option>
              </select>
            </Field>
            <Field label="Data da entrevista">
              <input type="date" value={form.data_entrevista} onChange={(e) => setForm((p) => ({ ...p, data_entrevista: e.target.value }))} className="input" />
            </Field>
            <Field label="Data do teste">
              <input type="date" value={form.data_teste} onChange={(e) => setForm((p) => ({ ...p, data_teste: e.target.value }))} className="input" />
            </Field>
            <Field label="Resultado do teste">
              <input value={form.resultado_teste} onChange={(e) => setForm((p) => ({ ...p, resultado_teste: e.target.value }))} className="input" placeholder="Ex.: Apto, Inapto, Pendente" />
            </Field>
          </div>

          <Field label="Motivo da reprovação / observação específica">
            <textarea
              value={form.motivo_reprovacao}
              onChange={(e) => setForm((p) => ({ ...p, motivo_reprovacao: e.target.value }))}
              className="input min-h-[88px]"
              placeholder="Ex.: Não apresentou experiência em vibroacabadora..."
            />
          </Field>

          <Field label="Observações gerais (histórico, disponibilidade, salário, etc.)">
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              className="input min-h-[120px]"
              placeholder="Use este campo para detalhes gerais do candidato"
            />
          </Field>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          min-height: 40px;
          border: 1px solid hsl(var(--border));
          border-radius: 10px;
          background: hsl(var(--background));
          padding: 8px 10px;
          font-size: 13px;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
