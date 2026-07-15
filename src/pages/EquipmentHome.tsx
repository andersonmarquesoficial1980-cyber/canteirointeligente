import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { LogOut, ChevronRight, FileSpreadsheet, ClipboardList, Truck, MapPin, ExternalLink, Clock } from "lucide-react";
import { LogoHomeButton } from "@/components/LogoHomeButton";

import imgFresadora from "@/assets/equip-fresadora.png";
import imgBobcat from "@/assets/equip-bobcat.webp";
import imgRolo from "@/assets/equip-rolo.png";
import imgVibro from "@/assets/equip-vibroacabadora.png";
import imgKma from "@/assets/equip-kma.png";
import imgCaminhao from "@/assets/equip-caminhao.jpg";
import imgComboio from "@/assets/equip-comboio.png";
import imgVeiculo from "@/assets/equip-veiculo.png";
import imgRetro from "@/assets/equip-retro.webp";
import imgCarreta from "@/assets/equip-carreta.avif";

const EQUIPMENT_TYPES = [
  { id: "Fresadora", label: "Fresadora", img: imgFresadora },
  { id: "Bobcat", label: "Bobcat", img: imgBobcat },
  { id: "Rolo", label: "Rolo Compactador", img: imgRolo },
  { id: "Vibroacabadora", label: "Vibroacabadora", img: imgVibro },
  { id: "Usina KMA", label: "Usina Móvel KMA", img: imgKma },
  { id: "Caminhões", label: "Caminhões", img: imgCaminhao },
  { id: "Veículo", label: "Veículo de Transporte", img: imgVeiculo },
  { id: "Retro", label: "Linha Amarela", img: imgRetro },
  { id: "Carreta", label: "Carreta", img: imgCarreta },
];

interface OrdemTransporte {
  id: string;
  titulo: string;
  origem?: string | null;
  origem_maps?: string | null;
  destino?: string | null;
  destino_maps?: string | null;
  horario_transporte?: string | null;
  equipamentos_json?: any[];
  observacoes?: string | null;
  status: string;
  created_at: string;
  urgencia?: string | null;
}

function OrdemTransporteCard({ ordem }: { ordem: OrdemTransporte }) {
  const equipamentos: any[] = Array.isArray(ordem.equipamentos_json) ? ordem.equipamentos_json : [];
  const urgenciaColor = ordem.urgencia === "urgente" ? "text-red-500" : ordem.urgencia === "alta" ? "text-orange-400" : "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className="w-4 h-4 text-primary shrink-0" />
          <span className="font-bold text-sm text-foreground truncate">{ordem.titulo}</span>
        </div>
        <span className={`text-[11px] font-semibold uppercase shrink-0 ${urgenciaColor}`}>
          {ordem.urgencia || "normal"}
        </span>
      </div>

      {ordem.horario_transporte && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold">{ordem.horario_transporte}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {ordem.origem && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">🔴 Origem</p>
            <p className="text-xs font-medium">{ordem.origem}</p>
            {ordem.origem_maps && (
              <a href={ordem.origem_maps} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                <MapPin className="w-3 h-3" /> Maps <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}
        {ordem.destino && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">🟢 Destino</p>
            <p className="text-xs font-medium">{ordem.destino}</p>
            {ordem.destino_maps && (
              <a href={ordem.destino_maps} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                <MapPin className="w-3 h-3" /> Maps <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {equipamentos.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">🚧 Equipamentos</p>
          <div className="flex flex-wrap gap-1">
            {equipamentos.map((eq: any, i: number) => (
              <span key={i} className="text-[11px] bg-secondary border border-border rounded-lg px-2 py-0.5 font-medium">
                {eq.frota} {eq.nome ? `— ${eq.nome}` : eq.tipo ? `(${eq.tipo})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {ordem.observacoes && (
        <p className="text-xs text-muted-foreground italic">📝 {ordem.observacoes}</p>
      )}
    </div>
  );
}

export default function EquipmentHome() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const { isAdmin } = useIsAdmin();
  const [equipamentosPermitidos, setEquipamentosPermitidos] = useState<string[]>([]);
  const [ordens, setOrdens] = useState<OrdemTransporte[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);

  const temOrdens = equipamentosPermitidos.includes("ordens_transporte");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [permsRes, profileRes] = await Promise.all([
        supabase.from("user_permissions").select("equipamentos_permitidos, is_admin")
          .eq("user_id", user.id).single(),
        supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!permsRes.data?.is_admin && permsRes.data?.equipamentos_permitidos?.length > 0) {
        setEquipamentosPermitidos(permsRes.data.equipamentos_permitidos);
      }
      if (profileRes.data?.id) setProfileId(profileRes.data.id);
    });
  }, []);

  // Busca ordens de transporte endereçadas ao usuário
  useEffect(() => {
    if (!temOrdens || !profileId) return;

    const buscar = async () => {
      const [{ data: d1 }, { data: d2 }] = await Promise.all([
        (supabase as any).from("demandas")
          .select("id,titulo,origem,origem_maps,destino,destino_maps,horario_transporte,equipamentos_json,observacoes,status,created_at,urgencia")
          .eq("tipo", "transporte")
          .eq("funcionario_solicitado_id", profileId)
          .neq("status", "cancelada")
          .order("created_at", { ascending: false }),
        (supabase as any).from("demandas")
          .select("id,titulo,origem,origem_maps,destino,destino_maps,horario_transporte,equipamentos_json,observacoes,status,created_at,urgencia")
          .eq("tipo", "transporte")
          .contains("viewed_by", [profileId])
          .neq("status", "cancelada")
          .order("created_at", { ascending: false }),
      ]);

      const merged = [...(d1 || []), ...(d2 || [])];
      const seen = new Set<string>();
      const unique = merged.filter((d: any) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
      unique.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrdens(unique as OrdemTransporte[]);
    };

    buscar();
  }, [temOrdens, profileId]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  const handleSelect = (typeId: string) => {
    navigate(`/equipamentos/diario?tipo=${encodeURIComponent(typeId)}`);
  };

  // Filtra tipos de equipamento excluindo a flag "ordens_transporte"
  const tiposFiltrados = EQUIPMENT_TYPES.filter(eq => {
    const permitidos = equipamentosPermitidos.filter(p => p !== "ordens_transporte");
    return permitidos.length === 0 || permitidos.includes(eq.id);
  });

  return (
    <div className="min-h-screen bg-[hsl(210_20%_98%)] flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-header-gradient shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative">
              <LogoHomeButton className="h-11 object-contain drop-shadow-lg" />
              <div className="absolute inset-0 rounded-full bg-white/20 blur-md -z-10 scale-110" />
            </div>
            <div>
              <span className="block font-display font-extrabold text-sm text-primary-foreground leading-tight">Workflux</span>
              <span className="block text-[11px] text-primary-foreground/80 font-medium leading-tight">Gestão de Equipamentos</span>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loggingOut} className="text-primary-foreground hover:bg-white/15">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">

        {/* Ordens de Transporte — só para quem tem permissão "ordens_transporte" */}
        {temOrdens && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-display font-extrabold text-[hsl(215_80%_22%)]">Ordens de Transporte</h2>
              {ordens.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary font-bold rounded-full px-2 py-0.5">{ordens.length}</span>
              )}
            </div>
            {ordens.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
                Nenhuma ordem de transporte pendente para você.
              </div>
            ) : (
              ordens.map(o => <OrdemTransporteCard key={o.id} ordem={o} />)
            )}
          </div>
        )}

        {/* Cards de tipo de equipamento */}
        <div>
          <h2 className="text-2xl font-display font-extrabold text-[hsl(215_80%_22%)] mb-5 text-center">
            Selecione o Equipamento
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {tiposFiltrados.map((eq) => (
              <button
                key={eq.id}
                onClick={() => handleSelect(eq.id)}
                className="group flex items-center gap-3 rounded-2xl bg-white border border-border p-3 hover:border-primary hover:shadow-[0_4px_24px_-4px_hsl(215_80%_50%/0.25)] hover:scale-[1.02] transition-all duration-200 cursor-pointer shadow-[0_2px_12px_-2px_hsl(215_20%_50%/0.12)] text-left"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/40 group-hover:border-primary transition-colors">
                    <img src={eq.img} alt={eq.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-primary/15 blur-md -z-10 scale-125 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-display font-extrabold text-[hsl(215_80%_22%)] leading-tight truncate">
                    {eq.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-12 gap-2 text-sm font-semibold"
          onClick={() => navigate("/meus-lancamentos")}
        >
          <ClipboardList className="w-5 h-5" />
          Meus Lançamentos
        </Button>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground text-sm font-semibold"
          onClick={() => navigate("/")}
        >
          ← Voltar ao Hub
        </Button>
      </div>
    </div>
  );
}
