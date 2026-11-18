import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Keyboard, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EQUIPMENT, EXERCISE_LIST, canDo, equipmentLabel, exerciseEquipmentText, exerciseName, muscleLabel, patternLabel } from '@/data/workouts/catalog';
import type { CatalogExercise, Equipment, MovementPattern } from '@/data/workouts/types';
import { FChip, FMark, ON_BG } from '@/components/fine/FineForm';
import { ExerciseLoop } from './ExerciseLoop';
import { t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Biblioteca de ejercicios con buscador y filtros (tipo de movimiento, músculo y material). La usan el
// usuario (/exercise-library y al hacer su propia rutina) y el entrenador en el portal (para consultar
// y para añadir ejercicios a un programa).

// Mientras se escribe en el buscador se esconden los filtros, para que los resultados quepan encima del teclado; al
// buscar («Intro») o al tocar fuera, el teclado se va y vuelven. Al elegir varios, la tarjeta entera se marca (foto
// incluida), no solo el botón (fundador, 2026-11-06).
// Lenguaje fino (2026-11-16; el fundador: los ejercicios «se ven antiguos, sobre todo por tema de iconos, de fuente»):
// buscador casi transparente con la lupa a línea, filtros en chips con borde, cada ejercicio sin tarjeta (la foto, el
// nombre en marfil y lo suyo apagado debajo) y «Añadir» como píldora esmeralda. Lo elegido, con borde jade.

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
  const [typing, setTyping] = useState(false); // con el buscador enfocado y algo escrito, sin filtros
  const searching = typing && !!query;
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
        <Ionicons name="search-outline" size={16} color={FINE.mute} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setShown(PAGE);
          }}
          placeholder={t('Search: squat, glutes, dumbbells…')}
          placeholderTextColor={FINE.mute}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Clear the search')}>
            <Ionicons name="close" size={17} color={FINE.mute} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!onlyPatterns && !searching && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null as string | null, label: 'All exercises' }, ...PATTERN_GROUPS].map((g) => (
            <FChip
              key={g.id ?? 'all'}
              label={t(g.label)}
              on={group === g.id}
              onPress={() => {
                setGroup(g.id);
                setShown(PAGE);
              }}
            />
          ))}
        </ScrollView>
      )}

      {!onlyPatterns && !searching && (
        <>
          <View style={styles.selects}>
            {(['muscle', 'kit'] as const).map((which) => {
              const value = which === 'muscle' ? (muscle ? muscleLabel(muscle) : t('All muscles')) : kit ? kitName(kit) : t('All equipment');
              const on = which === 'muscle' ? !!muscle : !!kit;
              const open = menu === which;
              return (
                <TouchableOpacity
                  key={which}
                  style={[styles.select, (on || open) && styles.selectOn]}
                  onPress={() => setMenu(open ? null : which)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.selectLabel}>{which === 'muscle' ? t('Muscle') : t('Equipment')}</Text>
                    <Text style={[styles.selectValue, on && styles.selectValueOn]} numberOfLines={1}>
                      {value}
                    </Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={open || on ? FINE.jade : FINE.mute} />
                </TouchableOpacity>
              );
            })}
          </View>
          {menu && (
            <View style={styles.menu}>
              {menuOptions.map((o) => (
                <FChip key={o.id ?? 'all'} label={o.label} on={(menu === 'muscle' ? muscle : kit) === o.id} onPress={() => choose(o.id)} />
              ))}
            </View>
          )}
        </>
      )}

      {equipment && (
        <TouchableOpacity
          style={styles.mine}
          onPress={() => setOnlyMine((v) => !v)}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: onlyMine }}
        >
          <FMark on={onlyMine} size={20} />
          <Text style={styles.mineText}>{forSelf ? t('Only with my equipment') : t('Only with the equipment they have')}</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.count, searching && { marginTop: 8 }]}>{tn(list.length, '{n} exercise', '{n} exercises')}</Text>

      <View style={styles.grid}>
        {list.slice(0, shown).map((ex) => {
          const on = !!selectedIds?.includes(ex.id);
          return (
            <View key={ex.id} style={[styles.cell, { width: `${100 / cols}%` }]}>
              <TouchableOpacity
                style={[styles.card, on && styles.cardOn]}
                activeOpacity={0.85}
                onPress={() => (onOpen ? onOpen(ex) : onPick?.(ex))}
                accessibilityState={selectedIds ? { selected: on } : undefined}
              >
                <View>
                  <ExerciseLoop exercise={ex} radius={10} />
                  {/* La marca de elegido va encima de la foto, siempre puesta, y solo cambia su opacidad. Ponerle y
                      quitarle el borde a la propia foto la dejaba en blanco al desmarcar (fundador, 2026-11-06) */}
                  {selectedIds && (
                    <View style={[styles.ring, !on && styles.ringOff]}>
                      <View style={styles.check}>
                        <FMark on size={24} />
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {exerciseName(ex)}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {patternLabel(ex.pattern)} · {exerciseEquipmentText(ex)}
                </Text>
                {onPick &&
                  (on ? (
                    <TouchableOpacity style={[styles.pick, styles.picked]} onPress={() => onPick(ex)} accessibilityRole="button" accessibilityState={{ selected: true }}>
                      <Ionicons name="checkmark" size={15} color={FINE.jade} />
                      <Text style={[styles.pickText, styles.pickedText]}>{t('Added')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.pick} onPress={() => onPick(ex)} accessibilityRole="button">
                      <Ionicons name="add" size={15} color={FINE.ivory} />
                      <Text style={styles.pickText}>{pickLabel ?? t('Add')}</Text>
                    </TouchableOpacity>
                  ))}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {list.length > shown && (
        <TouchableOpacity style={styles.more} onPress={() => setShown((n) => n + PAGE)} accessibilityRole="button">
          <Text style={styles.moreText}>{t('Show more ({n} left)', { n: list.length - shown })}</Text>
        </TouchableOpacity>
      )}
      {list.length === 0 && <Text style={styles.empty}>{t('No exercises match. Try another word or filter.')}</Text>}
    </View>
  );
};

const DARK = '#061A16'; // la marca sobre el jade

const styles = StyleSheet.create({
  // Buscador casi transparente con borde fino, como las casillas de Metas
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, ...ff('regular'), color: FINE.ivory, fontSize: 15, paddingVertical: 9 },
  chips: { gap: 8, paddingVertical: 12 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, marginBottom: 2 },
  mineText: { ...ff('regular'), color: FINE.ivory, fontSize: 14 },
  count: { ...fine.kicker, marginTop: 4, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { padding: 5 },
  // Sin tarjeta: el borde es transparente y solo se ve (jade, con un fondo apenas marcado) al elegirlo
  card: { borderWidth: 1, borderColor: 'transparent', borderRadius: 14, padding: 4, paddingBottom: 6, gap: 4, flex: 1 },
  cardOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, borderWidth: 1.5, borderColor: FINE.jade, pointerEvents: 'none' },
  ringOff: { opacity: 0 },
  check: { position: 'absolute', top: 6, right: 6, borderRadius: 12, backgroundColor: DARK },
  name: { ...ff('medium'), color: FINE.ivory, fontSize: 13.5, lineHeight: 18, minHeight: 36, marginTop: 4 },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  // «Añadir»: píldora esmeralda; «Añadido», con borde jade y sin relleno
  pick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: FINE.emerald, borderRadius: 20, minHeight: 34, paddingVertical: 6, marginTop: 4 },
  pickText: { ...ff('medium'), color: '#F0EFE6', fontSize: 12.5 },
  picked: { backgroundColor: 'transparent', borderWidth: 1, borderColor: FINE.jadeLine },
  pickedText: { color: FINE.jade },
  // Los desplegables de músculo y material: con borde fino; abiertos o con algo elegido, en jade
  selects: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  select: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, minHeight: 48 },
  selectOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  selectLabel: { ...fine.kicker, fontSize: 9.5 },
  selectValue: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, marginTop: 1 },
  selectValueOn: { color: FINE.ivory },
  menu: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  more: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 },
  moreText: { ...fine.link, fontSize: 14 },
  empty: { ...fine.note, fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 20 },
});
