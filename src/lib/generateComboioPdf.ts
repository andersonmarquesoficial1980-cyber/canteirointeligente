import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ComboioRefuelEntry } from "@/components/equipment/ComboioRefuelingSection";
import logoSrc from "@/assets/logo-ci.png";

interface ComboioPdfParams {
  fleet: string;
  date: string;
  operator: string;
  turno: string;
  odometerInitial: string;
  odometerFinal: string;
  saldoInicial: string;
  fornecedor: string;
  entries: ComboioRefuelEntry[];
  observations: string;
}

function loadLogoAsDataUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    // Use the circular logo from assets
    img.src = new URL("@/assets/logo-ci.png", import.meta.url).href;
  });
}

export async function generateComboioPdf(params: ComboioPdfParams) {
  const {
    fleet, date, operator, turno,
    odometerInitial, odometerFinal,
    saldoInicial, fornecedor, entries, observations,
  } = params;

  const validEntries = entries.filter((e) => e.fleetFueled);
  if (validEntries.length === 0) {
    alert("Adicione ao menos um abastecimento antes de gerar o relatório.");
    return;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const NAVY = [0, 30, 80] as const;
  const BLUE_ACCENT = [0, 71, 171] as const;
  const LIGHT_BLUE = [230, 240, 255] as const;
  let y = 15;

  // ── LOGO ──
  try {
    const logoUrl = await loadLogoAsDataUrl();
    doc.addImage(logoUrl, "PNG", 14, 10, 22, 22);
  } catch {
    // skip logo if unavailable
  }

  // ── HEADER ──
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("RELATÓRIO DIÁRIO DE ABASTECIMENTO", pageW / 2, y + 5, { align: "center" });
  doc.text("E LUBRIFICAÇÃO", pageW / 2, y + 11, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Controle de Insumos e Logística de Pista", pageW / 2, y + 17, { align: "center" });

  // Divider
  y += 24;
  doc.setDrawColor(...BLUE_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  // ── INFO ROW ──
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(`Frota: ${fleet || "—"}`, 14, y);
  doc.text(`Data: ${date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}`, 80, y);
  doc.text(`Turno: ${turno || "—"}`, 145, y);
  y += 5;
  doc.text(`Operador: ${operator || "—"}`, 14, y);
  const kmRodados = (Number(odometerFinal) || 0) - (Number(odometerInitial) || 0);
  doc.text(`Odômetro: ${odometerInitial || "—"} → ${odometerFinal || "—"} (${kmRodados} km)`, 80, y);
  y += 8;

  // ── RESUMO BOX ──
  const totalAbastecido = validEntries.reduce((sum, e) => sum + (Number(e.litersFueled) || 0), 0);
  const saldoIni = Number(saldoInicial) || 0;
  const saldoFinal = saldoIni - totalAbastecido;

  const boxY = y;
  const boxH = 28;
  doc.setDrawColor(...BLUE_ACCENT);
  doc.setLineWidth(0.6);
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(14, boxY, pageW - 28, boxH, 3, 3, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("BALANÇO DO DIA", pageW / 2, boxY + 5, { align: "center" });

  const cols4 = [
    { label: "Saldo Inicial", value: `${saldoIni.toLocaleString("pt-BR")} L` },
    { label: "Fornecedor", value: fornecedor || "—" },
    { label: "Total Abastecido", value: `${totalAbastecido.toLocaleString("pt-BR")} L` },
    { label: "Saldo Fechamento", value: `${saldoFinal.toLocaleString("pt-BR")} L` },
  ];
  const colW = (pageW - 36) / 4;
  cols4.forEach((col, i) => {
    const cx = 18 + i * colW + colW / 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(col.label, cx, boxY + 12, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(col.value, cx, boxY + 20, { align: "center" });
  });

  y = boxY + boxH + 8;

  // ── TABELA DE ATENDIMENTO ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("TABELA DE ATENDIMENTO", 14, y);
  y += 3;

  const tableBody = validEntries.map((e, i) => {
    const services: string[] = [];
    if (e.isLubricated) services.push("Lubr.");
    if (e.isWashed) services.push("Lav.");
    return [
      String(i + 1),
      e.fleetFueled || "—",
      e.equipmentMeter ? Number(e.equipmentMeter).toLocaleString("pt-BR") : "—",
      e.litersFueled ? Number(e.litersFueled).toLocaleString("pt-BR") : "—",
      e.ogsDestination || "—",
      services.length > 0 ? services.join(" / ") : "—",
    ];
  });

  // Total row
  tableBody.push([
    "",
    "TOTAL",
    "",
    totalAbastecido.toLocaleString("pt-BR"),
    "",
    "",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Frota", "Medição (H/Km)", "Litros", "OGS", "Lubr./Lav."]],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 30, 30],
      lineColor: [200, 210, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BLUE_ACCENT as any,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: LIGHT_BLUE as any,
    },
    foot: [],
    didParseCell: (data) => {
      // Bold the total row
      if (data.row.index === tableBody.length - 1 && data.section === "body") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [220, 230, 250];
      }
    },
    theme: "grid",
  });

  // Get final Y after table
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── OBSERVAÇÕES ──
  if (observations) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("OBSERVAÇÕES:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(observations, pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 8;
  }

  // ── ASSINATURAS ──
  if (y > 240) { doc.addPage(); y = 20; }
  y = Math.max(y, 220);

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  const signW = 70;
  const signLeft = 25;
  const signRight = pageW - 25 - signW;

  doc.line(signLeft, y, signLeft + signW, y);
  doc.line(signRight, y, signRight + signW, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Operador / Lubrificador", signLeft + signW / 2, y + 5, { align: "center" });
  doc.text("Encarregado / Supervisor", signRight + signW / 2, y + 5, { align: "center" });

  // ── RODAPÉ ──
  const footY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140, 140, 140);
  doc.text(
    "Documento gerado digitalmente pelo sistema Canteiro Inteligente — Plataforma de Gestão v2.0",
    pageW / 2, footY, { align: "center" }
  );
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    pageW / 2, footY + 3.5, { align: "center" }
  );

  doc.save(`Relatorio_Comboio_${fleet}_${date}.pdf`);
}
