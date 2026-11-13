import { describe, expect, it } from "vitest";
import { COLUNA_AFASTADOS, COLUNA_FERIAS, feriasVigentes, origemDoHistorico, projetarPessoas, resumoEquipe } from "./quadroAlocacao";

const p = (id: string, equipe: string | null, status = "ativo") => ({ id, name: `P${id}`, matricula: id, role: "AJUDANTE", equipe, status, company_id: "c1" });
const aloc = (employee_id: string, destino: string, fim: string | null = "2026-11-20", inicio = "2026-11-10") =>
  ({ id: `a${employee_id}`, employee_id, equipe_origem: "X", equipe_destino: destino, data_inicio: inicio, data_fim_prevista: fim });
const HOJE = "2026-11-13";

describe("feriasVigentes", () => {
  it("só conta período que cobre hoje e ignora não confirmada", () => {
    const ids = feriasVigentes([
      { employee_id: "1", data_inicio: "2026-11-10", data_fim: "2026-11-20", workflow_status: "programada" },
      { employee_id: "2", data_inicio: "2026-11-14", data_fim: "2026-11-20", workflow_status: "programada" },
      { employee_id: "3", data_inicio: "2026-11-10", data_fim: "2026-11-20", workflow_status: "nao_confirmada" },
      { employee_id: "4", data_inicio: "2026-11-13", data_fim: "2026-11-13", workflow_status: "confirmada" },
    ], HOJE);
    expect([...ids].sort()).toEqual(["1", "4"]);
  });
});

describe("projetarPessoas", () => {
  const base = { hoje: HOJE, ferias: new Set<string>(), alocacoes: [] as any[] };
  it("sem alocação nem situação, não muda nada", () => {
    const r = projetarPessoas({ ...base, funcionarios: [p("1", "X")] });
    expect(r[0].equipe).toBe("X");
    expect(r[0].situacao).toBeUndefined();
  });
  it("empréstimo move o card para o destino e guarda a origem", () => {
    const r = projetarPessoas({ ...base, funcionarios: [p("1", "X")], alocacoes: [aloc("1", "Y")] });
    expect(r[0]).toMatchObject({ equipe: "Y", equipeOrigem: "X", situacao: "emprestado", aguardandoRetorno: false });
  });
  it("fim previsto vencido sem retorno confirmado continua no destino, aguardando confirmação", () => {
    const r = projetarPessoas({ ...base, funcionarios: [p("1", "X")], alocacoes: [aloc("1", "Y", "2026-11-12")] });
    expect(r[0]).toMatchObject({ equipe: "Y", aguardandoRetorno: true });
  });
  it("alocação que ainda não começou não move o card", () => {
    const r = projetarPessoas({ ...base, funcionarios: [p("1", "X")], alocacoes: [aloc("1", "Y", null, "2026-11-20")] });
    expect(r[0].equipe).toBe("X");
  });
  it("férias vigentes têm prioridade sobre empréstimo e mantêm a origem do cadastro", () => {
    const r = projetarPessoas({ ...base, funcionarios: [p("1", "X")], alocacoes: [aloc("1", "Y")], ferias: new Set(["1"]) });
    expect(r[0]).toMatchObject({ equipe: COLUNA_FERIAS, situacao: "ferias", equipeOrigem: "X" });
  });
  it("afastado com equipe real vai para AFASTADOS com origem; já em AFASTADOS usa a origem inferida", () => {
    const r = projetarPessoas({
      ...base, funcionarios: [p("1", "X", "afastado"), p("2", "AFASTADOS", "afastado"), p("3", "AFASTADOS", "afastado")],
      origemAfastados: { "2": "CBUQ04 - THIAGO" },
    });
    expect(r[0]).toMatchObject({ equipe: COLUNA_AFASTADOS, equipeOrigem: "X" });
    expect(r[1]).toMatchObject({ equipe: COLUNA_AFASTADOS, equipeOrigem: "CBUQ04 - THIAGO" });
    expect(r[2].equipeOrigem).toBeNull();
  });
  it("demitido não é projetado", () => {
    const r = projetarPessoas({ ...base, funcionarios: [p("1", "X", "demitido")], alocacoes: [aloc("1", "Y")] });
    expect(r[0].equipe).toBe("X");
  });
});

describe("resumoEquipe", () => {
  it("conta nominal, presentes e lista quem está fora com o destino", () => {
    const proj = projetarPessoas({
      hoje: HOJE, funcionarios: [p("1", "X"), p("2", "X"), p("3", "X"), p("4", "X", "afastado"), p("5", "Y")],
      alocacoes: [aloc("2", "Y")], ferias: new Set(["3"]),
    });
    const r = resumoEquipe("X", proj)!;
    expect(r).toMatchObject({ nominal: 4, presentes: 1 });
    expect(r.fora.map((f) => [f.id, f.situacao, f.destino])).toEqual([["2", "emprestado", "Y"], ["3", "ferias", COLUNA_FERIAS], ["4", "afastado", COLUNA_AFASTADOS]]);
  });
  it("equipe sem ninguém fora ou coluna do RH: null", () => {
    const proj = projetarPessoas({ hoje: HOJE, funcionarios: [p("1", "X")], alocacoes: [], ferias: new Set() });
    expect(resumoEquipe("X", proj)).toBeNull();
    expect(resumoEquipe(COLUNA_FERIAS, proj)).toBeNull();
  });
  it("quem está emprestado à equipe não conta como pertencente a ela", () => {
    const proj = projetarPessoas({ hoje: HOJE, funcionarios: [p("1", "X"), p("5", "Y")], alocacoes: [aloc("1", "Y")], ferias: new Set() });
    expect(resumoEquipe("Y", proj)).toBeNull();
  });
});

describe("origemDoHistorico", () => {
  it("lê a origem e ignora Sem equipe", () => {
    expect(origemDoHistorico("Mudança rápida de equipe: CBUQ04 - THIAGO HENRIQUE → AFASTADOS")).toBe("CBUQ04 - THIAGO HENRIQUE");
    expect(origemDoHistorico("Mudança rápida de equipe: Sem equipe → AFASTADOS")).toBeNull();
    expect(origemDoHistorico(null)).toBeNull();
  });
});
