import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";
import { supabase } from "@/integrations/supabase/client";

interface AbastecimentoRow {
  id: string;
  data: string | null;
  created_at: string | null;
  hora: string | null;
  litros: number | null;
  horimetro: number | null;
  ogs: string | null;
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function RelatorioAbastecimento() {
  const navigate = useNavigate();
  const { fleet = "" } = useParams<{ fleet: string }>();
  const [searchParams] = useSearchParams();

  const ini = searchParams.get("ini") || "";
  const fim = searchParams.get("fim") || "";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AbastecimentoRow[]>([]);

  useEffect(() => {
    const carregar = async () => {
      if (!fleet || !ini || !fim) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const byData = await (supabase as any)
        .from("abastecimentos")
        .select("id,data,created_at,hora,litros,horimetro,ogs")
        .eq("equipment_fleet", fleet)
        .gte("data", ini)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("hora", { ascending: false })
        .order("created_at", { ascending: false });

      if (!byData.error) {
        setRows((byData.data || []) as AbastecimentoRow[]);
        setLoading(false);
        return;
      }

      const byCreated = await (supabase as any)
        .from("abastecimentos")
        .select("id,data,created_at,hora,litros,horimetro,ogs")
        .eq("equipment_fleet", fleet)
        .gte("created_at", `${ini}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false });

      setRows((byCreated.data || []) as AbastecimentoRow[]);
      setLoading(false);
    };

    carregar();
  }, [fleet, ini, fim]);

  const totalLitros = useMemo(
    () => rows.reduce((sum, item) => sum + (item.litros || 0), 0),
    [rows],
  );

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório Abastecimento</span>
          <span className="block text-[11px] text-primary-foreground/80">Frota {fleet} • {ini || "-"} a {fim || "-"}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum abastecimento encontrado para este período.
          </div>
        ) : (
          <>
            {rows.map((item) => (
              <div key={item.id} className="rdo-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm font-display font-bold text-primary">{fmtDate(item.data)}</p>
                    <p className="text-xs text-muted-foreground">Hora: {item.hora || "-"}</p>
                  </div>
                  <p className="text-sm font-semibold">{(item.litros || 0).toFixed(1)} L</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Litros</p>
                    <p className="font-semibold">{(item.litros || 0).toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Horímetro</p>
                    <p className="font-semibold">{item.horimetro ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">OGS</p>
                    <p className="font-semibold">{item.ogs || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data/Hora registro</p>
                    <p className="font-semibold">{item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "-"}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rdo-card border-primary/30 bg-primary/5">
              <p className="text-sm font-semibold text-primary">Total no período: {totalLitros.toFixed(1)} litros</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
