import { describe, expect, it } from "vitest";
import { filtrarOperadoresDiario } from "./equipmentDiaryOperators";

type Funcionario = {
  id: string;
  nome: string;
  equipe?: string | null;
};

const funcionarios: Funcionario[] = [
  { id: "claudinei", nome: "CLAUDINEI APARECIDO GONCALVES", equipe: "CENTRAL DE ABASTECIMENTO" },
  { id: "francisco", nome: "CLAUDINEI FRANCISCO", equipe: "SINALIZAÇÃO/EXTRAÇÃO 01" },
];

const equipesOcultas = new Set(["central de abastecimento"]);

describe("filtrarOperadoresDiario", () => {
  it("mantém funcionário de equipe oculta quando ele está explicitamente habilitado", () => {
    expect(filtrarOperadoresDiario(funcionarios, equipesOcultas, ["claudinei"]))
      .toEqual([funcionarios[0]]);
  });

  it("oculta equipe administrativa quando não há habilitação explícita", () => {
    expect(filtrarOperadoresDiario(funcionarios, equipesOcultas, []))
      .toEqual([funcionarios[1]]);
  });
});
