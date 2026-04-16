// @UI-LOCK: MANDATORY MODULES AND VERTICAL LAYOUT. DO NOT ALTER THIS STRUCTURE.
// STATIC_UI_LOCK: MANDATORY MODULES — NEVER remove items or alter order.
// This file is the single source of truth for HUB navigation.
// It is intentionally decoupled from any database or Edge Function logic.

import { ClipboardList, Cog, Truck, Users, ShieldCheck, ListChecks, CalendarClock, FileCheck, Wrench, Fuel, BarChart3 } from "lucide-react";

export const HUB_MODULES = [
  { id: "obras", label: "WF Obras", subtitle: "Diário de Obras", icon: ClipboardList, route: "/obras", adminOnly: false },
  { id: "equipamentos", label: "WF Equipamentos", subtitle: "Gestão de Equipamentos", icon: Cog, route: "/equipamentos", adminOnly: false },
  { id: "carreteiros", label: "WF Carreteiros", subtitle: "Logística de Materiais", icon: Truck, route: "/carreteiros", adminOnly: false },
  { id: "rh", label: "WF RH", subtitle: "Gestão de Pessoas", icon: Users, route: "/rh", adminOnly: false },
  { id: "programador", label: "WF Programador", subtitle: "Equipes e Movimentações", icon: CalendarClock, route: "/programador", adminOnly: false },
  { id: "demandas", label: "WF Demandas", subtitle: "Gestão de Tarefas", icon: ListChecks, route: "/demandas", adminOnly: false },
  { id: "documentos", label: "WF Documentos", subtitle: "Documentos com IA", icon: FileCheck, route: "/documentos", adminOnly: false },
  { id: "manutencao", label: "WF Manutenção", subtitle: "OS & Documentos de Frotas", icon: Wrench, route: "/manutencao", adminOnly: false },
  { id: "abastecimento", label: "WF Abastecimento", subtitle: "Comboio, Posto e Shelbox", icon: Fuel, route: "/abastecimento", adminOnly: false },
  { id: "relatorios", label: "WF Relatórios", subtitle: "Relatórios por Equipamento", icon: BarChart3, route: "/relatorios", adminOnly: false },
  { id: "admin", label: "Painel de Controle", subtitle: "Dashboards e Gestão", icon: ShieldCheck, route: "/admin/configuracoes", adminOnly: true },
] as const;
