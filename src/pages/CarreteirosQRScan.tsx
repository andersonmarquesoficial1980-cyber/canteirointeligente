/**
 * /carreteiros/scan/:truckId
 * Página aberta ao escanear QR Code do caminhão.
 * Detecta se há viagem em aberto (lança chegada) ou não (lança saída).
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Truck, MapPin, Send, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOgsReference } from "@/hooks/useOgsReference";
import logoCi from "@/assets/logo-workflux.png";

const COMPANY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function CarreteirosQRScan() {
  const { truckId } = useParams<{ truckId: string }>();
  const navigate = useNavigate();
  const { data: ogsData } = useOgsReference();

  const [loading, setLoading] = useState(true);
  const [truck, setTruck] = useState<any>(null);
  const [tripAberta, setTripAberta] = useState<any>(null);
  const [geoStatus, setGeoStatus] = useState<"aguardando" | "ok" | "erro">("aguardando");
  const [geo, setGeo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"saida" | "chegada" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Campos do formulário de saída
  const [material, setMaterial] = useState("");
  const [quantidadeTipo, setQuantidadeTipo] = useState<"maxima"|"meia"|"vazio">("maxima");
  const [originOgs, setOriginOgs] = useState("");
  const [destination, setDestination] = useState("Canteiro");
  const [materiais, setMateriais] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("insumos_materiais").select("nome").eq("ativo", true).order("nome")
      .then(({ data }) => { if (data) setMateriais((data as any[]).map(m => m.nome)); });
  }, []);

  useEffect(() => {
    if (!truckId) return;
    async function load() {
      // Buscar caminhão
      const { data: t } = await supabase.from("truck_registry").select("*").eq("id", truckId).maybeSingle();
      setTruck(t);

      // Verificar se há viagem em aberto (saída sem chegada)
      const { data: trips } = await supabase.from("trucker_trips")
        .select("*")
        .eq("truck_plate", t?.placa)
        .eq("status", "EM TRÂNSITO")
        .order("departure_time", { ascending: false })
        .limit(1);
      setTripAberta(trips?.[0] || null);
      setLoading(false);
    }
    load();
  }, [truckId]);

  // Capturar GPS
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        setGeoStatus("ok");
      },
      () => setGeoStatus("erro"),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const ogsExpandido = (ogsData || []).flatMap((o: any) => {
    const addrs = (o.location_address || "").split(";").map((a: string) => a.trim()).filter(Boolean);
    if (addrs.length <= 1) return [{ value: o.id, label: `${o.ogs_number} — ${o.client_name}${o.location_address ? ` — ${o.location_address}` : ""}` }];
    return addrs.map((addr: string) => ({ value: o.id, label: `${o.ogs_number} — ${addr}` }));
  });

  async function lancarSaida() {
    if (!material || !destination) { setErro("Selecione o Material e o Destino."); return; }
    setSubmitting(true); setErro(null);
    // Calcular quantidade baseado no tipo selecionado
    const cap = truck?.capacidade_m3 || 0;
    const qtd = quantidadeTipo === "maxima" ? cap
      : quantidadeTipo === "meia" ? cap / 2
      : 0;

    // Usar fetch com service key para evitar problema de RLS sem autenticação
    const payload = {
      truck_plate: truck.placa,
      material_type: material,
      quantity: qtd,
      origin_ogs_id: originOgs || null,
      destination_id: destination,
      departure_time: new Date().toISOString(),
      departure_geo: geo,
      status: "EM TRÂNSITO",
      date: new Date().toISOString().split("T")[0],
      company_id: COMPANY_ID,
    };
    try {
      const { error: insertError } = await supabase
        .from("trucker_trips")
        .insert(payload);
      setSubmitting(false);
      if (!insertError) {
        setDone("saida");
      } else {
        setErro("Erro ao registrar saída: " + insertError.message.slice(0, 120));
      }
    } catch (e: any) {
      setSubmitting(false);
      setErro("Erro de rede: " + e.message);
    }
  }

  async function lancarChegada() {
    if (!tripAberta) return;
    setSubmitting(true); setErro(null);
    try {
      const { error: updateError } = await supabase
        .from("trucker_trips")
        .update({ arrival_time: new Date().toISOString(), arrival_geo: geo, status: "CONCLUÍDO" })
        .eq("id", tripAberta.id);
      setSubmitting(false);
      if (updateError) { setErro("Erro: " + updateError.message.slice(0, 100)); }
      else setDone("chegada");
    } catch (e: any) {
      setSubmitting(false);
      setErro("Erro de rede: " + e.message);
    }
  }

  const inp: React.CSSProperties = { width: "100%", height: 44, borderRadius: 12, border: "1.5px solid #e5e7eb", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "white" };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <Loader2 size={32} color="#0055AA" className="animate-spin" />
    </div>
  );

  if (!truck) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#f8fafc" }}>
      <AlertTriangle size={48} color="#ef4444" />
      <p style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: "#374151" }}>Caminhão não encontrado</p>
      <p style={{ fontSize: 13, color: "#9ca3af" }}>QR Code inválido ou caminhão removido</p>
    </div>
  );

  if (done) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: done === "saida" ? "#eff6ff" : "#f0fdf4" }}>
      <CheckCircle2 size={64} color={done === "saida" ? "#0055AA" : "#16a34a"} />
      <p style={{ marginTop: 16, fontSize: 20, fontWeight: 900, color: done === "saida" ? "#0055AA" : "#16a34a", fontFamily: "Montserrat" }}>
        {done === "saida" ? "Saída Registrada!" : "Chegada Registrada!"}
      </p>
      <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8, textAlign: "center" }}>
        {truck.placa} · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      {geo && <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>📍 GPS: {geo}</p>}
      {done === "saida" && (
        <div style={{ marginTop: 20, background: "#e8f0ff", borderRadius: 12, padding: "12px 16px", maxWidth: 320, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#0055AA", fontWeight: 600, lineHeight: 1.5 }}>
            📦 Na chegada ao canteiro, o apontador deve escanear novamente o QR Code deste caminhão para registrar a chegada.
          </p>
        </div>
      )}
      <button onClick={() => window.close() || window.history.back()}
        style={{ marginTop: 24, padding: "12px 32px", borderRadius: 12, background: done === "saida" ? "#0055AA" : "#16a34a", color: "white", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
        Fechar
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0A0F2C,#0D1B4B)", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <img src={logoCi} alt="" style={{ height: 32 }} />
        <div>
          <p style={{ color: "white", fontWeight: 800, fontSize: 14, fontFamily: "Montserrat" }}>WF Carreteiros</p>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Registro por QR Code</p>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        {/* Info do caminhão */}
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg,#0055AA,#00C6FF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Truck size={24} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", fontFamily: "Montserrat" }}>{truck.placa}</p>
            <p style={{ fontSize: 12, color: "#9ca3af" }}>{truck.fornecedor || "Caminhão Basculante"}{truck.modelo ? ` · ${truck.modelo}` : ""}</p>
          </div>
          {/* GPS status */}
          <div style={{ marginLeft: "auto", textAlign: "center" }}>
            <MapPin size={20} color={geoStatus === "ok" ? "#22c55e" : geoStatus === "erro" ? "#ef4444" : "#f97316"} />
            <p style={{ fontSize: 9, color: geoStatus === "ok" ? "#22c55e" : "#9ca3af", marginTop: 2 }}>
              {geoStatus === "ok" ? "GPS OK" : geoStatus === "erro" ? "Sem GPS" : "..."}
            </p>
          </div>
        </div>

        {/* Viagem em aberto → lançar chegada */}
        {tripAberta ? (
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#0A0F2C", marginBottom: 4 }}>📦 Viagem em andamento</p>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>
              Saída às {fmtTime(tripAberta.departure_time)} · {tripAberta.material_type} · {tripAberta.quantity} m³
            </p>
            {erro && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{erro}</p>}
            <button onClick={lancarChegada} disabled={submitting}
              style={{ width: "100%", height: 50, borderRadius: 14, background: submitting ? "#9ca3af" : "#16a34a", color: "white", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {submitting ? "Registrando..." : "Registrar Chegada"}
            </button>
            {geoStatus === "erro" && <p style={{ fontSize: 11, color: "#f97316", textAlign: "center", marginTop: 8 }}>⚠️ GPS indisponível — chegada será registrada sem localização</p>}
          </div>
        ) : (
          /* Sem viagem aberta → lançar saída */
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#0A0F2C", marginBottom: 16 }}>🚛 Lançar Saída</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>MATERIAL *</label>
              <select style={{ ...inp, background: "white" }} value={material} onChange={e => setMaterial(e.target.value)}>
                <option value="">Selecione o material...</option>
                {materiais.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>QUANTIDADE *</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { v: "maxima" as const, label: `Carga Máxima${truck?.capacidade_m3 ? ` (${truck.capacidade_m3} m³)` : ""}` },
                  { v: "meia" as const, label: `Meia Carga${truck?.capacidade_m3 ? ` (${truck.capacidade_m3/2} m³)` : ""}` },
                  { v: "vazio" as const, label: "Vazio" },
                ]).map(opt => (
                  <button key={opt.v} type="button" onClick={() => setQuantidadeTipo(opt.v)}
                    style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `2px solid ${quantidadeTipo===opt.v ? "#0055AA" : "#e5e7eb"}`,
                      background: quantidadeTipo===opt.v ? "#e8f0ff" : "white", color: quantidadeTipo===opt.v ? "#0055AA" : "#6b7280",
                      fontSize: 11, fontWeight: 700, cursor: "pointer", lineHeight: 1.3 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>OGS DE ORIGEM</label>
              <select style={{ ...inp, background: "white" }} value={originOgs} onChange={e => setOriginOgs(e.target.value)}>
                <option value="">Selecione a OGS...</option>
                {ogsExpandido.map((o: any) => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>DESTINO *</label>
              <select style={{ ...inp, background: "white" }} value={destination} onChange={e => setDestination(e.target.value)}>
                <option value="Canteiro">Canteiro</option>
                <option value="Usina">Usina</option>
                <option value="Depósito">Depósito</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {erro && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{erro}</p>}
            {geoStatus === "erro" && <p style={{ fontSize: 11, color: "#f97316", marginBottom: 10 }}>⚠️ GPS indisponível — saída será registrada sem localização</p>}

            <button onClick={lancarSaida} disabled={submitting}
              style={{ width: "100%", height: 50, borderRadius: 14, background: submitting ? "#9ca3af" : "#0055AA", color: "white", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {submitting ? "Registrando..." : "Lançar Saída"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
