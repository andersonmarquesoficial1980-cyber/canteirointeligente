import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), sign: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: mocks.session }, storage: { from: mocks.from },
} }));
import { resolveStorageUrl } from './storageAccess';
const origin = import.meta.env.VITE_SUPABASE_URL;
describe('abertura de anexos privados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } });
    mocks.sign.mockResolvedValue({ data: { signedUrl: `${origin}/storage/v1/object/sign/sst-fotos/test.jpg?token=short` }, error: null });
    mocks.from.mockReturnValue({ createSignedUrl: mocks.sign });
  });
  it('nega acesso sem sessão, mesmo com token antigo na referência', async () => {
    mocks.session.mockResolvedValue({ data: { session: null } });
    await expect(resolveStorageUrl(`${origin}/storage/v1/object/sign/face-photos/x.jpg?token=old`)).rejects.toThrow('Entre novamente');
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('renova referências assinadas antigas sem reaproveitar o token anual', async () => {
    await resolveStorageUrl(`${origin}/storage/v1/object/sign/notas_fiscais/x.jpg?token=old`);
    expect(mocks.sign).toHaveBeenCalledWith('x.jpg', 300);
  });
  it('respeita negação do servidor sem fallback público', async () => {
    mocks.sign.mockResolvedValue({ data: null, error: { message: 'denied' } });
    await expect(resolveStorageUrl(`${origin}/storage/v1/object/public/sst-fotos/x.jpg`)).rejects.toThrow('autorizar');
  });
  it('descarta resposta se a conta mudar durante a autorização', async () => {
    mocks.session.mockResolvedValueOnce({ data: { session: { user: { id: 'a' } } } })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'b' } } } });
    await expect(resolveStorageUrl(`${origin}/storage/v1/object/public/sst-fotos/x.jpg`)).rejects.toThrow('sessão mudou');
  });
  it.each(['data:image/png;base64,abc', 'blob:https://app.test/id', 'https://other.test/storage/v1/object/public/sst-fotos/x.jpg'])('não envia URLs externas/locais ao storage: %s', async (url) => {
    expect(await resolveStorageUrl(url)).toBe(url);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('converte referência pública legada em acesso temporário autorizado', async () => {
    const result = await resolveStorageUrl(`${origin}/storage/v1/object/public/sst-fotos/pasta/foto%20obra.jpg`);
    expect(mocks.from).toHaveBeenCalledWith('sst-fotos');
    expect(mocks.sign).toHaveBeenCalledWith('pasta/foto obra.jpg', 300);
    expect(result).toContain('token=short');
  });
});
