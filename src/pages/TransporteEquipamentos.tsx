/**
 * TransporteEquipamentos — Registro de transporte de equipamentos em carreta prancha
 * Rota: /programador/transportes
 * Acesso: Programador + Admin
 *
 * Registra quando um equipamento é transportado (carreta própria ou terceirizada).
 * Gera automaticamente o diário de equipamento do dia com work_status "Em Transporte".
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Plus, Loader2, CheckCircle2, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import logoCi from "@/assets/logo-workflux.png";
import { sortOgsData } from "@/hooks/useOgsReference";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CARRETAS_PROPRIAS = ["PR001", "PR007"];

interface Equipamento {
  id: string;
  frota: string;
  tipo: string;
  nome: string;
}

interface OgsOption {
  ogs_number: string;
  client_name: string;
  location_address: string;
}

interface Transporte {
  id: string;
  equipment_fleet: string;
  equipment_type: string;
  data: string;
  origem_ogs: string;
  origem_descricao: string;
  destino_ogs: string;
  destino_descricao: string;
  tipo_transportador: string;
  transportador_nome: string;
  diary_id: string | null;
  created_at: string;
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function TransporteEquipamentos() {
  const navigate = useNavigate();
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [ogsList, setOgsList] = useState<OgsOption[]>([]);
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [equipSel, setEquipSel] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [origemOgs, setOrigemOgs] = useState("");
  const [destinoOgs, setDestinoOgs] = useState("");
  const [tipoTransportador, setTipoTransportador] = useState<"PROPRIO" | "TERCEIRO">("PROPRIO");
  const [transportadorNome, setTransportadorNome] = useState("");
  const [carretaPropria, setCarretaPropria] = useState("PR001");
  const [meterTransporte, setMeterTransporte] = useState("");
  const [odometerTransporte, setOdometerTransporte] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    const [eqRes, ogsRes, transpRes] = await Promise.all([
      (supabase as any).from("equipamentos").select("id, frota, tipo, nome").eq("company_id", COMPANY_ID).eq("status", "ativo").order("tipo").order("frota"),
      (supabase as any).from("ogs_reference").select("ogs_number, client_name, location_address"),
      (supabase as any).from("equipamento_transportes").select("*").eq("company_id", COMPANY_ID).order("data", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    ]);
    if (eqRes.data) setEquipamentos(eqRes.data);
    if (ogsRes.data) setOgsList(sortOgsData(ogsRes.data));
    if (transpRes.data) setTransportes(transpRes.data);
    setLoading(false);
  }

  function labelOgs(ogs: string) {
    if (ogs === "000") return "Pátio Central (000)";
    const found = ogsList.find(o => o.ogs_number === ogs);
    return found ? `OGS ${ogs} — ${found.client_name}` : `OGS ${ogs}`;
  }

  async function handleSalvar() {
    if (!equipSel || !origemOgs || !destinoOgs) {
      toast.error("Preencha equipamento, origem e destino.");
      return;
    }
    if (tipoTransportador === "TERCEIRO" && !transportadorNome.trim()) {
      toast.error("Informe o nome da empresa transportadora.");
      return;
    }
    if (origemOgs === destinoOgs) {
      toast.error("Origem e destino não podem ser iguais.");
      return;
    }

    setSaving(true);

    const equip = equipamentos.find(e => e.frota === equipSel);
    const nomeTransp = tipoTransportador === "PROPRIO" ? carretaPropria : transportadorNome.trim();

    const origemDesc = labelOgs(origemOgs);
    const destinoDesc = labelOgs(destinoOgs);

    try {
      // Buscar último horímetro do equipamento se não informado
      let meterVal = meterTransporte ? parseFloat(meterTransporte) : null;
      let odomVal = odometerTransporte ? parseFloat(odometerTransporte) : null;

      if (meterVal === null || odomVal === null) {
        const { data: ultimo } = await (supabase as any)
          .from("equipment_diaries")
          .select("meter_final, odometer_final")
          .eq("equipment_fleet", equipSel)
          .eq("company_id", COMPANY_ID)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (meterVal === null) meterVal = ultimo?.meter_final ?? null;
        if (odomVal === null) odomVal = ultimo?.odometer_final ?? null;
      }

      // Verificar se já existe diário nessa data
      const { data: diarioExistente } = await (supabase as any)
        .from("equipment_diaries")
        .select("id")
        .eq("equipment_fleet", equipSel)
        .eq("date", data)
        .eq("company_id", COMPANY_ID)
        .maybeSingle();

      let diaryId: string | null = null;

      if (!diarioExistente) {
        // Criar diário automático
        const { data: { user } } = await supabase.auth.getUser();
        const { data: novoDiario, error: diaryErr } = await (supabase as any)
          .from("equipment_diaries")
          .insert({
            company_id: COMPANY_ID,
            date: data,
            equipment_fleet: equipSel,
            equipment_type: equip?.tipo ?? "",
            ogs_number: origemOgs,
            client_name: "EM TRANSPORTE",
            location_address: `De: ${origemDesc} → Para: ${destinoDesc}`,
            work_status: "Em Transporte",
            operator_name: `TRANSPORTE — ${nomeTransp}`,
            period: "diurno",
            meter_initial: meterVal,
            meter_final: meterVal,
            odometer_initial: odomVal,
            odometer_final: odomVal,
            is_auto: true,
            auto_reason: `Gerado por registro de transporte — ${nomeTransp}`,
            status: "auto",
            user_id: user?.id,
            created_by: user?.id,
          })
          .select("id")
          .single();

        if (diaryErr) throw diaryErr;
        diaryId = novoDiario?.id ?? null;
      } else {
        diaryId = diarioExistente.id;
      }

      // Salvar registro de transporte
      const { data: { user } } = await supabase.auth.getUser();
      const { error: transpErr } = await (supabase as any)
        .from("equipamento_transportes")
        .insert({
          company_id: COMPANY_ID,
          equipment_id: equip?.id ?? null,
          equipment_fleet: equipSel,
          equipment_type: equip?.tipo ?? "",
          data,
          origem_ogs: origemOgs,
          origem_descricao: origemDesc,
          destino_ogs: destinoOgs,
          destino_descricao: destinoDesc,
          tipo_transportador: tipoTransportador,
          transportador_nome: nomeTransp,
          meter_no_transporte: meterVal,
          odometer_no_transporte: odomVal,
          observacoes: obs.trim() || null,
          diary_id: diaryId,
          created_by: user?.id,
        });

      if (transpErr) throw transpErr;

      toast.success(`Transporte registrado! ${diarioExistente ? "Diário já existia." : "Diário criado automaticamente."}`);
      setShowForm(false);
      resetForm();
      carregarDados();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEquipSel(""); setData(new Date().toISOString().split("T")[0]);
    setOrigemOgs(""); setDestinoOgs("");
    setTipoTransportador("PROPRIO"); setTransportadorNome("");
    setCarretaPropria("PR001"); setMeterTransporte("");
    setOdometerTransporte(""); setObs("");
  }

  const inp = "w-full h-11 rounded-xl border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-7 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Transporte de Equipamentos</span>
          <span className="block text-[11px] text-primary-foreground/80">Carreta prancha — própria ou terceirizada</span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Registrar
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Formulário */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary" /> Novo Transporte
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Equipamento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipamento</Label>
              <Select value={equipSel} onValueChange={setEquipSel}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione a frota..." />
                </SelectTrigger>
                <SelectContent>
                  {equipamentos.map(e => (
                    <SelectItem key={e.frota} value={e.frota}>
                      {e.frota} — {e.tipo} {e.nome ? `(${e.nome})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data do Transporte</Label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inp} />
            </div>

            {/* Origem e Destino */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Origem</Label>
                <Select value={origemOgs} onValueChange={setOrigemOgs}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="De onde sai..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="000">🏭 Pátio Central</SelectItem>
                    {ogsList.filter(o => o.ogs_number !== "000").map(o => (
                      <SelectItem key={o.ogs_number} value={o.ogs_number}>
                        OGS {o.ogs_number} — {o.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destino</Label>
                <Select value={destinoOgs} onValueChange={setDestinoOgs}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Para onde vai..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="000">🏭 Pátio Central</SelectItem>
                    {ogsList.filter(o => o.ogs_number !== "000").map(o => (
                      <SelectItem key={o.ogs_number} value={o.ogs_number}>
                        OGS {o.ogs_number} — {o.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tipo Transportador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transportador</Label>
              <div className="flex gap-2">
                {(["PROPRIO", "TERCEIRO"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTipoTransportador(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${tipoTransportador === t ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border"}`}
                  >
                    {t === "PROPRIO" ? "🚛 Próprio" : "🏢 Terceirizado"}
                  </button>
                ))}
              </div>
              {tipoTransportador === "PROPRIO" ? (
                <Select value={carretaPropria} onValueChange={setCarretaPropria}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRETAS_PROPRIAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  className={inp}
                  placeholder="Nome da empresa transportadora..."
                  value={transportadorNome}
                  onChange={e => setTransportadorNome(e.target.value)}
                />
              )}
            </div>

            {/* Horímetro / Odômetro */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horímetro atual (opcional)</Label>
                <input type="number" className={inp} placeholder="Ex: 3450" value={meterTransporte} onChange={e => setMeterTransporte(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Odômetro atual (opcional)</Label>
                <input type="number" className={inp} placeholder="Ex: 125000" value={odometerTransporte} onChange={e => setOdometerTransporte(e.target.value)} />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações (opcional)</Label>
              <Textarea className="rounded-xl text-sm" rows={2} placeholder="Ex: Transporte urgente, equipamento com defeito..." value={obs} onChange={e => setObs(e.target.value)} />
            </div>

            <Button onClick={handleSalvar} disabled={saving} className="w-full h-11 rounded-xl font-bold gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><CheckCircle2 className="w-4 h-4" /> Registrar Transporte</>}
            </Button>
          </div>
        )}

        {/* Lista de transportes */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : transportes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-8 text-center">
            <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Nenhum transporte registrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Use o botão "Registrar" para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold px-1">{transportes.length} transporte{transportes.length !== 1 ? "s" : ""} registrado{transportes.length !== 1 ? "s" : ""}</p>
            {transportes.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-border p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm">{t.equipment_fleet}</span>
                    <span className="text-xs text-muted-foreground">{t.equipment_type}</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{fmtDate(t.data)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-foreground">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">
                    {t.origem_ogs === "000" ? "🏭 Pátio" : `OGS ${t.origem_ogs}`}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg font-medium">
                    {t.destino_ogs === "000" ? "🏭 Pátio" : `OGS ${t.destino_ogs}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t.tipo_transportador === "PROPRIO" ? "🚛" : "🏢"} {t.transportador_nome}
                  </span>
                  {t.diary_id ? (
                    <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-semibold">✓ Diário gerado</span>
                  ) : (
                    <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">Diário existente</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
