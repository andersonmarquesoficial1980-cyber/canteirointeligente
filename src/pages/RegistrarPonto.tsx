import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, MapPin, AlertTriangle, CheckCircle2, Loader2, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Funcionario {
  id: string;
  nome: string;
  funcao: string;
  matricula: string;
}

interface OgsRef {
  id: string;
  ogs_number: string | null;
  client_name: string | null;
  lat: number | null;
  lng: number | null;
}

type TipoPonto = "entrada" | "saida";

// ── Geofence ───────────────────────────────────────────────────────────────
const RAIO_PADRAO_M = 500;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Turno inteligente ──────────────────────────────────────────────────────
// Determina automaticamente se é entrada ou saída com base no último registro do dia
async function detectarTipoPonto(staffId: string, companyId: string | null): Promise<TipoPonto> {
  const hoje = new Date().toISOString().split("T")[0];
  const { data } = await (supabase as any)
    .from("ponto_registros")
    .select("tipo, hora")
    .eq("staff_id", staffId)
    .eq("data", hoje)
    .eq("company_id", companyId)
    .order("hora", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return "entrada";
  return data[0].tipo === "entrada" ? "saida" : "entrada";
}

// ── Componente principal ───────────────────────────────────────────────────
export default function RegistrarPonto() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Dados
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [ogsList, setOgsList] = useState<OgsRef[]>([]);
  const [selectedFuncionario, setSelectedFuncionario] = useState<Funcionario | null>(null);
  const [busca, setBusca] = useState("");
  const [showBusca, setShowBusca] = useState(false);
  const [selectedOgsId, setSelectedOgsId] = useState("");

  // GPS
  const [geoPos, setGeoPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [nearbyOgs, setNearbyOgs] = useState<OgsRef | null>(null);
  const [distanciaM, setDistanciaM] = useState<number | null>(null);
  const [foraRaio, setForaRaio] = useState(false);

  // Câmera e foto
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Ponto
  const [tipoPonto, setTipoPonto] = useState<TipoPonto>("entrada");
  const [turno, setTurno] = useState<"diurno" | "noturno">("diurno");
  const [saving, setSaving] = useState(false);
  const [ultimoPonto, setUltimoPonto] = useState<{ nome: string; tipo: string; hora: string } | null>(null);

  const [loading, setLoading] = useState(true);

  // ── Carrega dados ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [funcRes, ogsRes] = await Promise.all([
        (supabase as any).from("employees").select("id, name, role, matricula, status").eq("status","ativo").order("name"),
        (supabase as any).from("ogs_reference").select("id, ogs_number, client_name, lat, lng"),
      ]);
      if (funcRes.data) setFuncionarios(funcRes.data.map((f: any) => ({ id: f.id, nome: f.name, funcao: f.role ?? "", matricula: f.matricula ?? "" })));
      if (ogsRes.data) setOgsList(ogsRes.data);
      setLoading(false);
    };
    load();
  }, []);

  // ── GPS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError("GPS não disponível"); return; }
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeoPos(coords);
        setGeoError(null);

        // Encontra OGS mais próxima
        let closest: OgsRef | null = null;
        let closestDist = Infinity;
        for (const ogs of ogsList) {
          if (!ogs.lat || !ogs.lng) continue;
          const d = haversine(coords.lat, coords.lng, ogs.lat, ogs.lng);
          if (d < closestDist) { closestDist = d; closest = ogs; }
        }
        if (closest && closestDist <= RAIO_PADRAO_M * 2) {
          setNearbyOgs(closest);
          setDistanciaM(Math.round(closestDist));
          setForaRaio(closestDist > RAIO_PADRAO_M);
          setSelectedOgsId(closest.id);
        } else {
          setNearbyOgs(null);
          setDistanciaM(null);
          setForaRaio(true);
        }
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [ogsList]);

  // ── Atualiza tipo de ponto quando funcionário muda ─────────────────────
  useEffect(() => {
    if (!selectedFuncionario) return;
    detectarTipoPonto(selectedFuncionario.id, profile?.company_id || null).then(setTipoPonto);
  }, [selectedFuncionario, profile?.company_id]);

  // ── Câmera ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch {
      toast({ title: "Câmera", description: "Não foi possível acessar a câmera.", variant: "destructive" });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const capturarFoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.7);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const refazerFoto = useCallback(() => {
    setCapturedPhoto(null);
    startCamera();
  }, [startCamera]);

  // ── Upload foto ────────────────────────────────────────────────────────
  const uploadFoto = async (dataUrl: string, staffId: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `ponto/${staffId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("face-photos").upload(fileName, blob, { contentType: "image/jpeg" });
      if (error) return null;
      const { data } = supabase.storage.from("face-photos").getPublicUrl(fileName);
      return data.publicUrl;
    } catch { return null; }
  };

  // ── Registrar ponto ────────────────────────────────────────────────────
  const registrar = async () => {
    if (!selectedFuncionario) {
      toast({ title: "Selecione o funcionário", variant: "destructive" }); return;
    }
    if (!capturedPhoto) {
      toast({ title: "Foto obrigatória", description: "Tire a foto antes de registrar.", variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      const agora = new Date();
      const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}:${String(agora.getSeconds()).padStart(2, "0")}`;
      const data = agora.toISOString().split("T")[0];

      // Upload foto
      const fotoUrl = await uploadFoto(capturedPhoto, selectedFuncionario.id);

      // OGS selecionada
      const ogsEscolhida = ogsList.find(o => o.id === selectedOgsId);

      const { error } = await (supabase as any).from("ponto_registros").insert({
        staff_id: selectedFuncionario.id,
        tipo: tipoPonto,
        data,
        hora,
        metodo: "manual",
        photo_url: fotoUrl,
        lat: geoPos?.lat || null,
        lng: geoPos?.lng || null,
        ogs_id: selectedOgsId || null,
        ogs_number: ogsEscolhida?.ogs_number || null,
        turno,
        distancia_m: distanciaM,
        fora_raio: foraRaio,
        company_id: profile?.company_id || null,
      });

      if (error) throw error;

      setUltimoPonto({ nome: selectedFuncionario.nome, tipo: tipoPonto, hora: hora.slice(0, 5) });
      setCapturedPhoto(null);
      setSelectedFuncionario(null);
      setBusca("");

      // Alerta se fora do raio
      if (foraRaio) {
        toast({
          title: `⚠️ Ponto registrado — fora da obra`,
          description: `${selectedFuncionario.nome} estava a ${distanciaM}m da obra mais próxima.`,
        });
      } else {
        toast({ title: `✅ Ponto registrado`, description: `${selectedFuncionario.nome} — ${tipoPonto} às ${hora.slice(0, 5)}` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Filtro de busca ────────────────────────────────────────────────────
  const funcionariosFiltrados = busca.trim()
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) || f.matricula?.includes(busca))
    : [];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Registrar Ponto</h1>
          <p className="text-[10px] text-primary-foreground/70">Entrada e saída com foto</p>
        </div>
        <div className="text-xs text-white/80 font-mono">
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">

        {/* Último ponto registrado */}
        {ultimoPonto && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">{ultimoPonto.nome}</p>
              <p className="text-xs text-green-600">{ultimoPonto.tipo === "entrada" ? "Entrada" : "Saída"} registrada às {ultimoPonto.hora}</p>
            </div>
          </div>
        )}

        {/* GPS Status */}
        <div className={`rounded-xl border p-3 flex items-center gap-3 ${
          geoError ? "bg-red-50 border-red-200" :
          foraRaio ? "bg-amber-50 border-amber-200" :
          "bg-green-50 border-green-200"
        }`}>
          <MapPin className={`w-4 h-4 shrink-0 ${geoError ? "text-red-500" : foraRaio ? "text-amber-500" : "text-green-600"}`} />
          <div className="flex-1 min-w-0">
            {geoError ? (
              <p className="text-xs text-red-700">GPS indisponível — {geoError}</p>
            ) : !geoPos ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Obtendo localização...</p>
            ) : nearbyOgs ? (
              <>
                <p className="text-xs font-semibold truncate">{nearbyOgs.client_name || nearbyOgs.ogs_number}</p>
                <p className={`text-[11px] ${foraRaio ? "text-amber-600 font-bold" : "text-green-600"}`}>
                  {foraRaio ? `⚠️ ${distanciaM}m da obra (fora do raio)` : `✅ ${distanciaM}m — dentro da obra`}
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-700">Nenhuma obra próxima encontrada</p>
            )}
          </div>
        </div>

        {/* Seleção de funcionário */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Funcionário</h2>

          {selectedFuncionario ? (
            <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3 border border-primary/20">
              <div>
                <p className="font-semibold text-sm text-foreground">{selectedFuncionario.nome}</p>
                <p className="text-xs text-muted-foreground">{selectedFuncionario.funcao} · Mat. {selectedFuncionario.matricula}</p>
              </div>
              <button onClick={() => { setSelectedFuncionario(null); setBusca(""); }} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded">
                Trocar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={e => { setBusca(e.target.value); setShowBusca(true); }}
                onFocus={() => setShowBusca(true)}
                placeholder="Digite o nome ou matrícula..."
                className="w-full h-11 rounded-xl border border-border bg-secondary px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {showBusca && funcionariosFiltrados.length > 0 && (
                <div className="absolute z-10 top-12 left-0 right-0 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {funcionariosFiltrados.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setSelectedFuncionario(f); setBusca(""); setShowBusca(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0"
                    >
                      <p className="text-sm font-medium">{f.nome}</p>
                      <p className="text-xs text-muted-foreground">{f.funcao} · {f.matricula}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tipo de ponto + Turno */}
        {selectedFuncionario && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTipoPonto("entrada")}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      tipoPonto === "entrada" ? "bg-green-500 text-white border-green-500" : "border-border text-muted-foreground"
                    }`}
                  >🟢 Entrada</button>
                  <button
                    onClick={() => setTipoPonto("saida")}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      tipoPonto === "saida" ? "bg-red-500 text-white border-red-500" : "border-border text-muted-foreground"
                    }`}
                  >🔴 Saída</button>
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Turno</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTurno("diurno")}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      turno === "diurno" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
                    }`}
                  >☀️ Diurno</button>
                  <button
                    onClick={() => setTurno("noturno")}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      turno === "noturno" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
                    }`}
                  >🌙 Noturno</button>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              <Clock className="inline w-3 h-3 mr-1" />
              Tipo detectado automaticamente pelo último registro de hoje
            </p>
          </div>
        )}

        {/* Câmera / Foto */}
        {selectedFuncionario && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Foto (obrigatória)</h2>

            {capturedPhoto ? (
              <div className="space-y-2">
                <img src={capturedPhoto} alt="Foto capturada" className="w-full rounded-xl object-cover max-h-48" />
                <Button variant="outline" onClick={refazerFoto} className="w-full h-9 text-sm">
                  🔄 Refazer foto
                </Button>
              </div>
            ) : cameraActive ? (
              <div className="space-y-2">
                <video ref={videoRef} className="w-full rounded-xl bg-black" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                <Button onClick={capturarFoto} className="w-full h-11 bg-primary text-white font-bold">
                  📸 Capturar foto
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={startCamera} className="w-full h-11 gap-2">
                <Camera className="w-4 h-4" /> Abrir câmera
              </Button>
            )}
          </div>
        )}

        {/* OGS manual (se fora do raio) */}
        {selectedFuncionario && foraRaio && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Fora do raio — selecione a obra manualmente
            </p>
            <select
              value={selectedOgsId}
              onChange={e => setSelectedOgsId(e.target.value)}
              className="w-full h-10 rounded-lg border border-amber-300 bg-white px-2 text-sm"
            >
              <option value="">Selecione a obra...</option>
              {ogsList.map(o => (
                <option key={o.id} value={o.id}>{o.ogs_number} — {o.client_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Botão registrar */}
        {selectedFuncionario && (
          <Button
            onClick={registrar}
            disabled={saving || !capturedPhoto}
            className="w-full h-14 text-base font-bold rounded-2xl bg-header-gradient hover:opacity-90 shadow-lg"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Registrando...</>
            ) : (
              <>{tipoPonto === "entrada" ? "🟢 Registrar Entrada" : "🔴 Registrar Saída"}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
