---
version: alpha
name: Workflux Industrial
description: Gestão de campo para pavimentação e infraestrutura; uma identidade, dois ritmos.
colors:
  primary: "#155EEF"
  structure: "#102A43"
  text: "#172B3A"
  secondary: "#526477"
  surface: "#F4F6F8"
  white: "#FFFFFF"
  selected: "#EAF1FF"
  selected-text: "#1649AD"
  success: "#176247"
  danger: "#B42318"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 10px
  lg: 12px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 12px
  header:
    backgroundColor: "{colors.structure}"
    textColor: "{colors.white}"
  page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 16px
  secondary-label:
    backgroundColor: "{colors.white}"
    textColor: "{colors.secondary}"
  selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-text}"
  success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.white}"
  danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
---

## Overview

Direção aprovada: A para gestão + B para campo, na mesma identidade. Evolução conservadora, preservando Workflux, cadastros, permissões e navegação atual no primeiro lote.

Lote 1 implementado em branch isolada: tokens compartilhados, fonte Inter, redução de efeitos, apresentação da home e ícones de Relatórios. A/B descrevem o destino; sidebar gerencial, home por tarefas e vinculação automática por perfil NÃO fazem parte deste lote.

## Colors

Azul de ação #155EEF; azul profundo #102A43 para estrutura. Superfícies claras. Verde para confirmação e vermelho para erro; alertas âmbar sempre com texto. O token accent é seleção/hover azul-claro, não alerta.
Contrastes devem ser medidos por par efetivamente renderizado. Transparência, imagens e cores locais precisam de auditoria específica. A validação dos tokens não certifica todas as telas.

## Typography

Inter em corpo e títulos, com fallback system-ui. Campo: corpo 16–18 px e metadados pelo menos 14 px quando necessários para execução. Gestão: tabelas podem usar 14 px e densidade moderada. Um label nunca depende exclusivamente de placeholder.

## Layout

A: navegação estável, comparação, filtros e contexto; B: tarefa principal visível, alvos de toque 48–56 px e estados explícitos. A lista vertical da home permanece intacta neste lote. Manter Voltar com filtros, período e origem.

## Elevation & Depth

Bordas discretas e sombras leves. Eliminar brilho e flutuação decorativa. Reservar sombra forte a elementos realmente sobrepostos, como diálogo e menu.

## Shapes

Raio padrão de 10 px; cards 12 px. Ícones Lucide, 20–24 px, traço consistente e rótulo textual. Não usar emojis como identidade de módulos.

## Components

Uma ação principal por contexto. Checklist e diário independentes; Controle de Carga e Lançar Abastecimento separados. Não alterar guards/RBAC em trabalho visual. A conversão de todos os componentes para alvos maiores é fase posterior, não mudança global cega.

## Do's and Don'ts

- Preservar o nome e o arquivo de logo neste lote; marca vetorial final é trabalho separado.
- Não mudar rotas, contratos de dados, fórmulas ou módulos neste lote.
- Não publicar sem preview e homologação com perfis reais.
- Não chamar build local sem variáveis produtivas de pacote pronto para deploy.
- No site, usar a mesma base visual com mais fotografia e espaço; não levar animações do marketing para formulários de campo.
- Vídeo: cenas ilustrativas geradas por IA + telas reais compostas na edição. Nunca prometer telemetria ou offline não homologados. Uso seguro de dispositivos e EPIs coerentes.
