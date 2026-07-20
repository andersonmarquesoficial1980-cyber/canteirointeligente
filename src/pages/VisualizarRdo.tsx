import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, HardHat, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogoHomeButton } from "@/components/LogoHomeButton";

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function expandNomes(nome: string | null): string[] {
  if (!nome) return [];
  return nome.split("|||").map((n) => n.trim()).filter(Boolean);
}

export default function VisualizarRdo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rdo, setRdo] = useState<any | null>(null);
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [efetivoTerceiros, setEfetivoTerceiros] = useState<Record<string, string[]>>({});
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [producao, setProducao] = useState<any[]>([]);
  const [nfMassa, setNfMassa] = useState<any[]>([]);

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
          { data: equipRows },
          { data: prodRows },
          { data: nfRows },
        ] = await Promise.all([
          supabase.from("rdo_diarios").select("*").eq("id", id).maybeSingle(),
          supabase.from("rdo_efetivo").select("id,nome,funcao,matricula,entrada,saida,quantidade").eq("rdo_id", id).order("funcao", { ascending: true }),
          (supabase as any).from("rdo_efetivo_terceiros").select("empresa_nome,funcionario_nome").eq("rdo_id", id),
          (supabase as any).from("rdo_equipamentos").select("id,frota,categoria,sub_tipo,tipo,nome,patrimonio,empresa_dona").eq("rdo_id", id).order("frota", { ascending: true }),
          (supabase as any).from("rdo_producao").select("id,tipo_servico,sentido_faixa,sentido,faixa,estaca_inicial,estaca_final,comprimento_m,largura_m,espessura_cm,area_m2,volume_m3,densidade,tonelagem").eq("rdo_id", id),
          (supabase as any).from("rdo_nf_massa").select("id,nf,placa,usina,tonelagem,tipo_material").eq("rdo_id", id).order("nf", { ascending: true }),
        ]);

        if (rdoError) throw rdoError;
        if (efetivoError) throw efetivoError;
        if (!rdoRow) {
          setError("RDO não encontrado.");
          setRdo(null);
          return;
        }

        setRdo(rdoRow);

        // Expandir efetivo (nomes separados por |||)
        const expandido: any[] = [];
        (efetivoRows || []).forEach((ef: any) => {
          const nomes = expandNomes(ef.nome);
          if (nomes.length > 0) {
            const matriculas = ef.matricula ? ef.matricula.split("|||").map((m: string) => m.trim()) : [];
            nomes.forEach((nome, i) => {
              expandido.push({ nome, matricula: matriculas[i] || "-", funcao: ef.funcao || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" });
            });
          } else {
            const qtd = Number(ef.quantidade) || 1;
            for (let i = 0; i < qtd; i++) {
              expandido.push({ nome: "-", matricula: "-", funcao: ef.funcao || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" });
            }
          }
        });
        setEfetivo(expandido);

        // Terceirizados agrupados por empresa
        const tercAgrupado: Record<string, string[]> = {};
        (tercRows || []).forEach((t: any) => {
          if (!tercAgrupado[t.empresa_nome]) tercAgrupado[t.empresa_nome] = [];
          tercAgrupado[t.empresa_nome].push(t.funcionario_nome);
        });
        setEfetivoTerceiros(tercAgrupado);

        // Enriquecer equipamentos com empresa de 'equipamentos' quando empresa_dona é nulo
        let equipRowsEnriquecidos = equipRows || [];
        const frotasParaBuscar = (equipRows || []).map((e: any) => e.frota).filter(Boolean);
        if (frotasParaBuscar.length > 0) {
          const { data: equipEmpresas } = await (supabase as any)
            .from("equipamentos")
            .select("frota, empresa_proprietaria, condicao")
            .in("frota", frotasParaBuscar);
          const empresaMap: Record<string, { empresa: string | null; condicao: string | null }> = {};
          (equipEmpresas || []).forEach((m: any) => {
            if (m.frota) empresaMap[m.frota] = { empresa: m.empresa_proprietaria || null, condicao: m.condicao || null };
          });
          equipRowsEnriquecidos = equipRowsEnriquecidos.map((e: any) => {
            if (e.empresa_dona) return e; // já tem empresa no RDO
            const info = empresaMap[e.frota];
            const empresaFallback = info?.empresa || (info?.condicao?.toUpperCase() === "PROPRIO" ? "PRÓPRIO" : null);
            return { ...e, empresa_dona: empresaFallback };
          });
        }

        setEquipamentos(equipRowsEnriquecidos);
        setProducao(prodRows || []);
        setNfMassa(nfRows || []);
      } catch (err: any) {
        setError(err?.message || "Erro ao carregar RDO.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const entradaGlobal = efetivo[0]?.entrada || "-";
  const saidaGlobal = efetivo[0]?.saida || "-";
  const totalArea = producao.reduce((s, p) => {
    if (p.area_m2 != null) return s + (parseFloat(String(p.area_m2)) || 0);
    const comp = parseFloat(String(p.comprimento_m || 0)) || 0;
    const larg = parseFloat(String(p.largura_m || 0)) || 0;
    return s + (comp && larg ? comp * larg : 0);
  }, 0);
  const totalTon = nfMassa.reduce((s, n) => s + (parseFloat(String(n.tonelagem || 0)) || 0), 0);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoHomeButton className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Visualizar RDO</span>
          <span className="block text-[11px] text-primary-foreground/80">Somente leitura</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
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
            {/* Cabeçalho */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-sm font-medium">
              👁️ Visualização — RDO de {rdo.responsavel || rdo.encarregado || "Responsável"}
            </div>

            <div className="rdo-card space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Info label="Obra / OGS" value={rdo.obra_nome || "-"} />
                <Info label="Data" value={fmtDate(rdo.data)} />
                <Info label="Turno" value={rdo.turno || "-"} />
                <Info label="Clima" value={rdo.clima || "-"} />
                <Info label="Encarregado" value={rdo.encarregado || rdo.responsavel || "-"} />
                <Info label="Preenchido por" value={rdo.preenchido_por || "-"} />
                <Info label="Tipo RDO" value={rdo.tipo_rdo || "-"} />
                <Info label="Efetivo (pessoas)" value={String(efetivo.length)} />
              </div>
            </div>

            {/* Efetivo Fremix */}
            {efetivo.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-display font-bold text-primary">
                  👷 EFETIVO ({efetivo.length}) — {entradaGlobal} ÀS {saidaGlobal}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left p-2 border border-border w-8">#</th>
                        <th className="text-left p-2 border border-border">Nome</th>
                        <th className="text-left p-2 border border-border">Função</th>
                        <th className="text-left p-2 border border-border w-20">Entrada</th>
                        <th className="text-left p-2 border border-border w-20">Saída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {efetivo.map((p, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                          <td className="p-2 border border-border text-muted-foreground">{i + 1}</td>
                          <td className="p-2 border border-border font-medium">{p.nome}</td>
                          <td className="p-2 border border-border text-muted-foreground">{p.funcao}</td>
                          <td className="p-2 border border-border text-center">{p.entrada}</td>
                          <td className="p-2 border border-border text-center">{p.saida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Efetivo Terceirizado */}
            <div className="rdo-card space-y-3">
              <p className="text-sm font-display font-bold flex items-center gap-2 text-amber-700">
                <HardHat className="w-4 h-4" /> Efetivo Terceirizado
              </p>
              {Object.keys(efetivoTerceiros).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum efetivo terceirizado informado neste RDO.</p>
              ) : (
                Object.entries(efetivoTerceiros).map(([empresa, nomes]) => (
                  <div key={empresa}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{empresa}</p>
                    <div className="flex flex-wrap gap-1">
                      {nomes.map((nome) => (
                        <span key={nome} className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-800">
                          {nome}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Equipamentos */}
            {equipamentos.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-display font-bold text-primary">🚜 EQUIPAMENTOS ({equipamentos.length})</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left p-2 border border-border">Frota</th>
                        <th className="text-left p-2 border border-border">Equipamento</th>
                        <th className="text-left p-2 border border-border">Modelo/Placa</th>
                        <th className="text-left p-2 border border-border">Empresa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipamentos.map((e, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                          <td className="p-2 border border-border font-medium">{e.frota || "-"}</td>
                          <td className="p-2 border border-border">{e.sub_tipo || e.tipo || e.categoria || "-"}</td>
                          <td className="p-2 border border-border text-muted-foreground">{e.nome || e.patrimonio || "-"}</td>
                          <td className="p-2 border border-border text-muted-foreground">{e.empresa_dona || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* NFs de Massa */}
            {nfMassa.length > 0 && (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-display font-bold text-primary">📋 NOTAS FISCAIS DE MASSA</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left p-2 border border-border">NF</th>
                        <th className="text-left p-2 border border-border">Placa</th>
                        <th className="text-left p-2 border border-border">Usina</th>
                        <th className="text-right p-2 border border-border">Tonelagem</th>
                        <th className="text-left p-2 border border-border">Material</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nfMassa.map((n, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                          <td className="p-2 border border-border font-medium">{n.nf || "-"}</td>
                          <td className="p-2 border border-border">{n.placa || "-"}</td>
                          <td className="p-2 border border-border text-muted-foreground">{n.usina || "-"}</td>
                          <td className="p-2 border border-border text-right">{n.tonelagem ?? "-"}</td>
                          <td className="p-2 border border-border text-muted-foreground">{n.tipo_material || "-"}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/40 font-bold">
                        <td colSpan={3} className="p-2 border border-border text-right">TOTAL</td>
                        <td className="p-2 border border-border text-right">{totalTon.toFixed(2)}</td>
                        <td className="p-2 border border-border" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Produção */}
            {producao.length > 0 && (() => {
              const isInfra = rdo.tipo_rdo === "INFRAESTRUTURA";
              return (
              <div className="rdo-card space-y-2">
                <p className="text-sm font-display font-bold text-primary">🏗️ PRODUÇÃO DO DIA</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-muted-foreground">
                        <th className="text-left p-2 border border-border">Serviço</th>
                        <th className="text-left p-2 border border-border">Sentido/Faixa</th>
                        <th className="text-right p-2 border border-border">Comp(m)</th>
                        <th className="text-right p-2 border border-border">Larg(m)</th>
                        <th className="text-right p-2 border border-border">Área(m²)</th>
                        <th className="text-right p-2 border border-border">Esp(cm)</th>
                        <th className="text-right p-2 border border-border">Volume(m³)</th>
                        {!isInfra && <th className="text-right p-2 border border-border">Dens.</th>}
                        {!isInfra && <th className="text-right p-2 border border-border">Ton</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {producao.map((p, i) => {
                          const comp = parseFloat(String(p.comprimento_m || 0)) || 0;
                          const larg = parseFloat(String(p.largura_m || 0)) || 0;
                          const esp = parseFloat(String(p.espessura_cm || 0)) || 0;
                          const areaCalc = comp && larg ? Math.round(comp * larg * 100) / 100 : null;
                          const volCalc = areaCalc && esp ? Math.round(areaCalc * (esp / 100) * 1000) / 1000 : null;
                          const areaDisplay = p.area_m2 != null ? p.area_m2 : areaCalc;
                          const volDisplay = p.volume_m3 != null ? p.volume_m3 : volCalc;
                          return (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                          <td className="p-2 border border-border font-medium">{p.tipo_servico || "-"}</td>
                          <td className="p-2 border border-border text-muted-foreground">{p.sentido_faixa || p.sentido || "-"}</td>
                          <td className="p-2 border border-border text-right">{p.comprimento_m ?? "-"}</td>
                          <td className="p-2 border border-border text-right">{p.largura_m ?? "-"}</td>
                          <td className="p-2 border border-border text-right">{areaDisplay ?? "-"}</td>
                          <td className="p-2 border border-border text-right">{p.espessura_cm ?? "-"}</td>
                          <td className="p-2 border border-border text-right">{volDisplay ?? "-"}</td>
                          {!isInfra && <td className="p-2 border border-border text-right">{p.densidade ?? "-"}</td>}
                          {!isInfra && <td className="p-2 border border-border text-right">{p.tonelagem ?? "-"}</td>}
                        </tr>
                          );
                        })}
                      <tr className="bg-muted/40 font-bold">
                        <td colSpan={isInfra ? 4 : 4} className="p-2 border border-border text-right">TOTAL</td>
                        <td className="p-2 border border-border text-right">{totalArea.toFixed(2)}</td>
                        <td colSpan={isInfra ? 2 : 4} className="p-2 border border-border" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            {/* Observações Gerais */}
            <div className="rdo-card space-y-2">
              <p className="text-sm font-display font-bold text-primary">📝 Observações Gerais</p>
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                {rdo.observacoes_gerais?.trim() || "Nenhuma observação geral informada."}
              </div>
            </div>

            {/* Validações */}
            <div className="rdo-card space-y-3">
              <p className="text-sm font-display font-bold text-primary">Validações</p>
              <div className={`flex items-start gap-3 rounded-xl p-3 border text-sm ${
                rdo.validado_encarregado ? "bg-green-50 border-green-200"
                : rdo.nao_aprovado_encarregado ? "bg-red-50 border-red-200"
                : "bg-muted/30 border-border"
              }`}>
                <div className="mt-0.5">
                  {rdo.validado_encarregado ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : rdo.nao_aprovado_encarregado ? <XCircle className="w-4 h-4 text-red-600" />
                  : <Clock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Encarregado</p>
                  <p className={`text-xs mt-0.5 ${rdo.validado_encarregado ? "text-green-700" : rdo.nao_aprovado_encarregado ? "text-red-700" : "text-muted-foreground"}`}>
                    {rdo.validado_encarregado ? "Aprovado" : rdo.nao_aprovado_encarregado ? "Não aprovado" : "Aguardando validação"}
                  </p>
                  {rdo.nao_aprovado_encarregado && rdo.motivo_rejeicao_enc && (
                    <p className="text-xs text-red-600 mt-1">Motivo: {rdo.motivo_rejeicao_enc}</p>
                  )}
                </div>
              </div>

              <div className={`flex items-start gap-3 rounded-xl p-3 border text-sm ${
                rdo.status_validacao === "validado" ? "bg-green-50 border-green-200"
                : rdo.status_validacao === "rejeitado" ? "bg-red-50 border-red-200"
                : "bg-muted/30 border-border"
              }`}>
                <div className="mt-0.5">
                  {rdo.status_validacao === "validado" ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                  : rdo.status_validacao === "rejeitado" ? <XCircle className="w-4 h-4 text-red-600" />
                  : <Clock className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Engenheiro</p>
                  <p className={`text-xs mt-0.5 ${rdo.status_validacao === "validado" ? "text-green-700" : rdo.status_validacao === "rejeitado" ? "text-red-700" : "text-muted-foreground"}`}>
                    {rdo.status_validacao === "validado" ? "Validado" : rdo.status_validacao === "rejeitado" ? "Rejeitado" : "Aguardando validação"}
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
