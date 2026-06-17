import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Plus, Trash2, ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductionArea {
  id: string;
  comp: string;
  larg: string;
  esp: string;
}

interface RdoProducaoRow {
  id: string;
  rdo_id: string;
  comprimento_m: number | null;
  largura_m: number | null;
  espessura_cm: number | null;
  tipo_servico: string | null;
}

interface RdoDiario {
  id: string;
  data: string;
  obra_nome: string;
}

interface Props {
  areas: ProductionArea[];
  onChange: (areas: ProductionArea[]) => void;
  frota?: string;   // frota da fresadora — habilita botão Puxar do RDO
  date?: string;    // data do diário
}

export function createEmptyArea(): ProductionArea {
  return { id: crypto.randomUUID(), comp: "", larg: "", esp: "" };
}

// Normaliza para cálculo: substitui vírgula por ponto
function toNum(val: string): number {
  if (!val) return 0;
  // Apenas garante que vírgula vira ponto para o JavaScript conseguir calcular
  return Number(val.replace(",", "."));
}

function calcM2(a: ProductionArea): number | null {
  const c = toNum(a.comp);
  const l = toNum(a.larg);
  if (!c || !l) return null;
  return c * l;
}

function calcM3(a: ProductionArea): number | null {
  const m2 = calcM2(a);
  const e = toNum(a.esp);
  if (m2 === null || !e) return null;
  return m2 * (e / 100); // esp em cm → m
}

export default function ProductionAreasSection({ areas, onChange, frota, date }: Props) {
  const [loadingRdo, setLoadingRdo] = useState(false);
  const [rdoOptions, setRdoOptions] = useState<{ rdo: RdoDiario; producao: RdoProducaoRow[] }[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const update = (idx: number, field: keyof ProductionArea, value: string) => {
    onChange(areas.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const remove = (idx: number) => onChange(areas.filter((_, i) => i !== idx));
  const add = () => onChange([...areas, createEmptyArea()]);

  const totalM2 = areas.reduce((s, a) => s + (calcM2(a) ?? 0), 0);
  const totalM3 = areas.reduce((s, a) => s + (calcM3(a) ?? 0), 0);

  // Busca RDOs do mesmo dia que têm esta frota nos equipamentos
  const handlePuxarRdo = async () => {
    if (!frota || !date) return;
    setLoadingRdo(true);
    setShowPicker(false);
    try {
      // 1. Achar rdo_ids que têm essa frota
      const { data: rdoEquip } = await (supabase as any)
        .from("rdo_equipamentos")
        .select("rdo_id")
        .ilike("frota", frota.trim());

      if (!rdoEquip || rdoEquip.length === 0) {
        alert(`Nenhum RDO encontrado com a frota ${frota} nessa data.`);
        setLoadingRdo(false);
        return;
      }

      const rdoIds = rdoEquip.map((r: any) => r.rdo_id);

      // 2. Filtrar pelos RDOs da mesma data
      const { data: rdos } = await (supabase as any)
        .from("rdo_diarios")
        .select("id, data, obra_nome")
        .in("id", rdoIds)
        .eq("data", date);

      if (!rdos || rdos.length === 0) {
        alert(`Nenhum RDO encontrado com a frota ${frota} na data ${date}.`);
        setLoadingRdo(false);
        return;
      }

      // 3. Para cada RDO, buscar produção
      const rdoComProducao = await Promise.all(
        rdos.map(async (rdo: RdoDiario) => {
          const { data: producao } = await (supabase as any)
            .from("rdo_producao")
            .select("id, rdo_id, comprimento_m, largura_m, espessura_cm, tipo_servico")
            .eq("rdo_id", rdo.id);
          return { rdo, producao: producao || [] };
        })
      );

      // Filtra apenas linhas de fresagem
      const rdoComFresagem = rdoComProducao.map(r => ({
        ...r,
        producao: r.producao.filter((p: RdoProducaoRow) =>
          !p.tipo_servico || p.tipo_servico.toUpperCase().includes("FRES")
        ),
      }));
      const comProducao = rdoComFresagem.filter(r => r.producao.length > 0);

      if (comProducao.length === 0) {
        alert(`RDO encontrado para ${frota} em ${date}, mas sem produção lançada.`);
        setLoadingRdo(false);
        return;
      }

      if (comProducao.length === 1) {
        // Só um RDO com produção — aplica direto
        aplicarProducao(comProducao[0].producao);
      } else {
        // Vários RDOs — deixa o operador escolher
        setRdoOptions(comProducao);
        setShowPicker(true);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar RDO. Tente novamente.");
    } finally {
      setLoadingRdo(false);
    }
  };

  const aplicarProducao = (producao: RdoProducaoRow[]) => {
    const novas: ProductionArea[] = producao
      .filter(p => p.comprimento_m || p.largura_m)
      .map(p => ({
        id: crypto.randomUUID(),
        comp: p.comprimento_m != null ? String(p.comprimento_m) : "",
        larg: p.largura_m != null ? String(p.largura_m) : "",
        esp: p.espessura_cm != null ? String(p.espessura_cm) : "",
      }));
    if (novas.length > 0) onChange(novas);
    setShowPicker(false);
    setRdoOptions([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">
          Produção — Áreas Fresadas
        </h3>
        <div className="flex items-center gap-3">
          {frota && date && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePuxarRdo}
              disabled={loadingRdo}
              className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              {loadingRdo
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ClipboardList className="w-3 h-3" />}
              Puxar do RDO
            </Button>
          )}
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Σ M² = <strong className="text-foreground">{totalM2.toFixed(1)}</strong></span>
            <span>Σ M³ = <strong className="text-foreground">{totalM3.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* Picker quando há mais de um RDO */}
      {showPicker && rdoOptions.length > 1 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Mais de um RDO encontrado. Escolha:</p>
          {rdoOptions.map(({ rdo, producao }) => (
            <button
              key={rdo.id}
              type="button"
              onClick={() => aplicarProducao(producao)}
              className="w-full text-left rounded-lg border border-border bg-background hover:bg-primary/5 px-3 py-2 text-sm transition-colors"
            >
              <span className="font-medium">{rdo.obra_nome || "Sem nome"}</span>
              <span className="ml-2 text-xs text-muted-foreground">— {producao.length} área{producao.length !== 1 ? "s" : ""} de produção</span>
            </button>
          ))}
          <button type="button" onClick={() => setShowPicker(false)} className="text-xs text-muted-foreground underline">
            Cancelar
          </button>
        </div>
      )}

      {/* Table header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_70px_70px_40px] gap-1 text-[10px] font-bold text-accent uppercase px-1">
        <span>COMP (m)</span>
        <span>LARG (m)</span>
        <span>ESP (cm)</span>
        <span>M²</span>
        <span>M³</span>
        <span></span>
      </div>

      {areas.map((area, idx) => {
        const m2 = calcM2(area);
        const m3 = calcM3(area);
        return (
          <div key={area.id} className="grid grid-cols-[1fr_1fr_1fr_70px_70px_40px] gap-1 items-center">
            <NumericInput
              value={area.comp}
              onChange={(e) => update(idx, "comp", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
            <NumericInput
              value={area.larg}
              onChange={(e) => update(idx, "larg", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
            <NumericInput
              value={area.esp}
              onChange={(e) => update(idx, "esp", e.target.value)}
              placeholder="0"
              className="bg-secondary border-border h-9 text-xs"
            />
            <span className="text-xs text-foreground text-center font-medium">
              {m2 !== null ? m2.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-foreground text-center font-medium">
              {m3 !== null ? m3.toFixed(2) : "—"}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(idx)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={add}>
        <Plus className="w-3.5 h-3.5" /> Adicionar área
      </Button>
    </div>
  );
}
