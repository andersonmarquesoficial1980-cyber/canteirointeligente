import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Candidato {
  id: string;
  nome: string;
  funcao: string | null;
  idade: number | null;
  status_candidatura: "triagem" | "aprovado" | "reprovado" | "teste" | "contratado" | "standby";
  telefone_1: string | null;
  telefone_2: string | null;
  data_teste: string | null;
  resultado_teste: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<Candidato["status_candidatura"], string> = {
  triagem: "Triagem",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  teste: "Em teste",
  contratado: "Contratado",
  standby: "Stand-by",
};

const STATUS_CLASS: Record<Candidato["status_candidatura"], string> = {
  triagem: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  aprovado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  reprovado: "bg-red-500/15 text-red-300 border-red-500/30",
  teste: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  contratado: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  standby: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

export default function GestaoPessoasCandidatos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";
  const origemQuery = origem ? `?origem=${encodeURIComponent(origem)}` : "";
  const goBack = useSmartBack(origem === "gestao-frotas" ? "/gestao-frotas" : "/gestao-pessoas");
  const { profile } = useUserProfile();

  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);

  useEffect(() => {
    if (!profile?.company_id) return;

    const carregar = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("rh_candidatos")
        .select("id,nome,funcao,idade,status_candidatura,telefone_1,telefone_2,data_teste,resultado_teste,created_at")
        .eq("company_id", profile.company_id)
        .order("nome", { ascending: true });

      setCandidatos((data || []) as Candidato[]);
      setLoading(false);
    };

    carregar();
  }, [profile?.company_id]);

  const filtrados = useMemo(() => {
    return candidatos.filter((c) => {
      const q = busca.trim().toLowerCase();
      const matchBusca =
        !q ||
        c.nome.toLowerCase().includes(q) ||
        (c.funcao || "").toLowerCase().includes(q) ||
        (c.telefone_1 || "").includes(q) ||
        (c.telefone_2 || "").includes(q);

      const matchStatus = statusFiltro === "todos" || c.status_candidatura === statusFiltro;
      return matchBusca && matchStatus;
    });
  }, [candidatos, busca, statusFiltro]);

  const stats = useMemo(() => {
    return {
      total: candidatos.length,
      triagem: candidatos.filter((c) => c.status_candidatura === "triagem").length,
      teste: candidatos.filter((c) => c.status_candidatura === "teste").length,
      aprovados: candidatos.filter((c) => c.status_candidatura === "aprovado").length,
      reprovados: candidatos.filter((c) => c.status_candidatura === "reprovado").length,
    };
  }, [candidatos]);

  const goFicha = (id: string) => {
    navigate(`/gestao-pessoas/candidatos/${id}${origemQuery}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <LogoHomeButton className="h-7 object-contain" />
        <div className="flex-1 min-w-0">
          <span className="block font-display font-bold text-sm truncate">Banco de Candidatos</span>
          <span className="block text-[10px] text-primary-foreground/70">
            {loading ? "Carregando..." : `${candidatos.length} candidatos`}
          </span>
        </div>
        <button
          onClick={() => navigate(`/gestao-pessoas/candidatos/novo${origemQuery}`)}
          className="px-2.5 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold flex items-center gap-1"
        >
          <UserPlus className="w-3.5 h-3.5" /> Novo
        </button>
      </header>

      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 8, maxWidth: 940, margin: "0 auto" }}>
          {[
            { l: "Total", v: stats.total, c: "#00C6FF" },
            { l: "Triagem", v: stats.triagem, c: "#94a3b8" },
            { l: "Em teste", v: stats.teste, c: "#f59e0b" },
            { l: "Aprovados", v: stats.aprovados, c: "#22c55e" },
            { l: "Reprovados", v: stats.reprovados, c: "#ef4444" },
          ].map((s) => (
            <div key={s.l} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px", textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: s.c, fontFamily: "Montserrat" }}>{s.v}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <div className="bg-card border border-border rounded-2xl p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, função ou telefone..."
              className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "todos", label: "Todos" },
              { key: "triagem", label: "Triagem" },
              { key: "teste", label: "Em teste" },
              { key: "aprovado", label: "Aprovados" },
              { key: "reprovado", label: "Reprovados" },
              { key: "standby", label: "Stand-by" },
              { key: "contratado", label: "Contratados" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFiltro(s.key)}
                className={`px-3 h-8 rounded-lg text-xs border transition ${
                  statusFiltro === s.key
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-10">Carregando candidatos...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Nenhum candidato encontrado.</p>
          ) : (
            filtrados.map((c, i) => (
              <button
                key={c.id}
                onClick={() => goFicha(c.id)}
                className="w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition"
                style={{ background: i % 2 === 0 ? "transparent" : "rgba(148,163,184,0.04)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
                    {c.nome?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.funcao || "Sem função"}
                      {typeof c.idade === "number" ? ` · ${c.idade} anos` : ""}
                      {c.telefone_1 ? ` · ${c.telefone_1}` : ""}
                      {c.telefone_2 ? ` / ${c.telefone_2}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_CLASS[c.status_candidatura]}`}>
                    {STATUS_LABEL[c.status_candidatura]}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
