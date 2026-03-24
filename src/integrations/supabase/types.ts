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
        Relationships: []
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
        Relationships: []
      }
      checklist_items_standard: {
        Row: {
          created_at: string | null
          equipment_type: string
          id: string
          item_name: string
        }
        Insert: {
          created_at?: string | null
          equipment_type?: string
          id?: string
          item_name: string
        }
        Update: {
          created_at?: string | null
          equipment_type?: string
          id?: string
          item_name?: string
        }
        Relationships: []
      }
      comboio_equipment_refueling: {
        Row: {
          created_at: string | null
          diary_id: string | null
          equipment_fleet_fueled: string | null
          equipment_meter: number | null
          final_diesel_balance: number | null
          id: string
          initial_diesel_balance: number | null
          is_lubricated: boolean | null
          is_washed: boolean | null
          liters_fueled: number | null
          lubricator_name: string | null
          ogs_destination: string | null
          supervisor_name: string | null
          total_fueled_in_work: number | null
        }
        Insert: {
          created_at?: string | null
          diary_id?: string | null
          equipment_fleet_fueled?: string | null
          equipment_meter?: number | null
          final_diesel_balance?: number | null
          id?: string
          initial_diesel_balance?: number | null
          is_lubricated?: boolean | null
          is_washed?: boolean | null
          liters_fueled?: number | null
          lubricator_name?: string | null
          ogs_destination?: string | null
          supervisor_name?: string | null
          total_fueled_in_work?: number | null
        }
        Update: {
          created_at?: string | null
          diary_id?: string | null
          equipment_fleet_fueled?: string | null
          equipment_meter?: number | null
          final_diesel_balance?: number | null
          id?: string
          initial_diesel_balance?: number | null
          is_lubricated?: boolean | null
          is_washed?: boolean | null
          liters_fueled?: number | null
          lubricator_name?: string | null
          ogs_destination?: string | null
          supervisor_name?: string | null
          total_fueled_in_work?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comboio_equipment_refueling_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comboio_equipment_refueling_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      configuracoes_relatorio: {
        Row: {
          created_at: string
          emails_destino: string[]
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emails_destino?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emails_destino?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          name: string
          role: string | null
        }
        Insert: {
          id?: string
          name: string
          role?: string | null
        }
        Update: {
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      empreiteiros: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          vinculo_rdo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          vinculo_rdo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          vinculo_rdo?: string
        }
        Relationships: []
      }
      equipment_attachments: {
        Row: {
          fleet_id: string | null
          id: string
          type: string | null
        }
        Insert: {
          fleet_id?: string | null
          id?: string
          type?: string | null
        }
        Update: {
          fleet_id?: string | null
          id?: string
          type?: string | null
        }
        Relationships: []
      }
      equipment_bits: {
        Row: {
          brand: string | null
          diary_id: string | null
          id: string
          meter_at_change: number | null
          quantity: number | null
          status: string | null
        }
        Insert: {
          brand?: string | null
          diary_id?: string | null
          id?: string
          meter_at_change?: number | null
          quantity?: number | null
          status?: string | null
        }
        Update: {
          brand?: string | null
          diary_id?: string | null
          id?: string
          meter_at_change?: number | null
          quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_bits_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_bits_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      equipment_checklist_results: {
        Row: {
          created_at: string | null
          diary_id: string | null
          id: string
          item_name: string
          observation: string | null
          photo_avaria_url: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          diary_id?: string | null
          id?: string
          item_name: string
          observation?: string | null
          photo_avaria_url?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          diary_id?: string | null
          id?: string
          item_name?: string
          observation?: string | null
          photo_avaria_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_checklist_results_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_checklist_results_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      equipment_diaries: {
        Row: {
          attachment_type: string | null
          client_name: string | null
          company_id: string | null
          created_at: string | null
          date: string | null
          equipment_fleet: string | null
          equipment_type: string | null
          fresagem_type: string | null
          fuel_liters: number | null
          fuel_meter: number | null
          fuel_type: string | null
          id: string
          location_address: string | null
          meter_final: number | null
          meter_initial: number | null
          observations: string | null
          odometer_final: number | null
          odometer_initial: number | null
          ogs_number: string | null
          operator_name: string | null
          operator_solo: string | null
          period: string | null
          status: string | null
          work_status: string | null
        }
        Insert: {
          attachment_type?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          equipment_fleet?: string | null
          equipment_type?: string | null
          fresagem_type?: string | null
          fuel_liters?: number | null
          fuel_meter?: number | null
          fuel_type?: string | null
          id?: string
          location_address?: string | null
          meter_final?: number | null
          meter_initial?: number | null
          observations?: string | null
          odometer_final?: number | null
          odometer_initial?: number | null
          ogs_number?: string | null
          operator_name?: string | null
          operator_solo?: string | null
          period?: string | null
          status?: string | null
          work_status?: string | null
        }
        Update: {
          attachment_type?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          equipment_fleet?: string | null
          equipment_type?: string | null
          fresagem_type?: string | null
          fuel_liters?: number | null
          fuel_meter?: number | null
          fuel_type?: string | null
          id?: string
          location_address?: string | null
          meter_final?: number | null
          meter_initial?: number | null
          observations?: string | null
          odometer_final?: number | null
          odometer_initial?: number | null
          ogs_number?: string | null
          operator_name?: string | null
          operator_solo?: string | null
          period?: string | null
          status?: string | null
          work_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_diaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_diaries_ogs_number_fkey"
            columns: ["ogs_number"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["ogs_number"]
          },
        ]
      }
      equipment_fleets: {
        Row: {
          equipment_type: string | null
          fleet_number: string | null
          id: string
        }
        Insert: {
          equipment_type?: string | null
          fleet_number?: string | null
          id?: string
        }
        Update: {
          equipment_type?: string | null
          fleet_number?: string | null
          id?: string
        }
        Relationships: []
      }
      equipment_production_areas: {
        Row: {
          diary_id: string | null
          id: string
          length_m: number | null
          m2: number | null
          m3: number | null
          thickness_cm: number | null
          width_m: number | null
        }
        Insert: {
          diary_id?: string | null
          id?: string
          length_m?: number | null
          m2?: number | null
          m3?: number | null
          thickness_cm?: number | null
          width_m?: number | null
        }
        Update: {
          diary_id?: string | null
          id?: string
          length_m?: number | null
          m2?: number | null
          m3?: number | null
          thickness_cm?: number | null
          width_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_production_areas_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_production_areas_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      equipment_time_entries: {
        Row: {
          activity: string | null
          description: string | null
          destination: string | null
          diary_id: string | null
          end_time: string | null
          id: string
          ogs_destination: string | null
          origin: string | null
          start_time: string | null
        }
        Insert: {
          activity?: string | null
          description?: string | null
          destination?: string | null
          diary_id?: string | null
          end_time?: string | null
          id?: string
          ogs_destination?: string | null
          origin?: string | null
          start_time?: string | null
        }
        Update: {
          activity?: string | null
          description?: string | null
          destination?: string | null
          diary_id?: string | null
          end_time?: string | null
          id?: string
          ogs_destination?: string | null
          origin?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_time_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_time_entries_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      equipment_visual_inspection: {
        Row: {
          created_at: string | null
          damage_type: string | null
          diary_id: string | null
          id: string
          photo_avaria_url: string | null
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string | null
          damage_type?: string | null
          diary_id?: string | null
          id?: string
          photo_avaria_url?: string | null
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string | null
          damage_type?: string | null
          diary_id?: string | null
          id?: string
          photo_avaria_url?: string | null
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_visual_inspection_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_visual_inspection_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      fleet_refueling_logs: {
        Row: {
          created_at: string | null
          diary_id: string | null
          id: string
          is_lubricated: boolean | null
          is_washed: boolean | null
          liters_refueled: number | null
          meter_reading: number | null
          ogs_number: string | null
          target_equipment_fleet: string | null
        }
        Insert: {
          created_at?: string | null
          diary_id?: string | null
          id?: string
          is_lubricated?: boolean | null
          is_washed?: boolean | null
          liters_refueled?: number | null
          meter_reading?: number | null
          ogs_number?: string | null
          target_equipment_fleet?: string | null
        }
        Update: {
          created_at?: string | null
          diary_id?: string | null
          id?: string
          is_lubricated?: boolean | null
          is_washed?: boolean | null
          liters_refueled?: number | null
          meter_reading?: number | null
          ogs_number?: string | null
          target_equipment_fleet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_refueling_logs_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_refueling_logs_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          vinculo_rdo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          vinculo_rdo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          vinculo_rdo?: string
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
        Relationships: []
      }
      funcionarios: {
        Row: {
          created_at: string | null
          funcao: string
          id: string
          matricula: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          funcao: string
          id?: string
          matricula: string
          nome: string
        }
        Update: {
          created_at?: string | null
          funcao?: string
          id?: string
          matricula?: string
          nome?: string
        }
        Relationships: []
      }
      kma_calibration_entries: {
        Row: {
          adjustment_factor: number | null
          attempt_number: number | null
          created_at: string | null
          equipment_diary_id: string | null
          id: string
          nominal_weight_usina: number | null
          real_weight_reference: number | null
          ticket_photo_url: string | null
          truck_tara: number | null
        }
        Insert: {
          adjustment_factor?: number | null
          attempt_number?: number | null
          created_at?: string | null
          equipment_diary_id?: string | null
          id?: string
          nominal_weight_usina?: number | null
          real_weight_reference?: number | null
          ticket_photo_url?: string | null
          truck_tara?: number | null
        }
        Update: {
          adjustment_factor?: number | null
          attempt_number?: number | null
          created_at?: string | null
          equipment_diary_id?: string | null
          id?: string
          nominal_weight_usina?: number | null
          real_weight_reference?: number | null
          ticket_photo_url?: string | null
          truck_tara?: number | null
        }
        Relationships: []
      }
      kma_calibration_tests: {
        Row: {
          diary_id: string | null
          error_percentage: number | null
          id: string
          is_approved: boolean | null
          nominal_usina_kg: number | null
          real_scale_kg: number | null
          test_number: number | null
          ticket_photo_url: string | null
          truck_tare: number | null
        }
        Insert: {
          diary_id?: string | null
          error_percentage?: number | null
          id?: string
          is_approved?: boolean | null
          nominal_usina_kg?: number | null
          real_scale_kg?: number | null
          test_number?: number | null
          ticket_photo_url?: string | null
          truck_tare?: number | null
        }
        Update: {
          diary_id?: string | null
          error_percentage?: number | null
          id?: string
          is_approved?: boolean | null
          nominal_usina_kg?: number | null
          real_scale_kg?: number | null
          test_number?: number | null
          ticket_photo_url?: string | null
          truck_tare?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kma_calibration_tests_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kma_calibration_tests_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      kma_operations: {
        Row: {
          aggregates_supplier: string | null
          cap_nf_number: string | null
          cap_qty_ton: number | null
          cap_supplier: string | null
          cap_type: string | null
          diary_id: string | null
          filer_qty_ton: number | null
          filer_supplier: string | null
          filer_type: string | null
          id: string
          operation_type: string | null
          silo1_material: string | null
          silo1_qty: number | null
          silo2_material: string | null
          silo2_qty: number | null
          total_volume_machined_ton: number | null
          water_liters: number | null
          water_supplier: string | null
        }
        Insert: {
          aggregates_supplier?: string | null
          cap_nf_number?: string | null
          cap_qty_ton?: number | null
          cap_supplier?: string | null
          cap_type?: string | null
          diary_id?: string | null
          filer_qty_ton?: number | null
          filer_supplier?: string | null
          filer_type?: string | null
          id?: string
          operation_type?: string | null
          silo1_material?: string | null
          silo1_qty?: number | null
          silo2_material?: string | null
          silo2_qty?: number | null
          total_volume_machined_ton?: number | null
          water_liters?: number | null
          water_supplier?: string | null
        }
        Update: {
          aggregates_supplier?: string | null
          cap_nf_number?: string | null
          cap_qty_ton?: number | null
          cap_supplier?: string | null
          cap_type?: string | null
          diary_id?: string | null
          filer_qty_ton?: number | null
          filer_supplier?: string | null
          filer_type?: string | null
          id?: string
          operation_type?: string | null
          silo1_material?: string | null
          silo1_qty?: number | null
          silo2_material?: string | null
          silo2_qty?: number | null
          total_volume_machined_ton?: number | null
          water_liters?: number | null
          water_supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kma_operations_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kma_operations_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      maquinas_frota: {
        Row: {
          categoria: string | null
          created_at: string | null
          empresa: string | null
          frota: string
          id: string
          nome: string
          status: string
          tipo: string | null
          vinculo_rdo: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          empresa?: string | null
          frota: string
          id?: string
          nome: string
          status?: string
          tipo?: string | null
          vinculo_rdo?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          empresa?: string | null
          frota?: string
          id?: string
          nome?: string
          status?: string
          tipo?: string | null
          vinculo_rdo?: string
        }
        Relationships: []
      }
      materiais: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          tipo_uso: string
          vinculo_rdo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          tipo_uso?: string
          vinculo_rdo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          tipo_uso?: string
          vinculo_rdo?: string
        }
        Relationships: []
      }
      ogs_reference: {
        Row: {
          client_name: string | null
          id: string
          location_address: string | null
          ogs_number: string | null
        }
        Insert: {
          client_name?: string | null
          id?: string
          location_address?: string | null
          ogs_number?: string | null
        }
        Update: {
          client_name?: string | null
          id?: string
          location_address?: string | null
          ogs_number?: string | null
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
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string
          id: string
          nome_completo: string
          perfil: string
          role: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          nome_completo: string
          perfil: string
          role?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome_completo?: string
          perfil?: string
          role?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          responsavel: string | null
          turno: string | null
          user_id: string | null
        }
        Insert: {
          clima?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          obra_nome: string
          responsavel?: string | null
          turno?: string | null
          user_id?: string | null
        }
        Update: {
          clima?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          obra_nome?: string
          responsavel?: string | null
          turno?: string | null
          user_id?: string | null
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
      rdo_labor_attendance: {
        Row: {
          created_at: string | null
          employee_id: string | null
          employee_name: string | null
          extra_hours: number | null
          id: string
          rdo_id: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          employee_name?: string | null
          extra_hours?: number | null
          id?: string
          rdo_id?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          employee_name?: string | null
          extra_hours?: number | null
          id?: string
          rdo_id?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_labor_attendance_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_labor_attendance_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
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
      road_roller_fleets: {
        Row: {
          fleet_number: string | null
          id: string
          roller_type: string | null
        }
        Insert: {
          fleet_number?: string | null
          id?: string
          roller_type?: string | null
        }
        Update: {
          fleet_number?: string | null
          id?: string
          roller_type?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      tipos_servico: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          vinculo_rdo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          vinculo_rdo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          vinculo_rdo?: string
        }
        Relationships: []
      }
      trailer_fleets: {
        Row: {
          fleet_number: string | null
          id: string
        }
        Insert: {
          fleet_number?: string | null
          id?: string
        }
        Update: {
          fleet_number?: string | null
          id?: string
        }
        Relationships: []
      }
      truck_tank_supplies: {
        Row: {
          created_at: string | null
          diary_id: string | null
          emulsion_type: string | null
          id: string
          material_type: string | null
          quantity: number | null
          supplier: string | null
        }
        Insert: {
          created_at?: string | null
          diary_id?: string | null
          emulsion_type?: string | null
          id?: string
          material_type?: string | null
          quantity?: number | null
          supplier?: string | null
        }
        Update: {
          created_at?: string | null
          diary_id?: string | null
          emulsion_type?: string | null
          id?: string
          material_type?: string | null
          quantity?: number | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_tank_supplies_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_tank_supplies_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
      }
      trucker_trips: {
        Row: {
          arrival_time: string | null
          created_at: string | null
          departure_time: string | null
          destination_id: string | null
          id: string
          material_type: string | null
          origin_ogs_id: string | null
          quantity: number | null
          status: string | null
          truck_plate: string
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          destination_id?: string | null
          id?: string
          material_type?: string | null
          origin_ogs_id?: string | null
          quantity?: number | null
          status?: string | null
          truck_plate: string
        }
        Update: {
          arrival_time?: string | null
          created_at?: string | null
          departure_time?: string | null
          destination_id?: string | null
          id?: string
          material_type?: string | null
          origin_ogs_id?: string | null
          quantity?: number | null
          status?: string | null
          truck_plate?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      usinas: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          vinculo_rdo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          vinculo_rdo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          vinculo_rdo?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_frota_status_atual: {
        Row: {
          activity: string | null
          description: string | null
          destination: string | null
          equipment_fleet: string | null
          status_cor: string | null
        }
        Relationships: []
      }
      view_rendimento_fresadora: {
        Row: {
          diary_id: string | null
          equipment_fleet: string | null
          m3_por_bit: number | null
          ogs_number: string | null
          total_bits: number | null
          total_m2: number | null
          total_m3: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_diaries_ogs_number_fkey"
            columns: ["ogs_number"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["ogs_number"]
          },
        ]
      }
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      checklist_status: "ok" | "nao_ok" | "na"
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
      checklist_status: ["ok", "nao_ok", "na"],
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
