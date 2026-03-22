import type { ComboioRefuelEntry } from "@/components/equipment/ComboioRefuelingSection";
import type { TimeEntry } from "@/components/equipment/TimeEntriesSection";

const STYLE = `
body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#333;background:#f9fafb}
h1{color:#001e50;border-bottom:3px solid #0047ab;padding-bottom:8px;font-size:20px}
h2{color:#001e50;margin-top:24px;font-size:16px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left;font-size:13px}
th{background:#0047ab;color:#fff;font-weight:600}
tr:nth-child(even){background:#f0f4ff}
.summary-box{background:#f0f4ff;border:2px solid #0047ab;border-radius:8px;padding:16px;margin:16px 0}
.summary-grid{display:flex;gap:20px;flex-wrap:wrap}
.summary-item{text-align:center;flex:1;min-width:100px}
.summary-item .label{font-size:11px;color:#666;text-transform:uppercase;font-weight:600}
.summary-item .value{font-size:22px;font-weight:800;color:#001e50}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.badge-green{background:#dcfce7;color:#166534}
.badge-yellow{background:#fef9c3;color:#854d0e}
.badge-red{background:#fee2e2;color:#991b1b}
.footer{margin-top:30px;font-size:11px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:12px}
`;

const fmtDate = (d: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const fmtNum = (v: number) => v.toLocaleString("pt-BR");

/* ═══════════════════════════════════════════════════════
   COMBOIO — Relatório de Abastecimento por e-mail
   ═══════════════════════════════════════════════════════ */
export function buildComboioEmailReport(params: {
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
}): string {
  const {
    fleet, date, operator, turno,
    odometerInitial, odometerFinal,
    saldoInicial, fornecedor, entries, observations,
  } = params;

  const validEntries = entries.filter((e) => e.fleetFueled);
  const totalAbastecido = validEntries.reduce((s, e) => s + (Number(e.litersFueled) || 0), 0);
  const saldoIni = Number(saldoInicial) || 0;
  const saldoFinal = saldoIni - totalAbastecido;
  const kmRodados = (Number(odometerFinal) || 0) - (Number(odometerInitial) || 0);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>`;
  html += `<h1>🛢️ Relatório Diário de Comboio — Abastecimento e Lubrificação</h1>`;

  // Info
  html += `<table>
    <tr><th>Frota</th><td>${fleet || "—"}</td><th>Data</th><td>${fmtDate(date)}</td></tr>
    <tr><th>Operador</th><td>${operator || "—"}</td><th>Turno</th><td>${turno || "—"}</td></tr>
    <tr><th>Odômetro</th><td colspan="3">${odometerInitial || "—"} → ${odometerFinal || "—"} (${kmRodados} km)</td></tr>
  </table>`;

  // Summary box
  html += `<div class="summary-box"><div class="summary-grid">
    <div class="summary-item"><div class="label">Saldo Inicial</div><div class="value">${fmtNum(saldoIni)} L</div></div>
    <div class="summary-item"><div class="label">Fornecedor</div><div class="value" style="font-size:14px">${fornecedor || "—"}</div></div>
    <div class="summary-item"><div class="label">Total Abastecido</div><div class="value" style="color:#dc2626">${fmtNum(totalAbastecido)} L</div></div>
    <div class="summary-item"><div class="label">Saldo Final</div><div class="value" style="color:${saldoFinal < 0 ? "#dc2626" : "#166534"}">${fmtNum(saldoFinal)} L</div></div>
  </div></div>`;

  // Table
  if (validEntries.length > 0) {
    html += `<h2>📋 Tabela de Atendimento (${validEntries.length})</h2>`;
    html += `<table><tr><th>#</th><th>Hora</th><th>Frota</th><th>Medição</th><th>Litros</th><th>OGS / Local</th><th>Serviços</th></tr>`;
    validEntries.forEach((e, i) => {
      const services: string[] = [];
      if (e.isLubricated) services.push("Lubrificação");
      if (e.isWashed) services.push("Lavagem");
      html += `<tr>
        <td>${i + 1}</td>
        <td>${e.hora || "—"}</td>
        <td><strong>${e.fleetFueled}</strong></td>
        <td>${e.equipmentMeter ? fmtNum(Number(e.equipmentMeter)) : "—"}</td>
        <td><strong>${e.litersFueled ? fmtNum(Number(e.litersFueled)) : "—"}</strong></td>
        <td>${e.ogsDestination || "—"}</td>
        <td>${services.length > 0 ? services.join(", ") : "—"}</td>
      </tr>`;
    });
    html += `<tr style="background:#dbeafe;font-weight:700">
      <td colspan="4">TOTAL</td>
      <td>${fmtNum(totalAbastecido)} L</td>
      <td colspan="2"></td>
    </tr></table>`;
  }

  if (observations) {
    html += `<h2>📝 Observações</h2><p>${observations}</p>`;
  }

  html += `<div class="footer">Documento gerado automaticamente pelo sistema Canteiro Inteligente — ${new Date().toLocaleString("pt-BR")}</div>`;
  html += `</body></html>`;
  return html;
}

/* ═══════════════════════════════════════════════════════
   CARRETA — Relatório de Transporte por e-mail
   ═══════════════════════════════════════════════════════ */
export function buildCarretaEmailReport(params: {
  fleet: string;
  prancha: string;
  date: string;
  operator: string;
  turno: string;
  odometerInitial: string;
  odometerFinal: string;
  timeEntries: TimeEntry[];
  observations: string;
}): string {
  const {
    fleet, prancha, date, operator, turno,
    odometerInitial, odometerFinal, timeEntries, observations,
  } = params;

  const validEntries = timeEntries.filter((t) => t.startTime && t.activity);
  const kmRodados = (Number(odometerFinal) || 0) - (Number(odometerInitial) || 0);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>`;
  html += `<h1>🚛 Relatório Diário de Carreta — Transporte de Equipamentos</h1>`;

  // Info
  html += `<table>
    <tr><th>Cavalo Mecânico</th><td>${fleet || "—"}</td><th>Data</th><td>${fmtDate(date)}</td></tr>
    <tr><th>Prancha</th><td>${prancha || "—"}</td><th>Turno</th><td>${turno || "—"}</td></tr>
    <tr><th>Operador</th><td>${operator || "—"}</td><th>Odômetro</th><td>${odometerInitial || "—"} → ${odometerFinal || "—"} (${kmRodados} km)</td></tr>
  </table>`;

  // Time entries / transport logs
  if (validEntries.length > 0) {
    html += `<h2>📋 Apontamento de Horas (${validEntries.length})</h2>`;
    html += `<table><tr><th>#</th><th>Início</th><th>Fim</th><th>Atividade</th><th>Origem</th><th>Destino</th><th>Detalhes</th></tr>`;
    validEntries.forEach((t, i) => {
      const isBase = t.destination === "BASE / PÁTIO CENTRAL";
      const destDisplay = isBase
        ? `<span class="badge badge-yellow">🏛️ BASE</span>`
        : (t.destination || "—");

      let details = t.description || "";
      // Parse description for carreta transport details
      if (t.activity === "Transporte" && t.description) {
        details = t.description;
      }
      if (t.activity === "Manutenção" && t.description) {
        details = `<span class="badge badge-red">🔧 ${t.description}</span>`;
      }

      html += `<tr>
        <td>${i + 1}</td>
        <td>${t.startTime || "—"}</td>
        <td>${t.endTime || "—"}</td>
        <td><strong>${t.activity}</strong></td>
        <td>${t.origin || "—"}</td>
        <td>${destDisplay}</td>
        <td>${details || "—"}</td>
      </tr>`;
    });
    html += `</table>`;

    // Highlight returns to base
    const baseReturns = validEntries.filter(
      (t) => t.activity === "Transporte" && t.destination === "BASE / PÁTIO CENTRAL"
    );
    if (baseReturns.length > 0) {
      html += `<div class="summary-box" style="border-color:#dc2626;background:#fef2f2">
        <h2 style="margin-top:0;color:#991b1b">⚠️ Retornos à Base (${baseReturns.length})</h2>`;
      baseReturns.forEach((t) => {
        const desc = t.description || "";
        const hasManut = desc.includes("Manutenção");
        html += `<p>• <strong>${t.origin || "?"} → BASE</strong> — ${hasManut ? '<span class="badge badge-red">Manutenção</span>' : '<span class="badge badge-green">Término de Obra</span>'} ${desc}</p>`;
      });
      html += `</div>`;
    }
  }

  if (observations) {
    html += `<h2>📝 Observações</h2><p>${observations}</p>`;
  }

  html += `<div class="footer">Documento gerado automaticamente pelo sistema Canteiro Inteligente — ${new Date().toLocaleString("pt-BR")}</div>`;
  html += `</body></html>`;
  return html;
}
