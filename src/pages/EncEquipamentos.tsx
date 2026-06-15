import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, HardHat, Loader2 } from "lucide-react";

interface DiarioEquip {
  id: string;
  frota: string;
  tipo: string;
  sub_tipo?: string;
  obra_nome?: string;
  data: string;
  created_by_name?: string;
}

export default function EncEquipamentos() {
  const navigate = useNavigate();
  const [diarios, setDiarios] = useState<DiarioEquip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar OGSs vinculadas ao encarregado
      const { data: vinculos } = await (supabase as any)
        .from("encarregado_ogs")
        .select("ogs_id, ogs_reference(ogs_number)")
        .eq("encarregado_id", user.id)
        .eq("ativo", true);

      const ogsNumbers = (vinculos || [])
        .map((v: any) => v.ogs_reference?.ogs_number)
        .filter(Boolean);

      if (ogsNumbers.length === 0) {
        setLoading(false);
        return;
      }

      // Buscar diários de equipamentos das obras vinculadas
      // obra_nome nos diários é uma string livre que geralmente contém o número da OGS
      const { data: items } = await (supabase as any)
        .from("equipment_diaries")
        .select("id, frota, tipo, sub_tipo, obra_nome, data, created_by_name")
        .order("data", { ascending: false })
        .limit(100);

      // Filtrar pelos registros que pertencem às OGS do encarregado
      // (equipment_diaries pode não ter ogs_id, filtrar por obra_nome contendo número da OGS)
      const filtrados = (items || []).filter((d: DiarioEquip) => {
        const nome = (d.obra_nome || "").toUpperCase();
        return ogsNumbers.some((num: string) => nome.includes(num.toUpperCase()));
      });

      setDiarios(filtrados);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/encarregado")} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Equipamentos da Equipe</h1>
            <p className="text-xs text-muted-foreground">Diários das suas obras</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : diarios.length === 0 ? (
          <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground text-center">
            Nenhum diário de equipamento encontrado para suas obras.
          </div>
        ) : (
          <div className="space-y-2">
            {diarios.map(d => (
              <div key={d.id} className="p-3 rounded-xl bg-white border border-border shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{d.frota}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {(d.sub_tipo || d.tipo) && (
                    <span className="bg-muted px-2 py-0.5 rounded-full">{d.sub_tipo || d.tipo}</span>
                  )}
                  {d.obra_nome && <span>{d.obra_nome}</span>}
                  {d.created_by_name && <span>· {d.created_by_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
