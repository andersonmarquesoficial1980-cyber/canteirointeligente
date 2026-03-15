import jsPDF from "jspdf";
import { type CalibrationEntry, calcDiffPercent } from "@/components/equipment/KmaCalibrationSection";

interface KmaPdfParams {
  fleet: string;
  date: string;
  operator: string;
  entries: CalibrationEntry[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function generateKmaPdf({ fleet, date, operator, entries }: KmaPdfParams) {
  const validEntries = entries.filter((e) => e.pesoNominal && e.pesoReal);
  if (validEntries.length === 0) {
    alert("Preencha ao menos uma tentativa com pesos para gerar o demonstrativo.");
    return;
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Demonstrativo KMA", pageW / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Calibração de Pesagem — Canteiro Inteligente", pageW / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 10;

  // Info
  doc.setFontSize(10);
  doc.text(`Equipamento: ${fleet}`, 20, y);
  doc.text(`Data: ${date}`, 120, y);
  y += 6;
  doc.text(`Operador: ${operator || "—"}`, 20, y);
  doc.text(`Gerado: ${new Date().toLocaleString("pt-BR")}`, 120, y);
  y += 10;

  // Table header
  const cols = [
    { label: "Tent.", x: 20, w: 15 },
    { label: "Tara (kg)", x: 35, w: 28 },
    { label: "Nominal (kg)", x: 63, w: 30 },
    { label: "Real (kg)", x: 93, w: 28 },
    { label: "Diferença %", x: 121, w: 28 },
    { label: "Fator", x: 149, w: 25 },
  ];

  doc.setFillColor(240, 240, 240);
  doc.rect(18, y - 4, 160, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  cols.forEach((c) => doc.text(c.label, c.x, y));
  y += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const entry of validEntries) {
    const diff = calcDiffPercent(entry);
    const fator = entry.fator ? Number(entry.fator) : null;

    doc.text(String(entry.tentativa), 20, y);
    doc.text(entry.tara ? Number(entry.tara).toLocaleString("pt-BR") : "—", 35, y);
    doc.text(Number(entry.pesoNominal).toLocaleString("pt-BR"), 63, y);
    doc.text(Number(entry.pesoReal).toLocaleString("pt-BR"), 93, y);

    if (diff !== null) {
      if (Math.abs(diff) < 1) {
        doc.setTextColor(22, 163, 74); // green
      } else {
        doc.setTextColor(220, 38, 38); // red
      }
      doc.text(diff.toFixed(2) + "%", 121, y);
      doc.setTextColor(0);
    } else {
      doc.text("—", 121, y);
    }

    doc.text(fator !== null ? fator.toFixed(4) : "—", 149, y);
    y += 7;
  }

  // Separator
  y += 5;
  doc.setDrawColor(200);
  doc.line(20, y, pageW - 20, y);
  y += 10;

  // Photos
  for (const entry of validEntries) {
    if (entry.ticketPhotoFile) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Foto do Ticket — Tentativa ${entry.tentativa}`, 20, y);
      y += 5;

      try {
        const dataUrl = await fileToDataUrl(entry.ticketPhotoFile);
        doc.addImage(dataUrl, "JPEG", 20, y, 120, 80);
        y += 85;
      } catch {
        doc.setFontSize(8);
        doc.text("(Erro ao carregar imagem)", 20, y);
        y += 10;
      }
    }
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("Canteiro Inteligente — Plataforma de Gestão v2.0", pageW / 2, y, { align: "center" });

  doc.save("Demonstrativo_KMA.pdf");
}
