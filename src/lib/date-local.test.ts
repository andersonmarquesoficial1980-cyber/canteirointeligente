import { describe, expect, it } from "vitest";
import { toSaoPauloISODate } from "./date-local";

describe("toSaoPauloISODate", () => {
  it("mantém a data brasileira quando UTC já avançou ao dia seguinte", () => {
    expect(toSaoPauloISODate(new Date("2026-10-03T01:01:00Z"))).toBe("2026-10-02");
  });

  it("avança para o dia seguinte depois da meia-noite em São Paulo", () => {
    expect(toSaoPauloISODate(new Date("2026-10-03T03:01:00Z"))).toBe("2026-10-03");
  });
});
