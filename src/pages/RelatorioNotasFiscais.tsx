import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, FileText } from "lucide-react";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtNum(n: any) {
  const v = parseFloat(String(n ?? "").replace(",", "."));
  return isNaN(v) ? "-" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface NfRow {
  data: string;
  obra_nome: string;
  nf: string | null;
  placa: string | null;
  usina: string | null;
  tonelagem: number | null;
  tipo_material: string | null;
}

export default function RelatorioNotasFiscais() {
  const navigate = useNavigate();
  const [ogs, setOgs] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<NfRow[]>([]);
  const [searched, setSearched] = useState(false);

  const totalTon = rows.reduce((s, r) => s + (r.tonelagem || 0), 0);

  const buscar = async () => {
    if (!dataIni || !dataFim) return;
    setLoading(true);
    setSearched(true);
    try {
      // Busca RDOs no período
      let rdoQuery = (supabase as any)
        .from("rdo_diarios")
        .select("id, obra_nome, data")
        .gte("data", dataIni)
        .lte("data", dataFim);

      if (ogs.trim()) rdoQuery = rdoQuery.ilike("obra_nome", `%${ogs.trim()}%`);

      const { data: rdos, error: rdoErr } = await rdoQuery;
      if (rdoErr) throw rdoErr;

      if (!rdos || rdos.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const rdoIds = rdos.map((r: any) => r.id);
      const rdoMap: Record<string, { data: string; obra_nome: string }> = {};
      rdos.forEach((r: any) => { rdoMap[r.id] = { data: r.data, obra_nome: r.obra_nome }; });

      // Busca NFs desses RDOs
      const { data: nfs, error: nfErr } = await (supabase as any)
        .from("rdo_nf_massa")
        .select("rdo_id, nf, placa, usina, tonelagem, tipo_material")
        .in("rdo_id", rdoIds);

      if (nfErr) throw nfErr;

      const result: NfRow[] = (nfs || []).map((n: any) => ({
        data: rdoMap[n.rdo_id]?.data || "",
        obra_nome: rdoMap[n.rdo_id]?.obra_nome || "",
        nf: n.nf || null,
        placa: n.placa || null,
        usina: n.usina || null,
        tonelagem: n.tonelagem != null ? parseFloat(String(n.tonelagem)) : null,
        tipo_material: n.tipo_material || null,
      }));

      result.sort((a, b) => b.data.localeCompare(a.data) || (a.nf || "").localeCompare(b.nf || ""));
      setRows(result);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/relatorios")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Notas Fiscais de Massa</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OGS (opcional)</label>
            <Input
              value={ogs}
              onChange={e => setOgs(e.target.value)}
              placeholder="Ex: 2532 — deixe vazio para todas"
              className="h-11 bg-secondary border-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Início *</label>
              <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Fim *</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
          <Button onClick={buscar} disabled={loading || !dataIni || !dataFim} className="w-full h-11 gap-2">
            <Search className="w-4 h-4" /> {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {searched && !loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground">{rows.length} nota(s) encontrada(s)</p>
              {rows.length > 0 && (
                <p className="text-sm font-bold text-primary">Total: {fmtNum(totalTon)} t</p>
              )}
            </div>
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma nota fiscal encontrada no período.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Data</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">OGS</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">NF</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Placa</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Usina</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Ton</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-3 py-2 font-medium">{fmtDate(r.data)}</td>
                        <td className="px-3 py-2 text-primary font-semibold text-xs">{r.obra_nome}</td>
                        <td className="px-3 py-2 font-bold">{r.nf || "-"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground uppercase">{r.placa || "-"}</td>
                        <td className="px-3 py-2 text-xs">{r.usina || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtNum(r.tonelagem)}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 border-t border-border">
                      <td colSpan={5} className="px-3 py-2 font-bold text-sm text-right">TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold text-primary">{fmtNum(totalTon)} t</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
