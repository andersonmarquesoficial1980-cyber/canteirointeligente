import { describe, expect, it } from "vitest";
import {
  agruparAbertasPorFuncionario, montarNovaPendencia, rotuloPendencia, semDestino, tomPendencia,
  type FormPendenciaRapida, type PendenciaQuadro,
} from "./quadroPendencias";

const form = (o: Partial<FormPendenciaRapida> = {}): FormPendenciaRapida =>
  ({ destino: "demitir", justificativa: "Fim da obra", prioridade: "normal", dataEfetiva: "", ...o });
const pend = (o: Partial<PendenciaQuadro> = {}): PendenciaQuadro =>
  ({ id: "p1", employee_id: "e1", tipo: "demissao", status: "aberta", prioridade: "normal", justificativa: "x", data_efetiva: null, payload: {}, ...o });

describe("montarNovaPendencia · classificar/aumento/subtipo", () => {
  it("classificar vira tipo classificacao em maiúsculas", () => {
    expect(montarNovaPendencia(form({ destino: "classificar", classificacaoNova: "operador de rolo" }))).toMatchObject({ tipo: "classificacao", payload: { classificacao_nova: "OPERADOR DE ROLO" } });
    expect(() => montarNovaPendencia(form({ destino: "classificar" }))).toThrow();
  });
  it("aumento exige valor e grava número", () => {
    expect(montarNovaPendencia(form({ destino: "aumento", novoSalario: "4200,50" }))).toMatchObject({ tipo: "aumento_salarial", payload: { novo_salario: 4200.5 } });
    expect(() => montarNovaPendencia(form({ destino: "aumento", novoSalario: "" }))).toThrow();
  });
  it("alocar/férias/afastar gravam subtipo e origem da ficha", () => {
    expect(montarNovaPendencia(form({ destino: "ferias", origem: "ficha" })).payload).toMatchObject({ subtipo: "ferias", origem: "ficha" });
    expect(rotuloPendencia({ tipo: "classificacao", payload: {} })).toBe("Classificar");
  });
});

describe("realocar", () => {
  it("grava equipe atual e nova, rótulo próprio, e recusa mesma equipe", () => {
    const r = montarNovaPendencia(form({ destino: "realocar", equipeSugerida: "EQ B", equipeAtual: "EQ A" }));
    expect(r).toMatchObject({ tipo: "outros", payload: { subtipo: "realocar", equipe_sugerida: "EQ B", equipe_atual: "EQ A" } });
    expect(rotuloPendencia(r)).toBe("Realocar → EQ B");
    expect(() => montarNovaPendencia(form({ destino: "realocar", equipeSugerida: "eq a", equipeAtual: "EQ A" }))).toThrow();
  });
});

describe("montarNovaPendencia", () => {
  it("demitir usa o tipo estruturado 'demissao' e guarda o tipo de demissão", () => {
    const r = montarNovaPendencia(form({ tipoDemissao: "com_justa_causa", dataEfetiva: "2026-11-05" }));
    expect(r).toMatchObject({ tipo: "demissao", data_efetiva: "2026-11-05" });
    expect(r.payload).toMatchObject({ tipo_demissao: "com_justa_causa", origem: "quadro_equipes" });
  });

  it("alocar/férias/afastar usam 'outros' com o rótulo no payload (sem migration)", () => {
    expect(montarNovaPendencia(form({ destino: "ferias" }))).toMatchObject({ tipo: "outros", payload: { outro_tipo_solicitacao: "Dar férias" } });
    expect(montarNovaPendencia(form({ destino: "afastar" })).payload).toMatchObject({ outro_tipo_solicitacao: "Afastamento" });
    expect(montarNovaPendencia(form({ destino: "alocar", equipeSugerida: "CBUQ02" })).payload)
      .toMatchObject({ outro_tipo_solicitacao: "Alocar em equipe", equipe_sugerida: "CBUQ02" });
  });

  it("substituir usa 'substituicao' e normaliza o nome sugerido", () => {
    expect(montarNovaPendencia(form({ destino: "substituir", substitutoSugerido: " joao " })))
      .toMatchObject({ tipo: "substituicao", payload: { substituto_sugerido: "JOAO" } });
  });

  it("exige motivo, equipe ao alocar, texto em 'outro' e data válida", () => {
    expect(() => montarNovaPendencia(form({ justificativa: "  " }))).toThrow(/motivo/i);
    expect(() => montarNovaPendencia(form({ destino: "alocar" }))).toThrow(/equipe/i);
    expect(() => montarNovaPendencia(form({ destino: "outro" }))).toThrow(/Descreva/);
    expect(() => montarNovaPendencia(form({ dataEfetiva: "05/11/2026" }))).toThrow(/Data/);
    expect(montarNovaPendencia(form({ destino: "outro", outroTexto: "Transferir de obra" })).payload)
      .toMatchObject({ outro_tipo_solicitacao: "Transferir de obra" });
  });
});

describe("exibição no card", () => {
  it("rotula cada tipo, inclusive o 'Alocar → equipe'", () => {
    expect(rotuloPendencia(pend())).toBe("Demitir");
    expect(rotuloPendencia(pend({ tipo: "outros", payload: { outro_tipo_solicitacao: "Alocar em equipe", equipe_sugerida: "CBUQ02" } }))).toBe("Alocar → CBUQ02");
    expect(rotuloPendencia(pend({ tipo: "outros", payload: { outro_tipo_solicitacao: "Dar férias" } }))).toBe("Dar férias");
    expect(rotuloPendencia(pend({ tipo: "outros", payload: null }))).toBe("Pendência");
  });

  it("demissão e urgente são críticas; alta é atenção; o resto é informativo", () => {
    expect(tomPendencia({ tipo: "demissao", prioridade: "baixa" })).toBe("critico");
    expect(tomPendencia({ tipo: "outros", prioridade: "urgente" })).toBe("critico");
    expect(tomPendencia({ tipo: "outros", prioridade: "alta" })).toBe("atencao");
    expect(tomPendencia({ tipo: "outros", prioridade: "normal" })).toBe("info");
  });

  it("só considera pendências abertas, ordenadas por urgência e depois por antiguidade", () => {
    const m = agruparAbertasPorFuncionario([
      pend({ id: "a", prioridade: "normal", created_at: "2026-10-01" }),
      pend({ id: "b", prioridade: "urgente", created_at: "2026-10-05" }),
      pend({ id: "c", prioridade: "normal", created_at: "2026-09-01" }),
      pend({ id: "d", status: "aprovada", prioridade: "urgente" }),
      pend({ id: "e", status: "cancelada" }),
      pend({ id: "f", employee_id: "e2", status: "em_analise" }),
    ]);
    expect(m.e1.map((x) => x.id)).toEqual(["b", "a", "c"]); // mais recente primeiro
    expect(m.e2.map((x) => x.id)).toEqual(["f"]);
  });

  it("'sem destino' = sem equipe e sem pendência aberta", () => {
    expect(semDestino(null, undefined)).toBe(true);
    expect(semDestino("  ", [])).toBe(true);
    expect(semDestino(null, [pend()])).toBe(false);
    expect(semDestino("CBUQ01", undefined)).toBe(false);
  });
});
