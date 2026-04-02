import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MessageCircle, Phone, Truck, Users, Sun, Moon, HelpCircle } from "lucide-react";

interface StaffMember {
  id: string;
  nome: string;
  funcao: string;
  telefone: string | null;
  turno: string;
  ativo: boolean;
}

interface EquipmentFleet {
  id: string;
  fleet_number: string | null;
  equipment_type: string | null;
}

function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function WhatsAppButton({ phone }: { phone: string | null }) {
  const clean = cleanPhone(phone);
  if (!clean) return <span className="text-xs text-muted-foreground">Sem telefone</span>;

  const fullNumber = clean.startsWith("55") ? clean : `55${clean}`;
  const message = encodeURIComponent("Olá, aqui é do Canteiro Inteligente. Tudo bem?");
  const url = `https://wa.me/${fullNumber}?text=${message}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      WhatsApp
    </a>
  );
}

function TurnoBadge({ turno }: { turno: string }) {
  if (turno === "dia") {
    return (
      <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 gap-1">
        <Sun className="h-3 w-3" /> Dia
      </Badge>
    );
  }
  if (turno === "noite") {
    return (
      <Badge className="bg-purple-500/15 text-purple-700 border-purple-300 dark:text-purple-300 gap-1">
        <Moon className="h-3 w-3" /> Noite
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <HelpCircle className="h-3 w-3" /> Indefinido
    </Badge>
  );
}

export default function Diretorio() {
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [equipment, setEquipment] = useState<EquipmentFleet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [staffRes, equipRes] = await Promise.all([
        supabase.from("aero_pav_gru_staff").select("*").eq("ativo", true).order("nome"),
        supabase.from("equipment_fleets").select("*").order("fleet_number"),
      ]);
      if (staffRes.data) setStaff(staffRes.data as StaffMember[]);
      if (equipRes.data) setEquipment(equipRes.data as EquipmentFleet[]);
      setLoading(false);
    }
    load();
  }, []);

  const q = search.toLowerCase().trim();

  const filteredStaff = q
    ? staff.filter(
        (s) =>
          s.nome.toLowerCase().includes(q) ||
          s.funcao.toLowerCase().includes(q)
      )
    : staff;

  const filteredEquip = q
    ? equipment.filter(
        (e) =>
          (e.fleet_number || "").toLowerCase().includes(q) ||
          (e.equipment_type || "").toLowerCase().includes(q)
      )
    : equipment;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Diretório</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, função ou frota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        <Tabs defaultValue="funcionarios">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="funcionarios" className="gap-1.5">
              <Users className="h-4 w-4" /> Funcionários
            </TabsTrigger>
            <TabsTrigger value="equipamentos" className="gap-1.5">
              <Truck className="h-4 w-4" /> Equipamentos
            </TabsTrigger>
          </TabsList>

          {/* ── Funcionários ── */}
          <TabsContent value="funcionarios" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : filteredStaff.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {filteredStaff.length} resultado{filteredStaff.length !== 1 ? "s" : ""}
                </p>
                {filteredStaff.map((s) => (
                  <Card key={s.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-sm text-foreground truncate">{s.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.funcao || "—"}</p>
                        <TurnoBadge turno={s.turno} />
                      </div>
                      <div className="shrink-0">
                        <WhatsAppButton phone={s.telefone} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* ── Equipamentos ── */}
          <TabsContent value="equipamentos" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : filteredEquip.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum equipamento encontrado.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {filteredEquip.length} resultado{filteredEquip.length !== 1 ? "s" : ""}
                </p>
                {filteredEquip.map((e) => (
                  <Card key={e.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-sm text-foreground">
                          Frota: {e.fleet_number || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.equipment_type || "—"}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        <Truck className="h-3 w-3 mr-1" /> Ativo
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
