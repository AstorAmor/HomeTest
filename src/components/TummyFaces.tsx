import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { withAlpha } from '@/constants/colors';
import { MoodFace } from '@/components/checkin/MoodFaces';
import { FINE } from '@/theme/fine';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { onDataChange } from '@/data/dataEvents';
import { dayKey } from '@/data/bathroomRepository';
import { digestionRepository } from '@/data/digestionRepository';
import { DigestionEntry } from '@/types/digestion';
import { t } from '@/i18n';

// Cómo te sienta hoy, en la tarjeta de Digestión de Hoy: tres caras. La sonriente apunta «Hoy, bien»;
// las otras dos abren el registro de molestias (qué notas, cuánto y qué comiste antes). La de hoy queda
// marcada: la peor molestia del día (leve → la seria; moderada o fuerte → la de la boca en S).
// Con las caras a línea del check-in (2026-11-16): la de hoy, en jade si es «bien» y en oro si no; sin rojos
const FACES = [
  { level: 0, mood: 'happy', label: 'Good', color: FINE.jade },
  { level: 1, mood: 'neutral', label: 'A bit off', color: FINE.gold },
  { level: 2, mood: 'stressed', label: 'Discomfort', color: FINE.gold },
] as const;

const SOURCE = 'hometest:gut_symptom_logs';

const levelToday = (entries: DigestionEntry[]): number | null => {
  const today = entries.filter((e) => dayKey(new Date(e.fecha)) === dayKey(new Date()));
  if (!today.length) return null;
  const worst = Math.max(0, ...today.flatMap((e) => Object.values(e.symptoms ?? {}) as number[]));
  return worst >= 2 ? 2 : worst;
};

export const TummyFaces = () => {
  const router = useRouter();
  const [level, setLevel] = useState<number | null>(null);

  const load = useCallback(
    () =>
      digestionRepository
        .getAll()
        .then((all) => setLevel(levelToday(all)))
        .catch(() => setLevel(null)),
    [],
  );
  useReloadOnFocus(load);
  useEffect(() => onDataChange((s) => s === SOURCE && load()), [load]);

  const pick = async (face: number) => {
    if (face > 0) {
      router.push('/log-digestion');
      return;
    }
    setLevel((l) => l ?? 0);
    const now = new Date().toISOString();
    await digestionRepository.save({ id: `gut-ok-${Date.now()}`, kind: 'day_ok', fecha: now, createdAt: now }).catch(() => load());
  };

  return (
    <View style={styles.row}>
      {FACES.map((f) => {
        const on = level === f.level;
        return (
          <TouchableOpacity
            key={f.level}
            style={[styles.face, on && { backgroundColor: withAlpha(f.color, 0.12) }]}
            onPress={() => pick(f.level)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t(f.label)}
            accessibilityState={{ selected: on }}
          >
            <MoodFace mood={f.mood} size={28} color={on ? f.color : FINE.mute} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  face: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
