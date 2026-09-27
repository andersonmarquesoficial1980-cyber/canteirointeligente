import { describe, expect, it } from 'vitest';
import { isScheduledExport } from '../../supabase/functions/export-nf-massa-gdrive/auth';
describe('exportação agendada protegida', () => {
  it('não aceita ausência de segredo na configuração', () => {
    expect(isScheduledExport(new Request('https://example.test'), '')).toBe(false);
  });
  it('rejeita requisição anônima e chave errada', () => {
    expect(isScheduledExport(new Request('https://example.test'), 'expected')).toBe(false);
    expect(isScheduledExport(new Request('https://example.test', { headers: { 'x-workflux-export-secret': 'wrong' } }), 'expected')).toBe(false);
  });
  it('aceita somente o segredo configurado para o agendador', () => {
    expect(isScheduledExport(new Request('https://example.test', { headers: { 'x-workflux-export-secret': 'expected' } }), 'expected')).toBe(true);
  });
});
