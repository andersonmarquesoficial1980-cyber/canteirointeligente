export type NoteSubject = "pessoa" | "equipamento";
export type OperationalNotes = Record<string, string>;
export const noteKey = (type: NoteSubject, id: string) => `${type}:${id}`;

export function normalizeOperationalNote(text: string): string | null {
  const normalized = text.trim();
  if (normalized.length > 1000) throw new Error("A observação deve ter no máximo 1000 caracteres");
  return normalized || null;
}

// The table is created by the matching SQL migration; the generated Supabase types predate it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchOperationalNotes(client: any, companyId: string): Promise<OperationalNotes> {
  const { data, error, count } = await client.from("programador_observacoes")
    .select("subject_type,subject_id,texto", { count: "exact" }).eq("company_id", companyId);
  if (error) throw error;
  if (!data || count !== data.length) throw new Error("Observações incompletas; atualize a tela");
  const notes: OperationalNotes = {};
  for (const row of data) if (row.texto && (row.subject_type === "pessoa" || row.subject_type === "equipamento")) {
    notes[noteKey(row.subject_type, row.subject_id)] = row.texto;
  }
  return notes;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveOperationalNote(client: any, companyId: string, type: NoteSubject, id: string, text: string): Promise<string | null> {
  const texto = normalizeOperationalNote(text);
  const { data, error } = await client.rpc("programador_salvar_observacao", {
    p_company_id: companyId, p_subject_type: type, p_subject_id: id, p_texto: texto ?? "",
  });
  if (error) throw error;
  if (!data?.id) throw new Error("O banco não confirmou a observação");
  const { data: persisted, error: readError } = await client.from("programador_observacoes")
    .select("texto").eq("id", data.id).eq("company_id", companyId).eq("subject_id", id).single();
  if (readError || !persisted || persisted.texto !== texto) throw new Error("Não foi possível confirmar a observação salva; atualize os dados antes de tentar novamente");
  return texto;
}
