import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Funcionario {
  id: string;
  nome: string;
  funcao: string;
  matricula: string;
}

interface Registro {
  id: string;
  staff_id: string;
  tipo: string;
  data: string;
  hora: string;
  ogs_number: string | null;
  turno: string | null;
  fora_raio: boolean | null;
  distancia_m: number | null;
  photo_url: string | null;
  metodo: string;
}

interface DiaResumo {
  data: string;
  entradas: { hora: string; turno: string | null; fora_raio: boolean }[];
  saidas: { hora: string; turno: string | null; fora_raio: boolean }[];
  horasTrabalhadas: number;
  horasExtras: number;
  ogs: string | null;
  alertaGeo: boolean;
}

function toMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function fmtHoras(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function EspelhoPonto() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { profile } = useUserProfile();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [jornadaPadrao, setJornadaPadrao] = useState(8);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (supabase as any).from("funcionarios").select("id, nome, funcao, matricula").order("nome")
      .then(({ data }: any) => { if (data) setFuncionarios(data); });
  }, []);

  useEffect(() => {
    if (!selectedId || !mes) return;
    setLoading(true);
    const [y, m] = mes.split("-");
    const ini = `${y}-${m}-01`;
    const fim = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;
    (supabase as any)
      .from("ponto_registros")
      .select("id, staff_id, tipo, data, hora, ogs_number, turno, fora_raio, distancia_m, photo_url, metodo")
      .eq("staff_id", selectedId)
      .gte("data", ini)
      .lte("data", fim)
      .order("data").order("hora")
      .then(({ data }: any) => {
        if (data) setRegistros(data);
        setLoading(false);
      });
  }, [selectedId, mes]);

  const diasResumo = useMemo((): DiaResumo[] => {
    const byData = new Map<string, Registro[]>();
    for (const r of registros) {
      if (!byData.has(r.data)) byData.set(r.data, []);
      byData.get(r.data)!.push(r);
    }

    return Array.from(byData.entries()).map(([data, regs]) => {
      const entradas = regs.filter(r => r.tipo === "entrada").map(r => ({
        hora: r.hora.slice(0, 5), turno: r.turno, fora_raio: !!r.fora_raio
      }));
      const saidas = regs.filter(r => r.tipo === "saida").map(r => ({
        hora: r.hora.slice(0, 5), turno: r.turno, fora_raio: !!r.fora_raio
      }));

      // Calcula horas trabalhadas (pares entrada/saída)
      let totalMin = 0;
      const pairs = Math.min(entradas.length, saidas.length);
      for (let i = 0; i < pairs; i++) {
        let diff = toMin(saidas[i].hora) - toMin(entradas[i].hora);
        if (diff < 0) diff += 24 * 60; // turno noturno atravessa meia-noite
        totalMin += diff;
      }
      const horasTrabalhadas = totalMin / 60;
      const horasExtras = Math.max(0, horasTrabalhadas - jornadaPadrao);

      return {
        data,
        entradas,
        saidas,
        horasTrabalhadas,
        horasExtras,
        ogs: regs[0]?.ogs_number || null,
        alertaGeo: regs.some(r => r.fora_raio),
      };
    });
  }, [registros, jornadaPadrao]);

  const totalHoras = diasResumo.reduce((s, d) => s + d.horasTrabalhadas, 0);
  const totalExtras = diasResumo.reduce((s, d) => s + d.horasExtras, 0);
  const diasComAlerta = diasResumo.filter(d => d.alertaGeo).length;

  const selecionado = funcionarios.find(f => f.id === selectedId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Espelho de Ponto</h1>
          <p className="text-[10px] text-primary-foreground/70">Jornada mensal detalhada</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-10">

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-3">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="h-11 rounded-xl border border-border bg-secondary px-3 text-sm"
          >
            <option value="">Selecione funcionário</option>
            {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="h-11 px-3 rounded-xl border border-border bg-secondary text-sm"
          />
        </div>

        {/* Jornada padrão */}
        <div className="flex items-center gap-3 bg-card rounded-xl border border-border px-4 py-3">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm flex-1">Jornada padrão</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setJornadaPadrao(j => Math.max(4, j - 0.5))} className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-sm font-bold hover:bg-muted">−</button>
            <span className="text-sm font-bold w-10 text-center">{jornadaPadrao}h</span>
            <button onClick={() => setJornadaPadrao(j => Math.min(12, j + 0.5))} className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-sm font-bold hover:bg-muted">+</button>
          </div>
        </div>

        {/* Resumo do mês */}
        {selecionado && diasResumo.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <Calendar className="w-3.5 h-3.5" />, val: diasResumo.length, label: "Dias", color: "" },
              { icon: <Clock className="w-3.5 h-3.5" />, val: fmtHoras(totalHoras), label: "Total", color: "" },
              { icon: <Clock className="w-3.5 h-3.5" />, val: fmtHoras(totalExtras), label: "Extras", color: "text-amber-600" },
              { icon: <AlertTriangle className="w-3.5 h-3.5" />, val: diasComAlerta, label: "Alertas", color: "text-red-500" },
            ].map((c, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-2.5 text-center">
                <div className={`flex justify-center mb-1 ${c.color || "text-primary"}`}>{c.icon}</div>
                <p className={`text-base font-bold ${c.color}`}>{c.val}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lista diária */}
        {loading && <p className="text-center text-sm text-muted-foreground py-6">Carregando...</p>}

        {!loading && selecionado && diasResumo.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum registro encontrado.</p>
        )}

        {!loading && selecionado && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground px-1">{selecionado.nome} · {selecionado.funcao}</p>
            {diasResumo.map(dia => {
              const dataObj = new Date(dia.data + "T12:00:00");
              const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "short" });
              const diaNum = dataObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
              return (
                <div key={dia.data} className={`bg-card rounded-xl border p-3 space-y-2 ${dia.alertaGeo ? "border-amber-300" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{diaNum}</span>
                      <span className="text-xs text-muted-foreground capitalize">{diaSemana}</span>
                      {dia.ogs && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{dia.ogs}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dia.alertaGeo && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                      <span className="text-sm font-bold">{fmtHoras(dia.horasTrabalhadas)}</span>
                      {dia.horasExtras > 0 && (
                        <span className="text-xs text-amber-600 font-bold">+{fmtHoras(dia.horasExtras)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dia.entradas.map((e, i) => (
                      <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${e.fora_raio ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                        🟢 {e.hora} {e.turno ? `(${e.turno})` : ""}
                        {e.fora_raio ? " ⚠️" : ""}
                      </span>
                    ))}
                    {dia.saidas.map((s, i) => (
                      <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.fora_raio ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        🔴 {s.hora} {s.turno ? `(${s.turno})` : ""}
                        {s.fora_raio ? " ⚠️" : ""}
                      </span>
                    ))}
                    {dia.entradas.length === 0 && dia.saidas.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">Sem registros</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
