import { describe, expect, it } from 'vitest';
import { checkInSavedRecently, clearCheckInSaved, noteCheckInSaved } from '@/logic/checkInCelebration';
import { MOOD_OPTIONS, MOOD_PICKER } from '@/types/checkIn';

describe('Celebrar los 3 check-ins', () => {
  it('solo justo después de guardar uno, y una vez', () => {
    clearCheckInSaved();
    expect(checkInSavedRecently(1_000_000)).toBe(false); // abrir la app con los 3 hechos: nada
    noteCheckInSaved(1_000_000);
    expect(checkInSavedRecently(1_000_000 + 5_000)).toBe(true);
    expect(checkInSavedRecently(1_000_000 + 3 * 60_000)).toBe(false); // mucho después, ya no
    clearCheckInSaved();
    expect(checkInSavedRecently(1_000_000 + 5_000)).toBe(false);
  });
});

describe('Estados de ánimo', () => {
  it('Acelerado se elige; Desmotivado ya no, pero los guardados se siguen viendo', () => {
    const ids = MOOD_PICKER.map((m) => m.id);
    expect(ids).toContain('wired');
    expect(ids).not.toContain('unmotivated');
    expect(MOOD_OPTIONS.find((m) => m.id === 'unmotivated')?.emoji).toBe('😞');
    expect(MOOD_OPTIONS.find((m) => m.id === 'wired')?.emoji).toBe('😬');
  });
});
