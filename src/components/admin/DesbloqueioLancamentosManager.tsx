import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Unlock, Search, X } from "lucide-react";

type Tipo = "equipamento" | "rdo";
type TipoSel = Tipo | "ambos";

const TIPO_LABEL: Record<Tipo, string> = { equipamento: "Diário de Equipamento", rdo: "RDO" };
const MAX_LOTE = 2000;

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtBR = (iso: string) => {
  const [y, m, d] = (iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "--/--/----";
};

const fmtCurta = (iso: string) => fmtBR(iso).slice(0, 5);

function eachDay(start: string, end: string, incluirFimDeSemana: boolean): string[] {
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last && out.length <= MAX_LOTE) {
    const dow = cur.getDay();
    if (incluirFimDeSemana || (dow !== 0 && dow !== 6)) out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function DesbloqueioLancamentosManager() {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [unlocks, setUnlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // formulário
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [incluirFds, setIncluirFds] = useState(true);
  const [tipo, setTipo] = useState<TipoSel>("equipamento");

  // lista
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [confirmRevogar, setConfirmRevogar] = useState<{ ids: string[]; label: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      let cid = (profile as any)?.company_id || null;
      if (!cid && (profile as any)?.role === "superadmin") {
        const { data: firstCompany } = await supabase
          .from("companies" as any)
          .select("id")
          .order("created_at")
          .limit(1)
          .maybeSingle();
        cid = (firstCompany as any)?.id || null;
      }

      if (!cid) {
        toast({ title: "Empresa não encontrada", description: "Não foi possível identificar a empresa ativa.", variant: "destructive" });
        return;
      }
      setCompanyId(cid);

      const fetchAllUnlocks = async () => {
        const all: any[] = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await (supabase as any)
            .from("diary_unlock_requests")
            .select("id, user_id, data_liberada, tipo, created_at")
            .eq("company_id", cid)
            .order("data_liberada", { ascending: false })
            .order("id")
            .range(from, from + PAGE - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < PAGE) break;
        }
        return all;
      };

      const [{ data: profilesData }, unlockData] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nome_completo, perfil, role, status")
          .eq("company_id", cid)
          .order("nome_completo"),
        fetchAllUnlocks(),
      ]);

      setUsers((profilesData || []) as any[]);
      setUnlocks((unlockData || []) as any[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar", description: err.message || "Falha ao carregar desbloqueios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usersById = useMemo(() => {
    const acc: Record<string, any> = {};
    users.forEach((u) => { acc[u.user_id] = u; });
    return acc;
  }, [users]);

  const usuariosFiltrados = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return q ? users.filter((u) => (u.nome_completo || "").toLowerCase().includes(q)) : users;
  }, [users, userSearch]);

  const tiposAlvo: Tipo[] = tipo === "ambos" ? ["equipamento", "rdo"] : [tipo];
  const dias = useMemo(() => eachDay(dataInicio, dataFim, incluirFds), [dataInicio, dataFim, incluirFds]);

  const existentes = useMemo(() => {
    const s = new Set<string>();
    unlocks.forEach((u) => s.add(`${u.user_id}|${u.data_liberada}|${u.tipo}`));
    return s;
  }, [unlocks]);

  // combinações novas (ignora as que já existem)
  const novas = useMemo(() => {
    const out: { user_id: string; data_liberada: string; tipo: Tipo }[] = [];
    for (const uid of selectedUserIds) {
      for (const d of dias) {
        for (const t of tiposAlvo) {
          if (!existentes.has(`${uid}|${d}|${t}`)) out.push({ user_id: uid, data_liberada: d, tipo: t });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserIds, dias, tipo, existentes]);

  const totalCombinacoes = selectedUserIds.length * dias.length * tiposAlvo.length;
  const jaLiberadas = totalCombinacoes - novas.length;

  const toggleUser = (id: string) =>
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selecionarVisiveis = () =>
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...usuariosFiltrados.map((u) => u.user_id)])));

  const setPeriodo = (inicio: Date, fim: Date) => {
    setDataInicio(toISO(inicio));
    setDataFim(toISO(fim));
  };

  const presets = useMemo(() => {
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const d7 = new Date(hoje); d7.setDate(hoje.getDate() - 6);
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const iniAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return [
      { label: "Hoje", fn: () => setPeriodo(hoje, hoje) },
      { label: "Ontem", fn: () => setPeriodo(ontem, ontem) },
      { label: "Últimos 7 dias", fn: () => setPeriodo(d7, hoje) },
      { label: "Do dia 1 até hoje", fn: () => setPeriodo(ini, hoje) },
      { label: "Mês anterior", fn: () => setPeriodo(iniAnt, fimAnt) },
    ];
  }, []);

  const handleLiberar = async () => {
    if (!companyId) return;
    if (selectedUserIds.length === 0 || !dataInicio || !dataFim) {
      toast({ title: "Campos obrigatórios", description: "Selecione ao menos um usuário e o período.", variant: "destructive" });
      return;
    }
    if (dataInicio > dataFim) {
      toast({ title: "Período inválido", description: "A data inicial é maior que a final.", variant: "destructive" });
      return;
    }
    if (dias.length > 62) {
      toast({ title: "Período muito longo", description: "Libere no máximo 62 dias por vez.", variant: "destructive" });
      return;
    }
    if (novas.length === 0) {
      toast({ title: "Nada a liberar", description: "Todas as datas selecionadas já estão liberadas." });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        return;
      }

      const rows = novas.map((n) => ({ ...n, company_id: companyId, liberado_por: user.id }));
      let falhas = 0;
      let inseridas = 0;
      let ultimoErro = "";

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await (supabase as any).from("diary_unlock_requests").insert(chunk);
        if (!error) { inseridas += chunk.length; continue; }

        // duplicidade no lote: reinsere linha a linha ignorando 23505
        for (const row of chunk) {
          const { error: e2 } = await (supabase as any).from("diary_unlock_requests").insert(row);
          if (!e2 || e2.code === "23505") { if (!e2) inseridas++; }
          else { falhas++; ultimoErro = e2.message; }
        }
      }

      if (falhas > 0) {
        toast({ title: `Liberado parcialmente (${inseridas} ok, ${falhas} falhas)`, description: ultimoErro, variant: "destructive" });
      } else {
        toast({ title: `✅ ${inseridas} liberação(ões) criada(s)`, description: jaLiberadas > 0 ? `${jaLiberadas} já existiam e foram ignoradas.` : undefined });
      }
      setSelectedUserIds([]);
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro ao liberar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const executarRevogacao = async () => {
    if (!confirmRevogar) return;
    const { ids } = confirmRevogar;
    setConfirmRevogar(null);
    let erro = "";
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await (supabase as any)
        .from("diary_unlock_requests")
        .delete()
        .in("id", ids.slice(i, i + 100));
      if (error) { erro = error.message; break; }
    }
    if (erro) {
      toast({ title: "Erro ao revogar", description: erro, variant: "destructive" });
    } else {
      toast({ title: `✅ ${ids.length} liberação(ões) revogada(s)` });
    }
    await loadData();
  };

  // lista agrupada por usuário + tipo
  const grupos = useMemo(() => {
    const q = filtroUsuario.trim().toLowerCase();
    const map = new Map<string, { user_id: string; tipo: Tipo; itens: { id: string; data: string }[] }>();
    unlocks.forEach((u) => {
      const nome = (usersById[u.user_id]?.nome_completo || "").toLowerCase();
      if (q && !nome.includes(q)) return;
      const key = `${u.user_id}|${u.tipo}`;
      if (!map.has(key)) map.set(key, { user_id: u.user_id, tipo: u.tipo, itens: [] });
      map.get(key)!.itens.push({ id: u.id, data: u.data_liberada });
    });
    return Array.from(map.values())
      .map((g) => ({ ...g, itens: g.itens.sort((a, b) => a.data.localeCompare(b.data)) }))
      .sort((a, b) =>
        (usersById[a.user_id]?.nome_completo || "").localeCompare(usersById[b.user_id]?.nome_completo || "") ||
        a.tipo.localeCompare(b.tipo));
  }, [unlocks, usersById, filtroUsuario]);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        {/* Usuários */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">
              Usuários ({selectedUserIds.length} selecionado{selectedUserIds.length === 1 ? "" : "s"})
            </Label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={selecionarVisiveis}>Selecionar visíveis</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedUserIds([])} disabled={selectedUserIds.length === 0}>Limpar</Button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar usuário..."
              className="h-11 pl-9 bg-secondary border-border"
            />
          </div>
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUserIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {usersById[id]?.nome_completo || "Usuário"}
                  <button type="button" onClick={() => toggleUser(id)} aria-label="Remover">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-secondary/40 divide-y divide-border">
            {usuariosFiltrados.map((u) => (
              <label key={u.user_id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary text-sm">
                <Checkbox checked={selectedUserIds.includes(u.user_id)} onCheckedChange={() => toggleUser(u.user_id)} />
                <span className="text-foreground">{u.nome_completo}</span>
              </label>
            ))}
            {usuariosFiltrados.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
            )}
          </div>
        </div>

        {/* Período */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.label} type="button" variant="outline" size="sm" onClick={p.fn}>{p.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data inicial</Label>
              <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); if (!dataFim || e.target.value > dataFim) setDataFim(e.target.value); }} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data final</Label>
              <Input type="date" value={dataFim} min={dataInicio || undefined} onChange={(e) => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoSel)}>
                <SelectTrigger className="h-11 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipamento">Diário de Equipamento</SelectItem>
                  <SelectItem value="rdo">RDO</SelectItem>
                  <SelectItem value="ambos">Ambos (Diário + RDO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer w-fit">
            <Checkbox checked={incluirFds} onCheckedChange={(v) => setIncluirFds(v === true)} />
            Incluir sábados e domingos
          </label>
        </div>

        {/* Resumo */}
        <div className="rounded-lg bg-secondary/60 border border-border px-3 py-2 text-sm text-foreground">
          {totalCombinacoes === 0 ? (
            <span className="text-muted-foreground">Selecione usuários e período para ver o resumo.</span>
          ) : (
            <>
              <strong>{selectedUserIds.length}</strong> usuário(s) × <strong>{dias.length}</strong> dia(s)
              {dataInicio && dataFim && <> ({fmtCurta(dataInicio)} a {fmtCurta(dataFim)})</>} × <strong>{tiposAlvo.length}</strong> tipo(s)
              {" = "}<strong>{novas.length}</strong> nova(s) liberação(ões)
              {jaLiberadas > 0 && <span className="text-muted-foreground"> · {jaLiberadas} já liberada(s), serão ignoradas</span>}
            </>
          )}
        </div>

        <Button onClick={handleLiberar} disabled={saving || novas.length === 0} className="w-full h-11 gap-2">
          <Unlock className="w-4 h-4" />
          {saving ? "Liberando..." : novas.length > 0 ? `Liberar ${novas.length} lançamento(s)` : "Liberar"}
        </Button>
      </div>

      {/* Lista */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} placeholder="Filtrar liberações por usuário..." className="h-10 pl-9" />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{unlocks.length} liberação(ões) ativa(s)</span>
      </div>

      <div className="space-y-2">
        {grupos.map((g) => {
          const nome = usersById[g.user_id]?.nome_completo || "Usuário";
          return (
            <div key={`${g.user_id}|${g.tipo}`} className="bg-card rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm text-foreground">{nome}</p>
                  <p className="text-xs text-muted-foreground">{TIPO_LABEL[g.tipo] || g.tipo} • {g.itens.length} dia(s)</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmRevogar({ ids: g.itens.map((i) => i.id), label: `${g.itens.length} liberação(ões) de ${nome} (${TIPO_LABEL[g.tipo]})` })}
                >
                  Revogar todas
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.itens.map((i) => (
                  <Badge key={i.id} variant="outline" className="gap-1 pr-1 font-normal">
                    {fmtBR(i.data)}
                    <button
                      type="button"
                      aria-label={`Revogar ${fmtBR(i.data)}`}
                      className="hover:text-destructive"
                      onClick={() => setConfirmRevogar({ ids: [i.id], label: `${fmtBR(i.data)} de ${nome} (${TIPO_LABEL[g.tipo]})` })}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
        {grupos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma liberação cadastrada.</p>
        )}
      </div>

      <AlertDialog open={!!confirmRevogar} onOpenChange={(o) => !o && setConfirmRevogar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar liberação?</AlertDialogTitle>
            <AlertDialogDescription>Será revogado: {confirmRevogar?.label}. O lançamento volta a seguir o prazo normal.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executarRevogacao}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
