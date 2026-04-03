import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface StaffMember {
  id: string;
  nome: string;
  funcao: string;
}

interface PontoRegistro {
  id: string;
  staff_id: string;
  tipo: string;
  data: string;
  hora: string;
  ogs_number: string | null;
  metodo: string;
}

interface DaySummary {
  date: string;
  entrada: string | null;
  saida: string | null;
  horasTrabalhadas: number;
  horasExtras: number;
  ogsNumber: string | null;
  metodo: string;
}

export default function EspelhoPonto() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [registros, setRegistros] = useState<PontoRegistro[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [jornadaPadrao, setJornadaPadrao] = useState(8);

  useEffect(() => {
    supabase.from("aero_pav_gru_staff").select("id, nome, funcao").eq("ativo", true).order("nome").then(({ data }) => {
      if (data) setStaff(data as StaffMember[]);
    });
  }, []);

  useEffect(() => {
    if (!selectedStaffId || !month) return;
    const [y, m] = month.split("-");
    const startDate = `${y}-${m}-01`;
    const endDate = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;

    supabase
      .from("ponto_registros" as any)
      .select("id, staff_id, tipo, data, hora, ogs_number, metodo")
      .eq("staff_id", selectedStaffId)
      .gte("data", startDate)
      .lte("data", endDate)
      .order("data", { ascending: true })
      .order("hora", { ascending: true })
      .then(({ data }) => {
        if (data) setRegistros(data as any as PontoRegistro[]);
      });
  }, [selectedStaffId, month]);

  const daySummaries = useMemo((): DaySummary[] => {
    const byDate = new Map<string, PontoRegistro[]>();
    for (const r of registros) {
      if (!byDate.has(r.data)) byDate.set(r.data, []);
      byDate.get(r.data)!.push(r);
    }

    const summaries: DaySummary[] = [];
    for (const [date, regs] of byDate) {
      const entrada = regs.find((r) => r.tipo === "entrada");
      const saida = regs.find((r) => r.tipo === "saida");

      let horasTrabalhadas = 0;
      if (entrada && saida) {
        const [eh, em] = entrada.hora.split(":").map(Number);
        const [sh, sm] = saida.hora.split(":").map(Number);
        horasTrabalhadas = Math.max(0, sh + sm / 60 - (eh + em / 60));
      }

      const horasExtras = Math.max(0, horasTrabalhadas - jornadaPadrao);

      summaries.push({
        date,
        entrada: entrada?.hora.slice(0, 5) || null,
        saida: saida?.hora.slice(0, 5) || null,
        horasTrabalhadas: Math.round(horasTrabalhadas * 100) / 100,
        horasExtras: Math.round(horasExtras * 100) / 100,
        ogsNumber: regs[0]?.ogs_number || null,
        metodo: regs[0]?.metodo || "manual",
      });
    }
    return summaries;
  }, [registros, jornadaPadrao]);

  const totalHoras = useMemo(() => daySummaries.reduce((s, d) => s + d.horasTrabalhadas, 0), [daySummaries]);
  const totalExtras = useMemo(() => daySummaries.reduce((s, d) => s + d.horasExtras, 0), [daySummaries]);

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Espelho de Ponto</h1>
          <p className="text-[10px] text-primary-foreground/70">Histórico mensal de jornada</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-3">
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="h-10 bg-secondary"><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 px-3 rounded-md border bg-secondary text-sm"
          />
        </div>

        {/* Summary cards */}
        {selectedStaff && daySummaries.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Calendar className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold">{daySummaries.length}</p>
                <p className="text-[10px] text-muted-foreground">Dias</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold">{totalHoras.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Clock className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                <p className="text-lg font-bold text-amber-600">{totalExtras.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">Extras</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Day-by-day list */}
        {selectedStaff && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{selectedStaff.nome}</p>
              <Badge variant="outline" className="text-[9px]">{selectedStaff.funcao}</Badge>
            </div>

            {daySummaries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro encontrado para este mês.</p>
            )}

            {daySummaries.map((day) => (
              <Card key={day.date}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold">
                      {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {day.ogsNumber && (
                        <Badge variant="secondary" className="text-[9px]">
                          <MapPin className="h-2.5 w-2.5 mr-0.5" />{day.ogsNumber}
                        </Badge>
                      )}
                      <Badge variant={day.metodo === "facial" ? "default" : "outline"} className="text-[9px]">
                        {day.metodo === "facial" ? "🤖 Facial" : "✋ Manual"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>🟢 {day.entrada || "--:--"}</span>
                    <span>🔴 {day.saida || "--:--"}</span>
                    <span className="ml-auto font-semibold text-foreground">{day.horasTrabalhadas.toFixed(1)}h</span>
                    {day.horasExtras > 0 && (
                      <span className="text-amber-600 font-bold">+{day.horasExtras.toFixed(1)}h</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
