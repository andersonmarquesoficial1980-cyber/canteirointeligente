import { createClient } from "jsr:@supabase/supabase-js@2";

const COMPANY_NAME = "Fremix Pavimentação";
const BUCKET_NAME  = "exports";
const FILE_PATH    = "nf-massa/NF_Massa_Fremix.csv";

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const PREFIXO: Record<string, string> = {
  "ELLENCO": "ELL", "JULIO E JULIO": "JUJ", "JÚLIO E JÚLIO": "JUJ",
  "AUPAV": "AUP", "USICITY": "USI",
  "USINAS SP PAVIMENTACAO E TECNOLOGIA LTDA": "USP",
  "USINAS SP PAVIMENTAÇÃO E TECNOLOGIA LTDA": "USP",
};

function prefixoUsina(u: string | null): string {
  if (!u) return "";
  const k = u.trim().toUpperCase();
  return PREFIXO[k] || u.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]/gi,"").toUpperCase().slice(0,3);
}

function nf(n: string | null, u: string | null): string {
  if (!n) return "-";
  const p = prefixoUsina(u);
  return p ? `${p}-${n}` : n;
}

function fmtN(n: number | null): string {
  return n == null ? "-" : n.toFixed(2).replace(".", ",");
}

function q(v: any): string {
  return `"${String(v ?? "-").replace(/"/g, '""')}"`; 
}

Deno.serve(async (_req) => {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. company_id
    const { data: cos } = await sb.from("companies").select("id").ilike("name", `%${COMPANY_NAME}%`).limit(1);
    if (!cos?.length) throw new Error("Empresa nao encontrada");
    const cid = cos[0].id;

    // 2. Periodo 01/01/ano ate hoje
    const today  = new Date();
    const ini    = `${today.getFullYear()}-01-01`;
    const fim    = today.toISOString().split("T")[0];

    // 3. RDOs
    const { data: rdos, error: e1 } = await sb
      .from("rdo_diarios")
      .select("id, obra_nome, data, encarregado, preenchido_por")
      .eq("company_id", cid).gte("data", ini).lte("data", fim);
    if (e1) throw e1;
    if (!rdos?.length) return new Response(JSON.stringify({ ok: true, registros: 0 }), { headers: { "Content-Type": "application/json" } });

    const rdoIds = rdos.map((r: any) => r.id);
    const rdoMap: Record<string, any> = {};
    rdos.forEach((r: any) => { rdoMap[r.id] = r; });

    // 4. OGS
    const ogsNums = [...new Set(rdos.map((r: any) => r.obra_nome).filter(Boolean))];
    const ogsMap: Record<string, any> = {};
    if (ogsNums.length) {
      const { data: ogsR } = await sb.from("ogs_reference")
        .select("ogs_number, client_name, location_address")
        .eq("company_id", cid).in("ogs_number", ogsNums);
      (ogsR || []).forEach((o: any) => { ogsMap[o.ogs_number] = o; });
    }

    // 5. NFs
    const { data: nfs, error: e2 } = await sb
      .from("rdo_nf_massa").select("rdo_id, nf, placa, usina, tonelagem, tipo_material")
      .in("rdo_id", rdoIds);
    if (e2) throw e2;

    // 6. Montar rows
    const rows = (nfs || []).map((n: any) => {
      const r = rdoMap[n.rdo_id];
      const o = ogsMap[r?.obra_nome];
      return {
        data: r?.data || "", apontador: r?.preenchido_por || r?.encarregado || "-",
        encarregado: r?.encarregado || "-", obra: r?.obra_nome || "-",
        contratante: o?.client_name || "-", local: o?.location_address || "-",
        nf_num: nf(n.nf, n.usina), placa: n.placa || "-", usina: n.usina || "-",
        tipo: n.tipo_material || "-",
        ton: n.tonelagem != null ? parseFloat(String(n.tonelagem)) : null,
      };
    });
    rows.sort((a: any, b: any) => a.data.localeCompare(b.data) || a.nf_num.localeCompare(b.nf_num));
    const total = rows.reduce((s: number, r: any) => s + (r.ton || 0), 0);

    // 7. CSV
    const gerado = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const csv = [
      q("Relatorio de Notas Fiscais de Massa - Fremix Pavimentacao"),
      q(`Periodo: ${fmtDate(ini)} a ${fmtDate(fim)}`),
      q(`Gerado em: ${gerado}`),
      "",
      ["Data","Apontador","Encarregado","OGS","Contratante","Local","NF","Placa","Usina","Tipo Material","Tonelagem(t)"].map(q).join(";"),
      ...rows.map((r: any) => [fmtDate(r.data),r.apontador,r.encarregado,r.obra,r.contratante,r.local,r.nf_num,r.placa,r.usina,r.tipo,fmtN(r.ton)].map(q).join(";")),
      ["","","","","","","","","","",fmtN(total)].map(q).join(";"),
    ].join("\n");

    // 8. Upload Supabase Storage (sobrescreve sempre o mesmo arquivo)
    const csvBytes = new TextEncoder().encode("\uFEFF" + csv);
    const { error: upErr } = await sb.storage
      .from(BUCKET_NAME)
      .upload(FILE_PATH, csvBytes, {
        contentType: "text/csv;charset=utf-8",
        upsert: true,
      });
    if (upErr) throw upErr;

    // 9. URL publica permanente
    const { data: urlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(FILE_PATH);

    const res = { ok: true, registros: rows.length, total_toneladas: total.toFixed(2),
      periodo: `${fmtDate(ini)} a ${fmtDate(fim)}`, gerado_em: gerado,
      url_download: urlData.publicUrl };
    console.log("OK:", JSON.stringify(res));
    return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ERRO:", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});