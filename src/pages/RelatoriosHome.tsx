import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BarChart3, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FrotaItem {
  equipment_fleet: string;
  equipment_type: string;
  ultimo_diario: string;
}

export default function RelatoriosHome() {
  const navigate = useNavigate();
  const [frotas, setFrotas] = useState<FrotaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    supabase
      .from("equipment_diaries")
      .select("equipment_fleet, equipment_type, date")
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const seen = new Set<string>();
        const unicas: FrotaItem[] = [];
        data.forEach(d => {
          if (!seen.has(d.equipment_fleet)) {
            seen.add(d.equipment_fleet);
            unicas.push({ equipment_fleet: d.equipment_fleet, equipment_type: d.equipment_type, ultimo_diario: d.date });
          }
        });
        setFrotas(unicas);
        setLoading(false);
      });
  }, []);

  const filtradas = frotas.filter(f =>
    f.equipment_fleet.toLowerCase().includes(busca.toLowerCase()) ||
    f.equipment_type?.toLowerCase().includes(busca.toLowerCase())
  );

  function fmtDate(d: string) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)]">
      <header className="flex items-center gap-3 px-4 py-3 bg-header-gradient shadow-lg">
        <button onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/15 p-2 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="block font-display font-extrabold text-sm text-primary-foreground">WF Relatórios</span>
          <span className="block text-[11px] text-primary-foreground/80">Relatórios por Equipamento</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar frota ou tipo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9 h-11 rounded-xl"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum equipamento com diários</p>
          </div>
        ) : (
          filtradas.map(f => (
            <button
              key={f.equipment_fleet}
              onClick={() => navigate(`/relatorios/equipamento/${f.equipment_fleet}`)}
              className="w-full text-left rdo-card hover:shadow-md transition-all flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm">{f.equipment_fleet}</p>
                <p className="text-xs text-muted-foreground">{f.equipment_type} · Último diário: {fmtDate(f.ultimo_diario)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
