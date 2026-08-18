import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSmartBack } from "@/hooks/useSmartBack";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, FileDown, FileSpreadsheet, Printer, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoHomeButton } from "@/components/LogoHomeButton";
import { fmtNum, fmtNumCsv, toNum as toNumLib } from "@/lib/fmt";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCanDelete } from "@/hooks/useCanDelete";
import { useCanExport } from "@/hooks/useCanExport";
import { toast } from "@/hooks/use-toast";
import { registrarAuditoria } from "@/lib/audit";
import { useNavigationTrail } from "@/hooks/useNavigationTrail";
import { NavigationTrail } from "@/components/navigation/NavigationTrail";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";

interface RdoItem {
  id: string;
  data: string | null;
  tipo_rdo: string | null;
  responsavel: string | null;     // legado
  encarregado: string | null;     // encarregado da obra
  preenchido_por: string | null;  // apontador/usuário logado
  turno: string | null;
  clima: string | null;
  observacoes_gerais?: string | null;
}

interface EfetivoItem {
  id: string;
  rdo_id: string | null;
  nome: string | null;
  funcao: string | null;
  matricula: string | null;
  entrada: string | null;
  saida: string | null;
}

interface ProducaoItem {
  id: string;
  rdo_id: string | null;
  tipo_servico: string | null;
  sentido_faixa: string | null;
  sentido: string | null;
  faixa: string | null;
  estaca_inicial: string | null;
  estaca_final: string | null;
  km_inicial: string | null;
  km_final: string | null;
  comprimento_m: string | null;
  largura_m: string | null;
  espessura_cm: string | null;
  area_m2: string | null;
  volume_m3: string | null;
  densidade: string | null;
  tonelagem: string | null;
  observacoes: string | null;
}

interface EquipamentoItem {
  id: string;
  rdo_id: string | null;
  frota: string | null;
  centro_custo?: string | null;
  marca?: string | null;
  modelo_completo?: string | null;
  serie?: string | null;
  chassi?: string | null;
  tipo_veiculo?: string | null;
  categoria: string | null;
  sub_tipo: string | null;
  tipo: string | null;
  nome: string | null;
  patrimonio: string | null;
  empresa_dona: string | null;
}

interface NfMassaItem {
  id: string;
  rdo_id: string | null;
  nf: string | null;
  placa: string | null;
  usina: string | null;
  tonelagem: number | null;
  tipo_material: string | null;
}

interface EfetivoTerceiroItem {
  rdo_id: string | null;
  empresa_nome: string | null;
  funcionario_nome: string | null;
}

type TerceirosPorRdo = Record<string, Record<string, string[]>>;

function fmtDate(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function expandEfetivo(ef: EfetivoItem): { nome: string; matricula: string }[] {
  const nomes = ef.nome ? ef.nome.split("|||").map(n => n.trim()).filter(Boolean) : [];
  const matriculas = ef.matricula ? ef.matricula.split("|||").map(m => m.trim()) : [];
  if (nomes.length === 0) return [];
  return nomes.map((nome, i) => ({ nome, matricula: matriculas[i] || "-" }));
}

// Mantém compat com código legado
function expandNomes(ef: EfetivoItem): string[] {
  return expandEfetivo(ef).map(e => e.nome);
}

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function dataRdoParaArquivo(data: string | null, fallbackIndex: number) {
  if (!data) return `sem_data_${fallbackIndex + 1}`;
  return data;
}

function labelFrotaEquip(e: EquipamentoItem) {
  return e.centro_custo || e.frota || "-";
}

function labelModeloEquip(e: EquipamentoItem) {
  return [e.marca || e.tipo_veiculo, e.modelo_completo || e.nome || e.patrimonio]
    .filter(Boolean)
    .join(" ") || e.nome || e.patrimonio || "-";
}

function montarPessoas(efetivo: EfetivoItem[]) {
  const pessoas: { nome: string; matricula: string; funcao: string; entrada: string; saida: string }[] = [];

  efetivo.forEach((ef) => {
    const expanded = expandEfetivo(ef);
    if (expanded.length > 0) {
      expanded.forEach((p) => {
        pessoas.push({
          nome: p.nome,
          matricula: p.matricula,
          funcao: ef.funcao || "-",
          entrada: ef.entrada || "-",
          saida: ef.saida || "-",
        });
      });
      return;
    }

    pessoas.push({
      nome: "-",
      matricula: "-",
      funcao: ef.funcao || "-",
      entrada: ef.entrada || "-",
      saida: ef.saida || "-",
    });
  });

  return pessoas;
}

function buildCsvRdo(
  ogs: string,
  rdo: RdoItem,
  efetivoByRdoId: Record<string, EfetivoItem[]>,
  terceirosByRdoId: TerceirosPorRdo,
  producaoByRdoId: Record<string, ProducaoItem[]>,
  equipByRdoId: Record<string, EquipamentoItem[]>,
  nfByRdoId: Record<string, NfMassaItem[]>,
  clienteNome: string,
) {
  const linhas: string[][] = [];
  linhas.push([`RDO — OGS ${ogs} — ${fmtDate(rdo.data)}`]);
  linhas.push([`Cliente: ${clienteNome || "-"}`, "", `Responsável: ${rdo.responsavel || "-"}`]);
  linhas.push([`Tipo: ${rdo.tipo_rdo || "-"}`, `Turno: ${rdo.turno || "-"}`, `Clima: ${rdo.clima || "-"}`]);
  linhas.push([]);

  const efetivo = efetivoByRdoId[rdo.id] || [];
  const pessoas = montarPessoas(efetivo);
  if (pessoas.length > 0) {
    linhas.push([`EFETIVO (${pessoas.length})`]);
    linhas.push(["#", "Nome", "Matrícula", "Função", "Entrada", "Saída"]);
    pessoas.forEach((p, i) => linhas.push([String(i + 1), p.nome, p.matricula, p.funcao, p.entrada, p.saida]));
    linhas.push([]);
  }

  const terceiros = terceirosByRdoId[rdo.id] || {};
  const empresasTerceiras = Object.entries(terceiros);
  if (empresasTerceiras.length > 0) {
    const totalTerceiros = empresasTerceiras.reduce((sum, [, nomes]) => sum + nomes.length, 0);
    linhas.push([`EFETIVO TERCEIRIZADO (${totalTerceiros})`]);
    linhas.push(["#", "Empresa", "Funcionário"]);
    let idxTerceiro = 1;
    empresasTerceiras.forEach(([empresa, nomes]) => {
      nomes.forEach((nome) => {
        linhas.push([String(idxTerceiro++), empresa || "-", nome || "-"]);
      });
    });
    linhas.push([]);
  }

  if ((rdo.observacoes_gerais || "").trim()) {
    linhas.push(["OBSERVAÇÕES GERAIS"]);
    linhas.push([rdo.observacoes_gerais || "-"]);
    linhas.push([]);
  }

  const equipamentos = equipByRdoId[rdo.id] || [];
  if (equipamentos.length > 0) {
    linhas.push([`EQUIPAMENTOS (${equipamentos.length})`]);
    linhas.push(["Frota/CC", "Equipamento", "Modelo", "Empresa"]);
    equipamentos.forEach((e) => linhas.push([labelFrotaEquip(e), e.sub_tipo || e.tipo || e.categoria || "-", labelModeloEquip(e), e.empresa_dona || "-"]));
    linhas.push([]);
  }

  const nfMassa = nfByRdoId[rdo.id] || [];
  if (nfMassa.length > 0) {
    const totalTon = nfMassa.reduce((s, n) => s + (n.tonelagem || 0), 0);
    linhas.push(["NOTAS FISCAIS DE MASSA"]);
    linhas.push(["NF", "Placa", "Usina/Fornecedor", "Tonelagem", "Material"]);
    nfMassa.forEach((n) => linhas.push([n.nf || "-", n.placa || "-", n.usina || "-", n.tonelagem != null ? String(n.tonelagem) : "-", n.tipo_material || "-"]));
    linhas.push(["TOTAL", "", "", fmtNumCsv(totalTon, 2), ""]);
    linhas.push([]);
  }

  const producao = producaoByRdoId[rdo.id] || [];
  if (producao.length > 0) {
    const totalArea = producao.reduce((s, p) => s + (parseFloat(String(p.area_m2 || 0)) || 0), 0);
    const totalTon = producao.reduce((s, p) => s + (parseFloat(String(p.tonelagem || 0)) || 0), 0);
    linhas.push(["PRODUÇÃO DO DIA"]);
    linhas.push(["Serviço", "Sentido/Faixa", "Est. Ini", "Est. Fim", "Comp (m)", "Larg (m)", "Área (m²)", "Esp (m)", "Ton"]);
    producao.forEach((p) => linhas.push([
      p.tipo_servico || "-",
      p.sentido_faixa || p.sentido || "-",
      p.estaca_inicial || p.km_inicial || "-",
      p.estaca_final || p.km_final || "-",
      String(p.comprimento_m || "-"),
      String(p.largura_m || "-"),
      p.area_m2 ? fmtNumCsv(toNumLib(p.area_m2), 2) : "-",
      String(p.espessura_cm || "-"),
      p.tonelagem != null ? fmtNumCsv(toNumLib(p.tonelagem), 2) : "-",
    ]));
    linhas.push(["TOTAL", "", "", "", "", "", fmtNumCsv(totalArea, 2), "", fmtNumCsv(totalTon, 2)]);
    linhas.push([]);
  }

  return "\uFEFF" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}

function gerarPdfRdoBlob(
  ogs: string,
  rdo: RdoItem,
  efetivoByRdoId: Record<string, EfetivoItem[]>,
  terceirosByRdoId: TerceirosPorRdo,
  producaoByRdoId: Record<string, ProducaoItem[]>,
  clienteNome: string,
  equipByRdoId: Record<string, EquipamentoItem[]>,
  nfByRdoId: Record<string, NfMassaItem[]>,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const efetivo = efetivoByRdoId[rdo.id] || [];
  const pessoas = montarPessoas(efetivo);
  const producao = producaoByRdoId[rdo.id] || [];
  const equipamentos = equipByRdoId[rdo.id] || [];
  const nfMassa = nfByRdoId[rdo.id] || [];

  const encRdo = (rdo as any).encarregado || rdo.responsavel || "-";
  const preenchidoRdo = (rdo as any).preenchido_por || "-";

  let y = 14;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 86, 219);
  doc.text("RDO - Relatório Diário de Obra", 14, y);

  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text(`Data: ${fmtDate(rdo.data)}   |   OGS: ${ogs}`, 14, y);
  y += 4.5;
  doc.text(`Cliente: ${clienteNome || "-"}`, 14, y);
  y += 4.5;
  doc.text(`Tipo: ${rdo.tipo_rdo || "-"}   |   Turno: ${rdo.turno || "-"}   |   Clima: ${rdo.clima || "-"}`, 14, y);
  y += 4.5;
  doc.text(`Encarregado: ${encRdo}`, 14, y);
  y += 4.5;
  doc.text(`Preenchido por: ${preenchidoRdo}`, 14, y);
  y += 6;

  if (pessoas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Nome", "Matrícula", "Função", "Entrada", "Saída"]],
      body: pessoas.map((p, i) => [String(i + 1), p.nome, p.matricula, p.funcao, p.entrada, p.saida]),
      theme: "grid",
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [26, 86, 219], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 5;
  }

  const terceiros = terceirosByRdoId[rdo.id] || {};
  const empresasTerceiras = Object.entries(terceiros);
  if (empresasTerceiras.length > 0) {
    const totalTerceiros = empresasTerceiras.reduce((sum, [, nomes]) => sum + nomes.length, 0);
    let idxTerceiro = 1;
    const linhasTerceiros = empresasTerceiras.flatMap(([empresa, nomes]) =>
      nomes.map((nome) => [
        String(idxTerceiro++),
        empresa || "-",
        nome || "-",
      ]),
    );
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(146, 64, 14);
    doc.text(`Efetivo Terceirizado (${totalTerceiros})`, 14, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["#", "Empresa", "Funcionário"]],
      body: linhasTerceiros,
      theme: "grid",
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 5;
  }

  if ((rdo.observacoes_gerais || "").trim()) {
    autoTable(doc, {
      startY: y,
      head: [["Observações Gerais"]],
      body: [[rdo.observacoes_gerais || "-"]],
      theme: "grid",
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: pageW - 28 } },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 5;
  }

  if (equipamentos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Frota/CC", "Equipamento", "Modelo", "Empresa"]],
      body: equipamentos.map((e) => [labelFrotaEquip(e), e.sub_tipo || e.tipo || e.categoria || "-", labelModeloEquip(e), e.empresa_dona || "-"]),
      theme: "grid",
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 5;
  }

  if (nfMassa.length > 0) {
    const totalTon = nfMassa.reduce((s, n) => s + (n.tonelagem || 0), 0);
    autoTable(doc, {
      startY: y,
      head: [["NF", "Placa", "Usina/Fornecedor", "Tonelagem", "Material"]],
      body: [
        ...nfMassa.map((n) => [n.nf || "-", n.placa || "-", n.usina || "-", n.tonelagem != null ? fmtNum(n.tonelagem, 2) : "-", n.tipo_material || "-"]),
        ["TOTAL", "", "", fmtNum(totalTon, 2), ""],
      ],
      theme: "grid",
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === nfMassa.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [243, 244, 246];
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 5;
  }

  if (producao.length > 0) {
    const totalArea = producao.reduce((s, p) => s + (parseFloat(String(p.area_m2 || 0)) || 0), 0);
    const totalTonProd = producao.reduce((s, p) => s + (parseFloat(String(p.tonelagem || 0)) || 0), 0);

    autoTable(doc, {
      startY: y,
      head: [["Serviço", "Sentido/Faixa", "Est.Ini", "Est.Fim", "Comp", "Larg", "Área", "Esp(cm)", "Vol(m³)", "Dens.", "Ton"]],
      body: [
        ...producao.map((p) => [
          p.tipo_servico || "-",
          p.sentido_faixa || p.sentido || "-",
          p.estaca_inicial || p.km_inicial || "-",
          p.estaca_final || p.km_final || "-",
          p.comprimento_m || "-",
          p.largura_m || "-",
          p.area_m2 ? fmtNum(toNumLib(p.area_m2), 2) : "-",
          p.espessura_cm || "-",
          p.volume_m3 ? fmtNum(toNumLib(p.volume_m3), 2) : "-",
          p.densidade ? fmtNum(toNumLib(p.densidade), 2) : "-",
          p.tonelagem != null ? fmtNum(toNumLib(p.tonelagem), 2) : "-",
        ]),
        ["TOTAL", "", "", "", "", "", fmtNum(totalArea, 2), "", "", "", fmtNum(totalTonProd, 2)],
      ],
      theme: "grid",
      margin: { left: 10, right: 10 },
      headStyles: { fillColor: [17, 94, 89], textColor: [255, 255, 255], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 1.6 },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === producao.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [236, 253, 245];
        }
      },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i}/${pageCount}`, pageW - 14, 290, { align: "right" });
  }

  return doc.output("blob");
}

// Exportar Excel (CSV com BOM UTF-8)
function exportarExcel(
  ogs: string,
  rdoList: RdoItem[],
  efetivoByRdoId: Record<string, EfetivoItem[]>,
  terceirosByRdoId: TerceirosPorRdo,
  producaoByRdoId: Record<string, ProducaoItem[]>,
  equipByRdoId: Record<string, EquipamentoItem[]>,
  nfByRdoId: Record<string, NfMassaItem[]>,
  clienteNome: string,
) {
  const linhas: string[][] = [];

  rdoList.forEach(rdo => {
    // Cabeçalho
    linhas.push([`RDO — OGS ${ogs} — ${fmtDate(rdo.data)}`]);
    linhas.push([`Cliente: ${clienteNome || "-"}`, "", `Responsável: ${rdo.responsavel || "-"}`]);
    linhas.push([`Tipo: ${rdo.tipo_rdo || "-"}`, `Turno: ${rdo.turno || "-"}`, `Clima: ${rdo.clima || "-"}`]);
    linhas.push([]);

    // Efetivo — expandindo nome e matrícula separados por |||
    const efetivo = efetivoByRdoId[rdo.id] || [];
    const pessoas: { nome: string; matricula: string; funcao: string; entrada: string; saida: string }[] = [];
    efetivo.forEach(ef => {
      const expanded = expandEfetivo(ef);
      if (expanded.length > 0) {
        expanded.forEach(p => pessoas.push({ nome: p.nome, matricula: p.matricula, funcao: ef.funcao || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" }));
      } else {
        pessoas.push({ nome: "-", matricula: "-", funcao: ef.funcao || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" });
      }
    });
    if (pessoas.length > 0) {
      linhas.push([`EFETIVO (${pessoas.length})`]);
      linhas.push(["#", "Nome", "Matrícula", "Função", "Entrada", "Saída"]);
      pessoas.forEach((p, i) => linhas.push([String(i + 1), p.nome, p.matricula, p.funcao, p.entrada, p.saida]));
      linhas.push([]);
    }

    const terceiros = terceirosByRdoId[rdo.id] || {};
    const empresasTerceiras = Object.entries(terceiros);
    if (empresasTerceiras.length > 0) {
      const totalTerceiros = empresasTerceiras.reduce((sum, [, nomes]) => sum + nomes.length, 0);
      linhas.push([`EFETIVO TERCEIRIZADO (${totalTerceiros})`]);
      linhas.push(["#", "Empresa", "Funcionário"]);
      let idxTerceiro = 1;
      empresasTerceiras.forEach(([empresa, nomes]) => {
        nomes.forEach((nome) => linhas.push([String(idxTerceiro++), empresa || "-", nome || "-"]));
      });
      linhas.push([]);
    }

    if ((rdo.observacoes_gerais || "").trim()) {
      linhas.push(["OBSERVAÇÕES GERAIS"]);
      linhas.push([rdo.observacoes_gerais || "-"]);
      linhas.push([]);
    }

    // Equipamentos
    const equipamentos = equipByRdoId[rdo.id] || [];
    if (equipamentos.length > 0) {
      linhas.push([`EQUIPAMENTOS (${equipamentos.length})`]);
      linhas.push(["Frota/CC", "Equipamento", "Modelo", "Empresa"]);
      equipamentos.forEach(e => linhas.push([labelFrotaEquip(e), e.sub_tipo || e.tipo || e.categoria || "-", labelModeloEquip(e), e.empresa_dona || "-"]));
      linhas.push([]);
    }

    // NF de Massa
    const nfMassa = nfByRdoId[rdo.id] || [];
    if (nfMassa.length > 0) {
      const totalTon = nfMassa.reduce((s, n) => s + (n.tonelagem || 0), 0);
      linhas.push(["NOTAS FISCAIS DE MASSA"]);
      linhas.push(["NF", "Placa", "Usina/Fornecedor", "Tonelagem", "Material"]);
      nfMassa.forEach(n => linhas.push([n.nf || "-", n.placa || "-", n.usina || "-", n.tonelagem != null ? String(n.tonelagem) : "-", n.tipo_material || "-"]));
      linhas.push(["TOTAL", "", "", fmtNumCsv(totalTon, 2), ""]);
      linhas.push([]);
    }

    // Produção
    const producao = producaoByRdoId[rdo.id] || [];
    if (producao.length > 0) {
      const totalArea = producao.reduce((s, p) => s + (parseFloat(String(p.area_m2 || 0)) || 0), 0);
      const totalTon = producao.reduce((s, p) => s + (parseFloat(String(p.tonelagem || 0)) || 0), 0);
      linhas.push(["PRODUÇÃO DO DIA"]);
      linhas.push(["Serviço", "Sentido/Faixa", "Est. Ini", "Est. Fim", "Comp (m)", "Larg (m)", "Área (m²)", "Esp (m)", "Ton"]);
      producao.forEach(p => linhas.push([
        p.tipo_servico || "-",
        p.sentido_faixa || p.sentido || "-",
        p.estaca_inicial || p.km_inicial || "-",
        p.estaca_final || p.km_final || "-",
        String(p.comprimento_m || "-"),
        String(p.largura_m || "-"),
        p.area_m2 ? fmtNumCsv(toNumLib(p.area_m2), 2) : "-",
        String(p.espessura_cm || "-"),
        p.tonelagem != null ? fmtNumCsv(toNumLib(p.tonelagem), 2) : "-",
      ]));
      linhas.push(["TOTAL", "", "", "", "", "", fmtNumCsv(totalArea, 2), "", fmtNumCsv(totalTon, 2)]);
      linhas.push([]);
    }

    linhas.push(["---"]);
    linhas.push([]);
  });

  const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_RDO_OGS${ogs}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarExcelSeparadoZip(
  ogs: string,
  rdoList: RdoItem[],
  efetivoByRdoId: Record<string, EfetivoItem[]>,
  terceirosByRdoId: TerceirosPorRdo,
  producaoByRdoId: Record<string, ProducaoItem[]>,
  equipByRdoId: Record<string, EquipamentoItem[]>,
  nfByRdoId: Record<string, NfMassaItem[]>,
  clienteNome: string,
) {
  const zip = new JSZip();

  rdoList.forEach((rdo, idx) => {
    const csv = buildCsvRdo(ogs, rdo, efetivoByRdoId, terceirosByRdoId, producaoByRdoId, equipByRdoId, nfByRdoId, clienteNome);
    const encarregado = sanitizeFilename((rdo as any).encarregado || rdo.responsavel || "sem_encarregado");
    const data = dataRdoParaArquivo(rdo.data, idx);
    zip.file(`RDO_${sanitizeFilename(ogs)}_${data}_${encarregado}.csv`, csv);
  });

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_RDO_OGS${sanitizeFilename(ogs)}_SEPARADOS_CSV.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarPdfSeparadoZip(
  ogs: string,
  rdoList: RdoItem[],
  efetivoByRdoId: Record<string, EfetivoItem[]>,
  terceirosByRdoId: TerceirosPorRdo,
  producaoByRdoId: Record<string, ProducaoItem[]>,
  clienteNome: string,
  equipByRdoId: Record<string, EquipamentoItem[]>,
  nfByRdoId: Record<string, NfMassaItem[]>,
) {
  const zip = new JSZip();

  for (let idx = 0; idx < rdoList.length; idx += 1) {
    const rdo = rdoList[idx];
    const pdfBlob = gerarPdfRdoBlob(ogs, rdo, efetivoByRdoId, terceirosByRdoId, producaoByRdoId, clienteNome, equipByRdoId, nfByRdoId);
    const encarregado = sanitizeFilename((rdo as any).encarregado || rdo.responsavel || "sem_encarregado");
    const data = dataRdoParaArquivo(rdo.data, idx);
    zip.file(`RDO_${sanitizeFilename(ogs)}_${data}_${encarregado}.pdf`, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WF_RDO_OGS${sanitizeFilename(ogs)}_SEPARADOS_PDF.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// Exportar PDF via print
function exportarPdf(
  ogs: string,
  rdoList: RdoItem[],
  efetivoByRdoId: Record<string, EfetivoItem[]>,
  terceirosByRdoId: TerceirosPorRdo,
  producaoByRdoId: Record<string, ProducaoItem[]>,
  clienteNome: string,
  equipByRdoId?: Record<string, EquipamentoItem[]>,
  nfByRdoId?: Record<string, NfMassaItem[]>,
) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>RDO OGS ${ogs}</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#333;font-size:13px}
    h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:8px;font-size:18px;margin-bottom:4px}
    h2{color:#374151;margin-top:20px;font-size:14px;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}
    th,td{border:1px solid #d1d5db;padding:5px 8px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    .header-table td{border:none;padding:3px 8px}
    .header-table th{border:none;padding:3px 8px;background:#f3f4f6}
    .page-break{page-break-after:always}
    @media print{body{padding:10px}.no-print{display:none}}
  </style></head><body>`;

  rdoList.forEach((rdo, idx) => {
    const efetivo = efetivoByRdoId[rdo.id] || [];
    const producao = producaoByRdoId[rdo.id] || [];
    const equipamentos = equipByRdoId?.[rdo.id] || [];
    const nfMassa = nfByRdoId?.[rdo.id] || [];

    // Expandir efetivo com matrícula correta
    const pessoas: { nome: string; matricula: string; funcao: string; entrada: string; saida: string }[] = [];
    efetivo.forEach(ef => {
      const expanded = expandEfetivo(ef);
      if (expanded.length > 0) {
        expanded.forEach(p => pessoas.push({ nome: p.nome, matricula: p.matricula, funcao: ef.funcao || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" }));
      } else {
        pessoas.push({ nome: "-", matricula: "-", funcao: ef.funcao || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" });
      }
    });

    const entradaGlobal = efetivo[0]?.entrada || "-";
    const saidaGlobal = efetivo[0]?.saida || "-";

    const encRdo = (rdo as any).encarregado || rdo.responsavel || "-";
    const preenchidoRdo = (rdo as any).preenchido_por || "-";
    html += `<h1>📋 RDO - Relatório Diário de Obra</h1>
    <table class="header-table">
      <tr><th>Data</th><td>${fmtDate(rdo.data)}</td><th>OGS</th><td>${ogs}</td></tr>
      <tr><th>Cliente</th><td colspan="3">${clienteNome}</td></tr>
      <tr><th>Status</th><td>${rdo.clima || "-"}</td><th>Tipo</th><td>${rdo.tipo_rdo || "-"}</td></tr>
      <tr><th>Encarregado</th><td>${encRdo}</td><th>Turno</th><td>${rdo.turno || "-"}</td></tr>
      <tr><th>Preenchido por</th><td colspan="3">${preenchidoRdo}</td></tr>
    </table>`;

    // Efetivo
    if (pessoas.length > 0) {
      html += `<h2>👷 Efetivo (${pessoas.length})</h2>
      <p style="font-size:12px;margin:4px 0">Horário: ${entradaGlobal} às ${saidaGlobal}</p>
      <table><tr><th>#</th><th>Nome</th><th>Matrícula</th><th>Função</th><th>Entrada</th><th>Saída</th></tr>`;
      pessoas.forEach((p, i) => {
        html += `<tr><td>${i + 1}</td><td>${p.nome}</td><td>${p.matricula}</td><td>${p.funcao}</td><td>${p.entrada}</td><td>${p.saida}</td></tr>`;
      });
      html += `</table>`;
    }

    const terceiros = terceirosByRdoId[rdo.id] || {};
    const empresasTerceiras = Object.entries(terceiros);
    if (empresasTerceiras.length > 0) {
      const totalTerceiros = empresasTerceiras.reduce((sum, [, nomes]) => sum + nomes.length, 0);
      html += `<h2>👷‍♂️ Efetivo Terceirizado (${totalTerceiros})</h2>
      <table><tr><th>#</th><th>Empresa</th><th>Funcionário</th></tr>`;
      let idxTerceiro = 1;
      empresasTerceiras.forEach(([empresa, nomes]) => {
        nomes.forEach((nome) => {
          html += `<tr><td>${idxTerceiro++}</td><td>${empresa || "-"}</td><td>${nome || "-"}</td></tr>`;
        });
      });
      html += `</table>`;
    }

    if ((rdo.observacoes_gerais || "").trim()) {
      html += `<h2>📝 Observações Gerais</h2>
      <div style="background:#f9fafb;border-left:4px solid #1d4ed8;padding:12px 16px;margin:8px 0 12px;border-radius:0 8px 8px 0;white-space:pre-wrap">${rdo.observacoes_gerais}</div>`;
    }

    // Equipamentos
    if (equipamentos.length > 0) {
      html += `<h3>Equipamentos (${equipamentos.length})</h3><table><tr><th>Frota/CC</th><th>Equipamento</th><th>Modelo</th><th>Empresa</th></tr>`;
      equipamentos.forEach(e => {
        html += `<tr><td>${labelFrotaEquip(e)}</td><td>${e.sub_tipo || e.tipo || e.categoria || "-"}</td><td>${labelModeloEquip(e)}</td><td>${e.empresa_dona || "-"}</td></tr>`;
      });
      html += `</table>`;
    }

    // NF de Massa
    if (nfMassa.length > 0) {
      const totalTon = nfMassa.reduce((s, n) => s + (n.tonelagem || 0), 0);
      html += `<h2>📄 Notas Fiscais de Massa</h2>
      <table><tr><th>NF</th><th>Placa</th><th>Usina/Fornecedor</th><th>Tonelagem</th><th>Material</th></tr>`;
      nfMassa.forEach(n => {
        html += `<tr><td>${n.nf || "-"}</td><td>${n.placa || "-"}</td><td>${n.usina || "-"}</td><td>${n.tonelagem != null ? fmtNum(n.tonelagem, 2) : "-"}</td><td>${n.tipo_material || "-"}</td></tr>`;
      });
      html += `<tr style="font-weight:bold;background:#f3f4f6"><td colspan="3">TOTAL</td><td>${fmtNum(totalTon, 2)}</td><td></td></tr></table>`;
    }

    // Produção
    if (producao.length > 0) {
      const totalArea = producao.reduce((s, p) => s + (parseFloat(String(p.area_m2 || 0)) || 0), 0);
      const totalTonProd = producao.reduce((s, p) => s + (parseFloat(String(p.tonelagem || 0)) || 0), 0);
      html += `<h2>🛣️ Produção do Dia</h2>
      <table><tr><th>Serviço</th><th>Sentido/Faixa</th><th>Est.Ini</th><th>Est.Fim</th><th>Comp(m)</th><th>Larg(m)</th><th>Área(m²)</th><th>Esp(cm)</th><th>Volume(m³)</th><th>Densidade</th><th>Ton</th></tr>`;
      producao.forEach(p => {
        html += `<tr><td>${p.tipo_servico || "-"}</td><td>${p.sentido_faixa || p.sentido || "-"}</td><td>${p.estaca_inicial || p.km_inicial || "-"}</td><td>${p.estaca_final || p.km_final || "-"}</td><td>${p.comprimento_m || "-"}</td><td>${p.largura_m || "-"}</td><td>${p.area_m2 ? fmtNum(toNumLib(p.area_m2), 2) : "-"}</td><td>${p.espessura_cm || "-"}</td><td>${p.volume_m3 ? fmtNum(toNumLib(p.volume_m3), 2) : "-"}</td><td>${p.densidade ? fmtNum(toNumLib(p.densidade), 2) : "-"}</td><td>${p.tonelagem != null ? fmtNum(toNumLib(p.tonelagem), 2) : "-"}</td></tr>`;
      });
      html += `<tr style="font-weight:bold;background:#f3f4f6"><td colspan="6">TOTAL</td><td>${fmtNum(totalArea, 2)}</td><td></td><td></td><td></td><td>${fmtNum(totalTonProd, 2)}</td></tr></table>`;
    }

    if (idx < rdoList.length - 1) html += `<div class="page-break"></div>`;
  });

  html += `</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

export default function RelatorioRdo() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/relatorios");
  const { ogs = "" } = useParams<{ ogs: string }>();
  const [searchParams] = useSearchParams();

  const ini = searchParams.get("ini") || "";
  const fim = searchParams.get("fim") || "";
  const breadcrumbLabel = ogs ? `RDO OGS ${ogs}` : "Relatório RDO";
  const { trail, goTo } = useNavigationTrail({ label: breadcrumbLabel });

  const { isAdmin } = useIsAdmin();
  const { canDelete } = useCanDelete();
  const { canExport, loading: loadingCanExport } = useCanExport();
  const [loading, setLoading] = useState(true);
  const [rdoList, setRdoList] = useState<RdoItem[]>([]);
  const [efetivoByRdoId, setEfetivoByRdoId] = useState<Record<string, EfetivoItem[]>>({});
  const [terceirosByRdoId, setTerceirosByRdoId] = useState<TerceirosPorRdo>({});
  const [producaoByRdoId, setProducaoByRdoId] = useState<Record<string, ProducaoItem[]>>({});
  const [equipByRdoId, setEquipByRdoId] = useState<Record<string, EquipamentoItem[]>>({});
  const [nfByRdoId, setNfByRdoId] = useState<Record<string, NfMassaItem[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [clienteNome, setClienteNome] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindo, setExcluindo] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      if (!ogs || !ini || !fim) {
        setRdoList([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      // Buscar nome do cliente
      const { data: ogsRef } = await (supabase as any)
        .from("ogs_reference")
        .select("client_name")
        .eq("ogs_number", ogs)
        .maybeSingle();
      setClienteNome(ogsRef?.client_name || "");

      // Buscar RDOs
      const { data: rdoData } = await (supabase as any)
        .from("rdo_diarios")
        .select("id,data,tipo_rdo,responsavel,encarregado,preenchido_por,turno,clima,observacoes_gerais")
        .eq("obra_nome", ogs)
        .gte("data", ini)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });

      const lista = (rdoData || []) as RdoItem[];
      setRdoList(lista);

      if (lista.length === 0) {
        setLoading(false);
        return;
      }

      const ids = lista.map(r => r.id);

      // Efetivo com nome e matricula
      const { data: efetivoRows } = await supabase
        .from("rdo_efetivo")
        .select("id,rdo_id,nome,funcao,matricula,entrada,saida")
        .in("rdo_id", ids)
        .order("funcao", { ascending: true });

      const efGrupo: Record<string, EfetivoItem[]> = {};
      (efetivoRows || []).forEach((item: any) => {
        if (!item.rdo_id) return;
        if (!efGrupo[item.rdo_id]) efGrupo[item.rdo_id] = [];
        efGrupo[item.rdo_id].push(item as EfetivoItem);
      });
      setEfetivoByRdoId(efGrupo);

      // Efetivo Terceirizado (agrupado por empresa)
      const { data: terceirosRows } = await (supabase as any)
        .from("rdo_efetivo_terceiros")
        .select("rdo_id,empresa_nome,funcionario_nome")
        .in("rdo_id", ids);
      const tercGrupo: TerceirosPorRdo = {};
      (terceirosRows || []).forEach((item: EfetivoTerceiroItem) => {
        if (!item.rdo_id || !item.empresa_nome || !item.funcionario_nome) return;
        if (!tercGrupo[item.rdo_id]) tercGrupo[item.rdo_id] = {};
        if (!tercGrupo[item.rdo_id][item.empresa_nome]) tercGrupo[item.rdo_id][item.empresa_nome] = [];
        tercGrupo[item.rdo_id][item.empresa_nome].push(item.funcionario_nome);
      });
      setTerceirosByRdoId(tercGrupo);

      // Produção
      const { data: prodRows } = await (supabase as any)
        .from("rdo_producao")
        .select("id,rdo_id,tipo_servico,sentido_faixa,sentido,faixa,estaca_inicial,estaca_final,km_inicial,km_final,comprimento_m,largura_m,espessura_cm,area_m2,volume_m3,densidade,tonelagem,observacoes")
        .in("rdo_id", ids);
      const prodGrupo: Record<string, ProducaoItem[]> = {};
      (prodRows || []).forEach((item: any) => {
        if (!item.rdo_id) return;
        if (!prodGrupo[item.rdo_id]) prodGrupo[item.rdo_id] = [];
        prodGrupo[item.rdo_id].push(item as ProducaoItem);
      });
      setProducaoByRdoId(prodGrupo);

      // Equipamentos
      const { data: equipRows } = await (supabase as any)
        .from("rdo_equipamentos")
        .select("id,rdo_id,frota,categoria,sub_tipo,tipo,nome,patrimonio,empresa_dona")
        .in("rdo_id", ids)
        .order("frota", { ascending: true });

      // Enriquecer empresa_dona: buscar empresa_proprietaria da tabela equipamentos para frotas sem empresa salva
      const frotasSemEmpresa = [...new Set((equipRows || []).filter((e: any) => !e.empresa_dona && e.frota).map((e: any) => e.frota))];
      let empresaMap: Record<string, {
        empresa_proprietaria?: string | null;
        centro_custo?: string | null;
        marca?: string | null;
        modelo_completo?: string | null;
        serie?: string | null;
        chassi?: string | null;
        tipo_veiculo?: string | null;
      }> = {};
      if (frotasSemEmpresa.length > 0) {
        const { data: eqData } = await (supabase as any)
          .from("equipamentos")
          .select("frota,empresa_proprietaria,centro_custo,marca,modelo_completo,serie,chassi,tipo_veiculo")
          .in("frota", frotasSemEmpresa);
        (eqData || []).forEach((eq: any) => {
          if (!eq.frota) return;
          empresaMap[eq.frota] = {
            empresa_proprietaria: eq.empresa_proprietaria || null,
            centro_custo: eq.centro_custo || null,
            marca: eq.marca || null,
            modelo_completo: eq.modelo_completo || null,
            serie: eq.serie || null,
            chassi: eq.chassi || null,
            tipo_veiculo: eq.tipo_veiculo || null,
          };
        });
      }

      const equipGrupo: Record<string, EquipamentoItem[]> = {};
      (equipRows || []).forEach((item: any) => {
        if (!item.rdo_id) return;
        if (!equipGrupo[item.rdo_id]) equipGrupo[item.rdo_id] = [];
        const ref = item.frota ? empresaMap[item.frota] : null;
        const enriched = {
          ...item,
          empresa_dona: item.empresa_dona || ref?.empresa_proprietaria || "",
          centro_custo: ref?.centro_custo || null,
          marca: ref?.marca || ref?.tipo_veiculo || null,
          modelo_completo: ref?.modelo_completo || null,
          serie: ref?.serie || ref?.chassi || null,
          chassi: ref?.chassi || null,
          tipo_veiculo: ref?.tipo_veiculo || null,
        };
        equipGrupo[item.rdo_id].push(enriched as EquipamentoItem);
      });
      setEquipByRdoId(equipGrupo);

      // NF de Massa
      const { data: nfRows } = await (supabase as any)
        .from("rdo_nf_massa")
        .select("id,rdo_id,nf,placa,usina,tonelagem,tipo_material")
        .in("rdo_id", ids)
        .order("nf", { ascending: true });
      const nfGrupo: Record<string, NfMassaItem[]> = {};
      (nfRows || []).forEach((item: any) => {
        if (!item.rdo_id) return;
        if (!nfGrupo[item.rdo_id]) nfGrupo[item.rdo_id] = [];
        nfGrupo[item.rdo_id].push(item as NfMassaItem);
      });
      setNfByRdoId(nfGrupo);

      setLoading(false);
    };
    carregar();
  }, [ogs, ini, fim]);

  // Selecionar / desselecionar
  const toggleSel = (id: string) => setSelecionados(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const toggleTodos = () => {
    if (selecionados.size === rdoList.length) setSelecionados(new Set());
    else setSelecionados(new Set(rdoList.map(r => r.id)));
  };

  // RDOs a exportar: selecionados ou todos se nenhum selecionado
  const rdosParaExportar = selecionados.size > 0
    ? rdoList.filter(r => selecionados.has(r.id))
    : rdoList;
  const exportandoSelecionados = selecionados.size > 0;
  const escopoExportacaoLabel = exportandoSelecionados
    ? `Selecionados (${rdosParaExportar.length})`
    : `Todos (${rdosParaExportar.length})`;

  // Excluir RDO (salva na lixeira por 30 dias antes de excluir)
  const excluirRdo = async (id: string) => {
    if (!canDelete) {
      toast({ title: "Sem permissão", description: "Seu perfil (Gerente) não permite excluir registros.", variant: "destructive" });
      return;
    }
    if (!confirm("Excluir este RDO? Ele ficará na lixeira por 30 dias e pode ser recuperado.")) return;
    setExcluindo(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("company_id, nome_completo").eq("user_id", user?.id!).maybeSingle();

      // Buscar dados do RDO antes de excluir
      const rdoItem = rdoList.find(r => r.id === id);
      const efetivo = efetivoByRdoId[id] || [];
      const producao = producaoByRdoId[id] || [];
      const equipamentos = equipByRdoId[id] || [];
      const nfs = nfByRdoId[id] || [];

      // Salvar na lixeira
      await supabase.from("lixeira" as any).insert({
        company_id: (profile as any)?.company_id,
        tabela: "rdo_diarios",
        registro_id: id,
        dados: { rdo: rdoItem, efetivo, producao, equipamentos, nfs, ogs, clienteNome },
        excluido_por: user?.id,
        excluido_por_nome: (profile as any)?.nome_completo || user?.email,
      });

      // Excluir dados relacionados
      await Promise.all([
        supabase.from("rdo_efetivo").delete().eq("rdo_id", id),
        supabase.from("rdo_producao" as any).delete().eq("rdo_id", id),
        supabase.from("rdo_equipamentos" as any).delete().eq("rdo_id", id),
        supabase.from("rdo_nf_massa" as any).delete().eq("rdo_id", id),
      ]);
      const { error } = await supabase.from("rdo_diarios" as any).delete().eq("id", id);
      if (error) throw error;
      setRdoList(prev => prev.filter(r => r.id !== id));
      setSelecionados(prev => { const s = new Set(prev); s.delete(id); return s; });
      await registrarAuditoria({ acao: "DELETE", tabela: "rdo_diarios", registroId: id, dadosAntes: rdoItem as any });
      toast({ title: "✅ RDO excluído", description: "Salvo na lixeira por 30 dias. Recupere em Painel de Controle → Lixeira." });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
    setExcluindo(null);
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={goBack} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoHomeButton className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório RDO</span>
          <span className="block text-[11px] text-primary-foreground/80">OGS {ogs} • {fmtDate(ini)} a {fmtDate(fim)}</span>
        </div>
      </header>

      <div className="px-4 pb-2 bg-header-gradient">
        <NavigationTrail trail={trail} onSelect={goTo} />
      </div>

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        {/* Barra de ações */}
        {!loading && rdoList.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            {/* Selecionar todos */}
            {rdoList.length > 1 && (
              <Button variant="outline" size="sm" className="gap-2 text-xs"
                onClick={toggleTodos}>
                {selecionados.size === rdoList.length
                  ? <><CheckSquare className="w-3.5 h-3.5" /> Desmarcar todos</>
                  : <><Square className="w-3.5 h-3.5" /> Selecionar todos</>}
              </Button>
            )}
            {canExport && !loadingCanExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <FileDown className="w-3.5 h-3.5" />
                    Exportar {escopoExportacaoLabel}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    Escopo atual: {escopoExportacaoLabel}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>Consolidado (arquivo único)</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => exportarPdf(ogs, rdosParaExportar, efetivoByRdoId, terceirosByRdoId, producaoByRdoId, clienteNome, equipByRdoId, nfByRdoId)}>
                    <Printer className="w-3.5 h-3.5 mr-2" /> PDF consolidado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportarExcel(ogs, rdosParaExportar, efetivoByRdoId, terceirosByRdoId, producaoByRdoId, equipByRdoId, nfByRdoId, clienteNome)}>
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Excel consolidado
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Separado por RDO (ZIP)</DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await exportarPdfSeparadoZip(ogs, rdosParaExportar, efetivoByRdoId, terceirosByRdoId, producaoByRdoId, clienteNome, equipByRdoId, nfByRdoId);
                        toast({ title: "✅ ZIP PDF gerado", description: `${rdosParaExportar.length} RDO(s) exportados em arquivos separados.` });
                      } catch (e: any) {
                        toast({ title: "Erro ao exportar PDF separado", description: e?.message || "Falha ao gerar ZIP", variant: "destructive" });
                      }
                    }}
                  >
                    <FileDown className="w-3.5 h-3.5 mr-2" /> PDF separados (ZIP)
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await exportarExcelSeparadoZip(ogs, rdosParaExportar, efetivoByRdoId, terceirosByRdoId, producaoByRdoId, equipByRdoId, nfByRdoId, clienteNome);
                        toast({ title: "✅ ZIP CSV gerado", description: `${rdosParaExportar.length} RDO(s) exportados em arquivos separados.` });
                      } catch (e: any) {
                        toast({ title: "Erro ao exportar Excel separado", description: e?.message || "Falha ao gerar ZIP", variant: "destructive" });
                      }
                    }}
                  >
                    <FileDown className="w-3.5 h-3.5 mr-2" /> Excel separados (ZIP)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {loading ? (
          <div className="rdo-card py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : rdoList.length === 0 ? (
          <div className="rdo-card py-10 text-center text-muted-foreground text-sm">
            Nenhum RDO encontrado para este período
          </div>
        ) : (
          rdoList.map((item) => {
            const isOpen = !!expanded[item.id];
            const efetivo = efetivoByRdoId[item.id] || [];
            const producao = producaoByRdoId[item.id] || [];
            const equipamentos = equipByRdoId[item.id] || [];
            const nfMassa = nfByRdoId[item.id] || [];
            const terceiros = terceirosByRdoId[item.id] || {};
            const terceirosRows = Object.entries(terceiros).flatMap(([empresa, nomes]) =>
              nomes.map((nome) => ({ empresa: empresa || "-", nome: nome || "-" })),
            );

            // Expandir nomes (suporte a nomes separados por |||)
            const pessoas: { nome: string; funcao: string; matricula: string; entrada: string; saida: string }[] = [];
            efetivo.forEach(ef => {
              const nomes = expandNomes(ef);
              if (nomes.length > 0) {
                nomes.forEach(nome => pessoas.push({ nome, funcao: ef.funcao || "-", matricula: ef.matricula || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" }));
              } else {
                // Legado: sem nome, só função
                pessoas.push({ nome: "-", funcao: ef.funcao || "-", matricula: ef.matricula || "-", entrada: ef.entrada || "-", saida: ef.saida || "-" });
              }
            });

            const entradaGlobal = efetivo[0]?.entrada || "-";
            const saidaGlobal = efetivo[0]?.saida || "-";

            const isSel = selecionados.has(item.id);
            return (
              <div key={item.id} className={`rdo-card transition-all ${isSel ? "ring-2 ring-primary" : ""}`}>
                {/* Cabeçalho */}
                <div className="flex items-start gap-2">
                  {/* Checkbox de seleção */}
                  {rdoList.length > 1 && (
                    <button
                      onClick={() => toggleSel(item.id)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      title={isSel ? "Desmarcar" : "Selecionar para exportar"}
                    >
                      {isSel
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Dados clicáveis */}
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-display font-bold text-primary">{fmtDate(item.data)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {clienteNome && <span className="font-medium text-foreground">{clienteNome} • </span>}
                          Tipo: {item.tipo_rdo || "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Encarregado: <span className="font-medium text-foreground">{item.encarregado || item.responsavel || "-"}</span>
                          {item.preenchido_por && <span className="ml-2 opacity-60">• Preenchido por: {item.preenchido_por}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Turno: {item.turno || "-"} • Clima: {item.clima || "-"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                          {pessoas.length} pessoas
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {/* Botão excluir (apenas admin com can_delete) */}
                  {isAdmin && canDelete && (
                    <button
                      onClick={() => excluirRdo(item.id)}
                      disabled={excluindo === item.id}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                      title="Excluir este RDO"
                    >
                      {excluindo === item.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-border pt-3 space-y-4">

                    {/* Cabeçalho detalhado */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground">Cliente</p>
                        <p className="font-semibold">{clienteNome || "-"}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground">OGS</p>
                        <p className="font-semibold">{ogs}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground">Encarregado da obra</p>
                        <p className="font-semibold">{item.encarregado || item.responsavel || "-"}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground">Preenchido por</p>
                        <p className="font-semibold">{item.preenchido_por || item.responsavel || "-"}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground">Tipo / Turno</p>
                        <p className="font-semibold">{item.tipo_rdo || "-"} / {item.turno || "-"}</p>
                      </div>
                    </div>

                    {/* Efetivo */}
                    {pessoas.length > 0 && (
                      <div>
                        <p className="text-xs font-display font-bold text-primary uppercase mb-1">
                          👷 Efetivo ({pessoas.length}) — {entradaGlobal} às {saidaGlobal}
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-1.5 px-2">#</th>
                                <th className="text-left py-1.5 px-2">Nome</th>
                                <th className="text-left py-1.5 px-2">Função</th>
                                <th className="text-left py-1.5 px-2">Entrada</th>
                                <th className="text-left py-1.5 px-2">Saída</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pessoas.map((p, i) => (
                                <tr key={i} className="border-b border-border/60 last:border-0">
                                  <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                  <td className="py-1.5 px-2 font-medium">{p.nome}</td>
                                  <td className="py-1.5 px-2 text-muted-foreground">{p.funcao}</td>
                                  <td className="py-1.5 px-2">{p.entrada}</td>
                                  <td className="py-1.5 px-2">{p.saida}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Efetivo Terceirizado */}
                    {terceirosRows.length > 0 && (
                      <div>
                        <p className="text-xs font-display font-bold text-amber-700 uppercase mb-1">
                          👷‍♂️ Efetivo Terceirizado ({terceirosRows.length})
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-amber-300 bg-amber-200/80 text-amber-950">
                                <th className="text-left py-1.5 px-2">#</th>
                                <th className="text-left py-1.5 px-2">Empresa</th>
                                <th className="text-left py-1.5 px-2">Funcionário</th>
                              </tr>
                            </thead>
                            <tbody>
                              {terceirosRows.map((t, i) => (
                                <tr
                                  key={`${t.empresa}-${t.nome}-${i}`}
                                  className={`border-b border-amber-200 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-amber-50/60"}`}
                                >
                                  <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                  <td className="py-1.5 px-2 font-semibold text-amber-900">{t.empresa}</td>
                                  <td className="py-1.5 px-2 text-foreground">{t.nome}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Equipamentos */}
                    {equipamentos.length > 0 && (
                      <div>
                        <p className="text-xs font-display font-bold text-primary uppercase mb-1">🚜 Equipamentos ({equipamentos.length})</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-1.5 px-2">Frota/CC</th>
                                <th className="text-left py-1.5 px-2">Equipamento</th>
                                <th className="text-left py-1.5 px-2">Modelo</th>
                                <th className="text-left py-1.5 px-2">Empresa</th>
                              </tr>
                            </thead>
                            <tbody>
                              {equipamentos.map(e => (
                                <tr key={e.id} className="border-b border-border/60 last:border-0">
                                  <td className="py-1.5 px-2 font-medium">{labelFrotaEquip(e)}</td>
                                  <td className="py-1.5 px-2">{e.sub_tipo || e.tipo || e.categoria || "-"}</td>
                                  <td className="py-1.5 px-2">{labelModeloEquip(e)}</td>
                                  <td className="py-1.5 px-2">{e.empresa_dona || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* NF de Massa */}
                    {nfMassa.length > 0 && (() => {
                      const totalTon = nfMassa.reduce((s, n) => s + (n.tonelagem || 0), 0);
                      return (
                        <div>
                          <p className="text-xs font-display font-bold text-primary uppercase mb-1">📄 Notas Fiscais de Massa</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="text-left py-1.5 px-2">NF</th>
                                  <th className="text-left py-1.5 px-2">Placa</th>
                                  <th className="text-left py-1.5 px-2">Usina</th>
                                  <th className="text-right py-1.5 px-2">Tonelagem</th>
                                  <th className="text-left py-1.5 px-2">Material</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nfMassa.map(n => (
                                  <tr key={n.id} className="border-b border-border/60 last:border-0">
                                    <td className="py-1.5 px-2 font-medium">{n.nf || "-"}</td>
                                    <td className="py-1.5 px-2">{n.placa || "-"}</td>
                                    <td className="py-1.5 px-2">{n.usina || "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{n.tonelagem != null ? fmtNum(n.tonelagem, 2) : "-"}</td>
                                    <td className="py-1.5 px-2">{n.tipo_material || "-"}</td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-border font-bold bg-muted/30">
                                  <td colSpan={3} className="py-1.5 px-2">TOTAL</td>
                                  <td className="py-1.5 px-2 text-right">{fmtNum(totalTon, 2)}</td>
                                  <td />
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Produção do Dia */}
                    {producao.length > 0 && (() => {
                      const totalArea = producao.reduce((s, p) => s + (parseFloat(String(p.area_m2 || 0)) || 0), 0);
                      const totalTon = producao.reduce((s, p) => s + (parseFloat(String(p.tonelagem || 0)) || 0), 0);
                      return (
                        <div>
                          <p className="text-xs font-display font-bold text-primary uppercase mb-1">🛣️ Produção do Dia</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="text-left py-1.5 px-2">Serviço</th>
                                  <th className="text-left py-1.5 px-2">Sentido/Faixa</th>
                                  <th className="text-left py-1.5 px-2">Est. Ini</th>
                                  <th className="text-left py-1.5 px-2">Est. Fim</th>
                                  <th className="text-right py-1.5 px-2">Comp(m)</th>
                                  <th className="text-right py-1.5 px-2">Larg(m)</th>
                                  <th className="text-right py-1.5 px-2">Área(m²)</th>
                                  <th className="text-right py-1.5 px-2">Esp(cm)</th>
                                  <th className="text-right py-1.5 px-2">Volume(m³)</th>
                                  <th className="text-right py-1.5 px-2">Dens.</th>
                                  <th className="text-right py-1.5 px-2">Ton</th>
                                </tr>
                              </thead>
                              <tbody>
                                {producao.map(p => (
                                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                                    <td className="py-1.5 px-2 font-medium">{p.tipo_servico || "-"}</td>
                                    <td className="py-1.5 px-2">{p.sentido_faixa || p.sentido || "-"}</td>
                                    <td className="py-1.5 px-2">{p.estaca_inicial || p.km_inicial || "-"}</td>
                                    <td className="py-1.5 px-2">{p.estaca_final || p.km_final || "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.comprimento_m || "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.largura_m || "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.area_m2 ? fmtNum(toNumLib(p.area_m2), 2) : "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.espessura_cm || "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.volume_m3 ? fmtNum(toNumLib(p.volume_m3), 2) : "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.densidade ? fmtNum(toNumLib(p.densidade), 2) : "-"}</td>
                                    <td className="py-1.5 px-2 text-right">{p.tonelagem != null ? fmtNum(toNumLib(p.tonelagem), 2) : "-"}</td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-border font-bold bg-muted/30">
                                  <td colSpan={6} className="py-1.5 px-2">TOTAL</td>
                                  <td className="py-1.5 px-2 text-right">{fmtNum(totalArea, 2)}</td>
                                  <td /><td /><td />
                                  <td className="py-1.5 px-2 text-right">{fmtNum(totalTon, 2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {pessoas.length === 0 && producao.length === 0 && equipamentos.length === 0 && nfMassa.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Sem dados detalhados neste RDO.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
