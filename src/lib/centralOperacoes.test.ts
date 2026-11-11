import { describe, expect, it } from "vitest";
import { tiposSemDiario, areaExcluida, diffDays, resumoCentral, situacaoEquipamentos, situacaoObras, situacaoPessoas, statusOperacaoDe } from "./centralOperacoes";

const HOJE = "2026-11-11";
const eq = (frota: string, status = "ativo") => ({ id: frota, frota, status });
const dia = (fleet: string, date: string, extra: any = {}) => ({
  equipment_fleet: fleet, date, work_status: "Trabalhando", ogs_number: "1234", operator_name: "Lima", status: "enviado", is_auto: false, ...extra,
});

describe("centralOperacoes — equipamentos", () => {
  it("diffDays conta dias corridos", () => {
    expect(diffDays("2026-11-09", HOJE)).toBe(2);
    expect(diffDays("2026-10-31", "2026-11-02")).toBe(2);
  });
  it("com diário hoje = ok_hoje", () => {
    const [r] = situacaoEquipamentos([eq("RC-45")], [dia("RC-45", HOJE)], [], HOJE);
    expect(r.estado).toBe("ok_hoje"); expect(r.semDiarioHoje).toBe(false); expect(r.statusOperacao).toBe("trabalhando");
  });
  it("sem diário há 3 dias = atrasado; ontem ainda não alerta (limite 2)", () => {
    const rows = situacaoEquipamentos([eq("A"), eq("B")], [dia("A", "2026-11-08"), dia("B", "2026-11-10")], [], HOJE, 2);
    expect(rows[0]).toMatchObject({ estado: "atrasado", diasSemDiario: 3 });
    expect(rows[1].estado).toBe("ok_hoje");
  });
  it("nunca lançou = nunca", () => {
    expect(situacaoEquipamentos([eq("X")], [], [], HOJE)[0].estado).toBe("nunca");
  });
  it("diário automático NÃO conta como lançamento, mas dá localização (pátio)", () => {
    const [r] = situacaoEquipamentos([eq("P")], [dia("P", HOJE, { is_auto: true, ogs_number: "BASE" })], [], HOJE);
    expect(r.semDiarioHoje).toBe(true); expect(r.statusOperacao).toBe("patio"); expect(r.fonte).toBe("diario_auto");
  });
  it("rascunho é ignorado; chave de frota ignora hífen e caixa", () => {
    const [r] = situacaoEquipamentos([eq("RC-45")], [dia("rc 45", HOJE, { status: "rascunho" })], [], HOJE);
    expect(r.semDiarioHoje).toBe(true);
    const [s] = situacaoEquipamentos([eq("RC-45")], [dia("rc45", HOJE)], [], HOJE);
    expect(s.semDiarioHoje).toBe(false);
  });
  it("manutenção e devolvido não geram alerta", () => {
    const rows = situacaoEquipamentos([eq("M", "em_manutencao"), eq("D", "devolvido")], [], [], HOJE);
    expect(rows.every((r) => r.estado === "isento")).toBe(true);
    expect(rows[0].statusOperacao).toBe("manutencao");
  });
  it("transporte mais recente que o diário define a localização", () => {
    const [r] = situacaoEquipamentos([eq("T")], [dia("T", "2026-11-09")], [{ equipment_fleet: "T", data: HOJE, origem_ogs: "1234", destino_ogs: "1301" }], HOJE);
    expect(r.statusOperacao).toBe("transporte"); expect(r.ogs).toBe("1301");
  });
  it("mapeia status de operação", () => {
    expect(statusOperacaoDe("Trabalhando")).toBe("trabalhando");
    expect(statusOperacaoDe("Inoperante")).toBe("manutencao");
    expect(statusOperacaoDe("Folga")).toBe("folga");
    expect(statusOperacaoDe(null)).toBe("sem_info");
  });
});

describe("centralOperacoes — pessoas", () => {
  const emp = (id: string, name: string, extra: any = {}) => ({ id, name, origem: "PROPRIO", status: "ativo", equipe: "ASFALTO 1", ...extra });
  it("reconhece por employee_id ou por nome normalizado", () => {
    const rows = situacaoPessoas(
      [emp("1", "João Silva"), emp("2", "José Souza"), emp("3", "Ana Lima")],
      [{ employee_id: "1", nome: "x", data: HOJE, obra: "A", ogs: "1", equipe: "" }, { employee_id: null, nome: "JOSE SOUZA", data: "2026-11-08", obra: "B", ogs: "2", equipe: "" }],
      HOJE,
    );
    expect(rows.find((r) => r.id === "1")!.estado).toBe("ok_hoje");
    expect(rows.find((r) => r.id === "2")).toMatchObject({ estado: "atrasado", diasSemRdo: 3, ultimaObra: "B" });
    expect(rows.find((r) => r.id === "3")!.estado).toBe("sem_historico");
  });
  it("exclui terceiros, demitidos e áreas administrativas (igual ao Programador)", () => {
    const rows = situacaoPessoas(
      [emp("1", "A", { origem: "TERCEIRO" }), emp("2", "B", { data_demissao: "2026-11-01" }), emp("3", "C", { equipe: "ADMINISTRATIVO" }), emp("4", "D", { centro_custo: "2529" }), emp("5", "E")],
      [], HOJE,
    );
    expect(rows.map((r) => r.id)).toEqual(["5"]);
    expect(areaExcluida("Segurança do Trabalho", null)).toBe(true);
    expect(areaExcluida("Asfalto 1", "1000")).toBe(false);
  });
  it("admitido no futuro não entra", () => {
    expect(situacaoPessoas([emp("1", "A", { data_admissao: "2026-12-01" })], [], HOJE)).toHaveLength(0);
  });
});

describe("centralOperacoes — obras e resumo", () => {
  it("obra ativa com RDO hoje, sem RDO hoje e parada", () => {
    const ogs = [{ id: "o1", ogs_number: "OGS 1234" }, { id: "o2", ogs_number: "1301" }, { id: "o3", ogs_number: "9" }];
    const rdos = [
      { data: HOJE, obra_nome: "Obra A", ogs_id: "o1" }, { data: "2026-11-09", obra_nome: "Obra B", ogs_id: "o2" },
      { data: "2026-09-01", obra_nome: "Obra C", ogs_id: "o3" }, { data: HOJE, obra_nome: "Rasc", ogs_id: "o1", status_validacao: "rascunho" },
    ];
    const obras = situacaoObras(ogs, rdos, [dia("A", HOJE, { ogs_number: "1234" }), dia("B", HOJE, { ogs_number: "OGS 1234" })], new Map([["1234", 7]]), HOJE);
    expect(obras).toHaveLength(2);
    const a = obras.find((o) => o.ogs === "1234")!;
    expect(a).toMatchObject({ estado: "rdo_hoje", rdoHoje: 1, equipamentosHoje: 2, pessoasHoje: 7 });
    expect(obras.find((o) => o.ogs === "1301")).toMatchObject({ estado: "sem_rdo_hoje", diasSemRdo: 2 });
  });
  it("resumo agrega KPIs", () => {
    const e = situacaoEquipamentos([eq("A"), eq("B"), eq("C", "em_manutencao")], [dia("A", HOJE)], [], HOJE, 1);
    const r = resumoCentral(e, [], []);
    expect(r).toMatchObject({ equipMonitorados: 2, equipComDiarioHoje: 1, equipNunca: 1, emManutencao: 1 });
  });
});

describe("centralOperacoes — ruído real de produção", () => {
  it("tipo com 3+ unidades e nenhum diário (banheiro) fica isento; tipo com diário continua monitorado", () => {
    const e = [1, 2, 3].map((n) => ({ id: `B${n}`, frota: `BAN-${n}`, tipo: "Banheiro Químico", status: "ativo" }))
      .concat([1, 2, 3].map((n) => ({ id: `R${n}`, frota: `RC-${n}`, tipo: "Rolo", status: "ativo" })));
    const d = [dia("RC-1", HOJE)];
    expect([...tiposSemDiario(e, d)]).toEqual(["BANHEIRO QUIMICO"]);
    const rows = situacaoEquipamentos(e, d, [], HOJE);
    expect(rows.filter((r) => r.tipo === "Banheiro Químico").every((r) => r.estado === "isento")).toBe(true);
    expect(rows.find((r) => r.frota === "RC-2")!.estado).toBe("nunca");
  });
  it("tipo com poucas unidades sem diário NÃO é isento (pode ser esquecimento)", () => {
    const e = [{ id: "E1", frota: "ESC-1", tipo: "Escavadeira", status: "ativo" }];
    expect(situacaoEquipamentos(e, [], [], HOJE)[0].estado).toBe("nunca");
  });
  it("obra SEM ATIVIDADE não entra no painel", () => {
    const obras = situacaoObras([], [{ data: HOJE, obra_nome: "Sem Atividade", ogs_id: null }, { data: HOJE, obra_nome: "2509", ogs_id: null }], [], new Map(), HOJE);
    expect(obras.map((o) => o.ogs)).toEqual(["2509"]);
  });
});
