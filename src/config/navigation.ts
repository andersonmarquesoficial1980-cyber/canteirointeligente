// @UI-LOCK: MANDATORY MODULES AND VERTICAL LAYOUT. DO NOT ALTER THIS STRUCTURE.
// STATIC_UI_LOCK: MANDATORY MODULES — NEVER remove items or alter order.
// This file is the single source of truth for HUB navigation.
// It is intentionally decoupled from any database or Edge Function logic.

import { ClipboardList, Cog, Truck, Users, ShieldCheck } from "lucide-react";

export const HUB_MODULES = [
  { id: "obras", label: "CI Obras", subtitle: "Diário de Obras", icon: ClipboardList, route: "/obras", adminOnly: false },
  { id: "equipamentos", label: "CI Equipamentos", subtitle: "Gestão de Equipamentos", icon: Cog, route: "/equipamentos", adminOnly: false },
  { id: "carreteiros", label: "CI Carreteiros", subtitle: "Logística de Materiais", icon: Truck, route: "/carreteiros", adminOnly: false },
  { id: "rh", label: "CI RH", subtitle: "Gestão de Pessoas", icon: Users, route: "/rh", adminOnly: false },
  { id: "admin", label: "Painel de Controle", subtitle: "Dashboards e Gestão", icon: ShieldCheck, route: "/admin/configuracoes", adminOnly: true },
] as const;
