import { useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOgsReference } from "@/hooks/useOgsReference";
import { CalendarDays, Building2, MapPin, Activity } from "lucide-react";
import { ResponsavelInput } from "./ResponsavelInput";

interface RdoHeaderProps {
  data: {
    data: string;
    obra_nome: string;
    cliente: string;
    local: string;
    status_obra: string;
    turno: string;
    responsavel?: string;  // legado — campo "encarregado" substituiu
    encarregado?: string;
    preenchido_por?: string; // readonly — vem do perfil logado
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
      const num = o.ogs_number || "";
      if (seen.has(num)) return false;
      seen.add(num);
      return true;
    });
  }, [obras]);

  const selectedEntries = useMemo(() => {
    if (!obras || !data.obra_nome) return [];
    return obras.filter(o => o.ogs_number === data.obra_nome);
  }, [obras, data.obra_nome]);

  const uniqueAddresses = useMemo(() => {
    const allAddrs: string[] = [];
    selectedEntries.forEach(e => {
      if (e.location_address) {
        e.location_address.split(";").forEach((s: string) => {
          const trimmed = s.trim();
          if (trimmed && !allAddrs.includes(trimmed)) allAddrs.push(trimmed);
        });
      }
    });
    return allAddrs;
  }, [selectedEntries]);

  // Auto-popula cliente/local quando obra_nome já está preenchido (modo edição)
  useEffect(() => {
    if (!obras || !data.obra_nome || data.cliente) return;
    const entries = obras.filter(o => o.ogs_number === data.obra_nome);
    if (entries.length > 0) {
      onChange("cliente", entries[0].client_name || "");
      const addrs: string[] = [];
      entries.forEach(e => {
        if (e.location_address) {
          e.location_address.split(";").forEach((s: string) => {
            const trimmed = s.trim();
            if (trimmed && !addrs.includes(trimmed)) addrs.push(trimmed);
          });
        }
      });
      if (addrs.length === 1) onChange("local", addrs[0]);
    }
  }, [obras, data.obra_nome]);

  const handleObraChange = (value: string) => {
    onChange("obra_nome", value);
    const entries = obras?.filter(o => o.ogs_number === value) || [];
    if (entries.length > 0) {
      onChange("cliente", entries[0].client_name || "");
      const addrs: string[] = [];
      entries.forEach(e => {
        if (e.location_address) {
          e.location_address.split(";").forEach((s: string) => {
            const trimmed = s.trim();
            if (trimmed && !addrs.includes(trimmed)) addrs.push(trimmed);
          });
        }
      });
      onChange("local", addrs.length === 1 ? addrs[0] : "");
    }
  };

  return (
    <div className="rdo-card space-y-5">
      <h2 className="rdo-section-title">
        <CalendarDays className="w-5 h-5 text-primary" />
        Informações Gerais
      </h2>

      {/* Data + Turno */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className="rdo-label">Data</span>
          <div className="relative">
            <Input
              type="date"
              value={data.data}
              onChange={e => onChange("data", e.target.value)}
              className="h-12 text-base bg-white border-border opacity-0 absolute inset-0 w-full"
            />
            <div className="h-12 text-base bg-white border border-border rounded-xl flex items-center px-3 text-foreground pointer-events-none">
              {formatDateBR(data.data) || "DD/MM/AAAA"}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="rdo-label">Turno *</span>
          <Select value={data.turno} onValueChange={v => onChange("turno", v)}>
            <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
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

      {/* OGS + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className="rdo-label flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> OGS (Obra)
          </span>
          <Select value={data.obra_nome} onValueChange={handleObraChange}>
            <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
              <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {uniqueOgs.map(obra => (
                <SelectItem key={obra.ogs_number || obra.id} value={obra.ogs_number || ""} className="py-3">
                  {obra.ogs_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="rdo-label flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> Status
          </span>
          <Select value={data.status_obra} onValueChange={v => onChange("status_obra", v)}>
            <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
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

      {/* Cliente */}
      <div className="space-y-1.5">
        <span className="rdo-label">Cliente</span>
        <Input value={data.cliente} readOnly className="h-12 text-base bg-muted/50 border-border rounded-xl cursor-not-allowed" />
      </div>

      {/* Preenchido por (auto) + Encarregado (autocomplete) */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <span className="rdo-label">Preenchido por</span>
          <div className="h-12 rounded-xl border border-border bg-muted/50 flex items-center px-3 gap-2">
            <span className="text-sm text-muted-foreground">{data.preenchido_por || "—"}</span>
            <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">automático</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="rdo-label">Encarregado da obra *</span>
          <ResponsavelInput
            value={data.encarregado || ""}
            onChange={v => onChange("encarregado", v)}
            placeholder="Selecione ou digite o encarregado do dia"
          />
        </div>
      </div>

      {/* Local */}
      <div className="space-y-1.5">
        <span className="rdo-label flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> Local
        </span>
        {uniqueAddresses.length > 1 ? (
          <Select value={data.local} onValueChange={v => onChange("local", v)}>
            <SelectTrigger className="h-12 text-base bg-white border-border rounded-xl">
              <SelectValue placeholder="Selecione o local" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {uniqueAddresses.map(addr => (
                <SelectItem key={addr} value={addr} className="py-3">{addr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input value={data.local} readOnly className="h-12 text-base bg-muted/50 border-border rounded-xl cursor-not-allowed" />
        )}
      </div>
    </div>
  );
}
