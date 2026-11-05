import { describe, expect, it } from "vitest";
import { calcularDiasPorObra, classificarMotivo, type DiaRdoRow } from "./rdoTecnicoDiasObra";

const base = { ogs_number: "2539", status: "enviado", houve_producao: false } as const;
let n = 0;
const r = (data: string, eng: string, extra: Partial<DiaRdoRow> = {}): DiaRdoRow => ({ ...base, id: `r${n++}`, data, engenheiro_id: eng, ...extra });
const sem = (data: string, eng: string, motivo: string, outro = "") => r(data, eng, { motivo_sem_producao: motivo, outro_motivo_sem_producao: outro });

describe("classificarMotivo", () => {
  it("texto livre de chuva e previsão/PMR contam como Chuva", () => {
    expect(classificarMotivo(sem("2026-10-05", "G", "Outro", "Obra embargada devido, chuva.")).categoria).toBe("Chuva");
    expect(classificarMotivo(sem("2026-10-14", "G", "Outro", "Previsão de chuva, PMR não liberou, condições climáticas")).categoria).toBe("Chuva");
    expect(classificarMotivo(sem("2026-10-15", "B", "Outro", "Aplicação de massa cancelada devido precipitação de chuva")).categoria).toBe("Chuva");
  });
  it("usina vem antes da chuva quando é a causa principal", () => {
    expect(classificarMotivo(sem("2026-10-24", "G", "Outro", "motiva não autorizou usinagem. previsão de chuva às 22 horas")).categoria).toBe("Usina");
  });
});

describe("calcularDiasPorObra", () => {
  const rows = [
    sem("2026-10-05", "G", "Outro", "Obra embargada, chuva"), sem("2026-10-05", "B", "Chuva"),
    sem("2026-10-06", "G", "Chuva"), sem("2026-10-06", "B", "Chuva"),
    r("2026-10-07", "G", { houve_producao: true, cbuq_fx3_ton: 300 }), r("2026-10-07", "B", { houve_producao: false, motivo_sem_producao: "Folga / Feriado" }),
    r("2026-10-08", "G", { houve_producao: true, cbuq_fx3_ton: 100.5, choveu: true }),
    // 09/10: Brunno não lançou
    sem("2026-10-09", "G", "Chuva"),
    sem("2026-10-10", "G", "Folga / Feriado"), sem("2026-10-10", "B", "Folga / Feriado"),
  ];
  const [obra] = calcularDiasPorObra(rows, { periodo: { inicio: "2026-10-01", fim: "2026-10-10" }, ultimoDiaEsperado: "2026-10-31" });
  it("conta DIAS e não RDOs", () => {
    expect(obra.diasNoPeriodo).toBe(6);
    expect(obra.diasTrabalhados).toBe(2);
    expect(obra.porCategoria.find(c => c.categoria === "Chuva")?.dias).toBe(3);
  });
  it("soma produção só dos dias trabalhados", () => { expect(obra.producao.ton).toBeCloseTo(400.5); });
  it("aponta o engenheiro que não preencheu", () => {
    expect(obra.faltas).toEqual([{ ogs: "2539", engenheiroId: "B", datas: ["2026-10-08", "2026-10-09"] }]);
  });
  it("dia trabalhado com chuva é sinalizado", () => {
    expect(obra.dias.find(d => d.data === "2026-10-08")?.choveuMasProduziu).toBe(true);
  });
  it("hoje (sem fechar o dia) não gera falta", () => {
    const [o] = calcularDiasPorObra(rows, { periodo: { inicio: "2026-10-01", fim: "2026-10-10" }, ultimoDiaEsperado: "2026-10-08" });
    expect(o.faltas.flatMap(f => f.datas)).toEqual(["2026-10-08"]);
  });
});
