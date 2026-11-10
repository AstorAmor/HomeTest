import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { MacroTargetsPanel, type MacroFields } from '@/components/diet/MacroTargetsPanel';
import { Colors } from '@/constants/colors';
import { loadDietContext } from '@/data/diet/context';
import { dietRepository } from '@/data/diet/dietRepository';
import type { DayTargets, DietPlan, DietTargets } from '@/data/diet/types';
import { cleanDayTargets, dayTotals, dietTargets, generateDiet, macroIssues, selfKcalFloor, type LabFlag } from '@/logic/dietPlanner';
import { allSame, commonDraft, dayDrafts, draftPrefs, fitDrafts, sameDraft, saveDrafts, type DayDrafts } from '@/logic/dietDayMacros';
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/screens/diet/DietScreen';
import { num, t } from '@/i18n';

// «Calorías y macros» de tu menú, día a día, con el mismo panel que el dietista tiene en el portal (MacroTargetsPanel).
// Fundador, 2026-11-06: «editar los macros nosotros, como el dietista» y luego «poder configurar lo de breakfast, lunch…
// para cada día, y arriba a la derecha algo rollo aplicar a todos los días».
// - Arriba, los 7 días con sus kcal (de partida, hoy); debajo, el donut del día y la tablita «Objetivo / Tu menú» (en una
//   fila con el donut, en el móvil quedaba un hueco enorme).
// - El panel del día: kcal, proteína, hidratos y grasa y el reparto por comida (vacío = lo calcula el generador con tus
//   respuestas) y, arriba a la derecha, «Aplicar a todos los días» (copia los números de este día a los 7).
// - Guardar: mismos platos, raciones a los números de cada día; «Guardar y elegir otros platos» rehace el menú para los
//   números que más se repiten (se pierde lo cambiado a mano). Cómo se guarda, en src/logic/dietDayMacros.ts.
// Solo en tus menús: el de un dietista lo cambia él. Por debajo de un mínimo de kcal en algún día no se guarda
// (selfKcalFloor: el suelo del propio generador) y se sugiere un dietista. Tampoco si los números de algún día no
// cuadran (macroIssues: el panel dice qué es; ese día, en naranja). Con «Para comentar con tu médico» en el menú, un
// aviso neutro encima.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const todayIndex = () => (new Date().getDay() + 6) % 7;
const TO_DAY = { kcalTarget: 'kcal', proteinTarget: 'protein', carbsTarget: 'carbs', fatTarget: 'fat', meals: 'meals' } as const;

export const DietMacrosScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const [plan, setPlan] = useState<DietPlan | null | undefined>(undefined);
  const [labs, setLabs] = useState<LabFlag[]>([]);
  const [drafts, setDrafts] = useState<DayDrafts>({});
  const [sel, setSel] = useState(todayIndex());
  const [applied, setApplied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const leaving = useRef(false);
  const appliedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([dietRepository.active(), loadDietContext()]).then(([p, ctx]) => {
      setPlan(p);
      setLabs(ctx.labs);
      setDrafts(p ? dayDrafts(p) : {});
    });
    return () => {
      if (appliedTimer.current) clearTimeout(appliedTimer.current);
    };
  }, []);

  const dirty = !!plan && plan.days.some((d) => !sameDraft(drafts[d.day], dayDrafts(plan)[d.day]));

  // «Atrás» con cambios sin guardar: pregunta antes
  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (leaving.current) return;
      e.preventDefault();
      confirmAsk(t('Leave without saving?'), t('Your changes will be lost.'), t('Leave')).then((ok) => {
        if (!ok) return;
        leaving.current = true;
        navigation.dispatch(e.data.action);
      });
    });
  }, [navigation, dirty]);

  // Cada día con sus raciones rehechas a sus números (mismos platos)
  const fitted = useMemo(() => (plan ? fitDrafts(plan.days, plan.prefs, drafts, labs) : []), [plan, drafts, labs]);

  const done = () => {
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/diet');
  };

  if (plan === undefined) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScreenHeader title={t('Calories and macros')} showBack backFallback="/diet" />
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!plan || plan.source === 'professional' || !fitted.length) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScreenHeader title={t('Calories and macros')} showBack backFallback="/diet" />
        <View style={styles.content}>
          <Text style={styles.intro}>
            {!plan || !fitted.length
              ? t('Create your menu first: then you can set its calories and macros.')
              : t('{name} set the numbers of this menu. To change them, ask them.', { name: plan.professionalName || t('Your dietitian') })}
          </Text>
          <TouchableOpacity style={styles.primary} onPress={() => (plan && fitted.length ? done() : router.replace('/diet-new'))}>
            <Text style={styles.primaryText}>{plan && fitted.length ? t('Back to my menu') : t('Create my menu')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const day = fitted.find((d) => d.day === sel) ?? fitted[0];
  const draft = drafts[day.day];
  const prefs = draftPrefs(plan.prefs, draft); // las de este día, para el panel
  const targets = dietTargets(prefs, labs);
  const totals = dayTotals(day);
  const kcalOf = (d: number) => dietTargets(draftPrefs(plan.prefs, drafts[d]), labs).kcal;
  const floor = selfKcalFloor(plan.prefs);
  const lowDays = fitted.filter((d) => cleanDayTargets(drafts[d.day]) && kcalOf(d.day) < floor).map((d) => d.day);
  const tooLow = lowDays.length > 0;
  const badDays = fitted.filter((d) => {
    const p = draftPrefs(plan.prefs, drafts[d.day]);
    return macroIssues(p, dietTargets(p, labs)).length > 0;
  }).map((d) => d.day);
  const blocked = tooLow || badDays.length > 0;
  const same = allSame(plan.days, drafts);
  const cautions = plan.reasons.some((r) => r.caution);

  const setDay = (patch: Partial<MacroFields>) => {
    setError('');
    setApplied(false);
    setDrafts((all) => {
      const next: DayTargets = { ...(all[day.day] ?? {}) };
      for (const [k, v] of Object.entries(patch) as [keyof MacroFields, never][]) (next as Record<string, unknown>)[TO_DAY[k]] = v;
      return { ...all, [day.day]: cleanDayTargets(next) };
    });
  };
  const applyToAll = () => {
    setDrafts(() => Object.fromEntries(plan.days.map((d) => [d.day, cleanDayTargets(draft)])));
    setApplied(true);
    if (appliedTimer.current) clearTimeout(appliedTimer.current);
    appliedTimer.current = setTimeout(() => setApplied(false), 2500);
  };

  const save = async (newDishes: boolean) => {
    if (blocked || saving) return;
    if (newDishes && !(await confirmAsk(t('Choose new dishes?'), t('You will get dishes that fit these numbers. Changes you made by hand will be lost.'), t('Choose them')))) return;
    setSaving(true);
    const base = newDishes ? generateDiet(draftPrefs(plan.prefs, commonDraft(plan.days, drafts)), labs).days : plan.days;
    const out = saveDrafts(plan.prefs, base, drafts, labs);
    const g = generateDiet(out.prefs, labs); // objetivos y razones de la semana con lo guardado
    const next: DietPlan = { ...plan, prefs: out.prefs, targets: g.targets, reasons: g.reasons, days: out.days };
    try {
      await dietRepository.save(next);
      done();
    } catch {
      setError(t('Could not save. Check your connection and try again.'));
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Calories and macros')} showBack backFallback="/diet" />
      <KeyboardAwareScroll contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('Choose a day and set its numbers, as a dietitian would. Leave a box empty and we work it out from your answers.')}</Text>
        {cautions && (
          <View style={styles.caution}>
            <Ionicons name="medkit-outline" size={16} color={Colors.accent} />
            <Text style={styles.cautionText}>{t('Your menu has points to discuss with your doctor. Check these numbers with them or with a dietitian before changing them.')}</Text>
          </View>
        )}

        {/* Los 7 días con sus kcal; el elegido, en dorado */}
        <View style={styles.days}>
          {fitted.map((d) => {
            const on = d.day === day.day;
            const low = lowDays.includes(d.day) || badDays.includes(d.day);
            const kcal = kcalOf(d.day);
            return (
              <TouchableOpacity
                key={d.day}
                style={[styles.dayChip, on && styles.dayChipOn, low && styles.dayChipLow]}
                onPress={() => setSel(d.day)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t(WEEKDAYS_LONG[d.day])}: ${num(kcal)} kcal`}
              >
                <Text style={[styles.dayName, on && styles.dayTextOn]}>{cap(t(WEEKDAYS_SHORT[d.day]))}</Text>
                <Text style={[styles.dayKcal, on && styles.dayTextOn]}>{num(kcal)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* El donut del día con su leyenda y, debajo, lo que pides frente a lo que trae ese día con estas raciones */}
        <View style={styles.summaryCard}>
          <MacroDonut m={totals} size={84} />
          <CompareTable target={targets} menu={totals} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>{t(WEEKDAYS_LONG[day.day])}</Text>
            <TouchableOpacity style={[styles.applyBtn, same && styles.applyOff]} onPress={applyToAll} disabled={same} accessibilityLabel={t('Apply to all days')}>
              <Ionicons name="copy-outline" size={14} color={same ? Colors.textMuted : Colors.accent} />
              <Text style={[styles.applyText, same && { color: Colors.textMuted }]}>{t('Apply to all days')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.status}>{applied ? t('Done: every day has these numbers now.') : same ? t('Every day has the same numbers.') : ' '}</Text>
          <MacroTargetsPanel
            prefs={prefs}
            targets={targets}
            days={[day]}
            onChange={setDay}
            hint={t('Empty boxes share what is left of the day. Your dishes stay and their portions follow your numbers.')}
          />
          {cleanDayTargets(draft) ? (
            <TouchableOpacity onPress={() => setDay({ kcalTarget: null, proteinTarget: null, carbsTarget: null, fatTarget: null, meals: null })} hitSlop={8} style={{ marginTop: 10 }}>
              <Text style={styles.reset}>{t('Use the calculated ones for this day')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {tooLow ? (
          <View style={styles.low}>
            <Text style={styles.lowText}>{t('Menus under {n} kcal a day are not made here. If you need one, a dietitian can make it for you.', { n: num(floor) })}</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/professionals', params: { role: 'dietitian' } })} hitSlop={8}>
              <Text style={styles.reset}>{t('Find a dietitian')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {badDays.length ? (
          <Text style={styles.badText}>{t('Some numbers do not add up on: {days}.', { days: badDays.map((d) => t(WEEKDAYS_LONG[d])).join(', ') })}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={[styles.primary, (blocked || saving) && styles.disabled]} onPress={() => save(false)} disabled={blocked || saving}>
          {saving ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.primaryText}>{t('Save')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondary, (blocked || saving) && styles.disabled]} onPress={() => save(true)} disabled={blocked || saving}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.accent} />
          <Text style={styles.secondaryText}>{t('Save and choose new dishes')}</Text>
        </TouchableOpacity>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
};

// «Objetivo» y «Tu menú» en dos filas, con kcal y cada macro en su columna
const CompareTable = ({ target, menu }: { target: DietTargets; menu: { kcal: number; protein: number; carbs: number; fat: number } }) => {
  const rows = [
    { label: t('Target'), v: [target.kcal, target.protein, target.carbs, target.fat] },
    { label: t('Your menu'), v: [menu.kcal, menu.protein, menu.carbs, menu.fat] },
  ];
  return (
    <View style={styles.table}>
      <View style={styles.tRow}>
        <View style={styles.tLabelCol} />
        {['kcal', t('Prot. g'), t('Carbs g'), t('Fat g')].map((h) => (
          <Text key={h} style={styles.tHead}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.label} style={styles.tRow}>
          <Text style={[styles.tLabelCol, styles.tLabel]} numberOfLines={1}>
            {r.label}
          </Text>
          {r.v.map((x, i) => (
            <Text key={i} style={styles.tCell}>
              {x == null ? '—' : num(Math.round(x))}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  caution: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.accent, borderRadius: 12, padding: 12 },
  cautionText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  days: { flexDirection: 'row', gap: 4 },
  dayChip: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  dayChipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  dayChipLow: { borderColor: Colors.warning },
  dayName: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800' },
  dayKcal: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayTextOn: { color: Colors.background },
  summaryCard: { gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14 },
  table: { gap: 4, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10 },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tLabelCol: { width: 82 },
  tLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  tHead: { flex: 1, color: Colors.textMuted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tCell: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  panel: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { flex: 1, color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.accent, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  applyOff: { borderColor: Colors.cardBorder },
  applyText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  status: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  reset: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  low: { gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, padding: 12 },
  lowText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  badText: { color: Colors.warning, fontSize: 13, lineHeight: 18, marginTop: 10 },
  error: { color: Colors.danger, fontSize: 13 },
  primary: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 14, marginTop: 4 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
