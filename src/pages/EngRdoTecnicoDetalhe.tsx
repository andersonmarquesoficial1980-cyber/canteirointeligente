import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileDown, FileSpreadsheet, Loader2, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";

interface Rdo {
  id: string;
  ogs_number: string;
  data: string;
  houve_producao: boolean;
  choveu: boolean | null;
  intensidade_chuva: string | null;
  tipo_secao: string | null;
  motivo_sem_producao: string | null;
  outro_motivo_sem_producao: string | null;
  equipe: string | null;
  localizacao: string | null;
  tipo_servico: string | null;
  infra_descricao: string | null;
  solucao_empregada: string | null;
  usina_programada: string | null;
  cauq_programado: number | null;
  usina_atendeu: boolean | null;
  usina_nao_atendeu_motivo: string | null;
  fresagem_m2: number | null;
  rap_espumado_m2: number | null;
  binder_ton: number | null;
  cbuq_fx3_ton: number | null;
  gap_ton: number | null;
  bgs_ton: number | null;
  sma_ton: number | null;
  bgtc_m3: number | null;
  macadame_m3: number | null;
  cauq_rima_ton: number | null;
  bm25_ton: number | null;
  geogrelha_m2: number | null;
  egl_ton: number | null;
  rachao_ton: number | null;
  qtd_caminhoes_fresa: number | null;
  perc_conclusao_via: number | null;
  equipamentos_conforme: boolean | null;
  equipamentos_nao_conformes: string | null;
  houve_ocorrencia: boolean;
  descricao_ocorrencia: string | null;
  observacoes: string | null;
  status: string;
  engenheiro_id: string;
}

export default function EngRdoTecnicoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const [rdo, setRdo] = useState<Rdo | null>(null);
  const [engNome, setEngNome] = useState("—");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      const { data } = await (supabase as any)
        .from("rdo_engenheiro").select("*").eq("id", id).single();
      if (data) {
        setRdo(data);
        const { data: perfil } = await (supabase as any)
          .from("profiles")
          .select("nome_completo,email")
          .eq("user_id", data.engenheiro_id)
          .single();
        setEngNome(
          perfil?.nome_completo
            || (perfil?.email ? String(perfil.email).split("@")[0] : null)
            || "—"
        );
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const podeEditar = rdo && (isAdmin || rdo.engenheiro_id === currentUserId);

  const handleDeletar = async () => {
    if (!rdo) return;
    setDeletando(true);
    const { data: deletedRows, error } = await (supabase as any)
      .from("rdo_engenheiro")
      .delete()
      .eq("id", rdo.id)
      .select("id");
    setDeletando(false);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    if (!deletedRows || deletedRows.length === 0) {
      toast({
        title: "Exclusão não permitida",
        description: "Seu usuário não tem permissão para excluir este RDO.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "RDO excluído com sucesso" });
    navigate("/engenharia/rdo-tecnico/historico");
  };

  const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  const fmtNum = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR");
  const statusBadge = (s: string) => s === "enviado"
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Enviado</span>
    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Rascunho</span>;

  const getMotivoNaoProducao = (item: Rdo) => {
    if (!item.motivo_sem_producao) return null;
    if (item.motivo_sem_producao === "Outro") {
      return item.outro_motivo_sem_producao
        ? `Outro: ${item.outro_motivo_sem_producao}`
        : "Outro";
    }
    return item.motivo_sem_producao;
  };

  const exportarPDF = () => window.print();

  const exportarExcel = () => {
    if (!rdo) return;
    const rows = [
      ["RDO TÉCNICO — ENGENHARIA", ""],
      [""],
      ["OGS", rdo.ogs_number],
      ["Data", fmtData(rdo.data)],
      ["Engenheiro", engNome],
      ["Equipe", rdo.equipe || "—"],
      ["Localização / Rua", rdo.localizacao || "—"],
      ["Status", rdo.status],
      ["Houve produção", rdo.houve_producao ? "Sim" : "Não"],
      ["Choveu no período", rdo.choveu ? "Sim" : "Não"],
      ["Nível da chuva", rdo.choveu ? (rdo.intensidade_chuva || "—") : "—"],
      ["Seção da obra", rdo.tipo_secao || "—"],
      ["Motivo não produção", rdo.houve_producao ? "—" : getMotivoNaoProducao(rdo) || "—"],
      [""],
      ["PRODUÇÃO", ""],
      ["Tipos de Serviço", rdo.tipo_servico || "—"],
      ["Descrição da Infra", rdo.infra_descricao || "—"],
      ["Solução Empregada", rdo.solucao_empregada || "—"],
      ["Usina Programada", rdo.usina_programada || "—"],
      ["CAUQ Programado (t)", fmtNum(rdo.cauq_programado)],
      ["Usina Atendeu", rdo.usina_atendeu == null ? "—" : rdo.usina_atendeu ? "Sim" : "Não"],
      ["Motivo de a usina não atender", rdo.usina_atendeu === false ? (rdo.usina_nao_atendeu_motivo || "—") : "—"],
      ["Fresagem (m²)", fmtNum(rdo.fresagem_m2)],
      ["RAP Espumado (m²)", fmtNum(rdo.rap_espumado_m2)],
      ["Binder (ton)", fmtNum(rdo.binder_ton)],
      ["CBUQ FX3 (ton)", fmtNum(rdo.cbuq_fx3_ton)],
      ["GAP (ton)", fmtNum(rdo.gap_ton)],
      ["BGS (ton)", fmtNum(rdo.bgs_ton)],
      ["SMA (ton)", fmtNum(rdo.sma_ton)],
      ["BGTC (m³)", fmtNum(rdo.bgtc_m3)],
      ["Macadame (m³)", fmtNum(rdo.macadame_m3)],
      ["CAUQ-RIMA (ton)", fmtNum(rdo.cauq_rima_ton)],
      ["BN25 (ton)", fmtNum(rdo.bm25_ton)],
      ["Geogrelha (m²)", fmtNum(rdo.geogrelha_m2)],
      ["% Conclusão Via", rdo.perc_conclusao_via != null ? `${rdo.perc_conclusao_via}%` : "—"],
      ["Equipamentos na Obra", rdo.equipamentos_conforme == null ? "—" : rdo.equipamentos_conforme ? "Conforme" : "Não Conforme"],
      ["Equipamentos não conformes", rdo.equipamentos_nao_conformes || "—"],
      [""],
      ["OCORRÊNCIAS", ""],
      ["Houve Ocorrência", rdo.houve_ocorrencia ? "Sim" : "Não"],
      ["Descrição", rdo.descricao_ocorrencia || "—"],
      [""],
      ["OBSERVAÇÕES", rdo.observacoes || "—"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RDO Técnico");
    XLSX.writeFile(wb, `RDO_Tecnico_OGS${rdo.ogs_number}_${rdo.data}.xlsx`);
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!rdo) return (
    <div className="max-w-lg mx-auto px-4 py-10 text-center text-muted-foreground">
      RDO não encontrado.
    </div>
  );

  const secCls = "rounded-2xl bg-white border border-border p-4 space-y-3";
  const rowCls = "flex justify-between items-start gap-2";
  const labelCls = "text-xs text-muted-foreground font-semibold";
  const valCls = "text-sm text-foreground text-right";

  const Row = ({ label, value }: { label: string; value: string | null | undefined }) =>
    value && value !== "—" ? (
      <div className={rowCls}>
        <span className={labelCls}>{label}</span>
        <span className={valCls}>{value}</span>
      </div>
    ) : null;

  const quantitativos = [
    { label: "Fresagem", value: rdo.fresagem_m2 != null ? `${fmtNum(rdo.fresagem_m2)} m²` : null },
    { label: "RAP Espumado", value: rdo.rap_espumado_m2 != null ? `${fmtNum(rdo.rap_espumado_m2)} m²` : null },
    { label: "Binder", value: rdo.binder_ton != null ? `${fmtNum(rdo.binder_ton)} ton` : null },
    { label: "CBUQ FX3", value: rdo.cbuq_fx3_ton != null ? `${fmtNum(rdo.cbuq_fx3_ton)} ton` : null },
    { label: "GAP", value: rdo.gap_ton != null ? `${fmtNum(rdo.gap_ton)} ton` : null },
    { label: "BGS", value: rdo.bgs_ton != null ? `${fmtNum(rdo.bgs_ton)} ton` : null },
    { label: "SMA", value: rdo.sma_ton != null ? `${fmtNum(rdo.sma_ton)} ton` : null },
    { label: "BGTC", value: rdo.bgtc_m3 != null ? `${fmtNum(rdo.bgtc_m3)} m³` : null },
    { label: "Macadame", value: rdo.macadame_m3 != null ? `${fmtNum(rdo.macadame_m3)} m³` : null },
    { label: "CAUQ-RIMA", value: rdo.cauq_rima_ton != null ? `${fmtNum(rdo.cauq_rima_ton)} ton` : null },
    { label: "BN25", value: rdo.bm25_ton != null ? `${fmtNum(rdo.bm25_ton)} ton` : null },
    { label: "Geogrelha", value: rdo.geogrelha_m2 != null ? `${fmtNum(rdo.geogrelha_m2)} m²` : null },
    { label: "EGL", value: rdo.egl_ton != null ? `${fmtNum(rdo.egl_ton)} ton` : null },
    { label: "RACHÃO", value: rdo.rachao_ton != null ? `${fmtNum(rdo.rachao_ton)} ton` : null },
    { label: "% Conclusão Via", value: rdo.perc_conclusao_via != null ? `${rdo.perc_conclusao_via}%` : null },
  ].filter(q => q.value);

  return (
    <>
      {/* CSS de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { max-width: 100%; padding: 0; }
        }
      `}</style>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24 print-page">
        {/* Header */}
        <div className="flex items-center gap-3 no-print">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">RDO Técnico</h1>
            <p className="text-xs text-muted-foreground">OGS {rdo.ogs_number} · {fmtData(rdo.data)}</p>
          </div>
        </div>

        {/* Botões de export */}
        <div className="flex gap-3 no-print">
          <button
            onClick={exportarPDF}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-border bg-white text-sm font-semibold hover:bg-muted transition-colors"
          >
            <FileDown className="w-4 h-4" /> PDF / Imprimir
          </button>
          <button
            onClick={exportarExcel}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-border bg-white text-sm font-semibold hover:bg-muted transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>

        {/* Botões Editar / Excluir — só para dono e admin */}
        {podeEditar && (
          <div className="flex gap-3 no-print">
            <button
              onClick={() => navigate(`/engenharia/rdo-tecnico/editar/${rdo!.id}`)}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-primary text-primary bg-white text-sm font-semibold hover:bg-primary/5 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Editar
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-red-400 text-red-500 bg-white text-sm font-semibold hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          </div>
        )}

        {/* Modal confirmação de exclusão */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4 no-print">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-foreground">Excluir RDO?</h3>
              <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. O RDO da OGS {rdo?.ogs_number} de {rdo ? new Date(rdo.data + "T12:00:00").toLocaleDateString("pt-BR") : ""} será removido permanentemente.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                  disabled={deletando}
                >Cancelar</button>
                <button
                  onClick={handleDeletar}
                  className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 flex items-center justify-center gap-2"
                  disabled={deletando}
                >
                  {deletando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deletando ? "Excluindo..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Identificação */}
        <div className={secCls}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Identificação</h2>
            {statusBadge(rdo.status)}
          </div>
          <Row label="OGS / Obra" value={rdo.ogs_number} />
          <Row label="Data" value={fmtData(rdo.data)} />
          <Row label="Engenheiro" value={engNome} />
          <Row label="Equipe" value={rdo.equipe} />
          <Row label="Localização / Rua" value={rdo.localizacao} />
          <Row label="Houve Produção" value={rdo.houve_producao ? "Sim" : "Não"} />
          {!rdo.houve_producao && (
            <Row label="Motivo da não produção" value={getMotivoNaoProducao(rdo)} />
          )}
        </div>

        {/* Meteorologia */}
        <div className={secCls}>
          <h2 className="text-sm font-bold">Meteorologia</h2>
          <Row label="Choveu no período" value={rdo.choveu ? "Sim" : "Não"} />
          {rdo.choveu && <Row label="Nível da chuva" value={rdo.intensidade_chuva || "—"} />}
        </div>

        {rdo.tipo_secao && (
          <div className={secCls}>
            <h2 className="text-sm font-bold">Seção da Obra</h2>
            <Row label="Seção(ões)" value={rdo.tipo_secao} />
          </div>
        )}

        {/* Produção */}
        {rdo.houve_producao && (
          <div className={secCls}>
            <h2 className="text-sm font-bold">Produção</h2>
            {rdo.tipo_servico && (
              <div>
                <p className={labelCls + " mb-1"}>Tipos de Serviço</p>
                <p className="text-sm text-foreground">{rdo.tipo_servico}</p>
              </div>
            )}
            <Row label="Descrição da Infra" value={rdo.infra_descricao} />
            <Row label="Solução Empregada" value={rdo.solucao_empregada} />
            <Row label="Usina Programada" value={rdo.usina_programada} />
            <Row label="CAUQ Programado" value={rdo.cauq_programado != null ? `${fmtNum(rdo.cauq_programado)} t` : null} />
            <Row label="Usina Atendeu" value={rdo.usina_atendeu == null ? null : rdo.usina_atendeu ? "Sim" : "Não"} />
            <Row label="Motivo de a usina não atender" value={rdo.usina_atendeu === false ? rdo.usina_nao_atendeu_motivo : null} />
            <Row label="Equipamentos na Obra" value={rdo.equipamentos_conforme == null ? null : rdo.equipamentos_conforme ? "Conforme" : "Não Conforme"} />
            <Row label="Equipamentos não conformes" value={rdo.equipamentos_nao_conformes} />

            {quantitativos.length > 0 && (
              <>
                <div className="border-t border-border pt-3">
                  <p className={labelCls + " mb-2"}>Quantitativos</p>
                  <div className="space-y-2">
                    {quantitativos.map(q => (
                      <div key={q.label} className={rowCls}>
                        <span className={labelCls}>{q.label}</span>
                        <span className={valCls}>{q.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Ocorrências */}
        <div className={secCls}>
          <h2 className="text-sm font-bold">Ocorrências</h2>
          <Row label="Houve Ocorrência" value={rdo.houve_ocorrencia ? "Sim" : "Não"} />
          {rdo.houve_ocorrencia && rdo.descricao_ocorrencia && (
            <div>
              <p className={labelCls + " mb-1"}>Descrição</p>
              <p className="text-sm text-foreground">{rdo.descricao_ocorrencia}</p>
            </div>
          )}
        </div>

        {/* Observações */}
        {rdo.observacoes && (
          <div className={secCls}>
            <h2 className="text-sm font-bold">Observações</h2>
            <p className="text-sm text-foreground">{rdo.observacoes}</p>
          </div>
        )}
      </div>
    </>
  );
}
