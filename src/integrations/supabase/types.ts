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
      abastecimento_config: {
        Row: {
          company_id: string
          created_at: string | null
          fornecedores_diesel: string[] | null
          id: string
          lubrificadores: string[] | null
          motoristas: string[] | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          fornecedores_diesel?: string[] | null
          id?: string
          lubrificadores?: string[] | null
          motoristas?: string[] | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          fornecedores_diesel?: string[] | null
          id?: string
          lubrificadores?: string[] | null
          motoristas?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      abastecimento_historico: {
        Row: {
          acao: string
          alterado_por: string | null
          campo_alterado: string | null
          data_alteracao: string | null
          id: string
          registro_id: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          alterado_por?: string | null
          campo_alterado?: string | null
          data_alteracao?: string | null
          id?: string
          registro_id: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          alterado_por?: string | null
          campo_alterado?: string | null
          data_alteracao?: string | null
          id?: string
          registro_id?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "abastecimento_historico_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "abastecimento_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      abastecimento_registros: {
        Row: {
          abastecido_por: string
          company_id: string
          consumo_litro_km: number | null
          created_at: string | null
          data_abastecimento: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          local_abastecimento: string | null
          maquina_id: string
          maquina_placa: string | null
          nf_data: string | null
          nf_numero: string | null
          observacoes: string | null
          odometro_anterior: number | null
          odometro_atual: number | null
          quantidade: number
          status: string | null
          tipo_id: string
          tipo_nome: string | null
          unidade: string | null
          updated_at: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          abastecido_por: string
          company_id: string
          consumo_litro_km?: number | null
          created_at?: string | null
          data_abastecimento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          local_abastecimento?: string | null
          maquina_id: string
          maquina_placa?: string | null
          nf_data?: string | null
          nf_numero?: string | null
          observacoes?: string | null
          odometro_anterior?: number | null
          odometro_atual?: number | null
          quantidade: number
          status?: string | null
          tipo_id: string
          tipo_nome?: string | null
          unidade?: string | null
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          abastecido_por?: string
          company_id?: string
          consumo_litro_km?: number | null
          created_at?: string | null
          data_abastecimento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          local_abastecimento?: string | null
          maquina_id?: string
          maquina_placa?: string | null
          nf_data?: string | null
          nf_numero?: string | null
          observacoes?: string | null
          odometro_anterior?: number | null
          odometro_atual?: number | null
          quantidade?: number
          status?: string | null
          tipo_id?: string
          tipo_nome?: string | null
          unidade?: string | null
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "abastecimento_registros_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimento_registros_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas_frota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimento_registros_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "abastecimento_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      abastecimento_tipos: {
        Row: {
          ativo: boolean | null
          company_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          unidade: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean | null
          company_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          unidade: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean | null
          company_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          unidade?: string
          valor_padrao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "abastecimento_tipos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
          lubrificador: string | null
          motorista_comboio: string | null
          observacao: string | null
          ogs: string | null
          saldo_inicial: number | null
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
          lubrificador?: string | null
          motorista_comboio?: string | null
          observacao?: string | null
          ogs?: string | null
          saldo_inicial?: number | null
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
          lubrificador?: string | null
          motorista_comboio?: string | null
          observacao?: string | null
          ogs?: string | null
          saldo_inicial?: number | null
        }
        Relationships: []
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
        ]
      }
      admin_configs: {
        Row: {
          company_id: string
          cor_primaria: string | null
          created_at: string | null
          dashboard_enabled: boolean | null
          id: string
          log_acoes_admin: boolean | null
          logo_url: string | null
          max_storage_gb: number | null
          max_users: number | null
          modulos_admin: string[] | null
          requer_2fa: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          cor_primaria?: string | null
          created_at?: string | null
          dashboard_enabled?: boolean | null
          id?: string
          log_acoes_admin?: boolean | null
          logo_url?: string | null
          max_storage_gb?: number | null
          max_users?: number | null
          modulos_admin?: string[] | null
          requer_2fa?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          cor_primaria?: string | null
          created_at?: string | null
          dashboard_enabled?: boolean | null
          id?: string
          log_acoes_admin?: boolean | null
          logo_url?: string | null
          max_storage_gb?: number | null
          max_users?: number | null
          modulos_admin?: string[] | null
          requer_2fa?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
        Relationships: []
      }
      admin_sessions: {
        Row: {
          company_id: string
          id: string
          ip_address: string | null
          last_activity: string | null
          login_at: string | null
          logout_at: string | null
          session_token: string
          status: string | null
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          company_id: string
          id?: string
          ip_address?: string | null
          last_activity?: string | null
          login_at?: string | null
          logout_at?: string | null
          session_token: string
          status?: string | null
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          company_id?: string
          id?: string
          ip_address?: string | null
          last_activity?: string | null
          login_at?: string | null
          logout_at?: string | null
          session_token?: string
          status?: string | null
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          company_id: string | null
          created_at: string | null
          diary_id: string
          horimeter: string | null
          id: string
          quantity: number
          status: string
        }
        Insert: {
          brand: string
          company_id?: string | null
          created_at?: string | null
          diary_id: string
          horimeter?: string | null
          id?: string
          quantity?: number
          status?: string
        }
        Update: {
          brand?: string
          company_id?: string | null
          created_at?: string | null
          diary_id?: string
          horimeter?: string | null
          id?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bit_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_entries: {
        Row: {
          company_id: string | null
          damage_tag: string | null
          diary_id: string
          id: string
          item_id: string
          observation: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["checklist_status"]
        }
        Insert: {
          company_id?: string | null
          damage_tag?: string | null
          diary_id: string
          id?: string
          item_id: string
          observation?: string | null
          photo_url?: string | null
          status: Database["public"]["Enums"]["checklist_status"]
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "checklist_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      ci_centros_custo: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
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
          exibir_rdo_tecnico: boolean
          centro_custo: string | null
          created_at: string | null
          id: string
          nome: string
          responsavel: string | null
          responsavel_employee_id: string | null
        }
        Insert: {
          ativa?: boolean | null
          exibir_rdo_tecnico?: boolean
          centro_custo?: string | null
          created_at?: string | null
          id?: string
          nome: string
          responsavel?: string | null
          responsavel_employee_id?: string | null
        }
        Update: {
          ativa?: boolean | null
          exibir_rdo_tecnico?: boolean
          centro_custo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          responsavel?: string | null
          responsavel_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_equipes_responsavel_employee_id_fkey"
            columns: ["responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      ci_mov_equipamentos: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          data: string
          equipamento_id: string | null
          equipe_destino: string | null
          equipe_origem: string | null
          frota: string
          id: string
          obs: string | null
          responsavel_destino: string | null
          status: string | null
          tipo: string
          tipo_equipamento: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          equipamento_id?: string | null
          equipe_destino?: string | null
          equipe_origem?: string | null
          frota: string
          id?: string
          obs?: string | null
          responsavel_destino?: string | null
          status?: string | null
          tipo: string
          tipo_equipamento?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          equipamento_id?: string | null
          equipe_destino?: string | null
          equipe_origem?: string | null
          frota?: string
          id?: string
          obs?: string | null
          responsavel_destino?: string | null
          status?: string | null
          tipo?: string
          tipo_equipamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_mov_equipamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_mov_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_mov_funcionarios: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          data: string
          data_admissao: string | null
          equipe_destino: string | null
          equipe_origem: string | null
          funcao: string | null
          funcionario_id: string | null
          funcionario_nome: string
          id: string
          matricula: string | null
          obs: string | null
          status: string | null
          tipo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          data_admissao?: string | null
          equipe_destino?: string | null
          equipe_origem?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          funcionario_nome: string
          id?: string
          matricula?: string | null
          obs?: string | null
          status?: string | null
          tipo: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          data_admissao?: string | null
          equipe_destino?: string | null
          equipe_origem?: string | null
          funcao?: string | null
          funcionario_id?: string | null
          funcionario_nome?: string
          id?: string
          matricula?: string | null
          obs?: string | null
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_mov_funcionarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_mov_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_programacoes: {
        Row: {
          carretas_designadas: string[] | null
          cliente: string | null
          company_id: string | null
          comunicado_id: string | null
          confirmado_em: string | null
          confirmado_manutencao: boolean
          confirmado_por: string | null
          created_at: string | null
          created_by: string | null
          data: string
          engenheiro_responsavel: string | null
          engenheiro_responsavel_employee_id: string | null
          equipamentos_designados: string[] | null
          equipe: string
          id: string
          local: string | null
          notificado_em: string | null
          motivo_cancelamento: string | null
          obs: string | null
          obs_manutencao: string | null
          ogs: string | null
          periodo: string | null
          responsavel: string | null
          responsavel_employee_id: string | null
          status_equipe: string | null
          status_programacao: string
          tipo_servico: string | null
        }
        Insert: {
          carretas_designadas?: string[] | null
          cliente?: string | null
          company_id?: string | null
          comunicado_id?: string | null
          confirmado_em?: string | null
          confirmado_manutencao?: boolean
          confirmado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          data: string
          engenheiro_responsavel?: string | null
          engenheiro_responsavel_employee_id?: string | null
          equipamentos_designados?: string[] | null
          equipe: string
          id?: string
          local?: string | null
          notificado_em?: string | null
          motivo_cancelamento?: string | null
          obs?: string | null
          obs_manutencao?: string | null
          ogs?: string | null
          periodo?: string | null
          responsavel?: string | null
          responsavel_employee_id?: string | null
          status_equipe?: string | null
          status_programacao?: string
          tipo_servico?: string | null
        }
        Update: {
          carretas_designadas?: string[] | null
          cliente?: string | null
          company_id?: string | null
          comunicado_id?: string | null
          confirmado_em?: string | null
          confirmado_manutencao?: boolean
          confirmado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          engenheiro_responsavel?: string | null
          engenheiro_responsavel_employee_id?: string | null
          equipamentos_designados?: string[] | null
          equipe?: string
          id?: string
          local?: string | null
          notificado_em?: string | null
          motivo_cancelamento?: string | null
          obs?: string | null
          obs_manutencao?: string | null
          ogs?: string | null
          periodo?: string | null
          responsavel?: string | null
          responsavel_employee_id?: string | null
          status_equipe?: string | null
          status_programacao?: string
          tipo_servico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_programacoes_engenheiro_responsavel_employee_id_fkey"
            columns: ["engenheiro_responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_programacoes_responsavel_employee_id_fkey"
            columns: ["responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      comboio_reposicoes: {
        Row: {
          comboio_fleet: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data: string
          fornecedor: string | null
          hora: string | null
          id: string
          litros: number
          lubrificador: string | null
          observacao: string | null
        }
        Insert: {
          comboio_fleet: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data: string
          fornecedor?: string | null
          hora?: string | null
          id?: string
          litros: number
          lubrificador?: string | null
          observacao?: string | null
        }
        Update: {
          comboio_fleet?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          fornecedor?: string | null
          hora?: string | null
          id?: string
          litros?: number
          lubrificador?: string | null
          observacao?: string | null
        }
        Relationships: []
      }
      comboio_saldo: {
        Row: {
          comboio_fleet: string
          company_id: string | null
          id: string
          saldo_atual: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          comboio_fleet: string
          company_id?: string | null
          id?: string
          saldo_atual?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          comboio_fleet?: string
          company_id?: string | null
          id?: string
          saldo_atual?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          login_domain: string | null
          logo_url: string | null
          name: string
          status: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          login_domain?: string | null
          logo_url?: string | null
          name: string
          status?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          login_domain?: string | null
          logo_url?: string | null
          name?: string
          status?: string | null
          trial_ends_at?: string | null
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
      employee_documentos: {
        Row: {
          arquivo_url: string | null
          company_id: string | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          employee_id: string
          id: string
          status: string | null
          tipo: string
          validade: string | null
        }
        Insert: {
          arquivo_url?: string | null
          company_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          employee_id: string
          id?: string
          status?: string | null
          tipo: string
          validade?: string | null
        }
        Update: {
          arquivo_url?: string | null
          company_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          employee_id?: string
          id?: string
          status?: string | null
          tipo?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documentos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      employee_name_aliases: {
        Row: {
          alias_norm: string
          alias_text: string
          company_id: string
          created_at: string
          created_by: string
          employee_id: string
        }
        Insert: {
          alias_norm: string
          alias_text: string
          company_id: string
          created_at?: string
          created_by?: string
          employee_id: string
        }
        Update: {
          alias_norm?: string
          alias_text?: string
          company_id?: string
          created_at?: string
          created_by?: string
          employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_name_aliases_employee_id_fkey"
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
          centro_custo_codigo: string | null
          centro_custo_descricao: string | null
          company_id: string | null
          cpf: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          email: string | null
          empresa_id: string | null
          empresa_nome: string | null
          empresa_parceira_id: string | null
          equipe: string | null
          foto_url: string | null
          funcao_id: string | null
          funcao_terceiro: string | null
          id: string
          is_encarregado: boolean | null
          is_engenheiro: boolean | null
          matricula: string | null
          name: string
          obs_geral: string | null
          obs_ponto: string | null
          origem: string
          responsavel: string | null
          responsavel_employee_id: string | null
          rg: string | null
          role: string | null
          salario: number | null
          status: string | null
          telefone: string | null
        }
        Insert: {
          centro_custo?: string | null
          centro_custo_codigo?: string | null
          centro_custo_descricao?: string | null
          company_id?: string | null
          cpf?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          empresa_parceira_id?: string | null
          equipe?: string | null
          foto_url?: string | null
          funcao_id?: string | null
          funcao_terceiro?: string | null
          id?: string
          is_encarregado?: boolean | null
          is_engenheiro?: boolean | null
          matricula?: string | null
          name: string
          obs_geral?: string | null
          obs_ponto?: string | null
          origem?: string
          responsavel?: string | null
          responsavel_employee_id?: string | null
          rg?: string | null
          role?: string | null
          salario?: number | null
          status?: string | null
          telefone?: string | null
        }
        Update: {
          centro_custo?: string | null
          centro_custo_codigo?: string | null
          centro_custo_descricao?: string | null
          company_id?: string | null
          cpf?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          empresa_parceira_id?: string | null
          equipe?: string | null
          foto_url?: string | null
          funcao_id?: string | null
          funcao_terceiro?: string | null
          id?: string
          is_encarregado?: boolean | null
          is_engenheiro?: boolean | null
          matricula?: string | null
          name?: string
          obs_geral?: string | null
          obs_ponto?: string | null
          origem?: string
          responsavel?: string | null
          responsavel_employee_id?: string | null
          rg?: string | null
          role?: string | null
          salario?: number | null
          status?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_empresa_parceira_id_fkey"
            columns: ["empresa_parceira_id"]
            isOneToOne: false
            referencedRelation: "empresas_parceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_responsavel_employee_id_fkey"
            columns: ["responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_parceiras: {
        Row: {
          ativo: boolean
          cnpj: string | null
          company_id: string
          contato: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          created_by: string | null
          endereco_completo: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          observacoes: string | null
          razao_social: string | null
          responsavel_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          company_id: string
          contato?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          endereco_completo?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          observacoes?: string | null
          razao_social?: string | null
          responsavel_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          company_id?: string
          contato?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          endereco_completo?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          observacoes?: string | null
          razao_social?: string | null
          responsavel_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_parceiras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      encarregado_ogs: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          encarregado_id: string | null
          id: string
          ogs_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          encarregado_id?: string | null
          id?: string
          ogs_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          encarregado_id?: string | null
          id?: string
          ogs_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encarregado_ogs_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
        ]
      }
      engenheiro_ogs: {
        Row: {
          ativo: boolean | null
          company_id: string
          created_at: string | null
          engenheiro_id: string
          id: string
          ogs_id: string
        }
        Insert: {
          ativo?: boolean | null
          company_id: string
          created_at?: string | null
          engenheiro_id: string
          id?: string
          ogs_id: string
        }
        Update: {
          ativo?: boolean | null
          company_id?: string
          created_at?: string | null
          engenheiro_id?: string
          id?: string
          ogs_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engenheiro_ogs_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamento_tipos: {
        Row: {
          ativo: boolean | null
          categoria: string
          company_id: string
          created_at: string | null
          icone: string | null
          id: string
          label: string
          subtipo: string
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          company_id: string
          created_at?: string | null
          icone?: string | null
          id?: string
          label: string
          subtipo: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          company_id?: string
          created_at?: string | null
          icone?: string | null
          id?: string
          label?: string
          subtipo?: string
        }
        Relationships: []
      }
      equipamento_transportes: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          data: string
          destino_descricao: string | null
          destino_ogs: string
          diary_id: string | null
          equipment_fleet: string
          equipment_id: string | null
          equipment_type: string | null
          id: string
          meter_no_transporte: number | null
          observacoes: string | null
          odometer_no_transporte: number | null
          origem_descricao: string | null
          origem_ogs: string
          tipo_transportador: string
          transportador_nome: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          data: string
          destino_descricao?: string | null
          destino_ogs: string
          diary_id?: string | null
          equipment_fleet: string
          equipment_id?: string | null
          equipment_type?: string | null
          id?: string
          meter_no_transporte?: number | null
          observacoes?: string | null
          odometer_no_transporte?: number | null
          origem_descricao?: string | null
          origem_ogs: string
          tipo_transportador: string
          transportador_nome?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          data?: string
          destino_descricao?: string | null
          destino_ogs?: string
          diary_id?: string | null
          equipment_fleet?: string
          equipment_id?: string | null
          equipment_type?: string | null
          id?: string
          meter_no_transporte?: number | null
          observacoes?: string | null
          odometer_no_transporte?: number | null
          origem_descricao?: string | null
          origem_ogs?: string
          tipo_transportador?: string
          transportador_nome?: string | null
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          ano: string | null
          categoria_rdo: string | null
          centro_custo: string | null
          chassi: string | null
          company_id: string
          condicao: string
          condutor_atual: string | null
          cor: string | null
          created_at: string
          data_aquisicao: string | null
          data_fim_locacao: string | null
          data_inicio_locacao: string | null
          dia_fechamento: number | null
          empresa_proprietaria: string | null
          empresa_terceira_id: string | null
          frota: string
          horímetro_atual: number | null
          id: string
          intervalo_troca_oleo_h: number | null
          km_atual: number | null
          local_atual: string | null
          marca: string | null
          modelo_completo: string | null
          motivo_manutencao: string | null
          nf_aquisicao_url: string | null
          nome: string
          observacoes: string | null
          patrimonio: string | null
          periodo_medicao: string | null
          placa: string | null
          previsao_liberacao: string | null
          serie: string | null
          setor: string | null
          status: string
          tipo: string | null
          tipo_veiculo: string | null
          ultimo_horímetro_oleo: number | null
          updated_at: string
          valor_aquisicao: number | null
          valor_mensal: number | null
          vinculo_rdo: string | null
          vinculos: string[] | null
        }
        Insert: {
          ano?: string | null
          categoria_rdo?: string | null
          centro_custo?: string | null
          chassi?: string | null
          company_id: string
          condicao?: string
          condutor_atual?: string | null
          cor?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_fim_locacao?: string | null
          data_inicio_locacao?: string | null
          dia_fechamento?: number | null
          empresa_proprietaria?: string | null
          empresa_terceira_id?: string | null
          frota: string
          horímetro_atual?: number | null
          id?: string
          intervalo_troca_oleo_h?: number | null
          km_atual?: number | null
          local_atual?: string | null
          marca?: string | null
          modelo_completo?: string | null
          motivo_manutencao?: string | null
          nf_aquisicao_url?: string | null
          nome: string
          observacoes?: string | null
          patrimonio?: string | null
          periodo_medicao?: string | null
          placa?: string | null
          previsao_liberacao?: string | null
          serie?: string | null
          setor?: string | null
          status?: string
          tipo?: string | null
          tipo_veiculo?: string | null
          ultimo_horímetro_oleo?: number | null
          updated_at?: string
          valor_aquisicao?: number | null
          valor_mensal?: number | null
          vinculo_rdo?: string | null
          vinculos?: string[] | null
        }
        Update: {
          ano?: string | null
          categoria_rdo?: string | null
          centro_custo?: string | null
          chassi?: string | null
          company_id?: string
          condicao?: string
          condutor_atual?: string | null
          cor?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_fim_locacao?: string | null
          data_inicio_locacao?: string | null
          dia_fechamento?: number | null
          empresa_proprietaria?: string | null
          empresa_terceira_id?: string | null
          frota?: string
          horímetro_atual?: number | null
          id?: string
          intervalo_troca_oleo_h?: number | null
          km_atual?: number | null
          local_atual?: string | null
          marca?: string | null
          modelo_completo?: string | null
          motivo_manutencao?: string | null
          nf_aquisicao_url?: string | null
          nome?: string
          observacoes?: string | null
          patrimonio?: string | null
          periodo_medicao?: string | null
          placa?: string | null
          previsao_liberacao?: string | null
          serie?: string | null
          setor?: string | null
          status?: string
          tipo?: string | null
          tipo_veiculo?: string | null
          ultimo_horímetro_oleo?: number | null
          updated_at?: string
          valor_aquisicao?: number | null
          valor_mensal?: number | null
          vinculo_rdo?: string | null
          vinculos?: string[] | null
        }
        Relationships: []
      }
      equipamentos_documentos: {
        Row: {
          alerta_dias: number | null
          arquivo_url: string | null
          company_id: string
          created_at: string
          created_by: string | null
          data_emissao: string | null
          data_vencimento: string | null
          descricao: string | null
          equipamento_id: string
          id: string
          numero: string | null
          tipo: string
        }
        Insert: {
          alerta_dias?: number | null
          arquivo_url?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          equipamento_id: string
          id?: string
          numero?: string | null
          tipo: string
        }
        Update: {
          alerta_dias?: number | null
          arquivo_url?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          equipamento_id?: string
          id?: string
          numero?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_documentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_manutencoes: {
        Row: {
          arquivo_url: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custo: number | null
          data: string
          descricao: string | null
          equipamento_id: string
          fornecedor: string | null
          horímetro: number | null
          id: string
          km: number | null
          mecanico: string | null
          observacoes: string | null
          pecas: Json | null
          tipo: string
        }
        Insert: {
          arquivo_url?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custo?: number | null
          data: string
          descricao?: string | null
          equipamento_id: string
          fornecedor?: string | null
          horímetro?: number | null
          id?: string
          km?: number | null
          mecanico?: string | null
          observacoes?: string | null
          pecas?: Json | null
          tipo: string
        }
        Update: {
          arquivo_url?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo?: number | null
          data?: string
          descricao?: string | null
          equipamento_id?: string
          fornecedor?: string | null
          horímetro?: number | null
          id?: string
          km?: number | null
          mecanico?: string | null
          observacoes?: string | null
          pecas?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_manutencoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_medicoes: {
        Row: {
          arquivo_url: string | null
          cobrar_diesel: boolean | null
          cobrar_manutencoes: boolean | null
          cobrar_ocorrencias: boolean | null
          company_id: string
          created_at: string
          dias_trabalhados: number | null
          empresa_proprietaria: string | null
          equipamento_id: string
          frota: string | null
          gerado_em: string | null
          gerado_por: string | null
          horímetro_fim: number | null
          horímetro_inicio: number | null
          id: string
          itens_medicao: Json | null
          numero_medicao: string | null
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string | null
          total_diesel: number | null
          total_manutencoes: number | null
          total_ocorrencias: number | null
          valor_base: number | null
          valor_total: number | null
        }
        Insert: {
          arquivo_url?: string | null
          cobrar_diesel?: boolean | null
          cobrar_manutencoes?: boolean | null
          cobrar_ocorrencias?: boolean | null
          company_id: string
          created_at?: string
          dias_trabalhados?: number | null
          empresa_proprietaria?: string | null
          equipamento_id: string
          frota?: string | null
          gerado_em?: string | null
          gerado_por?: string | null
          horímetro_fim?: number | null
          horímetro_inicio?: number | null
          id?: string
          itens_medicao?: Json | null
          numero_medicao?: string | null
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string | null
          total_diesel?: number | null
          total_manutencoes?: number | null
          total_ocorrencias?: number | null
          valor_base?: number | null
          valor_total?: number | null
        }
        Update: {
          arquivo_url?: string | null
          cobrar_diesel?: boolean | null
          cobrar_manutencoes?: boolean | null
          cobrar_ocorrencias?: boolean | null
          company_id?: string
          created_at?: string
          dias_trabalhados?: number | null
          empresa_proprietaria?: string | null
          equipamento_id?: string
          frota?: string | null
          gerado_em?: string | null
          gerado_por?: string | null
          horímetro_fim?: number | null
          horímetro_inicio?: number | null
          id?: string
          itens_medicao?: Json | null
          numero_medicao?: string | null
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string | null
          total_diesel?: number | null
          total_manutencoes?: number | null
          total_ocorrencias?: number | null
          valor_base?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_medicoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos_ocorrencias: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          equipamento_id: string
          foto_url: string | null
          frota: string
          id: string
          obra: string | null
          origem: string | null
          os_id: string | null
          prioridade: string
          respondido_em: string | null
          respondido_por: string | null
          resposta_manutencao: string | null
          solicitante_nome: string | null
          solicitante_perfil: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          equipamento_id: string
          foto_url?: string | null
          frota: string
          id?: string
          obra?: string | null
          origem?: string | null
          os_id?: string | null
          prioridade?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_manutencao?: string | null
          solicitante_nome?: string | null
          solicitante_perfil?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          equipamento_id?: string
          foto_url?: string | null
          frota?: string
          id?: string
          obra?: string | null
          origem?: string | null
          os_id?: string | null
          prioridade?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_manutencao?: string | null
          solicitante_nome?: string | null
          solicitante_perfil?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_ocorrencias_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamentos_ocorrencias_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "manutencao_os"
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
          company_id: string | null
          diary_id: string | null
          id: string
          meter_at_change: number | null
          quantity: number | null
          status: string | null
        }
        Insert: {
          brand?: string | null
          company_id?: string | null
          diary_id?: string | null
          id?: string
          meter_at_change?: number | null
          quantity?: number | null
          status?: string | null
        }
        Update: {
          brand?: string | null
          company_id?: string | null
          diary_id?: string | null
          id?: string
          meter_at_change?: number | null
          quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_bits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_bits_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_checklist_results: {
        Row: {
          company_id: string | null
          created_at: string | null
          diary_id: string | null
          id: string
          item_name: string
          observation: string | null
          photo_avaria_url: string | null
          status: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          diary_id?: string | null
          id?: string
          item_name: string
          observation?: string | null
          photo_avaria_url?: string | null
          status: string
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "equipment_checklist_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_checklist_results_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_diaries: {
        Row: {
          attachment_type: string | null
          auto_reason: string | null
          checklist_submitted_at: string | null
          client_name: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          equipamento_id: string | null
          equipment_fleet: string | null
          equipment_type: string | null
          fotos_perfil: Json | null
          fresagem_type: string | null
          fuel_liters: number | null
          fuel_meter: number | null
          fuel_type: string | null
          horimetro_diff: number | null
          horimetro_inconsistente: boolean | null
          id: string
          is_auto: boolean | null
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
          preop_checklist_id: string | null
          status: string | null
          user_id: string | null
          work_status: string | null
        }
        Insert: {
          attachment_type?: string | null
          auto_reason?: string | null
          checklist_submitted_at?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          equipamento_id?: string | null
          equipment_fleet?: string | null
          equipment_type?: string | null
          fotos_perfil?: Json | null
          fresagem_type?: string | null
          fuel_liters?: number | null
          fuel_meter?: number | null
          fuel_type?: string | null
          horimetro_diff?: number | null
          horimetro_inconsistente?: boolean | null
          id?: string
          is_auto?: boolean | null
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
          preop_checklist_id?: string | null
          status?: string | null
          user_id?: string | null
          work_status?: string | null
        }
        Update: {
          attachment_type?: string | null
          auto_reason?: string | null
          checklist_submitted_at?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          equipamento_id?: string | null
          equipment_fleet?: string | null
          equipment_type?: string | null
          fotos_perfil?: Json | null
          fresagem_type?: string | null
          fuel_liters?: number | null
          fuel_meter?: number | null
          fuel_type?: string | null
          horimetro_diff?: number | null
          horimetro_inconsistente?: boolean | null
          id?: string
          is_auto?: boolean | null
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
          preop_checklist_id?: string | null
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
            foreignKeyName: "equipment_diaries_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_diaries_preop_checklist_id_fkey"
            columns: ["preop_checklist_id"]
            isOneToOne: false
            referencedRelation: "equipment_preop_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_diaries_cleanup_backup: {
        Row: {
          attachment_type: string | null
          auto_reason: string | null
          checklist_submitted_at: string | null
          cleanup_at: string | null
          cleanup_batch: string | null
          client_name: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          equipamento_id: string | null
          equipment_fleet: string | null
          equipment_type: string | null
          fotos_perfil: Json | null
          fresagem_type: string | null
          fuel_liters: number | null
          fuel_meter: number | null
          fuel_type: string | null
          horimetro_diff: number | null
          horimetro_inconsistente: boolean | null
          id: string | null
          is_auto: boolean | null
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
          preop_checklist_id: string | null
          status: string | null
          user_id: string | null
          work_status: string | null
        }
        Insert: {
          attachment_type?: string | null
          auto_reason?: string | null
          checklist_submitted_at?: string | null
          cleanup_at?: string | null
          cleanup_batch?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          equipamento_id?: string | null
          equipment_fleet?: string | null
          equipment_type?: string | null
          fotos_perfil?: Json | null
          fresagem_type?: string | null
          fuel_liters?: number | null
          fuel_meter?: number | null
          fuel_type?: string | null
          horimetro_diff?: number | null
          horimetro_inconsistente?: boolean | null
          id?: string | null
          is_auto?: boolean | null
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
          preop_checklist_id?: string | null
          status?: string | null
          user_id?: string | null
          work_status?: string | null
        }
        Update: {
          attachment_type?: string | null
          auto_reason?: string | null
          checklist_submitted_at?: string | null
          cleanup_at?: string | null
          cleanup_batch?: string | null
          client_name?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          equipamento_id?: string | null
          equipment_fleet?: string | null
          equipment_type?: string | null
          fotos_perfil?: Json | null
          fresagem_type?: string | null
          fuel_liters?: number | null
          fuel_meter?: number | null
          fuel_type?: string | null
          horimetro_diff?: number | null
          horimetro_inconsistente?: boolean | null
          id?: string | null
          is_auto?: boolean | null
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
          preop_checklist_id?: string | null
          status?: string | null
          user_id?: string | null
          work_status?: string | null
        }
        Relationships: []
      }
      equipment_preop_checklist_entries: {
        Row: {
          created_at: string
          id: string
          item_id: string
          observation: string | null
          photo_url: string | null
          preop_checklist_id: string
          status: Database["public"]["Enums"]["checklist_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          observation?: string | null
          photo_url?: string | null
          preop_checklist_id: string
          status: Database["public"]["Enums"]["checklist_status"]
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          observation?: string | null
          photo_url?: string | null
          preop_checklist_id?: string
          status?: Database["public"]["Enums"]["checklist_status"]
        }
        Relationships: [
          {
            foreignKeyName: "equipment_preop_checklist_entries_preop_checklist_id_fkey"
            columns: ["preop_checklist_id"]
            isOneToOne: false
            referencedRelation: "equipment_preop_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_preop_checklists: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          date: string
          diary_id: string | null
          equipment_fleet: string
          equipment_type: string
          id: string
          operator_name: string | null
          period: string
          submitted_at: string
          truck_type: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          date: string
          diary_id?: string | null
          equipment_fleet: string
          equipment_type: string
          id?: string
          operator_name?: string | null
          period: string
          submitted_at?: string
          truck_type?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          date?: string
          diary_id?: string | null
          equipment_fleet?: string
          equipment_type?: string
          id?: string
          operator_name?: string | null
          period?: string
          submitted_at?: string
          truck_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_preop_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_preop_checklists_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_production_areas: {
        Row: {
          company_id: string | null
          diary_id: string | null
          id: string
          length_m: number | null
          m2: number | null
          m3: number | null
          thickness_cm: number | null
          width_m: number | null
        }
        Insert: {
          company_id?: string | null
          diary_id?: string | null
          id?: string
          length_m?: number | null
          m2?: number | null
          m3?: number | null
          thickness_cm?: number | null
          width_m?: number | null
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "equipment_production_areas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_production_areas_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
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
        ]
      }
      equipment_visual_inspection: {
        Row: {
          company_id: string | null
          created_at: string | null
          damage_type: string | null
          diary_id: string | null
          id: string
          photo_avaria_url: string | null
          x_position: number
          y_position: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          damage_type?: string | null
          diary_id?: string | null
          id?: string
          photo_avaria_url?: string | null
          x_position: number
          y_position: number
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "equipment_visual_inspection_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_visual_inspection_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
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
          tipo_insumo: string | null
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
          tipo_insumo?: string | null
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
          tipo_insumo?: string | null
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
        Relationships: []
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
      funcionarios_terceiros: {
        Row: {
          ativo: boolean | null
          company_id: string
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          data_nascimento: string | null
          documento_url: string | null
          email: string | null
          empresa_id: string
          funcao: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          company_id: string
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          documento_url?: string | null
          email?: string | null
          empresa_id: string
          funcao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          company_id?: string
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          documento_url?: string | null
          email?: string | null
          empresa_id?: string
          funcao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_terceiros_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_terceiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_parceiras"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gestao_frotas_multas: {
        Row: {
          auto_infracao: string | null
          cnh_condutor: string | null
          cobranca_condutor: string | null
          codigo_infracao: string | null
          codigo_orgao: string | null
          company_id: string
          condutor_employee_id: string | null
          condutor_nome: string | null
          created_at: string
          created_by: string | null
          data_infracao: string
          data_vencimento: string | null
          descricao: string | null
          equipamento_id: string | null
          equipment_fleet: string | null
          gravidade: string | null
          hora_infracao: string | null
          id: string
          local_infracao: string | null
          municipio: string | null
          observacoes: string | null
          orgao_autuador: string | null
          placa: string
          pontos: number | null
          status: string
          tipo_registro: string | null
          uf: string | null
          updated_at: string
          valor: number
          veiculo_modelo: string | null
        }
        Insert: {
          auto_infracao?: string | null
          cnh_condutor?: string | null
          cobranca_condutor?: string | null
          codigo_infracao?: string | null
          codigo_orgao?: string | null
          company_id: string
          condutor_employee_id?: string | null
          condutor_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_infracao: string
          data_vencimento?: string | null
          descricao?: string | null
          equipamento_id?: string | null
          equipment_fleet?: string | null
          gravidade?: string | null
          hora_infracao?: string | null
          id?: string
          local_infracao?: string | null
          municipio?: string | null
          observacoes?: string | null
          orgao_autuador?: string | null
          placa: string
          pontos?: number | null
          status?: string
          tipo_registro?: string | null
          uf?: string | null
          updated_at?: string
          valor?: number
          veiculo_modelo?: string | null
        }
        Update: {
          auto_infracao?: string | null
          cnh_condutor?: string | null
          cobranca_condutor?: string | null
          codigo_infracao?: string | null
          codigo_orgao?: string | null
          company_id?: string
          condutor_employee_id?: string | null
          condutor_nome?: string | null
          created_at?: string
          created_by?: string | null
          data_infracao?: string
          data_vencimento?: string | null
          descricao?: string | null
          equipamento_id?: string | null
          equipment_fleet?: string | null
          gravidade?: string | null
          hora_infracao?: string | null
          id?: string
          local_infracao?: string | null
          municipio?: string | null
          observacoes?: string | null
          orgao_autuador?: string | null
          placa?: string
          pontos?: number | null
          status?: string
          tipo_registro?: string | null
          uf?: string | null
          updated_at?: string
          valor?: number
          veiculo_modelo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gestao_frotas_multas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestao_frotas_multas_condutor_employee_id_fkey"
            columns: ["condutor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestao_frotas_multas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gestao_frotas_multas_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      horimetro_audit: {
        Row: {
          company_id: string | null
          confirmado_pelo_operador: boolean | null
          created_at: string | null
          created_by: string | null
          diary_date: string
          diff: number | null
          equipment_fleet: string
          id: string
          threshold_usado: number | null
          ultimo_valor: number | null
          valor_informado: number | null
        }
        Insert: {
          company_id?: string | null
          confirmado_pelo_operador?: boolean | null
          created_at?: string | null
          created_by?: string | null
          diary_date: string
          diff?: number | null
          equipment_fleet: string
          id?: string
          threshold_usado?: number | null
          ultimo_valor?: number | null
          valor_informado?: number | null
        }
        Update: {
          company_id?: string | null
          confirmado_pelo_operador?: boolean | null
          created_at?: string | null
          created_by?: string | null
          diary_date?: string
          diff?: number | null
          equipment_fleet?: string
          id?: string
          threshold_usado?: number | null
          ultimo_valor?: number | null
          valor_informado?: number | null
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "kma_calibration_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kma_calibration_entries_equipment_diary_id_fkey"
            columns: ["equipment_diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "kma_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kma_operations_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
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
      login_blocks: {
        Row: {
          attempts: number | null
          blocked_until: string | null
          created_at: string | null
          email: string
          id: string
          last_attempt_at: string | null
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_attempt_at?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_attempt_at?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
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
          equipamento_id: string | null
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
          equipamento_id?: string | null
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
          equipamento_id?: string | null
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
          {
            foreignKeyName: "manutencao_documentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
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
          equipamento_id: string | null
          equipment_fleet: string
          equipment_type: string | null
          horimetro_abertura: number | null
          horímetro_abertura: number | null
          horimetro_conclusao: number | null
          horímetro_conclusao: number | null
          id: string
          local_ogs: string | null
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
          equipamento_id?: string | null
          equipment_fleet: string
          equipment_type?: string | null
          horimetro_abertura?: number | null
          horímetro_abertura?: number | null
          horimetro_conclusao?: number | null
          horímetro_conclusao?: number | null
          id?: string
          local_ogs?: string | null
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
          equipamento_id?: string | null
          equipment_fleet?: string
          equipment_type?: string | null
          horimetro_abertura?: number | null
          horímetro_abertura?: number | null
          horimetro_conclusao?: number | null
          horímetro_conclusao?: number | null
          id?: string
          local_ogs?: string | null
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
        Relationships: [
          {
            foreignKeyName: "manutencao_os_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
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
      materiais: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          tipo_uso: string
          tipos_uso: string[] | null
          vinculo_rdo: string
          vinculos: string[] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          tipo_uso?: string
          tipos_uso?: string[] | null
          vinculo_rdo?: string
          vinculos?: string[] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo_uso?: string
          tipos_uso?: string[] | null
          vinculo_rdo?: string
          vinculos?: string[] | null
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
      mdo_custos_acl: {
        Row: {
          capability: string
          company_id: string
          user_id: string
        }
        Insert: {
          capability: string
          company_id: string
          user_id: string
        }
        Update: {
          capability?: string
          company_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdo_custos_acl_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mdo_custos_auditoria: {
        Row: {
          acao: string
          antes: Json | null
          ator: string
          company_id: string
          depois: Json | null
          dia: string | null
          employee_id: string | null
          id: number
          periodo_id: string | null
          registrado_em: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          ator: string
          company_id: string
          depois?: Json | null
          dia?: string | null
          employee_id?: string | null
          id?: never
          periodo_id?: string | null
          registrado_em?: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          ator?: string
          company_id?: string
          depois?: Json | null
          dia?: string | null
          employee_id?: string | null
          id?: never
          periodo_id?: string | null
          registrado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdo_custos_auditoria_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_auditoria_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_auditoria_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "mdo_custos_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      mdo_custos_decisoes: {
        Row: {
          alterado_em: string
          alterado_por: string
          company_id: string
          dia: string
          disposicao: string
          employee_id: string
          motivo: string
          ogs_id: string | null
          periodo_id: string
        }
        Insert: {
          alterado_em?: string
          alterado_por: string
          company_id: string
          dia: string
          disposicao: string
          employee_id: string
          motivo?: string
          ogs_id?: string | null
          periodo_id: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string
          company_id?: string
          dia?: string
          disposicao?: string
          employee_id?: string
          motivo?: string
          ogs_id?: string | null
          periodo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdo_custos_decisoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_decisoes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_decisoes_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_decisoes_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "mdo_custos_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      mdo_custos_equipes_dia: {
        Row: {
          alterado_em: string
          alterado_por: string
          company_id: string
          dia: string
          employee_id: string
          equipe: string
          motivo: string
          periodo_id: string
        }
        Insert: {
          alterado_em?: string
          alterado_por: string
          company_id: string
          dia: string
          employee_id: string
          equipe: string
          motivo: string
          periodo_id: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string
          company_id?: string
          dia?: string
          employee_id?: string
          equipe?: string
          motivo?: string
          periodo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdo_custos_equipes_dia_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_equipes_dia_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_equipes_dia_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "mdo_custos_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      mdo_custos_fechado: {
        Row: {
          aprovado_em: string
          company_id: string
          dia: string
          disposicao: string
          employee_id: string
          equipe: string | null
          equipe_corrigida: boolean
          equipe_original: string | null
          funcao: string | null
          matricula: string | null
          motivo: string
          nome: string
          ogs_custos: string | null
          ogs_rdo: string | null
          periodo_id: string
          rdo_ids: string | null
          status_dia: string | null
        }
        Insert: {
          aprovado_em: string
          company_id: string
          dia: string
          disposicao: string
          employee_id: string
          equipe?: string | null
          equipe_corrigida?: boolean
          equipe_original?: string | null
          funcao?: string | null
          matricula?: string | null
          motivo?: string
          nome: string
          ogs_custos?: string | null
          ogs_rdo?: string | null
          periodo_id: string
          rdo_ids?: string | null
          status_dia?: string | null
        }
        Update: {
          aprovado_em?: string
          company_id?: string
          dia?: string
          disposicao?: string
          employee_id?: string
          equipe?: string | null
          equipe_corrigida?: boolean
          equipe_original?: string | null
          funcao?: string | null
          matricula?: string | null
          motivo?: string
          nome?: string
          ogs_custos?: string | null
          ogs_rdo?: string | null
          periodo_id?: string
          rdo_ids?: string | null
          status_dia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mdo_custos_fechado_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_fechado_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdo_custos_fechado_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "mdo_custos_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      mdo_custos_periodos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          colunas: string[]
          company_id: string
          criado_em: string
          criado_por: string
          data_fim: string
          data_inicio: string
          funcionarios_incluidos: string[] | null
          id: string
          revisao: number
          status: string
          total_linhas: number | null
          versao: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          colunas?: string[]
          company_id: string
          criado_em?: string
          criado_por: string
          data_fim: string
          data_inicio: string
          funcionarios_incluidos?: string[] | null
          id?: string
          revisao?: number
          status?: string
          total_linhas?: number | null
          versao: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          colunas?: string[]
          company_id?: string
          criado_em?: string
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          funcionarios_incluidos?: string[] | null
          id?: string
          revisao?: number
          status?: string
          total_linhas?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "mdo_custos_periodos_company_id_fkey"
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
      patio_auto_config: {
        Row: {
          auto_patio_enabled: boolean | null
          company_id: string
          created_at: string | null
          horimetro_threshold: number | null
          id: string
          odometro_threshold: number | null
          updated_at: string | null
        }
        Insert: {
          auto_patio_enabled?: boolean | null
          company_id: string
          created_at?: string | null
          horimetro_threshold?: number | null
          id?: string
          odometro_threshold?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_patio_enabled?: boolean | null
          company_id?: string
          created_at?: string | null
          horimetro_threshold?: number | null
          id?: string
          odometro_threshold?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ponto_he_competencias: {
        Row: {
          company_id: string
          competencia: string
          created_at: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          observacao: string | null
          reaberto_em: string | null
          reaberto_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          competencia: string
          created_at?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          reaberto_em?: string | null
          reaberto_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          competencia?: string
          created_at?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          reaberto_em?: string | null
          reaberto_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_he_competencias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_he_import_arquivos: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          file_name: string
          id: string
          job_id: string
          pages: number | null
          parser_payload: Json
          parser_version: string | null
          sha256: string | null
          status: string
          storage_path: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          file_name: string
          id?: string
          job_id: string
          pages?: number | null
          parser_payload?: Json
          parser_version?: string | null
          sha256?: string | null
          status?: string
          storage_path?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          file_name?: string
          id?: string
          job_id?: string
          pages?: number | null
          parser_payload?: Json
          parser_version?: string | null
          sha256?: string | null
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_he_import_arquivos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_he_import_arquivos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ponto_he_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_he_import_batidas: {
        Row: {
          colaborador_id: string
          company_id: string
          created_at: string
          data: string
          entrada1: string | null
          entrada2: string | null
          entrada3: string | null
          he_dia_h: number | null
          horas_trabalhadas_h: number | null
          id: string
          job_id: string
          linha_origem: string | null
          saida1: string | null
          saida2: string | null
          saida3: string | null
          source_payload: Json
        }
        Insert: {
          colaborador_id: string
          company_id: string
          created_at?: string
          data: string
          entrada1?: string | null
          entrada2?: string | null
          entrada3?: string | null
          he_dia_h?: number | null
          horas_trabalhadas_h?: number | null
          id?: string
          job_id: string
          linha_origem?: string | null
          saida1?: string | null
          saida2?: string | null
          saida3?: string | null
          source_payload?: Json
        }
        Update: {
          colaborador_id?: string
          company_id?: string
          created_at?: string
          data?: string
          entrada1?: string | null
          entrada2?: string | null
          entrada3?: string | null
          he_dia_h?: number | null
          horas_trabalhadas_h?: number | null
          id?: string
          job_id?: string
          linha_origem?: string | null
          saida1?: string | null
          saida2?: string | null
          saida3?: string | null
          source_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ponto_he_import_batidas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "ponto_he_import_colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_he_import_batidas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_he_import_batidas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ponto_he_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_he_import_colaboradores: {
        Row: {
          adicional_noturno_horas: number
          company_id: string
          created_at: string
          credito_horas: number
          debito_horas: number
          employee_id: string | null
          equipe_nome: string | null
          fonte_matricula: string | null
          fonte_nome: string
          funcao_nome: string | null
          he_100_horas: number
          he_70_horas: number
          horas_normais: number
          id: string
          job_id: string
          mapping_reason: string | null
          mapping_status: string
          periodo_fim: string
          periodo_inicio: string
          source_payload: Json
          total_horas_extras_horas: number
          updated_at: string
        }
        Insert: {
          adicional_noturno_horas?: number
          company_id: string
          created_at?: string
          credito_horas?: number
          debito_horas?: number
          employee_id?: string | null
          equipe_nome?: string | null
          fonte_matricula?: string | null
          fonte_nome: string
          funcao_nome?: string | null
          he_100_horas?: number
          he_70_horas?: number
          horas_normais?: number
          id?: string
          job_id: string
          mapping_reason?: string | null
          mapping_status?: string
          periodo_fim: string
          periodo_inicio: string
          source_payload?: Json
          total_horas_extras_horas?: number
          updated_at?: string
        }
        Update: {
          adicional_noturno_horas?: number
          company_id?: string
          created_at?: string
          credito_horas?: number
          debito_horas?: number
          employee_id?: string | null
          equipe_nome?: string | null
          fonte_matricula?: string | null
          fonte_nome?: string
          funcao_nome?: string | null
          he_100_horas?: number
          he_70_horas?: number
          horas_normais?: number
          id?: string
          job_id?: string
          mapping_reason?: string | null
          mapping_status?: string
          periodo_fim?: string
          periodo_inicio?: string
          source_payload?: Json
          total_horas_extras_horas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_he_import_colaboradores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_he_import_colaboradores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_he_import_colaboradores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ponto_he_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_he_import_jobs: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          company_id: string
          competencia: string
          created_at: string
          created_by: string | null
          equipe_nome: string | null
          id: string
          metadata: Json
          observacao: string | null
          origem: string
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          company_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          equipe_nome?: string | null
          id?: string
          metadata?: Json
          observacao?: string | null
          origem?: string
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          company_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          equipe_nome?: string | null
          id?: string
          metadata?: Json
          observacao?: string | null
          origem?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_he_import_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_he_resumo_mensal: {
        Row: {
          adicional_noturno_horas: number
          colaborador_nome: string
          company_id: string
          competencia: string
          created_at: string
          credito_horas: number
          debito_horas: number
          employee_id: string | null
          equipe_nome: string | null
          fonte_pdf: string | null
          he_100_horas: number
          he_70_horas: number
          horas_normais: number
          id: string
          payload: Json
          periodo_fim: string
          periodo_inicio: string
          total_horas_extras_horas: number
          updated_at: string
        }
        Insert: {
          adicional_noturno_horas?: number
          colaborador_nome: string
          company_id: string
          competencia: string
          created_at?: string
          credito_horas?: number
          debito_horas?: number
          employee_id?: string | null
          equipe_nome?: string | null
          fonte_pdf?: string | null
          he_100_horas?: number
          he_70_horas?: number
          horas_normais?: number
          id?: string
          payload?: Json
          periodo_fim: string
          periodo_inicio: string
          total_horas_extras_horas?: number
          updated_at?: string
        }
        Update: {
          adicional_noturno_horas?: number
          colaborador_nome?: string
          company_id?: string
          competencia?: string
          created_at?: string
          credito_horas?: number
          debito_horas?: number
          employee_id?: string | null
          equipe_nome?: string | null
          fonte_pdf?: string | null
          he_100_horas?: number
          he_70_horas?: number
          horas_normais?: number
          id?: string
          payload?: Json
          periodo_fim?: string
          periodo_inicio?: string
          total_horas_extras_horas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_he_resumo_mensal_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_he_resumo_mensal_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
        ]
      }
      ponto_solicitacoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          company_id: string | null
          created_at: string | null
          data_referencia: string
          foto_url: string | null
          hora_atual: string | null
          hora_fim: string | null
          hora_inicio: string | null
          hora_solicitada: string | null
          id: string
          motivo: string
          motivo_reprovacao: string | null
          observacao: string | null
          staff_id: string
          status: string
          tipo: string
          tipo_registro: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          company_id?: string | null
          created_at?: string | null
          data_referencia: string
          foto_url?: string | null
          hora_atual?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          hora_solicitada?: string | null
          id?: string
          motivo: string
          motivo_reprovacao?: string | null
          observacao?: string | null
          staff_id: string
          status?: string
          tipo: string
          tipo_registro?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          company_id?: string | null
          created_at?: string | null
          data_referencia?: string
          foto_url?: string | null
          hora_atual?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          hora_solicitada?: string | null
          id?: string
          motivo?: string
          motivo_reprovacao?: string | null
          observacao?: string | null
          staff_id?: string
          status?: string
          tipo?: string
          tipo_registro?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_solicitacoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ponto_solicitacoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pontomais_sync_runs: {
        Row: {
          company_id: string
          competencia: string
          created_at: string
          created_by: string | null
          endpoint: string | null
          error_message: string | null
          http_status: number | null
          id: string
          items_count: number
          payload: Json
          status: string
        }
        Insert: {
          company_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          endpoint?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          items_count?: number
          payload?: Json
          status?: string
        }
        Update: {
          company_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          endpoint?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          items_count?: number
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontomais_sync_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entries: {
        Row: {
          area_m2: number | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "production_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_create_users: boolean | null
          can_delete: boolean | null
          can_export: boolean | null
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
          can_export?: boolean | null
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
          can_export?: boolean | null
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
      programacao_comunicados: {
        Row: {
          id: string
          company_id: string
          data: string
          itens: Json
          revisao: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          data: string
          itens: Json
          revisao?: number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          data?: string
          itens?: Json
          revisao?: number
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_comunicados_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      programacao_comunicado_revisoes: {
        Row: {
          id: string
          company_id: string
          comunicado_id: string
          revisao_anterior: number
          revisao_nova: number
          itens_antes: Json
          itens_depois: Json
          alterado_por: string
          alterado_por_nome: string | null
          alterado_em: string
        }
        Insert: {
          id?: string
          company_id: string
          comunicado_id: string
          revisao_anterior: number
          revisao_nova: number
          itens_antes: Json
          itens_depois: Json
          alterado_por: string
          alterado_por_nome?: string | null
          alterado_em?: string
        }
        Update: {
          id?: string
          company_id?: string
          comunicado_id?: string
          revisao_anterior?: number
          revisao_nova?: number
          itens_antes?: Json
          itens_depois?: Json
          alterado_por?: string
          alterado_por_nome?: string | null
          alterado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacao_comunicado_revisoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacao_comunicado_revisoes_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "programacao_comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      programador_observacoes: {
        Row: {
          company_id: string
          id: string
          subject_id: string
          subject_type: string
          texto: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          company_id: string
          id?: string
          subject_id: string
          subject_type: string
          texto?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          company_id?: string
          id?: string
          subject_id?: string
          subject_type?: string
          texto?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "programador_observacoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      programador_observacoes_historico: {
        Row: {
          changed_at: string
          changed_by: string
          company_id: string
          id: string
          observacao_id: string
          subject_id: string
          subject_type: string
          texto_anterior: string | null
          texto_novo: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          company_id: string
          id?: string
          observacao_id: string
          subject_id: string
          subject_type: string
          texto_anterior?: string | null
          texto_novo?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          company_id?: string
          id?: string
          observacao_id?: string
          subject_id?: string
          subject_type?: string
          texto_anterior?: string | null
          texto_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programador_observacoes_historico_observacao_id_fkey"
            columns: ["observacao_id"]
            isOneToOne: false
            referencedRelation: "programador_observacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_documentos: {
        Row: {
          data_upload: string | null
          id: string
          prontuario_id: string
          tipo_documento: string
          uploaded_by: string | null
          url_arquivo: string
        }
        Insert: {
          data_upload?: string | null
          id?: string
          prontuario_id: string
          tipo_documento: string
          uploaded_by?: string | null
          url_arquivo: string
        }
        Update: {
          data_upload?: string | null
          id?: string
          prontuario_id?: string
          tipo_documento?: string
          uploaded_by?: string | null
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_documentos_prontuario_id_fkey"
            columns: ["prontuario_id"]
            isOneToOne: false
            referencedRelation: "prontuario_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_historico: {
        Row: {
          acao: string
          alterado_por: string | null
          campo_alterado: string | null
          data_alteracao: string | null
          id: string
          prontuario_id: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          alterado_por?: string | null
          campo_alterado?: string | null
          data_alteracao?: string | null
          id?: string
          prontuario_id: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          alterado_por?: string | null
          campo_alterado?: string | null
          data_alteracao?: string | null
          id?: string
          prontuario_id?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_historico_prontuario_id_fkey"
            columns: ["prontuario_id"]
            isOneToOne: false
            referencedRelation: "prontuario_rh"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_rh: {
        Row: {
          agencia: string | null
          alergias: string | null
          banco: string | null
          beneficiarios_plano_saude: string | null
          cep: string | null
          company_id: string
          conta: string | null
          contato_emergencia_nome: string | null
          contato_emergencia_telefone: string | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_emissao_rg: string | null
          data_nascimento: string | null
          email_pessoal: string | null
          endereco_completo: string | null
          estado_civil: string | null
          funcionario_id: string
          id: string
          medicacoes: string | null
          nacionalidade: string | null
          naturalidade: string | null
          rg: string | null
          telefone_pessoal: string | null
          tipo_conta: string | null
          tipo_sanguineo: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agencia?: string | null
          alergias?: string | null
          banco?: string | null
          beneficiarios_plano_saude?: string | null
          cep?: string | null
          company_id: string
          conta?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissao_rg?: string | null
          data_nascimento?: string | null
          email_pessoal?: string | null
          endereco_completo?: string | null
          estado_civil?: string | null
          funcionario_id: string
          id?: string
          medicacoes?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          rg?: string | null
          telefone_pessoal?: string | null
          tipo_conta?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agencia?: string | null
          alergias?: string | null
          banco?: string | null
          beneficiarios_plano_saude?: string | null
          cep?: string | null
          company_id?: string
          conta?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_telefone?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissao_rg?: string | null
          data_nascimento?: string | null
          email_pessoal?: string | null
          endereco_completo?: string | null
          estado_civil?: string | null
          funcionario_id?: string
          id?: string
          medicacoes?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          rg?: string | null
          telefone_pessoal?: string | null
          tipo_conta?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuario_rh_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      rdo_apontador_engenheiro_map: {
        Row: {
          apontador_nome: string
          ativo: boolean
          company_id: string
          created_at: string
          engenheiro_nome: string
          id: string
          updated_at: string
        }
        Insert: {
          apontador_nome: string
          ativo?: boolean
          company_id: string
          created_at?: string
          engenheiro_nome: string
          id?: string
          updated_at?: string
        }
        Update: {
          apontador_nome?: string
          ativo?: boolean
          company_id?: string
          created_at?: string
          engenheiro_nome?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_apontador_engenheiro_map_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          {
            foreignKeyName: "rdo_banho_ligacao_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_dedup_backup: {
        Row: {
          backed_up_at: string
          id: number
          payload: Json
          rdo_id: string | null
          row_id: string
          run_id: string
          table_name: string
        }
        Insert: {
          backed_up_at?: string
          id?: number
          payload: Json
          rdo_id?: string | null
          row_id: string
          run_id: string
          table_name: string
        }
        Update: {
          backed_up_at?: string
          id?: number
          payload?: Json
          rdo_id?: string | null
          row_id?: string
          run_id?: string
          table_name?: string
        }
        Relationships: []
      }
      rdo_diarios: {
        Row: {
          clima: string | null
          company_id: string | null
          created_at: string | null
          data: string | null
          editado_em: string | null
          editado_por: string | null
          editado_por_nome: string | null
          empreiteiro: string | null
          encarregado: string | null
          encarregado_employee_id: string | null
          engenheiro_responsavel: string | null
          engenheiro_responsavel_employee_id: string | null
          engenheiro_responsavel_user_id: string | null
          equipamentos_nao_utilizados: Json
          equipe: string | null
          id: string
          local: string | null
          motivo_cancelamento: string | null
          motivo_rejeicao_enc: string | null
          motivo_rejeicao_eng: string | null
          nao_aprovado_encarregado: boolean | null
          obra_nome: string
          observacoes_gerais: string | null
          ogs_id: string | null
          preenchido_por: string | null
          responsavel: string | null
          responsavel_employee_id: string | null
          sem_nota: boolean
          sem_producao: boolean
          status_validacao: string
          tipo_rdo: string | null
          turno: string | null
          user_id: string | null
          validado_em: string | null
          validado_encarregado: boolean | null
          validado_encarregado_em: string | null
          validado_encarregado_por: string | null
          validado_por: string | null
        }
        Insert: {
          clima?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: string | null
          editado_em?: string | null
          editado_por?: string | null
          editado_por_nome?: string | null
          empreiteiro?: string | null
          encarregado?: string | null
          encarregado_employee_id?: string | null
          engenheiro_responsavel?: string | null
          engenheiro_responsavel_employee_id?: string | null
          engenheiro_responsavel_user_id?: string | null
          equipamentos_nao_utilizados?: Json
          equipe?: string | null
          id?: string
          local?: string | null
          motivo_cancelamento?: string | null
          motivo_rejeicao_enc?: string | null
          motivo_rejeicao_eng?: string | null
          nao_aprovado_encarregado?: boolean | null
          obra_nome: string
          observacoes_gerais?: string | null
          ogs_id?: string | null
          preenchido_por?: string | null
          responsavel?: string | null
          responsavel_employee_id?: string | null
          sem_nota?: boolean
          sem_producao?: boolean
          status_validacao?: string
          tipo_rdo?: string | null
          turno?: string | null
          user_id?: string | null
          validado_em?: string | null
          validado_encarregado?: boolean | null
          validado_encarregado_em?: string | null
          validado_encarregado_por?: string | null
          validado_por?: string | null
        }
        Update: {
          clima?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: string | null
          editado_em?: string | null
          editado_por?: string | null
          editado_por_nome?: string | null
          empreiteiro?: string | null
          encarregado?: string | null
          encarregado_employee_id?: string | null
          engenheiro_responsavel?: string | null
          engenheiro_responsavel_employee_id?: string | null
          engenheiro_responsavel_user_id?: string | null
          equipamentos_nao_utilizados?: Json
          equipe?: string | null
          id?: string
          local?: string | null
          motivo_cancelamento?: string | null
          motivo_rejeicao_enc?: string | null
          motivo_rejeicao_eng?: string | null
          nao_aprovado_encarregado?: boolean | null
          obra_nome?: string
          observacoes_gerais?: string | null
          ogs_id?: string | null
          preenchido_por?: string | null
          responsavel?: string | null
          responsavel_employee_id?: string | null
          sem_nota?: boolean
          sem_producao?: boolean
          status_validacao?: string
          tipo_rdo?: string | null
          turno?: string | null
          user_id?: string | null
          validado_em?: string | null
          validado_encarregado?: boolean | null
          validado_encarregado_em?: string | null
          validado_encarregado_por?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_diarios_encarregado_employee_id_fkey"
            columns: ["encarregado_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_diarios_engenheiro_responsavel_employee_id_fkey"
            columns: ["engenheiro_responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_diarios_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_diarios_responsavel_employee_id_fkey"
            columns: ["responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_duplicate_block_events: {
        Row: {
          company_id: string | null
          created_at: string
          error_code: string | null
          id: string
          payload: Json
          rdo_id: string | null
          scope: string
          stage: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          payload?: Json
          rdo_id?: string | null
          scope: string
          stage: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          payload?: Json
          rdo_id?: string | null
          scope?: string
          stage?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rdo_efetivo: {
        Row: {
          company_id: string | null
          employee_id: string | null
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
          employee_id?: string | null
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
          employee_id?: string | null
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
            foreignKeyName: "rdo_efetivo_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_efetivo_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_efetivo_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_efetivo_terceiros: {
        Row: {
          created_at: string
          empresa_id: string
          empresa_nome: string
          empresa_parceira_id: string | null
          funcionario_id: string
          funcionario_nome: string
          id: string
          rdo_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          empresa_nome: string
          empresa_parceira_id?: string | null
          funcionario_id: string
          funcionario_nome: string
          id?: string
          rdo_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          empresa_nome?: string
          empresa_parceira_id?: string | null
          funcionario_id?: string
          funcionario_nome?: string
          id?: string
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_efetivo_terceiros_empresa_parceira_id_fkey"
            columns: ["empresa_parceira_id"]
            isOneToOne: false
            referencedRelation: "empresas_parceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_efetivo_terceiros_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_efetivo_terceiros_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_encarregados: {
        Row: {
          ativo: boolean | null
          company_id: string | null
          created_at: string | null
          funcao: string | null
          id: string
          matricula: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          funcao?: string | null
          id?: string
          matricula?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          company_id?: string | null
          created_at?: string | null
          funcao?: string | null
          id?: string
          matricula?: string | null
          nome?: string
        }
        Relationships: []
      }
      rdo_engenheiro: {
        Row: {
          bgs_ton: number | null
          bgtc_m3: number | null
          binder_ton: number | null
          bm25_ton: number | null
          cauq_programado: number | null
          cauq_rima_ton: number | null
          cbuq_fx3_ton: number | null
          choveu: boolean | null
          company_id: string
          created_at: string | null
          data: string
          descricao_ocorrencia: string | null
          egl_ton: number | null
          engenheiro_id: string
          equipamentos_conforme: boolean | null
          equipamentos_nao_conformes: string | null
          equipe: string | null
          fresagem_m2: number | null
          gap_ton: number | null
          geogrelha_m2: number | null
          horario_chegada_vtr: string | null
          horario_contato_cco: string | null
          horario_evento: string | null
          horario_liberacao_pista: string | null
          horario_liberacao_pmr: string | null
          houve_ocorrencia: boolean | null
          houve_producao: boolean
          id: string
          infra_descricao: string | null
          intensidade_chuva: string | null
          localizacao: string | null
          macadame_m3: number | null
          motivo_sem_producao: string | null
          numero_evento: string | null
          numero_evento_horario: string | null
          observacoes: string | null
          ogs_id: string
          ogs_number: string | null
          outro_motivo_sem_producao: string | null
          perc_conclusao_via: number | null
          qtd_caminhoes_fresa: number | null
          rachao_ton: number | null
          fx_c_ton: number | null
          demolicao_m: number | null
          nivelamento_pv_un: number | null
          rap_espumado_m2: number | null
          rdo_apontador_id: string | null
          sma_ton: number | null
          solucao_empregada: string | null
          status: string
          tipo_secao: string | null
          tipo_servico: string | null
          updated_at: string | null
          usina_atendeu: boolean | null
          usina_nao_atendeu_motivo: string | null
          usina_programada: string | null
        }
        Insert: {
          bgs_ton?: number | null
          bgtc_m3?: number | null
          binder_ton?: number | null
          bm25_ton?: number | null
          cauq_programado?: number | null
          cauq_rima_ton?: number | null
          cbuq_fx3_ton?: number | null
          choveu?: boolean | null
          company_id: string
          created_at?: string | null
          data?: string
          descricao_ocorrencia?: string | null
          egl_ton?: number | null
          engenheiro_id: string
          equipamentos_conforme?: boolean | null
          equipamentos_nao_conformes?: string | null
          equipe?: string | null
          fresagem_m2?: number | null
          gap_ton?: number | null
          geogrelha_m2?: number | null
          horario_chegada_vtr?: string | null
          horario_contato_cco?: string | null
          horario_evento?: string | null
          horario_liberacao_pista?: string | null
          horario_liberacao_pmr?: string | null
          houve_ocorrencia?: boolean | null
          houve_producao?: boolean
          id?: string
          infra_descricao?: string | null
          intensidade_chuva?: string | null
          localizacao?: string | null
          macadame_m3?: number | null
          motivo_sem_producao?: string | null
          numero_evento?: string | null
          numero_evento_horario?: string | null
          observacoes?: string | null
          ogs_id: string
          ogs_number?: string | null
          outro_motivo_sem_producao?: string | null
          perc_conclusao_via?: number | null
          qtd_caminhoes_fresa?: number | null
          rachao_ton?: number | null
          fx_c_ton?: number | null
          demolicao_m?: number | null
          nivelamento_pv_un?: number | null
          rap_espumado_m2?: number | null
          rdo_apontador_id?: string | null
          sma_ton?: number | null
          solucao_empregada?: string | null
          status?: string
          tipo_secao?: string | null
          tipo_servico?: string | null
          updated_at?: string | null
          usina_atendeu?: boolean | null
          usina_nao_atendeu_motivo?: string | null
          usina_programada?: string | null
        }
        Update: {
          bgs_ton?: number | null
          bgtc_m3?: number | null
          binder_ton?: number | null
          bm25_ton?: number | null
          cauq_programado?: number | null
          cauq_rima_ton?: number | null
          cbuq_fx3_ton?: number | null
          choveu?: boolean | null
          company_id?: string
          created_at?: string | null
          data?: string
          descricao_ocorrencia?: string | null
          egl_ton?: number | null
          engenheiro_id?: string
          equipamentos_conforme?: boolean | null
          equipamentos_nao_conformes?: string | null
          equipe?: string | null
          fresagem_m2?: number | null
          gap_ton?: number | null
          geogrelha_m2?: number | null
          horario_chegada_vtr?: string | null
          horario_contato_cco?: string | null
          horario_evento?: string | null
          horario_liberacao_pista?: string | null
          horario_liberacao_pmr?: string | null
          houve_ocorrencia?: boolean | null
          houve_producao?: boolean
          id?: string
          infra_descricao?: string | null
          intensidade_chuva?: string | null
          localizacao?: string | null
          macadame_m3?: number | null
          motivo_sem_producao?: string | null
          numero_evento?: string | null
          numero_evento_horario?: string | null
          observacoes?: string | null
          ogs_id?: string
          ogs_number?: string | null
          outro_motivo_sem_producao?: string | null
          perc_conclusao_via?: number | null
          qtd_caminhoes_fresa?: number | null
          rachao_ton?: number | null
          fx_c_ton?: number | null
          demolicao_m?: number | null
          nivelamento_pv_un?: number | null
          rap_espumado_m2?: number | null
          rdo_apontador_id?: string | null
          sma_ton?: number | null
          solucao_empregada?: string | null
          status?: string
          tipo_secao?: string | null
          tipo_servico?: string | null
          updated_at?: string | null
          usina_atendeu?: boolean | null
          usina_nao_atendeu_motivo?: string | null
          usina_programada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_engenheiro_ogs_id_fkey"
            columns: ["ogs_id"]
            isOneToOne: false
            referencedRelation: "ogs_reference"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_engenheiro_rdo_apontador_id_fkey"
            columns: ["rdo_apontador_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_engenheiro_rdo_apontador_id_fkey"
            columns: ["rdo_apontador_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_equipamento_padroes: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          created_by: string | null
          equipe: string
          id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          equipe: string
          id?: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          equipe?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipamento_padroes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          {
            foreignKeyName: "rdo_equipamentos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_informacoes_dmt: {
        Row: {
          company_id: string | null
          created_at: string
          dmt_canteiro_km: number | null
          dmt_usina_km: number | null
          id: string
          rdo_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          dmt_canteiro_km?: number | null
          dmt_usina_km?: number | null
          id?: string
          rdo_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          dmt_canteiro_km?: number | null
          dmt_usina_km?: number | null
          id?: string
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_informacoes_dmt_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_informacoes_dmt_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
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
          {
            foreignKeyName: "rdo_mancha_areia_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_nf_concreto: {
        Row: {
          company_id: string | null
          created_at: string | null
          equipamento: string | null
          fornecedor: string | null
          foto_url: string | null
          id: string
          nf: string | null
          quantidade_m3: number | null
          rdo_id: string | null
          tipo_concreto: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          equipamento?: string | null
          fornecedor?: string | null
          foto_url?: string | null
          id?: string
          nf?: string | null
          quantidade_m3?: number | null
          rdo_id?: string | null
          tipo_concreto?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          equipamento?: string | null
          fornecedor?: string | null
          foto_url?: string | null
          id?: string
          nf?: string | null
          quantidade_m3?: number | null
          rdo_id?: string | null
          tipo_concreto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_nf_concreto_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_nf_concreto_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_nf_concreto_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
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
          {
            foreignKeyName: "rdo_nf_massa_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
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
          is_retrabalho: boolean
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
          is_retrabalho?: boolean
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
          is_retrabalho?: boolean
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
          {
            foreignKeyName: "rdo_producao_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rdo_sinalizacao_horizontal: {
        Row: {
          company_id: string | null
          comprimento_m: number | null
          created_at: string
          estaca_final: string | null
          estaca_inicial: string | null
          faixa: string | null
          id: string
          largura_m: number | null
          quantidade: number | null
          quantidade_taxas: number | null
          rdo_id: string
          sentido: string | null
          tipo: string | null
        }
        Insert: {
          company_id?: string | null
          comprimento_m?: number | null
          created_at?: string
          estaca_final?: string | null
          estaca_inicial?: string | null
          faixa?: string | null
          id?: string
          largura_m?: number | null
          quantidade?: number | null
          quantidade_taxas?: number | null
          rdo_id: string
          sentido?: string | null
          tipo?: string | null
        }
        Update: {
          company_id?: string | null
          comprimento_m?: number | null
          created_at?: string
          estaca_final?: string | null
          estaca_inicial?: string | null
          faixa?: string | null
          id?: string
          largura_m?: number | null
          quantidade?: number | null
          quantidade_taxas?: number | null
          rdo_id?: string
          sentido?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_sinalizacao_horizontal_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_sinalizacao_horizontal_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
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
          {
            foreignKeyName: "rdo_temperatura_espalhamento_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
        ]
      }
      rh_candidato_contatos: {
        Row: {
          canal: string
          candidato_id: string
          company_id: string
          created_at: string
          created_by: string | null
          data_contato: string
          id: string
          observacao: string | null
          proximo_passo: string | null
          resultado: string | null
        }
        Insert: {
          canal?: string
          candidato_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          data_contato?: string
          id?: string
          observacao?: string | null
          proximo_passo?: string | null
          resultado?: string | null
        }
        Update: {
          canal?: string
          candidato_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_contato?: string
          id?: string
          observacao?: string | null
          proximo_passo?: string | null
          resultado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_candidato_contatos_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rh_candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_candidato_contatos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_candidatos: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          data_entrevista: string | null
          data_teste: string | null
          funcao: string | null
          id: string
          idade: number | null
          indicacao: string | null
          motivo_reprovacao: string | null
          nome: string
          observacoes: string | null
          resultado_teste: string | null
          status_candidatura: string
          telefone_1: string | null
          telefone_2: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          data_entrevista?: string | null
          data_teste?: string | null
          funcao?: string | null
          id?: string
          idade?: number | null
          indicacao?: string | null
          motivo_reprovacao?: string | null
          nome: string
          observacoes?: string | null
          resultado_teste?: string | null
          status_candidatura?: string
          telefone_1?: string | null
          telefone_2?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_entrevista?: string | null
          data_teste?: string | null
          funcao?: string | null
          id?: string
          idade?: number | null
          indicacao?: string | null
          motivo_reprovacao?: string | null
          nome?: string
          observacoes?: string | null
          resultado_teste?: string | null
          status_candidatura?: string
          telefone_1?: string | null
          telefone_2?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_candidatos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pendencias_funcionario: {
        Row: {
          company_id: string
          created_at: string
          data_efetiva: string | null
          employee_id: string
          id: string
          justificativa: string
          motivo_reprovacao: string | null
          parecer_gp: string | null
          payload: Json
          prioridade: string
          resolved_at: string | null
          resolved_by: string | null
          solicitado_por_nome: string | null
          solicitado_por_user_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_efetiva?: string | null
          employee_id: string
          id?: string
          justificativa: string
          motivo_reprovacao?: string | null
          parecer_gp?: string | null
          payload?: Json
          prioridade?: string
          resolved_at?: string | null
          resolved_by?: string | null
          solicitado_por_nome?: string | null
          solicitado_por_user_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_efetiva?: string | null
          employee_id?: string
          id?: string
          justificativa?: string
          motivo_reprovacao?: string | null
          parecer_gp?: string | null
          payload?: Json
          prioridade?: string
          resolved_at?: string | null
          resolved_by?: string | null
          solicitado_por_nome?: string | null
          solicitado_por_user_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_pendencias_funcionario_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pendencias_movimentacoes: {
        Row: {
          acao: string
          comentario: string | null
          company_id: string
          created_at: string
          created_by: string | null
          created_by_nome: string | null
          id: string
          pendencia_id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          acao?: string
          comentario?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          id?: string
          pendencia_id: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          acao?: string
          comentario?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          id?: string
          pendencia_id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_pendencias_movimentacoes_pendencia_id_fkey"
            columns: ["pendencia_id"]
            isOneToOne: false
            referencedRelation: "rh_pendencias_funcionario"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          ativo: boolean | null
          company_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          company_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          company_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_funcionario_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          funcionario_id: string
          id: string
          observacao: string | null
          tipo_documento: string
          updated_at: string | null
          validade: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          funcionario_id: string
          id?: string
          observacao?: string | null
          tipo_documento: string
          updated_at?: string | null
          validade?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          funcionario_id?: string
          id?: string
          observacao?: string | null
          tipo_documento?: string
          updated_at?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sst_funcionario_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_funcionarios_integracao: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_credenciamento: string | null
          data_integracao: string | null
          data_vencimento: string | null
          documentos_extras: string[] | null
          documentos_pendentes: string[] | null
          funcionario_id: string
          id: string
          obra_id: string
          observacoes: string | null
          status_credenciamento: string | null
          status_integracao: string | null
          updated_at: string | null
          vencimento_credenciamento: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_credenciamento?: string | null
          data_integracao?: string | null
          data_vencimento?: string | null
          documentos_extras?: string[] | null
          documentos_pendentes?: string[] | null
          funcionario_id: string
          id?: string
          obra_id: string
          observacoes?: string | null
          status_credenciamento?: string | null
          status_integracao?: string | null
          updated_at?: string | null
          vencimento_credenciamento?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_credenciamento?: string | null
          data_integracao?: string | null
          data_vencimento?: string | null
          documentos_extras?: string[] | null
          documentos_pendentes?: string[] | null
          funcionario_id?: string
          id?: string
          obra_id?: string
          observacoes?: string | null
          status_credenciamento?: string | null
          status_integracao?: string | null
          updated_at?: string | null
          vencimento_credenciamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sst_funcionarios_integracao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_funcionarios_integracao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "sst_obras_integracao"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_inspections: {
        Row: {
          administrativo: string | null
          administrativo_employee_id: string | null
          ass_cliente: string | null
          ass_engenheiro_img: string | null
          ass_responsavel_obra: string | null
          ass_tecnico: string | null
          ass_tecnico_img: string | null
          cliente: string | null
          company_id: string
          created_at: string | null
          criado_por: string | null
          data_inspecao: string
          encarregado_employee_id: string | null
          encarregado_obra: string | null
          endereco: string | null
          engenheiro_employee_id: string | null
          engenheiro_obra: string | null
          epi_bota: string | null
          epi_capacete: string | null
          epi_cinto: string | null
          epi_colete: string | null
          epi_luvas: string | null
          epi_mascara: string | null
          epi_obs: string | null
          epi_oculos: string | null
          epi_protetor_auricular: string | null
          fotos: Json | null
          horario: string | null
          id: string
          local_obra: string | null
          nao_conformidades: string | null
          nome_obra: string
          qtd_colaboradores: number | null
          qtd_terceiros: number | null
          responsavel_obra: string | null
          seg_apr: string | null
          seg_dds: string | null
          seg_extintores: string | null
          seg_isolamento: string | null
          seg_maquinas: string | null
          seg_obs: string | null
          seg_primeiros_socorros: string | null
          seg_sinalizacao: string | null
          status: string | null
          tecnico_responsavel: string | null
          tecnico_responsavel_employee_id: string | null
          updated_at: string | null
        }
        Insert: {
          administrativo?: string | null
          administrativo_employee_id?: string | null
          ass_cliente?: string | null
          ass_engenheiro_img?: string | null
          ass_responsavel_obra?: string | null
          ass_tecnico?: string | null
          ass_tecnico_img?: string | null
          cliente?: string | null
          company_id: string
          created_at?: string | null
          criado_por?: string | null
          data_inspecao: string
          encarregado_employee_id?: string | null
          encarregado_obra?: string | null
          endereco?: string | null
          engenheiro_employee_id?: string | null
          engenheiro_obra?: string | null
          epi_bota?: string | null
          epi_capacete?: string | null
          epi_cinto?: string | null
          epi_colete?: string | null
          epi_luvas?: string | null
          epi_mascara?: string | null
          epi_obs?: string | null
          epi_oculos?: string | null
          epi_protetor_auricular?: string | null
          fotos?: Json | null
          horario?: string | null
          id?: string
          local_obra?: string | null
          nao_conformidades?: string | null
          nome_obra: string
          qtd_colaboradores?: number | null
          qtd_terceiros?: number | null
          responsavel_obra?: string | null
          seg_apr?: string | null
          seg_dds?: string | null
          seg_extintores?: string | null
          seg_isolamento?: string | null
          seg_maquinas?: string | null
          seg_obs?: string | null
          seg_primeiros_socorros?: string | null
          seg_sinalizacao?: string | null
          status?: string | null
          tecnico_responsavel?: string | null
          tecnico_responsavel_employee_id?: string | null
          updated_at?: string | null
        }
        Update: {
          administrativo?: string | null
          administrativo_employee_id?: string | null
          ass_cliente?: string | null
          ass_engenheiro_img?: string | null
          ass_responsavel_obra?: string | null
          ass_tecnico?: string | null
          ass_tecnico_img?: string | null
          cliente?: string | null
          company_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_inspecao?: string
          encarregado_employee_id?: string | null
          encarregado_obra?: string | null
          endereco?: string | null
          engenheiro_employee_id?: string | null
          engenheiro_obra?: string | null
          epi_bota?: string | null
          epi_capacete?: string | null
          epi_cinto?: string | null
          epi_colete?: string | null
          epi_luvas?: string | null
          epi_mascara?: string | null
          epi_obs?: string | null
          epi_oculos?: string | null
          epi_protetor_auricular?: string | null
          fotos?: Json | null
          horario?: string | null
          id?: string
          local_obra?: string | null
          nao_conformidades?: string | null
          nome_obra?: string
          qtd_colaboradores?: number | null
          qtd_terceiros?: number | null
          responsavel_obra?: string | null
          seg_apr?: string | null
          seg_dds?: string | null
          seg_extintores?: string | null
          seg_isolamento?: string | null
          seg_maquinas?: string | null
          seg_obs?: string | null
          seg_primeiros_socorros?: string | null
          seg_sinalizacao?: string | null
          status?: string | null
          tecnico_responsavel?: string | null
          tecnico_responsavel_employee_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sst_inspections_administrativo_employee_id_fkey"
            columns: ["administrativo_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_inspections_encarregado_employee_id_fkey"
            columns: ["encarregado_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_inspections_engenheiro_employee_id_fkey"
            columns: ["engenheiro_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_inspections_tecnico_responsavel_employee_id_fkey"
            columns: ["tecnico_responsavel_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sst_obras_integracao: {
        Row: {
          company_id: string | null
          concessionaria: string | null
          created_at: string | null
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          documentos_exigidos: string[] | null
          id: string
          local: string | null
          nome_obra: string
          observacoes: string | null
          status: string | null
          tem_credenciamento: boolean | null
          updated_at: string | null
          validade_meses: number | null
        }
        Insert: {
          company_id?: string | null
          concessionaria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          documentos_exigidos?: string[] | null
          id?: string
          local?: string | null
          nome_obra: string
          observacoes?: string | null
          status?: string | null
          tem_credenciamento?: boolean | null
          updated_at?: string | null
          validade_meses?: number | null
        }
        Update: {
          company_id?: string | null
          concessionaria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          documentos_exigidos?: string[] | null
          id?: string
          local?: string | null
          nome_obra?: string
          observacoes?: string | null
          status?: string | null
          tem_credenciamento?: boolean | null
          updated_at?: string | null
          validade_meses?: number | null
        }
        Relationships: []
      }
      sst_responsaveis: {
        Row: {
          ativo: boolean | null
          cargo: string
          company_id: string
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          cargo: string
          company_id: string
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          cargo?: string
          company_id?: string
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          company_id: string
          data_cancelamento: string | null
          data_inicio: string | null
          data_vencimento: string | null
          id: string
          plano: string
          status: string | null
          valor: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          company_id: string
          data_cancelamento?: string | null
          data_inicio?: string | null
          data_vencimento?: string | null
          id?: string
          plano: string
          status?: string | null
          valor: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          company_id?: string
          data_cancelamento?: string | null
          data_inicio?: string | null
          data_vencimento?: string | null
          id?: string
          plano?: string
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      suprimentos_tipos: {
        Row: {
          ativo: boolean | null
          categoria: string
          company_id: string
          created_at: string | null
          id: string
          nome: string
          unidade: string | null
          valor_unitario: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          company_id: string
          created_at?: string | null
          id?: string
          nome: string
          unidade?: string | null
          valor_unitario?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          company_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          unidade?: string | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suprimentos_usos: {
        Row: {
          company_id: string
          created_at: string | null
          data_uso: string
          id: string
          maquina_id: string
          observacoes: string | null
          quantidade: number
          rdo_id: string | null
          registrado_por: string | null
          tipo_id: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          data_uso?: string
          id?: string
          maquina_id: string
          observacoes?: string | null
          quantidade: number
          rdo_id?: string | null
          registrado_por?: string | null
          tipo_id: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          data_uso?: string
          id?: string
          maquina_id?: string
          observacoes?: string | null
          quantidade?: number
          rdo_id?: string | null
          registrado_por?: string | null
          tipo_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suprimentos_usos_maquina_id_fkey"
            columns: ["maquina_id"]
            isOneToOne: false
            referencedRelation: "maquinas_frota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suprimentos_usos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdo_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suprimentos_usos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "vw_cruzamento_rdo"
            referencedColumns: ["rdo_apontador_id"]
          },
          {
            foreignKeyName: "suprimentos_usos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "suprimentos_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros_medicoes: {
        Row: {
          aprovado_por: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          data_aprovacao: string | null
          data_medicao: string
          empresa_id: string
          funcionario_id: string
          id: string
          obra_id: string
          observacoes: string | null
          quantidade: number
          servico_id: string | null
          status: string | null
        }
        Insert: {
          aprovado_por?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          data_aprovacao?: string | null
          data_medicao: string
          empresa_id: string
          funcionario_id: string
          id?: string
          obra_id: string
          observacoes?: string | null
          quantidade: number
          servico_id?: string | null
          status?: string | null
        }
        Update: {
          aprovado_por?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          data_aprovacao?: string | null
          data_medicao?: string
          empresa_id?: string
          funcionario_id?: string
          id?: string
          obra_id?: string
          observacoes?: string | null
          quantidade?: number
          servico_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_medicoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_medicoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_parceiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_medicoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_terceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceiros_medicoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "terceiros_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      terceiros_servicos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          tipo_servico: string
          unidade: string | null
          valor_unitario: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          tipo_servico: string
          unidade?: string | null
          valor_unitario?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          tipo_servico?: string
          unidade?: string | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "terceiros_servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_parceiras"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          activity: string
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      truck_registry: {
        Row: {
          capacidade_m3: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          cor?: string | null
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          modelo?: string | null
          placa?: string
          vinculos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "truck_registry_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_tank_supplies: {
        Row: {
          company_id: string | null
          created_at: string | null
          diary_id: string | null
          emulsion_type: string | null
          id: string
          material_type: string | null
          quantity: number | null
          supplier: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          diary_id?: string | null
          emulsion_type?: string | null
          id?: string
          material_type?: string | null
          quantity?: number | null
          supplier?: string | null
        }
        Update: {
          company_id?: string | null
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
            foreignKeyName: "truck_tank_supplies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_tank_supplies_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "equipment_diaries"
            referencedColumns: ["id"]
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
          arrival_load_status: string | null
          arrival_time: string | null
          arrival_user_id: string | null
          company_id: string | null
          created_at: string | null
          date: string | null
          departure_geo: string | null
          departure_gps_issue_notes: string | null
          departure_gps_issue_reason: string | null
          departure_load_status: string | null
          departure_time: string | null
          departure_user_id: string | null
          destination_id: string | null
          encarregado: string | null
          id: string
          material_type: string | null
          origin_ogs_id: string | null
          quantity: number | null
          status: string | null
          truck_plate: string
        }
        Insert: {
          arrival_geo?: string | null
          arrival_load_status?: string | null
          arrival_time?: string | null
          arrival_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          departure_geo?: string | null
          departure_gps_issue_notes?: string | null
          departure_gps_issue_reason?: string | null
          departure_load_status?: string | null
          departure_time?: string | null
          departure_user_id?: string | null
          destination_id?: string | null
          encarregado?: string | null
          id?: string
          material_type?: string | null
          origin_ogs_id?: string | null
          quantity?: number | null
          status?: string | null
          truck_plate: string
        }
        Update: {
          arrival_geo?: string | null
          arrival_load_status?: string | null
          arrival_time?: string | null
          arrival_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          departure_geo?: string | null
          departure_gps_issue_notes?: string | null
          departure_gps_issue_reason?: string | null
          departure_load_status?: string | null
          departure_time?: string | null
          departure_user_id?: string | null
          destination_id?: string | null
          encarregado?: string | null
          id?: string
          material_type?: string | null
          origin_ogs_id?: string | null
          quantity?: number | null
          status?: string | null
          truck_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "trucker_trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_admin_panel_access: {
        Row: {
          allowed_sections: string[]
          can_access_panel: boolean
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          allowed_sections?: string[]
          can_access_panel?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          allowed_sections?: string[]
          can_access_panel?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_admin_panel_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_panel_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_admin_panel_access_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_admin_panel_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_admin_permissions: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          resource: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          resource: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          resource?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_admin_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          modulo_encarregado: boolean | null
          modulo_engenharia: boolean | null
          modulo_equipamentos: boolean | null
          modulo_gestao_frotas: boolean | null
          modulo_gestao_pessoas: boolean | null
          modulo_manutencao: boolean | null
          modulo_medicoes: boolean | null
          modulo_obras: boolean | null
          modulo_orcamentos: boolean
          modulo_planejamento: boolean
          modulo_refeicoes: boolean
          refeicoes_gestor: boolean
          modulo_programador: boolean | null
          modulo_relatorios: boolean | null
          modulo_rh: boolean | null
          modulo_sst: boolean | null
          modulo_suprimentos: boolean | null
          rdos_permitidos: string[] | null
          relatorios_permitidos: string[] | null
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
          modulo_encarregado?: boolean | null
          modulo_engenharia?: boolean | null
          modulo_equipamentos?: boolean | null
          modulo_gestao_frotas?: boolean | null
          modulo_gestao_pessoas?: boolean | null
          modulo_manutencao?: boolean | null
          modulo_medicoes?: boolean | null
          modulo_obras?: boolean | null
          modulo_orcamentos?: boolean
          modulo_planejamento?: boolean
          modulo_refeicoes?: boolean
          refeicoes_gestor?: boolean
          modulo_programador?: boolean | null
          modulo_relatorios?: boolean | null
          modulo_rh?: boolean | null
          modulo_sst?: boolean | null
          modulo_suprimentos?: boolean | null
          rdos_permitidos?: string[] | null
          relatorios_permitidos?: string[] | null
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
          modulo_encarregado?: boolean | null
          modulo_engenharia?: boolean | null
          modulo_equipamentos?: boolean | null
          modulo_gestao_frotas?: boolean | null
          modulo_gestao_pessoas?: boolean | null
          modulo_manutencao?: boolean | null
          modulo_medicoes?: boolean | null
          modulo_obras?: boolean | null
          modulo_orcamentos?: boolean
          modulo_planejamento?: boolean
          modulo_refeicoes?: boolean
          refeicoes_gestor?: boolean
          modulo_programador?: boolean | null
          modulo_relatorios?: boolean | null
          modulo_rh?: boolean | null
          modulo_sst?: boolean | null
          modulo_suprimentos?: boolean | null
          rdos_permitidos?: string[] | null
          relatorios_permitidos?: string[] | null
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
      vacation_approvals: {
        Row: {
          aprovador_id: string | null
          company_id: string
          created_at: string | null
          data_aprovacao: string | null
          id: string
          nivel: number | null
          observacoes: string | null
          solicitacao_id: string
          status: string | null
        }
        Insert: {
          aprovador_id?: string | null
          company_id: string
          created_at?: string | null
          data_aprovacao?: string | null
          id?: string
          nivel?: number | null
          observacoes?: string | null
          solicitacao_id: string
          status?: string | null
        }
        Update: {
          aprovador_id?: string | null
          company_id?: string
          created_at?: string | null
          data_aprovacao?: string | null
          id?: string
          nivel?: number | null
          observacoes?: string | null
          solicitacao_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_approvals_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "vacation_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_history: {
        Row: {
          ano: number
          calculado_por: string | null
          company_id: string
          created_at: string | null
          data_calculo: string | null
          dias_adquiridos_ano: number | null
          dias_perdidos: number | null
          dias_usados_ano: number | null
          funcionario_id: string
          id: string
          observacoes: string | null
          saldo_anterior_dias: number | null
          saldo_novo_dias: number | null
        }
        Insert: {
          ano: number
          calculado_por?: string | null
          company_id: string
          created_at?: string | null
          data_calculo?: string | null
          dias_adquiridos_ano?: number | null
          dias_perdidos?: number | null
          dias_usados_ano?: number | null
          funcionario_id: string
          id?: string
          observacoes?: string | null
          saldo_anterior_dias?: number | null
          saldo_novo_dias?: number | null
        }
        Update: {
          ano?: number
          calculado_por?: string | null
          company_id?: string
          created_at?: string | null
          data_calculo?: string | null
          dias_adquiridos_ano?: number | null
          dias_perdidos?: number | null
          dias_usados_ano?: number | null
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          saldo_anterior_dias?: number | null
          saldo_novo_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_history_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_movements: {
        Row: {
          company_id: string
          created_at: string | null
          criado_por: string | null
          data_movimento: string
          dias: number
          funcionario_id: string
          id: string
          observacoes: string | null
          referencia_id: string | null
          tipo: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          criado_por?: string | null
          data_movimento?: string
          dias: number
          funcionario_id: string
          id?: string
          observacoes?: string | null
          referencia_id?: string | null
          tipo: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_movimento?: string
          dias?: number
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          referencia_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_movements_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_periods: {
        Row: {
          company_id: string
          created_at: string | null
          criado_por: string | null
          data_inicio_solicitacao: string | null
          dias_coletiva: number
          dias_direito: number
          dias_gozados: number
          employee_id: string
          id: string
          nome_periodo: string | null
          observacoes_rh: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          status_solicitacao: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          criado_por?: string | null
          data_inicio_solicitacao?: string | null
          dias_coletiva?: number
          dias_direito?: number
          dias_gozados?: number
          employee_id: string
          id?: string
          nome_periodo?: string | null
          observacoes_rh?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          status_solicitacao?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_inicio_solicitacao?: string | null
          dias_coletiva?: number
          dias_direito?: number
          dias_gozados?: number
          employee_id?: string
          id?: string
          nome_periodo?: string | null
          observacoes_rh?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          status_solicitacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacation_periods_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_records: {
        Row: {
          company_id: string
          confirmacao_observacao: string | null
          confirmado_em: string | null
          confirmado_por_user_id: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          data_pagamento: string | null
          dias: number
          dias_aprovados: number | null
          dias_solicitados: number | null
          employee_id: string
          id: string
          observacao: string | null
          registrado_por: string | null
          reminder_sent_at: string | null
          status_pagamento: string | null
          tipo: string
          updated_at: string | null
          vacation_period_id: string | null
          valor_liquido: number | null
          workflow_status: string
        }
        Insert: {
          company_id: string
          confirmacao_observacao?: string | null
          confirmado_em?: string | null
          confirmado_por_user_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          data_pagamento?: string | null
          dias: number
          dias_aprovados?: number | null
          dias_solicitados?: number | null
          employee_id: string
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          reminder_sent_at?: string | null
          status_pagamento?: string | null
          tipo: string
          updated_at?: string | null
          vacation_period_id?: string | null
          valor_liquido?: number | null
          workflow_status?: string
        }
        Update: {
          company_id?: string
          confirmacao_observacao?: string | null
          confirmado_em?: string | null
          confirmado_por_user_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          data_pagamento?: string | null
          dias?: number
          dias_aprovados?: number | null
          dias_solicitados?: number | null
          employee_id?: string
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          reminder_sent_at?: string | null
          status_pagamento?: string | null
          tipo?: string
          updated_at?: string | null
          vacation_period_id?: string | null
          valor_liquido?: number | null
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_records_vacation_period_id_fkey"
            columns: ["vacation_period_id"]
            isOneToOne: false
            referencedRelation: "vacation_periods"
            referencedColumns: ["id"]
          },
        ]
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
      wf_api_access_logs: {
        Row: {
          client_id: string | null
          company_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: number
          query: Json | null
          report_key: string
          request_path: string | null
          row_count: number | null
          status_code: number
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: never
          query?: Json | null
          report_key: string
          request_path?: string | null
          row_count?: number | null
          status_code: number
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: never
          query?: Json | null
          report_key?: string
          request_path?: string | null
          row_count?: number | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "wf_api_access_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "wf_api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      wf_api_clients: {
        Row: {
          allowed_reports: string[]
          api_key_hash: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          notes: string | null
          rate_limit_per_minute: number
          updated_at: string
        }
        Insert: {
          allowed_reports?: string[]
          api_key_hash: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          notes?: string | null
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Update: {
          allowed_reports?: string[]
          api_key_hash?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          notes?: string | null
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      wf_custo_funcionario_mensal: {
        Row: {
          assistencia_medica: number
          base_encargos: number
          company_id: string
          competencia: string
          created_at: string
          created_by: string | null
          custo_total_mensal: number
          employee_id: string
          equipe: string | null
          fgts: number
          id: string
          inss_patronal: number
          lote_id: string | null
          matricula: string | null
          nome_funcionario: string | null
          origem: string
          provisao_13: number
          provisao_ferias: number
          salario: number
          seguro_vida: number
          total_encargos: number
          total_provisao_mensal: number
          totalpass: number
          um_terco_ferias: number
          updated_at: string
          updated_by: string | null
          vale_refeicao: number
        }
        Insert: {
          assistencia_medica?: number
          base_encargos?: number
          company_id: string
          competencia: string
          created_at?: string
          created_by?: string | null
          custo_total_mensal?: number
          employee_id: string
          equipe?: string | null
          fgts?: number
          id?: string
          inss_patronal?: number
          lote_id?: string | null
          matricula?: string | null
          nome_funcionario?: string | null
          origem?: string
          provisao_13?: number
          provisao_ferias?: number
          salario?: number
          seguro_vida?: number
          total_encargos?: number
          total_provisao_mensal?: number
          totalpass?: number
          um_terco_ferias?: number
          updated_at?: string
          updated_by?: string | null
          vale_refeicao?: number
        }
        Update: {
          assistencia_medica?: number
          base_encargos?: number
          company_id?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          custo_total_mensal?: number
          employee_id?: string
          equipe?: string | null
          fgts?: number
          id?: string
          inss_patronal?: number
          lote_id?: string | null
          matricula?: string | null
          nome_funcionario?: string | null
          origem?: string
          provisao_13?: number
          provisao_ferias?: number
          salario?: number
          seguro_vida?: number
          total_encargos?: number
          total_provisao_mensal?: number
          totalpass?: number
          um_terco_ferias?: number
          updated_at?: string
          updated_by?: string | null
          vale_refeicao?: number
        }
        Relationships: [
          {
            foreignKeyName: "wf_custo_funcionario_mensal_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wf_custo_funcionario_mensal_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "wf_import_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      wf_funcionario_match_queue: {
        Row: {
          company_id: string
          created_at: string
          decisao_payload: Json
          employee_id: string | null
          id: string
          lote_id: string
          match_rule: string | null
          match_score: number | null
          match_status: string
          motivo: string | null
          resolved_at: string | null
          resolved_by: string | null
          stg_funcionario_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          decisao_payload?: Json
          employee_id?: string | null
          id?: string
          lote_id: string
          match_rule?: string | null
          match_score?: number | null
          match_status?: string
          motivo?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          stg_funcionario_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          decisao_payload?: Json
          employee_id?: string | null
          id?: string
          lote_id?: string
          match_rule?: string | null
          match_score?: number | null
          match_status?: string
          motivo?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          stg_funcionario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wf_funcionario_match_queue_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wf_funcionario_match_queue_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "wf_import_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wf_funcionario_match_queue_stg_funcionario_id_fkey"
            columns: ["stg_funcionario_id"]
            isOneToOne: false
            referencedRelation: "wf_stg_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      wf_import_lotes: {
        Row: {
          arquivo_nome: string
          arquivo_sha256: string | null
          company_id: string
          competencia: string | null
          created_at: string
          created_by: string | null
          fonte: string
          id: string
          metadata: Json
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_sha256?: string | null
          company_id: string
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          fonte?: string
          id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_sha256?: string | null
          company_id?: string
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          fonte?: string
          id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      wf_notas_fiscais_uploads: {
        Row: {
          arquivo_nome: string
          company_id: string
          considerar_no_custo: boolean
          created_at: string
          data_emissao: string | null
          fornecedor: string | null
          id: string
          moeda: string
          numero_nf: string | null
          observacoes: string | null
          ogs: string
          origem: string
          storage_path: string
          updated_at: string
          updated_by: string | null
          uploaded_by: string | null
          valor_total: number | null
        }
        Insert: {
          arquivo_nome: string
          company_id: string
          considerar_no_custo?: boolean
          created_at?: string
          data_emissao?: string | null
          fornecedor?: string | null
          id?: string
          moeda?: string
          numero_nf?: string | null
          observacoes?: string | null
          ogs: string
          origem?: string
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
          valor_total?: number | null
        }
        Update: {
          arquivo_nome?: string
          company_id?: string
          considerar_no_custo?: boolean
          created_at?: string
          data_emissao?: string | null
          fornecedor?: string | null
          id?: string
          moeda?: string
          numero_nf?: string | null
          observacoes?: string | null
          ogs?: string
          origem?: string
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      wf_orcamento_itens: {
        Row: {
          categoria: string
          company_id: string
          created_at: string
          descricao: string
          detalhamento: Json
          fator_aplicacao: number
          id: string
          motivo_nao_previsto: string | null
          natureza: string
          orcamento_id: string
          ordem: number
          quantidade: number
          referencia: string
          total: number | null
          unidade: string
          unitario: number
          updated_at: string
        }
        Insert: {
          categoria: string
          company_id: string
          created_at?: string
          descricao: string
          detalhamento?: Json
          fator_aplicacao?: number
          id?: string
          motivo_nao_previsto?: string | null
          natureza?: string
          orcamento_id: string
          ordem?: number
          quantidade?: number
          referencia?: string
          total?: number | null
          unidade?: string
          unitario?: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          company_id?: string
          created_at?: string
          descricao?: string
          detalhamento?: Json
          fator_aplicacao?: number
          id?: string
          motivo_nao_previsto?: string | null
          natureza?: string
          orcamento_id?: string
          ordem?: number
          quantidade?: number
          referencia?: string
          total?: number | null
          unidade?: string
          unitario?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wf_orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "wf_orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      wf_orcamentos: {
        Row: {
          baseline_execucao: boolean
          bdi_percentual: number
          bdi_total: number
          cliente: string
          company_id: string
          contingencia_percentual: number
          contingencia_total: number
          created_at: string
          created_by: string | null
          custo_direto_total: number
          id: string
          impostos_percentual: number
          impostos_total: number
          margem_prevista: number
          obra: string
          observacoes: string | null
          ogs: string
          receita_proposta: number
          status: string
          total_orcado: number
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          baseline_execucao?: boolean
          bdi_percentual?: number
          bdi_total?: number
          cliente: string
          company_id: string
          contingencia_percentual?: number
          contingencia_total?: number
          created_at?: string
          created_by?: string | null
          custo_direto_total?: number
          id?: string
          impostos_percentual?: number
          impostos_total?: number
          margem_prevista?: number
          obra: string
          observacoes?: string | null
          ogs: string
          receita_proposta?: number
          status?: string
          total_orcado?: number
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          baseline_execucao?: boolean
          bdi_percentual?: number
          bdi_total?: number
          cliente?: string
          company_id?: string
          contingencia_percentual?: number
          contingencia_total?: number
          created_at?: string
          created_by?: string | null
          custo_direto_total?: number
          id?: string
          impostos_percentual?: number
          impostos_total?: number
          margem_prevista?: number
          obra?: string
          observacoes?: string | null
          ogs?: string
          receita_proposta?: number
          status?: string
          total_orcado?: number
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Relationships: []
      }
      wf_planejamento_obras: {
        Row: {
          cliente: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custo_comprometido: number
          custo_realizado: number
          desvio_vs_baseline: number
          eac: number | null
          id: string
          obra: string
          ogs: string
          orcamento_baseline_id: string | null
          previsao_a_executar: number
          receita_atualizada: number
          saldo_obra: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custo_comprometido?: number
          custo_realizado?: number
          desvio_vs_baseline?: number
          eac?: number | null
          id?: string
          obra: string
          ogs: string
          orcamento_baseline_id?: string | null
          previsao_a_executar?: number
          receita_atualizada?: number
          saldo_obra?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo_comprometido?: number
          custo_realizado?: number
          desvio_vs_baseline?: number
          eac?: number | null
          id?: string
          obra?: string
          ogs?: string
          orcamento_baseline_id?: string | null
          previsao_a_executar?: number
          receita_atualizada?: number
          saldo_obra?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wf_planejamento_obras_orcamento_baseline_id_fkey"
            columns: ["orcamento_baseline_id"]
            isOneToOne: false
            referencedRelation: "wf_orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      wf_planejamento_parametros_ogs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ogs: string
          preco_concreto_m3: number
          preco_massa_ton: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ogs: string
          preco_concreto_m3?: number
          preco_massa_ton?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ogs?: string
          preco_concreto_m3?: number
          preco_massa_ton?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      wf_planejamento_parametros_ogs_historico: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          id: string
          ogs: string
          origem: string
          preco_concreto_m3_anterior: number | null
          preco_concreto_m3_novo: number
          preco_massa_ton_anterior: number | null
          preco_massa_ton_novo: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          id?: string
          ogs: string
          origem?: string
          preco_concreto_m3_anterior?: number | null
          preco_concreto_m3_novo: number
          preco_massa_ton_anterior?: number | null
          preco_massa_ton_novo: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          id?: string
          ogs?: string
          origem?: string
          preco_concreto_m3_anterior?: number | null
          preco_concreto_m3_novo?: number
          preco_massa_ton_anterior?: number | null
          preco_massa_ton_novo?: number
        }
        Relationships: []
      }
      wf_stg_funcionarios: {
        Row: {
          admissao: string | null
          centro_custo: string | null
          company_id: string
          cpf: string | null
          created_at: string
          funcao: string | null
          id: string
          linha_num: number
          lote_id: string
          matricula_norm: string | null
          matricula_raw: string | null
          nascimento: string | null
          nome: string | null
          payload: Json
          process_note: string | null
          process_status: string
          rg: string | null
          row_hash: string | null
          salario: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          admissao?: string | null
          centro_custo?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          funcao?: string | null
          id?: string
          linha_num: number
          lote_id: string
          matricula_norm?: string | null
          matricula_raw?: string | null
          nascimento?: string | null
          nome?: string | null
          payload?: Json
          process_note?: string | null
          process_status?: string
          rg?: string | null
          row_hash?: string | null
          salario?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          admissao?: string | null
          centro_custo?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          funcao?: string | null
          id?: string
          linha_num?: number
          lote_id?: string
          matricula_norm?: string | null
          matricula_raw?: string | null
          nascimento?: string | null
          nome?: string | null
          payload?: Json
          process_note?: string | null
          process_status?: string
          rg?: string | null
          row_hash?: string | null
          salario?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wf_stg_funcionarios_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "wf_import_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      wf_stg_provisionamento: {
        Row: {
          assistencia_medica: number | null
          base_encargos: number | null
          company_id: string
          created_at: string
          fgts: number | null
          funcao: string | null
          id: string
          inss_patronal: number | null
          linha_num: number
          lote_id: string
          matricula_norm: string | null
          matricula_raw: string | null
          nome: string | null
          payload: Json
          process_note: string | null
          process_status: string
          provisao_13: number | null
          provisao_ferias: number | null
          row_hash: string | null
          salario: number | null
          seguro_vida: number | null
          status: string | null
          total_encargos: number | null
          total_mensal: number | null
          total_provisao_mensal: number | null
          totalpass: number | null
          um_terco_ferias: number | null
          updated_at: string
          vale_refeicao: number | null
        }
        Insert: {
          assistencia_medica?: number | null
          base_encargos?: number | null
          company_id: string
          created_at?: string
          fgts?: number | null
          funcao?: string | null
          id?: string
          inss_patronal?: number | null
          linha_num: number
          lote_id: string
          matricula_norm?: string | null
          matricula_raw?: string | null
          nome?: string | null
          payload?: Json
          process_note?: string | null
          process_status?: string
          provisao_13?: number | null
          provisao_ferias?: number | null
          row_hash?: string | null
          salario?: number | null
          seguro_vida?: number | null
          status?: string | null
          total_encargos?: number | null
          total_mensal?: number | null
          total_provisao_mensal?: number | null
          totalpass?: number | null
          um_terco_ferias?: number | null
          updated_at?: string
          vale_refeicao?: number | null
        }
        Update: {
          assistencia_medica?: number | null
          base_encargos?: number | null
          company_id?: string
          created_at?: string
          fgts?: number | null
          funcao?: string | null
          id?: string
          inss_patronal?: number | null
          linha_num?: number
          lote_id?: string
          matricula_norm?: string | null
          matricula_raw?: string | null
          nome?: string | null
          payload?: Json
          process_note?: string | null
          process_status?: string
          provisao_13?: number | null
          provisao_ferias?: number | null
          row_hash?: string | null
          salario?: number | null
          seguro_vida?: number | null
          status?: string | null
          total_encargos?: number | null
          total_mensal?: number | null
          total_provisao_mensal?: number | null
          totalpass?: number | null
          um_terco_ferias?: number | null
          updated_at?: string
          vale_refeicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wf_stg_provisionamento_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "wf_import_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      wha_conversations: {
        Row: {
          bot_active: boolean | null
          bot_state: string | null
          company_id: string
          created_at: string | null
          employee_id: string | null
          id: string
          instance_name: string
          last_message: string | null
          last_message_at: string | null
          remote_jid: string
          remote_name: string | null
          remote_phone: string | null
          status: string
          unread_count: number
          updated_at: string | null
        }
        Insert: {
          bot_active?: boolean | null
          bot_state?: string | null
          company_id: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          instance_name?: string
          last_message?: string | null
          last_message_at?: string | null
          remote_jid: string
          remote_name?: string | null
          remote_phone?: string | null
          status?: string
          unread_count?: number
          updated_at?: string | null
        }
        Update: {
          bot_active?: boolean | null
          bot_state?: string | null
          company_id?: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          instance_name?: string
          last_message?: string | null
          last_message_at?: string | null
          remote_jid?: string
          remote_name?: string | null
          remote_phone?: string | null
          status?: string
          unread_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wha_conversations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      wha_messages: {
        Row: {
          body: string | null
          company_id: string
          conversation_id: string
          created_at: string | null
          from_me: boolean
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          remote_jid: string
          status: string | null
          timestamp: number | null
        }
        Insert: {
          body?: string | null
          company_id: string
          conversation_id: string
          created_at?: string | null
          from_me?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          remote_jid: string
          status?: string | null
          timestamp?: number | null
        }
        Update: {
          body?: string | null
          company_id?: string
          conversation_id?: string
          created_at?: string | null
          from_me?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          remote_jid?: string
          status?: string | null
          timestamp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wha_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wha_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contatos: {
        Row: {
          ativo: boolean | null
          company_id: string
          created_at: string | null
          funcionario_id: string | null
          id: string
          nome: string
          opt_out: boolean | null
          telefone: string
        }
        Insert: {
          ativo?: boolean | null
          company_id: string
          created_at?: string | null
          funcionario_id?: string | null
          id?: string
          nome: string
          opt_out?: boolean | null
          telefone: string
        }
        Update: {
          ativo?: boolean | null
          company_id?: string
          created_at?: string | null
          funcionario_id?: string | null
          id?: string
          nome?: string
          opt_out?: boolean | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contatos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_config: {
        Row: {
          access_token_encrypted: string
          ativo: boolean | null
          business_account_id: string
          company_id: string
          configurado_por: string | null
          data_configuracao: string | null
          id: string
          migration_status: string | null
          observacoes: string | null
          phone_number_id: string
          substituir_evolution: boolean | null
          ultimo_check_saldo: string | null
          webhook_url: string | null
          webhook_verify_token_encrypted: string
        }
        Insert: {
          access_token_encrypted: string
          ativo?: boolean | null
          business_account_id: string
          company_id: string
          configurado_por?: string | null
          data_configuracao?: string | null
          id?: string
          migration_status?: string | null
          observacoes?: string | null
          phone_number_id: string
          substituir_evolution?: boolean | null
          ultimo_check_saldo?: string | null
          webhook_url?: string | null
          webhook_verify_token_encrypted: string
        }
        Update: {
          access_token_encrypted?: string
          ativo?: boolean | null
          business_account_id?: string
          company_id?: string
          configurado_por?: string | null
          data_configuracao?: string | null
          id?: string
          migration_status?: string | null
          observacoes?: string | null
          phone_number_id?: string
          substituir_evolution?: boolean | null
          ultimo_check_saldo?: string | null
          webhook_url?: string | null
          webhook_verify_token_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_messages: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          direction: string | null
          funcionario_id: string | null
          id: string
          mensagem: string | null
          nome_destinatario: string | null
          status: string | null
          telefone: string
          template_id: string | null
          wamid: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          funcionario_id?: string | null
          id?: string
          mensagem?: string | null
          nome_destinatario?: string | null
          status?: string | null
          telefone: string
          template_id?: string | null
          wamid?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          funcionario_id?: string | null
          id?: string
          mensagem?: string | null
          nome_destinatario?: string | null
          status?: string | null
          telefone?: string
          template_id?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_messages_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          aprovado_meta: boolean | null
          categoria: string | null
          company_id: string
          config_id: string
          corpo_template: string | null
          created_at: string | null
          criado_por: string | null
          id: string
          idioma: string | null
          nome_template: string
          rejeitada_motivo: string | null
          status_aprovacao: string | null
          template_id_meta: string
          ultimo_uso: string | null
          updated_at: string | null
          variaveis_esperadas: string[] | null
        }
        Insert: {
          aprovado_meta?: boolean | null
          categoria?: string | null
          company_id: string
          config_id: string
          corpo_template?: string | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          idioma?: string | null
          nome_template: string
          rejeitada_motivo?: string | null
          status_aprovacao?: string | null
          template_id_meta: string
          ultimo_uso?: string | null
          updated_at?: string | null
          variaveis_esperadas?: string[] | null
        }
        Update: {
          aprovado_meta?: boolean | null
          categoria?: string | null
          company_id?: string
          config_id?: string
          corpo_template?: string | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          idioma?: string | null
          nome_template?: string
          rejeitada_motivo?: string | null
          status_aprovacao?: string | null
          template_id_meta?: string
          ultimo_uso?: string | null
          updated_at?: string | null
          variaveis_esperadas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_config"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_log: {
        Row: {
          company_id: string
          config_id: string
          erro_processamento: string | null
          id: string
          payload: Json
          processado: boolean | null
          processed_at: string | null
          received_at: string | null
          resultado_processamento: Json | null
          webhook_event: string
        }
        Insert: {
          company_id: string
          config_id: string
          erro_processamento?: string | null
          id?: string
          payload: Json
          processado?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          resultado_processamento?: Json | null
          webhook_event: string
        }
        Update: {
          company_id?: string
          config_id?: string
          erro_processamento?: string | null
          id?: string
          payload?: Json
          processado?: boolean | null
          processed_at?: string | null
          received_at?: string | null
          resultado_processamento?: Json | null
          webhook_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_config"
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
      vw_cruzamento_rdo: {
        Row: {
          apontador: string | null
          client_name: string | null
          company_id: string | null
          data: string | null
          divergencia_fresagem_m2: number | null
          engenheiro_id: string | null
          fresagem_apontador_m2: number | null
          fresagem_engenheiro_m2: number | null
          ogs_number: string | null
          rdo_apontador_id: string | null
          rdo_engenheiro_id: string | null
          status_validacao: string | null
        }
        Relationships: []
      }
      wf_custo_equipe_mensal: {
        Row: {
          company_id: string | null
          competencia: string | null
          custo_medio_funcionario: number | null
          custo_total_equipe: number | null
          equipe: string | null
          qtd_funcionarios: number | null
          total_beneficios: number | null
          total_provisoes: number | null
          total_salarios: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_profile_company_id: { Args: never; Returns: string }
      auth_profile_has_any_admin_role: { Args: never; Returns: boolean }
      auth_profile_is_admin: { Args: never; Returns: boolean }
      auth_profile_is_superadmin: { Args: never; Returns: boolean }
      can_access_ci_integracao: {
        Args: { _integracao_id: string }
        Returns: boolean
      }
      fn_assert_diary_deadline_48h: {
        Args: {
          p_actor_user_id: string
          p_company_id: string
          p_diary_date: string
          p_tipo: string
        }
        Returns: undefined
      }
      fn_can_bypass_diary_deadline: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      fn_ponto_he_can_write_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      fn_ponto_he_competencia_fechada: {
        Args: { p_company_id: string; p_competencia: string }
        Returns: boolean
      }
      fn_ponto_he_fechar_competencia: {
        Args: {
          p_company_id: string
          p_competencia: string
          p_observacao?: string
        }
        Returns: Json
      }
      fn_ponto_he_pdf_apply: {
        Args: { p_job_id: string; p_observacao?: string }
        Returns: Json
      }
      fn_ponto_he_pdf_precheck: { Args: { p_job_id: string }; Returns: Json }
      fn_ponto_he_pdf_seed_job_team: {
        Args: { p_job_id: string }
        Returns: Json
      }
      fn_ponto_he_pdf_stage_payload: {
        Args: { p_job_id: string; p_payload: Json }
        Returns: Json
      }
      fn_ponto_he_reabrir_competencia: {
        Args: {
          p_company_id: string
          p_competencia: string
          p_observacao?: string
        }
        Returns: Json
      }
      get_saldo_ferias: {
        Args: { p_company_id: string; p_funcionario_id: string }
        Returns: {
          ano_atual: number
          dias_adquiridos: number
          dias_disponivel: number
          dias_pendentes: number
          dias_usados: number
          ultima_atualizacao: string
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      get_user_permissions: {
        Args: { p_user_id: string }
        Returns: {
          permission_key: string
        }[]
      }
      has_module: { Args: { module_name: string }; Returns: boolean }
      has_module_new: { Args: { p_module_id: string }; Returns: boolean }
      has_permission: { Args: { p_permission_key: string }; Returns: boolean }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_owner_admin_email: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_rdo_dup_block_event: {
        Args: {
          p_error_code?: string
          p_payload?: Json
          p_rdo_id?: string
          p_scope: string
          p_stage: string
        }
        Returns: string
      }
      login_block_register_failure: {
        Args: {
          p_block_minutes?: number
          p_email: string
          p_max_attempts?: number
        }
        Returns: {
          attempts: number
          blocked_until: string
          is_blocked: boolean
          remaining_attempts: number
        }[]
      }
      login_block_reset: {
        Args: { p_email: string; p_unblocked_by?: string }
        Returns: boolean
      }
      login_block_status: {
        Args: { p_email: string }
        Returns: {
          attempts: number
          blocked_until: string
          is_blocked: boolean
        }[]
      }
      mdo_custos_abrir: {
        Args: { p_empresa: string; p_fim: string; p_inicio: string }
        Returns: string
      }
      mdo_custos_alterar: {
        Args: { p_celulas: Json; p_periodo: string; p_revisao: number }
        Returns: number
      }
      mdo_custos_alterar_equipe: {
        Args: {
          p_celulas: Json
          p_equipe: string
          p_motivo: string
          p_periodo: string
          p_revisao: number
        }
        Returns: number
      }
      mdo_custos_aprovar: {
        Args: { p_periodo: string; p_revisao: number }
        Returns: number
      }
      mdo_custos_base: {
        Args: { p_empresa: string; p_fim: string; p_inicio: string }
        Returns: {
          dia: string
          employee_id: string
          equipe: string
          funcao: string
          historico_equipe: boolean
          historico_status: boolean
          matricula: string
          nome: string
          ogs_custos: string
          ogs_rdo: string
          rdo_ids: string
          status_dia: string
        }[]
      }
      mdo_custos_carregar: {
        Args: { p_empresa: string; p_fim: string; p_inicio: string }
        Returns: Json
      }
      mdo_custos_configurar: {
        Args: {
          p_colunas: string[]
          p_funcionarios: string[]
          p_periodo: string
          p_revisao: number
        }
        Returns: number
      }
      mdo_custos_definir_exportador: {
        Args: { p_empresa: string; p_permitir: boolean; p_usuario: string }
        Returns: undefined
      }
      mdo_custos_grade_interna: {
        Args: {
          p_empresa: string
          p_fim: string
          p_inicio: string
          p_periodo: string
        }
        Returns: Json
      }
      mdo_custos_listar_acessos: {
        Args: { p_empresa: string }
        Returns: {
          email: string
          nome: string
          permitido: boolean
          user_id: string
        }[]
      }
      mdo_custos_nome: { Args: { p_nome: string }; Returns: string }
      mdo_custos_pode: {
        Args: { p_acao: string; p_empresa: string }
        Returns: boolean
      }
      mdo_custos_publicar: {
        Args: { p_assinatura: string; p_periodo: string; p_revisao: number }
        Returns: number
      }
      mdo_custos_rdo_confirmado: {
        Args: { p_dia: string; p_empresa: string; p_funcionario: string }
        Returns: boolean
      }
      programador_aplicar_lote: {
        Args: {
          p_company_id: string
          p_data: string
          p_equip_changes: Json
          p_equipe: string
          p_func_changes: Json
          p_override_reason: string
        }
        Returns: Json
      }
      programador_atualizar_valor_mensal: {
        Args: {
          p_company_id: string
          p_equipment_id: string
          p_valor_mensal: number
        }
        Returns: Json
      }
      programador_criar_comunicado: {
        Args: { p_company_id: string; p_data: string; p_itens: Json }
        Returns: string
      }
      programador_editar_comunicado: {
        Args: { p_company_id: string; p_comunicado_id: string; p_revisao: number; p_itens: Json }
        Returns: number
      }
      programador_observacoes_autorizado: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      programador_salvar_observacao: {
        Args: {
          p_company_id: string
          p_subject_id: string
          p_subject_type: string
          p_texto: string
        }
        Returns: Json
      }
      update_equipamentos_dashboard_lote: {
        Args: {
          p_ids: string[]
          p_local_atual?: string
          p_setor?: string
          p_status?: string
          p_valor_mensal?: number
          p_valor_mode?: string
        }
        Returns: {
          denied_count: number
          updated_count: number
        }[]
      }
      upsert_funcao_ativa: {
        Args: { p_company_id: string; p_nome: string }
        Returns: string
      }
      wf_custos_realizados_por_ogs: {
        Args: { p_company_id: string; p_ogs: string }
        Returns: {
          componente: string
          valor: number
        }[]
      }
      wf_encarregado_employee_for_user: {
        Args: { p_actor: string }
        Returns: string
      }
      wf_meu_encarregado: { Args: never; Returns: Json }
      wf_name_tokens: { Args: { p_text: string }; Returns: string[] }
      wf_nf_resumo_por_ogs: {
        Args: { p_company_id: string; p_ogs: string }
        Returns: {
          m3_concreto: number
          qtd_nf_concreto: number
          qtd_nf_massa: number
          ton_massa: number
        }[]
      }
      wf_norm_text: { Args: { v: string }; Returns: string }
      wf_normalize_name: { Args: { p_text: string }; Returns: string }
      wf_resolve_engenheiro_user_id: {
        Args: { p_company_id: string; p_engenheiro_nome: string }
        Returns: string
      }
      wf_validar_rdo_apontador: {
        Args: { p_acao: string; p_motivo?: string; p_rdo_id: string }
        Returns: string
      }
      wf_validar_rdo_encarregado: {
        Args: { p_acao: string; p_motivo?: string; p_rdo_id: string }
        Returns: string
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
