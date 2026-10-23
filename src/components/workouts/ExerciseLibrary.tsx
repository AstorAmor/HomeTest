import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { EQUIPMENT, EXERCISE_LIST, canDo, equipmentLabel, exerciseEquipmentText, exerciseName, muscleLabel, patternLabel } from '@/data/workouts/catalog';
import type { CatalogExercise, Equipment, MovementPattern } from '@/data/workouts/types';
import { ExerciseLoop } from './ExerciseLoop';
import { t, tn } from '@/i18n';

// Biblioteca de ejercicios con buscador y filtros (tipo de movimiento, músculo y material). La usan el
// usuario (/exercise-library y al hacer su propia rutina) y el entrenador en el portal (para consultar
// y para añadir ejercicios a un programa).

// Músculos principales del catálogo, de arriba abajo
const MUSCLE_ORDER = ['chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'middle back', 'traps', 'lower back', 'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves', 'neck'];
const MUSCLES = MUSCLE_ORDER.filter((m) => EXERCISE_LIST.some((ex) => ex.primary.includes(m)));
type KitFilter = Equipment | 'none';
const usesKit = (ex: CatalogExercise, k: KitFilter) =>
  k === 'none' ? !ex.needs.length && !ex.anyOf?.length : ex.needs.includes(k) || !!ex.anyOf?.includes(k);

export const PATTERN_GROUPS: { id: string; label: string; patterns: MovementPattern[] }[] = [
  { id: 'legs', label: 'Legs and glutes', patterns: ['squat', 'lunge', 'hinge', 'hamstrings', 'quads', 'glutes', 'calves'] },
  { id: 'push', label: 'Push', patterns: ['push_h', 'push_v', 'chest', 'shoulders', 'triceps'] },
  { id: 'pull', label: 'Pull', patterns: ['pull_h', 'pull_v', 'biceps', 'back'] },
  { id: 'core', label: 'Core', patterns: ['core', 'carry'] },
  { id: 'cardio', label: 'Cardio', patterns: ['conditioning'] },
  { id: 'mobility', label: 'Mobility and stretching', patterns: ['mobility', 'stretch'] },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PAGE = 24;

export const ExerciseLibrary = ({
  onOpen,
  onPick,
  pickLabel,
  equipment,
  onlyPatterns,
  excludeId,
  columns,
  forSelf,
  selectedIds,
}: {
  onOpen?: (ex: CatalogExercise) => void;
  onPick?: (ex: CatalogExercise) => void; // botón "Añadir" en cada tarjeta
  pickLabel?: string;
  selectedIds?: string[]; // para elegir varios: los elegidos salen marcados y onPick los quita
  equipment?: Equipment[]; // si se pasa, filtro "Solo con este material" activado de partida
  onlyPatterns?: MovementPattern[]; // p. ej. para cambiar un ejercicio por otro del mismo patrón
  excludeId?: string; // el que se está cambiando
  columns?: number;
  forSelf?: boolean; // lo usa el propio usuario ("mi material"), no su entrenador
}) => {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(!!equipment);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [kit, setKit] = useState<KitFilter | null>(null);
  const [menu, setMenu] = useState<'muscle' | 'kit' | null>(null); // desplegable abierto
  const [shown, setShown] = useState(PAGE);
  const cols = columns ?? (width >= 1200 ? 4 : width >= 760 ? 3 : 2);

  const list = useMemo(() => {
    const q = norm(query.trim());
    const g = PATTERN_GROUPS.find((x) => x.id === group);
    return EXERCISE_LIST.filter((ex) => {
      if (ex.id === excludeId) return false;
      if (onlyPatterns && !onlyPatterns.includes(ex.pattern)) return false;
      if (g && !g.patterns.includes(ex.pattern)) return false;
      if (muscle && !ex.primary.includes(muscle)) return false;
      if (kit && !usesKit(ex, kit)) return false;
      if (onlyMine && equipment && !canDo(ex, equipment)) return false;
      if (!q) return true;
      const hay = norm([ex.name.es, ex.name.en, patternLabel(ex.pattern), ...ex.primary.map(muscleLabel), ...ex.primary].join(' '));
      return q.split(/\s+/).every((w) => hay.includes(w));
    }).sort((a, b) => exerciseName(a).localeCompare(exerciseName(b)));
  }, [query, group, muscle, kit, onlyMine, equipment, onlyPatterns, excludeId]);

  const kitName = (k: KitFilter) => (k === 'none' ? t('No equipment') : equipmentLabel(k));
  const menuOptions: { id: string | null; label: string }[] =
    menu === 'muscle'
      ? [{ id: null, label: t('All muscles') }, ...MUSCLES.map((m) => ({ id: m, label: muscleLabel(m) }))]
      : [{ id: null, label: t('All equipment') }, { id: 'none', label: kitName('none') }, ...EQUIPMENT.map((e) => ({ id: e.id, label: t(e.label) }))];
  const choose = (id: string | null) => {
    if (menu === 'muscle') setMuscle(id);
    else setKit(id as KitFilter | null);
    setMenu(null);
    setShown(PAGE);
  };

  return (
    <View>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setShown(PAGE);
          }}
          placeholder={t('Search: squat, glutes, dumbbells…')}
          placeholderTextColor={Colors.textMuted}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!onlyPatterns && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null as string | null, label: 'All exercises' }, ...PATTERN_GROUPS].map((g) => {
            const on = group === g.id;
            return (
              <TouchableOpacity
                key={g.id ?? 'all'}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => {
                  setGroup(g.id);
                  setShown(PAGE);
                }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(g.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {!onlyPatterns && (
        <>
          <View style={styles.selects}>
            {(['muscle', 'kit'] as const).map((which) => {
              const value = which === 'muscle' ? (muscle ? muscleLabel(muscle) : t('All muscles')) : kit ? kitName(kit) : t('All equipment');
              const on = which === 'muscle' ? !!muscle : !!kit;
              const open = menu === which;
              return (
                <TouchableOpacity
                  key={which}
                  style={[styles.select, (on || open) && styles.chipOn]}
                  onPress={() => setMenu(open ? null : which)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Text style={styles.selectLabel}>{which === 'muscle' ? t('Muscle') : t('Equipment')}</Text>
                  <Text style={[styles.selectValue, on && styles.chipTextOn]} numberOfLines={1}>
                    {value}
                  </Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
          {menu && (
            <View style={styles.menu}>
              {menuOptions.map((o) => {
                const on = (menu === 'muscle' ? muscle : kit) === o.id;
                return (
                  <TouchableOpacity key={o.id ?? 'all'} style={[styles.chip, on && styles.chipOn]} onPress={() => choose(o.id)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      {equipment && (
        <TouchableOpacity style={styles.mine} onPress={() => setOnlyMine((v) => !v)}>
          <Ionicons name={onlyMine ? 'checkbox' : 'square-outline'} size={18} color={Colors.accent} />
          <Text style={styles.mineText}>{forSelf ? t('Only with my equipment') : t('Only with the equipment they have')}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.count}>{tn(list.length, '{n} exercise', '{n} exercises')}</Text>

      <View style={styles.grid}>
        {list.slice(0, shown).map((ex) => (
          <View key={ex.id} style={[styles.cell, { width: `${100 / cols}%` }]}>
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => (onOpen ? onOpen(ex) : onPick?.(ex))}>
              <ExerciseLoop exercise={ex} radius={10} />
              <Text style={styles.name} numberOfLines={2}>
                {exerciseName(ex)}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {patternLabel(ex.pattern)} · {exerciseEquipmentText(ex)}
              </Text>
              {onPick &&
                (selectedIds?.includes(ex.id) ? (
                  <TouchableOpacity style={[styles.pick, styles.picked]} onPress={() => onPick(ex)} accessibilityState={{ selected: true }}>
                    <Ionicons name="checkmark" size={16} color={Colors.accent} />
                    <Text style={[styles.pickText, { color: Colors.accent }]}>{t('Added')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pick} onPress={() => onPick(ex)}>
                    <Ionicons name="add" size={16} color={Colors.background} />
                    <Text style={styles.pickText}>{pickLabel ?? t('Add')}</Text>
                  </TouchableOpacity>
                ))}
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {list.length > shown && (
        <TouchableOpacity style={styles.more} onPress={() => setShown((n) => n + PAGE)}>
          <Text style={styles.moreText}>{t('Show more ({n} left)', { n: list.length - shown })}</Text>
        </TouchableOpacity>
      )}
      {list.length === 0 && <Text style={styles.empty}>{t('No exercises match. Try another word or filter.')}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 2 },
  chips: { gap: 8, paddingVertical: 10 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: Colors.textPrimary },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, marginBottom: 4 },
  mineText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  count: { color: Colors.textMuted, fontSize: 12, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { padding: 5 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 8, gap: 6, flex: 1 },
  name: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', minHeight: 34 },
  meta: { color: Colors.textMuted, fontSize: 11 },
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 6 },
  pickText: { color: Colors.background, fontSize: 12, fontWeight: '800' },
  picked: { backgroundColor: Colors.accentSoft, borderWidth: 1, borderColor: Colors.accent },
  selects: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  select: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  selectLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  selectValue: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  more: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  moreText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  empty: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginVertical: 20 },
});
