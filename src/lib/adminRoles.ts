export const ADMIN_PERMISSION_ACTIONS = [
  { key: "view", label: "👁️ Ver" },
  { key: "create", label: "✏️ Criar" },
  { key: "edit", label: "📝 Editar" },
  { key: "delete", label: "🗑️ Excluir" },
  { key: "approve", label: "✅ Liberar/Aprovar" },
  { key: "manage", label: "⚙️ Gerenciar (total da seção)" },
] as const;

export const ADMIN_PANEL_SECTIONS = [
  "assinatura",
  "dashboard",
  "usuarios",
  "permissoes",
  "ogs",
  "materiais",
  "maquinas",
  "tipos_equipamento",
  "caminhoes",
  "funcionarios",
  "equipes",
  "centros_custo",
  "encarregados",
  "engenheiros",
  "tipos_servico",
  "empresas_parceiras",
  "funcoes",
  "fornecedores",
  "terceirizados",
  "destinos",
  "emails",
  "sst",
  "notificacoes",
  "destinatarios_notif",
  "desbloquear",
  "tarifas_vt",
  "lixeira",
  "auditoria",
  "operadores_habilitados",
  "roles",
  "engenheiros_ogs",
  "encarregados_ogs",
  "abastecimento_config",
] as const;

export type AdminPanelSection = (typeof ADMIN_PANEL_SECTIONS)[number];

export const ADMIN_PANEL_SECTION_LABELS: Record<AdminPanelSection, string> = {
  assinatura: "Assinatura",
  dashboard: "Dashboard",
  usuarios: "Usuários",
  permissoes: "Permissões",
  ogs: "OGS / Obras",
  materiais: "Materiais",
  maquinas: "Frota (Equipamentos)",
  tipos_equipamento: "Tipos de Equipamento",
  caminhoes: "Frota (Carreteiros)",
  funcionarios: "Funcionários",
  equipes: "Equipes",
  centros_custo: "Centros de Custo",
  encarregados: "Encarregados de Obra",
  engenheiros: "Engenheiros de Obra",
  tipos_servico: "Tipos de Serviço",
  empresas_parceiras: "Empresas Parceiras",
  funcoes: "Funções",
  fornecedores: "Fornecedores",
  terceirizados: "Terceirizados",
  destinos: "Destinos (Carreteiro)",
  emails: "E-mails",
  sst: "SST Responsáveis",
  notificacoes: "Notificações",
  destinatarios_notif: "Destinatários Push",
  desbloquear: "Desbloquear Lançamentos",
  tarifas_vt: "Tarifas de VT",
  lixeira: "Lixeira (30 dias)",
  auditoria: "Log de Auditoria",
  operadores_habilitados: "Operadores Habilitados",
  roles: "Admin Roles",
  engenheiros_ogs: "Engenheiros por OGS",
  encarregados_ogs: "Encarregados por OGS",
  abastecimento_config: "Configurações de Abastecimento",
};

export const adminSectionResource = (section: string) => `admin_section.${section}`;

export const isAdminSectionResource = (resource: string) =>
  resource.startsWith("admin_section.");

export const sectionFromResource = (resource: string) =>
  resource.replace("admin_section.", "");

export const adminSectionLabel = (section: string) =>
  ADMIN_PANEL_SECTION_LABELS[section as AdminPanelSection] || section;
