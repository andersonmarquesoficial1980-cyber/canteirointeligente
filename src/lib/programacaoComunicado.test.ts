import { describe, expect, it } from "vitest";
import { diferencasRevisao, intervaloMes, rotuloSituacao, sortOgsDecrescente, textoComunicado, urlWhatsAppComunicado, validarComunicado, type DestinoEquipe } from "./programacaoComunicado";
const trabalho: DestinoEquipe = { equipe: "CBUQ 01", situacao: "TRABALHO", local: "Obra Centro", ogs: "123", cliente: "Cliente", periodo: "NOTURNO", observacao: "" };
const folga: DestinoEquipe = { equipe: "CBUQ 02", situacao: "FOLGA", local: "", ogs: "", cliente: "", periodo: "", observacao: "" };
describe("comunicado de obras", () => {
  it("exige destino somente de quem trabalha", () => {
    expect(validarComunicado([trabalho, folga])).toBeNull();
    expect(validarComunicado([{ ...trabalho, local: "" }])).toMatch(/onde/);
  });
  it("impede duplicidade dentro do mesmo comunicado", () => {
    expect(validarComunicado([trabalho, { ...trabalho, equipe: "cbuq 01" }])).toMatch(/diferentes/);
  });
  it("compõe mensagem única com todos os destinos e folgas", () => {
    const texto = textoComunicado({ id: "id", data: "2026-10-18", created_at: "", itens: [trabalho, folga] });
    expect(texto).toContain("*1. CBUQ 01* — TRABALHA");
    expect(texto).toContain("📍 Obra Centro");
    expect(texto).toContain("*2. CBUQ 02* — FOLGA");
    expect(texto).toContain("18/10/2026");
    expect(texto).toContain("*Data: 18/10/2026*");
    expect(texto).toContain("*Equipes programadas: 2*");
    expect(texto).not.toContain("🚜");
  });
  it("gera link de compartilhamento sem depender de window.open", () => {
    const url = urlWhatsAppComunicado({ id: "id", data: "2026-10-18", created_at: "", itens: [trabalho, folga] });
    expect(url).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?text=/);
    expect(decodeURIComponent(url)).toContain("*Data: 18/10/2026*");
  });
  it("calcula todo o mês civil inclusive fevereiro bissexto", () => {
    expect(intervaloMes("2024-02")).toEqual({ inicio: "2024-02-01", fim: "2024-02-29" });
  });
  it("ordena OGS numéricas da maior para a menor, inclusive a 000 no fim", () => {
    expect(sortOgsDecrescente([{ ogs_number: "000" }, { ogs_number: "2529" }, { ogs_number: "999" }]).map(x => x.ogs_number)).toEqual(["2529", "999", "000"]);
  });
  it("mostra os responsáveis selecionados na mensagem da equipe", () => {
    const texto = textoComunicado({ id: "id", data: "2026-10-19", created_at: "", itens: [{ ...trabalho, encarregado_nome: "Aelson", engenheiro_nome: "Joana" }] });
    expect(texto).toContain("Encarregado: Aelson");
    expect(texto).toContain("Engenheiro: Joana");
  });
  it("exige motivo para cancelar uma equipe e preserva as outras no mesmo comunicado", () => {
    expect(validarComunicado([{ ...trabalho, situacao: "CANCELADO", motivo_cancelamento: "" }, folga])).toMatch(/motivo/i);
    expect(validarComunicado([{ ...trabalho, situacao: "CANCELADO", motivo_cancelamento: "Chuva forte" }, folga])).toBeNull();
  });
  it("identifica a revisão corrigida e o motivo do cancelamento no compartilhamento", () => {
    const texto = textoComunicado({ id: "id", data: "2026-10-19", created_at: "", revisao: 2, itens: [{ ...trabalho, situacao: "CANCELADO", motivo_cancelamento: "Chuva forte" }, folga] });
    expect(texto).toContain("ATUALIZAÇÃO");
    expect(texto).toContain("CANCELADO");
    expect(texto).toContain("Motivo: Chuva forte");
    expect(texto).not.toContain("Obra Centro");
  });
  it("explica no histórico a troca de OGS e o cancelamento da mesma equipe", () => {
    const alteracoes = diferencasRevisao([trabalho, folga], [{ ...trabalho, situacao: "CANCELADO", motivo_cancelamento: "Chuva forte", ogs: "2529" }, folga]);
    expect(alteracoes).toContain("CBUQ 01 · Situação: Vai trabalhar → Cancelado");
    expect(alteracoes).toContain("CBUQ 01 · OGS: 123 → 2529");
    expect(alteracoes).toContain("CBUQ 01 · Motivo: — → Chuva forte");
    expect(alteracoes.some(x => x.includes("CBUQ 02"))).toBe(false);
  });
  it("não confunde cancelamento com folga ou trabalho no relatório", () => {
    expect(rotuloSituacao("CANCELADO")).toBe("Cancelado");
    expect(rotuloSituacao("FOLGA")).toBe("Folga programada");
    expect(rotuloSituacao("TRABALHOU")).toBe("Trabalho programado");
  });
});
