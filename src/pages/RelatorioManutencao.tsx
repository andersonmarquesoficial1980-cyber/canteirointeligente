import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import logoCi from "@/assets/logo-workflux.png";
import { supabase } from "@/integrations/supabase/client";

interface ManutencaoRow {
  id: string;
  numero_os: number | null;
  created_at: string | null;
  tipo: string | null;
  descricao: string | null;
  status: string | null;
}

function fmtDateTime(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("pt-BR");
}

export default function RelatorioManutencao() {
  const navigate = useNavigate();
  const { fleet = "" } = useParams<{ fleet: string }>();
  const [searchParams] = useSearchParams();

  const ini = searchParams.get("ini") || "";
  const fim = searchParams.get("fim") || "";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ManutencaoRow[]>([]);

  useEffect(() => {
    const carregar = async () => {
      if (!fleet || !ini || !fim) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data } = await (supabase as any)
        .from("manutencao_os")
        .select("id,numero_os,created_at,tipo,descricao,status")
        .eq("equipment_fleet", fleet)
        .gte("created_at", `${ini}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false });

      setRows((data || []) as ManutencaoRow[]);
      setLoading(false);
    };

    carregar();
  }, [fleet, ini, fim]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório Manutenção</span>
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
            Nenhuma OS de manutenção encontrada para este período.
          </div>
        ) : (
          rows.map((item) => (
            <div key={item.id} className="rdo-card">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Número OS</p>
                  <p className="font-semibold">{item.numero_os ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-semibold">{fmtDateTime(item.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-semibold">{item.tipo || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="font-semibold break-words">{item.descricao || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-semibold">{item.status || "-"}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
