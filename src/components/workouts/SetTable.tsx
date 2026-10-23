import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { isLoadable } from '@/data/workouts/catalog';
import { setText } from '@/data/workouts/labels';
import type { CatalogExercise, SetLog, WorkoutExercise } from '@/data/workouts/types';
import { isTimedReps } from '@/logic/workoutTimer';
import { rowHints, type SetRow } from '@/logic/workoutLog';
import { num, t } from '@/i18n';

// Las series de un ejercicio durante la sesión, como en Hevy: Serie · Anterior · kg · Reps · ✓. En
// gris, lo que se guarda si se marca sin escribir (lo de la última vez o lo que pide la rutina). Por
// tiempo, en vez de kg y reps, el tiempo con su botón para empezar la cuenta atrás.

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
// En la cabecera, "Reps" también en español (como en Hevy): "Repeticiones" no cabe en la columna
const REPS_HEAD = 'Reps';

export const SetTable = ({
  item,
  ex,
  rows,
  last,
  current,
  timer,
  canRemove = true,
  onChange,
  onCheck,
  onStartTimer,
  onAddSet,
  onRemoveSet,
}: {
  item: WorkoutExercise;
  ex: CatalogExercise;
  rows: SetRow[];
  last?: SetLog[]; // la última vez que se hizo este ejercicio
  current?: number; // modo guiado: la fila en curso
  timer?: { row: number; left: number } | null; // por tiempo: la fila con la cuenta atrás en marcha
  canRemove?: boolean;
  onChange: (row: number, patch: Partial<SetRow>) => void;
  onCheck: (row: number) => void; // marcar o desmarcar
  onStartTimer?: (row: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
}) => {
  const timed = isTimedReps(item.reps);
  const withKg = !timed && (isLoadable(ex) || !!item.weightKg || !!last?.some((s) => s.kg));
  const lastRow = rows[rows.length - 1];
  const hints = rowHints(item, last, rows);

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.h, styles.colSet]}>{t('Set')}</Text>
        <Text style={[styles.h, styles.colPrev]}>{t('Previous')}</Text>
        {withKg && <Text style={[styles.h, styles.colKg]}>kg</Text>}
        <Text style={[styles.h, timed ? styles.colTime : styles.colReps]}>{timed ? t('Duration') : REPS_HEAD}</Text>
        <View style={styles.colCheck} />
      </View>
      {rows.map((r, i) => {
        const hint = hints[i];
        const prev = last?.[i];
        const running = timer?.row === i;
        return (
          <View key={i} style={[styles.row, r.done && styles.rowDone, current === i && !r.done && styles.rowCurrent]}>
            <Text style={[styles.cell, styles.colSet, styles.setNo]}>{i + 1}</Text>
            <Text style={[styles.cell, styles.colPrev, styles.prev]} numberOfLines={1}>
              {prev ? setText(prev) : '—'}
            </Text>
            {withKg && (
              <TextInput
                style={[styles.input, styles.colKg]}
                value={r.kg}
                onChangeText={(v) => onChange(i, { kg: v.replace(/[^\d.,]/g, '').slice(0, 6) })}
                placeholder={hint.kg !== undefined ? num(hint.kg) : '–'}
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel={t('Set {n}: weight in kg', { n: i + 1 })}
              />
            )}
            {timed ? (
              <View style={[styles.colTime, styles.timeCell]}>
                <Text style={[styles.time, running && { color: Colors.accent }]}>
                  {running ? clock(timer!.left) : clock(r.done && r.reps ? Number(r.reps) : (hint.reps ?? 0))}
                </Text>
                {!r.done && !running && onStartTimer && (
                  <TouchableOpacity onPress={() => onStartTimer(i)} hitSlop={8} accessibilityLabel={t('Start timer')}>
                    <Ionicons name="play-circle" size={24} color={Colors.accent} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TextInput
                style={[styles.input, styles.colReps]}
                value={r.reps}
                onChangeText={(v) => onChange(i, { reps: v.replace(/\D/g, '').slice(0, 4) })}
                placeholder={hint.reps !== undefined ? String(hint.reps) : '–'}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                selectTextOnFocus
                accessibilityLabel={t('Set {n}: reps', { n: i + 1 })}
              />
            )}
            <TouchableOpacity
              style={[styles.colCheck, styles.check, r.done && styles.checkOn]}
              onPress={() => onCheck(i)}
              hitSlop={6}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: r.done }}
              accessibilityLabel={t('Set {n} done', { n: i + 1 })}
            >
              <Ionicons name="checkmark" size={18} color={r.done ? Colors.background : Colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={styles.tools}>
        <TouchableOpacity style={styles.tool} onPress={onAddSet}>
          <Ionicons name="add" size={16} color={Colors.accent} />
          <Text style={styles.toolText}>{t('Add set')}</Text>
        </TouchableOpacity>
        {rows.length > 1 && canRemove && lastRow && !lastRow.done && (
          <TouchableOpacity style={styles.tool} onPress={onRemoveSet}>
            <Ionicons name="remove" size={16} color={Colors.textSecondary} />
            <Text style={[styles.toolText, { color: Colors.textSecondary }]}>{t('Remove set')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, marginBottom: 2 },
  h: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10 },
  rowDone: { backgroundColor: Colors.accentSoft },
  rowCurrent: { borderWidth: 1, borderColor: Colors.accent, paddingVertical: 3, paddingHorizontal: 5 },
  colSet: { width: 34, textAlign: 'center' },
  colPrev: { flex: 1 },
  colKg: { width: 62 },
  colReps: { width: 54 },
  colTime: { width: 92 },
  colCheck: { width: 36 },
  cell: { color: Colors.textPrimary, fontSize: 14 },
  setNo: { fontWeight: '800' },
  prev: { color: Colors.textSecondary, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  time: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  check: { height: 32, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tools: { flexDirection: 'row', gap: 16, paddingHorizontal: 6, paddingTop: 6 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  toolText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
});
