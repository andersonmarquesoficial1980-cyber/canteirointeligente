/**
 * BuscaEquipamentos — Busca avançada de diários de equipamentos
 * Filtros: OGS, Data, Tipo de Equipamento, Frota, Motorista/Operador
 * Rota: /relatorios/busca-equipamentos
 * Filtros persistidos na URL para sobreviver ao navigate(-1)
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Loader2, X, ChevronRight, Wrench, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoCi from "@/assets/logo-workflux.png";

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface DiarioResult {
  id: string;
  date: string | null;
  equipment_type: string | null;
  equipment_fleet: string | null;
  operator_name: string | null;
  ogs_number: string | null;
  client_name: string | null;
  work_status: string | null;
  period: string | null;
}

export default function BuscaEquipamentos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const hoje = new Date().toISOString().split("T")[0];
  const mesAtras = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  // Filtros lidos da URL — persistem ao voltar
  const ini = searchParams.get("ini") || mesAtras;
  const fim = searchParams.get("fim") || hoje;
  const ogs = searchParams.get("ogs") || "";
  const tipoEquip = searchParams.get("tipo") || "";
  const frota = searchParams.get("frota") || "";
  const operador = searchParams.get("operador") || "";
  const buscou = searchParams.get("buscou") === "1";

  const setFiltro = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  };

  const [resultados, setResultados] = useState<DiarioResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Opções dinâmicas
  const [tipos, setTipos] = useState<string[]>([]);
  const [frotasPorTipo, setFrotasPorTipo] = useState<Record<string, string[]>>({});
  const [operadores, setOperadores] = useState<string[]>([]);

  // Frotas filtradas pelo tipo selecionado
  const frotas = tipoEquip
    ? (frotasPorTipo[tipoEquip] || [])
    : [...new Set(Object.values(frotasPorTipo).flat())].sort();

  useEffect(() => {
    Promise.all([
      (supabase as any).from("equipment_diaries").select("equipment_type, equipment_fleet").not("equipment_type", "is", null).not("equipment_fleet", "is", null),
      (supabase as any).from("equipment_diaries").select("operator_name").not("operator_name", "is", null),
    ]).then(([td, o]) => {
      if (td.data) {
        const rows = td.data as any[];
        const tiposUniq = [...new Set(rows.map((r: any) => r.equipment_type).filter(Boolean))].sort();
        setTipos(tiposUniq);
        const byTipo: Record<string, string[]> = {};
        rows.forEach(r => {
          const tipo = r.equipment_type as string;
          const fl = r.equipment_fleet as string;
          if (!tipo || !fl) return;
          if (!byTipo[tipo]) byTipo[tipo] = [];
          if (!byTipo[tipo].includes(fl)) byTipo[tipo].push(fl);
        });
        Object.keys(byTipo).forEach(k => byTipo[k].sort());
        setFrotasPorTipo(byTipo);
      }
      if (o.data) setOperadores([...new Set((o.data as any[]).map((r: any) => r.operator_name).filter(Boolean))].sort());
    });
  }, []);

  const buscar = useCallback(async () => {
    setLoading(true);

    let query = (supabase as any)
      .from("equipment_diaries")
      .select("id, date, equipment_type, equipment_fleet, operator_name, ogs_number, client_name, work_status, period")
      .gte("date", ini)
      .lte("date", fim)
      .order("date", { ascending: false })
      .order("equipment_fleet", { ascending: true })
      .limit(150);

    if (ogs.trim()) query = query.ilike("ogs_number", `%${ogs.trim()}%`);
    if (tipoEquip) query = query.ilike("equipment_type", tipoEquip);
    if (frota.trim()) query = query.ilike("equipment_fleet", `%${frota.trim()}%`);
    if (operador.trim()) query = query.ilike("operator_name", `%${operador.trim()}%`);

    const { data, error } = await query;
    if (!error) setResultados(data || []);
    setLoading(false);
  }, [ini, fim, ogs, tipoEquip, frota, operador]);

  // Rebusca automaticamente ao voltar se já havia buscado antes
  useEffect(() => {
    if (buscou) buscar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuscar = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("buscou", "1");
      return next;
    }, { replace: true });
    buscar();
  };

  const limpar = () => {
    setSearchParams({}, { replace: true });
    setResultados([]);
  };

  const STATUS_COR: Record<string, string> = {
    "Trabalhou": "bg-green-500/15 text-green-600",
    "Parado": "bg-red-500/15 text-red-500",
    "Manutenção": "bg-yellow-500/15 text-yellow-600",
    "Mobilização": "bg-blue-500/15 text-blue-500",
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-bold text-sm text-primary-foreground">Buscar Equipamentos</span>
          <span className="block text-[10px] text-primary-foreground/70">Filtrar diários por OGS, frota, tipo ou operador</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {/* Filtros */}
        <div className="rdo-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>

          {/* Período */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <input type="date" value={ini} onChange={e => setFiltro("ini", e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data final</label>
              <input type="date" value={fim} onChange={e => setFiltro("fim", e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none" />
            </div>
          </div>

          {/* Tipo de equipamento */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo de Equipamento</label>
            <select
              value={tipoEquip}
              onChange={e => {
                setSearchParams(prev => {
                  const next = new URLSearchParams(prev);
                  if (e.target.value) next.set("tipo", e.target.value); else next.delete("tipo");
                  next.delete("frota");
                  return next;
                }, { replace: true });
              }}
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none"
            >
              <option value="">Todos os tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Frota */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Frota {tipoEquip && <span className="text-primary">({tipoEquip})</span>}
            </label>
            <select
              value={frota}
              onChange={e => setFiltro("frota", e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none"
            >
              <option value="">{frotas.length > 0 ? `Todas as frotas (${frotas.length})` : "Selecione o tipo primeiro"}</option>
              {frotas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* OGS */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">OGS / Obra</label>
            <input
              type="text" inputMode="numeric" value={ogs}
              onChange={e => setFiltro("ogs", e.target.value)}
              placeholder="Ex: 2532"
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Operador */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Motorista / Operador</label>
            <input
              type="text" value={operador}
              onChange={e => setFiltro("operador", e.target.value)}
              placeholder="Nome do operador ou motorista"
              list="lista-operadores"
              className="w-full h-10 px-3 text-sm rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
            <datalist id="lista-operadores">
              {operadores.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>

          {/* Botão relatório direto quando frota selecionada */}
          {frota && (
            <button
              onClick={() => navigate(`/relatorios/equipamento/${encodeURIComponent(frota)}?ini=${ini}&fim=${fim}`)}
              className="w-full flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/8 px-4 py-3 hover:bg-green-500/15 transition-colors text-left"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-green-700">Ver relatório completo — {frota}</p>
                <p className="text-xs text-muted-foreground">Com PDF, Excel e navegação por mês</p>
              </div>
              <ChevronRight className="w-4 h-4 text-green-600/50" />
            </button>
          )}

          <div className="flex gap-2">
            <Button onClick={handleBuscar} disabled={loading} className="flex-1 h-10 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Buscando..." : "Buscar lançamentos"}
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
                <Wrench className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground">{resultados.length} lançamento{resultados.length !== 1 ? "s" : ""}</p>
                </div>

                {frota && (
                  <button
                    onClick={() => navigate(`/relatorios/equipamento/${encodeURIComponent(frota)}?ini=${ini}&fim=${fim}`)}
                    className="w-full flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 hover:bg-green-500/10 transition-colors text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-green-700">Relatório completo — {frota}</p>
                      <p className="text-xs text-muted-foreground">Exportar PDF e Excel do período selecionado</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-green-600/40" />
                  </button>
                )}

                <div className="space-y-1.5">
                  {resultados.map(r => {
                    const statusCor = STATUS_COR[r.work_status || ""] || "bg-muted text-muted-foreground";
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/visualizar-lancamento/${r.id}`)}
                        className="w-full rdo-card flex items-center gap-3 hover:shadow-md transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                          {(r.equipment_fleet || "—").slice(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-display font-bold text-foreground">{r.equipment_fleet || "—"}</p>
                            <span className="text-[10px] text-muted-foreground">{r.equipment_type}</span>
                            {r.work_status && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusCor}`}>{r.work_status}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(r.date)}
                            {r.period && <span className="ml-1">· {r.period}</span>}
                            {r.ogs_number && <span className="ml-1">· OGS {r.ogs_number}</span>}
                          </p>
                          {r.operator_name && (
                            <p className="text-[10px] text-muted-foreground">👤 {r.operator_name}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
