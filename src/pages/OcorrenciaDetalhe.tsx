import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wrench, CheckCircle, Loader2, Save, ExternalLink, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "ABERTA", label: "Aberta", color: "text-orange-600" },
  { value: "EM_ANDAMENTO", label: "Em andamento", color: "text-blue-600" },
  { value: "CONCLUIDA", label: "Concluída", color: "text-green-600" },
  { value: "CANCELADA", label: "Cancelada", color: "text-gray-500" },
];

const PRIORIDADES_MAP: Record<string, string> = {
  BAIXA: "bg-green-100 text-green-700",
  NORMAL: "bg-blue-100 text-blue-700",
  ALTA: "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
};

function fmtDateTime(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function OcorrenciaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ocorr, setOcorr] = useState<any>(null);
  const [os, setOs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Form OS
  const [showFormOS, setShowFormOS] = useState(false);
  const [osServico, setOsServico] = useState("");
  const [osMecanico, setOsMecanico] = useState("");
  const [osDataPrevista, setOsDataPrevista] = useState("");
  const [osPrioridade, setOsPrioridade] = useState("NORMAL");
  const [salvandoOS, setSalvandoOS] = useState(false);

  // Atualizar status
  const [novoStatus, setNovoStatus] = useState("");

  // Resposta da manutenção
  const [resposta, setResposta] = useState("");
  const [salvandoResposta, setSalvandoResposta] = useState(false);

  useEffect(() => { if (id) buscarDados(); }, [id]);

  async function buscarDados() {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.user.id).single();
      setProfile(p);
    }
    const { data: o } = await (supabase as any).from("equipamentos_ocorrencias").select("*, equipamentos(frota, nome, tipo, placa)").eq("id", id).single();
    setOcorr(o);
    setNovoStatus(o?.status || "ABERTA");
    setResposta(o?.resposta_manutencao || "");

    if (o?.os_id) {
      const { data: osData } = await (supabase as any).from("manutencao_os").select("*").eq("id", o.os_id).single();
      setOs(osData);
    }
    setLoading(false);
  }

  async function atualizarStatus() {
    if (!novoStatus || novoStatus === ocorr?.status) return;
    setSalvando(true);
    const { error } = await (supabase as any).from("equipamentos_ocorrencias")
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      toast({ title: "Status atualizado!" });
      buscarDados();
    }
    setSalvando(false);
  }

  async function abrirOS() {
    if (!osServico.trim()) {
      toast({ title: "Descreva o serviço a executar", variant: "destructive" });
      return;
    }
    setSalvandoOS(true);

    // Gera número OS
    const numeroOS = `OS-${Date.now().toString().slice(-6)}`;

    const { data: novaOS, error } = await (supabase as any).from("manutencao_os").insert({
      company_id: ocorr.company_id,
      numero_os: numeroOS,
      equipment_fleet: ocorr.frota,
      equipamento_id: ocorr.equipamento_id,
      tipo: "CORRETIVA",
      prioridade: osPrioridade,
      status: "ABERTA",
      titulo: ocorr.titulo,
      descricao: ocorr.descricao,
      origem: "OCORRÊNCIA",
      solicitante_nome: ocorr.solicitante_nome,
      mecanico_nome: osMecanico.trim() || null,
      mecanico_tipo: "INTERNO",
      data_abertura: new Date().toISOString().split("T")[0],
      data_prevista: osDataPrevista || null,
      servico_realizado: osServico.trim(),
      created_by: profile?.user_id,
    }).select().single();

    if (!error && novaOS) {
      // Vincula OS à ocorrência e atualiza status
      await (supabase as any).from("equipamentos_ocorrencias")
        .update({ os_id: novaOS.id, status: "EM_ANDAMENTO", updated_at: new Date().toISOString() })
        .eq("id", id);
      toast({ title: `OS ${numeroOS} aberta!`, description: "Ocorrência movida para Em andamento." });
      setShowFormOS(false);
      setOsServico(""); setOsMecanico(""); setOsDataPrevista("");
      buscarDados();
    } else {
      toast({ title: "Erro ao abrir OS", variant: "destructive" });
    }
    setSalvandoOS(false);
  }

  const perfil = profile?.perfil || "";
  const isAdmin = ["Administrador", "Gerente", "admin", "gestor"].includes(perfil) || profile?.role === "admin";
  const isManutencao = isAdmin || perfil === "Manutenção";
  const isOwner = ocorr?.created_by === profile?.user_id;

  async function salvarResposta() {
    if (!resposta.trim()) return;
    setSalvandoResposta(true);
    const { error } = await (supabase as any).from("equipamentos_ocorrencias")
      .update({
        resposta_manutencao: resposta.trim(),
        respondido_em: new Date().toISOString(),
        respondido_por: profile?.nome_completo || "Manutenção",
        status: ocorr?.status === "ABERTA" ? "EM_ANDAMENTO" : ocorr?.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (!error) {
      toast({ title: "Resposta enviada!" });
      buscarDados();
    } else {
      toast({ title: "Erro ao salvar resposta", variant: "destructive" });
    }
    setSalvandoResposta(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!ocorr) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Ocorrência não encontrada.</p>
    </div>
  );

  const prioClass = PRIORIDADES_MAP[ocorr.prioridade] || PRIORIDADES_MAP.NORMAL;

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="hover:bg-white/15 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs opacity-70">Ocorrência</p>
            <h1 className="text-lg font-display font-black leading-tight">{ocorr.frota}</h1>
          </div>
          <span className={`text-[10px] px-2 py-1 rounded font-bold ${prioClass}`}>{ocorr.prioridade}</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Dados da ocorrência */}
        <div className="rdo-card space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display font-bold text-base">{ocorr.titulo}</h2>
              {ocorr.descricao && <p className="text-sm text-muted-foreground mt-1">{ocorr.descricao}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium">{ocorr.tipo}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{ocorr.status}</p></div>
            {ocorr.obra && <div><p className="text-xs text-muted-foreground">Obra</p><p className="font-medium">{ocorr.obra}</p></div>}
            {ocorr.solicitante_nome && <div><p className="text-xs text-muted-foreground">Solicitante</p><p className="font-medium">{ocorr.solicitante_nome}</p></div>}
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Abertura</p><p className="font-medium">{fmtDateTime(ocorr.created_at)}</p></div>
          </div>
          {ocorr.foto_url && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Foto</p>
              <a href={ocorr.foto_url} target="_blank" rel="noopener noreferrer">
                <img src={ocorr.foto_url} className="w-full max-h-48 rounded-xl object-cover" alt="foto ocorrência" />
              </a>
            </div>
          )}
        </div>

        {/* Equipamento */}
        {ocorr.equipamentos && (
          <div className="rdo-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Equipamento</p>
                <p className="font-display font-bold">{ocorr.equipamentos.frota} — {ocorr.equipamentos.tipo}</p>
                <p className="text-sm text-muted-foreground">{ocorr.equipamentos.nome}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(`/equipamentos/prontuario/${ocorr.equipamento_id}`)} className="gap-1 text-xs">
                <ExternalLink className="w-3 h-3" /> Prontuário
              </Button>
            </div>
          </div>
        )}

        {/* OS vinculada */}
        {os && (
          <div className="rdo-card border-l-4 border-l-blue-400 space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span className="font-display font-bold text-sm">OS Vinculada</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs text-muted-foreground">Número</p><p className="font-bold text-blue-700">{os.numero_os}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{os.status}</p></div>
              {os.mecanico_nome && <div><p className="text-xs text-muted-foreground">Mecânico</p><p className="font-medium">{os.mecanico_nome}</p></div>}
              {os.data_prevista && <div><p className="text-xs text-muted-foreground">Previsão</p><p className="font-medium">{os.data_prevista?.split("-").reverse().join("/")}</p></div>}
              {os.servico_realizado && <div className="col-span-2"><p className="text-xs text-muted-foreground">Serviço</p><p className="font-medium">{os.servico_realizado}</p></div>}
            </div>
          </div>
        )}

        {/* Resposta da Manutenção */}
        <div className="rdo-card space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm">Resposta da Manutenção</h3>
          </div>
          {ocorr.resposta_manutencao ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-3 space-y-1">
              <p className="text-sm text-green-800">{ocorr.resposta_manutencao}</p>
              {ocorr.respondido_por && (
                <p className="text-[11px] text-green-600">{ocorr.respondido_por}{ocorr.respondido_em ? ` — ${fmtDateTime(ocorr.respondido_em)}` : ""}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aguardando resposta da manutenção...</p>
          )}
          {/* Campo de edição — apenas Manutenção e Admin */}
          {isManutencao && (
            <div className="space-y-2">
              <textarea
                value={resposta}
                onChange={e => setResposta(e.target.value)}
                placeholder="Digite a resposta ou atualização para o operador..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button onClick={salvarResposta} disabled={salvandoResposta || !resposta.trim()} className="w-full h-10 gap-2">
                {salvandoResposta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {ocorr.resposta_manutencao ? "Atualizar Resposta" : "Enviar Resposta"}
              </Button>
            </div>
          )}
        </div>

        {/* Ações — só admin/gestor/manutenção */}
        {isAdmin && (
          <div className="space-y-3">
            {/* Atualizar status */}
            <div className="rdo-card space-y-3">
              <h3 className="font-display font-bold text-sm">Atualizar Status</h3>
              <div className="flex gap-2">
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger className="h-10 rounded-xl flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={atualizarStatus} disabled={salvando || novoStatus === ocorr.status} className="h-10 px-4">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Abrir OS */}
            {!os && (
              <div className="rdo-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" /> Abrir Ordem de Serviço
                  </h3>
                  <button onClick={() => setShowFormOS(v => !v)} className="text-xs text-primary font-bold">
                    {showFormOS ? "Cancelar" : "Abrir OS"}
                  </button>
                </div>
                {showFormOS && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Serviço a executar *</Label>
                      <Input value={osServico} onChange={e => setOsServico(e.target.value)} className="h-10 rounded-xl" placeholder="Descreva o serviço..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Mecânico</Label>
                        <Input value={osMecanico} onChange={e => setOsMecanico(e.target.value)} className="h-10 rounded-xl" placeholder="Nome" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Previsão</Label>
                        <Input type="date" value={osDataPrevista} onChange={e => setOsDataPrevista(e.target.value)} className="h-10 rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Prioridade</Label>
                      <Select value={osPrioridade} onValueChange={setOsPrioridade}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BAIXA">Baixa</SelectItem>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="ALTA">Alta</SelectItem>
                          <SelectItem value="URGENTE">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={abrirOS} disabled={salvandoOS} className="w-full h-11 gap-2">
                      {salvandoOS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} Abrir OS
                    </Button>
                  </div>
                )}
                {!showFormOS && (
                  <p className="text-xs text-muted-foreground">Nenhuma OS vinculada. Abra uma OS para registrar o serviço de manutenção.</p>
                )}
              </div>
            )}

            {/* Concluir */}
            {os && ocorr.status !== "CONCLUIDA" && (
              <Button onClick={async () => {
                await (supabase as any).from("equipamentos_ocorrencias").update({ status: "CONCLUIDA", updated_at: new Date().toISOString() }).eq("id", id);
                await (supabase as any).from("manutencao_os").update({ status: "CONCLUIDA", data_conclusao: new Date().toISOString().split("T")[0] }).eq("id", os.id);
                toast({ title: "Ocorrência concluída!" });
                buscarDados();
              }} className="w-full h-11 gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4" /> Marcar como Concluída
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
