export interface EngineerProfile {
  user_id: string;
  nome_completo: string | null;
  email: string | null;
}

export interface TechnicalEntry {
  id: string;
  data: string;
  engenheiro_id: string | null;
  status: string;
  ogs_number: string | null;
}

export interface PointingEntry {
  id: string;
  data: string;
  obra_nome: string | null;
  engenheiro_responsavel_user_id: string | null;
  status_validacao: string | null;
  validado_por: string | null;
}

export interface EngineerLaunch<T extends TechnicalEntry> {
  id: string;
  nome: string;
  enviados: number;
  rascunhos: number;
  registros: T[];
}

export interface EngineerPending<P extends PointingEntry> {
  id: string;
  nome: string;
  pendentes: P[];
}

export function buildEngineeringMonitoring<T extends TechnicalEntry, P extends PointingEntry>(
  profiles: EngineerProfile[], technical: T[], pointing: P[], period: { from: string; to: string },
): { launchRows: EngineerLaunch<T>[]; pendingRows: EngineerPending<P>[]; unassigned: P[] } {
  const launchMap = new Map<string, EngineerLaunch<T>>();
  const pendingMap = new Map<string, EngineerPending<P>>();
  profiles.forEach(profile => {
    const nome = profile.nome_completo || profile.email || "Sem nome";
    launchMap.set(profile.user_id, {
      id: profile.user_id, nome, enviados: 0, rascunhos: 0, registros: [],
    });
    pendingMap.set(profile.user_id, { id: profile.user_id, nome, pendentes: [] });
  });

  technical.forEach(row => {
    if (row.data < period.from || row.data > period.to || !row.engenheiro_id) return;
    const pessoa = launchMap.get(row.engenheiro_id);
    if (!pessoa) return;
    pessoa.registros.push(row);
    if (row.status === "enviado") pessoa.enviados++;
    else if (row.status === "rascunho") pessoa.rascunhos++;
  });

  const unassigned: P[] = [];
  pointing.forEach(row => {
    if (row.data < "2026-07-17" || row.data > period.to || row.validado_por
      || !["enviado", "aguardando_validacao"].includes(row.status_validacao || "")) return;
    const pessoa = row.engenheiro_responsavel_user_id
      ? pendingMap.get(row.engenheiro_responsavel_user_id) : undefined;
    if (pessoa) pessoa.pendentes.push(row);
    else unassigned.push(row);
  });

  return {
    launchRows: [...launchMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    pendingRows: [...pendingMap.values()].filter(p => p.pendentes.length > 0)
      .sort((a, b) => b.pendentes.length - a.pendentes.length || a.nome.localeCompare(b.nome, "pt-BR")),
    unassigned,
  };
}
