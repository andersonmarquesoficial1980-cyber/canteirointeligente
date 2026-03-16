import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMaquinasFrotaFiltered } from "@/hooks/useFilteredData";
import { Plus, Trash2, Wrench } from "lucide-react";
import { useRef, useEffect, useMemo } from "react";

export interface EquipamentoEntry {
  id: string;
  categoria: string;
  subTipo: string;
  frota: string;
  tipo: string;
  nome: string;
  patrimonio: string;
  empresa_dona: string;
  is_menor: boolean;
}

interface Props {
  entries: EquipamentoEntry[];
  onChange: (entries: EquipamentoEntry[]) => void;
  tipoRdo: string;
}

// New granular categories
const CATEGORIAS = [
  "FRESADORA",
  "BOBCAT",
  "VIBROACABADORA",
  "ROLO COMPACTADOR",
  "VEÍCULOS EM GERAL",
  "USINA MÓVEL",
  "LINHA AMARELA",
  "PEQUENO PORTE",
] as const;

// Categories that require a sub-type selection before fleet
const SUB_TIPOS: Record<string, string[]> = {
  "ROLO COMPACTADOR": ["ROLO CHAPA", "ROLO PNEU", "ROLO PÉ DE CARNEIRO"],
  "VEÍCULOS EM GERAL": [
    "CAMINHÃO BASCULANTE",
    "CAMINHÃO CARROCERIA",
    "CAMINHÃO COMBOIO",
    "CAMINHÃO ESPARGIDOR",
    "CAMINHÃO PIPA",
    "CAMINHÃO PLATAFORMA",
    "CAVALO MECANICO",
    "MICROONIBUS",
    "VAN",
  ],
  "LINHA AMARELA": [
    "RETROESCAVADEIRA",
    "ESCAVADEIRA",
    "PÁ CARREGADEIRA",
    "MOTONIVELADORA",
    "TRATOR",
  ],
};

// Map new categories to their `tipo` filter values in maquinas_frota
const CATEGORIA_TIPO_MAP: Record<string, string[]> = {
  FRESADORA: ["FRESADORA"],
  BOBCAT: ["BOBCAT"],
  VIBROACABADORA: ["VIBRO ACABADORA"],
  "USINA MÓVEL": ["USINA MÓVEL"],
};

const emptyEquip = (): EquipamentoEntry => ({
  id: crypto.randomUUID(),
  categoria: "",
  subTipo: "",
  frota: "",
  tipo: "",
  nome: "",
  patrimonio: "",
  empresa_dona: "",
  is_menor: false,
});

export default function SectionEquipamentos({ entries, onChange, tipoRdo }: Props) {
  const { data: maquinas } = useMaquinasFrotaFiltered(tipoRdo);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const prevCountRef = useRef(entries.length);

  useEffect(() => {
    if (entries.length > prevCountRef.current && addBtnRef.current) {
      addBtnRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    prevCountRef.current = entries.length;
  }, [entries.length]);

  const update = (id: string, field: string, value: any) => {
    if (field === "categoria") {
      onChange(
        entries.map((e) =>
          e.id === id
            ? { ...e, categoria: value, subTipo: "", frota: "", tipo: "", nome: "", empresa_dona: "" }
            : e
        )
      );
    } else if (field === "subTipo") {
      onChange(
        entries.map((e) =>
          e.id === id
            ? { ...e, subTipo: value, frota: "", tipo: "", nome: "", empresa_dona: "" }
            : e
        )
      );
    } else if (field === "frota") {
      const maq = maquinas?.find((m: any) => m.frota === value);
      onChange(
        entries.map((e) =>
          e.id === id
            ? { ...e, frota: value, tipo: maq?.tipo || "", nome: maq?.nome || "", empresa_dona: maq?.empresa || "" }
            : e
        )
      );
    } else {
      onChange(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    }
  };

  const getFilteredMaquinas = (categoria: string, subTipo: string) => {
    if (!maquinas) return [];
    const hasSubTypes = SUB_TIPOS[categoria];
    if (hasSubTypes) {
      // Filter by the selected sub-type (matches `tipo` column)
      if (!subTipo) return [];
      return maquinas.filter((m: any) => m.tipo?.toUpperCase() === subTipo.toUpperCase());
    }
    // Direct categories: filter by tipo values mapped
    const tipoFilters = CATEGORIA_TIPO_MAP[categoria];
    if (tipoFilters) {
      return maquinas.filter((m: any) =>
        tipoFilters.some((t) => m.tipo?.toUpperCase() === t.toUpperCase())
      );
    }
    // Fallback: filter by categoria
    return maquinas.filter((m: any) => m.categoria?.toUpperCase() === categoria.toUpperCase());
  };

  const needsSubType = (categoria: string) => !!SUB_TIPOS[categoria];

  return (
    <div className="space-y-4 px-4">
      <h2 className="rdo-section-title">
        <Wrench className="w-5 h-5 text-orange-500" />
        Equipamentos
      </h2>

      {entries.map((entry, idx) => {
        const subTypes = SUB_TIPOS[entry.categoria] || [];
        const showFleet = entry.categoria && (!needsSubType(entry.categoria) || entry.subTipo);
        const filteredFleets = getFilteredMaquinas(entry.categoria, entry.subTipo);

        return (
          <div key={entry.id} className="rdo-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-bold text-primary">Equip. {idx + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update(entry.id, "is_menor", !entry.is_menor)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    entry.is_menor
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-white text-muted-foreground border-border"
                  }`}
                >
                  {entry.is_menor ? "Menor ✓" : "Menor?"}
                </button>
                {entries.length > 1 && (
                  <button
                    onClick={() => onChange(entries.filter((e) => e.id !== entry.id))}
                    className="text-destructive p-1 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {entry.is_menor ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="rdo-label">Patrimônio</span>
                  <Input
                    value={entry.patrimonio}
                    onChange={(e) => update(entry.id, "patrimonio", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Empresa Dona</span>
                  <Input
                    value={entry.empresa_dona}
                    onChange={(e) => update(entry.id, "empresa_dona", e.target.value)}
                    className="h-11 bg-white border-border rounded-xl"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Step 1: Category */}
                <div className="space-y-1.5">
                  <span className="rdo-label">Categoria *</span>
                  <Select value={entry.categoria} onValueChange={(v) => update(entry.id, "categoria", v)}>
                    <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Sub-type (only for Rolo, Veículos, Linha Amarela) */}
                {entry.categoria && subTypes.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="rdo-label">Tipo *</span>
                    <Select value={entry.subTipo} onValueChange={(v) => update(entry.id, "subTipo", v)}>
                      <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {subTypes.map((st) => (
                          <SelectItem key={st} value={st}>
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Step 3: Fleet selection */}
                {showFleet && (
                  <div className="space-y-1.5">
                    <span className="rdo-label">Equipamento (Frota)</span>
                    {filteredFleets.length > 0 ? (
                      <Select value={entry.frota} onValueChange={(v) => update(entry.id, "frota", v)}>
                        <SelectTrigger className="h-11 bg-white border-border rounded-xl">
                          <SelectValue placeholder="Selecione o equipamento" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px]">
                          {filteredFleets.map((m: any) => (
                            <SelectItem key={m.id} value={m.frota}>
                              {m.frota} — {m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-2">
                        Nenhum equipamento disponível para este tipo.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Button
        ref={addBtnRef}
        size="sm"
        onClick={() => onChange([...entries, emptyEquip()])}
        className="w-full h-12 gap-2 text-base rounded-xl font-display font-bold"
      >
        <Plus className="w-5 h-5" /> Adicionar Equipamento
      </Button>
    </div>
  );
}
