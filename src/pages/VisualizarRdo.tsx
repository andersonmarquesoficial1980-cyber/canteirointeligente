import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, HardHat, CheckCircle2, XCircle, Clock } from "lucide-react";
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
  const [efetivoTerceiros, setEfetivoTerceiros] = useState<Record<string, string[]>>({});

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
          { data: tercRows },
        ] = await Promise.all([
          supabase.from("rdo_diarios").select("*").eq("id", id).maybeSingle(),
          supabase.from("rdo_efetivo").select("id,funcao,quantidade,entrada,saida").eq("rdo_id", id),
          (supabase as any).from("rdo_efetivo_terceiros").select("empresa_nome,funcionario_nome").eq("rdo_id", id),
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

        // Agrupar terceirizados por empresa
        const tercAgrupado: Record<string, string[]> = {};
        (tercRows || []).forEach((t: any) => {
          if (!tercAgrupado[t.empresa_nome]) tercAgrupado[t.empresa_nome] = [];
          tercAgrupado[t.empresa_nome].push(t.funcionario_nome);
        });
        setEfetivoTerceiros(tercAgrupado);
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
              <p className="text-sm font-display font-bold text-primary">Efetivo Fremix</p>
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

            {Object.keys(efetivoTerceiros).length > 0 && (
              <div className="rdo-card space-y-3">
                <p className="text-sm font-display font-bold flex items-center gap-2 text-amber-700">
                  <HardHat className="w-4 h-4" /> Efetivo Terceirizado
                </p>
                {Object.entries(efetivoTerceiros).map(([empresa, nomes]) => (
                  <div key={empresa}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{empresa}</p>
                    <div className="flex flex-wrap gap-1">
                      {nomes.map((nome) => (
                        <span
                          key={nome}
                          className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-800"
                        >
                          {nome}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bloco de validações */}
            <div className="rdo-card space-y-3">
              <p className="text-sm font-display font-bold text-primary">Validações</p>
              {/* Encarregado */}
              <div className={`flex items-start gap-3 rounded-xl p-3 border text-sm ${
                rdo.validado_encarregado
                  ? "bg-green-50 border-green-200"
                  : rdo.nao_aprovado_encarregado
                  ? "bg-red-50 border-red-200"
                  : "bg-muted/30 border-border"
              }`}>
                <div className="mt-0.5">
                  {rdo.validado_encarregado ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : rdo.nao_aprovado_encarregado ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Encarregado</p>
                  <p className={`text-xs mt-0.5 ${
                    rdo.validado_encarregado ? "text-green-700" :
                    rdo.nao_aprovado_encarregado ? "text-red-700" :
                    "text-muted-foreground"
                  }`}>
                    {rdo.validado_encarregado
                      ? "Aprovado"
                      : rdo.nao_aprovado_encarregado
                      ? "Não aprovado"
                      : "Aguardando validação"}
                  </p>
                  {rdo.nao_aprovado_encarregado && rdo.motivo_rejeicao_enc && (
                    <p className="text-xs text-red-600 mt-1">Motivo: {rdo.motivo_rejeicao_enc}</p>
                  )}
                  {rdo.validado_encarregado_em && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(rdo.validado_encarregado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              </div>
              {/* Engenheiro */}
              <div className={`flex items-start gap-3 rounded-xl p-3 border text-sm ${
                rdo.status_validacao === "validado"
                  ? "bg-green-50 border-green-200"
                  : rdo.status_validacao === "rejeitado"
                  ? "bg-red-50 border-red-200"
                  : "bg-muted/30 border-border"
              }`}>
                <div className="mt-0.5">
                  {rdo.status_validacao === "validado" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : rdo.status_validacao === "rejeitado" ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Engenheiro</p>
                  <p className={`text-xs mt-0.5 ${
                    rdo.status_validacao === "validado" ? "text-green-700" :
                    rdo.status_validacao === "rejeitado" ? "text-red-700" :
                    "text-muted-foreground"
                  }`}>
                    {rdo.status_validacao === "validado"
                      ? "Validado"
                      : rdo.status_validacao === "rejeitado"
                      ? "Rejeitado"
                      : "Aguardando validação"}
                  </p>
                  {rdo.status_validacao === "rejeitado" && rdo.motivo_rejeicao_eng && (
                    <p className="text-xs text-red-600 mt-1">Motivo: {rdo.motivo_rejeicao_eng}</p>
                  )}
                  {rdo.validado_em && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(rdo.validado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                </div>
              </div>
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
