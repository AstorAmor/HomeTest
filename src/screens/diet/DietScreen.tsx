import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { RecipeImage } from '@/components/diet/RecipeImage';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { DIET_FEATURE, DietLocked } from '@/components/diet/TodayMenuCard';
import { SubscribePopup } from '@/components/SubscribePopup';
import { CometLine } from '@/components/CometLine';
import { Chev, Pill, SecHead } from '@/components/fine/Fine';
import { FButton, FChips, FLink, FMark, ON_BG, formStyles } from '@/components/fine/FineForm';
import { useFeature } from '@/data/access';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getRecipe, recipeName, slotLabel } from '@/data/diet/catalog';
import { loadDietContext } from '@/data/diet/context';
import { dietRepository, eatenMeals } from '@/data/diet/dietRepository';
import type { DietPlan, PlannedMeal } from '@/data/diet/types';
import { cleanDayTargets, dayKcalTarget, dayTotals, fitDay, generateDiet, ownMacros, weekSummary } from '@/logic/dietPlanner';
import { weekKcalTarget } from '@/logic/dietDayMacros';
import { num, t } from '@/i18n';
import { menuFileName, menuToHtml, shoppingText } from '@/utils/menuPdf';
import { shareHtmlPdf } from '@/utils/shareHtml';
import { FINE, ff, fine } from '@/theme/fine';

// "Tu menú de la semana": por día (fotos grandes, toca para ver la receta) o la semana entera como un
// calendario. Arriba, por qué es así (analíticas y respuestas) y, en tus menús, «Calorías y macros» (/diet-macros:
// tus números, como el dietista); abajo, la lista de la compra.
// Rediseño del 2026-11-16 (lenguaje fino del prototipo): sin tarjetas; filas con línea fina, cabeceras pequeñas,
// los días en círculos, las comidas como foto y texto, las cifras de la semana grandes y ligeras.

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const todayIndex = () => (new Date().getDay() + 6) % 7;


export const DietScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [plan, setPlan] = useState<DietPlan | null | undefined>(undefined);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(todayIndex());
  const [showWhy, setShowWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [eaten, setEaten] = useState<number[]>([]);

  useReloadOnFocus(
    useCallback(async () => {
      const p = await dietRepository.active();
      setPlan(p);
      setEaten(p ? await eatenMeals.get(p.id) : []);
    }, [])
  );
  const toggleEaten = (i: number) => {
    if (!plan) return;
    const next = eaten.includes(i) ? eaten.filter((x) => x !== i) : [...eaten, i];
    setEaten(next);
    eatenMeals.set(plan.id, next);
  };
  const allowed = useFeature(DIET_FEATURE);

  const openMeal = (d: number, m: PlannedMeal) =>
    router.push({ pathname: '/recipe', params: { id: m.recipeId, portion: String(m.portion), plan: plan!.id, day: String(d), slot: m.slot } });

  const another = async () => {
    if (!plan) return;
    const ok = await confirmAsk(t('Make another version?'), t('You will get different dishes with the same answers. Changes you made by hand will be lost.'), t('Make it'));
    if (!ok) return;
    setBusy(true);
    const ctx = await loadDietContext();
    const prefs = { ...plan.prefs, seed: plan.prefs.seed + 1 };
    const g = generateDiet(prefs, ctx.labs);
    // Los días con números propios (Calorías y macros → Por día) los conservan, con sus raciones a ellos
    const days = g.days.map((d) => {
      const own = cleanDayTargets(plan.days.find((x) => x.day === d.day)?.targets);
      return own ? fitDay({ ...d, targets: own }, prefs, ctx.labs) : d;
    });
    const next = { ...plan, prefs, days, targets: g.targets, reasons: g.reasons };
    await dietRepository.save(next);
    setPlan(next);
    setBusy(false);
  };

  if (allowed === false) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <DietLocked />
        </ScrollView>
        <SubscribePopup feature={DIET_FEATURE} icon="silverware-fork-knife" text="A week of breakfasts, lunches and dinners made for you: your blood tests, what you like and what sits badly, your budget and your time. With recipes, photos and the shopping list." fallback="/nutrients" />
      </SafeAreaView>
    );
  }

  if (plan === undefined || allowed === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
        <ActivityIndicator color={FINE.jade} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Ionicons name="restaurant-outline" size={26} color={FINE.jade} />
            <Text style={formStyles.q}>{t('A week of meals made for you')}</Text>
            <Text style={formStyles.lead}>
              {t('We ask what you like, what sits badly, your budget and how much you cook, and we take your blood tests into account. You get breakfast, lunch, dinner and snacks for the week, with recipes and the shopping list.')}
            </Text>
          </View>
          <FButton label={t('Create my menu')} icon="sparkles-outline" onPress={() => router.push('/diet-new')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const cautions = plan.reasons.filter((r) => r.caution);
  const summary = weekSummary(plan.days);
  // Lo que lleva de verdad el menú (media de la semana), no el objetivo: la proteína no se ajusta con las raciones
  const potassium = Math.round(plan.days.reduce((a, d) => a + dayTotals(d).potassium, 0) / Math.max(1, plan.days.length) / 100) * 100;
  // Con días distintos (Calorías y macros), la media de sus objetivos
  const tp = { kcal: num(weekKcalTarget(plan)), protein: Math.round(summary.protein), potassium };
  const current = plan.days[day];
  const totals = current ? dayTotals(current) : null;
  const slots = plan.days[0]?.meals.map((m) => m.slot) ?? [];
  const isToday = day === todayIndex();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Lo que hay que mirar con el médico: en oro, sin alarma, con sus dos salidas */}
        {cautions.length ? (
          <View style={styles.caution}>
            <View style={styles.cautionHead}>
              <Ionicons name="medkit-outline" size={17} color={FINE.gold} />
              <Text style={styles.cautionTitle}>{t('To discuss with your doctor')}</Text>
            </View>
            {cautions.map((r) => (
              <View key={r.id} style={{ gap: 2 }}>
                <Text style={styles.reasonTitle}>{t(r.title)}</Text>
                <Text style={styles.reasonText}>{t(r.detail, tp)}</Text>
              </View>
            ))}
            <Text style={styles.cautionFoot}>{t('This menu is adapted to it, but it is general guidance: it does not replace your doctor.')}</Text>
            <View style={styles.cautionBtns}>
              <Pill gold label={t('Find a doctor')} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} />
              <TouchableOpacity onPress={() => router.push({ pathname: '/professionals', params: { role: 'dietitian' } })} hitSlop={8} accessibilityRole="button">
                <Text style={fine.link}>{t('Find a dietitian')} ›</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* De quién es el menú y cuánto lleva al día; debajo, tus números y por qué es así */}
        <Text style={styles.kicker}>{plan.source === 'professional' ? t('From {name}', { name: plan.professionalName || t('your dietitian') }) : t('Made for you')}</Text>
        <Text style={styles.headText}>{t('About {kcal} kcal and {protein} g of protein a day', tp)}</Text>
        {plan.note ? <Text style={styles.quote}>“{plan.note}”</Text> : null}
        <View style={styles.headRows}>
          {/* Tus propias kcal y macros, con el panel del dietista (en el menú de un dietista, los pone él) */}
          {plan.source !== 'professional' && (
            <TouchableOpacity style={fine.row} onPress={() => router.push('/diet-macros')} accessibilityRole="button">
              <Ionicons name="options-outline" size={17} color={FINE.jade} />
              <Text style={[fine.rowTitle, { flex: 1 }]}>
                {ownMacros(plan.prefs) || plan.days.some((d) => cleanDayTargets(d.targets)) ? t('Your calories and macros') : t('Adjust calories and macros')}
              </Text>
              <Chev />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[fine.row, showWhy && { borderBottomWidth: 0 }]}
            onPress={() => setShowWhy((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showWhy }}
          >
            <Ionicons name="information-circle-outline" size={17} color={FINE.jade} />
            <Text style={[fine.rowTitle, { flex: 1 }]}>{t('Why this menu')}</Text>
            <Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
          </TouchableOpacity>
          {showWhy ? (
            <View style={styles.reasons}>
              {plan.reasons.filter((r) => !r.caution).map((r) => (
                <View key={r.id} style={styles.reason}>
                  <Text style={styles.reasonTitle}>{t(r.title)}</Text>
                  <Text style={styles.reasonText}>{t(r.detail, tp)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <FChips
          style={styles.toggle}
          options={[
            { id: 'day' as const, label: t('Day') },
            { id: 'week' as const, label: t('Week') },
          ]}
          value={view}
          onChange={setView}
        />

        {view === 'day' ? (
          <>
            {/* Los 7 días en círculos (como en Metas); hoy, con un punto */}
            <View style={styles.days}>
              {WEEKDAYS_SHORT.map((d, i) => {
                const on = i === day;
                return (
                  <TouchableOpacity
                    key={d}
                    style={styles.dayCol}
                    onPress={() => setDay(i)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t(WEEKDAYS_LONG[i])}
                  >
                    <View style={[styles.dayDot, on && styles.dayDotOn]}>
                      <Text style={[styles.dayText, on && styles.dayTextOn]}>{t(d)}</Text>
                    </View>
                    <View style={[styles.todayMark, i === todayIndex() && styles.todayMarkOn]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.dayTitle} accessibilityRole="header">
              {t(WEEKDAYS_LONG[day])}
            </Text>
            {isToday && current ? (
              <>
                <Text style={styles.eatenCount}>{t('{done} of {total} meals eaten today', { done: eaten.length, total: current.meals.length })}</Text>
                <CometLine progress={current.meals.length ? eaten.length / current.meals.length : 0} colors={['#2F8F70', FINE.jade]} style={styles.comet} />
              </>
            ) : null}
            {totals && (
              <View style={styles.dayTotalsBox}>
                <MacroDonut m={totals} size={96} />
                <Text style={styles.dayTotals}>
                  {t('Target')}: {num(current ? dayKcalTarget(plan, current) : plan.targets.kcal)} kcal · {t('fibre')} {Math.round(totals.fiber)} g
                </Text>
              </View>
            )}
            <View style={wide ? styles.mealGrid : undefined}>
              {current?.meals.map((m, i) => {
                const r = getRecipe(m.recipeId);
                if (!r) return null;
                const on = eaten.includes(i);
                return (
                  <TouchableOpacity
                    key={`${m.slot}-${i}`}
                    style={[styles.meal, wide && styles.mealWide]}
                    activeOpacity={0.88}
                    onPress={() => openMeal(day, m)}
                    accessibilityRole="button"
                    accessibilityLabel={`${slotLabel(m.slot, plan.prefs)}: ${recipeName(r)}`}
                  >
                    <RecipeImage recipeId={r.id} slot={m.slot} height={wide ? 150 : 170} radius={14} />
                    <View style={styles.mealBody}>
                      <Text style={styles.slot}>
                        {slotLabel(m.slot, plan.prefs)}
                        {m.leftover ? ` · ${t('leftovers from yesterday')}` : ''}
                      </Text>
                      <Text style={styles.mealName}>{recipeName(r)}</Text>
                      <Text style={styles.mealMeta}>{m.leftover ? t('just heat it') : `${r.minutes} min`}</Text>
                      <View style={styles.mealMacros}>
                        <MacroDonut
                          m={{ kcal: r.nutrients.kcal * m.portion, protein: r.nutrients.protein * m.portion, carbs: r.nutrients.carbs * m.portion, fat: r.nutrients.fat * m.portion }}
                          size={52}
                          legend="inline"
                        />
                      </View>
                      {m.note ? <Text style={styles.mealNote}>“{m.note}”</Text> : null}
                      {isToday ? (
                        <TouchableOpacity
                          style={[styles.eatBtn, on && styles.eatBtnOn]}
                          onPress={() => toggleEaten(i)}
                          hitSlop={6}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={on ? t('Eaten') : t('Mark as eaten')}
                        >
                          <FMark on={on} size={18} />
                          <Text style={[styles.eatText, on && styles.eatTextOn]}>{on ? t('Eaten') : t('Mark as eaten')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
            <View>
              <View style={styles.weekRow}>
                <View style={styles.weekLabel} />
                {WEEKDAYS_SHORT.map((d, i) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.weekHead, wide && styles.weekCellWide]}
                    onPress={() => {
                      setDay(i);
                      setView('day');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t(WEEKDAYS_LONG[i])}
                  >
                    <Text style={[styles.weekHeadText, i === todayIndex() && { color: FINE.jade }]}>{t(d)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {slots.map((slot, si) => (
                <View key={`${slot}-${si}`} style={styles.weekRow}>
                  <View style={styles.weekLabel}>
                    <Text style={styles.weekLabelText}>{slotLabel(slot, plan.prefs)}</Text>
                  </View>
                  {plan.days.map((d) => {
                    const m = d.meals[si];
                    const r = m && getRecipe(m.recipeId);
                    return (
                      <TouchableOpacity
                        key={d.day}
                        style={[styles.weekCell, wide && styles.weekCellWide]}
                        onPress={() => m && openMeal(d.day, m)}
                        disabled={!m}
                        accessibilityRole="button"
                        accessibilityLabel={r ? `${t(WEEKDAYS_LONG[d.day])}, ${slotLabel(slot, plan.prefs)}: ${recipeName(r)}` : undefined}
                      >
                        {r ? (
                          <>
                            <RecipeImage recipeId={r.id} slot={slot} size={wide ? 104 : 76} radius={10} />
                            <Text style={styles.weekName} numberOfLines={3}>
                              {recipeName(r)}
                            </Text>
                          </>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* La semana en cifras, grandes y ligeras (prototipo, `.nums`) */}
        <SecHead title={t('This week')} />
        <View style={styles.stats}>
          <Stat label={t('Oily fish')} value={String(summary.oilyFish)} />
          <Stat label={t('Legumes')} value={String(summary.legumes)} />
          <Stat label={t('Red meat')} value={String(summary.redMeat)} />
          <Stat label={t('Week')} value={`~${Math.round(summary.cost)} €`} />
        </View>

        <View style={styles.buttons}>
          <FButton label={t('Shopping list')} icon="cart-outline" onPress={() => router.push({ pathname: '/shopping-list', params: { plan: plan.id } })} />
          <View style={styles.links}>
            <FLink
              label={t('Menu and list as PDF')}
              icon="document-text-outline"
              onPress={() =>
                shareHtmlPdf({ html: menuToHtml(plan), fileName: menuFileName(), fallbackText: shoppingText(plan), dialogTitle: t('Send your menu') }).catch(() => undefined)
              }
            />
            <FLink label={t('Another version')} icon="shuffle-outline" onPress={another} busy={busy} />
          </View>
          <FLink label={t('Change my answers')} muted onPress={() => router.push('/diet-new')} />
        </View>

        <Text style={styles.safety}>
          {t('This menu follows dietary guidelines and your answers. If you take medication (for diabetes, blood pressure or anticoagulants) or have a condition, check it with your doctor or a dietitian.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={2}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { gap: 8, marginTop: 8, marginBottom: 22 },
  kicker: { ...fine.kicker, marginTop: 6 },
  headText: { ...ff('medium'), color: FINE.ivory, fontSize: 17, lineHeight: 23, marginTop: 4 },
  quote: { ...fine.note, color: '#CFD6CF', marginTop: 6 },
  headRows: { marginTop: 8, borderTopWidth: 1, borderTopColor: FINE.line },
  reasons: { gap: 12, paddingBottom: 14, paddingLeft: 27, borderBottomWidth: 1, borderBottomColor: FINE.line },
  reason: { gap: 2 },
  eatenCount: { ...fine.rowSub, marginTop: 2 },
  comet: { marginTop: 4, marginHorizontal: -8 },
  eatBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, minHeight: 36, borderWidth: 1, borderColor: FINE.jadeLine, borderRadius: 20, paddingVertical: 6, paddingLeft: 8, paddingRight: 14, marginTop: 12 },
  eatBtnOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  eatText: { ...ff('regular'), color: FINE.jade, fontSize: 13 },
  eatTextOn: { color: FINE.ivory },
  caution: { gap: 10, paddingTop: 4, paddingBottom: 18, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: FINE.line },
  cautionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cautionTitle: { ...ff('medium'), color: FINE.gold, fontSize: 15, flex: 1 },
  cautionFoot: { ...fine.note, marginTop: 0 },
  cautionBtns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 },
  reasonTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 14 },
  reasonText: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  toggle: { marginTop: 22, marginBottom: 14 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dayCol: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48 },
  dayDot: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(240,239,230,0.22)', alignItems: 'center', justifyContent: 'center' },
  dayDotOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  dayText: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  dayTextOn: { ...ff('medium'), color: FINE.ivory },
  todayMark: { width: 4, height: 4, borderRadius: 2 },
  todayMarkOn: { backgroundColor: FINE.jade },
  dayTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 19, lineHeight: 24, marginTop: 6 },
  dayTotalsBox: { gap: 10, paddingVertical: 14, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: FINE.line },
  dayTotals: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  mealMacros: { marginTop: 8 },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  meal: { paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: FINE.line },
  mealWide: { width: '48%' },
  mealBody: { paddingTop: 12, gap: 2 },
  slot: { ...fine.kicker },
  mealName: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 21, marginTop: 2 },
  mealMeta: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  mealNote: { ...fine.note, color: '#CFD6CF', marginTop: 6 },
  weekRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10 },
  weekLabel: { width: 64, paddingTop: 6 },
  weekLabelText: { ...fine.kicker, fontSize: 10 },
  weekHead: { width: 84, alignItems: 'center', paddingVertical: 4 },
  weekHeadText: { ...ff('medium'), color: FINE.ivory, fontSize: 12 },
  weekCell: { width: 84, gap: 5 },
  weekCellWide: { width: 112 },
  weekName: { ...ff('regular'), color: '#CFD6CF', fontSize: 10.5, lineHeight: 13 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line },
  stat: { flex: 1, paddingVertical: 12, paddingRight: 6, gap: 2 },
  statValue: { ...fine.num, fontSize: 24, lineHeight: 30 },
  statLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 15 },
  buttons: { gap: 4, marginTop: 24 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22, marginTop: 6 },
  safety: { ...fine.note, marginTop: 18 },
});
