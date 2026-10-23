import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { exerciseName } from '@/data/workouts/catalog';
import { doseText } from '@/data/workouts/labels';
import type { CatalogExercise, SetLog, WorkoutExercise } from '@/data/workouts/types';
import { timeText } from '@/logic/workoutTimer';
import type { SetRow } from '@/logic/workoutLog';
import { ExerciseLoop } from './ExerciseLoop';
import { SetTable } from './SetTable';
import { t } from '@/i18n';

// Un ejercicio en la sesión, como en Hevy: miniatura redonda y nombre (tocar = cómo se hace), lo que
// pide la rutina, el descanso de este ejercicio (se cambia aquí, solo para hoy), la papelera (quitarlo de
// la sesión de hoy) y su tabla de series.
// Memo: el reloj y la cuenta atrás no lo vuelven a pintar; solo cambia el ejercicio que se toca.

export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 180];

export type BlockActions = {
  open: (exerciseId: string) => void;
  change: (item: number, row: number, patch: Partial<SetRow>) => void;
  check: (item: number, row: number) => void;
  startTimer: (item: number, row: number) => void;
  addSet: (item: number) => void;
  removeSet: (item: number, row: number) => void;
  toggleRestMenu: (item: number) => void;
  setRest: (item: number, sec: number) => void;
  remove: (item: number) => void;
};

const restLabel = (sec: number) => (sec ? t('Rest: {time}', { time: timeText(sec) }) : t('Rest: off'));

export const ExerciseBlock = memo(function ExerciseBlock({
  index,
  item,
  ex,
  rows,
  last,
  timer,
  restOpen,
  actions,
}: {
  index: number;
  item: WorkoutExercise;
  ex: CatalogExercise;
  rows: SetRow[];
  last?: SetLog[];
  timer: { row: number; left: number } | null;
  restOpen: boolean;
  actions: BlockActions;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => actions.open(ex.id)} accessibilityLabel={exerciseName(ex)}>
          <ExerciseLoop exercise={ex} size={46} radius={23} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => actions.open(ex.id)}>
          <Text style={styles.name} numberOfLines={2}>
            {exerciseName(ex)}
          </Text>
          <Text style={styles.target}>{t('Target: {dose}', { dose: doseText(item) })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => actions.remove(index)} hitSlop={10} accessibilityLabel={t('Remove {name} from this session', { name: exerciseName(ex) })}>
          <Ionicons name="trash-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, restOpen && styles.chipOn]} onPress={() => actions.toggleRestMenu(index)} accessibilityState={{ expanded: restOpen }}>
          <Ionicons name="timer-outline" size={16} color={Colors.textPrimary} />
          <Text style={styles.chipText}>{restLabel(item.restSec)}</Text>
        </TouchableOpacity>
      </View>
      {restOpen && (
        <View style={styles.restMenu}>
          {REST_OPTIONS.map((sec) => {
            const on = item.restSec === sec;
            return (
              <TouchableOpacity key={sec} style={[styles.option, on && styles.chipOn]} onPress={() => actions.setRest(index, sec)}>
                <Text style={[styles.optionText, on && { color: Colors.textPrimary }]}>{sec ? timeText(sec) : t('No rest')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {item.note ? <Text style={styles.note}>“{item.note}”</Text> : null}
      <SetTable
        item={item}
        ex={ex}
        rows={rows}
        last={last}
        timer={timer}
        onChange={(j, patch) => actions.change(index, j, patch)}
        onCheck={(j) => actions.check(index, j)}
        onStartTimer={(j) => actions.startTimer(index, j)}
        onAddSet={() => actions.addSet(index)}
        onRemoveSet={(j) => actions.removeSet(index, j)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  block: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: Colors.accent, fontSize: 17, fontWeight: '800' },
  target: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  restMenu: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  optionText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  note: { color: Colors.textPrimary, fontSize: 13, fontStyle: 'italic' },
});
