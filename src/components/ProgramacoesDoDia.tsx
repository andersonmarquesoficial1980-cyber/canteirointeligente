import { useEffect, useMemo, useState } from "react";
import { ChevronDown, HardHat, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toLocalISODate } from "@/lib/date-local";
import { textoComunicado, type DestinoEquipe } from "@/lib/programacaoComunicado";

type Programacao = {
  id: string;
  comunicado_id: string | null;
  data: string;
  equipe: string;
  status_equipe: string | null;
  local: string | null;
  periodo: string | null;
  ogs: string | null;
  cliente: string | null;
  responsavel: string | null;
  engenheiro_responsavel: string | null;
  obs: string | null;
};

function amanhaLocal(hoje: string) {
  const date = new Date(`${hoje}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return toLocalISODate(date);
}

function itemDoComunicado(p: Programacao): DestinoEquipe {
  return {
    equipe: p.equipe, situacao: p.status_equipe === "FOLGA" ? "FOLGA" : "TRABALHO",
    local: p.local || "", periodo: p.periodo || "", ogs: p.ogs || "",
    cliente: p.cliente || "", observacao: p.obs || "",
    encarregado_nome: p.responsavel || "", engenheiro_nome: p.engenheiro_responsavel || "",
  };
}

/** Um cartão por data, nunca um cartão por equipe. O comunicado original não é fragmentado. */
export default function ProgramacoesDoDia({ companyId: companyIdOverride }: { companyId?: string }) {
  const { profile } = useUserProfile();
  const companyId = companyIdOverride || profile?.company_id;
  const [progs, setProgs] = useState<Programacao[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const hoje = toLocalISODate();
  const amanha = amanhaLocal(hoje);

  useEffect(() => {
    if (!companyId) { setProgs([]); return; }
    let active = true;
    (async () => {
      const { data, error: loadError, count } = await supabase.from("ci_programacoes")
        .select("id,comunicado_id,data,equipe,status_equipe,local,periodo,ogs,cliente,responsavel,engenheiro_responsavel,obs", { count: "exact" })
        .eq("company_id", companyId).in("data", [hoje, amanha])
        .neq("status_programacao", "CANCELADO")
        .order("data").order("equipe").limit(500);
      if (!active) return;
      if (loadError || (count ?? 0) > (data?.length ?? 0)) {
        setError(loadError?.message || "Há mais equipes do que o limite de consulta."); setProgs([]);
      } else { setError(""); setProgs((data || []) as Programacao[]); }
    })();
    return () => { active = false; };
  }, [companyId, hoje, amanha]);

  const grupos = useMemo(() => [hoje, amanha].map(data => ({
    data, rows: progs.filter(p => p.data === data),
  })).filter(g => g.rows.length > 0), [progs, hoje, amanha]);

  if (!grupos.length && !error) return null;
  return <section aria-label="Programação de Obras" className="rounded-xl border border-border bg-card text-foreground p-3 sm:p-4 shadow-sm space-y-2">
    <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-2 text-left text-foreground">
      <HardHat className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 font-semibold text-sm">Programação de Obras</span>
      {grupos.map(g => <span key={g.data} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{g.data === hoje ? "Hoje" : "Amanhã"}: {g.rows.length}</span>)}
      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {error && <p role="alert" className="text-xs text-destructive">Não foi possível carregar a programação: {error}</p>}
    {open && grupos.map(group => <div key={group.data} className="border-t border-border pt-2 text-sm">
      <p className="font-semibold text-foreground mb-1">{group.data === hoje ? "Hoje" : "Amanhã"} · {group.data.split("-").reverse().join("/")} · {group.rows.length} equipe(s)</p>
      <ul className="divide-y divide-border">
        {group.rows.map(p => <li key={p.id} className="py-1.5 leading-snug">
          <span className="font-medium text-foreground">{p.equipe}</span>
          <span className="text-muted-foreground"> · {p.status_equipe === "FOLGA" ? "Folga" : `${p.local || "Local não informado"}${p.periodo ? ` (${p.periodo})` : ""}${p.ogs ? ` · OGS ${p.ogs}` : ""}`}</span>
          {(p.responsavel || p.engenheiro_responsavel) && <span className="block text-xs text-muted-foreground">{[p.responsavel && `Enc.: ${p.responsavel}`, p.engenheiro_responsavel && `Eng.: ${p.engenheiro_responsavel}`].filter(Boolean).join(" · ")}</span>}
        </li>)}
      </ul>
      <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(textoComunicado({ id: group.data, data: group.data, created_at: "", itens: group.rows.map(itemDoComunicado) }))}`} target="_blank" rel="noopener noreferrer"><Share2 className="h-3.5 w-3.5" />Compartilhar programação do dia</a>
    </div>)}
  </section>;
}
