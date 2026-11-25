import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Moon, Sun } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import ChecklistSection, { type ChecklistResult } from "@/components/equipment/ChecklistSection";

const TZ = "America/Sao_Paulo";
const norm = (v: string) => (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

/** Hoje / hora no fuso de Brasília (a data do checklist é a do dia de operação). */
function agoraSP() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value || "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) % 24 };
}
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};

/** Tipo de checklist a partir do cadastro do equipamento. null = sem checklist configurado. */
export function checklistTypeForEquipment(eq: { tipo?: string | null; frota?: string | null }):
  { type: string; itemsType: string; truckType: string | null } | null {
  const t = norm(eq.tipo || "");
  const f = norm(eq.frota || "");
  if (t.includes("COMBOIO") || f.startsWith("CO")) return { type: "Caminhões", itemsType: "Comboio", truckType: "Comboio" };
  if (t.includes("CAMINHAO")) {
    const truckType = t.includes("BASCULANTE") ? "Basculante" : t.includes("PIPA") ? "Pipa" : t.includes("ESPARGIDOR") ? "Espargidor" : t.includes("CARROCERIA") ? "Carroceria" : null;
    return { type: "Caminhões", itemsType: "Caminhões", truckType };
  }
  if (t.includes("CAVALO") || t.includes("PRANCHA") || t.includes("REBOQUE") || t.includes("CARRETA")) return { type: "Carreta", itemsType: "Carreta", truckType: null };
  if (t.includes("FRESADORA")) return { type: "Fresadora", itemsType: "Fresadora", truckType: null };
  if (t.includes("BOBCAT")) return { type: "Bobcat", itemsType: "Bobcat", truckType: null };
  if (t.includes("ROLO")) return { type: "Rolo", itemsType: "Rolo", truckType: null };
  if (t.includes("VIBRO")) return { type: "Vibroacabadora", itemsType: "Vibroacabadora", truckType: null };
  if (t.includes("USINA") || t.includes("KMA")) return { type: "Usina KMA", itemsType: "Usina KMA", truckType: null };
  if (t.includes("RETROESCAVADEIRA")) return { type: "Retro", itemsType: "Linha Amarela", truckType: null };
  if (t === "VAN" || t.includes("MICRO") || t.includes("VEICULO")) return { type: "Veículo", itemsType: "Veículo", truckType: null };
  return null;
};

/** Grupo exibido ao operador (primeiro toque), sem digitação. */
export function groupLabelForEquipment(eq: { tipo?: string | null; frota?: string | null }): string | null {
  const cfg = checklistTypeForEquipment(eq);
  if (!cfg) return null;
  if (cfg.type === "Caminhões") return cfg.truckType === "Comboio" ? "Comboio" : cfg.truckType ? `Caminhão ${cfg.truckType}` : "Caminhões (outros)";
  if (cfg.type === "Retro") return "Retroescavadeira";
  if (cfg.type === "Carreta") return "Carreta / Cavalo / Prancha";
  if (cfg.type === "Veículo") return "Veículo / Van / Micro-ônibus";
  return cfg.type;
}

/** Chave do cadastro "Operadores Habilitados" (equipment_type_operators) para o equipamento. */
export function habilitacaoKey(eq: { tipo?: string | null; frota?: string | null }): string | null {
  const cfg = checklistTypeForEquipment(eq);
  if (!cfg) return null;
  return cfg.truckType === "Comboio" ? "Comboio" : cfg.type;
}

/** Vínculo automático (só leitura) quando profiles.employee_id ainda não foi preenchido:
 *  nome idêntico, ou nome do usuário contido no do funcionário/vice-versa — somente se o resultado for ÚNICO. */
function matchEmployeeByName(nome: string, employees: { id: string; name: string }[]): string | null {
  const n = norm(nome).replace(/\s+/g, " ");
  if (!n) return null;
  const exact = employees.filter((e) => norm(e.name).replace(/\s+/g, " ") === n);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;
  const tk = new Set(n.split(" "));
  const cand = employees.filter((e) => {
    const en = norm(e.name).replace(/\s+/g, " ");
    const et = new Set(en.split(" "));
    const sub = (a: Set<string>, b: Set<string>) => a.size >= 2 && [...a].every((x) => b.has(x));
    return sub(tk, et) || sub(et, tk);
  });
  return cand.length === 1 ? cand[0].id : null;
}

export default function ChecklistHome() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/");
  const { toast } = useToast();
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const companyId = profile?.company_id || null;
  const { permissions } = usePermissions();
  const { isSuperAdmin } = useCompanyModules();
  // Quem acompanha/administra (admin, Gestão de Frotas, Manutenção) pode fazer de qualquer equipamento.
  const verTudo = isSuperAdmin || !!(permissions as any)?.is_admin || !!(permissions as any)?.modulo_gestao_frotas || !!(permissions as any)?.modulo_manutencao;

  const now = useMemo(agoraSP, []);
  // Madrugada (até 5h) conta como turno noturno iniciado no dia anterior.
  const [period, setPeriod] = useState<"diurno" | "noturno">(now.hour >= 16 || now.hour < 5 ? "noturno" : "diurno");
  const date = period === "noturno" && now.hour < 5 ? addDays(now.date, -1) : now.date;

  const [fleet, setFleet] = useState("");
  const [grupo, setGrupo] = useState("");
  const [results, setResults] = useState<ChecklistResult[]>([]);
  const [enviando, setEnviando] = useState(false);

  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ["checklist-home-equipamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("equipamentos").select("id, frota, nome, tipo, status").order("frota");
      if (error) throw error;
      return ((data || []) as any[]).filter((e) => e.frota && !/inativ|baixa|vendid/i.test(String(e.status || "")));
    },
  });

  const { data: habil, isLoading: loadingHabil } = useQuery({
    queryKey: ["checklist-home-habilitacao", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const uid = session!.user.id;
      const { data: prof } = await (supabase as any).from("profiles").select("employee_id, nome_completo").eq("user_id", uid).maybeSingle();
      let employeeId: string | null = prof?.employee_id || null;
      let viaNome = false;
      if (!employeeId) {
        const { data: emps } = await (supabase as any).from("employees").select("id, name").eq("status", "ativo");
        employeeId = matchEmployeeByName(prof?.nome_completo || "", (emps || []) as any[]);
        viaNome = !!employeeId;
      }
      if (!employeeId) return { employeeId: null, tipos: [] as string[], viaNome };
      const { data: links } = await (supabase as any).from("equipment_type_operators").select("equipment_type").eq("funcionario_id", employeeId);
      return { employeeId, tipos: [...new Set(((links || []) as any[]).map((l) => l.equipment_type as string))], viaNome };
    },
  });
  const tiposPermitidos = useMemo(() => (verTudo ? null : new Set(habil?.tipos || [])), [verTudo, habil]);
  const equipamentosPermitidos = useMemo(
    () => equipamentos.filter((e: any) => { const k = habilitacaoKey(e); return !!k && (!tiposPermitidos || tiposPermitidos.has(k)); }),
    [equipamentos, tiposPermitidos],
  );

  const grupos = useMemo(() => {
    const m = new Map<string, number>();
    equipamentosPermitidos.forEach((e: any) => { const g = groupLabelForEquipment(e); if (g) m.set(g, (m.get(g) || 0) + 1); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [equipamentosPermitidos]);

  const opcoes = useMemo(
    () => equipamentosPermitidos.filter((e: any) => groupLabelForEquipment(e) === grupo),
    [equipamentosPermitidos, grupo],
  );

  const selecionado = useMemo(() => equipamentosPermitidos.find((e: any) => e.frota === fleet) || null, [equipamentosPermitidos, fleet]);
  const cfg = selecionado ? checklistTypeForEquipment(selecionado) : null;

  // Checklist já enviado hoje para esta frota/turno (não permite reenvio: preserva o horário real).
  const { data: existente, refetch } = useQuery({
    queryKey: ["checklist-home-existente", companyId, fleet, date, period],
    enabled: !!companyId && !!fleet,
    queryFn: async () => {
      const { data } = await (supabase as any).from("equipment_preop_checklists")
        .select("id, submitted_at").eq("company_id", companyId).eq("equipment_fleet", fleet.toUpperCase())
        .eq("date", date).eq("period", period).maybeSingle();
      return data as { id: string; submitted_at: string } | null;
    },
  });

  useEffect(() => { setResults([]); }, [fleet, period]);
  useEffect(() => { setFleet(""); }, [grupo]);
  // Só um tipo habilitado: já abre direto nele.
  useEffect(() => { if (grupos.length === 1 && grupo !== grupos[0][0]) setGrupo(grupos[0][0]); }, [grupos, grupo]);

  const enviar = async () => {
    if (!session?.user?.id || !companyId || !selecionado || !cfg) return;
    setEnviando(true);
    try {
      const valid = results.filter((r) => r.status != null && ["ok", "nao_ok", "na"].includes(r.status));
      if (valid.length === 0) { toast({ title: "Checklist vazio", description: "Marque os itens antes de enviar.", variant: "destructive" }); return; }
      if (valid.some((r) => r.status === "nao_ok" && !r.photoFile)) {
        toast({ title: "Foto obrigatória", description: "Todo item NÃO CONFORME exige foto.", variant: "destructive" }); return;
      }
      // INSERT (sem upsert): horário de envio é definido pelo servidor e o checklist não é sobrescrito.
      const { data: header, error: hErr } = await (supabase as any).from("equipment_preop_checklists").insert({
        company_id: companyId, equipment_fleet: String(selecionado.frota).trim().toUpperCase(),
        equipment_type: cfg.type, truck_type: cfg.truckType, date, period,
        operator_name: profile?.nome_completo || null, created_by: session.user.id,
      }).select("id, submitted_at").single();
      if (hErr) {
        if ((hErr as any).code === "23505") { toast({ title: "Checklist já enviado", description: "Esta frota já tem checklist neste turno.", variant: "destructive" }); refetch(); return; }
        throw hErr;
      }
      const rows: any[] = [];
      for (const r of valid) {
        let photoUrl: string | null = null;
        if (r.photoFile) {
          const path = `checklist/preop/${header.id}/${r.itemId}_${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage.from("checklist-fotos").upload(path, r.photoFile, { contentType: "image/jpeg", upsert: true });
          if (upErr) throw new Error("Falha ao enviar foto: " + upErr.message);
          photoUrl = supabase.storage.from("checklist-fotos").getPublicUrl(path).data.publicUrl;
        }
        rows.push({ preop_checklist_id: header.id, item_id: r.itemId, status: r.status, observation: r.observation || null, photo_url: photoUrl });
      }
      const { error: eErr } = await (supabase as any).from("equipment_preop_checklist_entries").insert(rows);
      if (eErr) {
        // Não deixa cabeçalho sem itens
        await (supabase as any).from("equipment_preop_checklists").delete().eq("id", header.id);
        throw new Error("Falha ao salvar itens: " + eErr.message);
      }
      toast({ title: "Checklist enviado", description: `${selecionado.frota} — ${period}` });
      setResults([]);
      refetch();
    } catch (e: any) {
      console.error("[ChecklistHome]", e);
      toast({ title: "Erro ao enviar checklist", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  const horaEnvio = existente ? new Date(existente.submitted_at).toLocaleString("pt-BR", { timeZone: TZ }) : null;

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={goBack} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-sm text-primary-foreground">WF Checklist</p>
          <p className="text-[11px] text-primary-foreground/80">Faça antes de operar. Não bloqueia o diário.</p>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        <div className="rdo-card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["diurno", "noturno"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`h-11 rounded-xl border font-display font-bold text-sm flex items-center justify-center gap-2 ${period === p ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
                {p === "diurno" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}{p === "diurno" ? "Diurno" : "Noturno"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Data: {date.split("-").reverse().join("/")} (definida pelo sistema). O horário de envio é registrado pelo servidor.</p>
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Tipo de equipamento</p>
            {(isLoading || loadingHabil) && <p className="text-xs text-muted-foreground">Carregando equipamentos...</p>}
            {!isLoading && !loadingHabil && grupos.length === 0 && (
              <p className="text-xs text-rose-600 font-semibold">
                {habil?.employeeId
                  ? "Você não está habilitado para nenhum equipamento com checklist. Fale com a Gestão de Frotas."
                  : "Seu usuário não está vinculado a um funcionário habilitado. Fale com a Gestão de Frotas."}
              </p>
            )}
            {!verTudo && habil?.employeeId && grupos.length > 0 && (
              <p className="text-[11px] text-muted-foreground">Mostrando apenas os equipamentos em que você está habilitado.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {grupos.map(([g, n]) => (
                <button key={g} onClick={() => setGrupo(g)}
                  className={`min-h-11 rounded-xl border px-2 py-2 text-left text-xs font-display font-bold ${grupo === g ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
                  {g}<span className="block text-[10px] font-normal opacity-70">{n} equipamento{n > 1 ? "s" : ""}</span>
                </button>
              ))}
            </div>
          </div>
          {grupo && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Frota</p>
              <Select value={fleet} onValueChange={setFleet}>
                <SelectTrigger><SelectValue placeholder="Selecione a frota..." /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((e: any) => <SelectItem key={e.id} value={e.frota}>{e.frota} — {e.nome || e.tipo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {fleet && existente && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-600">Checklist de {fleet} já enviado neste turno</p>
              <p className="text-[11px] text-muted-foreground">{horaEnvio}</p>
            </div>
          </div>
        )}

        {fleet && !existente && cfg && (
          <div className="rdo-card">
            <ChecklistSection
              equipmentType={cfg.itemsType}
              results={results}
              onChange={setResults}
              showEnviarButton
              onEnviarChecklist={enviar}
              enviando={enviando}
            />
          </div>
        )}

        {!fleet && (
          <div className="rdo-card flex items-center gap-3 text-sm text-muted-foreground">
            <ClipboardCheck className="w-5 h-5" /> Escolha o tipo de equipamento e a frota para abrir o checklist.
          </div>
        )}
        <button onClick={() => navigate("/equipamentos")} className="text-xs text-primary underline">Ir para o Diário de Equipamento</button>
      </div>
    </div>
  );
}
