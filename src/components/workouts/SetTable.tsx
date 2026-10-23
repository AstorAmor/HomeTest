import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { isLoadable } from '@/data/workouts/catalog';
import { setText } from '@/data/workouts/labels';
import type { CatalogExercise, SetLog, WorkoutExercise } from '@/data/workouts/types';
import { isTimedReps } from '@/logic/workoutTimer';
import { rowHints, type SetRow } from '@/logic/workoutLog';
import { useRevealOnFocus } from '@/components/KeyboardAwareScroll';
import { num, t } from '@/i18n';

// Las series de un ejercicio durante la sesión, como en Hevy: Serie · Anterior · kg · Reps · ✓, con
// casillas grandes para escribir el peso y las repeticiones con el pulgar. En gris, lo que se guarda si
// se marca sin escribir (lo de la última vez, el peso de la fila de arriba o lo que pide la rutina).
// Por tiempo, en vez de kg y reps, el tiempo con su botón para empezar la cuenta atrás. Tocar el número
// de una serie la quita (si no está hecha).

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
  onChange: (row: number, patch: Partial<SetRow>) => void;
  onCheck: (row: number) => void; // marcar o desmarcar
  onStartTimer?: (row: number) => void;
  onAddSet: () => void;
  onRemoveSet?: (row: number) => void; // al tocar el número de la serie
}) => {
  const timed = isTimedReps(item.reps);
  const withKg = !timed && (isLoadable(ex) || !!item.weightKg || !!last?.some((s) => s.kg));
  const hints = rowHints(item, last, rows);
  const reveal = useRevealOnFocus(); // que el teclado no tape la casilla

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.h, styles.colSet]}>{t('Set')}</Text>
        <Text style={[styles.h, styles.colPrev]}>{t('Previous')}</Text>
        {timed ? (
          <Text style={[styles.h, styles.colTime]}>{t('Duration')}</Text>
        ) : (
          <>
            {withKg && <Text style={[styles.h, styles.colBox]}>kg</Text>}
            <Text style={[styles.h, styles.colBox]}>{REPS_HEAD}</Text>
          </>
        )}
        <View style={styles.colCheck}>
          <Ionicons name="checkmark" size={16} color={Colors.textMuted} />
        </View>
      </View>
      {rows.map((r, i) => {
        const hint = hints[i];
        const prev = last?.[i];
        const running = timer?.row === i;
        const canRemove = !!onRemoveSet && rows.length > 1 && !r.done;
        return (
          <View key={i} style={[styles.row, r.done && styles.rowDone, current === i && !r.done && styles.rowCurrent]}>
            <TouchableOpacity
              style={[styles.colSet, styles.setNo, r.done && styles.setNoDone]}
              onPress={canRemove ? () => onRemoveSet!(i) : undefined}
              disabled={!canRemove}
              accessibilityLabel={canRemove ? t('Remove set {n}', { n: i + 1 }) : t('Set {n}', { n: i + 1 })}
            >
              <Text style={styles.setNoText}>{i + 1}</Text>
            </TouchableOpacity>
            <Text style={[styles.colPrev, styles.prev]} numberOfLines={1}>
              {prev ? setText(prev) : '–'}
            </Text>
            {timed ? (
              <TouchableOpacity
                style={[styles.colTime, styles.box, styles.timeBox, running && styles.boxOn]}
                onPress={!r.done && !running && onStartTimer ? () => onStartTimer(i) : undefined}
                disabled={r.done || running || !onStartTimer}
                accessibilityLabel={t('Start timer')}
              >
                <Text style={[styles.boxText, running && { color: Colors.accent }]}>
                  {running ? clock(timer!.left) : clock(r.done && r.reps ? Number(r.reps) : (hint.reps ?? 0))}
                </Text>
                {!r.done && !running && onStartTimer ? <Ionicons name="play" size={16} color={Colors.accent} /> : null}
              </TouchableOpacity>
            ) : (
              <>
                {withKg && (
                  <TextInput
                    style={[styles.colBox, styles.box, styles.boxText]}
                    value={r.kg}
                    onChangeText={(v) => onChange(i, { kg: v.replace(/[^\d.,]/g, '').slice(0, 6) })}
                    placeholder={hint.kg !== undefined ? num(hint.kg) : '–'}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    onFocus={reveal}
                    accessibilityLabel={t('Set {n}: weight in kg', { n: i + 1 })}
                  />
                )}
                <TextInput
                  style={[styles.colBox, styles.box, styles.boxText]}
                  value={r.reps}
                  onChangeText={(v) => onChange(i, { reps: v.replace(/\D/g, '').slice(0, 4) })}
                  placeholder={hint.reps !== undefined ? String(hint.reps) : '–'}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  onFocus={reveal}
                  accessibilityLabel={t('Set {n}: reps', { n: i + 1 })}
                />
              </>
            )}
            <TouchableOpacity
              style={[styles.colCheck, styles.check, r.done && styles.checkOn]}
              onPress={() => onCheck(i)}
              hitSlop={4}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: r.done }}
              accessibilityLabel={t('Set {n} done', { n: i + 1 })}
            >
              <Ionicons name="checkmark" size={22} color={r.done ? Colors.background : Colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity style={styles.addSet} onPress={onAddSet}>
        <Ionicons name="add" size={18} color={Colors.textPrimary} />
        <Text style={styles.addSetText}>{t('Add set')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const H = 42; // alto de las casillas: cómodas para el pulgar

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 4 },
  h: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 10 },
  rowDone: { backgroundColor: Colors.accentSoft },
  rowCurrent: { borderWidth: 1, borderColor: Colors.accent, paddingVertical: 3, paddingHorizontal: 3 },
  colSet: { width: 36 },
  // minWidth 0: en la web una casilla de texto no encoge por debajo de su ancho natural y se comía la
  // columna "Anterior"
  colPrev: { flex: 1.15, minWidth: 0 },
  colBox: { flex: 1, minWidth: 0 },
  colTime: { flex: 2.1, minWidth: 0 },
  colCheck: { width: H, alignItems: 'center' },
  setNo: { height: H, borderRadius: 8, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  setNoDone: { backgroundColor: 'transparent' },
  setNoText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  prev: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  box: { height: H, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, backgroundColor: Colors.background },
  boxOn: { borderColor: Colors.accent },
  boxText: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4, fontVariant: ['tabular-nums'] },
  timeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  check: { height: H, borderRadius: 8, backgroundColor: Colors.card, justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.accent },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 10, backgroundColor: Colors.card, marginTop: 8 },
  addSetText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
