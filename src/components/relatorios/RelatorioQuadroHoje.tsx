import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuadroProjecao } from "@/hooks/useQuadroProjecao";
import { useEquipeOgs } from "@/hooks/useEquipeOgs";
import { toLocalISODate } from "@/lib/date-local";
import { programadorEmployeesQuery } from "@/lib/programadorTeams";
import { chaveEquipe } from "@/lib/quadroEquipes";
import { useEquipesOcultas } from "@/lib/equipesOcultas";
import {
  agruparPorEquipe, dataBR, filtrarEquipesOcultas, gerarCsv, gerarHtmlPdf, montarLinhasQuadroHoje, statusComoProgramador, type PessoaHoje,
} from "@/lib/quadroHoje";

const TITULO = "Quadro de Hoje — Localização de Pessoal por Equipe";

/**
 * "Hoje" = posição atual do Quadro Pessoas do WF Programador (mesma fonte e mesma projeção:
 * cadastro + alocação temporária + férias + afastados). Não lê RDO.
 */
export default function RelatorioQuadroHoje({ companyId }: { companyId: string }) {
  const hoje = useMemo(() => toLocalISODate(), []);
  const [pessoas, setPessoas] = useState<PessoaHoje[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]); // chaves; vazio = todas
  const [busca, setBusca] = useState("");
  const [ultimaMovHistorico, setUltimaMovHistorico] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true); setErro("");
      const { data, error, count } = await programadorEmployeesQuery(supabase, companyId);
      if (!vivo) return;
      if (error) { setErro(error.message); setCarregando(false); return; }
      if (count != null && count !== data?.length) { setErro("A consulta retornou apenas parte dos cadastros. Atualize a página."); setCarregando(false); return; }
      setPessoas(((data || []) as any[]).map((f) => ({ ...f, status: statusComoProgramador(f.status) })));
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [companyId]);

  const { projetadas, alocacoes } = useQuadroProjecao(companyId, pessoas, hoje);
  const { ogs, disponivel: ogsDisponivel } = useEquipeOgs(companyId);

  // Última movimentação no quadro: última "Mudança rápida de equipe" do histórico (+ início da alocação temporária ativa).
  useEffect(() => {
    (supabase as any).from("employee_historico").select("employee_id, created_at")
      .eq("company_id", companyId).eq("tipo", "mudanca_equipe").order("created_at", { ascending: false }).limit(5000)
      .then(({ data, error }: any) => {
        if (error) return;
        const mapa: Record<string, string> = {};
        for (const h of (data || []) as { employee_id: string; created_at: string }[]) if (!mapa[h.employee_id]) mapa[h.employee_id] = h.created_at;
        setUltimaMovHistorico(mapa);
      });
  }, [companyId]);

  const ultimaMovAlocacao = useMemo(() => Object.fromEntries(alocacoes.map((a) => [a.employee_id, a.data_inicio])), [alocacoes]);
  const ocultasAdmin = useEquipesOcultas();
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const completas = useMemo(
    () => montarLinhasQuadroHoje({ pessoas: projetadas as PessoaHoje[], ogs, ultimaMovHistorico, ultimaMovAlocacao }),
    [projetadas, ogs, ultimaMovHistorico, ultimaMovAlocacao],
  );
  const todas = useMemo(() => (mostrarAdmin ? completas : filtrarEquipesOcultas(completas, ocultasAdmin)), [completas, mostrarAdmin, ocultasAdmin]);
  const equipes = useMemo(() => agruparPorEquipe(todas, ogs), [todas, ogs]);

  const termo = chaveEquipe(busca);
  const filtradas = useMemo(
    () => todas.filter((l) =>
      (selecionadas.length === 0 || selecionadas.includes(chaveEquipe(l.equipe)))
      && (!termo || [l.nome, l.matricula, l.funcao].map(chaveEquipe).join(" ").includes(termo))),
    [todas, selecionadas, termo],
  );
  const blocos = useMemo(() => agruparPorEquipe(filtradas, ogs), [filtradas, ogs]);

  const alternar = (chave: string) => setSelecionadas((prev) => (prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]));

  const exportarExcel = () => {
    const blob = new Blob([gerarCsv(TITULO, hoje, blocos)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `WF_QuadroHoje_${hoje}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const exportarPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(gerarHtmlPdf(TITULO, hoje, blocos));
    win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Posição de hoje: {dataBR(hoje)}</p>
            <p className="text-[11px] text-muted-foreground">
              Igual ao Quadro Pessoas do WF Programador (inclui alocações temporárias, férias e afastados). Só pessoas; vagas a contratar não entram.
              {!ogsDisponivel && " A OGS por equipe ainda não está disponível neste ambiente."}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={exportarExcel} variant="outline" className="gap-2 text-xs" disabled={filtradas.length === 0}><FileSpreadsheet className="w-4 h-4" /> Download Excel</Button>
            <Button onClick={exportarPdf} variant="outline" className="gap-2 text-xs" disabled={filtradas.length === 0}><Printer className="w-4 h-4" /> Download PDF</Button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipes {selecionadas.length === 0 ? "(todas)" : `(${selecionadas.length} selecionada(s))`}</label>
            {selecionadas.length > 0 && <button className="text-xs text-primary underline" onClick={() => setSelecionadas([])}>Limpar — exportar todas</button>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {equipes.map((b) => {
              const ch = chaveEquipe(b.equipe);
              const ativa = selecionadas.includes(ch);
              return (
                <button key={ch} type="button" onClick={() => alternar(ch)} aria-pressed={ativa}
                  className={`text-xs rounded-full border px-2.5 py-1 ${ativa ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-secondary"}`}>
                  {b.equipe}{b.ogs ? ` · OGS ${b.ogs}` : ""} <span className="opacity-70">({b.linhas.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={mostrarAdmin} onChange={(e) => { setMostrarAdmin(e.target.checked); setSelecionadas([]); }} />
          Mostrar equipes administrativas (ocultas em Admin &gt; Equipes) e DEMITIDOS
        </label>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome, matrícula ou função…" className="h-11 pl-9 bg-secondary border-border" />
        </div>
      </div>

      {carregando && <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Carregando o quadro de hoje…</div>}
      {erro && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">Falha ao consultar o quadro: {erro}</p>}

      {!carregando && !erro && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground px-1">{filtradas.length} pessoa(s) em {blocos.length} equipe(s)</p>
          {blocos.map((b) => (
            <div key={chaveEquipe(b.equipe)} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-secondary/60 flex items-baseline gap-2">
                <h3 className="text-sm font-bold uppercase text-foreground">{b.equipe}</h3>
                {b.ogs && <span className="text-xs font-bold rounded bg-blue-100 text-blue-700 px-1.5 py-0.5">OGS {b.ogs}</span>}
                <span className="text-xs text-muted-foreground">({b.linhas.length})</span>
                {b.ogs && b.atualizadoEm && <span className="text-[11px] text-muted-foreground ml-auto">OGS atualizada em {dataBR(b.atualizadoEm)}</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground border-b border-border">
                    {["Matrícula", "Nome", "Função", "Situação", "Equipe de origem", "Última movimentação"].map((h) => <th key={h} className="px-3 py-1.5 font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {b.linhas.map((l) => (
                      <tr key={l.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-1.5 whitespace-nowrap">{l.matricula || "-"}</td>
                        <td className="px-3 py-1.5 font-medium">{l.nome}</td>
                        <td className="px-3 py-1.5">{l.funcao || "-"}</td>
                        <td className="px-3 py-1.5">{l.situacao || "Ativo"}</td>
                        <td className="px-3 py-1.5">{l.origem || "-"}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{dataBR(l.ultimaMov) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {blocos.length === 0 && <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada com esse filtro.</div>}
        </div>
      )}
    </div>
  );
}
