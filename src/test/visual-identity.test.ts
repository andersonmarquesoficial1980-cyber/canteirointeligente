import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
function token(name: string) {
  const raw = css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];
  if (!raw) throw new Error(`Token ausente: ${name}`);
  const [h, s, l] = raw.trim().split(/\s+/).map(parseFloat);
  const sat = s / 100; const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => { const k = (n + h / 30) % 12; return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [channel(0), channel(8), channel(4)];
}
function luminance(rgb: number[]) {
  return rgb.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((s,x,i) => s+x*[0.2126,0.7152,0.0722][i],0);
}
function contrast(a: string, b: string) {
  const [dark,light] = [luminance(token(a)),luminance(token(b))].sort((a,b)=>a-b);
  return (light+0.05)/(dark+0.05);
}

describe('Identidade visual conservadora — legibilidade dos tokens', () => {
  it('usa Inter em títulos e corpo, com cabeçalho sóbrio sem degradê', () => {
    const config = readFileSync(path.resolve(process.cwd(), 'tailwind.config.ts'), 'utf8');
    expect(config).toContain("display: ['Inter'");
    expect(css).not.toContain('family=Montserrat');
    const headerRule = css.match(/\.bg-header-gradient\s*\{([^}]+)\}/)?.[1];
    expect(headerRule).not.toContain('linear-gradient');
  });
  it.each([
    ['primary','primary-foreground'], ['destructive','destructive-foreground'],
    ['success','success-foreground'], ['background','foreground'],
    ['muted','muted-foreground'], ['accent','accent-foreground'],
    ['sidebar-primary','sidebar-primary-foreground'],
  ])('%s / %s tem contraste AA para texto normal', (background, foreground) => {
    expect(contrast(background, foreground)).toBeGreaterThanOrEqual(4.5);
  });
});
