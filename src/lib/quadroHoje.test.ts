import { describe, expect, it } from "vitest";
import { agruparPorEquipe, celulasLinha, dataBR, gerarCsv, gerarHtmlPdf, maisRecente, montarLinhasQuadroHoje, normalizarOgs, statusComoProgramador } from "./quadroHoje";
import { projetarPessoas } from "./quadroAlocacao";

const p = (id: string, name: string, equipe: string | null, status = "ativo") => ({ id, name, matricula: id, role: "AJUDANTE", equipe, status, company_id: "c1" });
const HOJE = "2026-11-16";
const ogs = { aelson: { ogs: "1234", atualizadoEm: "2026-11-10T12:00:00Z" } };

describe("quadroHoje", () => {
  const pessoas = projetarPessoas({
    hoje: HOJE, ferias: new Set(["3"]),
    alocacoes: [{ id: "a", employee_id: "2", equipe_origem: "AELSON", equipe_destino: "JOSENILDO", data_inicio: "2026-11-12", data_fim_prevista: null }],
    funcionarios: [p("1", "Ana", "AELSON"), p("2", "Bruno", "AELSON"), p("3", "Caio", "AELSON"), p("4", "Duda", null), p("5", "Edu", "AELSON", "demitido"), p("6", "Fabio", "AELSON", "afastado")],
  });
  const linhas = montarLinhasQuadroHoje({ pessoas, ogs, ultimaMovHistorico: { "1": "2026-11-01T10:00:00Z", "2": "2026-11-05T10:00:00Z" }, ultimaMovAlocacao: { "2": "2026-11-12" } });

  it("segue a projeção do quadro: emprestado no destino, férias e afastados em colunas próprias, demitido fora", () => {
    const por = Object.fromEntries(linhas.map((l) => [l.nome, l]));
    expect(por.Bruno).toMatchObject({ equipe: "JOSENILDO", situacao: "Emprestado", origem: "AELSON", ogs: "" });
    expect(por.Caio).toMatchObject({ equipe: "FÉRIAS", situacao: "Férias", origem: "AELSON", ogs: "" });
    expect(por.Fabio).toMatchObject({ equipe: "AFASTADOS", situacao: "Afastado" });
    expect(por.Duda).toMatchObject({ equipe: "Sem equipe", ogs: "" });
    expect(por.Edu).toBeUndefined();
    expect(por.Ana).toMatchObject({ equipe: "AELSON", ogs: "1234", situacao: "" });
  });
  it("ordena equipes A–Z, depois Férias/Afastados e Sem equipe por último", () => {
    expect([...new Set(linhas.map((l) => l.equipe))]).toEqual(["AELSON", "JOSENILDO", "AFASTADOS", "FÉRIAS", "Sem equipe"]);
  });
  it("última movimentação = a mais recente entre histórico e alocação", () => {
    expect(linhas.find((l) => l.nome === "Bruno")!.ultimaMov).toBe("2026-11-12");
    expect(maisRecente("", null, "2026-11-01")).toBe("2026-11-01");
    expect(dataBR("2026-11-01T10:00:00Z")).toBe("01/11/2026");
  });
  it("agrupa por equipe levando a OGS e exporta CSV/HTML com OGS", () => {
    const blocos = agruparPorEquipe(linhas, ogs);
    expect(blocos[0]).toMatchObject({ equipe: "AELSON", ogs: "1234" });
    expect(gerarCsv("T", HOJE, blocos)).toContain('"AELSON";"1234";"1";"Ana"');
    expect(gerarHtmlPdf("T", HOJE, blocos)).toContain("AELSON — OGS 1234");
    expect(celulasLinha(linhas[0])).toHaveLength(8);
  });
  it("normaliza OGS e status como o Programador", () => {
    expect(normalizarOgs("  1234  ")).toBe("1234");
    expect(normalizarOgs("   ")).toBeNull();
    expect(statusComoProgramador("Falta")).toBe("afastado");
    expect(statusComoProgramador("FÉRIAS")).toBe("ferias");
  });
});
