import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Brain, Loader2, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NovoDocumentoModal from "@/components/documentos/NovoDocumentoModal";

interface Documento {
  id: string;
  funcionario_nome: string;
  funcionario_matricula: string;
  tipo_documento: string;
  arquivo_url: string;
  status: "pendente" | "aprovado" | "atencao" | "reprovado";
  ia_nome_detectado: string;
  ia_validade: string;
  ia_observacao: string;
}

interface Integracao {
  id: string;
  nome: string;
  obra: string;
  plataforma: string;
  data_limite: string;
}

const STATUS_CONFIG = {
  aprovado:  { icon: CheckCircle,     color: "text-green-600",  bg: "bg-green-50 border-green-200",  label: "✓" },
  atencao:   { icon: AlertTriangle,   color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "⚠" },
  reprovado: { icon: XCircle,         color: "text-red-600",    bg: "bg-red-50 border-red-200",      label: "✗" },
  pendente:  { icon: Clock,           color: "text-gray-400",   bg: "bg-gray-50 border-gray-200",    label: "?" },
};

export default function DocumentosIntegracao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [docExpandido, setDocExpandido] = useState<string | null>(null);
  const [erroIA, setErroIA] = useState("");

  useEffect(() => { if (id) buscarDados(); }, [id]);

  async function buscarDados() {
    setLoading(true);
    const [{ data: integ }, { data: docs }] = await Promise.all([
      supabase.from("ci_integracoes").select("*").eq("id", id).single(),
      supabase.from("ci_documentos").select("*").eq("integracao_id", id).order("funcionario_nome"),
    ]);
    if (integ) setIntegracao(integ);
    if (docs) setDocumentos(docs);
    setLoading(false);
  }

  async function analisarDocumento(doc: Documento) {
    const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY;

    const prompts: Record<string, string> = {
      ASO: "Analise este Atestado de Saúde Ocupacional (ASO). Extraia: nome do funcionário, data de emissão, data de validade, se está legível, se tem assinatura do médico. Responda em JSON: {\"nome\": \"\", \"emissao\": \"\", \"validade\": \"\", \"legivel\": true, \"assinado\": true, \"observacao\": \"\"}",
      OS: "Analise esta Ordem de Serviço (OS). Extraia: nome, data, se está assinada pelo funcionário e pelo responsável, se está legível. JSON: {\"nome\": \"\", \"emissao\": \"\", \"assinado_funcionario\": true, \"assinado_responsavel\": true, \"legivel\": true, \"observacao\": \"\"}",
      "Ficha EPI": "Analise esta Ficha de EPI. Extraia: nome, data, se está assinada, se está legível. JSON: {\"nome\": \"\", \"emissao\": \"\", \"assinado\": true, \"legivel\": true, \"observacao\": \"\"}",
      DEFAULT: `Analise este documento de segurança do tipo ${doc.tipo_documento}. Extraia nome, data, se está legível e assinado. JSON: {\"nome\": \"\", \"emissao\": \"\", \"validade\": \"\", \"legivel\": true, \"assinado\": true, \"observacao\": \"\"}`,
    };

    const prompt = prompts[doc.tipo_documento] || prompts.DEFAULT;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 400,
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: doc.arquivo_url, detail: "high" } },
        ]}],
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    let resultado: any = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) resultado = JSON.parse(match[0]);
    } catch { resultado = { observacao: content }; }

    // Determinar status
    let status = "aprovado";
    if (resultado.legivel === false) status = "reprovado";
    else if (doc.tipo_documento === "OS" && (resultado.assinado_funcionario === false || resultado.assinado_responsavel === false)) status = "reprovado";
    else if ((doc.tipo_documento === "ASO" || doc.tipo_documento === "Ficha EPI") && resultado.assinado === false) status = "reprovado";
    else if (!resultado.nome || resultado.nome.trim() === "") status = "atencao";
    else if (resultado.observacao && resultado.observacao.length > 10) status = "atencao";

    await supabase.from("ci_documentos").update({
      status,
      ia_resultado: resultado,
      ia_nome_detectado: resultado.nome || null,
      ia_validade: resultado.validade || resultado.emissao || null,
      ia_observacao: resultado.observacao || null,
      updated_at: new Date().toISOString(),
    }).eq("id", doc.id);
  }

  async function analisarComIA() {
    const pendentes = documentos.filter(d => d.status === "pendente" && d.arquivo_url);
    if (pendentes.length === 0) return;
    setAnalisando(true);
    setErroIA("");

    for (const doc of pendentes) {
      const isPDF = doc.arquivo_url?.toLowerCase().includes(".pdf");
      if (isPDF) {
        await supabase.from("ci_documentos").update({
          status: "atencao",
          ia_observacao: "PDF não suportado para análise automática. Envie foto do documento.",
          updated_at: new Date().toISOString(),
        }).eq("id", doc.id);
        continue;
      }
      try {
        await analisarDocumento(doc);
      } catch (e: any) {
        setErroIA(`Erro em ${doc.tipo_documento}: ${e.message?.slice(0,80)}`);
      }
    }

    await buscarDados();
    setAnalisando(false);
  }

  // Agrupar por funcionário
  const porFuncionario = documentos.reduce<Record<string, Documento[]>>((acc, doc) => {
    if (!acc[doc.funcionario_nome]) acc[doc.funcionario_nome] = [];
    acc[doc.funcionario_nome].push(doc);
    return acc;
  }, {});

  const totalAprovados = documentos.filter(d => d.status === "aprovado").length;
  const totalAtencao = documentos.filter(d => d.status === "atencao").length;
  const totalReprovados = documentos.filter(d => d.status === "reprovado").length;
  const totalPendentes = documentos.filter(d => d.status === "pendente").length;

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/documentos")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight truncate">
            {integracao?.nome ?? "..."}
          </span>
          {integracao?.obra && (
            <span className="block text-[11px] text-primary-foreground/80">{integracao.obra}</span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Painel resumo */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Aprovados", value: totalAprovados, color: "text-green-700 bg-green-50 border-green-200" },
            { label: "Atenção", value: totalAtencao, color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
            { label: "Reprovados", value: totalReprovados, color: "text-red-700 bg-red-50 border-red-200" },
            { label: "Pendentes", value: totalPendentes, color: "text-gray-600 bg-gray-50 border-gray-200" },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border p-2 text-center ${item.color}`}>
              <p className="text-xl font-display font-bold">{item.value}</p>
              <p className="text-[10px] font-medium">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2">
          <Button onClick={() => setModalAberto(true)} className="flex-1 h-11 gap-2 rounded-xl font-display font-bold">
            <Plus className="w-4 h-4" /> Adicionar Doc
          </Button>
          <Button
            onClick={analisarComIA}
            disabled={analisando || totalPendentes === 0}
            variant="outline"
            className="flex-1 h-11 gap-2 rounded-xl font-display font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {analisando ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</> : <><Brain className="w-4 h-4" /> Analisar com IA</>}
          </Button>
        </div>

        {erroIA && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {erroIA}
          </div>
        )}

        {totalPendentes > 0 && !analisando && (
          <p className="text-xs text-center text-muted-foreground">
            {totalPendentes} documento{totalPendentes !== 1 ? "s" : ""} pendente{totalPendentes !== 1 ? "s" : ""} de análise
          </p>
        )}

        {/* Lista por funcionário */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : Object.keys(porFuncionario).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="font-medium">Nenhum documento ainda</p>
            <p className="text-sm mt-1">Adicione documentos para começar</p>
          </div>
        ) : (
          Object.entries(porFuncionario).map(([nome, docs]) => {
            const temReprovado = docs.some(d => d.status === "reprovado");
            const temAtencao = docs.some(d => d.status === "atencao");
            const todoAprovado = docs.every(d => d.status === "aprovado");

            const borderColor = temReprovado ? "border-l-red-500" : temAtencao ? "border-l-yellow-500" : todoAprovado ? "border-l-green-500" : "border-l-gray-300";

            return (
              <div key={nome} className={`rdo-card border-l-4 ${borderColor}`}>
                <p className="font-display font-bold text-sm mb-2">{nome}</p>
                <div className="flex flex-wrap gap-2">
                  {docs.map(doc => {
                    const cfg = STATUS_CONFIG[doc.status];
                    const expandido = docExpandido === doc.id;
                    return (
                      <div key={doc.id}>
                        <button
                          onClick={() => setDocExpandido(expandido ? null : doc.id)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.color} transition-all`}
                        >
                          <span>{cfg.label}</span>
                          <span>{doc.tipo_documento}</span>
                        </button>
                        {expandido && (
                          <div className={`mt-1 p-2 rounded-lg border text-xs ${cfg.bg} ${cfg.color} space-y-0.5`}>
                            {doc.ia_nome_detectado && <p>👤 {doc.ia_nome_detectado}</p>}
                            {doc.ia_validade && <p>📅 Validade: {doc.ia_validade}</p>}
                            {doc.ia_observacao && <p>💬 {doc.ia_observacao}</p>}
                            {doc.arquivo_url && (
                              <a href={doc.arquivo_url} target="_blank" rel="noreferrer" className="underline">Ver arquivo</a>
                            )}
                            {doc.status === "pendente" && !doc.arquivo_url && <p className="text-gray-500">Sem arquivo anexado</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <NovoDocumentoModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        integracaoId={id ?? ""}
        onSaved={buscarDados}
      />
    </div>
  );
}
