import { describe, expect, it } from "vitest";
import { groupPeopleForProgramador, groupEquipmentForProgramador } from "./programadorGroups";

const people = [
  ["11", "Motorista de caminhão"], ["10", "Operador de rolo"], ["09", "MESISTA"],
  ["08", "MANGUEIRISTA"], ["07", "RASTELEIRO"], ["06", "SINALEIRO"],
  ["05", "AJUDANTE GERAL"], ["04", "MARTELETEIRO"], ["03", "TECNICO DE SEGURANÇA DO TRABALHO"],
  ["02", "APONTADOR"], ["01", "ENCARREGADO DE OBRAS"], ["12", "PEDREIRO"], ["13", null],
].map(([id, role]) => ({ id: id!, role }));
const equipment = [
  ["7", "BANHEIRO QUÍMICO"], ["6", "MICROÔNIBUS"], ["5", "CAMINHÃO CARROCERIA"],
  ["4", "VIBROACABADORA"], ["3", "ROLO CHAPA"], ["2", "BOBCAT"], ["1", "FRESADORA"],
  ["8", "COMPRESSOR"], ["9", "ESCAVADEIRA"],
].map(([id, tipo]) => ({ id, tipo }));

describe("ordem operacional por categoria", () => {
  it("groups every worker in the requested sequence without losing other/unknown roles", () => {
    const groups = groupPeopleForProgramador(people);
    expect(groups.map(group => group.title)).toEqual([
      "Encarregado", "Apontador", "Técnico de Segurança", "Marteleteiro", "Ajudantes", "Sinaleiros",
      "Rasteleiros", "Mangueirista", "Mesista", "Operadores", "Motoristas", "Outros",
    ]);
    expect(groups.map(group => group.items.map(item => item.id))).toEqual([
      ["01"], ["02"], ["03"], ["04"], ["05"], ["06"], ["07"], ["08"], ["09"], ["10"], ["11"], ["12", "13"],
    ]);
  });
  it("groups fleet in the requested sequence, with small equipment distinct from vehicles", () => {
    const groups = groupEquipmentForProgramador(equipment);
    expect(groups.map(group => group.title)).toEqual([
      "Fresadora", "Bobcat", "Rolos", "Vibroacabadoras", "Caminhões", "Veículo de Transportes", "Pequeno Porte", "Outros",
    ]);
    expect(groups.map(group => group.items.map(item => item.id))).toEqual([
      ["1"], ["2"], ["3"], ["4"], ["5"], ["6"], ["7", "8"], ["9"],
    ]);
  });
  it("hides empty headings and preserves original order within a category", () => {
    const groups = groupPeopleForProgramador([{ id: "b", role: "ajudante" }, { id: "a", role: "AJUDANTE GERAL" }]);
    expect(groups).toEqual([{ title: "Ajudantes", items: [{ id: "b", role: "ajudante" }, { id: "a", role: "AJUDANTE GERAL" }] }]);
    expect(groupEquipmentForProgramador([])).toEqual([]);
  });
  it("uses the registered categoria_rdo before interpreting the equipment type, in both views", () => {
    const rows = [
      { id: "romp", tipo: "ROMPEDOR PNEUMÁTICO", categoria_rdo: "PEQUENO PORTE" },
      { id: "serra", tipo: "SERRA CLIPPER", categoria_rdo: "PEQUENO PORTE" },
      { id: "custom", tipo: "EQUIPAMENTO NOVO", categoria_rdo: "pequeno_porte" },
    ];
    expect(groupEquipmentForProgramador(rows)).toEqual([{ title: "Pequeno Porte", items: rows }]);
  });
  it("places small surveying gear and portable tools in Pequeno Porte", () => {
    expect(groupEquipmentForProgramador([{ tipo: "DENSÍMETRO" }, { tipo: "MOTOBOMBA" }]).map(group => group.title))
      .toEqual(["Pequeno Porte"]);
  });
});
