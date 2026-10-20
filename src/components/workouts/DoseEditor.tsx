import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { WheelPicker } from '@/components/WheelPicker';
import type { WorkoutExercise } from '@/data/workouts/types';
import { isTimedReps, timedSeconds, timeText } from '@/logic/workoutTimer';
import { t } from '@/i18n';

// Cambiar un ejercicio de la sesión: series, por repeticiones o por tiempo, y el descanso. Con ruedas,
// como el resto de la app. Si no se toca la rueda de repeticiones se queda el rango que había ("10–12").

const SETS = Array.from({ length: 10 }, (_, i) => i + 1);
const REPS = Array.from({ length: 50 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 21 }, (_, i) => i);
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5);
const RESTS = Array.from({ length: 21 }, (_, i) => i * 15); // 0 a 5 min de 15 en 15

const restLabel = (sec: number) => (sec === 0 ? t('No rest') : timeText(sec));

const nearest = (list: number[], v: number) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0);

export const DoseEditor = ({
  item,
  perSide,
  onSave,
  onCancel,
}: {
  item: WorkoutExercise;
  perSide?: boolean;
  onSave: (change: Pick<WorkoutExercise, 'sets' | 'reps' | 'restSec'>) => void;
  onCancel: () => void;
}) => {
  const wasTimed = isTimedReps(item.reps);
  const [mode, setMode] = useState<'reps' | 'time'>(wasTimed ? 'time' : 'reps');
  const [sets, setSets] = useState(nearest(SETS, item.sets));
  const firstNumber = Number(item.reps.match(/\d+/)?.[0] ?? 10);
  const [reps, setReps] = useState<number | null>(null); // null = sin tocar (se queda el texto de antes)
  const secs = wasTimed ? timedSeconds(item.reps) : 30;
  const [min, setMin] = useState(nearest(MINUTES, Math.floor(secs / 60)));
  const [sec, setSec] = useState(nearest(SECONDS, secs % 60));
  const [rest, setRest] = useState(nearest(RESTS, item.restSec));

  const seconds = MINUTES[min] * 60 + SECONDS[sec];
  const save = () =>
    onSave({
      sets: SETS[sets],
      reps:
        mode === 'time'
          ? timeText(Math.max(5, seconds))
          : reps !== null
            ? String(REPS[reps])
            : wasTimed
              ? '10'
              : item.reps,
      restSec: RESTS[rest],
    });

  return (
    <View>
      <Text style={styles.label}>{t('Sets')}</Text>
      <View style={styles.wheels}>
        <WheelPicker items={SETS.map(String)} selectedIndex={sets} onChange={setSets} width={72} />
      </View>

      <Text style={styles.label}>{t('How you do it')}</Text>
      <ChoiceChips
        options={[
          { id: 'reps' as const, label: t('By reps') },
          { id: 'time' as const, label: t('By time') },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'reps' ? (
        <View style={styles.wheels}>
          <WheelPicker
            key="reps"
            items={REPS.map(String)}
            selectedIndex={reps ?? nearest(REPS, firstNumber)}
            onChange={setReps}
            width={72}
          />
          <Text style={styles.unit}>
            {t('reps')}
            {perSide ? ` ${t('per side')}` : ''}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.wheels}>
            <WheelPicker key="min" items={MINUTES.map(String)} selectedIndex={min} onChange={setMin} width={64} />
            <Text style={styles.unit}>min</Text>
            <WheelPicker key="sec" items={SECONDS.map((s) => String(s).padStart(2, '0'))} selectedIndex={sec} onChange={setSec} width={64} />
            <Text style={styles.unit}>s</Text>
          </View>
          <Text style={styles.hint}>
            {perSide ? t('Per side. The bell rings when you switch sides and at the end.') : t('The bell rings when the time is up.')}
          </Text>
        </>
      )}

      <Text style={styles.label}>{t('Rest after each set')}</Text>
      <View style={styles.wheels}>
        <WheelPicker items={RESTS.map(restLabel)} selectedIndex={rest} onChange={setRest} width={150} />
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.secondary} onPress={onCancel}>
          <Text style={styles.secondaryText}>{t('Cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={save}>
          <Text style={styles.primaryText}>{t('Save')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  unit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  hint: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 6 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 22 },
  primary: { flex: 1, alignItems: 'center', backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondary: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 13 },
  secondaryText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
