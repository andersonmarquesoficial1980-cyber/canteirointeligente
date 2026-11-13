import { describe, expect, it } from "vitest";
import { coberturaEquipamentos, coberturaPessoas, lancamentosSemVinculo, pessoaMonitorada, textoCobranca } from "./rdoCoverage";

const rdos = [
  { id: "r1", data: "2026-11-02", obra_nome: "Obra A", ogs_id: "o1", equipe: "CAUQ", status_validacao: "enviado", tipo_rdo: "CAUQ", apontador: "Ana" },
  { id: "r2", data: "2026-11-03", obra_nome: "Obra A", ogs_id: "o1", status_validacao: "enviado", tipo_rdo: "CAUQ" },
  { id: "r3", data: "2026-11-04", obra_nome: "Obra A", ogs_id: "o1", status_validacao: "rascunho", tipo_rdo: "CAUQ" },
  { id: "r4", data: "2026-11-05", obra_nome: "Obra A", ogs_id: "o1", status_validacao: "enviado", tipo_rdo: "AUTOMATICO" },
];
const ogs = [{ id: "o1", ogs_number: "2539" }];
const base = { rdos, ogs, inicio: "2026-11-01", fim: "2026-11-06", hoje: "2026-11-06" };
const st = (cells: { date: string; state: string }[]) => Object.fromEntries(cells.map(c => [c.date.slice(8), c.state]));

describe("cobertura de equipamentos no RDO", () => {
  const equips = [{ id: "e1", frota: "CC-02", tipo: "CAMINHÃO", status: "ativo", created_at: "2026-01-01T00:00:00Z" }];
  it("RDO válido cobre; rascunho/automático não; dia sem RDO da empresa não é cobrado", () => {
    const [c] = coberturaEquipamentos({ ...base, equips, rdoEquips: [{ rdo_id: "r1", frota: "CC02" }, { rdo_id: "r3", frota: "CC02" }, { rdo_id: "r4", frota: "CC02" }], diarios: [], transportes: [] });
    expect(st(c.cells)).toEqual({ "01": "sem_expediente", "02": "rdo", "03": "sem_registro", "04": "sem_expediente", "05": "sem_expediente", "06": "hoje" });
    expect(c.faltando).toEqual(["2026-11-03"]);
    expect(c.pct).toBe(50);
  });
  it("diário Trabalhando sem RDO é inconsistência; Folga/transporte justificam", () => {
    const d = (ws: string) => ({ equipment_fleet: "CC02", date: "2026-11-03", work_status: ws, status: "enviado" });
    expect(coberturaEquipamentos({ ...base, equips, rdoEquips: [], diarios: [d("Trabalhando")], transportes: [] })[0].cells[2].state).toBe("inconsistente");
    expect(coberturaEquipamentos({ ...base, equips, rdoEquips: [], diarios: [d("Folga")], transportes: [] })[0].cells[2].state).toBe("justificado");
    expect(coberturaEquipamentos({ ...base, equips, rdoEquips: [], diarios: [], transportes: [{ equipment_fleet: "CC02", data: "2026-11-03" }] })[0].cells[2].state).toBe("justificado");
  });
  it("equipamento em manutenção é justificado; dias antes do cadastro não contam", () => {
    const [m] = coberturaEquipamentos({ ...base, equips: [{ ...equips[0], status: "em_manutencao" }], rdoEquips: [], diarios: [], transportes: [] });
    expect(m.faltando).toEqual([]);
    const [n] = coberturaEquipamentos({ ...base, equips: [{ ...equips[0], created_at: "2026-11-03T10:00:00Z" }], rdoEquips: [], diarios: [], transportes: [] });
    expect(n.cells[1].state).toBe("na");
  });
});

describe("cobertura de funcionários no RDO", () => {
  const p = (o = {}) => ({ id: "p1", name: "João da Silva", role: "OPERADOR", equipe: "CAUQ", origem: "PROPRIO", status: "ativo", ...o });
  const filtro = { incluirAjudantes: true, incluirAdm: false };
  it("casa por employee_id, por nome normalizado e pelo encarregado", () => {
    const efetivo = [{ rdo_id: "r1", nome: "JOAO DA SILVA", employee_id: null }, { rdo_id: "r2", nome: "Outro", employee_id: "p1" }];
    const [c] = coberturaPessoas({ ...base, pessoas: [p()], efetivo, diarios: [], alocacoes: [], filtro });
    expect(st(c.cells)["02"]).toBe("rdo"); expect(st(c.cells)["03"]).toBe("rdo");
    const [e] = coberturaPessoas({ ...base, rdos: [{ ...rdos[0], encarregado: "João da Silva" }], pessoas: [p()], efetivo: [], diarios: [], alocacoes: [], filtro });
    expect(st(e.cells)["02"]).toBe("rdo");
  });
  it("Programador justifica folga; alocado em obra sem RDO é inconsistência", () => {
    const [c] = coberturaPessoas({ ...base, pessoas: [p()], efetivo: [], diarios: [], filtro,
      alocacoes: [{ employee_id: "p1", data: "2026-11-02", tipo: "ferias" }, { employee_id: "p1", data: "2026-11-03", tipo: "obra", ogs_number: "2539" }] });
    expect(st(c.cells)["02"]).toBe("justificado"); expect(st(c.cells)["03"]).toBe("inconsistente");
  });
  it("RDO Técnico do engenheiro justifica o dia (casado por nome)", () => {
    const [c] = coberturaPessoas({ ...base, pessoas: [p({ role: "ENGENHEIRO CIVIL" })], efetivo: [], diarios: [], alocacoes: [], filtro, extras: [{ nome: "JOAO DA SILVA", data: "2026-11-03", nota: "RDO Técnico" }] });
    expect(st(c.cells)["03"]).toBe("justificado");
  });
  it("operador em diário Trabalhando fora do efetivo é inconsistência", () => {
    const [c] = coberturaPessoas({ ...base, pessoas: [p()], efetivo: [], alocacoes: [], filtro,
      diarios: [{ equipment_fleet: "CC02", date: "2026-11-03", work_status: "Trabalhando", status: "enviado", operator_name: "João da Silva" }] });
    expect(st(c.cells)["03"]).toBe("inconsistente");
  });
  it("ajudantes entram por opção; administrativos/demitidos/terceiros ficam de fora", () => {
    const aj = p({ role: "AJUDANTE GERAL" });
    expect(pessoaMonitorada(aj, "2026-11-06", filtro)).toBe(true);
    expect(pessoaMonitorada(aj, "2026-11-06", { ...filtro, incluirAjudantes: false })).toBe(false);
    expect(pessoaMonitorada(p({ equipe: "ADMINISTRATIVO" }), "2026-11-06", filtro)).toBe(false);
    expect(pessoaMonitorada(p({ equipe: "ADMINISTRATIVO" }), "2026-11-06", { ...filtro, incluirAdm: true })).toBe(true);
    expect(pessoaMonitorada(p({ status: "demitido" }), "2026-11-06", filtro)).toBe(false);
    expect(pessoaMonitorada(p({ origem: "TERCEIRO" }), "2026-11-06", filtro)).toBe(false);
  });
});

describe("lançamentos sem vínculo", () => {
  it("separa nome sem cadastro, nome vinculável e frota sem cadastro", () => {
    const r = lancamentosSemVinculo({
      rdos, ogs,
      efetivo: [{ rdo_id: "r1", nome: "Fulano Inexistente", employee_id: null }, { rdo_id: "r2", nome: "João da Silva", employee_id: null }, { rdo_id: "r1", nome: "João da Silva", employee_id: "p1" }],
      rdoEquips: [{ rdo_id: "r1", frota: "ZZ99" }, { rdo_id: "r1", frota: "CC02" }],
      todosFuncionarios: [{ id: "p1", name: "JOAO DA SILVA" }], todosEquipamentos: [{ frota: "CC-02" }],
    });
    expect(r.map(x => [x.tipo, x.situacao, x.nome])).toEqual([["equipamento", "sem_cadastro", "ZZ99"], ["pessoa", "sem_cadastro", "Fulano Inexistente"], ["pessoa", "vinculavel", "João da Silva"]]);
    expect(r[1].apontadores).toEqual(["Ana"]);
  });
});

describe("texto de cobrança", () => {
  it("lista dias sem registro e indícios", () => {
    const t = textoCobranca("equipamento", "CC02", "CAMINHÃO", ["2026-11-03"], ["2026-11-04"]);
    expect(t).toContain("03/11"); expect(t).toContain("04/11");
  });
});
