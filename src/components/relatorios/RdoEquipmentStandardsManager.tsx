import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Standard = { id: string; equipe: string; tipo: string; ativo: boolean };

// PostgREST defaults to 1,000 rows; read the entire company catalog before presenting choices.
async function readCatalog(table: "employees" | "equipamentos" | "rdo_equipamento_padroes", fields: string, companyId: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await (supabase as any).from(table).select(fields)
      .eq("company_id", companyId)
      .order(table === "employees" ? "equipe" : table === "equipamentos" ? "tipo" : "id")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 500) return rows;
    if (rows.length >= 30000) throw new Error("Catálogo muito grande; refine a consulta antes de configurar os padrões.");
  }
}

const message = (cause: unknown) => cause instanceof Error ? cause.message : "Não foi possível carregar ou salvar os padrões.";
const unique = (values: Array<string | null | undefined>) => [...new Set(values.map(value => value?.trim()).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, "pt-BR"));

export default function RdoEquipmentStandardsManager({ companyId, userId }: { companyId: string; userId: string }) {
  const [authorizedFor, setAuthorizedFor] = useState("");
  const [teams, setTeams] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [team, setTeam] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scope = `${companyId}:${userId}`;
  const isAdmin = authorizedFor === scope;

  useEffect(() => {
    let cancelled = false;
    setAuthorizedFor(""); setTeams([]); setTypes([]); setStandards([]); setTeam(""); setType(""); setError("");
    async function initialize() {
      const { data, error } = await supabase.from("user_permissions").select("is_admin")
        .eq("company_id", companyId).eq("user_id", userId).maybeSingle();
      if (cancelled || error || !data?.is_admin) return;
      setAuthorizedFor(scope);
      setLoading(true);
      try {
        const [employees, equipment, configured] = await Promise.all([
          readCatalog("employees", "id,equipe", companyId),
          readCatalog("equipamentos", "id,tipo", companyId),
          readCatalog("rdo_equipamento_padroes", "id,equipe,tipo,ativo", companyId),
        ]);
        if (cancelled) return;
        const teamNames = unique(employees.map(row => row.equipe));
        setTeams(teamNames);
        setTypes(unique(equipment.map(row => row.tipo)));
        setStandards(configured);
        setTeam(teamNames[0] || "");
      } catch (cause) {
        if (!cancelled) setError(message(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [companyId, userId, scope]);

  async function save(tipo: string, ativo: boolean, id?: string) {
    if (!isAdmin || !team || !tipo || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      // Only a known catalog type can be added; removal is an update, never a DELETE.
      if (!id && !types.includes(tipo)) throw new Error("Selecione um tipo cadastrado em Equipamentos.");
      const { error } = id
        ? await (supabase as any).from("rdo_equipamento_padroes").update({ ativo }).eq("company_id", companyId).eq("id", id)
        : await (supabase as any).from("rdo_equipamento_padroes").upsert(
          { company_id: companyId, equipe: team, tipo, ativo: true },
          { onConflict: "company_id,equipe,tipo" },
        );
      if (error) throw error;
      const refreshed = await readCatalog("rdo_equipamento_padroes", "id,equipe,tipo,ativo", companyId);
      setStandards(refreshed);
      setType(""); setNotice(ativo ? "Padrão salvo." : "Padrão desativado.");
    } catch (cause) {
      setError(message(cause));
    } finally { setSaving(false); }
  }

  if (!isAdmin) return null;
  const current = standards.filter(row => row.equipe === team && row.ativo);
  const available = types.filter(tipo => !current.some(row => row.tipo === tipo));
  return <details className="rounded-xl border p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Padrões de equipamentos por equipe</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">Configuração explícita de tipos esperados no RDO; nenhuma equipe recebe padrões automaticamente.</p>
      {loading && <p>Carregando equipes e equipamentos...</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!loading && <>
        <div className="flex flex-wrap items-end gap-3">
          <label>Equipe<select aria-label="Equipe para padrões" className="block h-10 rounded-md border bg-background px-3" value={team} onChange={event => { setTeam(event.target.value); setType(""); setNotice(""); }}>
            {!team && <option value="">Selecione</option>}{teams.map(name => <option key={name} value={name}>{name}</option>)}
          </select></label>
          <label>Tipo de equipamento<select aria-label="Tipo de equipamento para adicionar" className="block h-10 rounded-md border bg-background px-3" value={type} onChange={event => setType(event.target.value)} disabled={!team || !available.length || saving}>
            <option value="">Selecione</option>{available.map(name => <option key={name} value={name}>{name}</option>)}
          </select></label>
          <Button size="sm" disabled={!team || !type || saving} onClick={() => void save(type, true)}>Adicionar tipo</Button>
        </div>
        {!teams.length && <p>Nenhuma equipe cadastrada em Funcionários.</p>}
        {!types.length && <p>Nenhum tipo cadastrado em Equipamentos.</p>}
        {team && (current.length ? <ul className="flex flex-wrap gap-2">{current.map(row => <li key={row.id} className="flex items-center gap-2 rounded-md border px-2 py-1">
          <span>{row.tipo}</span><Button size="sm" variant="ghost" disabled={saving} aria-label={`Desativar ${row.tipo}`} onClick={() => void save(row.tipo, false, row.id)}>Desativar</Button>
        </li>)}</ul> : <p>Nenhum padrão ativo para esta equipe.</p>)}
      </>}
    </div>
  </details>;
}
