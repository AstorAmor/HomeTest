import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { exerciseName, isLoadable, kgHead } from '@/data/workouts/catalog';
import { blockLabel } from '@/data/workouts/labels';
import type { CatalogExercise, WorkoutExercise } from '@/data/workouts/types';
import type { DraftSet } from '@/logic/customRoutine';
import { isTimedReps, timeText } from '@/logic/workoutTimer';
import { useRevealOnFocus } from '@/components/KeyboardAwareScroll';
import { ExerciseLoop } from './ExerciseLoop';
import { REST_OPTIONS } from './ExerciseBlock';
import { t } from '@/i18n';

// Un ejercicio en el editor de rutina, como «Edit Routine» de Hevy: todo a la vista y en el sitio, sin
// abrir uno a uno. Miniatura y nombre (tocar = cómo se hace), ⋮ para subir, bajar, cambiar o quitar,
// el descanso y una nota, y la tabla con una fila por serie: su peso y sus repeticiones (o sus segundos,
// si va por tiempo; tocar «Reps» lo cambia). Tocar el número de una serie la quita; «Añadir serie»
// copia la última.

export const RoutineExerciseCard = ({
  item,
  ex,
  draft,
  first,
  last,
  onOpen,
  onChange,
  onDraft,
  onToggleTimed,
  onMove,
  onReplace,
  onRemove,
}: {
  item: WorkoutExercise;
  ex: CatalogExercise;
  draft: DraftSet[];
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onChange: (patch: Partial<WorkoutExercise>) => void;
  onDraft: (draft: DraftSet[]) => void;
  onToggleTimed: () => void;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
}) => {
  const reveal = useRevealOnFocus();
  const [menu, setMenu] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!item.note);
  const timed = isTimedReps(item.reps);
  const withKg = !timed && (isLoadable(ex) || draft.some((d) => d.kg));
  const setRow = (i: number, patch: Partial<DraftSet>) => onDraft(draft.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <TouchableOpacity onPress={onOpen} accessibilityLabel={exerciseName(ex)}>
          <ExerciseLoop exercise={ex} size={46} radius={23} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={onOpen}>
          <Text style={styles.name} numberOfLines={2}>
            {exerciseName(ex)}
          </Text>
          {item.block !== 'main' ? <Text style={styles.block}>{blockLabel(item.block)}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMenu((v) => !v)} hitSlop={10} accessibilityLabel={t('More options')} accessibilityState={{ expanded: menu }}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {menu && (
        <View style={styles.menu}>
          {!first && <MenuItem icon="arrow-up" label={t('Move up')} onPress={() => onMove(-1)} />}
          {!last && <MenuItem icon="arrow-down" label={t('Move down')} onPress={() => onMove(1)} />}
          <MenuItem
            icon="swap-horizontal"
            label={t('Replace')}
            onPress={() => {
              setMenu(false);
              onReplace();
            }}
          />
          <MenuItem icon="trash-outline" label={t('Remove')} danger onPress={onRemove} />
        </View>
      )}

      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, restOpen && styles.chipOn]} onPress={() => setRestOpen((v) => !v)} accessibilityState={{ expanded: restOpen }}>
          <Ionicons name="timer-outline" size={16} color={Colors.textPrimary} />
          <Text style={styles.chipText}>{item.restSec ? t('Rest: {time}', { time: timeText(item.restSec) }) : t('Rest: off')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, noteOpen && styles.chipOn]} onPress={() => setNoteOpen((v) => !v)}>
          <Ionicons name="document-text-outline" size={16} color={Colors.textPrimary} />
          <Text style={styles.chipText}>{t('Note')}</Text>
        </TouchableOpacity>
      </View>
      {restOpen && (
        <View style={styles.options}>
          {REST_OPTIONS.map((sec) => {
            const on = item.restSec === sec;
            return (
              <TouchableOpacity
                key={sec}
                style={[styles.option, on && styles.chipOn]}
                onPress={() => {
                  onChange({ restSec: sec });
                  setRestOpen(false);
                }}
              >
                <Text style={[styles.optionText, on && { color: Colors.textPrimary }]}>{sec ? timeText(sec) : t('No rest')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {noteOpen && (
        <TextInput
          style={styles.note}
          value={item.note ?? ''}
          onChangeText={(v) => onChange({ note: v.slice(0, 200) || undefined })}
          placeholder={t('Add a note')}
          placeholderTextColor={Colors.textMuted}
          onFocus={reveal}
          multiline
        />
      )}

      <View style={styles.tableHead}>
        <Text style={[styles.h, styles.colSet]}>{t('Set')}</Text>
        {withKg && <Text style={[styles.h, styles.colBox]}>{kgHead(ex)}</Text>}
        <TouchableOpacity style={[styles.colBox, styles.repsHead]} onPress={onToggleTimed} accessibilityLabel={timed ? t('Count by reps') : t('Count by time')}>
          <Text style={styles.h}>{timed ? t('Seconds') : 'Reps'}</Text>
          <Ionicons name="caret-down" size={12} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      {draft.map((d, i) => (
        <View key={i} style={styles.row}>
          <TouchableOpacity
            style={[styles.colSet, styles.setNo]}
            onPress={draft.length > 1 ? () => onDraft(draft.filter((_, j) => j !== i)) : undefined}
            disabled={draft.length < 2}
            accessibilityLabel={draft.length > 1 ? t('Remove set {n}', { n: i + 1 }) : t('Set {n}', { n: i + 1 })}
          >
            <Text style={styles.setNoText}>{i + 1}</Text>
          </TouchableOpacity>
          {withKg && (
            <TextInput
              style={[styles.colBox, styles.box]}
              value={d.kg}
              onChangeText={(v) => setRow(i, { kg: v.replace(/[^\d.,]/g, '').slice(0, 6) })}
              placeholder="–"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              selectTextOnFocus
              onFocus={reveal}
              accessibilityLabel={t('Set {n}: weight in kg', { n: i + 1 })}
            />
          )}
          <TextInput
            style={[styles.colBox, styles.box]}
            value={d.reps}
            onChangeText={(v) => setRow(i, { reps: v.replace(timed ? /\D/g : /[^\d–-]/g, '').slice(0, 7) })}
            placeholder="–"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            selectTextOnFocus
            onFocus={reveal}
            accessibilityLabel={timed ? t('Set {n}: seconds', { n: i + 1 }) : t('Set {n}: reps', { n: i + 1 })}
          />
        </View>
      ))}
      <TouchableOpacity style={styles.addSet} onPress={() => onDraft([...draft, { ...(draft[draft.length - 1] ?? { kg: '', reps: timed ? '30' : '10' }) }])}>
        <Ionicons name="add" size={18} color={Colors.textPrimary} />
        <Text style={styles.addSetText}>{t('Add set')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const MenuItem = ({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Ionicons name={icon} size={16} color={danger ? Colors.danger : Colors.textPrimary} />
    <Text style={[styles.menuText, danger && { color: Colors.danger }]}>{label}</Text>
  </TouchableOpacity>
);

const H = 44;

const styles = StyleSheet.create({
  card: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: Colors.accent, fontSize: 17, fontWeight: '800' },
  block: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  menuText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  optionText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  note: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, backgroundColor: Colors.card, color: Colors.textPrimary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, marginTop: 4 },
  h: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  repsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 4 },
  colSet: { width: 40 },
  // minWidth 0: en la web una casilla de texto no encoge por debajo de su ancho natural
  colBox: { flex: 1, minWidth: 0 },
  setNo: { height: H, borderRadius: 8, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  setNoText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  box: {
    height: H,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    backgroundColor: Colors.background,
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
    fontVariant: ['tabular-nums'],
  },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10, backgroundColor: Colors.card, marginTop: 4 },
  addSetText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
