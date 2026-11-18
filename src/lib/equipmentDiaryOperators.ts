import { equipeVisivel } from "@/lib/equipesOcultas";

export type OperadorDiario = {
  id: string;
  equipe?: string | null;
};

export function filtrarOperadoresDiario<T extends OperadorDiario>(
  funcionarios: T[],
  equipesOcultas: Set<string>,
  enabledOperatorIds: string[],
): T[] {
  if (enabledOperatorIds.length > 0) {
    const enabledSet = new Set(enabledOperatorIds);
    const habilitados = funcionarios.filter((funcionario) => enabledSet.has(funcionario.id));
    if (habilitados.length > 0) return habilitados;
  }

  return funcionarios.filter((funcionario) => equipeVisivel(funcionario.equipe, equipesOcultas));
}
