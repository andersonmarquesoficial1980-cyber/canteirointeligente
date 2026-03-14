import { type CalibrationEntry, calcDiffPercent, calcFator } from "@/components/equipment/KmaCalibrationSection";

interface KmaPdfParams {
  fleet: string;
  date: string;
  operator: string;
  entries: CalibrationEntry[];
}

export function generateKmaPdf({ fleet, date, operator, entries }: KmaPdfParams) {
  const validEntries = entries.filter((e) => e.pesoNominalUsina && e.pesoRealReferencia);
  if (validEntries.length === 0) {
    alert("Preencha ao menos uma tentativa com pesos para gerar o demonstrativo.");
    return;
  }

  const rows = validEntries
    .map((e) => {
      const diff = calcDiffPercent(e);
      const fator = calcFator(e);
      return `
        <tr>
          <td style="border:1px solid #ccc;padding:8px;text-align:center">${e.tentativa}</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:right">${Number(e.pesoNominalUsina).toLocaleString("pt-BR")} kg</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:right">${Number(e.pesoRealReferencia).toLocaleString("pt-BR")} kg</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:right">${e.taraCaminhao ? Number(e.taraCaminhao).toLocaleString("pt-BR") + " kg" : "—"}</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:center;font-weight:bold;color:${diff !== null && Math.abs(diff) < 1 ? "#16a34a" : "#dc2626"}">${diff !== null ? diff.toFixed(2) + "%" : "—"}</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:center">${fator !== null ? fator.toFixed(4) : "—"}</td>
        </tr>
      `;
    })
    .join("");

  const photoSections = validEntries
    .filter((e) => e.ticketPhotoUrl)
    .map(
      (e) => `
      <div style="page-break-inside:avoid;margin-top:20px">
        <h3 style="font-size:14px;margin-bottom:8px">📸 Ticket — Tentativa ${e.tentativa}</h3>
        <img src="${e.ticketPhotoUrl}" style="max-width:100%;max-height:400px;border:1px solid #ccc;border-radius:4px" />
      </div>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Demonstrativo KMA — ${fleet}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #666; font-weight: normal; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f3f4f6; border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: center; }
        .info { display: flex; gap: 40px; margin-top: 16px; font-size: 13px; }
        .info span { color: #666; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <h1>Demonstrativo KMA — Calibração de Pesagem</h1>
      <h2>Canteiro Inteligente · Fremix Engenharia</h2>
      <div class="info">
        <p><span>Equipamento:</span> <strong>${fleet}</strong></p>
        <p><span>Data:</span> <strong>${date}</strong></p>
        <p><span>Operador:</span> <strong>${operator || "—"}</strong></p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tentativa</th>
            <th>Peso Nominal Usina</th>
            <th>Peso Real Referência</th>
            <th>Tara Caminhão</th>
            <th>Diferença %</th>
            <th>Fator Ajuste</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${photoSections}
      <p style="margin-top:40px;font-size:11px;color:#999;text-align:center">
        Gerado em ${new Date().toLocaleString("pt-BR")} — Canteiro Inteligente v2.0
      </p>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}
