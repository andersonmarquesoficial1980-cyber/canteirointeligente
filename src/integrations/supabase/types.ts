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
      equipment_diaries: {
        Row: {
          client: string | null
          company_id: string | null
          created_at: string | null
          date: string | null
          equipment_type: string | null
          fleet: string | null
          fuel_quantity: number | null
          id: string
          location: string | null
          meter_final: number | null
          meter_initial: number | null
          ogs: string | null
          operator: string | null
          status: string | null
        }
        Insert: {
          client?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          equipment_type?: string | null
          fleet?: string | null
          fuel_quantity?: number | null
          id?: string
          location?: string | null
          meter_final?: number | null
          meter_initial?: number | null
          ogs?: string | null
          operator?: string | null
          status?: string | null
        }
        Update: {
          client?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          equipment_type?: string | null
          fleet?: string | null
          fuel_quantity?: number | null
          id?: string
          location?: string | null
          meter_final?: number | null
          meter_initial?: number | null
          ogs?: string | null
          operator?: string | null
          status?: string | null
        }
        Relationships: []
      }
      equipment_time_entries: {
        Row: {
          activity: string | null
          created_at: string | null
          end_time: string | null
          equipment_diary_id: string | null
          id: string
          start_time: string | null
        }
        Insert: {
          activity?: string | null
          created_at?: string | null
          end_time?: string | null
          equipment_diary_id?: string | null
          id?: string
          start_time?: string | null
        }
        Update: {
          activity?: string | null
          created_at?: string | null
          end_time?: string | null
          equipment_diary_id?: string | null
          id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_time_entries_equipment_diary_id_fkey"
            columns: ["equipment_diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
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
          created_at: string | null
          diary_id: string | null
          fator_ajuste: number | null
          id: number
          peso_nominal_usina: number | null
          peso_real_referencia: number | null
          tara_caminhao: number | null
          tentativa_numero: number | null
          ticket_photo_url: string | null
        }
        Insert: {
          created_at?: string | null
          diary_id?: string | null
          fator_ajuste?: number | null
          id?: number
          peso_nominal_usina?: number | null
          peso_real_referencia?: number | null
          tara_caminhao?: number | null
          tentativa_numero?: number | null
          ticket_photo_url?: string | null
        }
        Update: {
          created_at?: string | null
          diary_id?: string | null
          fator_ajuste?: number | null
          id?: number
          peso_nominal_usina?: number | null
          peso_real_referencia?: number | null
          tara_caminhao?: number | null
          tentativa_numero?: number | null
          ticket_photo_url?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      profiles: {
        Row: {
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
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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
