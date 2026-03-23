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
    saldoInicial, entries, observations,
  } = params;

  const validEntries = entries.filter((e) => e.fleetFueled);
  const totalAbastecido = validEntries.reduce((s, e) => s + (Number(e.litersFueled) || 0), 0);
  const saldoIni = Number(saldoInicial) || 0;
  const saldoFinal = saldoIni - totalAbastecido;
  const kmIni = Number(odometerInitial) || 0;
  const kmFin = Number(odometerFinal) || 0;
  const kmRodado = kmFin - kmIni;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>`;
  html += `<h1>🛢️ Relatório Diário de Comboio — Abastecimento</h1>`;

  html += `<div class="summary-box"><div class="summary-grid">
    <div class="summary-item"><div class="label">Comboio</div><div class="value" style="font-size:16px">${fleet || "—"}</div></div>
    <div class="summary-item"><div class="label">Data</div><div class="value" style="font-size:16px">${fmtDate(date)}</div></div>
    <div class="summary-item"><div class="label">Operador</div><div class="value" style="font-size:14px">${operator || "—"}</div></div>
    <div class="summary-item"><div class="label">Turno</div><div class="value" style="font-size:14px">${turno || "—"}</div></div>
  </div></div>`;

  html += `<div class="summary-box"><div class="summary-grid">
    <div class="summary-item"><div class="label">KM Inicial</div><div class="value" style="font-size:16px">${kmIni > 0 ? fmtNum(kmIni) : "—"}</div></div>
    <div class="summary-item"><div class="label">KM Final</div><div class="value" style="font-size:16px">${kmFin > 0 ? fmtNum(kmFin) : "—"}</div></div>
    <div class="summary-item"><div class="label">KM Percorrido</div><div class="value" style="font-size:16px;color:#0047ab">${kmRodado > 0 ? fmtNum(kmRodado) : "—"}</div></div>
    <div class="summary-item"><div class="label">Total Abastecido</div><div class="value" style="color:#dc2626">${fmtNum(totalAbastecido)} L</div></div>
    <div class="summary-item"><div class="label">Saldo Final</div><div class="value" style="color:${saldoFinal < 0 ? "#dc2626" : "#166534"}">${fmtNum(saldoFinal)} L</div></div>
  </div></div>`;

  if (validEntries.length > 0) {
    html += `<h2>📋 Tabela de Atendimento (${validEntries.length})</h2>`;
    html += `<table><tr><th>Data</th><th>Prefixo</th><th>Equipamento Abastecido</th><th>Litros</th><th>Medição (H/KM)</th><th>OGS / Local</th><th>Serviços</th></tr>`;
    validEntries.forEach((e) => {
      const services: string[] = [];
      if (e.isLubricated) services.push("Lubrificação");
      if (e.isWashed) services.push("Lavagem");
      html += `<tr>
        <td>${fmtDate(date)}</td>
        <td><strong>${fleet}</strong></td>
        <td><strong>${e.fleetFueled}</strong></td>
        <td>${e.litersFueled ? fmtNum(Number(e.litersFueled)) : "—"}</td>
        <td>${e.equipmentMeter ? fmtNum(Number(e.equipmentMeter)) : "—"}</td>
        <td>${e.ogsDestination || "—"}</td>
        <td>${services.length > 0 ? services.join(", ") : "—"}</td>
      </tr>`;
    });
    html += `<tr style="background:#dbeafe;font-weight:700">
      <td colspan="3">TOTAL</td>
      <td>${fmtNum(totalAbastecido)} L</td>
      <td colspan="3"></td>
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
  const kmIni = Number(odometerInitial) || 0;
  const kmFin = Number(odometerFinal) || 0;
  const kmRodado = kmFin - kmIni;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>`;
  html += `<h1>🚛 Relatório Diário de Carreta — Transporte de Equipamentos</h1>`;

  html += `<div class="summary-box"><div class="summary-grid">
    <div class="summary-item"><div class="label">Cavalo Mecânico</div><div class="value" style="font-size:16px">${fleet || "—"}</div></div>
    <div class="summary-item"><div class="label">Prancha</div><div class="value" style="font-size:16px">${prancha || "—"}</div></div>
    <div class="summary-item"><div class="label">Data</div><div class="value" style="font-size:16px">${fmtDate(date)}</div></div>
    <div class="summary-item"><div class="label">Operador</div><div class="value" style="font-size:14px">${operator || "—"}</div></div>
    <div class="summary-item"><div class="label">Turno</div><div class="value" style="font-size:14px">${turno || "—"}</div></div>
  </div></div>`;

  html += `<div class="summary-box"><div class="summary-grid">
    <div class="summary-item"><div class="label">KM Inicial</div><div class="value" style="font-size:16px">${kmIni > 0 ? fmtNum(kmIni) : "—"}</div></div>
    <div class="summary-item"><div class="label">KM Final</div><div class="value" style="font-size:16px">${kmFin > 0 ? fmtNum(kmFin) : "—"}</div></div>
    <div class="summary-item"><div class="label">KM Percorrido</div><div class="value" style="font-size:16px;color:#0047ab">${kmRodado > 0 ? fmtNum(kmRodado) : "—"}</div></div>
  </div></div>`;

  if (validEntries.length > 0) {
    html += `<h2>📋 Apontamento de Horas (${validEntries.length})</h2>`;
    html += `<table><tr><th>Data</th><th>Prefixo</th><th>Equip. 01</th><th>Equip. 02</th><th>Equip. 03</th><th>Origem</th><th>Destino</th><th>Horário</th><th>Observações</th></tr>`;
    validEntries.forEach((t) => {
      const eq1 = t.transportEquip1 === "Outro" ? t.transportEquip1Custom : t.transportEquip1;
      const eq2 = t.transportEquip2 === "Outro" ? t.transportEquip2Custom : t.transportEquip2;
      const eq3 = t.transportEquip3 === "Outro" ? t.transportEquip3Custom : t.transportEquip3;

      const obsParts: string[] = [];
      if (t.activity && t.activity !== "Transporte") obsParts.push(t.activity);
      if (t.destination === "BASE / PÁTIO CENTRAL" && t.returnReason) {
        obsParts.push(t.returnReason);
        if (t.returnReason === "Manutenção / Oficina" && t.returnDetails) obsParts.push(t.returnDetails);
      }
      if (t.origin === t.destination && t.transportInternalDetails) obsParts.push(`Trecho: ${t.transportInternalDetails}`);
      if (t.activity === "Manutenção" && t.maintenanceDetails) obsParts.push(t.maintenanceDetails);
      if (t.transportObs) obsParts.push(t.transportObs);

      html += `<tr>
        <td>${fmtDate(date)}</td>
        <td><strong>${fleet}</strong></td>
        <td>${eq1 || "—"}</td>
        <td>${eq2 || "—"}</td>
        <td>${eq3 || "—"}</td>
        <td>${t.origin || "—"}</td>
        <td>${t.destination || "—"}</td>
        <td>${t.startTime || "—"} — ${t.endTime || "—"}</td>
        <td>${obsParts.length > 0 ? obsParts.join(" | ") : "—"}</td>
      </tr>`;
    });
    html += `</table>`;

    const baseReturns = validEntries.filter(
      (t) => t.activity === "Transporte" && t.destination === "BASE / PÁTIO CENTRAL"
    );
    if (baseReturns.length > 0) {
      html += `<div class="summary-box" style="border-color:#dc2626;background:#fef2f2">
        <h2 style="margin-top:0;color:#991b1b">⚠️ Retornos à Base (${baseReturns.length})</h2>`;
      baseReturns.forEach((t) => {
        const hasManut = t.returnReason?.includes("Manutenção");
        html += `<p>• <strong>${t.origin || "?"} → BASE</strong> — ${hasManut ? '<span class="badge badge-red">Manutenção</span>' : '<span class="badge badge-green">Término de Obra</span>'} ${t.returnDetails || ""}</p>`;
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
