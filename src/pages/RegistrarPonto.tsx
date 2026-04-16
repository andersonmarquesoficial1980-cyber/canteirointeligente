import { useState, useEffect, useRef, useCallback } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, MapPin, AlertTriangle, User, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";

interface StaffMember {
  id: string;
  nome: string;
  funcao: string;
}

interface OgsRef {
  id: string;
  ogs_number: string | null;
  client_name: string | null;
  location_address: string | null;
  lat: number | null;
  lng: number | null;
  jornada_horas: number | null;
}

interface FaceReg {
  staff_id: string;
  descriptor: number[];
  photo_url: string | null;
}

const GEOFENCE_RADIUS_M = 500;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RegistrarPonto() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);

  const [geoPosition, setGeoPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [faceRegs, setFaceRegs] = useState<FaceReg[]>([]);
  const [ogsList, setOgsList] = useState<OgsRef[]>([]);
  const [nearbyOgs, setNearbyOgs] = useState<OgsRef | null>(null);
  const [manualOgsId, setManualOgsId] = useState<string>("");

  const [recognizing, setRecognizing] = useState(false);
  const [recognizedStaff, setRecognizedStaff] = useState<StaffMember | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [manualStaffId, setManualStaffId] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [pontoTipo, setPontoTipo] = useState<"entrada" | "saida">("entrada");
  const [lastPonto, setLastPonto] = useState<{ nome: string; tipo: string; hora: string } | null>(null);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Face models failed:", err);
      }
      setLoadingModels(false);
    };
    loadModels();
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      const [staffRes, faceRes, ogsRes] = await Promise.all([
        supabase.from("aero_pav_gru_staff").select("id, nome, funcao").eq("ativo", true).order("nome"),
        supabase.from("face_registrations" as any).select("staff_id, descriptor, photo_url"),
        supabase.from("ogs_reference").select("id, ogs_number, client_name, location_address, lat, lng, jornada_horas" as any),
      ]);
      if (staffRes.data) setStaff(staffRes.data as StaffMember[]);
      if (faceRes.data) setFaceRegs(faceRes.data as any as FaceReg[]);
      if (ogsRes.data) setOgsList(ogsRes.data as any as OgsRef[]);
    };
    loadData();
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("GPS não disponível neste dispositivo");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      (err) => setGeoError(`Erro GPS: ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Auto-detect nearby OGS
  useEffect(() => {
    if (!geoPosition || ogsList.length === 0) return;
    let closest: OgsRef | null = null;
    let minDist = Infinity;
    for (const ogs of ogsList) {
      if (!ogs.lat || !ogs.lng) continue;
      const d = haversineDistance(geoPosition.lat, geoPosition.lng, ogs.lat, ogs.lng);
      if (d <= GEOFENCE_RADIUS_M && d < minDist) {
        closest = ogs;
        minDist = d;
      }
    }
    setNearbyOgs(closest);
  }, [geoPosition, ogsList]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar a câmera", variant: "destructive" });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Capture photo from video
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.8);
  };

  // Recognize face with 5s timeout
  const handleRecognize = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setRecognizing(true);
    setTimedOut(false);
    setRecognizedStaff(null);
    setCapturedPhoto(null);

    const timeout = setTimeout(() => {
      setTimedOut(true);
      setRecognizing(false);
      const photo = captureFrame();
      setCapturedPhoto(photo);
      toast({ title: "⏱ Tempo esgotado", description: "Selecione o funcionário manualmente." });
    }, 5000);

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        clearTimeout(timeout);
        setRecognizing(false);
        setTimedOut(true);
        setCapturedPhoto(captureFrame());
        toast({ title: "Nenhum rosto detectado", description: "Selecione manualmente.", variant: "destructive" });
        return;
      }

      const queryDescriptor = detection.descriptor;
      let bestMatch: { staffId: string; distance: number } | null = null;

      for (const reg of faceRegs) {
        const refDesc = new Float32Array(reg.descriptor);
        const distance = faceapi.euclideanDistance(queryDescriptor, refDesc);
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { staffId: reg.staff_id, distance };
        }
      }

      clearTimeout(timeout);

      if (bestMatch && bestMatch.distance < 0.6) {
        const found = staff.find((s) => s.id === bestMatch!.staffId);
        if (found) {
          setRecognizedStaff(found);
          setCapturedPhoto(captureFrame());
          setRecognizing(false);
          toast({ title: `✅ ${found.nome}`, description: "Rosto reconhecido!" });
          return;
        }
      }

      // Not recognized
      setTimedOut(true);
      setCapturedPhoto(captureFrame());
      setRecognizing(false);
      toast({ title: "Rosto não identificado", description: "Selecione manualmente." });
    } catch (err) {
      clearTimeout(timeout);
      setTimedOut(true);
      setCapturedPhoto(captureFrame());
      setRecognizing(false);
      console.error(err);
    }
  };

  // Save ponto
  const handleSavePonto = async () => {
    const selectedStaff = recognizedStaff || staff.find((s) => s.id === manualStaffId);
    if (!selectedStaff) {
      toast({ title: "Selecione um funcionário", variant: "destructive" });
      return;
    }
    if (!geoPosition) {
      toast({ title: "GPS obrigatório", description: "Ative a localização para registrar o ponto.", variant: "destructive" });
      return;
    }

    const selectedOgs = nearbyOgs || ogsList.find((o) => o.id === manualOgsId);
    if (!selectedOgs) {
      toast({ title: "Selecione a Obra", description: "Nenhuma obra próxima encontrada. Selecione manualmente.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upload photo if captured
      let photoUrl: string | null = null;
      if (capturedPhoto) {
        const blob = await fetch(capturedPhoto).then((r) => r.blob());
        const fileName = `ponto/${selectedStaff.id}_${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("face-photos").upload(fileName, blob, { contentType: "image/jpeg" });
        if (!upErr) {
          const { data: urlData } = await supabase.storage.from("face-photos").createSignedUrl(fileName, 60 * 60 * 24 * 365);
          photoUrl = urlData?.signedUrl || null;
        }
      }

      const now = new Date();
      const { error } = await supabase.from("ponto_registros" as any).insert({
        staff_id: selectedStaff.id,
        tipo: pontoTipo,
        data: now.toISOString().split("T")[0],
        hora: now.toTimeString().split(" ")[0],
        lat: geoPosition.lat,
        lng: geoPosition.lng,
        ogs_id: selectedOgs.id,
        ogs_number: selectedOgs.ogs_number,
        photo_url: photoUrl,
        metodo: recognizedStaff ? "facial" : "manual",
        company_id: profile?.company_id,
      } as any);

      if (error) throw error;

      setLastPonto({
        nome: selectedStaff.nome,
        tipo: pontoTipo,
        hora: now.toLocaleTimeString("pt-BR"),
      });

      toast({ title: `✅ Ponto de ${pontoTipo} registrado!`, description: `${selectedStaff.nome} — ${now.toLocaleTimeString("pt-BR")}` });

      // Reset
      setRecognizedStaff(null);
      setCapturedPhoto(null);
      setTimedOut(false);
      setManualStaffId("");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const currentOgs = nearbyOgs || ogsList.find((o) => o.id === manualOgsId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-header-gradient text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate("/rh")} className="p-1.5 rounded-lg hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base">Registrar Ponto</h1>
          <p className="text-[10px] text-primary-foreground/70">Ponto Facial Workflux</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* GPS Status */}
        <Card className={geoPosition ? "border-green-500/50" : "border-destructive/50"}>
          <CardContent className="p-3 flex items-center gap-3">
            <MapPin className={`h-5 w-5 ${geoPosition ? "text-green-500" : "text-destructive"}`} />
            <div className="flex-1 min-w-0">
              {geoPosition ? (
                <p className="text-xs text-muted-foreground">
                  📍 GPS ativo: {geoPosition.lat.toFixed(5)}, {geoPosition.lng.toFixed(5)}
                </p>
              ) : (
                <p className="text-xs text-destructive font-medium">{geoError || "Aguardando GPS..."}</p>
              )}
            </div>
            {geoPosition && <Badge variant="outline" className="text-green-600 border-green-500 text-[10px]">OK</Badge>}
          </CardContent>
        </Card>

        {/* Obra detected */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">📌 Obra / OGS</p>
            {nearbyOgs ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-sm font-medium">{nearbyOgs.ogs_number} — {nearbyOgs.client_name}</p>
                <Badge className="text-[9px] ml-auto">Auto</Badge>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">Nenhuma obra no raio de 500m. Selecione:</p>
                </div>
                <Select value={manualOgsId} onValueChange={setManualOgsId}>
                  <SelectTrigger className="h-10 bg-secondary"><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {ogsList.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.ogs_number} — {o.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tipo de ponto */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={pontoTipo === "entrada" ? "default" : "outline"}
            onClick={() => setPontoTipo("entrada")}
            className="h-12"
          >
            🟢 Entrada
          </Button>
          <Button
            variant={pontoTipo === "saida" ? "default" : "outline"}
            onClick={() => setPontoTipo("saida")}
            className="h-12"
          >
            🔴 Saída
          </Button>
        </div>

        {/* Camera */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">📸 Reconhecimento Facial</p>
              {loadingModels && <Badge variant="secondary" className="text-[9px]">Carregando IA...</Badge>}
            </div>

            <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Camera className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
              {recognizing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Identificando...</p>
                  </div>
                </div>
              )}
            </div>

            {!cameraActive ? (
              <Button onClick={startCamera} className="w-full h-11 gap-2" disabled={!geoPosition}>
                <Camera className="w-4 h-4" /> Abrir Câmera
              </Button>
            ) : (
              <Button
                onClick={handleRecognize}
                className="w-full h-11 gap-2"
                disabled={recognizing || !modelsLoaded}
              >
                {recognizing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Identificando...</>
                ) : (
                  <><User className="w-4 h-4" /> Identificar Funcionário</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recognition result */}
        {recognizedStaff && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
              <div>
                <p className="font-bold text-sm">{recognizedStaff.nome}</p>
                <p className="text-xs text-muted-foreground">{recognizedStaff.funcao} • Reconhecido por IA</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual fallback */}
        {timedOut && !recognizedStaff && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-medium text-amber-700">Plano B — Seleção Manual</p>
              </div>
              <Select value={manualStaffId} onValueChange={setManualStaffId}>
                <SelectTrigger className="h-10 bg-secondary"><SelectValue placeholder="Selecionar funcionário..." /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome} — {s.funcao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Save button */}
        {(recognizedStaff || manualStaffId) && (
          <Button
            onClick={handleSavePonto}
            className="w-full h-12 text-base gap-2"
            disabled={saving || !geoPosition || (!nearbyOgs && !manualOgsId)}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {saving ? "Salvando..." : `Registrar ${pontoTipo === "entrada" ? "Entrada" : "Saída"}`}
          </Button>
        )}

        {/* Last ponto confirmation */}
        {lastPonto && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Último registro:</p>
              <p className="font-bold text-sm">{lastPonto.nome}</p>
              <p className="text-xs">{lastPonto.tipo === "entrada" ? "🟢 Entrada" : "🔴 Saída"} às {lastPonto.hora}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
