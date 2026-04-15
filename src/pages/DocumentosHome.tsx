import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, FileCheck, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Integracao {
  id: string;
  nome: string;
  obra: string;
  plataforma: string;
  data_limite: string;
  status: string;
  created_at: string;
  total?: number;
  aprovados?: number;
  reprovados?: number;
  atencao?: number;
}

const PLATAFORMAS = ["Bexap", "GPA", "Sienge", "Totvs", "Outra"];

export default function DocumentosHome() {
  const navigate = useNavigate();
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome: "", obra: "", plataforma: "", data_limite: "" });

  useEffect(() => { buscarIntegracoes(); }, []);

  async function buscarIntegracoes() {
    setLoading(true);
    const { data } = await supabase
      .from("ci_integracoes")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Buscar contagens de docs por integração
      const ids = data.map(i => i.id);
      const { data: docs } = await supabase
        .from("ci_documentos")
        .select("integracao_id, status")
        .in("integracao_id", ids);

      const contagens: Record<string, any> = {};
      (docs ?? []).forEach(d => {
        if (!contagens[d.integracao_id]) contagens[d.integracao_id] = { total: 0, aprovados: 0, reprovados: 0, atencao: 0 };
        contagens[d.integracao_id].total++;
        if (d.status === "aprovado") contagens[d.integracao_id].aprovados++;
        if (d.status === "reprovado") contagens[d.integracao_id].reprovados++;
        if (d.status === "atencao") contagens[d.integracao_id].atencao++;
      });

      setIntegracoes(data.map(i => ({ ...i, ...contagens[i.id] })));
    }
    setLoading(false);
  }

  async function salvarIntegracao() {
    if (!form.nome) return;
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ci_integracoes").insert({
      nome: form.nome,
      obra: form.obra || null,
      plataforma: form.plataforma || null,
      data_limite: form.data_limite || null,
      created_by: user?.id,
    });
    setModalAberto(false);
    setForm({ nome: "", obra: "", plataforma: "", data_limite: "" });
    buscarIntegracoes();
    setSalvando(false);
  }

  function fmtDate(d: string) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  function getStatusColor(integ: Integracao) {
    if (!integ.total) return "border-gray-200";
    if ((integ.reprovados ?? 0) > 0) return "border-l-red-500";
    if ((integ.atencao ?? 0) > 0) return "border-l-yellow-500";
    if ((integ.aprovados ?? 0) === integ.total) return "border-l-green-500";
    return "border-l-blue-400";
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">CI Documentos</span>
          <span className="block text-[11px] text-primary-foreground/80">Gestão de Documentos com IA</span>
        </div>
        <Button size="sm" onClick={() => setModalAberto(true)} className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : integracoes.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma integração ainda</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Crie uma nova para começar a organizar os documentos</p>
            <Button onClick={() => setModalAberto(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Nova Integração
            </Button>
          </div>
        ) : (
          integracoes.map(integ => (
            <button
              key={integ.id}
              onClick={() => navigate(`/documentos/${integ.id}`)}
              className={`w-full text-left rdo-card border-l-4 ${getStatusColor(integ)} hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-base truncate">{integ.nome}</p>
                  {integ.obra && <p className="text-sm text-muted-foreground">{integ.obra}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {integ.plataforma && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{integ.plataforma}</span>
                    )}
                    {integ.data_limite && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {fmtDate(integ.data_limite)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/40 flex-shrink-0 mt-1" />
              </div>

              {(integ.total ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-700">✓ {integ.aprovados ?? 0}</span>
                  <span className="flex items-center gap-1 text-yellow-600">⚠ {integ.atencao ?? 0}</span>
                  <span className="flex items-center gap-1 text-red-600">✗ {integ.reprovados ?? 0}</span>
                  <span className="text-muted-foreground ml-auto">{integ.total} doc{(integ.total ?? 0) !== 1 ? "s" : ""}</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold">Nova Integração</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="rdo-label">Nome *</span>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Integração Aeroporto GRU" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Obra / Local</span>
              <Input value={form.obra} onChange={e => setForm(f => ({ ...f, obra: e.target.value }))} placeholder="Nome da obra" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Plataforma de destino</span>
              <Select value={form.plataforma} onValueChange={v => setForm(f => ({ ...f, plataforma: v }))}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="rdo-label">Data limite</span>
              <Input type="date" value={form.data_limite} onChange={e => setForm(f => ({ ...f, data_limite: e.target.value }))} className="h-11 rounded-xl" />
            </div>
            <Button onClick={salvarIntegracao} disabled={salvando || !form.nome} className="w-full h-11 rounded-xl font-display font-bold">
              {salvando ? "Salvando..." : "Criar Integração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
