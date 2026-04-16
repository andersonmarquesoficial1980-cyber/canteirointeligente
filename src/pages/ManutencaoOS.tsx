import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2, Save, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STATUS_OPTIONS = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "aguardando_peca", label: "Aguardando Peça" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

const CATEGORIAS_PECA = [
  "Bits Fresadora", "Bits Cônica (Bobcat)", "Raspador Fresadora",
  "Cerda Bobcat", "Rompedor Retro", "Pneu", "Sapata/Esteira",
  "Correia", "Óleo Motor", "Óleo Hidráulico", "Filtro",
  "Rolamento", "Mangueira", "Outro",
];

const UNIDADES = ["un", "litros", "metros", "kg", "par"];

interface Peca {
  id?: string;
  nome_peca: string;
  categoria: string;
  quantidade: string;
  unidade: string;
  horimetro_troca: string;
  observacao: string;
  isNew?: boolean;
}

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function ManutencaoOS() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [os, setOs] = useState<any>(null);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState("");
  const [servicoRealizado, setServicoRealizado] = useState("");
  const [horimetroConclusao, setHorimetroConclusao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => { if (id) buscarOS(); }, [id]);

  async function buscarOS() {
    setLoading(true);
    const [{ data: osData }, { data: pecasData }] = await Promise.all([
      supabase.from("manutencao_os").select("*").eq("id", id).single(),
      supabase.from("manutencao_pecas").select("*").eq("os_id", id).order("created_at"),
    ]);
    if (osData) {
      setOs(osData);
      setStatus(osData.status);
      setServicoRealizado(osData.servico_realizado || "");
      setHorimetroConclusao(osData.horimetro_conclusao ? String(osData.horimetro_conclusao) : "");
      setObservacoes(osData.observacoes || "");
    }
    if (pecasData) setPecas(pecasData.map(p => ({ ...p, quantidade: String(p.quantidade), horimetro_troca: p.horimetro_troca ? String(p.horimetro_troca) : "" })));
    setLoading(false);
  }

  async function salvar() {
    setSalvando(true);
    try {
      // Atualizar OS
      await supabase.from("manutencao_os").update({
        status,
        servico_realizado: servicoRealizado || null,
        horimetro_conclusao: horimetroConclusao ? parseFloat(horimetroConclusao) : null,
        observacoes: observacoes || null,
        data_conclusao: status === "concluida" ? new Date().toISOString().split("T")[0] : null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);

      // Salvar peças novas
      const novas = pecas.filter(p => p.isNew && p.nome_peca);
      if (novas.length > 0) {
        await supabase.from("manutencao_pecas").insert(novas.map(p => ({
          os_id: id,
          equipment_fleet: os?.equipment_fleet,
          nome_peca: p.nome_peca,
          categoria: p.categoria || null,
          quantidade: parseFloat(p.quantidade) || 1,
          unidade: p.unidade || "un",
          horimetro_troca: p.horimetro_troca ? parseFloat(p.horimetro_troca) : null,
          observacao: p.observacao || null,
        })));
      }

      await buscarOS();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSalvando(false);
    }
  }

  function addPeca() {
    setPecas(p => [...p, { nome_peca: "", categoria: "", quantidade: "1", unidade: "un", horimetro_troca: "", observacao: "", isNew: true }]);
  }

  async function removePeca(idx: number) {
    const p = pecas[idx];
    if (p.id) await supabase.from("manutencao_pecas").delete().eq("id", p.id);
    setPecas(prev => prev.filter((_, i) => i !== idx));
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!os) return <div className="p-8 text-center text-muted-foreground">OS não encontrada.</div>;

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/manutencao")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">OS #{os.numero_os}</span>
          <span className="block text-[11px] text-primary-foreground/80">{os.equipment_fleet} — {os.equipment_type}</span>
        </div>
        <Button size="sm" onClick={salvar} disabled={salvando} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Dados da OS */}
        <div className="rdo-card space-y-3">
          <h3 className="font-display font-bold text-sm">Dados da OS</h3>
          <p className="text-base font-semibold">{os.titulo}</p>
          {os.descricao && <p className="text-sm text-muted-foreground">{os.descricao}</p>}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Tipo: <strong>{os.tipo}</strong></span>
            <span>Prioridade: <strong>{os.prioridade}</strong></span>
            <span>Abertura: <strong>{fmtDate(os.data_abertura)}</strong></span>
            {os.data_prevista && <span>Prevista: <strong>{fmtDate(os.data_prevista)}</strong></span>}
            {os.solicitante_nome && <span>Solicitante: <strong>{os.solicitante_nome}</strong></span>}
            {os.mecanico_nome && <span>Mecânico: <strong>{os.mecanico_nome}</strong></span>}
          </div>
        </div>

        {/* Status */}
        <div className="rdo-card space-y-3">
          <h3 className="font-display font-bold text-sm">Atualizar Status</h3>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Serviço realizado */}
        <div className="rdo-card space-y-3">
          <h3 className="font-display font-bold text-sm">Serviço Realizado</h3>
          <Textarea
            value={servicoRealizado}
            onChange={e => setServicoRealizado(e.target.value)}
            placeholder="Descreva o que foi feito..."
            className="min-h-[90px] rounded-xl"
          />
          <div className="space-y-1.5">
            <span className="rdo-label">Horímetro na conclusão</span>
            <Input type="number" value={horimetroConclusao} onChange={e => setHorimetroConclusao(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
          </div>
        </div>

        {/* Peças */}
        <div className="rdo-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm">Peças & Materiais Usados</h3>
            <Button size="sm" variant="outline" onClick={addPeca} className="gap-1 h-8 text-xs"><Plus className="w-3 h-3" /> Adicionar</Button>
          </div>

          {pecas.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma peça registrada.</p>}

          {pecas.map((p, idx) => (
            <div key={idx} className="border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Peça {idx + 1}</span>
                <button onClick={() => removePeca(idx)} className="text-destructive p-1 hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Nome da Peça</span>
                <Input value={p.nome_peca} onChange={e => setPecas(prev => prev.map((item, i) => i === idx ? { ...item, nome_peca: e.target.value } : item))} placeholder="Ex: Bit fresadora" className="h-10 rounded-xl" readOnly={!p.isNew} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <span className="rdo-label">Categoria</span>
                  <Select value={p.categoria} onValueChange={v => setPecas(prev => prev.map((item, i) => i === idx ? { ...item, categoria: v } : item))} disabled={!p.isNew}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_PECA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="rdo-label">Qtd / Unidade</span>
                  <div className="flex gap-1">
                    <Input type="number" value={p.quantidade} onChange={e => setPecas(prev => prev.map((item, i) => i === idx ? { ...item, quantidade: e.target.value } : item))} className="h-10 rounded-xl w-16" readOnly={!p.isNew} />
                    <Select value={p.unidade} onValueChange={v => setPecas(prev => prev.map((item, i) => i === idx ? { ...item, unidade: v } : item))} disabled={!p.isNew}>
                      <SelectTrigger className="h-10 rounded-xl flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="rdo-label">Horímetro da troca</span>
                <Input type="number" value={p.horimetro_troca} onChange={e => setPecas(prev => prev.map((item, i) => i === idx ? { ...item, horimetro_troca: e.target.value } : item))} placeholder="0" className="h-10 rounded-xl" readOnly={!p.isNew} />
              </div>
            </div>
          ))}
        </div>

        {/* Observações */}
        <div className="rdo-card space-y-3">
          <h3 className="font-display font-bold text-sm">Observações</h3>
          <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais..." className="min-h-[70px] rounded-xl" />
        </div>

        <Button onClick={salvar} disabled={salvando} className="w-full h-12 rounded-xl font-display font-bold gap-2">
          {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><CheckCircle className="w-4 h-4" /> Salvar Atualização</>}
        </Button>
      </div>
    </div>
  );
}
