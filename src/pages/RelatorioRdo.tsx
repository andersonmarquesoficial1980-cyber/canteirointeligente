import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";
import { supabase } from "@/integrations/supabase/client";

interface RdoItem {
  id: string;
  data: string | null;
  tipo_rdo: string | null;
  responsavel: string | null;
  turno: string | null;
  clima: string | null;
}

interface EfetivoItem {
  id: string;
  rdo_id: string | null;
  funcao: string | null;
  quantidade: number | null;
  entrada: string | null;
  saida: string | null;
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function RelatorioRdo() {
  const navigate = useNavigate();
  const { ogs = "" } = useParams<{ ogs: string }>();
  const [searchParams] = useSearchParams();

  const ini = searchParams.get("ini") || "";
  const fim = searchParams.get("fim") || "";

  const [loading, setLoading] = useState(true);
  const [rdoList, setRdoList] = useState<RdoItem[]>([]);
  const [efetivoByRdoId, setEfetivoByRdoId] = useState<Record<string, EfetivoItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const carregar = async () => {
      if (!ogs || !ini || !fim) {
        setRdoList([]);
        setEfetivoByRdoId({});
        setLoading(false);
        return;
      }

      setLoading(true);

      let rows: any[] = [];

      // obra_nome salva o número da OGS diretamente
      const { data: rdoData, error: rdoError } = await (supabase as any)
        .from("rdo_diarios")
        .select("id,data,tipo_rdo,responsavel,turno,clima")
        .eq("obra_nome", ogs)
        .gte("data", ini)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });

      if (!rdoError) {
        rows = rdoData || [];
      }

      const lista = (rows || []) as RdoItem[];
      setRdoList(lista);

      if (lista.length === 0) {
        setEfetivoByRdoId({});
        setLoading(false);
        return;
      }

      const ids = lista.map((r) => r.id);
      const { data: efetivoRows } = await supabase
        .from("rdo_efetivo")
        .select("id,rdo_id,funcao,quantidade,entrada,saida")
        .in("rdo_id", ids)
        .order("funcao", { ascending: true });

      const grouped: Record<string, EfetivoItem[]> = {};
      (efetivoRows || []).forEach((item) => {
        if (!item.rdo_id) return;
        if (!grouped[item.rdo_id]) grouped[item.rdo_id] = [];
        grouped[item.rdo_id].push(item as EfetivoItem);
      });

      setEfetivoByRdoId(grouped);
      setLoading(false);
    };

    carregar();
  }, [ogs, ini, fim]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório RDO</span>
          <span className="block text-[11px] text-primary-foreground/80">OGS {ogs} • {ini || "-"} a {fim || "-"}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : rdoList.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum RDO encontrado para este período
          </div>
        ) : (
          rdoList.map((item) => {
            const isOpen = !!expanded[item.id];
            const efetivo = efetivoByRdoId[item.id] || [];
            return (
              <div key={item.id} className="rdo-card">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-display font-bold text-primary">{fmtDate(item.data)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tipo: {item.tipo_rdo || "-"} • Responsável: {item.responsavel || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Turno: {item.turno || "-"} • Clima: {item.clima || "-"}</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground mt-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground mt-1" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Efetivo</p>
                    {efetivo.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem efetivo registrado.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 pr-2">Função</th>
                              <th className="text-left py-1.5 pr-2">Qtd</th>
                              <th className="text-left py-1.5 pr-2">Entrada</th>
                              <th className="text-left py-1.5">Saída</th>
                            </tr>
                          </thead>
                          <tbody>
                            {efetivo.map((ef) => (
                              <tr key={ef.id} className="border-b border-border/60 last:border-0">
                                <td className="py-1.5 pr-2">{ef.funcao || "-"}</td>
                                <td className="py-1.5 pr-2">{ef.quantidade ?? "-"}</td>
                                <td className="py-1.5 pr-2">{ef.entrada || "-"}</td>
                                <td className="py-1.5">{ef.saida || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
