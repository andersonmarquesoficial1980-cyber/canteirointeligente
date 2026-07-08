import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Camera, Upload, Loader2, Save, AlertTriangle, CheckCircle, Clock, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyModules } from "@/hooks/useCompanyModules";

const TIPOS = ["OCORRÊNCIA", "FALHA MECÂNICA", "PNEU", "ELÉTRICA", "VAZAMENTO", "RUÍDO ANORMAL", "MANUTENÇÃO PREVENTIVA", "OUTRO"];
const PRIORIDADES = [
  { value: "BAIXA", label: "Baixa", color: "bg-green-100 text-green-700" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "ALTA", label: "Alta", color: "bg-orange-100 text-orange-700" },
  { value: "URGENTE", label: "Urgente", color: "bg-red-100 text-red-700" },
];
const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  ABERTA:      { label: "Aberta",      color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  EM_ANDAMENTO:{ label: "Em andamento",color: "bg-blue-100 text-blue-700 border-blue-200",       icon: Clock },
  CONCLUIDA:   { label: "Concluída",   color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle },
  CANCELADA:   { label: "Cancelada",   color: "bg-gray-100 text-gray-500 border-gray-200",       icon: Clock },
};

function fmtDateTime(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function EquipamentoOcorrencias() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { isSuperAdmin } = useCompanyModules();

  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("ABERTA");
  const [profile, setProfile] = useState<any>(null);

  // Form
  const [equipId, setEquipId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("OCORRÊNCIA");
  const [prioridade, setPrioridade] = useState("NORMAL");
  const [obra, setObra] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.user.id).single();
    setProfile(p);

    const [{ data: ocorr }, { data: equips }] = await Promise.all([
      (supabase as any).from("equipamentos_ocorrencias").select("*, equipamentos(frota, nome, tipo)").eq("company_id", p?.company_id).order("created_at", { ascending: false }),
      (supabase as any).from("equipamentos").select("id, frota, nome, tipo, status").eq("status", "ativo").eq("company_id", p?.company_id).order("frota"),
    ]);
    setOcorrencias(ocorr || []);
    setEquipamentos(equips || []);
    setLoading(false);
  }

  async function uploadFoto(file: File): Promise<string | null> {
    const { data: user } = await supabase.auth.getUser();
    const path = `equipamentos/ocorrencias/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("sst-fotos").upload(path, file, { upsert: true });
    if (error) return null;
    return supabase.storage.from("sst-fotos").getPublicUrl(path).data.publicUrl;
  }

  async function salvar() {
    if (!equipId || !titulo.trim()) {
      toast({ title: "Preencha o equipamento e o título", variant: "destructive" });
      return;
    }
    setSalvando(true);
    let fotoUrl = null;
    if (foto) fotoUrl = await uploadFoto(foto);

    const equip = equipamentos.find(e => e.id === equipId);
    const { error } = await (supabase as any).from("equipamentos_ocorrencias").insert({
      equipamento_id: equipId,
      company_id: profile?.company_id,
      frota: equip?.frota || "",
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      tipo,
      prioridade,
      status: "ABERTA",
      solicitante_nome: profile?.nome_completo || profile?.email,
      solicitante_perfil: profile?.perfil || profile?.role,
      obra: obra.trim() || null,
      foto_url: fotoUrl,
      created_by: profile?.user_id,
    });

    if (!error) {
      toast({ title: "Ocorrência registrada!", description: "A equipe de manutenção será notificada." });
      setShowForm(false);
      setEquipId(""); setTitulo(""); setDescricao(""); setTipo("OCORRÊNCIA"); setPrioridade("NORMAL"); setObra(""); setFoto(null);
      buscarDados();
    } else {
      toast({ title: "Erro ao registrar", variant: "destructive" });
    }
    setSalvando(false);
  }

  async function deletar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Apagar esta ocorrência permanentemente?")) return;
    const { error } = await (supabase as any).from("equipamentos_ocorrencias").delete().eq("id", id);
    if (!error) {
      toast({ title: "Ocorrência apagada." });
      setOcorrencias(prev => prev.filter(o => o.id !== id));
    } else {
      toast({ title: "Erro ao apagar", variant: "destructive" });
    }
  }

  const lista = ocorrencias.filter(o => {
    const matchBusca = !busca || o.frota?.toLowerCase().includes(busca.toLowerCase()) || o.titulo?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || o.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="hover:bg-white/15 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-black">Ocorrências</h1>
            <p className="text-sm opacity-80">Equipamentos</p>
          </div>
          <Button size="sm" onClick={() => setShowForm(v => !v)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
        {/* Filtro status */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["", "ABERTA", "EM_ANDAMENTO", "CONCLUIDA"].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filtroStatus === s ? "bg-white text-orange-600" : "bg-white/20 text-white"}`}>
              {s === "" ? "Todas" : STATUS_MAP[s]?.label || s}
              {s !== "" && <span className="ml-1">({ocorrencias.filter(o => o.status === s).length})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Form nova ocorrência */}
        {showForm && (
          <div className="rdo-card space-y-3 border-l-4 border-l-orange-400">
            <h3 className="font-display font-bold text-sm">Nova Ocorrência</h3>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Equipamento *</Label>
              <Select value={equipId} onValueChange={setEquipId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o equipamento" /></SelectTrigger>
                <SelectContent>
                  {equipamentos.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.frota} — {e.tipo} ({e.nome})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título / O que aconteceu? *</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} className="h-11 rounded-xl" placeholder="Ex: Fresadora FA20 fazendo barulho no motor" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrição detalhada</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} className="h-11 rounded-xl" placeholder="Descreva melhor o problema..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Obra / Local</Label>
              <Input value={obra} onChange={e => setObra(e.target.value)} className="h-10 rounded-xl" placeholder="Ex: CBUQ01 - Aelson" />
            </div>
            {/* Foto */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Foto (opcional)</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl text-sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Upload
                </Button>
                <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl text-sm" onClick={() => cameraRef.current?.click()}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setFoto(e.target.files?.[0] || null)} />
              </div>
              {foto && <p className="text-xs text-green-700 font-medium">✓ {foto.name}</p>}
            </div>
            <Button onClick={salvar} disabled={salvando} className="w-full h-11 gap-2 bg-orange-600 hover:bg-orange-700">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Registrar Ocorrência
            </Button>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por frota ou título..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-10 rounded-xl" />
        </div>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ocorrência encontrada.</p>
        ) : lista.map(o => {
          const st = STATUS_MAP[o.status] || STATUS_MAP.ABERTA;
          const prio = PRIORIDADES.find(p => p.value === o.prioridade);
          return (
            <button key={o.id} onClick={() => navigate(`/manutencao/ocorrencia/${o.id}`)}
              className="w-full text-left rdo-card hover:shadow-md transition-all border-l-4 border-l-orange-400 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm">{o.frota}</span>
                    {prio && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${prio.color}`}>{prio.label}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="text-sm font-medium mt-0.5 truncate">{o.titulo}</p>
                  {o.descricao && <p className="text-xs text-muted-foreground truncate">{o.descricao}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {o.obra && <span>🏗 {o.obra}</span>}
                    {o.solicitante_nome && <span>👤 {o.solicitante_nome}</span>}
                    <span>🕐 {fmtDateTime(o.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  {isSuperAdmin && (
                    <button
                      onClick={(e) => deletar(o.id, e)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Apagar ocorrência"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {o.foto_url && <img src={o.foto_url} className="w-14 h-14 rounded-lg object-cover" alt="foto" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
