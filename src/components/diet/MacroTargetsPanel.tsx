import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Colors } from '@/constants/colors';
import { slotLabel } from '@/data/diet/catalog';
import type { DietDay, DietPrefs, DietTargets, MealMacroPlan, MealSlot } from '@/data/diet/types';
import { cleanMeals, dayIssue, dayLock, mealSplit, slotAverages, slotCount, type DayField, type MacroIssue, type SplitCell, type SplitCol } from '@/logic/dietPlanner';
import { useRevealOnFocus } from '@/components/KeyboardAwareScroll';
import { num, t } from '@/i18n';
import { INTER } from '@/theme/fine';

// Las calorías y los macros de un menú, como los fija el dietista: kcal, proteína, hidratos y grasa al día (vacío = lo
// que calcula el generador, en gris) y el reparto por comida (% de las kcal y gramos de cada macro; vacío = su parte),
// con lo que trae ahora el menú en cada comida. Lo usan el portal (ProDietScreen) y el propio paciente en su menú
// (DietMacrosScreen; fundador, 2026-11-06: «editar los macros nosotros, como el dietista»).
// Siempre cuadra (fundador, 2026-11-06: «que una cosa bloquee a la otra»): la casilla que sale de las otras (la cuarta
// del día o de una comida con tres puestas, la última vacía de una columna) va con borde discontinuo y no se escribe; y
// si lo puesto no cabe, sale en naranja con qué no cuadra (ver mealSplit y dayIssue) y las pantallas no dejan guardar.

export type MacroFields = Pick<DietPrefs, 'kcalTarget' | 'proteinTarget' | 'carbsTarget' | 'fatTarget' | 'meals'>;

const COL_NAME: Record<Exclude<SplitCol, 'share'>, string> = { protein: 'protein', carbs: 'carbs', fat: 'fat' };

// Qué no cuadra, en una frase
export function issueText(i: MacroIssue, prefs: Pick<DietPrefs, 'snacks' | 'customs'>): string {
  if (i.kind === 'day')
    return i.off
      ? t('Your macros add up to {n} kcal (target {k}).', { n: num(i.macroKcal), k: num(i.kcal) })
      : t('Your macros add up to {n} kcal, more than the {k} kcal of the day. Lower a macro or raise the kcal.', { n: num(i.macroKcal), k: num(i.kcal) });
  if (i.kind === 'meal') {
    const p = { meal: mealName(prefs, i.slot), n: num(i.gramsKcal), k: num(i.kcal), s: i.share };
    return i.off ? t('{meal}: its grams add up to {n} kcal and its share is {k} kcal ({s} %).', p) : t('{meal}: its grams add up to {n} kcal, more than its {k} kcal ({s} %).', p);
  }
  if (i.col === 'share')
    return i.free
      ? t('The meals add up to {n} % of the kcal: leave at least 5 % for each empty meal.', { n: i.sum })
      : t('The meals add up to {n} % of the kcal of the day, not 100 %.', { n: i.sum });
  return t('The meals add up to {n} g of {macro} and the day has {k} g.', { n: num(i.sum), macro: t(COL_NAME[i.col]), k: num(i.total) });
}

const mealName = (prefs: Pick<DietPrefs, 'snacks' | 'customs'>, slot: MealSlot) => (slotCount(prefs, slot) > 1 ? t('{slot} (each)', { slot: slotLabel(slot) }) : slotLabel(slot));

export const MacroTargetsPanel = ({
  prefs,
  targets,
  days,
  hint,
  onChange,
}: {
  prefs: DietPrefs;
  targets: DietTargets; // los de ahora, con lo que haya puesto (dietTargets)
  days: DietDay[]; // el menú, para «Menú ahora» en cada comida
  hint: string;
  onChange: (patch: Partial<MacroFields>) => void;
}) => {
  const split = mealSplit(prefs, targets);
  const inMenu = slotAverages(days);
  const mealSlots = Object.keys(split.meals) as MealSlot[];
  const meals = (m: DietPrefs['meals']) => cleanMeals(m) ?? null;
  const setMeal = (slot: MealSlot, field: keyof MealMacroPlan, v: number | null) => onChange({ meals: meals({ ...(prefs.meals ?? {}), [slot]: { ...(prefs.meals?.[slot] ?? {}), [field]: v } }) });
  const clearCol = (col: SplitCol) => onChange({ meals: meals(Object.fromEntries(Object.entries(prefs.meals ?? {}).map(([s, m]) => [s, { ...m, [col]: null }]))) });
  const clearMeal = (slot: MealSlot) => onChange({ meals: meals({ ...(prefs.meals ?? {}), [slot]: {} }) });
  const lock = dayLock(prefs);
  const dayBad = dayIssue(prefs, targets);
  const badCols = new Set(split.issues.flatMap((i) => (i.kind === 'column' ? [i.col] : [])));
  const badMeals = new Set(split.issues.flatMap((i) => (i.kind === 'meal' ? [i.slot] : [])));
  const anyWorkedOut = mealSlots.some((s) => Object.values(split.meals[s]!.cells).some((c) => c === 'rest' || c === 'calc'));

  const dayField = (f: DayField, label: string, value: number | null | undefined, computed: number, set: (v: number | null) => void) => (
    <NumField label={label} value={value} placeholder={computed} onChange={set} locked={lock === f} bad={!!dayBad} />
  );

  return (
    <>
      <View style={styles.targets}>
        {dayField('kcal', t('kcal a day'), prefs.kcalTarget, targets.kcal, (kcalTarget) => onChange({ kcalTarget }))}
        {dayField('protein', t('Protein (g)'), prefs.proteinTarget, targets.protein, (proteinTarget) => onChange({ proteinTarget }))}
      </View>
      <View style={styles.targets}>
        {dayField('carbs', t('Carbs (g)'), prefs.carbsTarget, targets.carbs ?? 0, (carbsTarget) => onChange({ carbsTarget }))}
        {dayField('fat', t('Fat (g)'), prefs.fatTarget, targets.fat ?? 0, (fatTarget) => onChange({ fatTarget }))}
      </View>
      {dayBad ? <Text style={styles.warn}>{issueText(dayBad, prefs)}</Text> : lock ? <Text style={styles.lockHint}>{t('With three boxes filled in, the fourth is worked out from them.')}</Text> : null}

      {/* Reparto por comida: % de las kcal del día y gramos de cada macro (vacío = su parte de lo que queda) */}
      <View style={styles.mealsHead}>
        <Text style={[styles.label, { flex: 1 }]}>{t('Per meal')}</Text>
        {prefs.meals ? (
          <TouchableOpacity onPress={() => onChange({ meals: null })} hitSlop={8}>
            <Text style={styles.reset}>{t('Default split')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.mealRow}>
        <View style={styles.mealLabel} />
        {[t('% kcal'), t('Prot. g'), t('Carbs g'), t('Fat g')].map((h) => (
          <Text key={h} style={styles.mealHead}>
            {h}
          </Text>
        ))}
      </View>
      {mealSlots.map((slot) => {
        const m = split.meals[slot]!;
        const menu = inMenu[slot];
        const own = prefs.meals?.[slot];
        const name = mealName(prefs, slot);
        const cellOf = (col: SplitCol, label: string, value: number) => (
          <MealCell
            key={col}
            label={`${name} · ${label}`}
            value={own?.[col]}
            computed={value}
            state={m.cells[col]}
            bad={badCols.has(col) || badMeals.has(slot)}
            onChange={(v) => setMeal(slot, col, v)}
          />
        );
        return (
          <View key={slot} style={styles.mealBlock}>
            <View style={styles.mealRow}>
              <Text style={styles.mealLabel} numberOfLines={2}>
                {name}
              </Text>
              {cellOf('share', t('% kcal'), m.shown.share)}
              {cellOf('protein', t('Prot. g'), m.shown.protein)}
              {cellOf('carbs', t('Carbs g'), m.shown.carbs)}
              {cellOf('fat', t('Fat g'), m.shown.fat)}
            </View>
            {menu ? (
              <Text style={styles.mealMenu}>
                {t('Menu now: {kcal} kcal · P {p} · C {c} · F {f}', {
                  kcal: num(Math.round(menu.kcal)),
                  p: Math.round(menu.protein),
                  c: Math.round(menu.carbs),
                  f: Math.round(menu.fat),
                })}
              </Text>
            ) : null}
          </View>
        );
      })}
      {/* Lo que no cuadra, con una salida rápida */}
      {split.issues.map((i) => (
        <View key={i.kind === 'column' ? `c-${i.col}` : i.kind === 'meal' ? `m-${i.slot}` : 'd'} style={styles.issue}>
          <Text style={styles.warn}>{issueText(i, prefs)}</Text>
          {i.kind === 'column' || i.kind === 'meal' ? (
            <TouchableOpacity onPress={() => (i.kind === 'column' ? clearCol(i.col) : clearMeal(i.slot))} hitSlop={8}>
              <Text style={styles.reset}>{i.kind === 'column' ? t('Split it for me') : t('Clear this meal')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {anyWorkedOut ? <Text style={styles.lockHint}>{t('Boxes with a dashed border are worked out: what is left so that everything adds up to the day.')}</Text> : null}
      <Text style={styles.mealHint}>{hint}</Text>
    </>
  );
};

// Un número: vacío = lo que calcula el generador (se ve en gris). `locked`: sale de los otros y no se escribe
export const NumField = ({
  label,
  value,
  placeholder,
  onChange,
  locked,
  bad,
}: {
  label: string;
  value?: number | null;
  placeholder: number;
  onChange: (v: number | null) => void;
  locked?: boolean;
  bad?: boolean;
}) => {
  const reveal = useRevealOnFocus();
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      {locked ? (
        <TextInput style={[styles.input, styles.locked, bad && styles.bad]} value={String(Math.round(placeholder))} editable={false} accessibilityLabel={`${label} · ${t('worked out')}`} />
      ) : (
        <TextInput
          style={[styles.input, bad && !!value && styles.bad]}
          keyboardType="number-pad"
          value={value ? String(value) : ''}
          placeholder={String(Math.round(placeholder))}
          placeholderTextColor={Colors.textMuted}
          onChangeText={(v) => onChange(Number(v.replace(/\D/g, '').slice(0, 5)) || null)}
          onFocus={reveal}
          accessibilityLabel={label}
        />
      )}
    </View>
  );
};

const MealCell = ({
  label,
  value,
  computed,
  state,
  bad,
  onChange,
}: {
  label: string;
  value?: number | null;
  computed: number;
  state: SplitCell;
  bad: boolean;
  onChange: (v: number | null) => void;
}) => {
  const reveal = useRevealOnFocus();
  if (state === 'rest' || state === 'calc')
    return <TextInput style={[styles.input, styles.mealCell, styles.locked, bad && styles.bad]} value={String(Math.round(computed))} editable={false} accessibilityLabel={`${label} · ${t('worked out')}`} />;
  return (
    <TextInput
      style={[styles.input, styles.mealCell, bad && styles.bad]}
      keyboardType="number-pad"
      value={value ? String(value) : ''}
      placeholder={String(Math.round(computed))}
      placeholderTextColor={Colors.textMuted}
      onChangeText={(v) => onChange(Number(v.replace(/\D/g, '').slice(0, 4)) || null)}
      onFocus={reveal}
      accessibilityLabel={label}
    />
  );
};

const styles = StyleSheet.create({
  label: { color: Colors.textPrimary, fontSize: 13, fontFamily: INTER.medium, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, padding: 9, color: Colors.textPrimary, fontFamily: INTER.regular, fontSize: 14 },
  // Sale de las otras: sin fondo, borde discontinuo y en gris
  locked: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: Colors.textMuted, color: Colors.textMuted },
  bad: { borderColor: Colors.warning },
  targets: { flexDirection: 'row', gap: 10 },
  warn: { color: Colors.warning, fontFamily: INTER.regular, fontSize: 12, lineHeight: 16, marginTop: 6 },
  lockHint: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 11, lineHeight: 15, marginTop: 6 },
  issue: { gap: 2 },
  mealsHead: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  reset: { color: Colors.accent, fontSize: 12, fontFamily: INTER.medium, marginTop: 6 },
  mealBlock: { marginBottom: 6 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mealLabel: { width: 76, color: Colors.textPrimary, fontSize: 12, fontFamily: INTER.medium },
  mealHead: { flex: 1, color: Colors.textMuted, fontSize: 10, fontFamily: INTER.medium, textAlign: 'center', marginBottom: 4 },
  // width 0 + minWidth 0: en la web un campo de texto no se encoge por debajo de su ancho por defecto
  mealCell: { flex: 1, width: 0, minWidth: 0, paddingVertical: 6, paddingHorizontal: 4, textAlign: 'center', fontFamily: INTER.regular, fontSize: 13 },
  mealMenu: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 10, marginTop: 3, marginLeft: 82 },
  mealHint: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 11, lineHeight: 15, marginTop: 4 },
});
