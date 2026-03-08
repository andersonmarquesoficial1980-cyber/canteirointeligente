import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOgsReference } from "@/hooks/useOgsReference";

interface RdoHeaderProps {
  data: {
    data: string;
    obra_nome: string;
    cliente: string;
    local: string;
    status_obra: string;
    turno: string;
  };
  onChange: (field: string, value: string) => void;
}

const TURNO_OPTIONS = [
  { label: "Diurno", value: "diurno" },
  { label: "Noturno", value: "noturno" },
];

const STATUS_OPTIONS = ["Trabalhou", "Cancelou", "Folga"];

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function RdoHeader({ data, onChange }: RdoHeaderProps) {
  const { data: obras, isLoading } = useOgsReference();

  const uniqueOgs = useMemo(() => {
    if (!obras) return [];
    const seen = new Set<string>();
    return obras.filter(o => {
      if (seen.has(o.numero_ogs)) return false;
      seen.add(o.numero_ogs);
      return true;
    });
  }, [obras]);

  const selectedEntries = useMemo(() => {
    if (!obras || !data.obra_nome) return [];
    return obras.filter(o => o.numero_ogs === data.obra_nome);
  }, [obras, data.obra_nome]);

  const uniqueAddresses = useMemo(() => {
    return [...new Set(selectedEntries.map(e => e.endereco))];
  }, [selectedEntries]);

  const handleObraChange = (value: string) => {
    onChange("obra_nome", value);
    const entries = obras?.filter(o => o.numero_ogs === value) || [];
    if (entries.length > 0) {
      onChange("cliente", entries[0].cliente);
      const addrs = [...new Set(entries.map(e => e.endereco))];
      onChange("local", addrs.length === 1 ? addrs[0] : "");
    }
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-xl border border-border">
      <h2 className="text-lg font-bold text-foreground">📋 Dados Gerais</h2>

      {/* Linha 1: Data + Turno */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data</Label>
          <div className="relative">
            <Input
              type="date"
              value={data.data}
              onChange={e => onChange("data", e.target.value)}
              className="h-12 text-base bg-secondary border-border opacity-0 absolute inset-0 w-full"
            />
            <div className="h-12 text-base bg-secondary border border-border rounded-md flex items-center px-3 text-foreground pointer-events-none">
              {formatDateBR(data.data) || "DD/MM/AAAA"}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Turno *</Label>
          <Select value={data.turno} onValueChange={v => onChange("turno", v)}>
            <SelectTrigger className="h-12 text-base bg-secondary border-border">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TURNO_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 2: OGS + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">OGS (Obra)</Label>
          <Select value={data.obra_nome} onValueChange={handleObraChange}>
            <SelectTrigger className="h-12 text-base bg-secondary border-border">
              <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {uniqueOgs.map(obra => (
                <SelectItem key={obra.numero_ogs} value={obra.numero_ogs} className="py-3">
                  {obra.numero_ogs}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={data.status_obra} onValueChange={v => onChange("status_obra", v)}>
            <SelectTrigger className="h-12 text-base bg-secondary border-border">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 3: Cliente (100%) */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Cliente</Label>
        <Input value={data.cliente} readOnly className="h-12 text-base bg-muted border-border cursor-not-allowed" />
      </div>

      {/* Linha 4: Local (100%) */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Local</Label>
        {uniqueAddresses.length > 1 ? (
          <Select value={data.local} onValueChange={v => onChange("local", v)}>
            <SelectTrigger className="h-12 text-base bg-secondary border-border">
              <SelectValue placeholder="Selecione o local" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {uniqueAddresses.map(addr => (
                <SelectItem key={addr} value={addr} className="py-3">{addr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input value={data.local} readOnly className="h-12 text-base bg-muted border-border cursor-not-allowed" />
        )}
      </div>
    </div>
  );
}
