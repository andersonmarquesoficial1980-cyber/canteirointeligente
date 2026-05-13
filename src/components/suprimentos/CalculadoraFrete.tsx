import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle2, Save, Truck, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/fmt";

interface FormData {
  ogs: string;
  material: string;
  distancia: number;
  tempo: number;
  veiculo: "leve" | "pesado";
  usaAjudante: boolean;
  valorTerceiro: number;
}

export function CalculadoraFrete() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<any>({
    veiculo_leve_km: 1.5,
    veiculo_pesado_km: 3.5,
    hora_motorista: 25.0,
    hora_ajudante: 15.0
  });
  const [resultado, setResultado] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      veiculo: "leve",
      usaAjudante: false,
    }
  });

  const usaAjudante = watch("usaAjudante");
  const veiculo = watch("veiculo");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (profile?.company_id) {
        setCompanyId(profile.company_id);
        const { data: cfgData } = await supabase
          .from("suprimentos_frete_config")
          .select("*")
          .eq("company_id", profile.company_id)
          .maybeSingle();
        if (cfgData) setConfig(cfgData);
      }
    };
    fetchProfile();
  }, [session]);

  const onSubmit = (data: FormData) => {
    if (!config) return;

    const custoKm = data.veiculo === "leve" ? config.veiculo_leve_km : config.veiculo_pesado_km;
    const totalKm = data.distancia * custoKm;
    
    let custoHora = config.hora_motorista;
    if (data.usaAjudante) {
      custoHora += config.hora_ajudante;
    }
    
    const totalHora = data.tempo * custoHora;
    const custoInterno = totalKm + totalHora;

    const diferenca = data.valorTerceiro - custoInterno;
    const recomendacao = diferenca >= 0 ? "FROTA_PROPRIA" : "TERCEIRO";

    setResultado({
      custoInterno,
      valorTerceiro: data.valorTerceiro,
      diferenca: Math.abs(diferenca),
      recomendacao,
      formData: data
    });
  };

  const handleSave = async () => {
    if (!resultado || !session?.user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase.from("suprimentos_frete_historico").insert({
        company_id: companyId,
        user_id: session.user.id,
        user_nome: session.user.email,
        ogs: resultado.formData.ogs,
        material_desc: resultado.formData.material,
        distancia_km: resultado.formData.distancia,
        tempo_horas: resultado.formData.tempo,
        veiculo_tipo: resultado.formData.veiculo,
        usa_ajudante: resultado.formData.usaAjudante,
        custo_interno_calculado: resultado.custoInterno,
        valor_frete_terceiro: resultado.valorTerceiro,
        decisao_tomada: resultado.recomendacao
      });

      if (error) throw error;

      toast({
        title: "Decisão salva",
        description: "O histórico de decisão de frete foi registrado com sucesso.",
      });
      
      setResultado(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Parâmetros do Transporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>OGS / Centro de Custo</Label>
                <Input {...register("ogs", { required: true })} placeholder="Ex: 2534" />
              </div>
              <div className="space-y-2">
                <Label>Material / Peça</Label>
                <Input {...register("material", { required: true })} placeholder="Ex: Peça Fresadora" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Distância (KM Ida + Volta)</Label>
                <Input type="number" step="0.1" {...register("distancia", { required: true, valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Tempo Estimado (Horas)</Label>
                <Input type="number" step="0.5" {...register("tempo", { required: true, valueAsNumber: true })} placeholder="Viagem + Carregamento" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Veículo Interno</Label>
              <Select value={veiculo} onValueChange={(val: any) => setValue("veiculo", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Veículo Leve (Saveiro/Fiorino/Strada)</SelectItem>
                  <SelectItem value="pesado">Veículo Pesado (Caminhão 3/4, HR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div className="space-y-0.5">
                <Label>Vai Ajudante?</Label>
                <p className="text-sm text-muted-foreground">Adiciona o custo hora do ajudante</p>
              </div>
              <Switch checked={usaAjudante} onCheckedChange={(val) => setValue("usaAjudante", val)} />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-orange-500 font-bold">Valor do Frete (Terceiro / Loja)</Label>
              <Input 
                type="number" 
                step="0.01" 
                {...register("valorTerceiro", { required: true, valueAsNumber: true })} 
                placeholder="R$ 0,00" 
                className="text-lg font-bold"
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Calcular Custo Comparativo
            </Button>
          </form>
        </CardContent>
      </Card>

      {resultado && (
        <Card className={`border-2 ${resultado.recomendacao === "FROTA_PROPRIA" ? "border-green-500" : "border-orange-500"}`}>
          <CardHeader className={`${resultado.recomendacao === "FROTA_PROPRIA" ? "bg-green-50" : "bg-orange-50"} rounded-t-lg`}>
            <CardTitle className="text-center flex flex-col items-center gap-2">
              {resultado.recomendacao === "FROTA_PROPRIA" ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                  <span className="text-green-700">Mande a Frota Própria</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-10 h-10 text-orange-500" />
                  <span className="text-orange-500">Pague o Frete do Terceiro</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Custo Interno Estimado:</span>
              <span className="font-bold">{"R$ " + fmtNum(resultado.custoInterno, 2)}</span>
            </div>
            
            <div className="flex justify-between items-center text-lg">
              <span className="text-muted-foreground">Frete do Terceiro:</span>
              <span className="font-bold">{"R$ " + fmtNum(resultado.valorTerceiro, 2)}</span>
            </div>

            <div className="pt-4 border-t">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {resultado.recomendacao === "FROTA_PROPRIA" 
                    ? "Usar a frota própria gera uma economia de:" 
                    : "Pagar o frete gera uma economia de:"}
                </p>
                <p className="text-2xl font-bold">
                  {"R$ " + fmtNum(resultado.diferenca, 2)}
                </p>
              </div>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className={`w-full gap-2 ${resultado.recomendacao === "FROTA_PROPRIA" ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Salvando..." : "Salvar Decisão de Transporte"}
            </Button>
            
          </CardContent>
        </Card>
      )}
    </div>
  );
}
