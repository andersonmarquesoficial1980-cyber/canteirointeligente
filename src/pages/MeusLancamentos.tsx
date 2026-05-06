import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoCi from "@/assets/logo-workflux.png";

interface Lancamento {
  id: string;
  created_at: string | null;
  date: string | null;
  equipment_fleet: string | null;
  equipment_type: string | null;
  work_status: string | null;
  period: string | null;
  operator_name: string | null;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
  observations: string | null;
  meter_initial: number | null;
  meter_final: number | null;
  odometer_initial: number | null;
  odometer_final: number | null;
  fuel_liters: number | null;
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function MeusLancamentos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aba, setAba] = useState<"equipamentos" | "rdos">("equipamentos");
  const [rdos, setRdos] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [frotas, setFrotas] = useState<string[]>([]);
  const [tipoEquipamento, setTipoEquipamento] = useState("todos");
  const [frotaSelecionada, setFrotaSelecionada] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selecionado, setSelecionado] = useState<Lancamento | null>(null);
  const [detalheExtra, setDetalheExtra] = useState<{ areas: any[]; bits: any[]; horas: number | null }>({ areas: [], bits: [], horas: null });

  const abrirDetalhe = async (item: Lancamento) => {
    setSelecionado(item);
    setEditandoId(null);
    setDetalheExtra({ areas: [], bits: [], horas: null });
    const [{ data: areas }, { data: bits }, { data: times }] = await Promise.all([
      supabase.from('equipment_production_areas').select('length_m,width_m,thickness_cm,m2,m3').eq('diary_id', item.id),
      supabase.from('bit_entries').select('quantity,brand,status,meter_at_change').eq('diary_id', item.id),
      supabase.from('equipment_time_entries').select('start_time,end_time,activity').eq('diary_id', item.id),
    ]);
    // Atividades produtivas (horas trabalhando)
    const PARADAS = ['Refeições', 'À Disposição', 'Manutenção'];
    let horasTotal = 0;
    (times || []).forEach((t: any) => {
      if (t.start_time && t.end_time && !PARADAS.includes(t.activity || '')) {
        const [sh, sm] = t.start_time.split(':').map(Number);
        const [eh, em] = t.end_time.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60; // virada de turno
        horasTotal += diff / 60;
      }
    });
    setDetalheExtra({ areas: areas || [], bits: bits || [], horas: horasTotal > 0 ? Math.round(horasTotal * 10) / 10 : null });
  };

  const handleEditarLancamento = async (item: Lancamento) => {
    setEditandoId(item.id);
    await new Promise((resolve) => setTimeout(resolve, 200));
    navigate(
      `/equipamentos/diario?edit=${item.id}&tipo=${encodeURIComponent(
        item.equipment_type || "",
      )}&frota=${encodeURIComponent(item.equipment_fleet || "")}`,
    );
  };

  const carregar = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setLancamentos([]);
      setTipos([]);
      setLoading(false);
      return;
    }

    // Verificar perfil do usuário — admin vê todos os lançamentos da empresa
    const { data: profileData } = await supabase
      .from("profiles")
      .select("perfil, role, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdminUser = (profileData as any)?.perfil === "Administrador" || (profileData as any)?.role === "superadmin";
    const companyId = (profileData as any)?.company_id;
    setIsAdmin(isAdminUser);
    const isAdmin = isAdminUser;

    let query = (supabase as any)
      .from("equipment_diaries")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    // Operador: filtra pelos próprios lançamentos
    // Admin: filtra por empresa
    if (isAdmin && companyId) {
      query = query.eq("company_id", companyId);
    } else {
      query = query.eq("user_id", user.id);
    }

    if (tipoEquipamento !== "todos") {
      query = query.eq("equipment_type", tipoEquipamento);
    }
    if (frotaSelecionada !== "todas") {
      query = query.eq("equipment_fleet", frotaSelecionada);
    }
    if (dataInicio) {
      query = query.gte("date", dataInicio);
    }
    if (dataFim) {
      query = query.lte("date", dataFim);
    }

    const [{ data: rows }, { data: tiposRows }, { data: frotasRows }] = await Promise.all([
      query,
      isAdmin && companyId
        ? (supabase as any).from("equipment_diaries").select("equipment_type").eq("company_id", companyId).not("equipment_type", "is", null)
        : (supabase as any).from("equipment_diaries").select("equipment_type").eq("user_id", user.id).not("equipment_type", "is", null),
      isAdmin && companyId
        ? (supabase as any).from("equipment_diaries").select("equipment_fleet, equipment_type").eq("company_id", companyId).not("equipment_fleet", "is", null)
        : (supabase as any).from("equipment_diaries").select("equipment_fleet, equipment_type").eq("user_id", user.id).not("equipment_fleet", "is", null),
    ]);

    setLancamentos((rows || []) as Lancamento[]);

    // Buscar RDOs
    let rdoQuery = (supabase as any)
      .from("rdo_diarios")
      .select("id,data,obra_nome,tipo_rdo,responsavel,turno,clima,user_id")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });
    if (isAdmin && companyId) {
      // admin vê todos da empresa — rdo_diarios não tem company_id, filtra por user_ids da empresa
      // fallback: busca todos (RLS cuida do escopo)
    } else {
      rdoQuery = rdoQuery.eq("user_id", user.id);
    }
    if (dataInicio) rdoQuery = rdoQuery.gte("data", dataInicio);
    if (dataFim) rdoQuery = rdoQuery.lte("data", dataFim);
    const { data: rdoRows } = await rdoQuery;
    setRdos(rdoRows || []);

    const tiposUnicos = Array.from(
      new Set(((tiposRows || []) as any[]).map((r) => r.equipment_type).filter(Boolean)),
    ) as string[];
    setTipos(tiposUnicos.sort((a, b) => a.localeCompare(b)));

    // Frotas filtradas pelo tipo selecionado
    const frotasFiltradas = ((frotasRows || []) as any[])
      .filter((r) => tipoEquipamento === "todos" || r.equipment_type === tipoEquipamento)
      .map((r) => r.equipment_fleet)
      .filter(Boolean);
    const frotasUnicas = Array.from(new Set(frotasFiltradas)) as string[];
    setFrotas(frotasUnicas.sort((a: string, b: string) => a.localeCompare(b)));
    setLoading(false);
  };

  // Resetar frota ao mudar tipo
  useEffect(() => {
    setFrotaSelecionada("todas");
  }, [tipoEquipamento]);

  useEffect(() => {
    carregar();
  }, [tipoEquipamento, frotaSelecionada, dataInicio, dataFim]);

  const resumo = useMemo(() => {
    return `${lancamentos.length} lançamento${lancamentos.length === 1 ? "" : "s"}`;
  }, [lancamentos]);

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">
            {isAdmin ? "Lançamentos — Todos" : "Meus Lançamentos"}
          </span>
          <span className="block text-[11px] text-primary-foreground/80">{resumo}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Abas */}
        <div className="flex gap-2">
          <button onClick={() => setAba("equipamentos")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              aba === "equipamentos" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"
            }`}>
            🚜 Equipamentos ({lancamentos.length})
          </button>
          <button onClick={() => setAba("rdos")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              aba === "rdos" ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"
            }`}>
            🏗️ RDOs ({rdos.length})
          </button>
        </div>

        {/* Filtros de Equipamentos */}
        {aba === "equipamentos" && <div className="rdo-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Tipo de Equipamento</span>
              <Select value={tipoEquipamento} onValueChange={setTipoEquipamento}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Frota</span>
              <Select
                value={frotaSelecionada}
                onValueChange={setFrotaSelecionada}
                disabled={frotas.length === 0}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {frotas.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data Início</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <span className="rdo-label">Data Fim</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
        </div>}

        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : aba === "rdos" ? (
          /* Lista de RDOs */
          rdos.length === 0 ? (
            <div className="rdo-card py-10 text-center text-muted-foreground text-sm">Nenhum RDO encontrado.</div>
          ) : (
            <div className="space-y-3">
              {rdos.map((rdo: any) => (
                <button key={rdo.id}
                  onClick={() => navigate(`/relatorios/rdo/${rdo.obra_nome}?ini=${rdo.data}&fim=${rdo.data}`)}
                  className="w-full text-left rdo-card hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-display font-bold text-primary">OGS {rdo.obra_nome} • {rdo.data ? (() => { const [y,m,d] = rdo.data.split('-'); return `${d}/${m}/${y}`; })() : '-'}</p>
                      <p className="text-xs text-muted-foreground">Tipo: {rdo.tipo_rdo || '-'} • Responsável: {rdo.responsavel || '-'}</p>
                      <p className="text-xs text-muted-foreground">Turno: {rdo.turno || '-'} • Clima: {rdo.clima || '-'}</p>
                    </div>
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold shrink-0">RDO</span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : lancamentos.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum lançamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-3">
            {lancamentos.map((item) => (
              <button
                key={item.id}
                onClick={() => abrirDetalhe(item)}
                className="w-full text-left rdo-card hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-display font-bold text-primary">
                      {item.equipment_fleet || "-"} • {item.equipment_type || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {fmtDate(item.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-muted-foreground">Status</p>
                    <p className="text-xs">{item.work_status || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Frota</p>
                    <p className="font-semibold">{item.equipment_fleet || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo</p>
                    <p className="font-semibold">{item.equipment_type || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-semibold">{item.work_status || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Turno</p>
                    <p className="font-semibold">{item.period || "-"}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!selecionado}
        onOpenChange={(open) => {
          if (!open) {
            setSelecionado(null);
            setEditandoId(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do Lançamento</DialogTitle>
          </DialogHeader>

          {selecionado && (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Data" value={fmtDate(selecionado.date)} />
                  <Info label="Turno" value={selecionado.period || "-"} />
                  <Info label="Frota" value={selecionado.equipment_fleet || "-"} />
                  <Info label="Tipo" value={selecionado.equipment_type || "-"} />
                  <Info label="Status" value={selecionado.work_status || "-"} />
                  <Info label="Operador" value={selecionado.operator_name || "-"} />
                  <Info label="OGS" value={selecionado.ogs_number || "-"} />
                  <Info label="Cliente" value={selecionado.client_name || "-"} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {['Caminhões','Comboio','Carreta','Veículo'].includes(selecionado.equipment_type || '') ? (
                    <>
                      <Info label="Odômetro Inicial" value={String(selecionado.odometer_initial ?? "-")} />
                      <Info label="Odômetro Final" value={String(selecionado.odometer_final ?? "-")} />
                    </>
                  ) : (
                    <>
                      <Info label="Horímetro Inicial" value={String(selecionado.meter_initial ?? "-")} />
                      <Info label="Horímetro Final" value={String(selecionado.meter_final ?? "-")} />
                    </>
                  )}
                </div>

                <Info label="Litros Diesel" value={String(selecionado.fuel_liters ?? "-")} />
                {detalheExtra.horas !== null && (
                  <Info label="Horas Trabalhadas" value={`${detalheExtra.horas.toFixed(1)}h`} />
                )}
                <Info label="Local" value={selecionado.location_address || "-"} />
                <Info label="Observações" value={selecionado.observations || "-"} />
              </div>

              {detalheExtra.areas.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Produção (Fresagem)</p>
                  {detalheExtra.areas.map((a: any, i: number) => (
                    <p key={i} className="text-xs">
                      {a.length_m}m × {a.width_m}m × {a.thickness_cm}cm = <b>{a.m2?.toFixed(1)} m²</b> / {a.m3?.toFixed(2)} m³
                    </p>
                  ))}
                  <p className="text-xs font-bold text-primary">
                    Total: {detalheExtra.areas.reduce((s: number, a: any) => s + (a.m2 || 0), 0).toFixed(1)} m²
                  </p>
                </div>
              )}

              {detalheExtra.bits.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Bits Lançados</p>
                  {detalheExtra.bits.map((b: any, i: number) => (
                    <p key={i} className="text-xs">{b.quantity}x {b.brand} — {b.status}</p>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => handleEditarLancamento(selecionado)}
                disabled={editandoId === selecionado.id}
              >
                {editandoId === selecionado.id && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
                Editar Lançamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
