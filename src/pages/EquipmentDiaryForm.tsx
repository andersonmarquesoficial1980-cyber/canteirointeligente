import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOgsReference } from "@/hooks/useOgsReference";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Send, Save, Plus, Trash2, Droplets, Fuel } from "lucide-react";
import EquipmentHeader from "@/components/equipment/EquipmentHeader";
import TimeEntriesSection, { type TimeEntry, createDefaultTimeEntry } from "@/components/equipment/TimeEntriesSection";
import KmaCalibrationSection, {
  type CalibrationEntry,
  createEmptyCalibration,
} from "@/components/equipment/KmaCalibrationSection";
import ProductionAreasSection, { type ProductionArea, createEmptyArea } from "@/components/equipment/ProductionAreasSection";
import BitManagementSection, { type BitEntry, createEmptyBit } from "@/components/equipment/BitManagementSection";
import FuelingSection, { type FuelingData, createEmptyFueling } from "@/components/equipment/FuelingSection";
import ComboioRefuelingSection, {
  type ComboioRefuelEntry,
  createEmptyComboioRefuel,
} from "@/components/equipment/ComboioRefuelingSection";
import ChecklistSection, { type ChecklistResult } from "@/components/equipment/ChecklistSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { compressImage } from "@/lib/imageCompression";
import { generateKmaPdf } from "@/lib/generateKmaPdf";
import { generateComboioPdf } from "@/lib/generateComboioPdf";
import { buildComboioEmailReport, buildCarretaEmailReport } from "@/lib/buildEquipmentEmailReport";

const WORK_STATUSES = ["Disposição", "Trabalhando", "Folga", "Cancelou", "Manutenção"] as const;

const BOBCAT_FLEETS = ["BC60", "BC66", "BC70", "BC75", "BC76", "BC77", "BC78", "BC79", "BC80"];
const RETRO_FLEETS = ["RT26", "RT27", "RT28", "RT29", "RT30"];
const VIBRO_FLEETS = ["VA01", "VA03", "VA04", "VA05", "VA17", "VA19", "VA20"];
const KMA_FLEETS = ["KMA01", "KMA02", "KMA03", "KMA04", "KMA05"];

const KMA_OPERATION_TYPES = ["Usinagem", "Limpeza", "Manutenção"] as const;
const CAP_TYPES = ["CAP 50/70", "CAP 30/45", "AMP 55/75", "AMP 60/85"];
const FILER_TYPES = ["Calcário", "Cal Hidratada", "Cimento Portland"];
const SILO_MATERIALS = ["Brita 0", "Brita 1", "Pedrisco", "Pó de Pedra", "Areia", "RAP"];
const AGUA_FORNECEDORES = ["Bica Amarildo", "Águas Barueri", "Olho D'agua"];

interface KmaOperationData {
  operationType: string;
  capType: string;
  capSupplier: string;
  capQtyTon: string;
  capNfNumber: string;
  filerType: string;
  filerSupplier: string;
  filerQtyTon: string;
  silo1Material: string;
  silo1Qty: string;
  silo2Material: string;
  silo2Qty: string;
  waterLiters: string;
  waterSupplier: string;
  aggregatesSupplier: string;
  totalVolumeMachinedTon: string;
}

function createEmptyKmaOperation(): KmaOperationData {
  return {
    operationType: "",
    capType: "",
    capSupplier: "",
    capQtyTon: "",
    capNfNumber: "",
    filerType: "",
    filerSupplier: "",
    filerQtyTon: "",
    silo1Material: "",
    silo1Qty: "",
    silo2Material: "",
    silo2Qty: "",
    waterLiters: "",
    waterSupplier: "",
    aggregatesSupplier: "",
    totalVolumeMachinedTon: "",
  };
}

const ROLO_TYPES = ["Rolo Chapa", "Rolo Pneu", "Rolo Pé de Carneiro"] as const;
const ROLO_FLEETS: Record<string, string[]> = {
  "Rolo Chapa": ["CH02", "CH04", "CH05", "CH06", "CH07"],
  "Rolo Pneu": ["PN05", "PN47", "PN48", "PN49", "PN50"],
  "Rolo Pé de Carneiro": ["PC01", "PC02", "PC03", "PC04", "PC05"],
};

const ATTACHMENT_TYPES = ["Vassoura Mecânica", "Fresadora Cônica"] as const;
const RETRO_ATTACHMENT_TYPES = ["Concha", "Rompedor"] as const;

// ── Caminhão configs ──
const CAMINHAO_TIPOS = ["Pipa", "Carroceria", "Espargidor"] as const;
const PIPA_FLEETS = ["CP01", "CP02", "CP03", "CP04", "CP05"];
const PIPA_FORNECEDORES = ["Bica Amarildo", "Águas Barueri", "Olho D'agua"];

const ESPARGIDOR_FLEETS = ["CE01", "CE02", "CE03", "CE04", "CE05"];
const ESPARGIDOR_FORNECEDORES = ["CBAA", "Greca", "Betunel", "Disbral"];
const EMULSION_TYPES = ["RR-1C", "RR-2C", "RM-1C", "RM-2C", "CM-30"];

const CARROCERIA_FLEETS = ["CC01", "CC02", "CC03", "CC04", "CC05"];

const COMBOIO_FLEETS = ["CO01", "CO02", "CO03", "CO04", "CO05"];

const CARRETA_CM_FLEETS = ["CM01", "CM02", "CM03", "CM04", "CM05"];

const VEICULO_TYPES = ["Micro-ônibus", "Van"] as const;
const VEICULO_FLEETS: Record<string, string[]> = {
  "Micro-ônibus": ["MCO01", "MCO02", "MCO03", "MCO04", "MCO05"],
  "Van": ["VT01", "VT02", "VT03", "VT04", "VT05"],
};

// ── Truck tank supply ──
interface TankSupplyEntry {
  id: string;
  quantity: string;
  supplier: string;
  emulsionType?: string;
  materialType?: string;
}

function createEmptyTankSupply(): TankSupplyEntry {
  return { id: crypto.randomUUID(), quantity: "", supplier: "", emulsionType: "", materialType: "" };
}

function getAttachmentIds(type: string): string[] {
  if (type === "Vassoura Mecânica") {
    return Array.from({ length: 30 }, (_, i) => `VM${70 + i}`);
  }
  if (type === "Fresadora Cônica") {
    return ["FC001", "FC002", "FC003", "FC004", "FC005"];
  }
  return [];
}

export default function EquipmentDiaryForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const equipmentType = searchParams.get("tipo") || "Fresadora";
  const isFresadora = equipmentType === "Fresadora";
  const isBobcat = equipmentType === "Bobcat";
  const isUsinaKma = equipmentType === "Usina KMA";
  const isRetro = equipmentType === "Retro";
  const isRolo = equipmentType === "Rolo";
  const isVibro = equipmentType === "Vibroacabadora";
  const isCaminhoes = equipmentType === "Caminhões";
  const isComboio = equipmentType === "Comboio";
  const isVeiculo = equipmentType === "Veículo";
  const isCarreta = equipmentType === "Carreta";

  // Caminhões sub-type state
  const [caminhaoTipo, setCaminhaoTipo] = useState("");
  const isPipa = isCaminhoes && caminhaoTipo === "Pipa";
  const isEspargidor = isCaminhoes && caminhaoTipo === "Espargidor";
  const isCarroceria = isCaminhoes && caminhaoTipo === "Carroceria";

  const isTruck = isCaminhoes || isComboio || isVeiculo || isCarreta;
  const usesOdometer = isTruck;
  const hasChecklist = isFresadora || isBobcat || isRetro || isRolo || isVibro || isUsinaKma;

  const { data: ogsData = [] } = useOgsReference();

  // Form state
  const [selectedFleet, setSelectedFleet] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [operator, setOperator] = useState("");
  const [operatorSolo, setOperatorSolo] = useState("");
  const [turno, setTurno] = useState<"diurno" | "noturno">("diurno");
  const [meterInitial, setMeterInitial] = useState("");
  const [meterFinal, setMeterFinal] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [ogsNumber, setOgsNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [observations, setObservations] = useState("");

  // Sub-sections
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([createDefaultTimeEntry("diurno")]);
  const [kmaEntries, setKmaEntries] = useState<CalibrationEntry[]>([createEmptyCalibration(1)]);
  const [productionAreas, setProductionAreas] = useState<ProductionArea[]>([createEmptyArea()]);
  const [bits, setBits] = useState<BitEntry[]>([]);
  const [fueling, setFueling] = useState<FuelingData>(createEmptyFueling());
  const [checklistResults, setChecklistResults] = useState<ChecklistResult[]>([]);

  // Bobcat-specific
  const [attachmentType, setAttachmentType] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const attachmentIds = useMemo(() => getAttachmentIds(attachmentType), [attachmentType]);

  // Rolo-specific
  const [roloType, setRoloType] = useState("");
  const roloFleets = useMemo(() => ROLO_FLEETS[roloType] || [], [roloType]);

  // Carreta-specific
  const [prancha, setPrancha] = useState("");

  // Truck tank supply (Pipa / Espargidor)
  const [tankSupplies, setTankSupplies] = useState<TankSupplyEntry[]>([createEmptyTankSupply()]);

  // Comboio state
  const [comboioRefuels, setComboioRefuels] = useState<ComboioRefuelEntry[]>([createEmptyComboioRefuel()]);
  const [comboioSaldoInicial, setComboioSaldoInicial] = useState("");
  const [comboioFornecedor, setComboioFornecedor] = useState("");
  

  // Veículo type
  const [veiculoType, setVeiculoType] = useState("");
  const veiculoFleets = useMemo(() => VEICULO_FLEETS[veiculoType] || [], [veiculoType]);

  // KMA-specific
  const [operator2, setOperator2] = useState("");
  const [kmaOperation, setKmaOperation] = useState<KmaOperationData>(createEmptyKmaOperation());

  // OGS auto-fill — collect ALL rows for the selected OGS number
  const selectedOgsEntries = useMemo(() => {
    if (!ogsNumber) return [];
    return ogsData.filter((o: any) => o.ogs_number === ogsNumber);
  }, [ogsNumber, ogsData]);

  const selectedOgs = selectedOgsEntries.length > 0 ? selectedOgsEntries[0] : null;

  const ogsAddressList = useMemo(() => {
    if (selectedOgsEntries.length === 0) return [];
    // Collect unique addresses from all rows for this OGS
    const allAddresses: string[] = [];
    selectedOgsEntries.forEach((entry: any) => {
      const raw = entry.location_address as string;
      if (!raw) return;
      if (raw.includes(";")) {
        raw.split(";").map((a: string) => a.trim()).filter(Boolean).forEach(a => {
          if (!allAddresses.includes(a)) allAddresses.push(a);
        });
      } else {
        const trimmed = raw.trim();
        if (trimmed && !allAddresses.includes(trimmed)) allAddresses.push(trimmed);
      }
    });
    return allAddresses;
  }, [selectedOgsEntries]);

  const hasMultipleAddresses = ogsAddressList.length > 1;

  useEffect(() => {
    if (selectedOgs) {
      setClientName(selectedOgs.client_name || "");
      if (!hasMultipleAddresses && ogsAddressList.length === 1) {
        setLocationAddress(ogsAddressList[0]);
      } else {
        setLocationAddress("");
      }
    } else {
      setClientName("");
      setLocationAddress("");
    }
  }, [selectedOgs, ogsAddressList, hasMultipleAddresses]);

  const uniqueOgs = useMemo(() => {
    const seen = new Set<string>();
    return ogsData.filter((o: any) => {
      if (!o.ogs_number || seen.has(o.ogs_number)) return false;
      seen.add(o.ogs_number);
      return true;
    });
  }, [ogsData]);

  // Fetch equipment list
  const { data: equipamentos = [] } = useQuery({
    queryKey: ["maquinas_frota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas_frota")
        .select("*")
        .in("status", ["ativo", "Operando"])
        .order("frota");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, funcao")
        .order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  // Log data arrival for debugging
  useEffect(() => {
    if (funcionarios.length > 0) {
      const funcoes = [...new Set(funcionarios.map((f: any) => f.funcao))];
      console.log(`[EquipmentDiaryForm] ${funcionarios.length} funcionários carregados. Funções:`, funcoes);
    } else {
      console.log("[EquipmentDiaryForm] Nenhum funcionário carregado ainda.");
    }
  }, [funcionarios]);

  // Filtered operators — matches actual DB values like "OP DE FRESADORA"
  const operadoresFresa = useMemo(() => {
    const filtered = funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn.includes("FRESADORA") || fn === "OP DE FRESADORA";
    });
    console.log(`[Operadores Fresa] ${filtered.length} encontrados`);
    return filtered.length > 0 ? filtered : funcionarios;
  }, [funcionarios]);

  const operadoresSolo = useMemo(() => {
    const filtered = funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn.includes("OP SOLO") || fn.includes("AJUDANTE");
    });
    console.log(`[Operadores Solo] ${filtered.length} encontrados`);
    return filtered.length > 0 ? filtered : funcionarios;
  }, [funcionarios]);

  const filteredFleet = useMemo(() => {
    if (isFresadora) {
      return equipamentos.filter((eq: any) =>
        eq.tipo?.toLowerCase().includes("fresadora") ||
        eq.categoria?.toLowerCase().includes("fresadora") ||
        eq.frota?.startsWith("FA")
      );
    }
    return equipamentos;
  }, [equipamentos, isFresadora]);

  const operadoresBobcat = useMemo(() => {
    const filtered = funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn.includes("BOBCAT");
    });
    return filtered.length > 0 ? filtered : funcionarios;
  }, [funcionarios]);

  const operadoresRetro = useMemo(() => {
    const filtered = funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn.includes("RETROESCAVADEIRA") || fn.includes("RETRO") || fn.includes("ESCAVADEIRA") || fn.includes("PA CARREGADEIRA");
    });
    return filtered.length > 0 ? filtered : funcionarios;
  }, [funcionarios]);

  const motoristas = useMemo(() => {
    const filtered = funcionarios.filter((f: any) => {
      const fn = f.funcao?.toUpperCase() || "";
      return fn.includes("MOTORISTA") || fn.includes("COMBOIO");
    });
    return filtered.length > 0 ? filtered : funcionarios;
  }, [funcionarios]);

  const meterLabel = usesOdometer ? "Odômetro" : "Horímetro";

  const horimeterError =
    meterInitial && meterFinal && Number(meterFinal) < Number(meterInitial)
      ? `${meterLabel} Final não pode ser menor que o Inicial`
      : null;

  const horasTrabalhadas =
    meterInitial && meterFinal && Number(meterFinal) >= Number(meterInitial)
      ? (Number(meterFinal) - Number(meterInitial)).toFixed(1)
      : null;

  const handleTurnoChange = (value: "diurno" | "noturno") => {
    setTurno(value);
    if (timeEntries.length === 1 && !timeEntries[0].activity && !timeEntries[0].endTime) {
      setTimeEntries([createDefaultTimeEntry(value)]);
    }
  };

  // Fetch trailer_fleets for Carreta prancha
  const { data: trailerFleets = [] } = useQuery({
    queryKey: ["trailer_fleets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trailer_fleets")
        .select("*")
        .order("fleet_number");
      if (error) throw error;
      return data as any[];
    },
    enabled: isCarreta,
  });

  // Fetch equipment_fleets for Carreta transport equipment selectors & Comboio fleet dropdown
  const { data: equipmentFleets = [] } = useQuery({
    queryKey: ["equipment_fleets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_fleets")
        .select("*")
        .order("fleet_number");
      if (error) throw error;
      return data as any[];
    },
    enabled: isCarreta || isComboio,
  });

  // Determine which static fleet list to use
  const getStaticFleetList = () => {
    if (isBobcat) return BOBCAT_FLEETS;
    if (isRetro) return RETRO_FLEETS;
    if (isVibro) return VIBRO_FLEETS;
    if (isUsinaKma) return KMA_FLEETS;
    if (isPipa) return PIPA_FLEETS;
    if (isEspargidor) return ESPARGIDOR_FLEETS;
    if (isCarroceria) return CARROCERIA_FLEETS;
    if (isComboio) return COMBOIO_FLEETS;
    if (isCarreta) return CARRETA_CM_FLEETS;
    return null;
  };

  const staticFleetList = getStaticFleetList();
  const useStaticFleet = !!staticFleetList || isRolo || isVeiculo || (isCaminhoes && !caminhaoTipo);

  const getOperatorList = () => {
    if (isFresadora) return operadoresFresa;
    if (isBobcat) return operadoresBobcat.length > 0 ? operadoresBobcat : funcionarios;
    if (isRetro) return operadoresRetro.length > 0 ? operadoresRetro : funcionarios;
    if (isUsinaKma) return funcionarios;
    if (isTruck) return motoristas.length > 0 ? motoristas : funcionarios;
    return funcionarios;
  };

  const handleSave = async (isDraft = false) => {
    if (!selectedFleet || !date) {
      toast({ title: "Campos obrigatórios", description: "Selecione o equipamento e data.", variant: "destructive" });
      return;
    }
    if (horimeterError) {
      toast({ title: `${meterLabel} inválido`, description: horimeterError, variant: "destructive" });
      return;
    }
    if (!session?.user?.id) {
      toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
      navigate("/");
      return;
    }

    setSaving(true);
    try {
      const diaryPayload: any = {
        equipment_fleet: selectedFleet,
        equipment_type: equipmentType,
        date,
        operator_name: operator || null,
        operator_solo: isFresadora ? (operatorSolo || null) : (isUsinaKma ? (operator2 || null) : null),
        period: turno,
        fuel_liters: fueling.liters ? Number(fueling.liters) : null,
        fuel_type: fueling.fuelType || null,
        fuel_meter: fueling.fuelMeter ? Number(fueling.fuelMeter) : null,
        work_status: workStatus || null,
        ogs_number: isCarreta ? null : (ogsNumber || null),
        client_name: isCarreta ? null : (clientName || null),
        location_address: isCarreta ? null : (locationAddress || null),
        observations: observations || null,
        company_id: profile?.company_id || null,
        fresagem_type: isRolo ? roloType : (isVeiculo ? veiculoType : (isCaminhoes ? caminhaoTipo : null)),
        attachment_type: isCarreta ? (prancha || null) : (attachmentType || null),
        status: isDraft ? "rascunho" : "enviado",
      };

      if (usesOdometer) {
        diaryPayload.odometer_initial = meterInitial ? Number(meterInitial) : null;
        diaryPayload.odometer_final = meterFinal ? Number(meterFinal) : null;
      } else {
        diaryPayload.meter_initial = meterInitial ? Number(meterInitial) : null;
        diaryPayload.meter_final = meterFinal ? Number(meterFinal) : null;
      }

      const { data: diary, error } = await supabase
        .from("equipment_diaries")
        .insert(diaryPayload)
        .select()
        .single();

      if (error) throw error;

      // Save time entries
      const validTimeEntries = timeEntries.filter((t) => t.startTime && t.activity);
      if (validTimeEntries.length > 0 && diary) {
        const rows = validTimeEntries.map((t) => {
          let description = null;
          if (t.activity === "Manutenção") description = t.maintenanceDetails || null;
          else if (t.activity === "Transporte" && isCarreta) {
            const equips = [
              t.transportEquip1 === "Outro" ? t.transportEquip1Custom : t.transportEquip1,
              t.transportEquip2 === "Outro" ? t.transportEquip2Custom : t.transportEquip2,
              t.transportEquip3 === "Outro" ? t.transportEquip3Custom : t.transportEquip3,
            ].filter(Boolean);
            const parts: string[] = [];
            if (equips.length > 0) parts.push(equips.join(", "));
            if (t.origin && t.destination && t.origin === t.destination && t.transportInternalDetails) {
              parts.push(`Trecho: ${t.transportInternalDetails}`);
            }
            if (t.destination === "BASE / PÁTIO CENTRAL" && t.returnReason) {
              parts.push(`Retorno: ${t.returnReason}`);
              if (t.returnReason === "Manutenção / Oficina" && t.returnDetails) {
                parts.push(`Detalhe: ${t.returnDetails}`);
              }
            }
            description = parts.length > 0 ? parts.join(" | ") : null;
          } else if (t.activity === "Transporte") {
            const parts: string[] = [];
            if (t.transportObs) parts.push(t.transportObs);
            if (t.destination === "BASE / PÁTIO CENTRAL" && t.returnReason) {
              parts.push(`Retorno: ${t.returnReason}`);
              if (t.returnReason === "Manutenção / Oficina" && t.returnDetails) {
                parts.push(`Detalhe: ${t.returnDetails}`);
              }
            }
            description = parts.length > 0 ? parts.join(" | ") : null;
          }

          return {
            diary_id: diary.id,
            start_time: t.startTime,
            end_time: t.endTime || null,
            activity: t.activity,
            description,
            origin: t.origin || null,
            destination: t.destination || null,
            ogs_destination: t.transportOgs || null,
          };
        });
        await supabase.from("equipment_time_entries").insert(rows);
      }

      // Save KMA calibration
      if (isUsinaKma && diary) {
        const validKma = kmaEntries.filter((e) => e.pesoNominal || e.pesoReal);
        for (const entry of validKma) {
          let ticketUrl: string | null = null;
          if (entry.ticketPhotoFile) {
            const path = `kma-tickets/${diary.id}/tentativa_${entry.tentativa}_${Date.now()}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from("notas_fiscais")
              .upload(path, entry.ticketPhotoFile, { contentType: "image/jpeg", upsert: true });
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(path);
              ticketUrl = urlData.publicUrl;
            }
          }
          await supabase.from("kma_calibration_entries").insert({
            equipment_diary_id: diary.id,
            attempt_number: entry.tentativa,
            nominal_weight_usina: entry.pesoNominal ? Number(entry.pesoNominal) : null,
            real_weight_reference: entry.pesoReal ? Number(entry.pesoReal) : null,
            truck_tara: entry.tara ? Number(entry.tara) : null,
            adjustment_factor: entry.fator ? Number(entry.fator) : null,
            ticket_photo_url: ticketUrl,
          });
        }
        // Save KMA operations
        if (isUsinaKma && diary && kmaOperation.operationType) {
          await supabase.from("kma_operations").insert({
            diary_id: diary.id,
            operation_type: kmaOperation.operationType,
            cap_type: kmaOperation.capType || null,
            cap_supplier: kmaOperation.capSupplier || null,
            cap_qty_ton: kmaOperation.capQtyTon ? Number(kmaOperation.capQtyTon) : null,
            cap_nf_number: kmaOperation.capNfNumber || null,
            filer_type: kmaOperation.filerType || null,
            filer_supplier: kmaOperation.filerSupplier || null,
            filer_qty_ton: kmaOperation.filerQtyTon ? Number(kmaOperation.filerQtyTon) : null,
            silo1_material: kmaOperation.silo1Material || null,
            silo1_qty: kmaOperation.silo1Qty ? Number(kmaOperation.silo1Qty) : null,
            silo2_material: kmaOperation.silo2Material || null,
            silo2_qty: kmaOperation.silo2Qty ? Number(kmaOperation.silo2Qty) : null,
            water_liters: kmaOperation.waterLiters ? Number(kmaOperation.waterLiters) : null,
            water_supplier: kmaOperation.waterSupplier || null,
            aggregates_supplier: kmaOperation.aggregatesSupplier || null,
            total_volume_machined_ton: kmaOperation.totalVolumeMachinedTon ? Number(kmaOperation.totalVolumeMachinedTon) : null,
          });
        }
      }

      // Save production areas (Fresadora)
      if (isFresadora && diary) {
        const validAreas = productionAreas.filter((a) => a.comp || a.larg);
        if (validAreas.length > 0) {
          const rows = validAreas.map((a) => {
            const c = Number(a.comp) || 0;
            const l = Number(a.larg) || 0;
            const e = Number(a.esp) || 0;
            const m2Val = c && l ? c * l : null;
            const m3Val = m2Val && e ? m2Val * (e / 100) : null;
            return {
              diary_id: diary.id,
              length_m: a.comp ? c : null,
              width_m: a.larg ? l : null,
              thickness_cm: a.esp ? e : null,
              m2: m2Val,
              m3: m3Val,
            };
          });
          await supabase.from("equipment_production_areas").insert(rows);
        }
      }

      // Save bits (Fresadora)
      if (isFresadora && diary && bits.length > 0) {
        const validBits = bits.filter((b) => b.brand);
        if (validBits.length > 0) {
          const rows = validBits.map((b) => ({
            diary_id: diary.id,
            brand: b.brand,
            quantity: Number(b.quantity) || 0,
            status: b.status,
            horimeter: b.horimeter || null,
          }));
          await supabase.from("bit_entries").insert(rows);
        }
      }

      // Save Bobcat/Retro attachment
      if ((isBobcat || isRetro) && diary && attachmentType) {
        const attachValue = isBobcat && attachmentId ? `${attachmentType} — ${attachmentId}` : attachmentType;
        await supabase.from("equipment_attachments" as any).insert({
          fleet_id: selectedFleet,
          type: attachValue,
        });
      }

      // Save checklist results
      if (hasChecklist && diary && checklistResults.length > 0) {
        for (const cr of checklistResults) {
          let photoUrl: string | null = null;
          if (cr.photoFile) {
            const path = `checklist/${diary.id}/${cr.itemId}_${Date.now()}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("notas_fiscais")
              .upload(path, cr.photoFile, { contentType: "image/jpeg", upsert: true });
            if (!upErr) {
              const { data: urlData } = supabase.storage.from("notas_fiscais").getPublicUrl(path);
              photoUrl = urlData.publicUrl;
            }
          }
          await supabase.from("checklist_entries").insert({
            diary_id: diary.id,
            item_id: cr.itemId,
            status: cr.status as any,
            observation: cr.observation || null,
            photo_url: photoUrl,
          });
        }
      }

      // Save truck tank supplies (Pipa / Espargidor)
      if ((isPipa || isEspargidor) && diary) {
        const validSupplies = tankSupplies.filter((s) => s.quantity || s.supplier);
        if (validSupplies.length > 0) {
          const rows = validSupplies.map((s) => ({
            diary_id: diary.id,
            quantity: s.quantity ? Number(s.quantity) : null,
            supplier: s.supplier || null,
            emulsion_type: s.emulsionType || null,
            material_type: isPipa ? "Água" : "Emulsão",
          }));
          await supabase.from("truck_tank_supplies").insert(rows);
        }
      }

      if (isComboio && diary) {
        // Save comboio tank supply info
        if (comboioSaldoInicial || comboioFornecedor) {
          await supabase.from("truck_tank_supplies").insert({
            diary_id: diary.id,
            quantity: comboioSaldoInicial ? Number(comboioSaldoInicial) : null,
            supplier: comboioFornecedor || null,
            material_type: "Diesel",
          });
        }

        // Save comboio refueling entries
        const validRefuels = comboioRefuels.filter((r) => r.fleetFueled || r.litersFueled);
        if (validRefuels.length > 0) {
          const rows = validRefuels.map((r) => ({
            diary_id: diary.id,
            equipment_fleet_fueled: r.fleetFueled || null,
            equipment_meter: r.equipmentMeter ? Number(r.equipmentMeter) : null,
            ogs_destination: r.ogsDestination || null,
            liters_fueled: r.litersFueled ? Number(r.litersFueled) : null,
            is_lubricated: r.isLubricated,
            is_washed: r.isWashed,
            initial_diesel_balance: comboioSaldoInicial ? Number(comboioSaldoInicial) : null,
          }));
          await supabase.from("comboio_equipment_refueling").insert(rows);
        }
      }

      // ── Send email for Comboio / Carreta (non-draft only) ──
      if (!isDraft && diary) {
        try {
          let htmlReport: string | null = null;

          if (isComboio) {
            htmlReport = buildComboioEmailReport({
              fleet: selectedFleet,
              date,
              operator,
              turno,
              odometerInitial: meterInitial,
              odometerFinal: meterFinal,
              saldoInicial: comboioSaldoInicial,
              fornecedor: comboioFornecedor,
              entries: comboioRefuels,
              observations,
              ogsData,
            });
          } else if (isCarreta) {
            htmlReport = buildCarretaEmailReport({
              fleet: selectedFleet,
              prancha: prancha || "",
              date,
              operator,
              turno,
              odometerInitial: meterInitial,
              odometerFinal: meterFinal,
              timeEntries,
              observations,
              ogsData,
            });
          }

          if (htmlReport) {
            console.log(`📧 Enviando e-mail do ${isComboio ? "Comboio" : "Carreta"}...`);
            const { error: emailError } = await supabase.functions.invoke("send-rdo-email", {
              body: { rdo_id: diary.id, html_report: htmlReport },
            });
            if (emailError) {
              console.error("❌ Erro ao enviar e-mail:", emailError);
            } else {
              console.log("✅ E-mail enviado com sucesso!");
            }
          }
        } catch (emailErr) {
          console.error("❌ Erro ao enviar e-mail:", emailErr);
          // Don't block the flow — email failure shouldn't prevent navigation
        }
      }

      toast({
        title: isDraft ? "📝 Rascunho salvo!" : "✅ Diário enviado!",
        description: `Diário para ${selectedFleet} salvo com sucesso.`,
      });
      navigate("/equipamentos");
    } catch (err: any) {
      const msg = err?.message || "Erro desconhecido";
      if (msg.includes("row-level security") || msg.includes("policy")) {
        toast({ title: "Sem permissão", description: "Contate o administrador.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    await generateKmaPdf({ fleet: selectedFleet, date, operator, entries: kmaEntries });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <EquipmentHeader title={isCaminhoes && caminhaoTipo ? `Caminhão ${caminhaoTipo}` : isVeiculo ? "Veículo de Transporte" : (equipmentType || "Novo Diário")} />

      <div className="flex-1 p-4 space-y-5 pb-36 max-w-lg mx-auto w-full">
        {/* INFORMAÇÕES GERAIS */}
        <Section title="INFORMAÇÕES GERAIS">
          {/* Rolo: Tipo de Rolo */}
          {isRolo && (
            <Field label="Tipo de Rolo">
              <Select value={roloType} onValueChange={(v) => { setRoloType(v); setSelectedFleet(""); }}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLO_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Caminhões: Tipo de Caminhão */}
          {isCaminhoes && (
            <Field label="Tipo de Caminhão">
              <Select value={caminhaoTipo} onValueChange={(v) => { setCaminhaoTipo(v); setSelectedFleet(""); }}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {CAMINHAO_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{t === "Pipa" ? "💧 Pipa" : t === "Espargidor" ? "🛢️ Espargidor" : "📦 Carroceria"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Veículo: Tipo */}
          {isVeiculo && (
            <Field label="Tipo de Veículo">
              <Select value={veiculoType} onValueChange={(v) => { setVeiculoType(v); setSelectedFleet(""); }}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Micro-ônibus ou Van..." />
                </SelectTrigger>
                <SelectContent>
                  {VEICULO_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <FieldRow>
            <Field label="Frota">
              {isCaminhoes && !caminhaoTipo ? (
                <Select disabled>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Escolha o tipo primeiro" />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              ) : isRolo ? (
                <Select value={selectedFleet} onValueChange={setSelectedFleet} disabled={!roloType}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={roloType ? "Selecione a frota..." : "Escolha o tipo primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {roloFleets.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : isVeiculo ? (
                <Select value={selectedFleet} onValueChange={setSelectedFleet} disabled={!veiculoType}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={veiculoType ? "Selecione..." : "Escolha o tipo primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculoFleets.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : staticFleetList ? (
                <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staticFleetList.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedFleet} onValueChange={setSelectedFleet}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(isFresadora ? filteredFleet : equipamentos).map((eq: any) => (
                      <SelectItem key={eq.id} value={eq.frota}>
                        {eq.frota} — {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-secondary border-border" />
            </Field>
          </FieldRow>

          {/* Carreta: Prancha */}
          {isCarreta && (
            <Field label="Prancha">
              <Select value={prancha} onValueChange={setPrancha}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione a prancha..." />
                </SelectTrigger>
                <SelectContent>
                  {trailerFleets.map((t: any) => (
                    <SelectItem key={t.id} value={t.fleet_number}>{t.fleet_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label={isTruck ? "Motorista" : "Operador"}>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder={isTruck ? "Selecione o motorista..." : "Selecione o operador..."} />
              </SelectTrigger>
              <SelectContent>
                {getOperatorList().map((f: any) => (
                  <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Bobcat: Acoplamento */}
          {isBobcat && (
            <FieldRow>
              <Field label="Tipo de Acoplamento">
                <Select value={attachmentType} onValueChange={(v) => { setAttachmentType(v); setAttachmentId(""); }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTACHMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="ID do Acoplamento">
                <Select value={attachmentId} onValueChange={setAttachmentId} disabled={!attachmentType}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={attachmentType ? "Selecione..." : "Escolha o tipo primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {attachmentIds.map((id) => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldRow>
          )}

          {/* Retro: Acoplamento */}
          {isRetro && (
            <Field label="Tipo de Acoplamento">
              <Select value={attachmentType} onValueChange={(v) => { setAttachmentType(v); setAttachmentId(""); }}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o acoplamento..." />
                </SelectTrigger>
                <SelectContent>
                  {RETRO_ATTACHMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {isFresadora && (
            <Field label="Operador Solo">
              <Select value={operatorSolo} onValueChange={setOperatorSolo}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o operador solo..." />
                </SelectTrigger>
                <SelectContent>
                  {operadoresSolo.map((f: any) => (
                    <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* KMA: Operador 02 */}
          {isUsinaKma && (
            <Field label="Operador 02">
              <Select value={operator2} onValueChange={setOperator2}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o operador 02..." />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f: any) => (
                    <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {!isCarreta && !isComboio && (
            <FieldRow>
              <Field label="OGS">
                <Select value={ogsNumber} onValueChange={setOgsNumber}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione OGS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueOgs.map((o: any) => (
                      <SelectItem key={o.id} value={o.ogs_number || ""}>
                        {o.ogs_number} — {o.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldRow>
          )}

          {!isCarreta && !isComboio && (clientName || locationAddress || hasMultipleAddresses) && (
            <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
              {clientName && (
                <p className="text-xs text-muted-foreground">
                  Cliente: <span className="text-foreground font-medium">{clientName}</span>
                </p>
              )}
              {hasMultipleAddresses ? (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wide">Local da Obra</span>
                  <Select value={locationAddress} onValueChange={setLocationAddress}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Selecione o local..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ogsAddressList.map((addr: string, idx: number) => (
                        <SelectItem key={idx} value={addr}>{addr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : locationAddress ? (
                <p className="text-xs text-muted-foreground">
                  Local: <span className="text-foreground font-medium">{locationAddress}</span>
                </p>
              ) : null}
            </div>
          )}
        </Section>

        {/* CHECKLIST PRÉ-OPERAÇÃO */}
        {hasChecklist && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="checklist" className="border border-border rounded-lg overflow-hidden bg-secondary/30">
              <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                  ✔️ CHECKLIST PRÉ-OPERAÇÃO
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ChecklistSection
                  equipmentType={equipmentType}
                  results={checklistResults}
                  onChange={setChecklistResults}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* PERÍODO */}
        <Section title="PERÍODO">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={turno === "diurno" ? "default" : "outline"}
              className={`flex-1 ${turno === "diurno" ? "bg-primary" : ""}`}
              onClick={() => handleTurnoChange("diurno")}
            >
              ☀️ Diurno
            </Button>
            <Button
              type="button"
              variant={turno === "noturno" ? "default" : "outline"}
              className={`flex-1 ${turno === "noturno" ? "bg-primary" : ""}`}
              onClick={() => handleTurnoChange("noturno")}
            >
              🌙 Noturno
            </Button>
          </div>
        </Section>

        {/* STATUS DA OBRA + METER INITIAL */}
        <Section title="STATUS DA OBRA">
          <FieldRow>
            <Field label="Status">
              <Select value={workStatus} onValueChange={setWorkStatus}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`${meterLabel} Inicial`}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={meterInitial}
                onChange={(e) => setMeterInitial(e.target.value)}
                placeholder="0,0"
                className="bg-secondary border-border"
              />
            </Field>
          </FieldRow>
        </Section>

        {/* APONTAMENTO DE HORAS */}
        <TimeEntriesSection
          entries={timeEntries}
          onChange={setTimeEntries}
          turno={turno}
          showTransportOgs={false}
          showTransportPassengers={isVeiculo}
          ogsData={ogsData}
          isCarreta={isCarreta}
          allFleets={isCarreta ? equipmentFleets.map((f: any) => ({ frota: f.fleet_number, nome: f.equipment_type })) : equipamentos}
          equipmentType={equipmentType}
        />

        {/* FRESADORA: Produção + Bits */}
        {isFresadora && (
          <>
            <ProductionAreasSection areas={productionAreas} onChange={setProductionAreas} />
            <BitManagementSection bits={bits} onChange={setBits} meterInitial={meterInitial} />

            {(() => {
              const totalM3 = productionAreas.reduce((s, a) => {
                const c = Number(a.comp), l = Number(a.larg), e = Number(a.esp);
                if (!c || !l || !e) return s;
                return s + c * l * (e / 100);
              }, 0);
              const totalBits = bits.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
              const rendimento = totalBits > 0 ? totalM3 / totalBits : null;

              return (totalM3 > 0 || totalBits > 0) ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2">
                    DESEMPENHO DO TURNO
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Total M³</p>
                      <p className="text-xl font-bold text-primary">{totalM3.toFixed(2)}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Total Bits</p>
                      <p className="text-xl font-bold text-primary">{totalBits}</p>
                    </div>
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Rendimento</p>
                      <p className="text-xl font-bold text-accent">
                        {rendimento !== null ? rendimento.toFixed(2) : "—"}
                      </p>
                      <p className="text-[10px] text-accent/70">m³/bit</p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </>
        )}

        {/* KMA CALIBRATION */}
        {isUsinaKma && (
          <KmaCalibrationSection
            entries={kmaEntries}
            onChange={setKmaEntries}
            onGeneratePdf={handleGeneratePdf}
          />
        )}

        {/* KMA: Tipo de Operação + Insumos */}
        {isUsinaKma && (
          <Section title="⚙️ TIPO DE OPERAÇÃO">
            <Field label="Operação">
              <Select value={kmaOperation.operationType} onValueChange={(v) => setKmaOperation({ ...kmaOperation, operationType: v })}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {KMA_OPERATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {kmaOperation.operationType === "Usinagem" && (
              <div className="space-y-4 pt-2">
                {/* CAP */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide">🛢️ CAP (Cimento Asfáltico)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Tipo</span>
                      <Select value={kmaOperation.capType} onValueChange={(v) => setKmaOperation({ ...kmaOperation, capType: v })}>
                        <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                          <SelectValue placeholder="Tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CAP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Fornecedor</span>
                      <Input value={kmaOperation.capSupplier} onChange={(e) => setKmaOperation({ ...kmaOperation, capSupplier: e.target.value })} placeholder="Fornecedor..." className="bg-secondary border-border text-xs h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Quantidade (ton)</span>
                      <Input type="number" inputMode="decimal" value={kmaOperation.capQtyTon} onChange={(e) => setKmaOperation({ ...kmaOperation, capQtyTon: e.target.value })} placeholder="0" className="bg-secondary border-border text-xs h-9" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Nº NF</span>
                      <Input value={kmaOperation.capNfNumber} onChange={(e) => setKmaOperation({ ...kmaOperation, capNfNumber: e.target.value })} placeholder="NF..." className="bg-secondary border-border text-xs h-9" />
                    </div>
                  </div>
                </div>

                {/* Filer */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide">Filer (Material Fino)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Tipo</span>
                      <Select value={kmaOperation.filerType} onValueChange={(v) => setKmaOperation({ ...kmaOperation, filerType: v })}>
                        <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                          <SelectValue placeholder="Tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FILER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Fornecedor</span>
                      <Input value={kmaOperation.filerSupplier} onChange={(e) => setKmaOperation({ ...kmaOperation, filerSupplier: e.target.value })} placeholder="Fornecedor..." className="bg-secondary border-border text-xs h-9" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Qtd (ton)</span>
                      <Input type="number" inputMode="decimal" value={kmaOperation.filerQtyTon} onChange={(e) => setKmaOperation({ ...kmaOperation, filerQtyTon: e.target.value })} placeholder="0" className="bg-secondary border-border text-xs h-9" />
                    </div>
                  </div>
                </div>

                {/* Silos */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide">🏗️ Silos de Agregados</h4>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">Fornecedor de Agregados</span>
                    <Input value={kmaOperation.aggregatesSupplier} onChange={(e) => setKmaOperation({ ...kmaOperation, aggregatesSupplier: e.target.value })} placeholder="Fornecedor..." className="bg-secondary border-border text-xs h-9" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Silo 1 — Material</span>
                      <Select value={kmaOperation.silo1Material} onValueChange={(v) => setKmaOperation({ ...kmaOperation, silo1Material: v })}>
                        <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                          <SelectValue placeholder="Material..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SILO_MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Silo 1 — Qtd (ton)</span>
                      <Input type="number" inputMode="decimal" value={kmaOperation.silo1Qty} onChange={(e) => setKmaOperation({ ...kmaOperation, silo1Qty: e.target.value })} placeholder="0" className="bg-secondary border-border text-xs h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Silo 2 — Material</span>
                      <Select value={kmaOperation.silo2Material} onValueChange={(v) => setKmaOperation({ ...kmaOperation, silo2Material: v })}>
                        <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                          <SelectValue placeholder="Material..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SILO_MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Silo 2 — Qtd (ton)</span>
                      <Input type="number" inputMode="decimal" value={kmaOperation.silo2Qty} onChange={(e) => setKmaOperation({ ...kmaOperation, silo2Qty: e.target.value })} placeholder="0" className="bg-secondary border-border text-xs h-9" />
                    </div>
                  </div>
                </div>

                {/* Água */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-display font-extrabold text-primary uppercase tracking-wide">💧 Água</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Litros</span>
                      <Input type="number" inputMode="decimal" value={kmaOperation.waterLiters} onChange={(e) => setKmaOperation({ ...kmaOperation, waterLiters: e.target.value })} placeholder="0" className="bg-secondary border-border text-xs h-9" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-accent uppercase">Fornecedor</span>
                      <Select value={kmaOperation.waterSupplier} onValueChange={(v) => setKmaOperation({ ...kmaOperation, waterSupplier: v })}>
                        <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {AGUA_FORNECEDORES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Volume Usinado */}
                <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-display font-extrabold text-primary uppercase tracking-wide">📊 Volume Total Usinado (ton)</span>
                    <Input type="number" inputMode="decimal" value={kmaOperation.totalVolumeMachinedTon} onChange={(e) => setKmaOperation({ ...kmaOperation, totalVolumeMachinedTon: e.target.value })} placeholder="0" className="bg-secondary border-border" />
                  </div>
                </div>
              </div>
            )}
          </Section>
        )}

        {isPipa && (
          <Section title="💧 ABASTECIMENTO DE TANQUE">
            {tankSupplies.map((supply, idx) => (
              <div key={supply.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">Quantidade (L)</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={supply.quantity}
                      onChange={(e) => {
                        const u = [...tankSupplies];
                        u[idx] = { ...u[idx], quantity: e.target.value };
                        setTankSupplies(u);
                      }}
                      placeholder="0"
                      className="bg-secondary border-border text-xs h-9"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">Fornecedor</span>
                    <Select
                      value={supply.supplier}
                      onValueChange={(v) => {
                        const u = [...tankSupplies];
                        u[idx] = { ...u[idx], supplier: v };
                        setTankSupplies(u);
                      }}
                    >
                      <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPA_FORNECEDORES.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {tankSupplies.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setTankSupplies(tankSupplies.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={() => setTankSupplies([...tankSupplies, createEmptyTankSupply()])}>
              <Plus className="w-3.5 h-3.5" /> Adicionar carga
            </Button>
          </Section>
        )}

        {/* ── ESPARGIDOR: Carga de Emulsão ── */}
        {isEspargidor && (
          <Section title="🛢️ CARGA DE EMULSÃO">
            {tankSupplies.map((supply, idx) => (
              <div key={supply.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">Quantidade (L)</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={supply.quantity}
                      onChange={(e) => {
                        const u = [...tankSupplies];
                        u[idx] = { ...u[idx], quantity: e.target.value };
                        setTankSupplies(u);
                      }}
                      placeholder="0"
                      className="bg-secondary border-border text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">Tipo Emulsão</span>
                    <Select
                      value={supply.emulsionType || ""}
                      onValueChange={(v) => {
                        const u = [...tankSupplies];
                        u[idx] = { ...u[idx], emulsionType: v };
                        setTankSupplies(u);
                      }}
                    >
                      <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                        <SelectValue placeholder="Tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EMULSION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">Fornecedor</span>
                    <Select
                      value={supply.supplier}
                      onValueChange={(v) => {
                        const u = [...tankSupplies];
                        u[idx] = { ...u[idx], supplier: v };
                        setTankSupplies(u);
                      }}
                    >
                      <SelectTrigger className="bg-secondary border-border h-9 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ESPARGIDOR_FORNECEDORES.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {tankSupplies.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive text-xs" onClick={() => setTankSupplies(tankSupplies.filter((_, i) => i !== idx))}>
                    <Trash2 className="w-3 h-3 mr-1" /> Remover
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs border-dashed" onClick={() => setTankSupplies([...tankSupplies, createEmptyTankSupply()])}>
              <Plus className="w-3.5 h-3.5" /> Adicionar carga
            </Button>
          </Section>
        )}

        {/* ── COMBOIO MODULE ── */}
        {isComboio && (
          <ComboioRefuelingSection
            saldoInicial={comboioSaldoInicial}
            onSaldoInicialChange={setComboioSaldoInicial}
            fornecedor={comboioFornecedor}
            onFornecedorChange={setComboioFornecedor}
            entries={comboioRefuels}
            onChange={setComboioRefuels}
            equipamentos={equipmentFleets.length > 0 ? equipmentFleets.map((f: any) => ({ id: f.id, frota: f.fleet_number, nome: f.equipment_type })) : equipamentos}
            ogsData={ogsData}
            onGeneratePdf={() =>
              generateComboioPdf({
                fleet: selectedFleet,
                date,
                operator,
                turno,
                odometerInitial: meterInitial,
                odometerFinal: meterFinal,
                saldoInicial: comboioSaldoInicial,
                fornecedor: comboioFornecedor,
                entries: comboioRefuels,
                observations,
              })
            }
          />
        )}

        {/* ABASTECIMENTO + METER FINAL */}
        {!isComboio && (
          <FuelingSection data={fueling} onChange={setFueling} />
        )}

        <Section title={`${meterLabel} FINAL`}>
          <Field label={`${meterLabel} Final`}>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={meterFinal}
              onChange={(e) => setMeterFinal(e.target.value)}
              placeholder="0,0"
              className={`bg-secondary border-border ${horimeterError ? "border-destructive" : ""}`}
            />
          </Field>
          {horimeterError && (
            <div className="flex items-center gap-2 text-destructive text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {horimeterError}
            </div>
          )}
          {horasTrabalhadas && (
            <p className="text-xs text-muted-foreground">
              {usesOdometer ? "Km rodados" : "Horas trabalhadas"}: <span className="font-semibold text-foreground">{horasTrabalhadas}{usesOdometer ? " km" : "h"}</span>
            </p>
          )}
        </Section>

        {/* OBSERVAÇÕES */}
        <Section title="OBSERVAÇÕES">
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observações gerais..."
            className="bg-secondary border-border min-h-[80px]"
          />
        </Section>
      </div>

      {/* Fixed bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border space-y-2">
        <div className="max-w-lg mx-auto space-y-2">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || !!horimeterError}
            className="w-full font-extrabold text-base py-6 rounded-2xl bg-header-gradient hover:opacity-90 shadow-lg glow-primary"
          >
            <Send className="w-5 h-5 mr-2" />
            {saving ? "Enviando..." : "Enviar Diário"}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            variant="outline"
            className="w-full text-sm py-3"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Styled sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 bg-card border border-border rounded-2xl p-4 shadow-card">
      {title && (
        <h3 className="text-sm font-display font-extrabold text-foreground uppercase tracking-wide border-b border-border pb-2">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 flex-1 min-w-0">
      <label className="text-xs font-display font-bold text-primary uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}
