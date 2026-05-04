import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoCi from "@/assets/logo-workflux.png";

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function VisualizarRdo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rdo, setRdo] = useState<any | null>(null);
  const [efetivo, setEfetivo] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError("RDO não informado.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          { data: rdoRow, error: rdoError },
          { data: efetivoRows, error: efetivoError },
        ] = await Promise.all([
          supabase.from("rdo_diarios").select("*").eq("id", id).maybeSingle(),
          supabase.from("rdo_efetivo").select("id,funcao,quantidade,entrada,saida").eq("rdo_id", id),
        ]);

        if (rdoError) throw rdoError;
        if (efetivoError) throw efetivoError;
        if (!rdoRow) {
          setError("RDO não encontrado.");
          setRdo(null);
          return;
        }

        setRdo(rdoRow);
        setEfetivo(efetivoRows || []);
      } catch (err: any) {
        setError(err?.message || "Erro ao carregar RDO.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const efetivoAgrupado = useMemo(() => {
    const map = new Map<string, number>();
    (efetivo || []).forEach((item: any) => {
      const key = item.funcao || "Sem função";
      const qtd = Number(item.quantidade) || 0;
      map.set(key, (map.get(key) || 0) + qtd);
    });
    return Array.from(map.entries());
  }, [efetivo]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            Visualizar RDO
          </span>
          <span className="block text-[11px] text-primary-foreground/80">Somente leitura</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-sm font-medium">
          {`👁️ Visualização — RDO de ${rdo?.responsavel || "Responsável"}`}
        </div>

        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rdo-card py-8 text-sm text-destructive">{error}</div>
        ) : !rdo ? (
          <div className="rdo-card py-8 text-sm text-muted-foreground">RDO não encontrado.</div>
        ) : (
          <>
            <div className="rdo-card">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Info label="Obra" value={rdo.obra_nome || "-"} />
                <Info label="Data" value={fmtDate(rdo.data)} />
                <Info label="Turno" value={rdo.turno || "-"} />
                <Info label="Clima" value={rdo.clima || "-"} />
                <Info label="Responsável" value={rdo.responsavel || "-"} />
                <Info label="Efetivo (registros)" value={String(efetivo.length)} />
              </div>
            </div>

            <div className="rdo-card space-y-2">
              <p className="text-sm font-display font-bold text-primary">Efetivo</p>
              {efetivoAgrupado.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum efetivo registrado.</p>
              ) : (
                efetivoAgrupado.map(([funcao, quantidade]) => (
                  <div key={funcao} className="rounded-lg border border-border bg-muted/20 p-2 text-sm flex items-center justify-between">
                    <span>{funcao}</span>
                    <strong>{quantidade}</strong>
                  </div>
                ))
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
              ← Voltar
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
