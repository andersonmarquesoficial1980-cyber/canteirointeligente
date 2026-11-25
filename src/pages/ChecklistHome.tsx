import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useToast } from "@/hooks/use-toast";
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

export default function ChecklistHome() {
  const navigate = useNavigate();
  const goBack = useSmartBack("/");
  const { toast } = useToast();
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const companyId = profile?.company_id || null;

  const now = useMemo(agoraSP, []);
  // Madrugada (até 5h) conta como turno noturno iniciado no dia anterior.
  const [period, setPeriod] = useState<"diurno" | "noturno">(now.hour >= 16 || now.hour < 5 ? "noturno" : "diurno");
  const date = period === "noturno" && now.hour < 5 ? addDays(now.date, -1) : now.date;

  const [fleet, setFleet] = useState("");
  const [busca, setBusca] = useState("");
  const [results, setResults] = useState<ChecklistResult[]>([]);
  const [enviando, setEnviando] = useState(false);

  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ["checklist-home-equipamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("equipamentos").select("id, frota, tipo, status").order("frota");
      if (error) throw error;
      return ((data || []) as any[]).filter((e) => e.frota && !/inativ|baixa|vendid/i.test(String(e.status || "")));
    },
  });

  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return equipamentos
      .filter((e: any) => checklistTypeForEquipment(e))
      .filter((e: any) => !q || String(e.frota).toLowerCase().includes(q) || String(e.tipo || "").toLowerCase().includes(q));
  }, [equipamentos, busca]);

  const selecionado = useMemo(() => equipamentos.find((e: any) => e.frota === fleet) || null, [equipamentos, fleet]);
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
          <Input placeholder="Buscar frota (ex.: CB024)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Select value={fleet} onValueChange={setFleet}>
            <SelectTrigger><SelectValue placeholder={isLoading ? "Carregando frotas..." : "Selecione a frota..."} /></SelectTrigger>
            <SelectContent>
              {opcoes.map((e: any) => <SelectItem key={e.id} value={e.frota}>{e.frota} — {e.tipo}</SelectItem>)}
            </SelectContent>
          </Select>
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
            <ClipboardCheck className="w-5 h-5" /> Selecione a frota para abrir o checklist do equipamento.
          </div>
        )}
        <button onClick={() => navigate("/equipamentos")} className="text-xs text-primary underline">Ir para o Diário de Equipamento</button>
      </div>
    </div>
  );
}
