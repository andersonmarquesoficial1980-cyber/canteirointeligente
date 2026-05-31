import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Wrench, Plus, Upload, Camera, Loader2, Trash2, Save, ChevronDown, ChevronUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TIPOS_DOC = ["CRLV", "SEGURO", "LICENÇA", "NF AQUISIÇÃO", "CONTRATO LOCAÇÃO", "OUTRO"];
const TIPOS_MANUT = ["TROCA DE ÓLEO", "PNEU", "CORRETIVA", "PREVENTIVA", "REVISÃO", "FILTROS", "FREIOS", "ELÉTRICA", "OUTRO"];

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function diasParaVencer(d: string) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function EquipamentoProntuario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [equip, setEquip] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [manutencoes, setManutencoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"ficha" | "documentos" | "manutencoes">("ficha");

  // Form documento
  const [showFormDoc, setShowFormDoc] = useState(false);
  const [docTipo, setDocTipo] = useState("CRLV");
  const [docDescricao, setDocDescricao] = useState("");
  const [docNumero, setDocNumero] = useState("");
  const [docEmissao, setDocEmissao] = useState("");
  const [docVencimento, setDocVencimento] = useState("");
  const [docAlerta, setDocAlerta] = useState("30");
  const [docArquivo, setDocArquivo] = useState<File | null>(null);
  const [salvandoDoc, setSalvandoDoc] = useState(false);

  // Form manutenção
  const [showFormManut, setShowFormManut] = useState(false);
  const [manutTipo, setManutTipo] = useState("TROCA DE ÓLEO");
  const [manutDescricao, setManutDescricao] = useState("");
  const [manutData, setManutData] = useState(new Date().toISOString().split("T")[0]);
  const [manutHorimetro, setManutHorimetro] = useState("");
  const [manutKm, setManutKm] = useState("");
  const [manutCusto, setManutCusto] = useState("");
  const [manutFornecedor, setManutFornecedor] = useState("");
  const [manutMecanico, setManutMecanico] = useState("");
  const [manutObs, setManutObs] = useState("");
  const [manutArquivo, setManutArquivo] = useState<File | null>(null);
  const [salvandoManut, setSalvandoManut] = useState(false);

  useEffect(() => { if (id) buscarDados(); }, [id]);

  async function getCompanyId() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;
    const { data: p } = await supabase.from("profiles").select("company_id").eq("user_id", user.user.id).single();
    return p?.company_id ?? null;
  }

  async function buscarDados() {
    setLoading(true);
    const [{ data: e }, { data: d }, { data: m }] = await Promise.all([
      (supabase as any).from("equipamentos").select("*").eq("id", id).single(),
      (supabase as any).from("equipamentos_documentos").select("*").eq("equipamento_id", id).order("data_vencimento"),
      (supabase as any).from("equipamentos_manutencoes").select("*").eq("equipamento_id", id).order("data", { ascending: false }),
    ]);
    if (e) setEquip(e);
    setDocs(d || []);
    setManutencoes(m || []);
    setLoading(false);
  }

  async function uploadArquivo(file: File, pasta: string): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${pasta}/${id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("sst-fotos").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("sst-fotos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvarDocumento() {
    if (!docTipo) return;
    setSalvandoDoc(true);
    const companyId = await getCompanyId();
    let arquivoUrl = null;
    if (docArquivo) arquivoUrl = await uploadArquivo(docArquivo, "equipamentos/documentos");
    const { error } = await (supabase as any).from("equipamentos_documentos").insert({
      equipamento_id: id,
      company_id: companyId,
      tipo: docTipo,
      descricao: docDescricao || null,
      numero: docNumero || null,
      data_emissao: docEmissao || null,
      data_vencimento: docVencimento || null,
      alerta_dias: parseInt(docAlerta) || 30,
      arquivo_url: arquivoUrl,
    });
    if (!error) {
      toast({ title: "Documento salvo!" });
      setShowFormDoc(false);
      setDocTipo("CRLV"); setDocDescricao(""); setDocNumero(""); setDocEmissao(""); setDocVencimento(""); setDocArquivo(null);
      buscarDados();
    } else {
      toast({ title: "Erro ao salvar documento", variant: "destructive" });
    }
    setSalvandoDoc(false);
  }

  async function salvarManutencao() {
    if (!manutTipo || !manutData) return;
    setSalvandoManut(true);
    const companyId = await getCompanyId();
    let arquivoUrl = null;
    if (manutArquivo) arquivoUrl = await uploadArquivo(manutArquivo, "equipamentos/manutencoes");
    const { error } = await (supabase as any).from("equipamentos_manutencoes").insert({
      equipamento_id: id,
      company_id: companyId,
      tipo: manutTipo,
      descricao: manutDescricao || null,
      data: manutData,
      horimetro: manutHorimetro ? parseFloat(manutHorimetro) : null,
      km: manutKm ? parseFloat(manutKm) : null,
      custo: manutCusto ? parseFloat(manutCusto) : null,
      fornecedor: manutFornecedor || null,
      mecanico: manutMecanico || null,
      observacoes: manutObs || null,
      arquivo_url: arquivoUrl,
    });
    if (!error) {
      toast({ title: "Manutenção registrada!" });
      setShowFormManut(false);
      setManutTipo("TROCA DE ÓLEO"); setManutDescricao(""); setManutHorimetro(""); setManutKm(""); setManutCusto(""); setManutFornecedor(""); setManutMecanico(""); setManutObs(""); setManutArquivo(null);
      buscarDados();
    } else {
      toast({ title: "Erro ao salvar manutenção", variant: "destructive" });
    }
    setSalvandoManut(false);
  }

  async function deletarDoc(docId: string) {
    if (!confirm("Remover documento?")) return;
    await (supabase as any).from("equipamentos_documentos").delete().eq("id", docId);
    buscarDados();
  }

  async function deletarManut(manutId: string) {
    if (!confirm("Remover registro de manutenção?")) return;
    await (supabase as any).from("equipamentos_manutencoes").delete().eq("id", manutId);
    buscarDados();
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!equip) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Equipamento não encontrado.</p>
    </div>
  );

  const docsVencendo = docs.filter(d => {
    const dias = diasParaVencer(d.data_vencimento);
    return dias !== null && dias <= 30;
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="hover:bg-white/15 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs opacity-70">Prontuário</p>
            <h1 className="text-xl font-display font-black">{equip.frota}</h1>
            <p className="text-sm opacity-80">{equip.modelo_completo || equip.nome}</p>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${equip.condicao === "TERCEIRO" ? "bg-blue-400/30" : "bg-green-400/30"}`}>
            {equip.condicao === "TERCEIRO" ? "Terceiro" : "Próprio"}
          </span>
        </div>

        {/* Alertas de vencimento */}
        {docsVencendo.length > 0 && (
          <div className="bg-orange-500/30 rounded-xl p-3 mt-2">
            <p className="text-xs font-bold">⚠️ {docsVencendo.length} documento{docsVencendo.length > 1 ? "s" : ""} vencendo</p>
            {docsVencendo.map(d => {
              const dias = diasParaVencer(d.data_vencimento)!;
              return <p key={d.id} className="text-xs opacity-90">{d.tipo}: {dias <= 0 ? "⛔ VENCIDO" : `${dias} dias`}</p>;
            })}
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-2 mt-4">
          {(["ficha", "documentos", "manutencoes"] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${aba === a ? "bg-white text-primary" : "bg-white/20 text-white"}`}>
              {a === "ficha" ? "Ficha" : a === "documentos" ? `Documentos (${docs.length})` : `Manutenções (${manutencoes.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ===== ABA FICHA ===== */}
        {aba === "ficha" && (
          <div className="space-y-4">
            <div className="rdo-card space-y-3">
              <h3 className="font-display font-bold text-sm">Dados Gerais</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Frota", equip.frota],
                  ["Tipo", equip.tipo],
                  ["Placa", equip.placa],
                  ["Ano", equip.ano],
                  ["Condição", equip.condicao === "TERCEIRO" ? "Terceiro" : "Próprio (Fremix)"],
                  equip.condicao === "TERCEIRO" ? ["Empresa", equip.empresa_proprietaria] : ["Patrimônio", equip.patrimonio],
                  ["Setor/Equipe", equip.setor],
                  ["Condutor Atual", equip.condutor_atual],
                  ["Status", equip.status],
                  ["Categoria", equip.categoria_rdo],
                ].filter(([, v]) => v).map(([label, valor]) => (
                  <div key={label as string}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{valor}</p>
                  </div>
                ))}
              </div>
            </div>

            {equip.condicao === "PROPRIO" && (
              <div className="rdo-card space-y-2">
                <h3 className="font-display font-bold text-sm">Aquisição</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {equip.valor_aquisicao && <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-medium text-green-700">R$ {Number(equip.valor_aquisicao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>}
                  {equip.data_aquisicao && <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{fmtDate(equip.data_aquisicao)}</p></div>}
                  {!equip.valor_aquisicao && !equip.data_aquisicao && <p className="text-xs text-muted-foreground col-span-2">Nenhum dado de aquisição cadastrado.</p>}
                </div>
              </div>
            )}

            {equip.condicao === "TERCEIRO" && (
              <div className="rdo-card space-y-2">
                <h3 className="font-display font-bold text-sm">Locação</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {equip.valor_mensal && <div><p className="text-xs text-muted-foreground">Valor Mensal</p><p className="font-medium text-orange-700">R$ {Number(equip.valor_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</p></div>}
                  {equip.data_inicio_locacao && <div><p className="text-xs text-muted-foreground">Início</p><p className="font-medium">{fmtDate(equip.data_inicio_locacao)}</p></div>}
                  {equip.data_fim_locacao && <div><p className="text-xs text-muted-foreground">Fim</p><p className="font-medium">{fmtDate(equip.data_fim_locacao)}</p></div>}
                  {equip.periodo_medicao && <div><p className="text-xs text-muted-foreground">Período Medição</p><p className="font-medium">{equip.periodo_medicao}</p></div>}
                </div>
              </div>
            )}

            {(equip.motivo_manutencao || equip.previsao_liberacao) && (
              <div className="rdo-card border-l-4 border-l-amber-400 space-y-2">
                <h3 className="font-display font-bold text-sm text-amber-700">🔧 Em Manutenção</h3>
                {equip.motivo_manutencao && <p className="text-sm">{equip.motivo_manutencao}</p>}
                {equip.previsao_liberacao && <p className="text-xs text-muted-foreground">Previsão: {fmtDate(equip.previsao_liberacao)}</p>}
              </div>
            )}
          </div>
        )}

        {/* ===== ABA DOCUMENTOS ===== */}
        {aba === "documentos" && (
          <div className="space-y-3">
            <Button onClick={() => setShowFormDoc(v => !v)} className="w-full h-11 gap-2" variant="outline">
              <Plus className="w-4 h-4" /> {showFormDoc ? "Cancelar" : "Adicionar Documento"}
            </Button>

            {showFormDoc && (
              <div className="rdo-card space-y-3">
                <h3 className="font-display font-bold text-sm">Novo Documento</h3>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo *</Label>
                  <Select value={docTipo} onValueChange={setDocTipo}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_DOC.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Número / Código</Label>
                    <Input value={docNumero} onChange={e => setDocNumero(e.target.value)} className="h-10 rounded-xl" placeholder="Ex: 2024/001" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Alerta (dias antes)</Label>
                    <Input type="number" value={docAlerta} onChange={e => setDocAlerta(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data Emissão</Label>
                    <Input type="date" value={docEmissao} onChange={e => setDocEmissao(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data Vencimento</Label>
                    <Input type="date" value={docVencimento} onChange={e => setDocVencimento(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                  <Input value={docDescricao} onChange={e => setDocDescricao(e.target.value)} className="h-10 rounded-xl" placeholder="Observações..." />
                </div>
                {/* Anexo */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Anexo (PDF ou foto)</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl text-sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="w-4 h-4" /> PDF / Imagem
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl text-sm" onClick={() => cameraRef.current?.click()}>
                      <Camera className="w-4 h-4" /> Câmera
                    </Button>
                    <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => setDocArquivo(e.target.files?.[0] || null)} />
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setDocArquivo(e.target.files?.[0] || null)} />
                  </div>
                  {docArquivo && <p className="text-xs text-green-700 font-medium">✓ {docArquivo.name}</p>}
                </div>
                <Button onClick={salvarDocumento} disabled={salvandoDoc} className="w-full h-11 gap-2">
                  {salvandoDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Documento
                </Button>
              </div>
            )}

            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento cadastrado.</p>
            ) : docs.map(d => {
              const dias = diasParaVencer(d.data_vencimento);
              const vencido = dias !== null && dias <= 0;
              const alerta = dias !== null && dias > 0 && dias <= (d.alerta_dias || 30);
              return (
                <div key={d.id} className={`rdo-card border-l-4 ${vencido ? "border-l-red-500" : alerta ? "border-l-orange-400" : "border-l-green-400"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm">{d.tipo}</span>
                        {d.numero && <span className="text-xs text-muted-foreground">{d.numero}</span>}
                        {vencido && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">VENCIDO</span>}
                        {alerta && !vencido && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">{dias}d</span>}
                      </div>
                      {d.descricao && <p className="text-xs text-muted-foreground mt-0.5">{d.descricao}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {d.data_emissao && <span>Emitido: {fmtDate(d.data_emissao)}</span>}
                        {d.data_vencimento && <span>Vence: {fmtDate(d.data_vencimento)}</span>}
                      </div>
                      {d.arquivo_url && (
                        <a href={d.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium mt-1 block">
                          📎 Ver anexo
                        </a>
                      )}
                    </div>
                    <button onClick={() => deletarDoc(d.id)} className="text-destructive p-1 ml-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== ABA MANUTENÇÕES ===== */}
        {aba === "manutencoes" && (
          <div className="space-y-3">
            <Button onClick={() => setShowFormManut(v => !v)} className="w-full h-11 gap-2" variant="outline">
              <Plus className="w-4 h-4" /> {showFormManut ? "Cancelar" : "Registrar Manutenção"}
            </Button>

            {showFormManut && (
              <div className="rdo-card space-y-3">
                <h3 className="font-display font-bold text-sm">Nova Manutenção</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Tipo *</Label>
                    <Select value={manutTipo} onValueChange={setManutTipo}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_MANUT.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data *</Label>
                    <Input type="date" value={manutData} onChange={e => setManutData(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Horímetro</Label>
                    <Input type="number" value={manutHorimetro} onChange={e => setManutHorimetro(e.target.value)} className="h-10 rounded-xl" placeholder="h" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">KM / Odômetro</Label>
                    <Input type="number" value={manutKm} onChange={e => setManutKm(e.target.value)} className="h-10 rounded-xl" placeholder="km" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Custo (R$)</Label>
                    <Input type="number" value={manutCusto} onChange={e => setManutCusto(e.target.value)} className="h-10 rounded-xl" placeholder="0,00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Fornecedor / Oficina</Label>
                    <Input value={manutFornecedor} onChange={e => setManutFornecedor(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mecânico</Label>
                    <Input value={manutMecanico} onChange={e => setManutMecanico(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Descrição / Serviço realizado</Label>
                  <Input value={manutDescricao} onChange={e => setManutDescricao(e.target.value)} className="h-10 rounded-xl" placeholder="Descreva o serviço..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <Input value={manutObs} onChange={e => setManutObs(e.target.value)} className="h-10 rounded-xl" placeholder="Observações adicionais..." />
                </div>
                {/* Anexo */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Anexo (foto ou PDF)</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl text-sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="w-4 h-4" /> Upload
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 h-10 gap-2 rounded-xl text-sm" onClick={() => cameraRef.current?.click()}>
                      <Camera className="w-4 h-4" /> Câmera
                    </Button>
                  </div>
                  {manutArquivo && <p className="text-xs text-green-700 font-medium">✓ {manutArquivo.name}</p>}
                </div>
                <Button onClick={salvarManutencao} disabled={salvandoManut} className="w-full h-11 gap-2">
                  {salvandoManut ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Manutenção
                </Button>
              </div>
            )}

            {manutencoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma manutenção registrada.</p>
            ) : manutencoes.map(m => (
              <div key={m.id} className="rdo-card border-l-4 border-l-blue-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-sm">{m.tipo}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(m.data)}</span>
                      {m.custo > 0 && <span className="text-xs font-bold text-orange-600">R$ {Number(m.custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    </div>
                    {m.descricao && <p className="text-sm mt-0.5">{m.descricao}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {m.horimetro && <span>⏱ {m.horimetro}h</span>}
                      {m.km && <span>🛣 {m.km}km</span>}
                      {m.mecanico && <span>👷 {m.mecanico}</span>}
                      {m.fornecedor && <span>🏭 {m.fornecedor}</span>}
                    </div>
                    {m.observacoes && <p className="text-xs text-muted-foreground mt-1 italic">{m.observacoes}</p>}
                    {m.arquivo_url && (
                      <a href={m.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium mt-1 block">
                        📎 Ver anexo
                      </a>
                    )}
                  </div>
                  <button onClick={() => deletarManut(m.id)} className="text-destructive p-1 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
