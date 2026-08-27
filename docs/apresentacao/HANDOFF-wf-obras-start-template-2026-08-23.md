# Handoff de Arranque — WF Obras (próxima sessão)

## Objetivo
Repetir o mesmo fluxo executado em WF Gestão de Pessoas:
1. Gerar HTML ilustrado em `docs/apresentacao/`
2. Publicar em link público Vercel
3. Validar `HTTP 200`
4. Entregar e-mail curto de primeiro acesso pronto para envio

## Padrão obrigatório
- Usar skill: `workflux-tutorial-publicacao-e-email-acesso`
- Mesmo padrão visual dos tutoriais anteriores (Frotas/Manutenção/Gestão de Pessoas):
  - hero azul
  - índice lateral
  - seção por tela com screenshot + checklist operacional
  - checklist final

## Referências desta linha de trabalho
- `docs/apresentacao/HANDOFF-wf-manutencao-2026-08-23.md`
- `docs/apresentacao/HANDOFF-wf-gestao-pessoas-2026-08-23.md`
- `docs/apresentacao/wf-gestao-pessoas-tutorial.html`
- `docs/apresentacao/wf-gestao-pessoas-email-primeiro-acesso.txt`

## Estrutura de entrega esperada para WF Obras
- `docs/apresentacao/wf-obras-tutorial.html`
- `docs/apresentacao/wf-obras-email-primeiro-acesso.txt`
- `docs/apresentacao/HANDOFF-wf-obras-<data>.md`
- Assets em `docs/apresentacao/assets/wf-obras-XX-<slug>.png`

## Publicação e validação
- Publicar via Vercel em `docs/apresentacao` com `--prod`
- URL final em alias público
- Validar com:
  - `curl -I <url-do-tutorial>` => HTTP 200
  - abertura no browser conferindo título + índice

## Observação operacional
Se houver complementos depois da 1ª versão, atualizar HTML, renumerar índice/seções, republicar e revalidar HTTP 200 no mesmo alias.
