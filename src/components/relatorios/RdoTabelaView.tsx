import { useMemo } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanExport } from "@/hooks/useCanExport";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RdoTabelaRdo {
  id: string;
  data: string | null;
  encarregado: string | null;
  responsavel: string | null;
  preenchido_por: string | null;
  turno: string | null;
  local?: string | null;
  engenheiro_responsavel?: string | null;
  status_validacao?: string | null;
}

export interface RdoTabelaEfetivo {
  rdo_id: string | null;
  entrada: string | null;
  saida: string | null;
}

interface Props {
  ogs: string;
  ini: string;
  fim: string;
  rdoList: RdoTabelaRdo[];
  efetivoByRdoId: Record<string, RdoTabelaEfetivo[]>;
}

const COLUNAS = ["Data", "Engenheiro", "Encarregado", "Apontador", "OGS", "Local", "Status", "Turno", "Hora inicial", "Hora final"];

const fmtData = (v: string | null) => {
  if (!v) return "-";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
};

const STATUS_LABEL: Record<string, string> = {
  validado: "Validado",
  rejeitado: "Rejeitado",
  aprovado: "Aprovado",
  nao_aprovado: "Não aprovado",
  enviado: "Aguardando validação",
  aguardando_validacao: "Aguardando validação",
  aguardando_encarregado: "Aguardando encarregado",
  cancelado: "Cancelado",
};

const labelStatus = (s?: string | null) => {
  if (!s) return "-";
  return STATUS_LABEL[s] || s.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
};

const statusClass = (s?: string | null) => {
  if (s === "validado" || s === "aprovado") return "bg-green-100 text-green-800";
  if (s === "rejeitado" || s === "nao_aprovado" || s === "cancelado") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
};

// Horário mais frequente entre os lançamentos do efetivo (robusto a turno noturno)
function horarioMaisComum(valores: (string | null | undefined)[]): string {
  const cont: Record<string, number> = {};
  valores.forEach(v => {
    const t = (v || "").trim().slice(0, 5);
    if (/^\d{1,2}:\d{2}$/.test(t)) cont[t] = (cont[t] || 0) + 1;
  });
  const best = Object.entries(cont).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best ? best[0] : "-";
}

export function RdoTabelaView({ ogs, ini, fim, rdoList, efetivoByRdoId }: Props) {
  const { canExport, loading: loadingCanExport } = useCanExport();

  const linhas = useMemo(() => {
    return [...rdoList]
      .sort((a, b) => (a.data || "").localeCompare(b.data || "") || (a.turno || "").localeCompare(b.turno || ""))
      .map(r => {
        const ef = efetivoByRdoId[r.id] || [];
        return {
          id: r.id,
          data: fmtData(r.data),
          engenheiro: r.engenheiro_responsavel || "-",
          encarregado: r.encarregado || r.responsavel || "-",
          apontador: r.preenchido_por || "-",
          ogs,
          local: r.local || "-",
          statusRaw: r.status_validacao || null,
          status: labelStatus(r.status_validacao),
          turno: r.turno || "-",
          inicio: horarioMaisComum(ef.map(e => e.entrada)),
          fim: horarioMaisComum(ef.map(e => e.saida)),
        };
      });
  }, [rdoList, efetivoByRdoId, ogs]);

  const matriz = () =>
    linhas.map(l => [l.data, l.engenheiro, l.encarregado, l.apontador, l.ogs, l.local, l.status, l.turno, l.inicio, l.fim]);

  const nomeArquivo = `RDO_Apontadores_OGS${ogs}_${ini}_a_${fim}`;

  const exportarExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS, ...matriz()]);
    ws["!cols"] = [10, 28, 28, 28, 8, 28, 22, 10, 12, 12].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RDOs");
    XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
  };

  const exportarPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(13);
    doc.text("Relatório de RDOs preenchidos pelos apontadores", 14, 14);
    doc.setFontSize(9);
    doc.text(`OGS ${ogs} • ${fmtData(ini)} a ${fmtData(fim)} • ${linhas.length} RDO(s)`, 14, 20);
    autoTable(doc, {
      head: [COLUNAS],
      body: matriz(),
      startY: 24,
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      headStyles: { fillColor: [21, 87, 232] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save(`${nomeArquivo}.pdf`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl border bg-blue-50/60 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-primary">{linhas.length} RDO(s) encontrados</p>
          <p className="text-xs text-muted-foreground">OGS {ogs} • {fmtData(ini)} a {fmtData(fim)}</p>
        </div>
        {canExport && !loadingCanExport && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportarExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={exportarPdf}>
              <Printer className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              {COLUNAS.map(c => (
                <th key={c} className="px-3 py-2.5 font-semibold whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{l.data}</td>
                <td className="px-3 py-2">{l.engenheiro}</td>
                <td className="px-3 py-2">{l.encarregado}</td>
                <td className="px-3 py-2 font-medium">{l.apontador}</td>
                <td className="px-3 py-2 font-semibold">{l.ogs}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.local}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusClass(l.statusRaw)}`}>{l.status}</span>
                </td>
                <td className="px-3 py-2 capitalize">{l.turno}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.inicio}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.fim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
