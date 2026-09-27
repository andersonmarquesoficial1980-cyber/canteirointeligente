import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), auth: { callback: null as any } }));
vi.mock('@/lib/storageAccess', () => ({
  getStorageReference: (v: string) => v?.startsWith('private:') ? { bucket: 'sst-fotos', path: 'x' } : null,
  resolveStorageUrl: mocks.resolve,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  onAuthStateChange: (cb: any) => { mocks.auth.callback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
} } }));
import { StorageImage, StorageLink } from './StorageMedia';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('anexos na tela', () => {
  it('não envia referência privada ao navegador antes de autorizar e limpa ao sair', async () => {
    let finish!: (v: string) => void;
    mocks.resolve.mockReturnValue(new Promise<string>(r => { finish = r; }));
    render(<StorageImage src="private:one" alt="Inspeção" />);
    expect(screen.getByAltText('Inspeção').getAttribute('src')).toBeNull();
    await act(async () => { finish('https://example.test/signed'); });
    expect(screen.getByAltText('Inspeção').getAttribute('src')).toBe('https://example.test/signed');
    act(() => mocks.auth.callback('SIGNED_OUT', null));
    expect(screen.getByAltText('Inspeção').getAttribute('src')).toBeNull();
  });
  it('link negado não retorna à URL pública como fallback', async () => {
    mocks.resolve.mockRejectedValue(new Error('Sem acesso'));
    render(<StorageLink href="private:denied">Documento</StorageLink>);
    await waitFor(() => expect(screen.getByText('Documento').getAttribute('title')).toBe('Sem acesso'));
    expect(screen.getByText('Documento').getAttribute('href')).toBeNull();
  });
  it('preserva fotos locais e links externos sem assinar', () => {
    render(<><StorageImage src="data:image/png;base64,abc" alt="Local" /><StorageLink href="https://maps.google.com">Mapa</StorageLink></>);
    expect(screen.getByAltText('Local').getAttribute('src')).toBe('data:image/png;base64,abc');
    expect(screen.getByText('Mapa').getAttribute('href')).toBe('https://maps.google.com');
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
