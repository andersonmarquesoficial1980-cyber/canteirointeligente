import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckSquare, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Pendencia {
  employee_id: string; nome: string; matricula: string | null; funcao: string | null; equipe: string | null;
  ultima_ogs: string | null; ultima_data: string | null; ultima_equipe_rdo: string | null;
}
interface Alocado {
  id: string; tipo: string; ogs_number: string | null; entrada: string | null; saida: string | null;
  observacao: string | null; employees: { name: string; equipe: string | null } | null;
}

export const TIPOS_ALOCACAO: Record<string, string> = {
  obra: "Em obra (OGS)", base: "Base Osasco", disponivel: "Disponível (aguardando convocação)",
  falta: "Falta", folga: "Folga", atestado: "Atestado", ferias: "Férias",
};

const ontem = () => { const d = new Date(Date.now() - 86400000); return d.toLocaleDateString("sv-SE"); };
const fmt = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");

export default function ProgramadorPendencias() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/programador");
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const companyId = profile?.company_id || null;

  const [data, setData] = useState(ontem());
  const [loading, setLoading] = useState(false);
  const [pend, setPend] = useState<Pendencia[]>([]);
  const [alocados, setAlocados] = useState<Alocado[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState("");
  const [ogsList, setOgsList] = useState<{ ogs_number: string; client_name: string | null }[]>([]);

  const [tipo, setTipo] = useState("obra");
  const [ogs, setOgs] = useState("");
  const [entrada, setEntrada] = useState("");
  const [saida, setSaida] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    (supabase as any).from("ogs_reference").select("ogs_number, client_name").eq("company_id", companyId).order("ogs_number")
      .then(({ data }: any) => setOgsList((data || []).filter((o: any) => o.ogs_number)));
  }, [companyId]);

  const carregar = useCallback(async () => {
    if (!companyId || !data) return;
    setLoading(true);
    setSel(new Set());
    const [p, a] = await Promise.all([
      (supabase as any).rpc("programador_pendencias", { p_company_id: companyId, p_data: data }),
      (supabase as any).from("alocacao_diaria")
        .select("id, tipo, ogs_number, entrada, saida, observacao, employees(name, equipe)")
        .eq("company_id", companyId).eq("data", data).order("criado_em", { ascending: false }),
    ]);
    if (p.error) toast({ title: "Erro ao carregar pendências", description: p.error.message, variant: "destructive" });
    setPend(p.data || []);
    setAlocados(a.data || []);
    setLoading(false);
  }, [companyId, data, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    if (!f) return pend;
    return pend.filter(p => [p.nome, p.matricula, p.funcao, p.equipe, p.ultima_ogs].some(v => (v || "").toLowerCase().includes(f)));
  }, [pend, filtro]);

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosSel = visiveis.length > 0 && visiveis.every(p => sel.has(p.employee_id));
  const toggleTodos = () => setSel(todosSel ? new Set() : new Set(visiveis.map(p => p.employee_id)));

  const aplicar = async (ids: string[], t: string, o: string) => {
    const { error } = await (supabase as any).rpc("programador_alocar_lote", {
      p_company_id: companyId, p_data: data, p_employee_ids: ids, p_tipo: t,
      p_ogs_number: t === "obra" ? o : null, p_entrada: entrada || null, p_saida: saida || null, p_obs: obs || null,
    });
    if (error) throw error;
  };

  const aplicarSelecionados = async () => {
    if (sel.size === 0) return;
    if (tipo === "obra" && !ogs) { toast({ title: "Escolha a OGS", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await aplicar(Array.from(sel), tipo, ogs);
      toast({ title: `${sel.size} funcionário(s) alocado(s)` });
      await carregar();
    } catch (e: any) { toast({ title: "Erro ao alocar", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  // Usa a última OGS conhecida de cada um (agrupa por OGS)
  const aplicarUltimaOgs = async () => {
    const alvos = pend.filter(p => sel.has(p.employee_id) && p.ultima_ogs);
    if (alvos.length === 0) { toast({ title: "Nenhum selecionado tem OGS anterior", variant: "destructive" }); return; }
    const cadastradas = new Set(ogsList.map(o => o.ogs_number));
    const porOgs = new Map<string, string[]>();
    let ignorados = 0;
    alvos.forEach(p => {
      const k = (p.ultima_ogs || "").trim();
      if (!cadastradas.has(k)) { ignorados++; return; }
      porOgs.set(k, [...(porOgs.get(k) || []), p.employee_id]);
    });
    setSaving(true);
    try {
      for (const [k, ids] of porOgs) await aplicar(ids, "obra", k);
      toast({ title: "Alocados pela última OGS", description: ignorados ? `${ignorados} ignorado(s): OGS anterior não cadastrada.` : undefined });
      await carregar();
    } catch (e: any) { toast({ title: "Erro ao alocar", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  const remover = async (id: string) => {
    if (!window.confirm("Remover esta alocação? O funcionário volta a ficar pendente neste dia.")) return;
    const { error } = await (supabase as any).rpc("programador_remover_alocacao", { p_id: id });
    if (error) toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    else carregar();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Pendências de Alocação</h1>
            <p className="text-xs text-muted-foreground">Funcionários que não aparecem em nenhum RDO neste dia</p>
          </div>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} className="w-44 h-10" />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{loading ? "Carregando..." : `${pend.length} pendente(s) em ${fmt(data)}`}</span>
            <span className="text-xs text-muted-foreground">{sel.size} selecionado(s)</span>
            <Input placeholder="Filtrar por nome, função, equipe, OGS..." value={filtro} onChange={e => setFiltro(e.target.value)} className="h-9 max-w-xs ml-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Alocar como</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="h-10 w-full px-2 bg-secondary border border-border rounded-md text-sm">
                {Object.entries(TIPOS_ALOCACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {tipo === "obra" && (
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">OGS (cadastrada)</label>
                <select value={ogs} onChange={e => setOgs(e.target.value)} className="h-10 w-full px-2 bg-secondary border border-border rounded-md text-sm">
                  <option value="">Selecione...</option>
                  {ogsList.map(o => <option key={o.ogs_number} value={o.ogs_number}>{o.ogs_number}{o.client_name ? ` — ${o.client_name}` : ""}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Entrada</label>
              <Input type="time" value={entrada} onChange={e => setEntrada(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Saída</label>
              <Input type="time" value={saida} onChange={e => setSaida(e.target.value)} className="h-10" />
            </div>
            <div className="md:col-span-4">
              <Input placeholder="Observação (opcional)" value={obs} onChange={e => setObs(e.target.value)} className="h-10" maxLength={500} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={aplicarSelecionados} disabled={saving || sel.size === 0} className="flex-1">Aplicar aos selecionados</Button>
              <Button onClick={aplicarUltimaOgs} disabled={saving || sel.size === 0} variant="outline" title="Usa a última OGS em que cada um apareceu em RDO">Última OGS</Button>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-2 w-8"><button onClick={toggleTodos} title="Selecionar todos"><CheckSquare className={`w-4 h-4 ${todosSel ? "text-primary" : "text-muted-foreground"}`} /></button></th>
                {["Funcionário", "Função", "Equipe (cadastro)", "Última OGS em RDO", "Última equipe no RDO"].map(h => <th key={h} className="text-left px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{loading ? "Carregando..." : "Nenhuma pendência para este dia."}</td></tr>}
              {visiveis.map((p, i) => (
                <tr key={p.employee_id} onClick={() => toggle(p.employee_id)} className={`cursor-pointer ${sel.has(p.employee_id) ? "bg-primary/10" : i % 2 ? "bg-muted/20" : ""}`}>
                  <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(p.employee_id)} onChange={() => toggle(p.employee_id)} onClick={e => e.stopPropagation()} /></td>
                  <td className="px-2 py-1.5 font-semibold">{p.nome}{p.matricula && <span className="block text-[10px] font-normal text-muted-foreground">Mat. {p.matricula}</span>}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.funcao || "-"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.equipe || "-"}</td>
                  <td className="px-2 py-1.5">{p.ultima_ogs ? <><span className="font-semibold text-primary">{p.ultima_ogs}</span> <span className="text-muted-foreground">({fmt(p.ultima_data)})</span></> : <span className="text-muted-foreground">sem RDO nos últimos 30 dias</span>}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.ultima_equipe_rdo || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {alocados.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <p className="px-3 py-2 text-sm font-semibold border-b">Já alocados em {fmt(data)} ({alocados.length})</p>
            <table className="w-full text-xs">
              <tbody>
                {alocados.map(a => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-semibold">{a.employees?.name || "-"}</td>
                    <td className="px-2 py-1.5">{TIPOS_ALOCACAO[a.tipo] || a.tipo}{a.ogs_number ? ` · ${a.ogs_number}` : ""}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{[a.entrada, a.saida].filter(Boolean).join(" – ")}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{a.observacao || ""}</td>
                    <td className="px-2 py-1.5 text-right"><button onClick={() => remover(a.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
