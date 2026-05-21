/**
 * BancoHoras — Saldo de horas por funcionário
 * Calcula automaticamente: horas trabalhadas vs jornada padrão
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Funcionario { id: string; nome: string; funcao: string; matricula: string; }
interface Registro { staff_id: string; data: string; hora: string; tipo: string; turno: string | null; }

interface SaldoFuncionario {
  funcionario: Funcionario;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
  diasTrabalhados: number;
}

function fmtHoras(h: number): string {
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  const sinal = h < 0 ? "-" : h > 0 ? "+" : "";
  return `${sinal}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function toMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function BancoHoras() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [jornadaPadrao, setJornadaPadrao] = useState(8);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (supabase as any).from("funcionarios").select("id, nome, funcao, matricula").order("nome")
      .then(({ data }: any) => { if (data) setFuncionarios(data); });
  }, []);

  useEffect(() => {
    if (!mes) return;
    setLoading(true);
    const [y, m] = mes.split("-");
    const ini = `${y}-${m}-01`;
    const fim = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;

    (supabase as any)
      .from("ponto_registros")
      .select("staff_id, data, hora, tipo, turno")
      .gte("data", ini)
      .lte("data", fim)
      .order("data").order("hora")
      .then(({ data }: any) => {
        if (data) setRegistros(data);
        setLoading(false);
      });
  }, [mes]);

  const saldos = useMemo((): SaldoFuncionario[] => {
    // Agrupa registros por funcionário e por data
    const byFunc = new Map<string, Map<string, Registro[]>>();
    for (const r of registros) {
      if (!byFunc.has(r.staff_id)) byFunc.set(r.staff_id, new Map());
      const byData = byFunc.get(r.staff_id)!;
      if (!byData.has(r.data)) byData.set(r.data, []);
      byData.get(r.data)!.push(r);
    }

    return funcionarios.map(func => {
      const byData = byFunc.get(func.id);
      if (!byData) return { funcionario: func, horasTrabalhadas: 0, horasPrevistas: 0, saldo: 0, diasTrabalhados: 0 };

      let totalMin = 0;
      let diasTrabalhados = 0;

      for (const [, regs] of byData) {
        const entradas = regs.filter(r => r.tipo === "entrada").sort((a, b) => a.hora.localeCompare(b.hora));
        const saidas = regs.filter(r => r.tipo === "saida").sort((a, b) => a.hora.localeCompare(b.hora));
        const pairs = Math.min(entradas.length, saidas.length);
        if (pairs === 0) continue;
        diasTrabalhados++;
        for (let i = 0; i < pairs; i++) {
          let diff = toMin(saidas[i].hora) - toMin(entradas[i].hora);
          if (diff < 0) diff += 24 * 60; // turno noturno
          totalMin += diff;
        }
      }

      const horasTrabalhadas = totalMin / 60;
      const horasPrevistas = diasTrabalhados * jornadaPadrao;
      const saldo = horasTrabalhadas - horasPrevistas;

      return { funcionario: func, horasTrabalhadas, horasPrevistas, saldo, diasTrabalhados };
    }).filter(s => s.diasTrabalhados > 0 || busca); // oculta quem não trabalhou no mês (a menos que buscando)
  }, [funcionarios, registros, jornadaPadrao, busca]);

  const filtrados = busca.trim()
    ? saldos.filter(s => s.funcionario.nome.toLowerCase().includes(busca.toLowerCase()) || s.funcionario.matricula?.includes(busca))
    : saldos;

  const totalPositivo = saldos.filter(s => s.saldo > 0).reduce((acc, s) => acc + s.saldo, 0);
  const totalNegativo = saldos.filter(s => s.saldo < 0).reduce((acc, s) => acc + s.saldo, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Banco de Horas</h1>
          <p className="text-[10px] text-primary-foreground/70">Saldo mensal por funcionário</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-10">

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-3">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="h-11 px-3 rounded-xl border border-border bg-secondary text-sm" />
          <div className="flex items-center gap-2 bg-secondary rounded-xl border border-border px-3">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Jornada</span>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setJornadaPadrao(j => Math.max(4, j - 0.5))} className="w-6 h-6 rounded-full text-sm font-bold hover:bg-muted flex items-center justify-center">−</button>
              <span className="text-sm font-bold w-8 text-center">{jornadaPadrao}h</span>
              <button onClick={() => setJornadaPadrao(j => Math.min(12, j + 0.5))} className="w-6 h-6 rounded-full text-sm font-bold hover:bg-muted flex items-center justify-center">+</button>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar funcionário..."
            className="w-full h-10 pl-9 rounded-xl border border-border bg-secondary text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {/* Resumo */}
        {!loading && saldos.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-base font-bold text-green-700">{fmtHoras(totalPositivo)}</p>
              <p className="text-[10px] text-green-600">Horas positivas</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
              <p className="text-base font-bold text-red-600">{fmtHoras(totalNegativo)}</p>
              <p className="text-[10px] text-red-500">Horas negativas</p>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-sm text-muted-foreground py-6">Calculando saldos...</p>}

        {!loading && filtrados.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum registro encontrado para este mês.</p>
        )}

        {/* Lista */}
        {!loading && filtrados.map(s => (
          <div key={s.funcionario.id} className={`bg-card rounded-xl border p-3 flex items-center gap-3 ${
            s.saldo > 0 ? "border-green-200" : s.saldo < 0 ? "border-red-200" : "border-border"
          }`}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{s.funcionario.nome}</p>
              <p className="text-xs text-muted-foreground">{s.funcionario.funcao} · {s.diasTrabalhados} dias</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-base font-bold ${s.saldo > 0 ? "text-green-600" : s.saldo < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {fmtHoras(s.saldo)}
              </p>
              <p className="text-[10px] text-muted-foreground">{fmtHoras(s.horasTrabalhadas).replace("+", "")} / {fmtHoras(s.horasPrevistas).replace("+", "")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
