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
      abastecimentos: {
        Row: {
          autorizado_por: string | null
          comboio_fleet: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data: string
          diary_id: string | null
          equipment_fleet: string
          equipment_type: string | null
          fonte: string
          fornecedor: string | null
          hora: string | null
          horimetro: number | null
          id: string
          km_odometro: number | null
          lavado: boolean | null
          litros: number
          lubrificado: boolean | null
          observacao: string | null
          ogs: string | null
        }
        Insert: {
          autorizado_por?: string | null
          comboio_fleet?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data: string
          diary_id?: string | null
          equipment_fleet: string
          equipment_type?: string | null
          fonte?: string
          fornecedor?: string | null
          hora?: string | null
          horimetro?: number | null
          id?: string
          km_odometro?: number | null
          lavado?: boolean | null
          litros: number
          lubrificado?: boolean | null
          observacao?: string | null
          ogs?: string | null
        }
        Update: {
          autorizado_por?: string | null
          comboio_fleet?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          diary_id?: string | null
          equipment_fleet?: string
          equipment_type?: string | null
          fonte?: string
          fornecedor?: string | null
          hora?: string | null
          horimetro?: number | null
          id?: string
          km_odometro?: number | null
          lavado?: boolean | null
          litros?: number
          lubrificado?: boolean | null
          observacao?: string | null
          ogs?: string | null
        }
        Relationships: []
      }
      aero_pav_gru_staff: {
        Row: {
          ativo: boolean
          company_id: string | null
          created_at: string | null
          funcao: string
          id: string
          nome: string
          telefone: string | null
          turno: string
        }
        Insert: {
          ativo?: boolean
          company_id?: string | null
          created_at?: string | null
          funcao?: string
          id?: string
          nome: string
          telefone?: string | null
          turno?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string | null
          created_at?: string | null
          funcao?: string
          id?: string
          nome?: string
          telefone?: string | null
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "aero_pav_gru_staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          company_id: string | null
          created_at: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          ip_address: string | null
          registro_id: string | null
          tabela: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          company_id?: string | null
          created_at?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          company_id?: string | null
          created_at?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
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
      ci_documentos: {
        Row: {
          arquivo_url: string | null
          created_at: string | null
          funcionario_matricula: string | null
          funcionario_nome: string
          ia_nome_detectado: string | null
          ia_observacao: string | null
          ia_resultado: Json | null
          ia_validade: string | null
          id: string
          integracao_id: string | null
          status: string | null
          tipo_documento: string
          updated_at: string | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string | null
          funcionario_matricula?: string | null
          funcionario_nome: string
          ia_nome_detectado?: string | null
          ia_observacao?: string | null
          ia_resultado?: Json | null
          ia_validade?: string | null
          id?: string
          integracao_id?: string | null
          status?: string | null
          tipo_documento: string
          updated_at?: string | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string | null
          funcionario_matricula?: string | null
          funcionario_nome?: string
          ia_nome_detectado?: string | null
          ia_observacao?: string | null
          ia_resultado?: Json | null
          ia_validade?: string | null
          id?: string
          integracao_id?: string | null
          status?: string | null
          tipo_documento?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_documentos_integracao_id_fkey"
            columns: ["integracao_id"]
            isOneToOne: false
            referencedRelation: "ci_integracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_equipes: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          id: string
          nome: string
          responsavel: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          responsavel?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          responsavel?: string | null
        }
        Relationships: []
      }
      ci_integracoes: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_limite: string | null
          id: string
          nome: string
          obra: string | null
          plataforma: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_limite?: string | null
          id?: string
          nome: string
          obra?: string | null
          plataforma?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_limite?: string | null
          id?: string
          nome?: string
          obra?: string | null
          plataforma?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ci_programacoes: {
        Row: {
          cliente: string | null
          created_at: string | null
          created_by: string | null
          data: string
          equipe: string
          id: string
          local: string | null
          obs: string | null
          ogs: string | null
          periodo: string | null
          responsavel: string | null
          status_equipe: string | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string | null
          created_by?: string | null
          data: string
          equipe: string
          id?: string
          local?: string | null
          obs?: string | null
          ogs?: string | null
          periodo?: string | null
          responsavel?: string | null
          status_equipe?: string | null
        }
        Update: {
          cliente?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          equipe?: string
          id?: string
          local?: string | null
          obs?: string | null
          ogs?: string | null
          periodo?: string | null
          responsavel?: string | null
          status_equipe?: string | null
        }
        Relationships: []
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
      company_modules: {
        Row: {
          ativo: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          modulo: string
        }
        Insert: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          modulo: string
        }
        Update: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          modulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      demandas: {
        Row: {
          centro_custo_origem: string | null
          centro_de_custo: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_prevista: string | null
          descricao: string | null
          destinatario_setor: string | null
          destino: string | null
          destino_maps: string | null
          equipamento: string | null
          equipamentos_ids: string[] | null
          equipamentos_json: Json | null
          foto_url: string | null
          funcao_solicitada: string | null
          funcionario_id: string | null
          funcionario_nome: string | null
          funcionario_solicitado_id: string | null
          funcionario_solicitado_nome: string | null
          horario_transporte: string | null
          id: string
          itens_material: Json | null
          lembrete_1h_at: string | null
          lembrete_4h_at: string | null
          lembrete_8h_at: string | null
          observacoes: string | null
          origem: string | null
          origem_maps: string | null
          respondido_at: string | null
          respondido_por: string | null
          resposta: string | null
          setor_origem: string | null
          setor_reclamacao: string | null
          solicitante_departamento: string
          solicitante_nome: string
          status: string
          sub_tipo: string | null
          tipo: string | null
          titulo: string
          updated_at: string | null
          urgencia: string | null
          viewed_by: string[] | null
        }
        Insert: {
          centro_custo_origem?: string | null
          centro_de_custo: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          destinatario_setor?: string | null
          destino?: string | null
          destino_maps?: string | null
          equipamento?: string | null
          equipamentos_ids?: string[] | null
          equipamentos_json?: Json | null
          foto_url?: string | null
          funcao_solicitada?: string | null
          funcionario_id?: string | null
          funcionario_nome?: string | null
          funcionario_solicitado_id?: string | null
          funcionario_solicitado_nome?: string | null
          horario_transporte?: string | null
          id?: string
          itens_material?: Json | null
          lembrete_1h_at?: string | null
          lembrete_4h_at?: string | null
          lembrete_8h_at?: string | null
          observacoes?: string | null
          origem?: string | null
          origem_maps?: string | null
          respondido_at?: string | null
          respondido_por?: string | null
          resposta?: string | null
          setor_origem?: string | null
          setor_reclamacao?: string | null
          solicitante_departamento: string
          solicitante_nome: string
          status?: string
          sub_tipo?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          urgencia?: string | null
          viewed_by?: string[] | null
        }
        Update: {
          centro_custo_origem?: string | null
          centro_de_custo?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          destinatario_setor?: string | null
          destino?: string | null
          destino_maps?: string | null
          equipamento?: string | null
          equipamentos_ids?: string[] | null
          equipamentos_json?: Json | null
          foto_url?: string | null
          funcao_solicitada?: string | null
          funcionario_id?: string | null
          funcionario_nome?: string | null
          funcionario_solicitado_id?: string | null
          funcionario_solicitado_nome?: string | null
          horario_transporte?: string | null
          id?: string
          itens_material?: Json | null
          lembrete_1h_at?: string | null
          lembrete_4h_at?: string | null
          lembrete_8h_at?: string | null
          observacoes?: string | null
          origem?: string | null
          origem_maps?: string | null
          respondido_at?: string | null
          respondido_por?: string | null
          resposta?: string | null
          setor_origem?: string | null
          setor_reclamacao?: string | null
          solicitante_departamento?: string
          solicitante_nome?: string
          status?: string
          sub_tipo?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          urgencia?: string | null
          viewed_by?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_unlock_requests: {
        Row: {
          company_id: string | null
          created_at: string | null
          data_liberada: string
          id: string
          liberado_por: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          data_liberada: string
          id?: string
          liberado_por?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          data_liberada?: string
          id?: string
          liberado_por?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      edge_rate_limit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_historico: {
        Row: {
          company_id: string | null
          created_at: string | null
          criado_por: string | null
          data: string
          descricao: string
          employee_id: string
          id: string
          tipo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string
          descricao: string
          employee_id: string
          id?: string
          tipo: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string
          descricao?: string
          employee_id?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_historico_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          centro_custo: string | null
          company_id: string | null
          cpf: string | null
          data_admissao: string | null
          data_nascimento: string | null
          email: string | null
          equipe: string | null
          foto_url: string | null
          id: string
          matricula: string | null
          name: string
          obs_geral: string | null
          obs_ponto: string | null
          responsavel: string | null
          rg: string | null
          role: string | null
          salario: number | null
          status: string | null
          telefone: string | null
        }
        Insert: {
          centro_custo?: string | null
          company_id?: string | null
          cpf?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          email?: string | null
          equipe?: string | null
          foto_url?: string | null
          id?: string
          matricula?: string | null
          name: string
          obs_geral?: string | null
          obs_ponto?: string | null
          responsavel?: string | null
          rg?: string | null
          role?: string | null
          salario?: number | null
          status?: string | null
          telefone?: string | null
        }
        Update: {
          centro_custo?: string | null
          company_id?: string | null
          cpf?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          email?: string | null
          equipe?: string | null
          foto_url?: string | null
          id?: string
          matricula?: string | null
          name?: string
          obs_geral?: string | null
          obs_ponto?: string | null
          responsavel?: string | null
          rg?: string | null
          role?: string | null
          salario?: number | null
          status?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      empreiteiros: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          vinculo_rdo: string
          vinculos: string[] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "empreiteiros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          created_by: string | null
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
          operator_id: string | null
          operator_name: string | null
          operator_solo: string | null
          operator_solo_id: string | null
          period: string | null
          status: string | null
          user_id: string | null
          work_status: string | null
        }
        Insert: {
          attachment_type?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
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
          operator_id?: string | null
          operator_name?: string | null
          operator_solo?: string | null
          operator_solo_id?: string | null
          period?: string | null
          status?: string | null
          user_id?: string | null
          work_status?: string | null
        }
        Update: {
          attachment_type?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
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
          operator_id?: string | null
          operator_name?: string | null
          operator_solo?: string | null
          operator_solo_id?: string | null
          period?: string | null
          status?: string | null
          user_id?: string | null
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
          {
            foreignKeyName: "equipment_diaries_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_diaries_operator_solo_id_fkey"
            columns: ["operator_solo_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
      equipment_type_operators: {
        Row: {
          company_id: string
          created_at: string | null
          equipment_type: string
          funcionario_id: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          equipment_type: string
          funcionario_id: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          equipment_type?: string
          funcionario_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_type_operators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_type_operators_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
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
      face_registrations: {
        Row: {
          created_at: string | null
          descriptor: Json
          id: string
          photo_url: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string | null
          descriptor?: Json
          id?: string
          photo_url?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string | null
          descriptor?: Json
          id?: string
          photo_url?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_registrations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "aero_pav_gru_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          categorias: string[] | null
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          tipo_insumo: string
          tipo_insumos: string[] | null
          vinculo_rdo: string
          vinculos: string[] | null
        }
        Insert: {
          categorias?: string[] | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          tipo_insumo?: string
          tipo_insumos?: string[] | null
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Update: {
          categorias?: string[] | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo_insumo?: string
          tipo_insumos?: string[] | null
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      frotas_gestao: {
        Row: {
          ano: string | null
          categoria: string | null
          codigo_custo: string | null
          company_id: string | null
          condutor_atual: string | null
          created_at: string | null
          frota_operacional: string | null
          id: string
          locadora: string | null
          modelo: string | null
          motivo_manutencao: string | null
          observacoes: string | null
          placa: string | null
          previsao_liberacao: string | null
          setor: string | null
          status: string | null
          tipo_veiculo: string | null
          updated_at: string | null
          valor_mensal: number | null
        }
        Insert: {
          ano?: string | null
          categoria?: string | null
          codigo_custo?: string | null
          company_id?: string | null
          condutor_atual?: string | null
          created_at?: string | null
          frota_operacional?: string | null
          id?: string
          locadora?: string | null
          modelo?: string | null
          motivo_manutencao?: string | null
          observacoes?: string | null
          placa?: string | null
          previsao_liberacao?: string | null
          setor?: string | null
          status?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
          valor_mensal?: number | null
        }
        Update: {
          ano?: string | null
          categoria?: string | null
          codigo_custo?: string | null
          company_id?: string | null
          condutor_atual?: string | null
          created_at?: string | null
          frota_operacional?: string | null
          id?: string
          locadora?: string | null
          modelo?: string | null
          motivo_manutencao?: string | null
          observacoes?: string | null
          placa?: string | null
          previsao_liberacao?: string | null
          setor?: string | null
          status?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
          valor_mensal?: number | null
        }
        Relationships: []
      }
      frotas_historico_condutor: {
        Row: {
          condutor_anterior: string | null
          condutor_novo: string | null
          created_at: string | null
          data_troca: string
          frota_id: string | null
          id: string
          motivo: string | null
          registrado_por: string | null
        }
        Insert: {
          condutor_anterior?: string | null
          condutor_novo?: string | null
          created_at?: string | null
          data_troca?: string
          frota_id?: string | null
          id?: string
          motivo?: string | null
          registrado_por?: string | null
        }
        Update: {
          condutor_anterior?: string | null
          condutor_novo?: string | null
          created_at?: string | null
          data_troca?: string
          frota_id?: string | null
          id?: string
          motivo?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frotas_historico_condutor_frota_id_fkey"
            columns: ["frota_id"]
            isOneToOne: false
            referencedRelation: "frotas_gestao"
            referencedColumns: ["id"]
          },
        ]
      }
      frotas_terceiros: {
        Row: {
          ativo: boolean
          created_at: string | null
          empresa_nome: string
          id: string
          placa: string
          tipo_veiculo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          empresa_nome: string
          id?: string
          placa: string
          tipo_veiculo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          empresa_nome?: string
          id?: string
          placa?: string
          tipo_veiculo?: string
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          company_id: string | null
          created_at: string | null
          funcao: string
          id: string
          matricula: string
          nome: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          funcao: string
          id?: string
          matricula: string
          nome: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          funcao?: string
          id?: string
          matricula?: string
          nome?: string
        }
        Relationships: []
      }
      insumos_materiais: {
        Row: {
          ativo: boolean
          created_at: string | null
          id: string
          nome: string
          unidade_medida: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          nome: string
          unidade_medida?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          nome?: string
          unidade_medida?: string
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
        Relationships: [
          {
            foreignKeyName: "kma_calibration_entries_equipment_diary_id_fkey"
            columns: ["equipment_diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kma_calibration_entries_equipment_diary_id_fkey"
            columns: ["equipment_diary_id"]
            isOneToOne: false
            referencedRelation: "view_rendimento_fresadora"
            referencedColumns: ["diary_id"]
          },
        ]
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
      lixeira: {
        Row: {
          company_id: string | null
          created_at: string | null
          dados: Json
          excluido_por: string | null
          excluido_por_nome: string | null
          expira_em: string | null
          id: string
          registro_id: string
          tabela: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          dados: Json
          excluido_por?: string | null
          excluido_por_nome?: string | null
          expira_em?: string | null
          id?: string
          registro_id: string
          tabela: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          dados?: Json
          excluido_por?: string | null
          excluido_por_nome?: string | null
          expira_em?: string | null
          id?: string
          registro_id?: string
          tabela?: string
        }
        Relationships: []
      }
      manutencao_consumo: {
        Row: {
          company_id: string | null
          created_at: string | null
          data: string
          diary_id: string | null
          equipment_fleet: string
          equipment_type: string | null
          fornecedor: string | null
          horímetro_final: number | null
          horímetro_inicial: number | null
          id: string
          km_final: number | null
          km_inicial: number | null
          litros: number
          origem: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          data: string
          diary_id?: string | null
          equipment_fleet: string
          equipment_type?: string | null
          fornecedor?: string | null
          horímetro_final?: number | null
          horímetro_inicial?: number | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          litros: number
          origem?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          data?: string
          diary_id?: string | null
          equipment_fleet?: string
          equipment_type?: string | null
          fornecedor?: string | null
          horímetro_final?: number | null
          horímetro_inicial?: number | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          litros?: number
          origem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencao_consumo_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao_documentos: {
        Row: {
          alerta_dias: number | null
          arquivo_url: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_emissao: string | null
          data_vencimento: string | null
          descricao: string | null
          equipment_fleet: string
          equipment_type: string | null
          id: string
          numero_documento: string | null
          tipo_documento: string
        }
        Insert: {
          alerta_dias?: number | null
          arquivo_url?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          equipment_fleet: string
          equipment_type?: string | null
          id?: string
          numero_documento?: string | null
          tipo_documento: string
        }
        Update: {
          alerta_dias?: number | null
          arquivo_url?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          equipment_fleet?: string
          equipment_type?: string | null
          id?: string
          numero_documento?: string | null
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencao_documentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao_os: {
        Row: {
          checklist_item: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_abertura: string
          data_conclusao: string | null
          data_prevista: string | null
          descricao: string | null
          equipment_fleet: string
          equipment_type: string | null
          horímetro_abertura: number | null
          horímetro_conclusao: number | null
          id: string
          mecanico_nome: string | null
          mecanico_tipo: string | null
          numero_os: number
          observacoes: string | null
          origem: string | null
          prioridade: string | null
          servico_realizado: string | null
          solicitante_nome: string | null
          status: string | null
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          checklist_item?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_abertura?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          equipment_fleet: string
          equipment_type?: string | null
          horímetro_abertura?: number | null
          horímetro_conclusao?: number | null
          id?: string
          mecanico_nome?: string | null
          mecanico_tipo?: string | null
          numero_os?: number
          observacoes?: string | null
          origem?: string | null
          prioridade?: string | null
          servico_realizado?: string | null
          solicitante_nome?: string | null
          status?: string | null
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          checklist_item?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_abertura?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          equipment_fleet?: string
          equipment_type?: string | null
          horímetro_abertura?: number | null
          horímetro_conclusao?: number | null
          id?: string
          mecanico_nome?: string | null
          mecanico_tipo?: string | null
          numero_os?: number
          observacoes?: string | null
          origem?: string | null
          prioridade?: string | null
          servico_realizado?: string | null
          solicitante_nome?: string | null
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      manutencao_pecas: {
        Row: {
          categoria: string | null
          company_id: string | null
          created_at: string | null
          equipment_fleet: string | null
          horímetro_troca: number | null
          id: string
          nome_peca: string
          observacao: string | null
          os_id: string | null
          quantidade: number
          unidade: string | null
        }
        Insert: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          equipment_fleet?: string | null
          horímetro_troca?: number | null
          id?: string
          nome_peca: string
          observacao?: string | null
          os_id?: string | null
          quantidade: number
          unidade?: string | null
        }
        Update: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          equipment_fleet?: string | null
          horímetro_troca?: number | null
          id?: string
          nome_peca?: string
          observacao?: string | null
          os_id?: string | null
          quantidade?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencao_pecas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_pecas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "manutencao_os"
            referencedColumns: ["id"]
          },
        ]
      }
      maquinas_frota: {
        Row: {
          categoria: string | null
          company_id: string | null
          created_at: string | null
          empresa: string | null
          frota: string
          id: string
          nome: string
          status: string
          tipo: string | null
          vinculo_rdo: string
          vinculos: string[] | null
        }
        Insert: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          empresa?: string | null
          frota: string
          id?: string
          nome: string
          status?: string
          tipo?: string | null
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Update: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          empresa?: string | null
          frota?: string
          id?: string
          nome?: string
          status?: string
          tipo?: string | null
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "maquinas_frota_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          tipo_uso: string
          vinculo_rdo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          tipo_uso?: string
          vinculo_rdo?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo_uso?: string
          vinculo_rdo?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          notify_demanda: boolean | null
          notify_diario_carreta: boolean | null
          notify_diario_equipamento: boolean | null
          notify_rdo: boolean | null
          notify_todos_carretas: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          notify_demanda?: boolean | null
          notify_diario_carreta?: boolean | null
          notify_diario_equipamento?: boolean | null
          notify_rdo?: boolean | null
          notify_todos_carretas?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          notify_demanda?: boolean | null
          notify_diario_carreta?: boolean | null
          notify_diario_equipamento?: boolean | null
          notify_rdo?: boolean | null
          notify_todos_carretas?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_targets: {
        Row: {
          company_id: string
          created_at: string | null
          event_type: string
          id: string
          source_user_id: string
          target_user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          event_type: string
          id?: string
          source_user_id: string
          target_user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          source_user_id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      ogs_reference: {
        Row: {
          client_name: string | null
          company_id: string | null
          id: string
          jornada_horas: number | null
          lat: number | null
          lng: number | null
          location_address: string | null
          ogs_number: string | null
        }
        Insert: {
          client_name?: string | null
          company_id?: string | null
          id?: string
          jornada_horas?: number | null
          lat?: number | null
          lng?: number | null
          location_address?: string | null
          ogs_number?: string | null
        }
        Update: {
          client_name?: string | null
          company_id?: string | null
          id?: string
          jornada_horas?: number | null
          lat?: number | null
          lng?: number | null
          location_address?: string | null
          ogs_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ogs_reference_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_registros: {
        Row: {
          company_id: string | null
          created_at: string | null
          data: string
          distancia_m: number | null
          fora_raio: boolean | null
          hora: string
          id: string
          lat: number | null
          lng: number | null
          metodo: string
          ogs_id: string | null
          ogs_number: string | null
          photo_url: string | null
          staff_id: string
          tipo: string
          turno: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          data?: string
          distancia_m?: number | null
          fora_raio?: boolean | null
          hora?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metodo?: string
          ogs_id?: string | null
          ogs_number?: string | null
          photo_url?: string | null
          staff_id: string
          tipo?: string
          turno?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          data?: string
          distancia_m?: number | null
          fora_raio?: boolean | null
          hora?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metodo?: string
          ogs_id?: string | null
          ogs_number?: string | null
          photo_url?: string | null
          staff_id?: string
          tipo?: string
          turno?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_registros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
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
          can_create_users: boolean | null
          can_delete: boolean | null
          company_id: string | null
          created_at: string | null
          email: string
          id: string
          nome_completo: string
          perfil: string
          role: string | null
          senha_temporaria: boolean | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_create_users?: boolean | null
          can_delete?: boolean | null
          company_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          nome_completo: string
          perfil: string
          role?: string | null
          senha_temporaria?: boolean | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_create_users?: boolean | null
          can_delete?: boolean | null
          company_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome_completo?: string
          perfil?: string
          role?: string | null
          senha_temporaria?: boolean | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          company_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          company_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          company_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
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
          company_id: string | null
          created_at: string | null
          data: string | null
          encarregado: string | null
          id: string
          obra_nome: string
          preenchido_por: string | null
          responsavel: string | null
          tipo_rdo: string | null
          turno: string | null
          user_id: string | null
        }
        Insert: {
          clima?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: string | null
          encarregado?: string | null
          id?: string
          obra_nome: string
          preenchido_por?: string | null
          responsavel?: string | null
          tipo_rdo?: string | null
          turno?: string | null
          user_id?: string | null
        }
        Update: {
          clima?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: string | null
          encarregado?: string | null
          id?: string
          obra_nome?: string
          preenchido_por?: string | null
          responsavel?: string | null
          tipo_rdo?: string | null
          turno?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rdo_efetivo: {
        Row: {
          company_id: string | null
          entrada: string | null
          funcao: string | null
          id: string
          matricula: string | null
          nome: string | null
          quantidade: number | null
          rdo_id: string | null
          saida: string | null
        }
        Insert: {
          company_id?: string | null
          entrada?: string | null
          funcao?: string | null
          id?: string
          matricula?: string | null
          nome?: string | null
          quantidade?: number | null
          rdo_id?: string | null
          saida?: string | null
        }
        Update: {
          company_id?: string | null
          entrada?: string | null
          funcao?: string | null
          id?: string
          matricula?: string | null
          nome?: string | null
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
      rdo_equipamentos: {
        Row: {
          categoria: string | null
          company_id: string | null
          created_at: string | null
          empresa_dona: string | null
          frota: string | null
          id: string
          nome: string | null
          patrimonio: string | null
          rdo_id: string | null
          sub_tipo: string | null
          tipo: string | null
        }
        Insert: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          empresa_dona?: string | null
          frota?: string | null
          id?: string
          nome?: string | null
          patrimonio?: string | null
          rdo_id?: string | null
          sub_tipo?: string | null
          tipo?: string | null
        }
        Update: {
          categoria?: string | null
          company_id?: string | null
          created_at?: string | null
          empresa_dona?: string | null
          frota?: string | null
          id?: string
          nome?: string | null
          patrimonio?: string | null
          rdo_id?: string | null
          sub_tipo?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipamentos_rdo_id_fkey"
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
      rdo_nf_massa: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          nf: string | null
          placa: string | null
          rdo_id: string | null
          tipo_material: string | null
          tonelagem: number | null
          usina: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nf?: string | null
          placa?: string | null
          rdo_id?: string | null
          tipo_material?: string | null
          tonelagem?: number | null
          usina?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nf?: string | null
          placa?: string | null
          rdo_id?: string | null
          tipo_material?: string | null
          tonelagem?: number | null
          usina?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_nf_massa_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_producao: {
        Row: {
          area_m2: number | null
          company_id: string | null
          comprimento_m: number | null
          densidade: number | null
          espessura_cm: number | null
          estaca_final: string | null
          estaca_inicial: string | null
          faixa: string | null
          id: string
          km_final: number | null
          km_inicial: number | null
          largura_m: number | null
          observacoes: string | null
          rdo_id: string | null
          rodovia: string | null
          sentido: string | null
          sentido_faixa: string | null
          tipo_servico: string | null
          tonelagem: number | null
          volume_m3: number | null
        }
        Insert: {
          area_m2?: number | null
          company_id?: string | null
          comprimento_m?: number | null
          densidade?: number | null
          espessura_cm?: number | null
          estaca_final?: string | null
          estaca_inicial?: string | null
          faixa?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          largura_m?: number | null
          observacoes?: string | null
          rdo_id?: string | null
          rodovia?: string | null
          sentido?: string | null
          sentido_faixa?: string | null
          tipo_servico?: string | null
          tonelagem?: number | null
          volume_m3?: number | null
        }
        Update: {
          area_m2?: number | null
          company_id?: string | null
          comprimento_m?: number | null
          densidade?: number | null
          espessura_cm?: number | null
          estaca_final?: string | null
          estaca_inicial?: string | null
          faixa?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          largura_m?: number | null
          observacoes?: string | null
          rdo_id?: string | null
          rodovia?: string | null
          sentido?: string | null
          sentido_faixa?: string | null
          tipo_servico?: string | null
          tonelagem?: number | null
          volume_m3?: number | null
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
      suprimentos_frete_config: {
        Row: {
          company_id: string | null
          created_at: string | null
          hora_ajudante: number
          hora_motorista: number
          id: string
          updated_at: string | null
          veiculo_leve_km: number
          veiculo_pesado_km: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          hora_ajudante?: number
          hora_motorista?: number
          id?: string
          updated_at?: string | null
          veiculo_leve_km?: number
          veiculo_pesado_km?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          hora_ajudante?: number
          hora_motorista?: number
          id?: string
          updated_at?: string | null
          veiculo_leve_km?: number
          veiculo_pesado_km?: number
        }
        Relationships: [
          {
            foreignKeyName: "suprimentos_frete_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suprimentos_frete_historico: {
        Row: {
          company_id: string | null
          created_at: string | null
          custo_interno_calculado: number
          decisao_tomada: string
          distancia_km: number
          id: string
          material_desc: string
          ogs: string
          tempo_horas: number
          usa_ajudante: boolean
          user_id: string | null
          user_nome: string | null
          valor_frete_terceiro: number
          veiculo_tipo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          custo_interno_calculado: number
          decisao_tomada: string
          distancia_km: number
          id?: string
          material_desc: string
          ogs: string
          tempo_horas: number
          usa_ajudante?: boolean
          user_id?: string | null
          user_nome?: string | null
          valor_frete_terceiro: number
          veiculo_tipo: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          custo_interno_calculado?: number
          decisao_tomada?: string
          distancia_km?: number
          id?: string
          material_desc?: string
          ogs?: string
          tempo_horas?: number
          usa_ajudante?: boolean
          user_id?: string | null
          user_nome?: string | null
          valor_frete_terceiro?: number
          veiculo_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "suprimentos_frete_historico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          vinculo_rdo: string
          vinculos: string[] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tipos_servico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      truck_registry: {
        Row: {
          capacidade_m3: number
          cor: string | null
          created_at: string | null
          fornecedor: string | null
          id: string
          modelo: string | null
          placa: string
          vinculos: string[] | null
        }
        Insert: {
          capacidade_m3?: number
          cor?: string | null
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          modelo?: string | null
          placa: string
          vinculos?: string[] | null
        }
        Update: {
          capacidade_m3?: number
          cor?: string | null
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          modelo?: string | null
          placa?: string
          vinculos?: string[] | null
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
      trucker_destinations: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      trucker_freight_calculations: {
        Row: {
          adicionais: number
          adicionais_descricao: string | null
          contrato: string | null
          created_at: string
          destination_address: string
          distance_km: number
          duration_minutes: number | null
          id: string
          notes: string | null
          ogs_id: string | null
          origin_address: string
          pedagio_estimado: number
          quantidade_eixos: number | null
          total_frete: number
          user_id: string | null
          valor_por_km: number
        }
        Insert: {
          adicionais?: number
          adicionais_descricao?: string | null
          contrato?: string | null
          created_at?: string
          destination_address: string
          distance_km?: number
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          ogs_id?: string | null
          origin_address: string
          pedagio_estimado?: number
          quantidade_eixos?: number | null
          total_frete?: number
          user_id?: string | null
          valor_por_km?: number
        }
        Update: {
          adicionais?: number
          adicionais_descricao?: string | null
          contrato?: string | null
          created_at?: string
          destination_address?: string
          distance_km?: number
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          ogs_id?: string | null
          origin_address?: string
          pedagio_estimado?: number
          quantidade_eixos?: number | null
          total_frete?: number
          user_id?: string | null
          valor_por_km?: number
        }
        Relationships: [
          {
            foreignKeyName: "trucker_freight_calculations_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
        ]
      }
      trucker_trips: {
        Row: {
          arrival_geo: string | null
          arrival_time: string | null
          created_at: string | null
          date: string | null
          departure_geo: string | null
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
          arrival_geo?: string | null
          arrival_time?: string | null
          created_at?: string | null
          date?: string | null
          departure_geo?: string | null
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
          arrival_geo?: string | null
          arrival_time?: string | null
          created_at?: string | null
          date?: string | null
          departure_geo?: string | null
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
      user_permissions: {
        Row: {
          company_id: string | null
          created_at: string | null
          equipamentos_permitidos: string[] | null
          id: string
          is_admin: boolean | null
          modulo_abastecimento: boolean | null
          modulo_carreteiros: boolean | null
          modulo_dashboard: boolean | null
          modulo_demandas: boolean | null
          modulo_documentos: boolean | null
          modulo_equipamentos: boolean | null
          modulo_manutencao: boolean | null
          modulo_obras: boolean | null
          modulo_programador: boolean | null
          modulo_relatorios: boolean | null
          modulo_rh: boolean | null
          rdos_permitidos: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          equipamentos_permitidos?: string[] | null
          id?: string
          is_admin?: boolean | null
          modulo_abastecimento?: boolean | null
          modulo_carreteiros?: boolean | null
          modulo_dashboard?: boolean | null
          modulo_demandas?: boolean | null
          modulo_documentos?: boolean | null
          modulo_equipamentos?: boolean | null
          modulo_manutencao?: boolean | null
          modulo_obras?: boolean | null
          modulo_programador?: boolean | null
          modulo_relatorios?: boolean | null
          modulo_rh?: boolean | null
          rdos_permitidos?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          equipamentos_permitidos?: string[] | null
          id?: string
          is_admin?: boolean | null
          modulo_abastecimento?: boolean | null
          modulo_carreteiros?: boolean | null
          modulo_dashboard?: boolean | null
          modulo_demandas?: boolean | null
          modulo_documentos?: boolean | null
          modulo_equipamentos?: boolean | null
          modulo_manutencao?: boolean | null
          modulo_obras?: boolean | null
          modulo_programador?: boolean | null
          modulo_relatorios?: boolean | null
          modulo_rh?: boolean | null
          rdos_permitidos?: string[] | null
          updated_at?: string | null
          user_id?: string | null
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
      vt_funcionario_conducoes: {
        Row: {
          company_id: string | null
          created_at: string | null
          funcionario_id: string
          id: string
          quantidade: number
          tarifa_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          funcionario_id: string
          id?: string
          quantidade?: number
          tarifa_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          funcionario_id?: string
          id?: string
          quantidade?: number
          tarifa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vt_funcionario_conducoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vt_funcionario_conducoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "aero_pav_gru_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vt_funcionario_conducoes_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "vt_tarifas"
            referencedColumns: ["id"]
          },
        ]
      }
      vt_tarifas: {
        Row: {
          ativo: boolean
          company_id: string | null
          created_at: string | null
          id: string
          tipo_transporte: string
          valor_unitario: number
        }
        Insert: {
          ativo?: boolean
          company_id?: string | null
          created_at?: string | null
          id?: string
          tipo_transporte: string
          valor_unitario?: number
        }
        Update: {
          ativo?: boolean
          company_id?: string | null
          created_at?: string | null
          id?: string
          tipo_transporte?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "vt_tarifas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      admin_roles: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_system_role: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_sector_scoped: boolean | null
          metadata: Json | null
          resource: string
          role_id: string
          sector_filter: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_sector_scoped?: boolean | null
          metadata?: Json | null
          resource: string
          role_id: string
          sector_filter?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_sector_scoped?: boolean | null
          metadata?: Json | null
          resource?: string
          role_id?: string
          sector_filter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_admin_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          company_id: string | null
          employee_id: string
          id: string
          is_active: boolean | null
          revoked_at: string | null
          role_id: string
          scope_obra: string | null
          scope_sector: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          revoked_at?: string | null
          role_id: string
          scope_obra?: string | null
          scope_sector?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          revoked_at?: string | null
          role_id?: string
          scope_obra?: string | null
          scope_sector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_admin_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          changes_after: Json | null
          changes_before: Json | null
          company_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          resource: string
          resource_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          changes_after?: Json | null
          changes_before?: Json | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource: string
          resource_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          changes_after?: Json | null
          changes_before?: Json | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource?: string
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_company_id: { Args: never; Returns: string }
      has_module: { Args: { module_name: string }; Returns: boolean }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      has_admin_permission: { Args: { p_action: string; p_company_id?: string; p_resource: string; p_user_id: string }; Returns: boolean }
      has_sector_access: { Args: { p_action: string; p_company_id?: string; p_resource: string; p_sector: string; p_user_id: string }; Returns: boolean }
      log_admin_action: { Args: { p_action: string; p_admin_id: string; p_changes_after?: Json; p_changes_before?: Json; p_resource: string; p_resource_id: string }; Returns: string }
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
