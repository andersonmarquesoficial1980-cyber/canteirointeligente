import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench } from "lucide-react";

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface ResultRow {
  data: string;
  obra_nome: string;
  frota: string;
  categoria: string | null;
  tipo: string | null;
  nome: string | null;
  empresa_dona: string | null;
  turno: string | null;
}

export default function RelatorioEquipamentosRdo() {
  const navigate = useNavigate();
  const [frota, setFrota] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [searched, setSearched] = useState(false);

  const buscar = async () => {
    if (!frota.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await (supabase as any)
        .from("rdo_equipamentos")
        .select("frota, categoria, tipo, nome, empresa_dona, rdo_id, rdo_diarios(data, obra_nome, turno)")
        .ilike("frota", `%${frota.trim()}%`);

      if (error) throw error;

      let result: ResultRow[] = (data || []).map((r: any) => ({
        data: r.rdo_diarios?.data || "",
        obra_nome: r.rdo_diarios?.obra_nome || "",
        frota: r.frota || "",
        categoria: r.categoria || null,
        tipo: r.tipo || null,
        nome: r.nome || null,
        empresa_dona: r.empresa_dona || null,
        turno: r.rdo_diarios?.turno || null,
      }));

      if (dataIni) result = result.filter(r => r.data >= dataIni);
      if (dataFim) result = result.filter(r => r.data <= dataFim);
      result.sort((a, b) => b.data.localeCompare(a.data));
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
          <Wrench className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Localização de Equipamentos (RDO)</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Frota *</label>
            <Input
              value={frota}
              onChange={e => setFrota(e.target.value)}
              onKeyDown={e => e.key === "Enter" && buscar()}
              placeholder="Ex: FA12, BC75, VA20..."
              className="h-11 bg-secondary border-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Início</label>
              <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Fim</label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 bg-secondary border-border" />
            </div>
          </div>
          <Button onClick={buscar} disabled={loading || !frota.trim()} className="w-full h-11 gap-2">
            <Search className="w-4 h-4" /> {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        {searched && !loading && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">{rows.length} registro(s) encontrado(s)</p>
            {rows.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado para "{frota}".
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Data</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">OGS</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Frota</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Equipamento</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Turno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-3 py-2 font-medium">{fmtDate(r.data)}</td>
                        <td className="px-3 py-2 text-primary font-semibold">{r.obra_nome}</td>
                        <td className="px-3 py-2 font-bold">{r.frota}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.tipo || r.categoria || "-"} {r.nome ? `— ${r.nome}` : ""}</td>
                        <td className="px-3 py-2 text-xs capitalize">{r.turno || "-"}</td>
                      </tr>
                    ))}
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
