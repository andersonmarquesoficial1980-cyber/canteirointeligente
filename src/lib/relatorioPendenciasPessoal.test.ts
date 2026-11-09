import { describe, expect, it } from "vitest";
import { categoriaPendencia, detalhePendencia, filtrarPendencias, type FiltrosPendencias, type LinhaPendencia } from "./relatorioPendenciasPessoal";
import type { PendenciaQuadro } from "./quadroPendencias";

const mk = (o: Partial<PendenciaQuadro>): PendenciaQuadro => ({ id: "1", employee_id: "e1", tipo: "outros", status: "aberta", prioridade: "normal", justificativa: "x", data_efetiva: null, payload: {}, created_at: "2026-11-05T10:00:00Z", ...o });
const F: FiltrosPendencias = { categorias: [], status: [], equipe: "TODAS", funcao: "TODAS", prioridade: "TODAS", de: "", ate: "" };

describe("categoriaPendencia", () => {
  it("mapeia tipos diretos", () => {
    expect(categoriaPendencia(mk({ tipo: "demissao" }))).toBe("demitir");
    expect(categoriaPendencia(mk({ tipo: "classificacao" }))).toBe("classificar");
    expect(categoriaPendencia(mk({ tipo: "aumento_salarial" }))).toBe("aumento");
    expect(categoriaPendencia(mk({ tipo: "substituicao" }))).toBe("substituir");
  });
  it("distingue subtipos de 'outros'", () => {
    expect(categoriaPendencia(mk({ payload: { subtipo: "ferias" } }))).toBe("ferias");
    expect(categoriaPendencia(mk({ payload: { outro_tipo_solicitacao: "Realocar para outra equipe" } }))).toBe("realocar");
    expect(categoriaPendencia(mk({ payload: { outro_tipo_solicitacao: "algo livre" } }))).toBe("outros");
    expect(categoriaPendencia(mk({ payload: null }))).toBe("outros");
  });
});

describe("detalhePendencia", () => {
  it("demissão e classificação", () => {
    expect(detalhePendencia(mk({ tipo: "demissao", payload: { tipo_demissao: "justa_causa" } }))).toBe("Justa causa");
    expect(detalhePendencia(mk({ tipo: "classificacao", payload: { classificacao_nova: "OPERADOR" } }))).toBe("Nova função: OPERADOR");
  });
  it("alocar mostra equipe", () => {
    expect(detalhePendencia(mk({ payload: { outro_tipo_solicitacao: "Alocar em equipe", equipe_sugerida: "CBUQ03" } }))).toBe("Alocar → CBUQ03");
  });
});

describe("filtrarPendencias", () => {
  const emp = (equipe: string | null, role = "AJUDANTE") => ({ name: "A", role, equipe, status: "ativo" });
  const linhas: LinhaPendencia[] = [
    { p: mk({ id: "a", tipo: "demissao" }), emp: emp("CBUQ01") },
    { p: mk({ id: "b", tipo: "demissao", status: "aprovada" }), emp: emp(null) },
    { p: mk({ id: "c", tipo: "classificacao", prioridade: "alta" }), emp: emp("CBUQ02", "OPERADOR") },
  ];
  const ids = (f: Partial<FiltrosPendencias>) => filtrarPendencias(linhas, { ...F, ...f }).map((l) => l.p.id);
  it("por categoria/status", () => {
    expect(ids({ categorias: ["demitir"] })).toEqual(["a", "b"]);
    expect(ids({ categorias: ["demitir"], status: ["aberta"] })).toEqual(["a"]);
  });
  it("por equipe, sem equipe, função, prioridade", () => {
    expect(ids({ equipe: "CBUQ02" })).toEqual(["c"]);
    expect(ids({ equipe: "__sem__" })).toEqual(["b"]);
    expect(ids({ funcao: "OPERADOR" })).toEqual(["c"]);
    expect(ids({ prioridade: "alta" })).toEqual(["c"]);
  });
  it("por período de registro", () => {
    expect(ids({ de: "2026-11-06" })).toEqual([]);
    expect(ids({ de: "2026-11-05", ate: "2026-11-05" })).toEqual(["a", "b", "c"]);
  });
});
