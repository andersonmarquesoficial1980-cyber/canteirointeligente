import { Layers } from "lucide-react";
// PV module active v2

interface RdoTipoSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const TIPOS = [
  { value: "CAUQ", label: "PAVIMENTAÇÃO", icon: "🛣️", desc: "Concreto Asfáltico" },
  { value: "INFRAESTRUTURA", label: "Infra", icon: "🏗️", desc: "Infraestrutura" },
  { value: "CANTEIRO", label: "Canteiro", icon: "🏭", desc: "Canteiro / Insumos" },
  { value: "PV", label: "PV", icon: "🕳️", desc: "Poço de Visita" },
  { value: "AEROPAV", label: "Aeroportuário", icon: "✈️", desc: "Terraplanagem & Drenagem" },
];

export default function RdoTipoSelector({ value, onChange }: RdoTipoSelectorProps) {
  return (
    <div className="rdo-card space-y-4">
      <h2 className="rdo-section-title">
        <Layers className="w-5 h-5 text-primary" />
        Tipo de RDO
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TIPOS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${
              value === t.value
                ? "bg-primary text-primary-foreground border-primary shadow-card"
                : "bg-white text-foreground border-border hover:border-primary/40 hover:shadow-sm"
            }`}
          >
            <span className="text-2xl block mb-1">{t.icon}</span>
            <span className="text-sm font-display font-bold block">{t.label}</span>
            <span className="text-[10px] opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
