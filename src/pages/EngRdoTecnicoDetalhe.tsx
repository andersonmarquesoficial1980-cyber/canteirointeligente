import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Rdo {
  id: string;
  ogs_number: string;
  data: string;
  houve_producao: boolean;
  equipe: string | null;
  localizacao: string | null;
  tipo_servico: string | null;
  solucao_empregada: string | null;
  usina_programada: string | null;
  cauq_programado: number | null;
  usina_atendeu: boolean | null;
  fresagem_m2: number | null;
  rap_espumado_m2: number | null;
  binder_ton: number | null;
  cbuq_fx3_ton: number | null;
  gap_ton: number | null;
  bgs_ton: number | null;
  sma_ton: number | null;
  geogrelha_m2: number | null;
  qtd_caminhoes_fresa: number | null;
  perc_conclusao_via: number | null;
  houve_ocorrencia: boolean;
  descricao_ocorrencia: string | null;
  observacoes: string | null;
  status: string;
  engenheiro_id: string;
}

export default function EngRdoTecnicoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rdo, setRdo] = useState<Rdo | null>(null);
  const [engNome, setEngNome] = useState("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("rdo_engenheiro").select("*").eq("id", id).single();
      if (data) {
        setRdo(data);
        const { data: perfil } = await (supabase as any)
          .from("profiles").select("nome").eq("user_id", data.engenheiro_id).single();
        setEngNome(perfil?.nome || "—");
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const fmtData = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  const fmtNum = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR");
  const statusBadge = (s: string) => s === "enviado"
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Enviado</span>
    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Rascunho</span>;

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
      [""],
      ["PRODUÇÃO", ""],
      ["Tipos de Serviço", rdo.tipo_servico || "—"],
      ["Solução Empregada", rdo.solucao_empregada || "—"],
      ["Usina Programada", rdo.usina_programada || "—"],
      ["CAUQ Programado (t)", fmtNum(rdo.cauq_programado)],
      ["Usina Atendeu", rdo.usina_atendeu == null ? "—" : rdo.usina_atendeu ? "Sim" : "Não"],
      ["Fresagem (m²)", fmtNum(rdo.fresagem_m2)],
      ["RAP Espumado (m²)", fmtNum(rdo.rap_espumado_m2)],
      ["Binder (ton)", fmtNum(rdo.binder_ton)],
      ["CBUQ FX3 (ton)", fmtNum(rdo.cbuq_fx3_ton)],
      ["GAP (ton)", fmtNum(rdo.gap_ton)],
      ["BGS (ton)", fmtNum(rdo.bgs_ton)],
      ["SMA (ton)", fmtNum(rdo.sma_ton)],
      ["Geogrelha (m²)", fmtNum(rdo.geogrelha_m2)],
      ["Qtd Caminhões Fresa", fmtNum(rdo.qtd_caminhoes_fresa)],
      ["% Conclusão Via", rdo.perc_conclusao_via != null ? `${rdo.perc_conclusao_via}%` : "—"],
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
    { label: "Geogrelha", value: rdo.geogrelha_m2 != null ? `${fmtNum(rdo.geogrelha_m2)} m²` : null },
    { label: "Caminhões Fresa", value: rdo.qtd_caminhoes_fresa != null ? `${rdo.qtd_caminhoes_fresa}` : null },
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
        </div>

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
            <Row label="Solução Empregada" value={rdo.solucao_empregada} />
            <Row label="Usina Programada" value={rdo.usina_programada} />
            <Row label="CAUQ Programado" value={rdo.cauq_programado != null ? `${fmtNum(rdo.cauq_programado)} t` : null} />
            <Row label="Usina Atendeu" value={rdo.usina_atendeu == null ? null : rdo.usina_atendeu ? "Sim" : "Não"} />

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
