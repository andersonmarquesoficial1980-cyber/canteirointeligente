export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bit_entries: {
        Row: {
          brand: string
          created_at: string | null
          diary_id: string
          horimeter: string | null
          id: string
          quantity: number
          status: string
        }
        Insert: {
          brand: string
          created_at?: string | null
          diary_id: string
          horimeter?: string | null
          id?: string
          quantity?: number
          status?: string
        }
        Update: {
          brand?: string
          created_at?: string | null
          diary_id?: string
          horimeter?: string | null
          id?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bit_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_entries: {
        Row: {
          damage_tag: string | null
          diary_id: string
          id: string
          item_id: string
          observation: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["checklist_status"]
        }
        Insert: {
          damage_tag?: string | null
          diary_id: string
          id?: string
          item_id: string
          observation?: string | null
          photo_url?: string | null
          status: Database["public"]["Enums"]["checklist_status"]
        }
        Update: {
          damage_tag?: string | null
          diary_id?: string
          id?: string
          item_id?: string
          observation?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["checklist_status"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      diaries: {
        Row: {
          acoplamento: string | null
          agregados_fornecedor: string | null
          agua_fornecedor: string | null
          agua_qty: number | null
          calib_analog: number | null
          calib_bucket: number | null
          calib_digital: number | null
          caminhao_type: string | null
          cap_fornecedor: string | null
          cap_nota_fiscal: string | null
          cap_quantidade: number | null
          cap_tipo: string | null
          client: string
          comprimento: number | null
          created_at: string
          date: string
          emulsao_fornecedor: string | null
          emulsao_qty: number | null
          emulsao_tipo: string | null
          equipment_type: Database["public"]["Enums"]["equipment_type"]
          espessura: number | null
          filer_fornecedor: string | null
          filer_quantidade: number | null
          filer_tipo: string | null
          fleet: string
          fresagem_type: string | null
          fuel_horimeter: string | null
          fuel_quantity: number | null
          fuel_supplier: string | null
          fuel_type: string | null
          id: string
          largura: number | null
          location: string
          meter_final: string | null
          meter_initial: string | null
          observations: string | null
          ogs: string
          operator: string
          passengers: string | null
          period: Database["public"]["Enums"]["work_period"]
          photo_url: string | null
          prancha: string | null
          reservatorio_diesel_fornecedor: string | null
          reservatorio_diesel_qty: number | null
          retro_acoplamento: string | null
          rolo_type: string | null
          signature_url: string | null
          silo_01_material: string | null
          silo_01_quantidade: number | null
          silo_02_material: string | null
          silo_02_quantidade: number | null
          solo_operator: string | null
          status: string
          updated_at: string
          user_id: string
          usina_agua_fornecedor: string | null
          usina_agua_qty: number | null
          usina_operation_type: string | null
          usina_operator_02: string | null
          veiculo_type: string | null
          volume_usinado: number | null
        }
        Insert: {
          acoplamento?: string | null
          agregados_fornecedor?: string | null
          agua_fornecedor?: string | null
          agua_qty?: number | null
          calib_analog?: number | null
          calib_bucket?: number | null
          calib_digital?: number | null
          caminhao_type?: string | null
          cap_fornecedor?: string | null
          cap_nota_fiscal?: string | null
          cap_quantidade?: number | null
          cap_tipo?: string | null
          client: string
          comprimento?: number | null
          created_at?: string
          date: string
          emulsao_fornecedor?: string | null
          emulsao_qty?: number | null
          emulsao_tipo?: string | null
          equipment_type: Database["public"]["Enums"]["equipment_type"]
          espessura?: number | null
          filer_fornecedor?: string | null
          filer_quantidade?: number | null
          filer_tipo?: string | null
          fleet: string
          fresagem_type?: string | null
          fuel_horimeter?: string | null
          fuel_quantity?: number | null
          fuel_supplier?: string | null
          fuel_type?: string | null
          id?: string
          largura?: number | null
          location?: string
          meter_final?: string | null
          meter_initial?: string | null
          observations?: string | null
          ogs: string
          operator: string
          passengers?: string | null
          period?: Database["public"]["Enums"]["work_period"]
          photo_url?: string | null
          prancha?: string | null
          reservatorio_diesel_fornecedor?: string | null
          reservatorio_diesel_qty?: number | null
          retro_acoplamento?: string | null
          rolo_type?: string | null
          signature_url?: string | null
          silo_01_material?: string | null
          silo_01_quantidade?: number | null
          silo_02_material?: string | null
          silo_02_quantidade?: number | null
          solo_operator?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          usina_agua_fornecedor?: string | null
          usina_agua_qty?: number | null
          usina_operation_type?: string | null
          usina_operator_02?: string | null
          veiculo_type?: string | null
          volume_usinado?: number | null
        }
        Update: {
          acoplamento?: string | null
          agregados_fornecedor?: string | null
          agua_fornecedor?: string | null
          agua_qty?: number | null
          calib_analog?: number | null
          calib_bucket?: number | null
          calib_digital?: number | null
          caminhao_type?: string | null
          cap_fornecedor?: string | null
          cap_nota_fiscal?: string | null
          cap_quantidade?: number | null
          cap_tipo?: string | null
          client?: string
          comprimento?: number | null
          created_at?: string
          date?: string
          emulsao_fornecedor?: string | null
          emulsao_qty?: number | null
          emulsao_tipo?: string | null
          equipment_type?: Database["public"]["Enums"]["equipment_type"]
          espessura?: number | null
          filer_fornecedor?: string | null
          filer_quantidade?: number | null
          filer_tipo?: string | null
          fleet?: string
          fresagem_type?: string | null
          fuel_horimeter?: string | null
          fuel_quantity?: number | null
          fuel_supplier?: string | null
          fuel_type?: string | null
          id?: string
          largura?: number | null
          location?: string
          meter_final?: string | null
          meter_initial?: string | null
          observations?: string | null
          ogs?: string
          operator?: string
          passengers?: string | null
          period?: Database["public"]["Enums"]["work_period"]
          photo_url?: string | null
          prancha?: string | null
          reservatorio_diesel_fornecedor?: string | null
          reservatorio_diesel_qty?: number | null
          retro_acoplamento?: string | null
          rolo_type?: string | null
          signature_url?: string | null
          silo_01_material?: string | null
          silo_01_quantidade?: number | null
          silo_02_material?: string | null
          silo_02_quantidade?: number | null
          solo_operator?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          usina_agua_fornecedor?: string | null
          usina_agua_qty?: number | null
          usina_operation_type?: string | null
          usina_operator_02?: string | null
          veiculo_type?: string | null
          volume_usinado?: number | null
        }
        Relationships: []
      }
      fueling_entries: {
        Row: {
          created_at: string | null
          diary_id: string | null
          equipment_hour_meter: number | null
          fleet_number: string | null
          id: number
          liters_filled: number | null
          lubricator_name: string | null
          ogs_number: string | null
          reservoir_initial_qty: number | null
          supervisor_name: string | null
          was_lubricated: boolean | null
        }
        Insert: {
          created_at?: string | null
          diary_id?: string | null
          equipment_hour_meter?: number | null
          fleet_number?: string | null
          id?: number
          liters_filled?: number | null
          lubricator_name?: string | null
          ogs_number?: string | null
          reservoir_initial_qty?: number | null
          supervisor_name?: string | null
          was_lubricated?: boolean | null
        }
        Update: {
          created_at?: string | null
          diary_id?: string | null
          equipment_hour_meter?: number | null
          fleet_number?: string | null
          id?: number
          liters_filled?: number | null
          lubricator_name?: string | null
          ogs_number?: string | null
          reservoir_initial_qty?: number | null
          supervisor_name?: string | null
          was_lubricated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fueling_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas_frota: {
        Row: {
          created_at: string | null
          frota: string
          id: string
          nome: string
          status: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          frota: string
          id?: string
          nome: string
          status?: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          frota?: string
          id?: string
          nome?: string
          status?: string
          tipo?: string | null
        }
        Relationships: []
      }
      ogs_reference: {
        Row: {
          cliente: string
          created_at: string | null
          endereco: string
          id: number
          numero_ogs: string
        }
        Insert: {
          cliente: string
          created_at?: string | null
          endereco: string
          id?: number
          numero_ogs: string
        }
        Update: {
          cliente?: string
          created_at?: string | null
          endereco?: string
          id?: number
          numero_ogs?: string
        }
        Relationships: []
      }
      production_entries: {
        Row: {
          area_m2: number | null
          comprimento: number
          created_at: string | null
          diary_id: string
          espessura: number
          id: string
          largura: number
          volume_m3: number | null
        }
        Insert: {
          area_m2?: number | null
          comprimento: number
          created_at?: string | null
          diary_id: string
          espessura: number
          id?: string
          largura: number
          volume_m3?: number | null
        }
        Update: {
          area_m2?: number | null
          comprimento?: number
          created_at?: string | null
          diary_id?: string
          espessura?: number
          id?: string
          largura?: number
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_banho_ligacao: {
        Row: {
          area_recipiente_cm2: number | null
          created_at: string | null
          estaca_km: string | null
          id: string
          peso_material_g: number | null
          peso_recipiente_g: number | null
          peso_total_g: number | null
          posicao_coleta: string | null
          rdo_id: string | null
          recipiente_no: string | null
          taxa_kg_m2: number | null
          taxa_l_m2: number | null
        }
        Insert: {
          area_recipiente_cm2?: number | null
          created_at?: string | null
          estaca_km?: string | null
          id?: string
          peso_material_g?: number | null
          peso_recipiente_g?: number | null
          peso_total_g?: number | null
          posicao_coleta?: string | null
          rdo_id?: string | null
          recipiente_no?: string | null
          taxa_kg_m2?: number | null
          taxa_l_m2?: number | null
        }
        Update: {
          area_recipiente_cm2?: number | null
          created_at?: string | null
          estaca_km?: string | null
          id?: string
          peso_material_g?: number | null
          peso_recipiente_g?: number | null
          peso_total_g?: number | null
          posicao_coleta?: string | null
          rdo_id?: string | null
          recipiente_no?: string | null
          taxa_kg_m2?: number | null
          taxa_l_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_banho_ligacao_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_diarios: {
        Row: {
          clima: string | null
          created_at: string | null
          data: string | null
          id: string
          obra_nome: string
          turno: string | null
        }
        Insert: {
          clima?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          obra_nome: string
          turno?: string | null
        }
        Update: {
          clima?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          obra_nome?: string
          turno?: string | null
        }
        Relationships: []
      }
      rdo_efetivo: {
        Row: {
          entrada: string | null
          funcao: string | null
          id: string
          quantidade: number | null
          rdo_id: string | null
          saida: string | null
        }
        Insert: {
          entrada?: string | null
          funcao?: string | null
          id?: string
          quantidade?: number | null
          rdo_id?: string | null
          saida?: string | null
        }
        Update: {
          entrada?: string | null
          funcao?: string | null
          id?: string
          quantidade?: number | null
          rdo_id?: string | null
          saida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_efetivo_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_mancha_areia: {
        Row: {
          created_at: string | null
          d1_mm: number | null
          d2_mm: number | null
          d3_mm: number | null
          dm_mm: number | null
          espessura_mm: number | null
          faixa: string | null
          hs_mm: number | null
          id: string
          rdo_id: string | null
          volume_cm3: number | null
        }
        Insert: {
          created_at?: string | null
          d1_mm?: number | null
          d2_mm?: number | null
          d3_mm?: number | null
          dm_mm?: number | null
          espessura_mm?: number | null
          faixa?: string | null
          hs_mm?: number | null
          id?: string
          rdo_id?: string | null
          volume_cm3?: number | null
        }
        Update: {
          created_at?: string | null
          d1_mm?: number | null
          d2_mm?: number | null
          d3_mm?: number | null
          dm_mm?: number | null
          espessura_mm?: number | null
          faixa?: string | null
          hs_mm?: number | null
          id?: string
          rdo_id?: string | null
          volume_cm3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_mancha_areia_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_producao: {
        Row: {
          comprimento_m: number | null
          espessura_cm: number | null
          faixa: string | null
          id: string
          km_final: number | null
          km_inicial: number | null
          largura_m: number | null
          rdo_id: string | null
          rodovia: string | null
          sentido: string | null
          tipo_servico: string | null
        }
        Insert: {
          comprimento_m?: number | null
          espessura_cm?: number | null
          faixa?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          largura_m?: number | null
          rdo_id?: string | null
          rodovia?: string | null
          sentido?: string | null
          tipo_servico?: string | null
        }
        Update: {
          comprimento_m?: number | null
          espessura_cm?: number | null
          faixa?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          largura_m?: number | null
          rdo_id?: string | null
          rodovia?: string | null
          sentido?: string | null
          tipo_servico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_producao_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_temperatura_espalhamento: {
        Row: {
          created_at: string | null
          faixa_aplicada: string | null
          hora_descarga: string | null
          id: string
          km_final: number | null
          km_inicial: number | null
          placa_veiculo: string | null
          rdo_id: string | null
          temp_chegada_c: number | null
          temp_rolagem_c: number | null
          temp_usina_c: number | null
        }
        Insert: {
          created_at?: string | null
          faixa_aplicada?: string | null
          hora_descarga?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          placa_veiculo?: string | null
          rdo_id?: string | null
          temp_chegada_c?: number | null
          temp_rolagem_c?: number | null
          temp_usina_c?: number | null
        }
        Update: {
          created_at?: string | null
          faixa_aplicada?: string | null
          hora_descarga?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          placa_veiculo?: string | null
          rdo_id?: string | null
          temp_chegada_c?: number | null
          temp_rolagem_c?: number | null
          temp_usina_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_temperatura_espalhamento_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          activity: string
          created_at: string | null
          destination: string | null
          diary_id: string
          end_time: string | null
          id: string
          is_critical: boolean | null
          maintenance_details: string | null
          origin: string | null
          sort_order: number
          start_time: string
          transport_obs: string | null
        }
        Insert: {
          activity: string
          created_at?: string | null
          destination?: string | null
          diary_id: string
          end_time?: string | null
          id?: string
          is_critical?: boolean | null
          maintenance_details?: string | null
          origin?: string | null
          sort_order?: number
          start_time: string
          transport_obs?: string | null
        }
        Update: {
          activity?: string
          created_at?: string | null
          destination?: string | null
          diary_id?: string
          end_time?: string | null
          id?: string
          is_critical?: boolean | null
          maintenance_details?: string | null
          origin?: string | null
          sort_order?: number
          start_time?: string
          transport_obs?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      view_apoio_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "HORÍMETRO FINAL": string | null
          "HORÍMETRO INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBSERVAÇÕES: string | null
          OPERADOR: string | null
          "QTD DIESEL (L)": number | null
          TIPO: Database["public"]["Enums"]["equipment_type"] | null
        }
        Relationships: []
      }
      view_bobcat_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INI 1": string | null
          "INI 10": string | null
          "INI 11": string | null
          "INI 12": string | null
          "INI 13": string | null
          "INI 14": string | null
          "INI 15": string | null
          "INI 2": string | null
          "INI 3": string | null
          "INI 4": string | null
          "INI 5": string | null
          "INI 6": string | null
          "INI 7": string | null
          "INI 8": string | null
          "INI 9": string | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_caminhao_form_style: {
        Row: {
          "ATV 1": string | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INI 1": string | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_carreta_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_comboio_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_fresadora_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          C1: number | null
          DATA: string | null
          "DIESEL (L)": number | null
          E1: number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INI 1": string | null
          "INI 10": string | null
          "INI 11": string | null
          "INI 12": string | null
          "INI 13": string | null
          "INI 14": string | null
          "INI 15": string | null
          "INI 2": string | null
          "INI 3": string | null
          "INI 4": string | null
          "INI 5": string | null
          "INI 6": string | null
          "INI 7": string | null
          "INI 8": string | null
          "INI 9": string | null
          L1: number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_geral_form_style: {
        Row: {
          ASSINATURA: string | null
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          CLIENTE: string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "HORÍMETRO FINAL": string | null
          "HORÍMETRO INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "LINK DA FOTO": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBSERVAÇÕES: string | null
          OGS: string | null
          OPERADOR: string | null
          "QTD DIESEL (L)": number | null
        }
        Relationships: []
      }
      view_producao_fresadora: {
        Row: {
          "Área (m2)": number | null
          Cliente: string | null
          "Comp (m)": number | null
          Data: string | null
          "Esp (cm)": number | null
          Frota: string | null
          "Larg (m)": number | null
          OGS: string | null
          Operador: string | null
          "Status Geral": string | null
          "Volume (m3)": number | null
        }
        Relationships: []
      }
      view_relatorio_geral_fresadora: {
        Row: {
          "Bits Trocados": number | null
          Cliente: string | null
          Data: string | null
          "Diesel (L)": number | null
          Frota: string | null
          "Horímetro Final": string | null
          "Horímetro Inicial": string | null
          Observações: string | null
          OGS: string | null
          Operador: string | null
          Status: string | null
          "Tipo Combustível": string | null
          "Total Área (m2)": number | null
          "Total Volume (m3)": number | null
        }
        Insert: {
          "Bits Trocados"?: never
          Cliente?: string | null
          Data?: string | null
          "Diesel (L)"?: number | null
          Frota?: string | null
          "Horímetro Final"?: string | null
          "Horímetro Inicial"?: string | null
          Observações?: string | null
          OGS?: string | null
          Operador?: string | null
          Status?: string | null
          "Tipo Combustível"?: string | null
          "Total Área (m2)"?: never
          "Total Volume (m3)"?: never
        }
        Update: {
          "Bits Trocados"?: never
          Cliente?: string | null
          Data?: string | null
          "Diesel (L)"?: number | null
          Frota?: string | null
          "Horímetro Final"?: string | null
          "Horímetro Inicial"?: string | null
          Observações?: string | null
          OGS?: string | null
          Operador?: string | null
          Status?: string | null
          "Tipo Combustível"?: string | null
          "Total Área (m2)"?: never
          "Total Volume (m3)"?: never
        }
        Relationships: []
      }
      view_rendimento_bits: {
        Row: {
          "DATA DA TROCA": string | null
          EQUIPAMENTO: string | null
          "HORAS DURADAS": number | null
          "HORÍMETRO FIM": number | null
          "HORÍMETRO INÍCIO": number | null
          "MARCA DO BIT": string | null
          "QTD JOGO": number | null
          "RENDIMENTO (M2/H)": number | null
          "TOTAL M2 FRESADO": number | null
        }
        Relationships: []
      }
      view_retroescavadeira_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_rolo_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_transporte_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_usina_kma_form_style: {
        Row: {
          ASSINATURA: string | null
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CAP (KG)": number | null
          CLIENTE: string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "FILER (KG)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "HORÍMETRO FINAL": string | null
          "HORÍMETRO INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "LINK DA FOTO": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBSERVAÇÕES: string | null
          OGS: string | null
          OPERAÇÃO: string | null
          OPERADOR: string | null
          "QTD DIESEL (L)": number | null
          "VOLUME (M3)": number | null
        }
        Relationships: []
      }
      view_veiculo_transporte_form_style: {
        Row: {
          "ATV 1": string | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INI 1": string | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
      view_vibroacabadora_form_style: {
        Row: {
          "ATV 1": string | null
          "ATV 10": string | null
          "ATV 11": string | null
          "ATV 12": string | null
          "ATV 13": string | null
          "ATV 14": string | null
          "ATV 15": string | null
          "ATV 2": string | null
          "ATV 3": string | null
          "ATV 4": string | null
          "ATV 5": string | null
          "ATV 6": string | null
          "ATV 7": string | null
          "ATV 8": string | null
          "ATV 9": string | null
          "CRÍTICO 1": number | null
          "CRÍTICO 10": number | null
          "CRÍTICO 11": number | null
          "CRÍTICO 12": number | null
          "CRÍTICO 13": number | null
          "CRÍTICO 14": number | null
          "CRÍTICO 15": number | null
          "CRÍTICO 2": number | null
          "CRÍTICO 3": number | null
          "CRÍTICO 4": number | null
          "CRÍTICO 5": number | null
          "CRÍTICO 6": number | null
          "CRÍTICO 7": number | null
          "CRÍTICO 8": number | null
          "CRÍTICO 9": number | null
          DATA: string | null
          "DIESEL (L)": number | null
          "FIM 1": string | null
          "FIM 10": string | null
          "FIM 11": string | null
          "FIM 12": string | null
          "FIM 13": string | null
          "FIM 14": string | null
          "FIM 15": string | null
          "FIM 2": string | null
          "FIM 3": string | null
          "FIM 4": string | null
          "FIM 5": string | null
          "FIM 6": string | null
          "FIM 7": string | null
          "FIM 8": string | null
          "FIM 9": string | null
          FROTA: string | null
          "H. FINAL": string | null
          "H. INICIAL": string | null
          "INÍCIO 1": string | null
          "INÍCIO 10": string | null
          "INÍCIO 11": string | null
          "INÍCIO 12": string | null
          "INÍCIO 13": string | null
          "INÍCIO 14": string | null
          "INÍCIO 15": string | null
          "INÍCIO 2": string | null
          "INÍCIO 3": string | null
          "INÍCIO 4": string | null
          "INÍCIO 5": string | null
          "INÍCIO 6": string | null
          "INÍCIO 7": string | null
          "INÍCIO 8": string | null
          "INÍCIO 9": string | null
          "MANUT 1": string | null
          "MANUT 10": string | null
          "MANUT 11": string | null
          "MANUT 12": string | null
          "MANUT 13": string | null
          "MANUT 14": string | null
          "MANUT 15": string | null
          "MANUT 2": string | null
          "MANUT 3": string | null
          "MANUT 4": string | null
          "MANUT 5": string | null
          "MANUT 6": string | null
          "MANUT 7": string | null
          "MANUT 8": string | null
          "MANUT 9": string | null
          "MÉDIA L/H": number | null
          OBS: string | null
          OPERADOR: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      checklist_status: "ok" | "nao_ok"
      equipment_type:
        | "fresadora"
        | "bobcat"
        | "rolo"
        | "caminhao"
        | "carreta"
        | "comboio"
        | "veiculo"
        | "vibroacabadora"
        | "retroescavadeira"
        | "usina"
      usina_operation_type: "usinagem" | "limpeza" | "manutencao"
      work_period: "diurno" | "noturno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      checklist_status: ["ok", "nao_ok"],
      equipment_type: [
        "fresadora",
        "bobcat",
        "rolo",
        "caminhao",
        "carreta",
        "comboio",
        "veiculo",
        "vibroacabadora",
        "retroescavadeira",
        "usina",
      ],
      usina_operation_type: ["usinagem", "limpeza", "manutencao"],
      work_period: ["diurno", "noturno"],
    },
  },
} as const
