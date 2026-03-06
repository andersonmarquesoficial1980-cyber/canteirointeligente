import { useMemo, useEffect } from "react";
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
  };
  onChange: (field: string, value: string) => void;
}

const STATUS_OPTIONS = ["Trabalhou", "Cancelou", "Folga"];

export default function RdoHeader({ data, onChange }: RdoHeaderProps) {
  const { data: obras, isLoading } = useOgsReference();

  // Deduplicated OGS numbers
  const uniqueOgs = useMemo(() => {
    if (!obras) return [];
    const seen = new Set<string>();
    return obras.filter(o => {
      if (seen.has(o.numero_ogs)) return false;
      seen.add(o.numero_ogs);
      return true;
    });
  }, [obras]);

  // All entries for selected OGS
  const selectedEntries = useMemo(() => {
    if (!obras || !data.obra_nome) return [];
    return obras.filter(o => o.numero_ogs === data.obra_nome);
  }, [obras, data.obra_nome]);

  // Unique addresses for selected OGS
  const uniqueAddresses = useMemo(() => {
    const addrs = [...new Set(selectedEntries.map(e => e.endereco))];
    return addrs;
  }, [selectedEntries]);

  const handleObraChange = (value: string) => {
    onChange("obra_nome", value);
    const entries = obras?.filter(o => o.numero_ogs === value) || [];
    if (entries.length > 0) {
      onChange("cliente", entries[0].cliente);
      const addrs = [...new Set(entries.map(e => e.endereco))];
      if (addrs.length === 1) {
        onChange("local", addrs[0]);
      } else {
        onChange("local", "");
      }
    }
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-xl border border-border">
      <h2 className="text-lg font-bold text-foreground">📋 Dados Gerais</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Data</Label>
          <Input
            type="date"
            value={data.data}
            onChange={e => onChange("data", e.target.value)}
            className="h-12 text-base bg-secondary border-border"
          />
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

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">OGS (Obra)</Label>
        <Select value={data.obra_nome} onValueChange={handleObraChange}>
          <SelectTrigger className="h-12 text-base bg-secondary border-border">
            <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione a OGS"} />
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Input value={data.cliente} readOnly className="h-12 text-base bg-muted border-border cursor-not-allowed" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Local</Label>
          {uniqueAddresses.length > 1 ? (
            <Select value={data.local} onValueChange={v => onChange("local", v)}>
              <SelectTrigger className="h-12 text-base bg-secondary border-border">
                <SelectValue placeholder="Selecione o local" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {uniqueAddresses.map(addr => (
                  <SelectItem key={addr} value={addr} className="py-3">
                    {addr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={data.local} readOnly className="h-12 text-base bg-muted border-border cursor-not-allowed" />
          )}
        </div>
      </div>
    </div>
  );
}
