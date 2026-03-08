import type { ProducaoCauqData } from "@/components/rdo/SectionProducaoCauq";
import type { NotaFiscalMassaEntry } from "@/components/rdo/SectionCauq";
import type { EfetivoEntry } from "@/components/rdo/StepEfetivo";
import type { EquipamentoEntry } from "@/components/rdo/SectionEquipamentos";
import type { BasculanteEntry } from "@/components/rdo/SectionBasculante";

interface HeaderData {
  data: string;
  obra_nome: string;
  cliente: string;
  local: string;
  status_obra: string;
}

export function buildHtmlReport(
  rdoId: string,
  header: HeaderData,
  tipoRdo: string,
  producaoCauq: ProducaoCauqData,
  nfMassa: NotaFiscalMassaEntry[],
  efetivo: EfetivoEntry[],
  equipamentos: EquipamentoEntry[],
  basculantes: BasculanteEntry[],
  globalEntrada: string,
  globalSaida: string,
): string {
  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  let html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#333}
h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:8px}
h2{color:#374151;margin-top:24px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left;font-size:14px}
th{background:#f3f4f6;font-weight:600}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}
.section{margin-bottom:20px}
</style></head><body>
<h1>📋 RDO - Relatório Diário de Obra</h1>
<div class="section">
<table>
<tr><th>Data</th><td>${formatDate(header.data)}</td><th>OGS</th><td>${header.obra_nome}</td></tr>
<tr><th>Cliente</th><td>${header.cliente}</td><th>Local</th><td>${header.local}</td></tr>
<tr><th>Status</th><td>${header.status_obra}</td><th>Tipo</th><td>${tipoRdo}</td></tr>
</table>
</div>`;

  // Efetivo
  const filledEfetivo = efetivo.filter(e => e.nome);
  if (filledEfetivo.length > 0) {
    html += `<h2>👷 Efetivo (${filledEfetivo.length})</h2>
<p>Horário: ${globalEntrada || "--:--"} às ${globalSaida || "--:--"}</p>
<table><tr><th>#</th><th>Nome</th><th>Função</th></tr>`;
    filledEfetivo.forEach((e, i) => {
      html += `<tr><td>${i + 1}</td><td>${e.nome}</td><td>${e.funcao}</td></tr>`;
    });
    html += `</table>`;
  }

  // Equipamentos
  const filledEquip = equipamentos.filter(e => e.frota || e.categoria);
  if (filledEquip.length > 0) {
    html += `<h2>🚜 Equipamentos (${filledEquip.length})</h2>
<table><tr><th>FROTA</th><th>EQUIPAMENTO</th><th>MODELO/PLACA</th><th>EMPRESA</th></tr>`;
    filledEquip.forEach(e => {
      html += `<tr><td>${e.frota}</td><td>${e.tipo || e.categoria}</td><td>${e.nome || e.patrimonio || ""}</td><td>${e.empresa_dona}</td></tr>`;
    });
    html += `</table>`;
  }

  // Basculantes
  const filledBasc = basculantes.filter(b => b.placa);
  if (filledBasc.length > 0) {
    html += `<h2>🚛 Basculantes (${filledBasc.length})</h2>
<table><tr><th>Placa</th><th>Material</th><th>Viagens</th><th>Empresa</th></tr>`;
    filledBasc.forEach(b => {
      html += `<tr><td>${b.placa}</td><td>${b.material}</td><td>${b.viagens}</td><td>${b.empresa_dona}</td></tr>`;
    });
    html += `</table>`;
  }

  // Produção CAUQ
  if (tipoRdo === "CAUQ" && producaoCauq.trechos.length > 0) {
    const trechos = producaoCauq.trechos.filter(t => t.tipo_servico || t.comprimento_m);
    if (trechos.length > 0) {
      html += `<h2>📐 Produção do Dia (CAUQ)</h2>
<table><tr><th>Serviço</th><th>Sentido/Faixa</th><th>Est. Inicial</th><th>Est. Final</th><th>Comp.(m)</th><th>Larg.(m)</th><th>Área(m²)</th><th>Esp.(m)</th><th>Ton</th></tr>`;
      let totalArea = 0;
      let totalTon = 0;
      trechos.forEach(t => {
        const c = parseFloat(t.comprimento_m) || 0;
        const l = parseFloat(t.largura_m) || 0;
        const area = c * l;
        totalArea += area;
        totalTon += parseFloat(t.total_toneladas) || 0;
        html += `<tr><td>${t.tipo_servico}</td><td>${t.sentido_faixa}</td><td>${t.estaca_inicial}</td><td>${t.estaca_final}</td><td>${t.comprimento_m}</td><td>${t.largura_m}</td><td>${area.toFixed(2)}</td><td>${t.espessura_m}</td><td>${t.total_toneladas}</td></tr>`;
      });
      html += `<tr style="font-weight:bold;background:#e5edff"><td colspan="6">TOTAL</td><td>${totalArea.toFixed(2)}</td><td></td><td>${totalTon.toFixed(2)}</td></tr></table>`;

      trechos.forEach(t => {
        if (t.observacoes) {
          html += `<p>📝 <strong>Obs (${t.tipo_servico}):</strong> ${t.observacoes}</p>`;
        }
      });
    }

    // NFs
    const filledNf = nfMassa.filter(n => n.nf || n.tonelagem);
    if (filledNf.length > 0) {
      html += `<h2>📄 Notas Fiscais de Massa</h2>
<table><tr><th>NF</th><th>Placa</th><th>Usina</th><th>Tonelagem</th><th>Material</th></tr>`;
      filledNf.forEach(n => {
        html += `<tr><td>${n.nf}</td><td>${n.placa}</td><td>${n.usina}</td><td>${n.tonelagem}</td><td>${n.tipo_material === "Outro" ? n.tipo_material_outro : n.tipo_material}</td></tr>`;
      });
      const totalNf = filledNf.reduce((s, n) => s + (parseFloat(n.tonelagem) || 0), 0);
      html += `<tr style="font-weight:bold;background:#e5edff"><td colspan="3">TOTAL</td><td>${totalNf.toFixed(2)}</td><td></td></tr></table>`;
    }
  }

  html += `<hr><p style="color:#9ca3af;font-size:12px;margin-top:20px">Relatório gerado automaticamente pelo RDO Digital - Fremix</p></body></html>`;
  return html;
}
