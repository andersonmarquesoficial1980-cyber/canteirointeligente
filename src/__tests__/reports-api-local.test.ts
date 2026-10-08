import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import ts from "typescript";
import { resolve } from "node:path";

// Run the real Edge Function handlers without executing its remote Deno imports/server.
const source = readFileSync(resolve(process.cwd(), "supabase/functions/reports-api-v1/index.ts"), "utf8")
  .replace(/^import .*;\s*$/gm, "")
  .replace(/^serve\(async \(req: Request\) => \{[\s\S]*$/m, "");
const js = ts.transpileModule(`${source}\nglobalThis.handlers = { handleRdoFremix, handleRdoDetails };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const context = createContext({ URL, Date, Number, String, Set, Map, Promise, crypto });
new Script(js).runInContext(context);
const { handleRdoFremix, handleRdoDetails } = context.handlers as {
  handleRdoFremix: (sb: any, company: string, url: URL) => Promise<any>;
  handleRdoDetails: (sb: any, company: string, url: URL) => Promise<any>;
};

function fakeDb() {
  const records: Record<string, any[]> = {
    rdo_diarios: [
      { id: "rdo-1", company_id: "fremix", data: "2026-10-01", obra_nome: "2539", local: "RODOVIA SP-270", status_validacao: "aprovado", tipo_rdo: "CAUQ" },
      { id: "rdo-2", company_id: "fremix", data: "2026-10-02", obra_nome: "2539", local: "RODOVIA SP-264", status_validacao: "aprovado", tipo_rdo: "CAUQ" },
      { id: "rdo-3", company_id: "fremix", data: "2026-10-01", obra_nome: "2545", local: null, status_validacao: "aprovado", tipo_rdo: "CAUQ" },
      { id: "rdo-4", company_id: "fremix", data: "2026-10-01", obra_nome: "2539", local: null, status_validacao: "aprovado", tipo_rdo: "CAUQ" },
      { id: "rdo-5", company_id: "fremix", data: "2026-10-01", obra_nome: "2509", local: null, status_validacao: "aprovado", tipo_rdo: "CAUQ" },
      { id: "rdo-6", company_id: "fremix", data: "2026-10-01", obra_nome: "2545 ", local: null, status_validacao: "aprovado", tipo_rdo: "CAUQ" },
    ],
    ogs_reference: [
      { id: "ogs-1", company_id: "fremix", ogs_number: "2539", location_address: "RODOVIA SP-270;RODOVIA SP-280;RODOVIA SP-075;RODOVIA SP-264", client_name: "MOTIVA" },
      { id: "ogs-2", company_id: "fremix", ogs_number: "2545", location_address: "AV. PAVÃO", client_name: "CLIENTE" },
      { id: "ogs-3", company_id: "fremix", ogs_number: "2509", location_address: "DIVERSAS RUAS PMSP", client_name: "CLIENTE" },
    ],
    rdo_nf_massa: [
      { id: "nf-1", rdo_id: "rdo-1", nf: "208892", usina: "JÚLIO e JÚLIO" },
      { id: "nf-2", rdo_id: "rdo-2", nf: "208942", usina: "JÚLIO e JÚLIO" },
      { id: "nf-3", rdo_id: "rdo-3", nf: "2545-1" },
      { id: "nf-4", rdo_id: "rdo-4", nf: "2539-1" },
      { id: "nf-5", rdo_id: "rdo-5", nf: "2509-1" },
      { id: "nf-6", rdo_id: "rdo-6", nf: "2545-2" },
    ],
    rdo_nf_concreto: [{ id: "concreto-1", rdo_id: "rdo-2" }],
    rdo_producao: [{ id: "producao-1", company_id: "fremix", rdo_id: "rdo-1", tipo_servico: "CAUQ" }],
    rdo_equipamentos: [{ id: "equip-1", company_id: "fremix", rdo_id: "rdo-2", frota: "EQ01" }],
    equipment_diaries: [],
    terceiros_medicoes: [],
  };
  return {
    from(table: string) {
      let rows = records[table] || [];
      let selected: string[] = [];
      const query: any = {
        select(fields: string) {
          // PostgREST filters can reference columns outside the selected projection.
          selected = fields.split(",").map(s => s.trim());
          return query;
        },
        eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query; },
        gte(key: string, value: string) { rows = rows.filter(row => row[key] >= value); return query; },
        lte(key: string, value: string) { rows = rows.filter(row => row[key] <= value); return query; },
        in(key: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[key])); return query; },
        or() { return query; },
        order() { return query; },
        range(start: number, end: number) { rows = rows.slice(start, end + 1); return query; },
        then(resolve: (value: any) => void, reject?: (error: any) => void) {
          const data = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => selected.includes(key))));
          return Promise.resolve({ data, count: rows.length, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const url = new URL("https://example.com/reports-api-v1/rdo-fremix?start_date=2026-10-01&end_date=2026-10-02");

describe("RDO-FREMIX local do lançamento", () => {
  it("retorna a rodovia escolhida em cada RDO nas notas de massa, não a lista da OGS", async () => {
    const result = await handleRdoFremix(fakeDb(), "fremix", url);
    const notas = result.secoes.notas_fiscais_massa.rows;
    expect(notas.find((n: any) => n.nf_numero === "208892").local).toBe("RODOVIA SP-270");
    expect(notas.find((n: any) => n.nf_numero === "208942").local).toBe("RODOVIA SP-264");
  });

  it("usa o local do RDO para concreto, produção e equipamento vinculado", async () => {
    const secoes = (await handleRdoFremix(fakeDb(), "fremix", url)).secoes;
    expect(secoes.notas_fiscais_concreto.rows[0].local_aplicacao).toBe("RODOVIA SP-264");
    expect(secoes.producao_rdos.rows[0].local).toBe("RODOVIA SP-270");
    expect(secoes.equipamentos_rdo.rows[0].local).toBe("RODOVIA SP-264");
  });

  it("recupera endereço único do cadastro para RDO antigo sem local, sem inventar local multivalorado ou livre", async () => {
    const rows = (await handleRdoFremix(fakeDb(), "fremix", url)).secoes.notas_fiscais_massa.rows;
    const local = (nf: string) => rows.find((r: any) => r.nf_numero === nf)?.local;
    expect(local("2545-1")).toBe("AV. PAVÃO");
    expect(local("2545-2")).toBe("AV. PAVÃO");
    expect(local("2539-1")).toBeNull();
    expect(local("2509-1")).toBeNull();
  });

  it("inclui o local escolhido também em rdo/details", async () => {
    const result = await handleRdoDetails(fakeDb(), "fremix", url);
    expect(result.rows.filter((r: any) => r.local).map((r: any) => r.local)).toEqual(["RODOVIA SP-270", "RODOVIA SP-264"]);
  });
});
