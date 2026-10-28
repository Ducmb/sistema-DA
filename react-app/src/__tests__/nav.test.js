import { describe, expect, test } from 'vitest';
import { homePath, menu, searchScreens } from '../lib/nav.js';

const canOf = (mods) => (m) => mods.includes(m);

describe('navegação por perfil', () => {
  test('menu só mostra módulos permitidos (o servidor valida com 403)', () => {
    const items = menu(canOf(['dashboard', 'perfil', 'patrimonio'])).flatMap((g) => g.items.map((i) => i.path));
    expect(items).toContain('/patrimonio');
    expect(items).not.toContain('/compras');
  });
  test('Visualizador entra direto em Analytics', () => {
    expect(homePath(canOf(['analytics', 'perfil']))).toBe('/analytics');
    expect(homePath(canOf(['dashboard', 'analytics']))).toBe('/painel');
  });
  test('busca global ignora acentos e respeita o acesso', () => {
    const r = searchScreens('moções', canOf(['mocoes'])).map((s) => s.path);
    expect(r).toContain('/mocoes');
    expect(searchScreens('compras', canOf(['mocoes']))).toHaveLength(0);
  });
});

import { safePath } from '../lib/nav.js';
describe('redirecionamento seguro', () => {
  test('aceita só caminhos internos conhecidos', () => {
    expect(safePath('/compras?tab=contratos')).toBe('/compras?tab=contratos');
    expect(safePath('//evil.com')).toBeNull();
    expect(safePath('/\\evil.com')).toBeNull();
    expect(safePath('https://evil.com')).toBeNull();
    expect(safePath('javascript:alert(1)')).toBeNull();
    expect(safePath('/nao-existe')).toBeNull();
  });
});
