import { describe, expect, it } from 'vitest';
import { syntheticPatients, syntheticRequests } from '../demoPatients';

describe('pacientes de ejemplo del portal', () => {
  it('se añaden a los 4 fijos y salen siempre iguales', () => {
    expect(syntheticPatients(4)).toHaveLength(0);
    expect(syntheticPatients(12)).toHaveLength(8);
    expect(syntheticPatients(40).map((p) => p.name)).toEqual(syntheticPatients(40).map((p) => p.name));
    expect(syntheticPatients(12).map((p) => p.id)).toEqual(syntheticPatients(40).slice(0, 8).map((p) => p.id));
  });

  it('comparten cosas distintas, como en la realidad (todo, algo, nada, caducado, retirado)', () => {
    const ps = syntheticPatients(40);
    const states = new Set(ps.map((p) => p.shareState));
    expect(states).toEqual(new Set(['active', 'none', 'expired', 'revoked']));
    expect(ps.some((p) => p.scopes.length === 11)).toBe(true); // una mujer que lo comparte todo
    expect(ps.some((p) => p.scopes.length === 1 && p.scopes[0] === 'lab_reports')).toBe(true);
    // Sin permiso activo no hay nada compartido
    for (const p of ps) if (p.shareState !== 'active') expect(p.scopes).toEqual([]);
  });

  it('el ciclo solo lo comparten mujeres', () => {
    for (const p of syntheticPatients(40)) if (p.scopes.includes('cycle')) expect(p.sex).toBe('Female');
  });

  it('una duda de cada tres, nunca de quien retiró el permiso', () => {
    const ps = syntheticPatients(40);
    const rs = syntheticRequests(ps, 'demo-pro');
    expect(rs.length).toBeGreaterThan(5);
    for (const r of rs) expect(ps.find((p) => p.id === r.patientId)?.shareState).not.toBe('revoked');
  });
});
