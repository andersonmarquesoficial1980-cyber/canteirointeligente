import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BarChart3, ChevronRight, ChevronLeft, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TIPOS_RELATORIO = [
  { id: "equipamento", label: "Equipamentos", emoji: "🚜", desc: "Diário, consumo, manutenção, produção" },
  { id: "rdo", label: "Diários de Obra (RDO)", emoji: "🏗️", desc: "Produção, efetivo, equipamentos na obra" },
  { id: "abastecimento", label: "Abastecimento", emoji: "⛽", desc: "Consumo de diesel por equipamento" },
  { id: "manutencao", label: "Manutenção", emoji: "🔧", desc: "Ordens de serviço e peças trocadas" },
];

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function RelatoriosHome() {
  const navigate = useNavigate();

  // Cascata de seleção
  const [step, setStep] = useState<"tipo" | "subtipo" | "frota_ogs" | "periodo">("tipo");
  const [tipoRel, setTipoRel] = useState("");
  const [tipoEquip, setTipoEquip] = useState("");
  const [frotaOgs, setFrotaOgs] = useState("");
  const [tipoPeriodo, setTipoPeriodo] = useState<"dia" | "periodo">("dia");
  const [dataDia, setDataDia] = useState(new Date().toISOString().split("T")[0]);
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Dados dinâmicos
  const [tiposEquip, setTiposEquip] = useState<string[]>([]);
  const [frotasPorTipo, setFrotasPorTipo] = useState<Record<string, string[]>>({});
  const [ogsList, setOgsList] = useState<{ ogs: string; cliente: string }[]>([]);

  useEffect(() => {
    // Carregar frotas da tabela maquinas_frota (frota completa)
    supabase.from("maquinas_frota")
      .select("frota,tipo")
      .order("tipo,frota")
      .then(({ data }) => {
        if (!data) return;
        const byType: Record<string, Set<string>> = {};
        data.forEach(d => {
          const t = d.tipo || "Outros";
          if (!byType[t]) byType[t] = new Set();
          byType[t].add(d.frota);
        });
        const tipos = Object.keys(byType).sort();
        setTiposEquip(tipos);
        const frotas: Record<string, string[]> = {};
        tipos.forEach(t => { frotas[t] = Array.from(byType[t]).sort(); });
        setFrotasPorTipo(frotas);
      });

    // Carregar OGS
    supabase.from("ogs_reference")
      .select("ogs_number,client_name")
      .order("ogs_number")
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const list: { ogs: string; cliente: string }[] = [];
        data.forEach(d => {
          if (d.ogs_number && !seen.has(d.ogs_number)) {
            seen.add(d.ogs_number);
            list.push({ ogs: d.ogs_number, cliente: d.client_name || "" });
          }
        });
        setOgsList(list);
      });
  }, []);

  function irParaRelatorio() {
    const ini = tipoPeriodo === "dia" ? dataDia : dataIni;
    const fim = tipoPeriodo === "dia" ? dataDia : dataFim;

    if (tipoRel === "equipamento") {
      navigate(`/relatorios/equipamento/${frotaOgs}?ini=${ini}&fim=${fim}`);
    } else if (tipoRel === "rdo") {
      navigate(`/relatorios/rdo/${frotaOgs}?ini=${ini}&fim=${fim}`);
    } else if (tipoRel === "abastecimento") {
      navigate(`/relatorios/abastecimento/${frotaOgs}?ini=${ini}&fim=${fim}`);
    } else if (tipoRel === "manutencao") {
      navigate(`/relatorios/manutencao/${frotaOgs}?ini=${ini}&fim=${fim}`);
    }
  }

  function voltar() {
    if (step === "periodo") setStep("frota_ogs");
    else if (step === "frota_ogs") setStep("subtipo");
    else if (step === "subtipo") setStep("tipo");
  }

  const frotas = tipoEquip ? (frotasPorTipo[tipoEquip] || []) : [];

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button
          onClick={step === "tipo" ? () => navigate("/") : voltar}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Relatórios</span>
          <span className="block text-[11px] text-primary-foreground/80">
            {step === "tipo" && "Selecione o tipo"}
            {step === "subtipo" && (tipoRel === "equipamento" ? "Tipo de Equipamento" : "Selecione a OGS")}
            {step === "frota_ogs" && (tipoRel === "equipamento" ? `${tipoEquip} — Selecione a frota` : "Selecione a OGS")}
            {step === "periodo" && `${frotaOgs} — Selecione o período`}
          </span>
        </div>
      </header>

      {/* Indicador de progresso */}
      <div className="flex px-4 pt-3 gap-1.5">
        {["tipo", "subtipo", "frota_ogs", "periodo"].map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
            ["tipo", "subtipo", "frota_ogs", "periodo"].indexOf(step) >= i ? "bg-primary" : "bg-border"
          }`} />
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        <Button
          variant="outline"
          className="w-full h-11 gap-2 font-semibold"
          onClick={() => navigate("/meus-lancamentos")}
        >
          <ClipboardList className="w-4 h-4" />
          Meus Lançamentos
        </Button>

        {/* PASSO 1: Tipo de Relatório */}
        {step === "tipo" && (
          <>
            <p className="text-sm font-semibold text-muted-foreground px-1 mb-3">Que tipo de relatório você precisa?</p>
            {TIPOS_RELATORIO.map(t => (
              <button
                key={t.id}
                onClick={() => { setTipoRel(t.id); setStep("subtipo"); }}
                className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3"
              >
                <span className="text-2xl">{t.emoji}</span>
                <div className="flex-1">
                  <p className="font-display font-bold text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </button>
            ))}
          </>
        )}

        {/* PASSO 2: Subtipo (tipo de equipamento ou OGS) */}
        {step === "subtipo" && tipoRel === "equipamento" && (
          <>
            <p className="text-sm font-semibold text-muted-foreground px-1 mb-3">Qual tipo de equipamento?</p>
            {tiposEquip.map(t => (
              <button
                key={t}
                onClick={() => { setTipoEquip(t); setStep("frota_ogs"); }}
                className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-sm">{t}</p>
                  <p className="text-xs text-muted-foreground">{(frotasPorTipo[t] || []).length} frota{(frotasPorTipo[t] || []).length !== 1 ? "s" : ""}: {(frotasPorTipo[t] || []).join(", ")}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </button>
            ))}
          </>
        )}

        {step === "subtipo" && tipoRel !== "equipamento" && (
          <>
            <p className="text-sm font-semibold text-muted-foreground px-1 mb-3">
              {tipoRel === "rdo" ? "Selecione a OGS" : "Selecione a Frota"}
            </p>
            {tipoRel === "rdo" ? (
              ogsList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma OGS cadastrada.</p>
              ) : (
                ogsList.map(o => (
                  <button
                    key={o.ogs}
                    onClick={() => { setFrotaOgs(o.ogs); setStep("periodo"); }}
                    className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 text-lg">🏗️</div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-sm">OGS {o.ogs}</p>
                      <p className="text-xs text-muted-foreground">{o.cliente}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  </button>
                ))
              )
            ) : (
              // Abastecimento / Manutenção — selecionar frota de todos os equipamentos
              Object.values(frotasPorTipo).flat().sort().map(f => (
                <button
                  key={f}
                  onClick={() => { setFrotaOgs(f); setStep("periodo"); }}
                  className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <p className="font-display font-bold text-sm flex-1">{f}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </button>
              ))
            )}
          </>
        )}

        {/* PASSO 3: Frota */}
        {step === "frota_ogs" && tipoRel === "equipamento" && (
          <>
            <p className="text-sm font-semibold text-muted-foreground px-1 mb-3">Selecione a frota — {tipoEquip}</p>
            {frotas.map(f => (
              <button
                key={f}
                onClick={() => { setFrotaOgs(f); setStep("periodo"); }}
                className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 font-display font-bold text-primary text-sm">
                  {f.slice(0, 2)}
                </div>
                <p className="font-display font-bold text-sm flex-1">{f}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              </button>
            ))}
          </>
        )}

        {/* PASSO 4: Período */}
        {step === "periodo" && (
          <>
            <p className="text-sm font-semibold text-muted-foreground px-1 mb-3">
              Período do relatório — <strong>{frotaOgs}</strong>
            </p>

            <div className="rdo-card space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setTipoPeriodo("dia")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${tipoPeriodo === "dia" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}
                >
                  📅 Dia específico
                </button>
                <button
                  onClick={() => setTipoPeriodo("periodo")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${tipoPeriodo === "periodo" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}
                >
                  📆 Período
                </button>
              </div>

              {tipoPeriodo === "dia" ? (
                <div className="space-y-1.5">
                  <span className="rdo-label">Data</span>
                  <Input type="date" value={dataDia} onChange={e => setDataDia(e.target.value)} className="h-12 rounded-xl text-base" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="rdo-label">Data Inicial</span>
                    <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="rdo-label">Data Final</span>
                    <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                </div>
              )}

              <Button
                onClick={irParaRelatorio}
                disabled={tipoPeriodo === "dia" ? !dataDia : (!dataIni || !dataFim)}
                className="w-full h-12 rounded-xl font-display font-bold gap-2"
              >
                <BarChart3 className="w-5 h-5" /> Gerar Relatório
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
