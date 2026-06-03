// @UI-LOCK: MANDATORY MODULES AND VERTICAL LAYOUT. DO NOT ALTER THIS STRUCTURE.
// STATIC_UI_LOCK: MANDATORY MODULES — NEVER remove items or alter order.
// This file is the single source of truth for HUB navigation.
// It is intentionally decoupled from any database or Edge Function logic.

import { ClipboardList, Cog, Truck, Users, ShieldCheck, ListChecks, CalendarClock, FileCheck, Wrench, Fuel, BarChart3, LayoutDashboard, Car, UserCheck, Receipt, HardHat } from "lucide-react";

export const HUB_MODULES = [
  { id: "obras", label: "WF Obras", subtitle: "Diário de Obras", icon: ClipboardList, route: "/obras", adminOnly: false },
  { id: "equipamentos", label: "WF Equipamentos", subtitle: "Gestão de Equipamentos", icon: Cog, route: "/equipamentos", adminOnly: false },
  { id: "carreteiros", label: "WF Carreteiros", subtitle: "Logística de Materiais", icon: Truck, route: "/carreteiros", adminOnly: false },
  // rh: unificado em gestao-pessoas (ver /rh redirect no App.tsx)
  { id: "programador", label: "WF Programador", subtitle: "Equipes e Movimentações", icon: CalendarClock, route: "/programador", adminOnly: false },
  { id: "demandas", label: "WF Demandas", subtitle: "Gestão de Tarefas", icon: ListChecks, route: "/demandas", adminOnly: false },
  { id: "documentos", label: "WF Documentos", subtitle: "Documentos com IA", icon: FileCheck, route: "/documentos", adminOnly: false },
  { id: "manutencao", label: "WF Manutenção", subtitle: "OS & Documentos de Frotas", icon: Wrench, route: "/manutencao", adminOnly: false },
  { id: "abastecimento", label: "WF Abastecimento", subtitle: "Comboio, Posto e Shelbox", icon: Fuel, route: "/abastecimento", adminOnly: false },
  { id: "relatorios", label: "WF Relatórios", subtitle: "Relatórios por Equipamento", icon: BarChart3, route: "/relatorios", adminOnly: false },
  { id: "gestao-frotas", label: "WF Gestão de Frotas", subtitle: "Veículos, máquinas e documentos", icon: Car, route: "/gestao-frotas", adminOnly: false },
  { id: "gestao-pessoas", label: "WF Gestão de Pessoas", subtitle: "Pessoas, ponto, VT e histórico", icon: UserCheck, route: "/gestao-pessoas", adminOnly: false },
  { id: "suprimentos", label: "WF Suprimentos", subtitle: "Fretes, Peças e Estoque", icon: Truck, route: "/suprimentos", adminOnly: false },
  { id: "medicoes", label: "WF Medições", subtitle: "Equipamentos terceirizados", icon: Receipt, route: "/medicoes", adminOnly: false },
  { id: "sst", label: "WF Segurança do Trabalho", subtitle: "Inspeções e checklists SST", icon: HardHat, route: "/sst", adminOnly: false },
  { id: "engenharia", label: "WF Engenharia", subtitle: "RDO Técnico e Validações", icon: HardHat, route: "/engenharia", adminOnly: false },
  { id: "admin", label: "Painel de Controle", subtitle: "Dashboards e Gestão", icon: ShieldCheck, route: "/admin/configuracoes", adminOnly: true },
] as const;
