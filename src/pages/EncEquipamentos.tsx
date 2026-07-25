import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, HardHat, Loader2 } from "lucide-react";

interface DiarioEquip {
  id: string;
  frota: string;
  tipo: string;
  sub_tipo?: string;
  obra_nome?: string;
  data: string;
  operator_name?: string;
  ogs_number?: string;
}

interface RdoBase {
  id: string;
  data: string | null;
  obra_nome: string | null;
  encarregado?: string | null;
  responsavel?: string | null;
}

function normTxt(v: string | null | undefined): string {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function EncEquipamentos() {
  const navigate = useNavigate();
  const [diarios, setDiarios] = useState<DiarioEquip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("nome_completo, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prof?.company_id) {
        setLoading(false);
        return;
      }

      // Resolve nome canônico na tabela employees (mesma estratégia das telas de validação)
      const profileFullName = (prof.nome_completo || "").trim();
      const nameParts = profileFullName
        .split(/\s+/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 2);

      let nomeCanonicoEncarregado: string | null = null;
      if (nameParts.length >= 2) {
        const primeiro = nameParts[0];
        const ultimo = nameParts[nameParts.length - 1];
        const { data: emp } = await (supabase as any)
          .from("employees")
          .select("name")
          .eq("company_id", prof.company_id)
          .ilike("name", `%${primeiro}%`)
          .ilike("name", `%${ultimo}%`)
          .maybeSingle();
        nomeCanonicoEncarregado = (emp?.name || "").trim() || null;
      }

      const nomesResponsavel = Array.from(
        new Set(
          [profileFullName, nomeCanonicoEncarregado]
            .map((n) => (n || "").trim())
            .filter(Boolean),
        ),
      );

      // 1) Buscar RDOs onde o usuário é encarregado/responsável
      const rdoQueries: Promise<any>[] = [];
      nomesResponsavel.forEach((nome) => {
        rdoQueries.push(
          (supabase as any)
            .from("rdo_diarios")
            .select("id,data,obra_nome,encarregado,responsavel")
            .eq("company_id", prof.company_id)
            .ilike("encarregado", nome)
            .order("data", { ascending: false })
            .range(0, 4999),
        );
        rdoQueries.push(
          (supabase as any)
            .from("rdo_diarios")
            .select("id,data,obra_nome,encarregado,responsavel")
            .eq("company_id", prof.company_id)
            .ilike("responsavel", nome)
            .order("data", { ascending: false })
            .range(0, 4999),
        );
      });

      if (rdoQueries.length === 0) {
        setDiarios([]);
        setLoading(false);
        return;
      }

      const rdoResults = await Promise.all(rdoQueries);
      const rdoById = new Map<string, RdoBase>();
      rdoResults.forEach((res) => {
        (res?.data || []).forEach((r: RdoBase) => {
          if (r?.id && !rdoById.has(r.id)) rdoById.set(r.id, r);
        });
      });

      const rdos = Array.from(rdoById.values());
      if (rdos.length === 0) {
        setDiarios([]);
        setLoading(false);
        return;
      }

      const rdoIds = rdos.map((r) => r.id);
      const rdoByKey = new Map<string, RdoBase[]>();
      const rdoSetById = new Set<string>(rdoIds);

      // 2) Buscar equipamentos lançados no RDO (fonte principal)
      const rdoEquipamentosRows: any[] = [];
      const chunksRdo = chunkArray(rdoIds, 150);
      for (const ids of chunksRdo) {
        const { data } = await (supabase as any)
          .from("rdo_equipamentos")
          .select("rdo_id,frota,tipo,sub_tipo")
          .eq("company_id", prof.company_id)
          .in("rdo_id", ids);
        rdoEquipamentosRows.push(...(data || []));
      }

      // Mapeia pares (data + frota) vindos de rdo_equipamentos
      const fleetDayKeys = new Set<string>();
      const rdoWithEquipSet = new Set<string>();

      rdoEquipamentosRows.forEach((eq: any) => {
        if (!eq?.rdo_id || !eq?.frota) return;
        const rdo = rdoById.get(eq.rdo_id);
        if (!rdo?.data) return;

        const key = `${rdo.data}|${normTxt(eq.frota)}`;
        fleetDayKeys.add(key);
        rdoWithEquipSet.add(eq.rdo_id);

        const existing = rdoByKey.get(key) || [];
        if (!existing.some((x) => x.id === rdo.id)) {
          existing.push(rdo);
          rdoByKey.set(key, existing);
        }
      });

      // 3) Fallback histórico: RDO sem itens em rdo_equipamentos
      // tenta casar por (data + ogs_number == obra_nome) direto em equipment_diaries
      const rdosSemEquip = rdos.filter((r) => !rdoWithEquipSet.has(r.id));
      if (rdosSemEquip.length > 0) {
        const ogsSet = new Set<string>();
        const dateSet = new Set<string>();
        const keyDataOgs = new Set<string>();

        rdosSemEquip.forEach((r) => {
          const data = (r.data || "").trim();
          const ogs = (r.obra_nome || "").trim();
          if (!data || !ogs) return;
          dateSet.add(data);
          ogsSet.add(ogs);
          keyDataOgs.add(`${data}|${normTxt(ogs)}`);
        });

        const ogsList = Array.from(ogsSet);
        const dateList = Array.from(dateSet).sort();

        if (ogsList.length > 0 && dateList.length > 0) {
          const minDate = dateList[0];
          const maxDate = dateList[dateList.length - 1];

          const edRowsFallback: any[] = [];
          const chunksOgs = chunkArray(ogsList, 80);
          for (const ogsChunk of chunksOgs) {
            const { data } = await (supabase as any)
              .from("equipment_diaries")
              .select("id,date,equipment_fleet,ogs_number,equipment_type,operator_name")
              .eq("company_id", prof.company_id)
              .gte("date", minDate)
              .lte("date", maxDate)
              .in("ogs_number", ogsChunk)
              .order("date", { ascending: false })
              .range(0, 4999);
            edRowsFallback.push(...(data || []));
          }

          edRowsFallback.forEach((ed: any) => {
            const data = (ed?.date || "").trim();
            const ogs = (ed?.ogs_number || "").trim();
            const frota = (ed?.equipment_fleet || "").trim();
            if (!data || !ogs || !frota) return;

            const matchKey = `${data}|${normTxt(ogs)}`;
            if (!keyDataOgs.has(matchKey)) return;

            const key = `${data}|${normTxt(frota)}`;
            fleetDayKeys.add(key);

            const rdosMatch = rdosSemEquip.filter((r) => (r.data || "") === data && normTxt(r.obra_nome) === normTxt(ogs));
            if (rdosMatch.length > 0) {
              const existing = rdoByKey.get(key) || [];
              rdosMatch.forEach((r) => {
                if (!existing.some((x) => x.id === r.id)) existing.push(r);
              });
              rdoByKey.set(key, existing);
            }
          });
        }
      }

      if (fleetDayKeys.size === 0) {
        setDiarios([]);
        setLoading(false);
        return;
      }

      // 4) Busca diários de equipamento e mantém só os pares (data+frota) vinculados ao encarregado pelos RDOs
      const frotaSet = new Set<string>();
      const dateSet = new Set<string>();
      fleetDayKeys.forEach((k) => {
        const [date, frotaNorm] = k.split("|");
        if (date) dateSet.add(date);
        if (frotaNorm) frotaSet.add(frotaNorm);
      });

      const dates = Array.from(dateSet).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      const diaryRows: any[] = [];
      const fleetNormList = Array.from(frotaSet);

      // Para evitar depender de função SQL, busca por data/company e filtra frota em memória
      const { data: allByDate } = await (supabase as any)
        .from("equipment_diaries")
        .select("id,date,equipment_fleet,equipment_type,ogs_number,operator_name")
        .eq("company_id", prof.company_id)
        .gte("date", minDate)
        .lte("date", maxDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(0, 4999);

      (allByDate || []).forEach((d: any) => {
        const frotaNorm = normTxt(d?.equipment_fleet);
        if (!fleetNormList.includes(frotaNorm)) return;
        const key = `${d?.date || ""}|${frotaNorm}`;
        if (!fleetDayKeys.has(key)) return;
        diaryRows.push(d);
      });

      const resultado: DiarioEquip[] = diaryRows.map((d: any) => {
        const key = `${d?.date || ""}|${normTxt(d?.equipment_fleet)}`;
        const rdosDoPar = rdoByKey.get(key) || [];
        const obras = Array.from(
          new Set(
            rdosDoPar
              .map((r) => (r?.obra_nome || "").trim())
              .filter(Boolean),
          ),
        );

        return {
          id: d.id,
          frota: d.equipment_fleet || "-",
          tipo: d.equipment_type || "-",
          sub_tipo: d.equipment_type || undefined,
          obra_nome: obras.length > 0 ? obras.join(" • ") : (d.ogs_number || undefined),
          data: d.date,
          operator_name: d.operator_name || undefined,
          ogs_number: d.ogs_number || undefined,
        };
      });

      const seen = new Set<string>();
      const unicos = resultado.filter((d) => {
        if (!d?.id || seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });

      setDiarios(unicos);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/encarregado")} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Equipamentos da Equipe</h1>
            <p className="text-xs text-muted-foreground">Diários das suas obras</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : diarios.length === 0 ? (
          <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground text-center">
            Nenhum diário de equipamento encontrado para suas obras.
          </div>
        ) : (
          <div className="space-y-2">
            {diarios.map(d => (
              <div key={d.id} className="p-3 rounded-xl bg-white border border-border shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{d.frota}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {(d.sub_tipo || d.tipo) && (
                    <span className="bg-muted px-2 py-0.5 rounded-full">{d.sub_tipo || d.tipo}</span>
                  )}
                  {d.obra_nome && <span>{d.obra_nome}</span>}
                  {d.operator_name && <span>· {d.operator_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
