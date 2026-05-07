import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, FileDown, FileSpreadsheet, Printer, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoCi from "@/assets/logo-workflux.png";
import { fmtNum, fmtNumCsv, toNum as toNumLib } from "@/lib/fmt";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "@/hooks/use-toast";

interface RdoItem {
  id: string;
  data: string | null;
  tipo_rdo: string | null;
  responsavel: string | null;     // legado
  encarregado: string | null;     // encarregado da obra
  preenchido_por: string | null;  // apontador/usuário logado
  turno: string | null;
  clima: string | null;
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
  tonelagem: string | null;
  observacoes: string | null;
}

interface EquipamentoItem {
  id: string;
  rdo_id: string | null;
  frota: string | null;
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

// Exportar Excel (CSV com BOM UTF-8)
function exportarExcel(
  ogs: string,
  rdoList: RdoItem[],
  efetivoByRdoId: Record<string, EfetivoItem[]>,
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

    // Equipamentos
    const equipamentos = equipByRdoId[rdo.id] || [];
    if (equipamentos.length > 0) {
      linhas.push([`EQUIPAMENTOS (${equipamentos.length})`]);
      linhas.push(["Frota", "Equipamento", "Modelo/Placa", "Empresa"]);
      equipamentos.forEach(e => linhas.push([e.frota || "-", e.sub_tipo || e.tipo || e.categoria || "-", e.nome || e.patrimonio || "-", e.empresa_dona || "-"]));
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
  a.download = `RDO_OGS${ogs}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Exportar PDF via print
function exportarPdf(ogs: string, rdoList: RdoItem[], efetivoByRdoId: Record<string, EfetivoItem[]>, producaoByRdoId: Record<string, ProducaoItem[]>, clienteNome: string, equipByRdoId?: Record<string, EquipamentoItem[]>, nfByRdoId?: Record<string, NfMassaItem[]>) {
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

    // Equipamentos
    if (equipamentos.length > 0) {
      html += `<h2>🚜 Equipamentos (${equipamentos.length})</h2>
      <table><tr><th>Frota</th><th>Equipamento</th><th>Modelo/Placa</th><th>Empresa</th></tr>`;
      equipamentos.forEach(e => {
        html += `<tr><td>${e.frota || "-"}</td><td>${e.sub_tipo || e.tipo || e.categoria || "-"}</td><td>${e.nome || e.patrimonio || "-"}</td><td>${e.empresa_dona || "-"}</td></tr>`;
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
      <table><tr><th>Serviço</th><th>Sentido/Faixa</th><th>Est.Ini</th><th>Est.Fim</th><th>Comp(m)</th><th>Larg(m)</th><th>Área(m²)</th><th>Esp(m)</th><th>Ton</th></tr>`;
      producao.forEach(p => {
        html += `<tr><td>${p.tipo_servico || "-"}</td><td>${p.sentido_faixa || p.sentido || "-"}</td><td>${p.estaca_inicial || p.km_inicial || "-"}</td><td>${p.estaca_final || p.km_final || "-"}</td><td>${p.comprimento_m || "-"}</td><td>${p.largura_m || "-"}</td><td>${p.area_m2 ? fmtNum(toNumLib(p.area_m2), 2) : "-"}</td><td>${p.espessura_cm || "-"}</td><td>${p.tonelagem != null ? fmtNum(toNumLib(p.tonelagem), 2) : "-"}</td></tr>`;
      });
      html += `<tr style="font-weight:bold;background:#f3f4f6"><td colspan="6">TOTAL</td><td>${fmtNum(totalArea, 2)}</td><td></td><td>${fmtNum(totalTonProd, 2)}</td></tr></table>`;
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
  const { ogs = "" } = useParams<{ ogs: string }>();
  const [searchParams] = useSearchParams();

  const ini = searchParams.get("ini") || "";
  const fim = searchParams.get("fim") || "";

  const { isAdmin } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [rdoList, setRdoList] = useState<RdoItem[]>([]);
  const [efetivoByRdoId, setEfetivoByRdoId] = useState<Record<string, EfetivoItem[]>>({});
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
        .select("id,data,tipo_rdo,responsavel,encarregado,preenchido_por,turno,clima")
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

      // Produção
      const { data: prodRows } = await (supabase as any)
        .from("rdo_producao")
        .select("id,rdo_id,tipo_servico,sentido_faixa,sentido,faixa,estaca_inicial,estaca_final,km_inicial,km_final,comprimento_m,largura_m,espessura_cm,area_m2,tonelagem,observacoes")
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
      const equipGrupo: Record<string, EquipamentoItem[]> = {};
      (equipRows || []).forEach((item: any) => {
        if (!item.rdo_id) return;
        if (!equipGrupo[item.rdo_id]) equipGrupo[item.rdo_id] = [];
        equipGrupo[item.rdo_id].push(item as EquipamentoItem);
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

  // Excluir RDO
  const excluirRdo = async (id: string) => {
    if (!confirm("Excluir este RDO permanentemente? Esta ação não pode ser desfeita.")) return;
    setExcluindo(id);
    try {
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
      toast({ title: "✅ RDO excluído com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
    setExcluindo(null);
  };

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={logoCi} alt="Workflux" className="h-10 object-contain" />
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">Relatório RDO</span>
          <span className="block text-[11px] text-primary-foreground/80">OGS {ogs} • {fmtDate(ini)} a {fmtDate(fim)}</span>
        </div>
      </header>

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
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => exportarPdf(ogs, rdosParaExportar, efetivoByRdoId, producaoByRdoId, clienteNome, equipByRdoId, nfByRdoId)}>
              <Printer className="w-3.5 h-3.5" />
              Exportar PDF {selecionados.size > 0 ? `(${selecionados.size})` : ""}
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => exportarExcel(ogs, rdosParaExportar, efetivoByRdoId, producaoByRdoId, equipByRdoId, nfByRdoId, clienteNome)}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel {selecionados.size > 0 ? `(${selecionados.size})` : ""}
            </Button>
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

                  {/* Botão excluir (admin only) */}
                  {isAdmin && (
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

                    {/* Equipamentos */}
                    {equipamentos.length > 0 && (
                      <div>
                        <p className="text-xs font-display font-bold text-primary uppercase mb-1">🚜 Equipamentos ({equipamentos.length})</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-1.5 px-2">Frota</th>
                                <th className="text-left py-1.5 px-2">Equipamento</th>
                                <th className="text-left py-1.5 px-2">Modelo/Placa</th>
                                <th className="text-left py-1.5 px-2">Empresa</th>
                              </tr>
                            </thead>
                            <tbody>
                              {equipamentos.map(e => (
                                <tr key={e.id} className="border-b border-border/60 last:border-0">
                                  <td className="py-1.5 px-2 font-medium">{e.frota || "-"}</td>
                                  <td className="py-1.5 px-2">{e.sub_tipo || e.tipo || e.categoria || "-"}</td>
                                  <td className="py-1.5 px-2">{e.nome || e.patrimonio || "-"}</td>
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
                                  <th className="text-right py-1.5 px-2">Esp(m)</th>
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
                                    <td className="py-1.5 px-2 text-right">{p.tonelagem != null ? fmtNum(toNumLib(p.tonelagem), 2) : "-"}</td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-border font-bold bg-muted/30">
                                  <td colSpan={6} className="py-1.5 px-2">TOTAL</td>
                                  <td className="py-1.5 px-2 text-right">{fmtNum(totalArea, 2)}</td>
                                  <td />
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
