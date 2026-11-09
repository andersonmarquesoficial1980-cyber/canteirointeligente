import { useMemo, useState } from "react";
import { CheckCircle2, CloudRain, Download, FileX2, Hammer, ChevronRight } from "lucide-react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATEGORIAS_NAO_PERDA, calcularDiasPorObra, addDias,
  type DiaObra, type DiaRdoRow, type Producao, type ResumoObra, type StatusDia,
} from "@/lib/rdoTecnicoDiasObra";

const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });
const fmtData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtDataLonga = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function textoProducao(p: Producao) {
  const partes: string[] = [];
  if (p.ton > 0) partes.push(`${fmt(p.ton)} t`);
  if (p.m2 > 0) partes.push(`${fmt(p.m2)} m²`);
  if (p.m3 > 0) partes.push(`${fmt(p.m3)} m³`);
  return partes.length ? partes.join(" · ") : "—";
}

const STATUS_VISUAL: Record<StatusDia, { rotulo: string; cls: string }> = {
  trabalhado: { rotulo: "Trabalhou", cls: "bg-emerald-100 text-emerald-800" },
  sem_producao: { rotulo: "Sem produção", cls: "bg-amber-100 text-amber-800" },
  sem_rdo: { rotulo: "Sem RDO", cls: "bg-red-100 text-red-800" },
};

type Filtro = "todos" | StatusDia;

interface Props {
  rows: DiaRdoRow[];
  rowsPrev: DiaRdoRow[];
  engMap: Record<string, string>;
  dataIni: string;
  dataFim: string;
  hojeISO: string;
  ogsInicial?: string;
  onAbrirRdo: (rdoId: string) => void;
}

export function DiasObraPainel({ rows, rowsPrev, engMap, dataIni, dataFim, hojeISO, ogsInicial = "", onAbrirRdo }: Props) {
  const [ogs, setOgs] = useState(ogsInicial);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [categoria, setCategoria] = useState("");

  const obras = useMemo(
    () => calcularDiasPorObra(rows, { periodo: { inicio: dataIni, fim: dataFim }, ultimoDiaEsperado: addDias(hojeISO, -1), historico: rowsPrev }),
    [rows, rowsPrev, dataIni, dataFim, hojeISO],
  );
  const nomeEng = (id: string | null) => (id ? engMap[id] || "Engenheiro sem nome" : "Sem engenheiro");
  const obra = obras.find(o => o.ogs === ogs);

  const selecionar = (v: string) => { setOgs(v); setFiltro("todos"); setCategoria(""); };

  const baixarCsv = (resumo: ResumoObra[]) => {
    const linhas = [["OGS", "Data", "Dia", "Situação", "Motivo", "Produção (t)", "Produção (m²)", "Produção (m³)", "Engenheiros que lançaram", "Engenheiros sem RDO", "Observação do RDO", "Liberada no horário?", "Motivo da liberação", "Responsável", "Previsto", "Liberada", "Atraso (min)", "Justificativa da liberação"]];
    resumo.forEach(o => o.dias.slice().reverse().forEach(d => linhas.push([
      o.ogs, fmtDataLonga(d.data), d.dow, STATUS_VISUAL[d.status].rotulo, d.categoria || "",
      String(d.producao.ton), String(d.producao.m2), String(d.producao.m3),
      [...new Set(d.rdos.map(r => nomeEng(r.engenheiroId)))].join(" / "), d.faltantes.map(nomeEng).join(" / "), d.motivoTexto,
      d.status === "trabalhado" ? (d.liberacao ? "Não" : "Sim") : "", d.liberacao?.motivo || "", d.liberacao?.responsavel || "",
      d.liberacao?.previsto || "", d.liberacao?.real || "", d.liberacao?.atrasoMin != null ? String(d.liberacao.atrasoMin) : "", d.liberacao?.justificativa || "",
    ])));
    const csv = "\uFEFF" + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `dias-da-obra-${resumo.length === 1 ? resumo[0].ogs : "todas"}-${dataIni}-a-${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---------- lista de engenheiros que não preencheram (todas as obras ou uma) ----------
  const faltasTodas = useMemo(() => {
    const fonte = obra ? [obra] : obras;
    return fonte.flatMap(o => o.faltas.map(f => ({ ...f }))).sort((a, b) => b.datas.length - a.datas.length);
  }, [obras, obra]);

  const seletor = (
    <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
      Obra (OGS)
      <select aria-label="Obra" value={ogs} onChange={e => selecionar(e.target.value)} className="h-10 min-w-[220px] rounded-lg border bg-white px-2 text-sm font-semibold">
        <option value="">Todas as obras — resumo</option>
        {obras.map(o => <option key={o.ogs} value={o.ogs}>OGS {o.ogs}</option>)}
      </select>
    </label>
  );

  const caixaFaltas = (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3" data-testid="faltas-rdo">
      <div className="flex items-center gap-2 text-sm font-bold text-red-800"><FileX2 className="h-4 w-4" /> RDOs não preenchidos ({faltasTodas.reduce((s, f) => s + f.datas.length, 0)})</div>
      {faltasTodas.length === 0 ? (
        <p className="mt-1 text-sm text-red-900/80">Nenhum engenheiro deixou de lançar nos dias esperados.</p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-sm">
          {faltasTodas.map(f => (
            <li key={`${f.ogs}|${f.engenheiroId}`} className="flex flex-wrap gap-x-2">
              <strong>{nomeEng(f.engenheiroId)}</strong>
              <button type="button" className="text-red-800 underline-offset-2 hover:underline" onClick={() => selecionar(f.ogs)}>OGS {f.ogs}</button>
              <span className="text-red-900">— {f.datas.length} dia{f.datas.length > 1 ? "s" : ""}: {f.datas.slice().sort().map(fmtData).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-xs text-red-900/70">Esperado = engenheiro que já lançava nessa obra e ficou sem RDO enviado num dia dentro da sequência dele. Não há escala oficial por dia; confira antes de cobrar.</p>
    </div>
  );

  // ---------- visão geral (todas as obras) ----------
  if (!obra) {
    return (
      <section className="flex min-h-0 flex-col gap-3" data-testid="dias-obra-geral">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold leading-tight">Dias da obra</h2>
            <p className="text-sm text-muted-foreground">{fmtDataLonga(dataIni)} a {fmtDataLonga(dataFim)} · 1 linha = 1 obra; os números são dias, não RDOs.</p>
          </div>
          <div className="flex items-center gap-2">
            {seletor}
            <Button type="button" variant="outline" size="sm" className="h-10" disabled={!obras.length} onClick={() => baixarCsv(obras)}><Download className="mr-1 h-4 w-4" /> CSV</Button>
          </div>
        </div>
        {obras.length === 0 ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Nenhum RDO no período.</p> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="p-2">Obra</th><th className="p-2">Dias trabalhados</th><th className="p-2">Produzido</th><th className="p-2">Sem produção</th><th className="p-2">Por chuva</th><th className="p-2">Liberação atrasada</th><th className="p-2">Sem RDO</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {obras.map(o => {
                  const chuva = o.porCategoria.find(c => c.categoria === "Chuva")?.dias || 0;
                  return (
                    <tr key={o.ogs} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => selecionar(o.ogs)}>
                      <td className="p-2 font-bold">OGS {o.ogs}</td>
                      <td className="p-2 font-semibold text-emerald-700">{o.diasTrabalhados}</td>
                      <td className="p-2">{textoProducao(o.producao)}</td>
                      <td className="p-2 text-amber-700">{o.diasSemProducao}</td>
                      <td className="p-2 text-sky-700">{chuva || "—"}</td>
                      <td className="p-2 text-orange-700">{o.liberacaoAtrasada.dias ? `${o.liberacaoAtrasada.dias} dia${o.liberacaoAtrasada.dias > 1 ? "s" : ""}` : "—"}</td>
                      <td className={`p-2 font-semibold ${o.rdosFaltantes ? "text-red-700" : "text-muted-foreground"}`}>{o.rdosFaltantes ? `${o.rdosFaltantes} RDO${o.rdosFaltantes > 1 ? "s" : ""}` : "—"}</td>
                      <td className="p-2 text-right text-muted-foreground"><ChevronRight className="inline h-4 w-4" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {caixaFaltas}
      </section>
    );
  }

  // ---------- uma obra ----------
  const chuvaDias = obra.porCategoria.find(c => c.categoria === "Chuva")?.dias || 0;
  const visiveis = obra.dias.filter(d => (filtro === "todos" || d.status === filtro) && (!categoria || d.categoria === categoria));
  const totalVisivel = visiveis.reduce((a, d) => ({ ton: a.ton + d.producao.ton, m2: a.m2 + d.producao.m2, m3: a.m3 + d.producao.m3 }), { ton: 0, m2: 0, m3: 0 });

  const Card = ({ alvo, titulo, valor, sub, cor, icon: Icon }: { alvo: Filtro; titulo: string; valor: string; sub?: string; cor: string; icon: typeof Hammer }) => (
    <button type="button" aria-pressed={filtro === alvo && !categoria} onClick={() => { setFiltro(alvo); setCategoria(""); }}
      className={`rounded-xl border bg-white p-3 text-left transition-shadow hover:shadow ${filtro === alvo && !categoria ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">{titulo}<Icon className={`h-4 w-4 ${cor}`} /></div>
      <div className={`text-2xl font-black leading-tight ${cor}`}>{valor}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </button>
  );

  return (
    <section className="flex min-h-0 flex-col gap-3" data-testid="dias-obra-obra">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold leading-tight">OGS {obra.ogs} — dia a dia</h2>
          <p className="text-sm text-muted-foreground">{fmtDataLonga(dataIni)} a {fmtDataLonga(dataFim)} · {obra.diasNoPeriodo} dias com atividade ou RDO esperado</p>
        </div>
        <div className="flex items-center gap-2">
          {seletor}
          <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => baixarCsv([obra])}><Download className="mr-1 h-4 w-4" /> CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card alvo="trabalhado" titulo="Dias trabalhados" valor={String(obra.diasTrabalhados)} sub={`Produziu ${textoProducao(obra.producao)}`} cor="text-emerald-700" icon={Hammer} />
        <Card alvo="sem_producao" titulo="Dias sem produção" valor={String(obra.diasSemProducao)} sub={chuvaDias ? `${chuvaDias} por chuva` : "nenhum por chuva"} cor="text-amber-700" icon={CloudRain} />
        <Card alvo="sem_rdo" titulo="Dias sem RDO" valor={String(obra.diasSemRdo)} sub="nenhum engenheiro lançou" cor="text-red-700" icon={FileX2} />
        <Card alvo="todos" titulo="Todos os dias" valor={String(obra.diasNoPeriodo)} sub={obra.rdosFaltantes ? `${obra.rdosFaltantes} RDO(s) faltando` : "RDOs em dia"} cor="text-foreground" icon={CheckCircle2} />
      </div>

      {obra.porCategoria.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="motivos-sem-producao">
          <span className="text-xs font-bold text-muted-foreground">Por que não produziu:</span>
          {obra.porCategoria.map(c => (
            <button key={c.categoria} type="button" aria-pressed={categoria === c.categoria}
              onClick={() => { setFiltro("sem_producao"); setCategoria(categoria === c.categoria ? "" : c.categoria); }}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${categoria === c.categoria ? "border-primary bg-primary text-white" : c.perda ? "bg-white" : "bg-muted/60 text-muted-foreground"}`}>
              {c.categoria}: {c.dias} dia{c.dias > 1 ? "s" : ""}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">(cinza = não é perda)</span>
        </div>
      )}

      {(obra.diasSemProducao > 0 || obra.liberacaoAtrasada.dias > 0) && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3" data-testid="explicacao-baixa-producao">
          <div className="text-sm font-bold text-sky-900">Por que a produção foi baixa nesta obra</div>
          <ul className="mt-1.5 space-y-1 text-sm text-sky-950">
            {obra.porCategoria.map(c => (
              <li key={c.categoria}>• <strong>{c.categoria}</strong>: {c.dias} dia{c.dias > 1 ? "s" : ""} sem produção{c.perda ? "" : " (não é perda)"}</li>
            ))}
            {obra.liberacaoAtrasada.dias > 0 && (
              <li>• <strong>Obra liberada fora do horário</strong>: {obra.liberacaoAtrasada.dias} dia{obra.liberacaoAtrasada.dias > 1 ? "s" : ""} com produção reduzida
                {obra.liberacaoAtrasada.minutos > 0 ? ` (≈ ${fmt(obra.liberacaoAtrasada.minutos / 60)} h de espera informadas)` : ""} —{" "}
                {obra.liberacaoAtrasada.porResponsavel.map(r => `${r.responsavel}: ${r.dias}`).join(" · ")}</li>
            )}
            {obra.diasSemRdo > 0 && <li>• <strong>Sem RDO</strong>: {obra.diasSemRdo} dia{obra.diasSemRdo > 1 ? "s" : ""} sem registro — não dá para justificar.</li>}
          </ul>
        </div>
      )}

      {obra.faltas.length > 0 && caixaFaltas}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-2">Dia</th><th className="p-2">Situação</th><th className="p-2">Produziu</th><th className="p-2">Engenheiro / equipe</th><th className="p-2">Motivo / observação</th></tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum dia neste filtro.</td></tr>}
            {visiveis.map(d => <LinhaDia key={d.data} d={d} nomeEng={nomeEng} onAbrirRdo={onAbrirRdo} />)}
          </tbody>
          {visiveis.length > 0 && (
            <tfoot className="border-t bg-muted/40 text-sm font-bold">
              <tr><td className="p-2" colSpan={2}>{visiveis.length} dia{visiveis.length > 1 ? "s" : ""}</td><td className="p-2" colSpan={3}>Total produzido nos dias listados: {textoProducao(totalVisivel)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Clique numa linha para abrir o RDO. {CATEGORIAS_NAO_PERDA.join(" e ")} não contam como perda. Motivos escritos em texto livre ("Outro") são classificados pelo conteúdo e marcados com *.</p>
    </section>
  );
}

function LinhaDia({ d, nomeEng, onAbrirRdo }: { d: DiaObra; nomeEng: (id: string | null) => string; onAbrirRdo: (id: string) => void }) {
  const v = STATUS_VISUAL[d.status];
  const engs = [...new Set(d.rdos.map(r => nomeEng(r.engenheiroId)))];
  const servicos = d.rdos.flatMap(r => r.servicos).reduce<Record<string, number>>((a, s) => { a[`${s.rotulo}|${s.un}`] = (a[`${s.rotulo}|${s.un}`] || 0) + s.valor; return a; }, {});
  const porTexto = d.rdos.find(r => r.motivo?.categoria === d.categoria)?.motivo?.porTexto;
  const rascunho = d.rdos.some(r => r.status !== "enviado");
  return (
    <tr className={`border-t ${d.rdos.length ? "cursor-pointer hover:bg-muted/40" : ""}`} onClick={() => d.rdos[0] && onAbrirRdo(d.rdos[0].id)}>
      <td className="whitespace-nowrap p-2 font-semibold">{fmtData(d.data)} <span className="font-normal text-muted-foreground">{d.dow}</span></td>
      <td className="p-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${v.cls}`}>{v.rotulo}</span>{rascunho && <span className="ml-1 text-xs text-amber-700">rascunho</span>}</td>
      <td className="p-2">
        {d.status === "trabalhado" ? (
          <div><strong>{textoProducao(d.producao)}</strong>
            <div className="text-xs text-muted-foreground">{Object.entries(servicos).map(([k, val]) => { const [r, un] = k.split("|"); return `${r} ${fmt(val)} ${un}`; }).join(" · ")}</div></div>
        ) : "—"}
      </td>
      <td className="p-2">
        {engs.map(e => <div key={e}>{e}</div>)}
        {d.rdos.map(r => r.equipe).filter(Boolean).filter((e, i, a) => a.indexOf(e) === i).map(e => <div key={e} className="text-xs text-muted-foreground">{e}</div>)}
        {d.faltantes.map(e => <div key={e} className="text-xs font-bold text-red-700">sem RDO: {nomeEng(e)}</div>)}
      </td>
      <td className="max-w-[420px] p-2">
        {d.status === "sem_producao" && <div className="font-semibold">{d.categoria}{porTexto ? " *" : ""}</div>}
        {d.status === "sem_rdo" && <div className="font-semibold text-red-700">RDO não preenchido</div>}
        {d.liberacao && (
          <div className="text-xs font-semibold text-orange-700" title={d.liberacao.justificativa}>
            <Clock className="mr-1 inline h-3 w-3" />Liberada fora do horário{d.liberacao.previsto || d.liberacao.real ? ` (${d.liberacao.previsto || "—"} → ${d.liberacao.real || "—"}${d.liberacao.atrasoMin != null ? `, +${d.liberacao.atrasoMin} min` : ""})` : ""}
            : {d.liberacao.motivo || "motivo não informado"} <span className="font-normal text-muted-foreground">[{d.liberacao.responsavel}]</span>
            {d.liberacao.justificativa && <div className="line-clamp-2 font-normal text-muted-foreground">{d.liberacao.justificativa}</div>}
          </div>
        )}
        {d.choveuMasProduziu && <div className="text-xs text-sky-700">Choveu, mas houve produção</div>}
        {d.motivoTexto && d.categoria !== "Folga / Feriado" && <div className="line-clamp-2 text-xs text-muted-foreground" title={d.motivoTexto}>{d.motivoTexto}</div>}
      </td>
    </tr>
  );
}
