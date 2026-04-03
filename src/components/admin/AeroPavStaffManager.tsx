import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Search, Sun, Moon, Users, Camera, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as faceapi from "face-api.js";

interface StaffMember {
  id: string;
  nome: string;
  funcao: string;
  telefone: string;
  turno: string;
  ativo: boolean;
  hasFace?: boolean;
}

const TURNOS = ["dia", "noite", "indefinido"];
const FUNCOES_PADRAO = [
  "ENCARREGADO GERAL", "ENCARREGADO DE TERRAPLANAGEM", "ENCARREGADO DE DRENAGEM",
  "TOPÓGRAFO", "AUXILIAR DE TOPOGRAFIA", "OPERADOR DE ESCAVADEIRA",
  "OPERADOR DE MOTONIVELADORA", "OPERADOR DE PÁ CARREGADEIRA", "OPERADOR DE ROLO",
  "OPERADOR DE RETROESCAVADEIRA", "MOTORISTA DE CAMINHÃO", "MOTORISTA DE CARRETA",
  "AJUDANTE GERAL", "PEDREIRO", "ARMADOR", "CARPINTEIRO", "SOLDADOR",
  "ELETRICISTA", "ENCANADOR", "GREIDISTA", "MECÂNICO", "BORRACHEIRO",
  "VIGIA", "APONTADOR", "ALMOXARIFE",
];

export default function AeroPavStaffManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [filterTurno, setFilterTurno] = useState("TODOS");

  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [turno, setTurno] = useState("indefinido");

  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editFuncao, setEditFuncao] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editTurno, setEditTurno] = useState("");
  const [saving, setSaving] = useState(false);

  // Face registration
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [faceTarget, setFaceTarget] = useState<StaffMember | null>(null);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [faceRegisteredIds, setFaceRegisteredIds] = useState<Set<string>>(new Set());

  // Load face-api models once
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
      } catch (e) {
        console.error("Face models failed", e);
      }
    };
    loadModels();
  }, []);

  const load = async () => {
    const [staffRes, faceRes] = await Promise.all([
      supabase.from("aero_pav_gru_staff" as any).select("*").eq("ativo", true).order("nome", { ascending: true }),
      supabase.from("face_registrations" as any).select("staff_id"),
    ]);
    if (staffRes.data) setItems(staffRes.data as any as StaffMember[]);
    if (faceRes.data) setFaceRegisteredIds(new Set((faceRes.data as any[]).map((r: any) => r.staff_id)));
  };

  useEffect(() => { load(); }, []);

  // Face dialog helpers
  const openFaceDialog = async (member: StaffMember) => {
    setFaceTarget(member);
    setFaceDialogOpen(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch { toast({ title: "Erro ao abrir câmera", variant: "destructive" }); }
    }, 300);
  };

  const closeFaceDialog = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setFaceDialogOpen(false);
    setFaceTarget(null);
  };

  const handleCaptureFace = async () => {
    if (!videoRef.current || !canvasRef.current || !faceTarget || !modelsLoaded) return;
    setFaceCapturing(true);
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      if (!detection) {
        toast({ title: "Nenhum rosto detectado", description: "Posicione o rosto na câmera.", variant: "destructive" });
        setFaceCapturing(false);
        return;
      }

      // Capture photo
      const v = videoRef.current; const c = canvasRef.current;
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.8));

      // Upload photo
      const fileName = `faces/${faceTarget.id}_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("face-photos").upload(fileName, blob, { contentType: "image/jpeg" });
      let photoUrl: string | null = null;
      if (!upErr) {
        const { data: urlData } = await supabase.storage.from("face-photos").createSignedUrl(fileName, 60 * 60 * 24 * 365);
        photoUrl = urlData?.signedUrl || null;
      }

      // Save descriptor
      const descriptor = Array.from(detection.descriptor);
      const { error } = await supabase.from("face_registrations" as any).upsert({
        staff_id: faceTarget.id,
        descriptor,
        photo_url: photoUrl,
      } as any, { onConflict: "staff_id" });

      if (error) throw error;

      toast({ title: "✅ Face cadastrada!", description: `${faceTarget.nome} registrado com sucesso.` });
      setFaceRegisteredIds(prev => new Set(prev).add(faceTarget.id));
      closeFaceDialog();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setFaceCapturing(false);
  };

  const countDia = useMemo(() => items.filter(f => f.turno === "dia").length, [items]);
  const countNoite = useMemo(() => items.filter(f => f.turno === "noite").length, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterTurno !== "TODOS") list = list.filter(f => f.turno === filterTurno);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(f => f.nome.toLowerCase().includes(s) || f.funcao.toLowerCase().includes(s));
    }
    return list;
  }, [items, filterTurno, search]);

  const handleAdd = async () => {
    if (!nome.trim() || !funcao.trim()) {
      toast({ title: "Atenção", description: "Preencha Nome e Função.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("aero_pav_gru_staff" as any).insert({
      nome: nome.trim().toUpperCase(),
      funcao: funcao.trim().toUpperCase(),
      telefone: telefone.trim(),
      turno,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Funcionário adicionado!" });
    setNome(""); setFuncao(""); setTelefone(""); setTurno("indefinido");
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const { error } = await supabase.from("aero_pav_gru_staff" as any).update({ ativo: false } as any).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Removido!" });
    await load();
  };

  const toggleTurno = async (member: StaffMember) => {
    const next = member.turno === "dia" ? "noite" : "dia";
    const { error } = await supabase.from("aero_pav_gru_staff" as any).update({ turno: next } as any).eq("id", member.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await load();
  };

  const openEdit = (f: StaffMember) => {
    setEditing(f); setEditNome(f.nome); setEditFuncao(f.funcao); setEditTelefone(f.telefone || ""); setEditTurno(f.turno);
  };

  const handleSaveEdit = async () => {
    if (!editing?.id || !editNome.trim() || !editFuncao.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("aero_pav_gru_staff" as any)
      .update({ nome: editNome.trim().toUpperCase(), funcao: editFuncao.trim().toUpperCase(), telefone: editTelefone.trim(), turno: editTurno } as any)
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Atualizado!" });
    setEditing(null);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <Users className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{items.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <Sun className="w-5 h-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">{countDia}<span className="text-sm font-normal text-muted-foreground">/80</span></p>
          <p className="text-xs text-muted-foreground">Turno Dia</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <Moon className="w-5 h-5 mx-auto text-indigo-400 mb-1" />
          <p className="text-2xl font-bold text-foreground">{countNoite}<span className="text-sm font-normal text-muted-foreground">/80</span></p>
          <p className="text-xs text-muted-foreground">Turno Noite</p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Adicionar Funcionário AEROPAV</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-11 bg-secondary border-border" placeholder="NOME COMPLETO" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Função *</Label>
            <Select value={funcao} onValueChange={setFuncao}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {FUNCOES_AEROPAV.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input value={telefone} onChange={e => setTelefone(e.target.value)} className="h-11 bg-secondary border-border" placeholder="(11) 99999-0000" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Turno</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">☀️ Dia</SelectItem>
                <SelectItem value="noite">🌙 Noite</SelectItem>
                <SelectItem value="indefinido">Indefinido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleAdd} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      {/* Search & filter */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-9 bg-secondary border-border" placeholder="Buscar..." />
        </div>
        <Select value={filterTurno} onValueChange={setFilterTurno}>
          <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os turnos</SelectItem>
            <SelectItem value="dia">☀️ Dia</SelectItem>
            <SelectItem value="noite">🌙 Noite</SelectItem>
            <SelectItem value="indefinido">Indefinido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} funcionário(s)</p>

      {/* List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.map(f => (
          <div key={f.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-foreground truncate">{f.nome}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{f.funcao}</span>
                {f.telefone && <span className="text-[10px] text-muted-foreground">{f.telefone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => openFaceDialog(f)}
                className={`p-1.5 rounded-md hover:bg-secondary ${faceRegisteredIds.has(f.id) ? "text-green-500" : "text-muted-foreground"}`}
                title={faceRegisteredIds.has(f.id) ? "Face cadastrada ✅" : "Cadastrar face"}
              >
                <Camera className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleTurno(f)}
                className="p-1.5 rounded-md hover:bg-secondary"
                title={`Turno: ${f.turno} — clique para alternar`}
              >
                {f.turno === "dia" ? <Sun className="w-4 h-4 text-amber-500" /> :
                  f.turno === "noite" ? <Moon className="w-4 h-4 text-indigo-400" /> :
                    <Badge variant="outline" className="text-[9px] px-1">?</Badge>}
              </button>
              <button onClick={() => openEdit(f)} className="text-muted-foreground hover:text-foreground p-1.5"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(f.id)} className="text-destructive p-1.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum funcionário encontrado.</p>}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Funcionário AEROPAV</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Função</Label>
              <Select value={editFuncao} onValueChange={setEditFuncao}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  {FUNCOES_AEROPAV.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input value={editTelefone} onChange={e => setEditTelefone(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Turno</Label>
              <Select value={editTurno} onValueChange={setEditTurno}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">☀️ Dia</SelectItem>
                  <SelectItem value="noite">🌙 Noite</SelectItem>
                  <SelectItem value="indefinido">Indefinido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={saving} className="w-full h-11">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Face registration dialog */}
      <Dialog open={faceDialogOpen} onOpenChange={(open) => { if (!open) closeFaceDialog(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>📸 Cadastrar Face — {faceTarget?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <p className="text-xs text-muted-foreground text-center">Posicione o rosto do funcionário na câmera e clique em capturar.</p>
            <Button
              onClick={handleCaptureFace}
              disabled={faceCapturing || !modelsLoaded}
              className="w-full h-11 gap-2"
            >
              {faceCapturing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : <><Camera className="w-4 h-4" /> Capturar e Salvar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
