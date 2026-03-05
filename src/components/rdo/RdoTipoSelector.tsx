interface RdoTipoSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const TIPOS = [
  { value: "CAUQ", label: "CAUQ", icon: "🛣️", desc: "Concreto Asfáltico" },
  { value: "INFRAESTRUTURA", label: "Infra", icon: "🏗️", desc: "Infraestrutura" },
  { value: "CANTEIRO", label: "Canteiro", icon: "🏭", desc: "Canteiro / Insumos" },
];

export default function RdoTipoSelector({ value, onChange }: RdoTipoSelectorProps) {
  return (
    <div className="space-y-2 p-4">
      <h2 className="text-lg font-bold text-foreground">Tipo de RDO</h2>
      <div className="grid grid-cols-3 gap-3">
        {TIPOS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              value === t.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary/50"
            }`}
          >
            <span className="text-2xl block mb-1">{t.icon}</span>
            <span className="text-sm font-bold block">{t.label}</span>
            <span className="text-[10px] opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
