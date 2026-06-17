/**
 * BuscaRdo — Busca avançada de RDOs
 * Filtros: OGS, Data inicial/final, Encarregado, Preenchido por (apontador)
 * Rota: /relatorios/busca-rdo
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, FileText, ChevronRight, Loader2, X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoCi from "@/assets/logo-workflux.png";

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface RdoResult {
  id: string;
  obra_nome: string | null;
  data: string | null;
  tipo_rdo: string | null;
  encarregado: string | null;
  preenchido_por: string | null;
  responsavel: string | null;
  turno: string | null;
  clima: string | null;
  status_validacao: string | null;
  validado_encarregado: boolean;
  nao_aprovado_encarregado: boolean;
}

export default function BuscaRdo() {
  const navigate = useNavigate();

  const hoje = new Date().toISOString().split("T")[0];
  const mesAtras = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [ogs, setOgs] = useState("");
  const [ini, setIni] = useState(mesAtras);
  const [fim, setFim] = useState(hoje);
  const [encarregado, setEncarregado] = useState("");
  const [apontador, setApontador] = useState("");

  const [resultados, setResultados] = useState<RdoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);

  // Sugestões de encarregados e apontadores
  const [encarregados, setEncarregados] = useState<string[]>([]);
  const [apontadores, setApontadores] = useState<string[]>([]);

  useEffect(() => {
    // Carregar encarregados e apontadores já cadastrados nos RDOs
    Promise.all([
      supabase.from("rdo_diarios" as any).select("encarregado").not("encarregado", "is", null),
      supabase.from("rdo_diarios" as any).select("preenchido_por").not("preenchido_por", "is", null),
    ]).then(([enc, apt]) => {
      if (enc.data) {
        const uniq = [...new Set((enc.data as any[]).map(r => r.encarregado).filter(Boolean))].sort();
        setEncarregados(uniq);
      }
      if (apt.data) {
        const uniq = [...new Set((apt.data as any[]).map(r => r.preenchido_por).filter(Boolean))].sort();
        setApontadores(uniq);
      }
    });
  }, []);

  const buscar = async () => {
    setLoading(true);
    setBuscou(true);

    let query = (supabase as any)
      .from("rdo_diarios")
      .select("id, obra_nome, data, tipo_rdo, encarregado, preenchido_por, responsavel, turno, clima, status_validacao, validado_encarregado, nao_aprovado_encarregado")
      .gte("data", ini)
      .lte("data", fim)
      .order("data", { ascending: false })
      .order("obra_nome", { ascending: true })
      .limit(100);

    if (ogs.trim()) query = query.ilike("obra_nome", `%${ogs.trim()}%`);
    if (encarregado.trim()) query = query.ilike("encarregado", `%${encarregado.trim()}%`);
    if (apontador.trim()) {
      query = query.or(`preenchido_por.ilike.%${apontador.trim()}%,responsavel.ilike.%${apontador.trim()}%`);
    }

    const { data, error } = await query;
    if (!error) setResultados(data || []);
    setLoading(false);
  };

  const limpar = () => {
    setOgs(""); setEncarregado(""); setApontador("");
    setIni(mesAtras); setFim(hoje);
    setResultados([]); setBuscou(false);
  };

  // Agrupar por OGS para facilitar exportação
  const porOgs = resultados.reduce((acc, r) => {
    const key = r.obra_nome || "—";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, RdoResult[]>);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm text-primary-foreground">Buscar RDOs</span>
          <span className="block text-[10px] text-primary-foreground/70">Filtrar por OGS, data, encarregado ou apontador</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {/* Filtros */}
        <div className="rdo-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>

          {/* OGS */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Número da OGS</label>
            <input
              type="text" inputMode="numeric" value={ogs}
              onChange={e => setOgs(e.target.value)}
              placeholder="Ex: 2532 (ou parte do número)"
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <input type="date" value={ini} onChange={e => setIni(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data final</label>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none" />
            </div>
          </div>

          {/* Encarregado */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Encarregado da obra</label>
            <input
              type="text" value={encarregado}
              onChange={e => setEncarregado(e.target.value)}
              placeholder="Nome do encarregado"
              list="lista-encarregados"
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
            <datalist id="lista-encarregados">
              {encarregados.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          {/* Apontador */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Preenchido por (apontador)</label>
            <input
              type="text" value={apontador}
              onChange={e => setApontador(e.target.value)}
              placeholder="Nome do apontador"
              list="lista-apontadores"
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
            <datalist id="lista-apontadores">
              {apontadores.map(a => <option key={a} value={a} />)}
            </datalist>
          </div>

          <div className="flex gap-2">
            <Button onClick={buscar} disabled={loading} className="flex-1 h-10 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Buscando..." : "Buscar"}
            </Button>
            {buscou && (
              <Button variant="outline" onClick={limpar} className="h-10 gap-1 px-3">
                <X className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Resultados */}
        {buscou && !loading && (
          <>
            {resultados.length === 0 ? (
              <div className="rdo-card py-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum RDO encontrado com esses filtros.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground">{resultados.length} RDO{resultados.length !== 1 ? "s" : ""} encontrado{resultados.length !== 1 ? "s" : ""}</p>
                </div>

                {/* Agrupado por OGS */}
                {Object.entries(porOgs).map(([ogsNum, rdos]) => (
                  <div key={ogsNum} className="rdo-card space-y-2">
                    {/* Header do grupo — clica para ir ao relatório do período */}
                    <button
                      onClick={() => {
                        const datas = rdos.map(r => r.data || "").filter(Boolean).sort();
                        const dataMin = datas[0];
                        const dataMax = datas[datas.length - 1];
                        navigate(`/relatorios/rdo/${ogsNum}?ini=${dataMin}&fim=${dataMax}`);
                      }}
                      className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
                    >
                      <div className="text-left">
                        <p className="text-sm font-display font-bold text-primary">OGS {ogsNum}</p>
                        <p className="text-xs text-muted-foreground">{rdos.length} RDO{rdos.length !== 1 ? "s" : ""} no período</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">Ver relatório →</span>
                      </div>
                    </button>

                    {/* Lista dos RDOs do grupo — abre relatório completo por data */}
                    <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                      {rdos.map(r => (
                        <button
                          key={r.id}
                          onClick={() => navigate(`/relatorios/rdo/${ogsNum}?ini=${r.data}&fim=${r.data}`)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {fmtDate(r.data)}
                              {r.tipo_rdo && <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">{r.tipo_rdo}</span>}
                              {r.turno && <span className="ml-1 text-[10px] text-muted-foreground">{r.turno}</span>}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {r.encarregado && <span>👷 {r.encarregado}</span>}
                              {r.preenchido_por && <span className="ml-2 opacity-60">✍️ {r.preenchido_por}</span>}
                            </p>
                            {/* Badges de validação */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {/* Encarregado */}
                              {r.validado_encarregado ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Enc.
                                </span>
                              ) : r.nao_aprovado_encarregado ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                                  <XCircle className="w-2.5 h-2.5" /> Enc.
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full">
                                  <Clock className="w-2.5 h-2.5" /> Enc.
                                </span>
                              )}
                              {/* Engenheiro */}
                              {r.status_validacao === "validado" ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Eng.
                                </span>
                              ) : r.status_validacao === "rejeitado" ? (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                                  <XCircle className="w-2.5 h-2.5" /> Eng.
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full">
                                  <Clock className="w-2.5 h-2.5" /> Eng.
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
