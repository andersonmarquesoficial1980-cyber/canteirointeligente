import { describe, expect, it } from "vitest";
import { agruparAbertasPorFuncionario, rotuloPendencia, tomPendencia } from "./quadroPendencias";
import { montarNovaPendenciaEquip, paraPendenciaQuadro, rotuloPendenciaEquip, type FormPendenciaEquip, type LinhaPendenciaEquip } from "./quadroFrotasPendencias";

const form = (o: Partial<FormPendenciaEquip> = {}): FormPendenciaEquip => ({ tipo: "devolver", justificativa: "Fim do contrato", prioridade: "normal", dataEfetiva: "", ...o });
const linha = (o: Partial<LinhaPendenciaEquip> = {}): LinhaPendenciaEquip =>
  ({ id: "p1", equipment_id: "e1", tipo: "devolver", status: "aberta", prioridade: "normal", justificativa: "x", data_efetiva: null, payload: {}, ...o });

describe("montarNovaPendenciaEquip", () => {
  it("monta devolver sem campos extras", () => {
    expect(montarNovaPendenciaEquip(form({ dataEfetiva: "2026-11-30" }))).toMatchObject({ tipo: "devolver", data_efetiva: "2026-11-30", payload: { origem: "quadro_equipes" } });
  });
  it("alocar/transferir exigem equipe; substituir normaliza; outros exige descrição", () => {
    expect(() => montarNovaPendenciaEquip(form({ tipo: "alocar" }))).toThrow(/equipe/);
    expect(montarNovaPendenciaEquip(form({ tipo: "transferir", equipeSugerida: "CBUQ02" })).payload).toMatchObject({ equipe_sugerida: "CBUQ02" });
    expect(montarNovaPendenciaEquip(form({ tipo: "substituir", substituto: " cb09 " })).payload).toMatchObject({ substituto_sugerido: "CB09" });
    expect(() => montarNovaPendenciaEquip(form({ tipo: "outros" }))).toThrow(/Descreva/);
  });
  it("exige motivo e data válida", () => {
    expect(() => montarNovaPendenciaEquip(form({ justificativa: " " }))).toThrow(/motivo/i);
    expect(() => montarNovaPendenciaEquip(form({ dataEfetiva: "30/11/2026" }))).toThrow(/Data/);
  });
});

describe("selo no card", () => {
  it("rótulos", () => {
    expect(rotuloPendenciaEquip(linha({ tipo: "manutencao" }))).toBe("Manutenção");
    expect(rotuloPendenciaEquip(linha({ tipo: "alocar", payload: { equipe_sugerida: "CBUQ02" } }))).toBe("Alocar → CBUQ02");
    expect(rotuloPendenciaEquip(linha({ tipo: "outros", payload: { descricao: "Trocar pneus" } }))).toBe("Trocar pneus");
  });
  it("converte para o formato do quadro, usando o id do equipamento como chave", () => {
    const q = paraPendenciaQuadro(linha({ tipo: "alocar", payload: { equipe_sugerida: "CBUQ02" } }));
    expect(q.employee_id).toBe("e1");
    expect(rotuloPendencia(q)).toBe("Alocar → CBUQ02");
    expect(Object.keys(agruparAbertasPorFuncionario([q]))).toEqual(["e1"]);
  });
  it("devolver/baixar normais sobem para atenção; urgente é crítico; encerradas não contam", () => {
    expect(tomPendencia(paraPendenciaQuadro(linha({ tipo: "devolver" })))).toBe("atencao");
    expect(tomPendencia(paraPendenciaQuadro(linha({ tipo: "manutencao" })))).toBe("info");
    expect(tomPendencia(paraPendenciaQuadro(linha({ tipo: "manutencao", prioridade: "urgente" })))).toBe("critico");
    expect(agruparAbertasPorFuncionario([paraPendenciaQuadro(linha({ status: "aprovada" }))])).toEqual({});
  });
});
