import { describe, expect, it } from 'vitest';

// Un archivo con versión de plataforma (x.ios.ts, x.web.tsx…) no puede importar './x' con valor: Metro
// resuelve './x' al propio archivo en esa plataforma. Un `export { A } from './x'` se convierte en un
// getter que se lee a sí mismo sin fin, y en iPhone cerraba la app al abrir Wearables (2026-11-02).
// Los `import type` / `export type` se borran al compilar, así que esos sí valen.

// El tsconfig de la app no carga los tipos de Node (TypeScript 6: types = []); lo justo para esta prueba
declare const __dirname: string;
type Fs = {
  readdirSync(p: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(p: string, enc: 'utf8'): string;
};
type Path = {
  join(...p: string[]): string;
  resolve(...p: string[]): string;
  dirname(p: string): string;
  relative(from: string, to: string): string;
};
const fs: Fs = await import('node:fs' as string);
const path: Path = await import('node:path' as string);

const SRC = path.resolve(__dirname, '..');
const PLATFORM = /\.(ios|android|web|native)\.tsx?$/;

function platformFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return platformFiles(p);
    return PLATFORM.test(e.name) ? [p] : [];
  });
}

// Lo que importa con valor: import/export … from '…', require('…') e import('…')
function valueSpecifiers(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?:^|[;\n])\s*(import|export)\b([^;]*?)\bfrom\s*['"]([^'"]+)['"]/g)) {
    if (!/^\s*type\b/.test(m[2])) out.push(m[3]);
  }
  for (const m of code.matchAll(/\b(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
  return out;
}

const resolveSpec = (file: string, spec: string) =>
  spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;

describe('Archivos con versión de plataforma', () => {
  const files = platformFiles(SRC);

  it('existen (si no, la prueba no mira nada)', () => {
    expect(files.some((f) => f.endsWith(path.join('providers', 'appleHealth.ios.ts')))).toBe(true);
  });

  it('ninguno importa con valor su propio nombre base', () => {
    const bad: string[] = [];
    for (const f of files) {
      const self = f.replace(PLATFORM, '');
      for (const spec of valueSpecifiers(fs.readFileSync(f, 'utf8'))) {
        if (resolveSpec(f, spec) === self) bad.push(`${path.relative(SRC, f)} → '${spec}'`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('la prueba detecta el caso que cerraba la app en iPhone', () => {
    const f = path.join(SRC, 'wearables', 'providers', 'appleHealth.ios.ts');
    const self = f.replace(PLATFORM, '');
    const specs = valueSpecifiers("import type { A } from './appleHealth';\nexport { B, C } from './appleHealth';\n");
    expect(specs.map((s) => resolveSpec(f, s))).toEqual([self]);
  });
});
