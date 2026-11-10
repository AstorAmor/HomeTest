import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}));
vi.mock('@/lib/supabase', () => ({ getCurrentUserId: () => 'u1', isRemoteActive: () => false, supabase: null }));
vi.mock('@/hooks/useReloadOnFocus', () => ({ useReloadOnFocus: () => undefined }));

// Modo gratis y códigos (fundador, 2026-11-06): quien recibe la app entra gratis; Entrenamientos, escanear
// informes y el menú semanal llevan candado hasta que el fundador le mande un código (o se suscriba).
describe('Modo gratis', () => {
  it('en gratis, con candado: escanear informes, menú semanal y Entrenamientos', async () => {
    const { DEFAULT_PLAN_FEATURES, GATED_FEATURES, featureValue, isIncluded } = await import('@/data/access');
    expect(Object.keys(GATED_FEATURES).sort()).toEqual(['diet_menu', 'scan_reports', 'workouts']);
    for (const f of Object.keys(GATED_FEATURES)) {
      expect(isIncluded(featureValue(DEFAULT_PLAN_FEATURES, f, 'free'))).toBe(false);
      expect(isIncluded(featureValue(DEFAULT_PLAN_FEATURES, f, 'membership'))).toBe(true);
      expect(isIncluded(featureValue(DEFAULT_PLAN_FEATURES, f, 'premium'))).toBe(true);
    }
    // El seguimiento diario y el plan, abiertos en gratis
    expect(isIncluded(featureValue(DEFAULT_PLAN_FEATURES, 'tracking', 'free'))).toBe(true);
    expect(isIncluded(featureValue(DEFAULT_PLAN_FEATURES, 'plan', 'free'))).toBe(true);
  });

  it('si el admin guardó la tabla antes de existir la fila de Entrenamientos, en gratis sigue con candado', async () => {
    const { DEFAULT_PLAN_FEATURES, featureValue, isIncluded } = await import('@/data/access');
    const old = DEFAULT_PLAN_FEATURES.filter((r) => r.id !== 'workouts');
    expect(isIncluded(featureValue(old, 'workouts', 'free'))).toBe(false);
    expect(isIncluded(featureValue(old, 'workouts', 'membership'))).toBe(true);
  });

  it('sin cuenta (la demo), todo abierto', async () => {
    const { canUse } = await import('@/data/access');
    expect(await canUse('workouts')).toBe(true);
  });

  it('las cinco pantallas de Entrenamientos pasan por el candado', async () => {
    const fs = (await import('node:fs' as string)) as { readFileSync: (p: string, enc: 'utf8') => string };
    for (const r of ['workouts', 'workout-new', 'workout-session', 'workout-custom', 'workout-history'])
      expect(fs.readFileSync(`src/app/${r}.tsx`, 'utf8')).toMatch(/export default gated\('workouts', \w+\);/);
  });

  it('en español', async () => {
    const { es } = await import('@/i18n/es');
    const { workoutsEs } = await import('@/i18n/workoutsEs');
    const ES: Record<string, string> = { ...workoutsEs, ...es };
    const texts = [
      'Workouts',
      'Workouts come with a subscription',
      'Your training plan made for you, each session guided step by step, and the log of everything you do.',
      'See subscriptions',
      'Comes with a subscription',
    ];
    expect(texts.filter((x) => !(x in ES))).toEqual([]);
  });
});
