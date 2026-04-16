import type { ProducaoCauqData } from "@/components/rdo/SectionProducaoCauq";
import type { NotaFiscalMassaEntry } from "@/components/rdo/SectionCauq";
import type { EfetivoEntry } from "@/components/rdo/StepEfetivo";
import type { EquipamentoEntry } from "@/components/rdo/SectionEquipamentos";
import type { PVData } from "@/components/rdo/SectionPV";


interface HeaderData {
  data: string;
  obra_nome: string;
  cliente: string;
  local: string;
  status_obra: string;
}

const fmtBR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CanteiroReportData {
  teveUsinagem: boolean;
  totalUsinado: string;
  atividadesCanteiro: string;
}

export function buildHtmlReport(
  rdoId: string,
  header: HeaderData,
  tipoRdo: string,
  producaoCauq: ProducaoCauqData,
  nfMassa: NotaFiscalMassaEntry[],
  efetivo: EfetivoEntry[],
  equipamentos: EquipamentoEntry[],
  globalEntrada: string,
  globalSaida: string,
  canteiroData?: CanteiroReportData,
  responsavel?: string,
  pvData?: PVData,
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
<tr><th>Responsável</th><td colspan="3">${responsavel || "—"}</td></tr>
</table>
</div>`;

  // Efetivo — expand multi-select names (joined by |||) into individual rows
  const expandedEfetivo: { nome: string; funcao: string }[] = [];
  efetivo.forEach(e => {
    if (!e.nome) return;
    const names = e.nome.split("|||").filter(Boolean);
    names.forEach(name => {
      expandedEfetivo.push({ nome: name.trim(), funcao: e.funcao });
    });
  });
  if (expandedEfetivo.length > 0) {
    html += `<h2>👷 Efetivo (${expandedEfetivo.length})</h2>
<p>Horário: ${globalEntrada || "--:--"} às ${globalSaida || "--:--"}</p>
<table><tr><th>#</th><th>Nome</th><th>Função</th></tr>`;
    expandedEfetivo.forEach((e, i) => {
      html += `<tr><td>${i + 1}</td><td>${e.nome}</td><td>${e.funcao}</td></tr>`;
    });
    html += `</table>`;
  }

  // Equipamentos
  const filledEquip = equipamentos.filter(e => e.frota || e.categoria);
  if (filledEquip.length > 0) {
    html += `<h2>🚜 Equipamentos (${filledEquip.length})</h2>
<table><tr><th style="text-align:center">FROTA</th><th>EQUIPAMENTO</th><th>MODELO/PLACA</th><th>ACESSÓRIO</th><th>EMPRESA</th></tr>`;
    filledEquip.forEach(e => {
      const modeloParts = [e.nome, e.patrimonio].filter(Boolean);
      const modeloPlaca = modeloParts.length > 1 ? modeloParts.join(" / ") : modeloParts[0] || "";
      const acessorio = e.fresadora_conica ? `FC: ${e.fresadora_conica}` : "";
      html += `<tr><td style="text-align:center;font-weight:600">${e.frota}</td><td>${e.tipo || e.categoria}</td><td>${modeloPlaca}</td><td>${acessorio}</td><td>${e.empresa_dona}</td></tr>`;
    });
    html += `</table>`;
  }


  // Notas Fiscais de Massa (before Produção)
  if (tipoRdo === "CAUQ") {
    const filledNf = nfMassa.filter(n => n.nf || n.tonelagem);
    if (filledNf.length > 0) {
      html += `<h2>📄 Notas Fiscais de Massa</h2>
<table><tr><th>NF</th><th>Placa</th><th>Usina</th><th>Tonelagem</th><th>Material</th></tr>`;
      filledNf.forEach(n => {
        const ton = parseFloat(n.tonelagem) || 0;
        html += `<tr><td>${n.nf}</td><td>${n.placa}</td><td>${n.usina}</td><td>${fmtBR(ton)}</td><td>${n.tipo_material === "Outro" ? n.tipo_material_outro : n.tipo_material}</td></tr>`;
      });
      const totalNf = filledNf.reduce((s, n) => s + (parseFloat(n.tonelagem) || 0), 0);
      html += `<tr style="font-weight:bold;background:#e5edff"><td colspan="3">TOTAL</td><td>${fmtBR(totalNf)}</td><td></td></tr></table>`;
    }
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
        const ton = parseFloat(t.total_toneladas) || 0;
        totalTon += ton;
        const espM = t.espessura_m ? (parseFloat(t.espessura_m) / 100) : 0;
        html += `<tr><td>${t.tipo_servico}</td><td>${t.sentido_faixa}</td><td>${t.estaca_inicial}</td><td>${t.estaca_final}</td><td>${fmtBR(c)}</td><td>${fmtBR(l)}</td><td>${fmtBR(area)}</td><td>${espM ? fmtBR(espM) : ""}</td><td>${fmtBR(ton)}</td></tr>`;
      });
      html += `<tr style="font-weight:bold;background:#e5edff"><td colspan="6">TOTAL</td><td>${fmtBR(totalArea)}</td><td></td><td>${fmtBR(totalTon)}</td></tr></table>`;

      trechos.forEach(t => {
        if (t.observacoes) {
          html += `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0">
<strong>📝 Observações do Trecho (${t.tipo_servico}):</strong><br>
<span style="white-space:pre-wrap">${t.observacoes}</span>
</div>`;
        }
      });
    }
  }

  // Atividades de Canteiro
  if (canteiroData) {
    if (canteiroData.teveUsinagem) {
      html += `<h2>🏭 Produção da Usina</h2>
<div style="background:#e5edff;padding:12px 16px;border-radius:8px;font-size:16px;font-weight:bold">
🔥 Produção da Usina: ${fmtBR(parseFloat(canteiroData.totalUsinado) || 0)} Toneladas
</div>`;
    } else if (canteiroData.atividadesCanteiro) {
      html += `<h2>🏗️ Atividades do Canteiro</h2>
<div style="background:#f3f4f6;padding:12px 16px;border-radius:8px;white-space:pre-wrap">
${canteiroData.atividadesCanteiro}
</div>`;
    }
  }

  // PV (Poço de Visita) report
  if (tipoRdo === "PV" && pvData) {
    html += `<h2>🕳️ Poço de Visita</h2>
<table>
<tr><th>Cliente</th><td>${header.cliente || pvData.cliente}</td><th>Contrato</th><td>${header.obra_nome || pvData.contrato}</td></tr>
<tr><th>Rua</th><td>${pvData.rua}</td><th>Bairro</th><td>${pvData.bairro}</td></tr>
<tr><th>Cidade</th><td>${pvData.cidade}</td><th>Modo</th><td>${pvData.modo_execucao === "mecanizado" ? "Mecanizado" : "Manual"}</td></tr>`;
    // Equipment details now come from the general Equipamentos section
    html += `<tr><th>PVs Executados</th><td colspan="3" style="font-size:18px;font-weight:bold">${pvData.qtd_pvs || "0"}</td></tr>
</table>`;

    const filledMats = pvData.materiais.filter(m => m.material && m.quantidade);
    if (filledMats.length > 0) {
      html += `<h2>📦 Materiais Consumidos</h2>
<table><tr><th>Material</th><th>Quantidade</th><th>Unidade</th></tr>`;
      filledMats.forEach(m => {
        html += `<tr><td>${m.material}</td><td>${m.quantidade}</td><td>${m.unidade}</td></tr>`;
      });
      html += `</table>`;
    }

    if (pvData.observacoes) {
      html += `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0">
<strong>📝 Observações:</strong><br><span style="white-space:pre-wrap">${pvData.observacoes}</span></div>`;
    }
  }

  html += `<hr><p style="color:#9ca3af;font-size:12px;margin-top:20px">Relatório gerado automaticamente pelo Workflux</p></body></html>`;
  return html;
}
