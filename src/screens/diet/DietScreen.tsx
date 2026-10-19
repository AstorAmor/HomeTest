import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { RecipeImage } from '@/components/diet/RecipeImage';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { DIET_FEATURE, DietLocked } from '@/components/diet/TodayMenuCard';
import { useFeature } from '@/data/access';
import { Colors } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getRecipe, recipeName, slotLabel } from '@/data/diet/catalog';
import { loadDietContext } from '@/data/diet/context';
import { dietRepository } from '@/data/diet/dietRepository';
import type { DietPlan, PlannedMeal } from '@/data/diet/types';
import { dayTotals, generateDiet, weekSummary } from '@/logic/dietPlanner';
import { num, t } from '@/i18n';

// "Tu menú de la semana": por día (fotos grandes, toca para ver la receta) o la semana entera como un
// calendario. Arriba, por qué es así (analíticas y respuestas); abajo, la lista de la compra.

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

  useReloadOnFocus(useCallback(async () => setPlan(await dietRepository.active()), []));
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
    const next = { ...plan, prefs, days: g.days, targets: g.targets, reasons: g.reasons };
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
      </SafeAreaView>
    );
  }

  if (plan === undefined || allowed === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={28} color={Colors.accent} />
            <Text style={styles.heroTitle}>{t('A week of meals made for you')}</Text>
            <Text style={styles.heroText}>
              {t('We ask what you like, what sits badly, your budget and how much you cook, and we take your blood tests into account. You get breakfast, lunch, dinner and snacks for the week, with recipes and the shopping list.')}
            </Text>
          </View>
          <TouchableOpacity style={styles.primary} onPress={() => router.push('/diet-new')}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.background} />
            <Text style={styles.primaryText}>{t('Create my menu')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const cautions = plan.reasons.filter((r) => r.caution);
  const summary = weekSummary(plan.days);
  // Lo que lleva de verdad el menú (media de la semana), no el objetivo: la proteína no se ajusta con las raciones
  const potassium = Math.round(plan.days.reduce((a, d) => a + dayTotals(d).potassium, 0) / Math.max(1, plan.days.length) / 100) * 100;
  const tp = { kcal: num(plan.targets.kcal), protein: Math.round(summary.protein), potassium };
  const current = plan.days[day];
  const totals = current ? dayTotals(current) : null;
  const slots = plan.days[0]?.meals.map((m) => m.slot) ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Weekly menu')} showBack backFallback="/nutrients" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cautions.length ? (
          <View style={styles.caution}>
            <View style={styles.cautionHead}>
              <Ionicons name="warning-outline" size={20} color={Colors.danger} />
              <Text style={styles.cautionTitle}>{t('Attention: see a doctor')}</Text>
            </View>
            {cautions.map((r) => (
              <View key={r.id} style={{ gap: 2 }}>
                <Text style={styles.reasonTitle}>{t(r.title)}</Text>
                <Text style={styles.reasonText}>{t(r.detail, tp)}</Text>
              </View>
            ))}
            <Text style={styles.cautionFoot}>{t('This menu is adapted to it, but it is general guidance: it does not replace your doctor.')}</Text>
            <View style={styles.cautionBtns}>
              <TouchableOpacity style={styles.cautionBtn} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
                <Text style={styles.cautionBtnText}>{t('Find a doctor')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cautionBtnGhost} onPress={() => router.push({ pathname: '/professionals', params: { role: 'dietitian' } })}>
                <Text style={styles.cautionGhostText}>{t('Find a dietitian')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <View style={styles.headCard}>
          <Text style={styles.badge}>{plan.source === 'professional' ? t('From {name}', { name: plan.professionalName || t('your dietitian') }) : t('Made for you')}</Text>
          <Text style={styles.headText}>
            {t('About {kcal} kcal and {protein} g of protein a day', tp)}
          </Text>
          <TouchableOpacity style={styles.whyRow} onPress={() => setShowWhy((v) => !v)}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.whyTitle}>{t('Why this menu')}</Text>
            <Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {showWhy &&
            plan.reasons.filter((r) => !r.caution).map((r) => (
              <View key={r.id} style={styles.reason}>
                <Text style={styles.reasonTitle}>{t(r.title)}</Text>
                <Text style={styles.reasonText}>{t(r.detail, tp)}</Text>
              </View>
            ))}
          {plan.note ? <Text style={styles.note}>“{plan.note}”</Text> : null}
        </View>

        <View style={styles.toggle}>
          {(['day', 'week'] as const).map((v) => (
            <TouchableOpacity key={v} style={[styles.toggleBtn, view === v && styles.toggleOn]} onPress={() => setView(v)}>
              <Text style={[styles.toggleText, view === v && styles.toggleTextOn]}>{v === 'day' ? t('Day') : t('Week')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {view === 'day' ? (
          <>
            <View style={styles.days}>
              {WEEKDAYS_SHORT.map((d, i) => (
                <TouchableOpacity key={d} style={[styles.dayChip, i === day && styles.dayChipOn]} onPress={() => setDay(i)}>
                  <Text style={[styles.dayText, i === day && styles.dayTextOn]}>{t(d)}</Text>
                  {i === todayIndex() ? <View style={styles.todayDot} /> : null}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.dayTitle}>{t(WEEKDAYS_LONG[day])}</Text>
            {totals && (
              <View style={styles.dayCard}>
                <MacroDonut m={totals} size={96} />
                <Text style={styles.dayTotals}>
                  {t('Target')}: {num(plan.targets.kcal)} kcal · {t('fibre')} {Math.round(totals.fiber)} g
                </Text>
              </View>
            )}
            <View style={wide ? styles.mealGrid : undefined}>
              {current?.meals.map((m, i) => {
                const r = getRecipe(m.recipeId);
                if (!r) return null;
                return (
                  <TouchableOpacity key={`${m.slot}-${i}`} style={[styles.meal, wide && styles.mealWide]} activeOpacity={0.88} onPress={() => openMeal(day, m)}>
                    <RecipeImage recipeId={r.id} slot={m.slot} height={wide ? 150 : 170} radius={14} />
                    <View style={styles.mealBody}>
                      <Text style={styles.slot}>
                        {slotLabel(m.slot)}
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
                  <TouchableOpacity key={d} style={[styles.weekHead, wide && styles.weekCellWide]} onPress={() => { setDay(i); setView('day'); }}>
                    <Text style={[styles.weekHeadText, i === todayIndex() && { color: Colors.accent }]}>{t(d)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {slots.map((slot, si) => (
                <View key={`${slot}-${si}`} style={styles.weekRow}>
                  <View style={styles.weekLabel}>
                    <Text style={styles.weekLabelText}>{slotLabel(slot)}</Text>
                  </View>
                  {plan.days.map((d) => {
                    const m = d.meals[si];
                    const r = m && getRecipe(m.recipeId);
                    return (
                      <TouchableOpacity key={d.day} style={[styles.weekCell, wide && styles.weekCellWide]} onPress={() => m && openMeal(d.day, m)} disabled={!m}>
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

        <View style={styles.stats}>
          <Stat icon="fish" label={t('Oily fish')} value={String(summary.oilyFish)} />
          <Stat icon="seed-outline" label={t('Legumes')} value={String(summary.legumes)} />
          <Stat icon="food-steak" label={t('Red meat')} value={String(summary.redMeat)} />
          <Stat icon="cart-outline" label={t('Week')} value={`~${Math.round(summary.cost)} €`} />
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primary} onPress={() => router.push({ pathname: '/shopping-list', params: { plan: plan.id } })}>
            <Ionicons name="cart-outline" size={18} color={Colors.background} />
            <Text style={styles.primaryText}>{t('Shopping list')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={another} disabled={busy}>
            {busy ? <ActivityIndicator color={Colors.accent} /> : <Ionicons name="shuffle" size={18} color={Colors.accent} />}
            <Text style={styles.secondaryText}>{t('Another version')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/diet-new')}>
            <Text style={styles.linkText}>{t('Change my answers')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.safety}>
          {t('This menu follows dietary guidelines and your answers. If you take medication (for diabetes, blood pressure or anticoagulants) or have a condition, check it with your doctor or a dietitian.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const Stat = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.stat}>
    <MaterialCommunityIcons name={icon as any} size={18} color={Colors.accent} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { gap: 8, marginBottom: 18 },
  heroTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  heroText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  headCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 6, marginBottom: 12 },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  headText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  whyTitle: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  reason: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 8, gap: 2 },
  caution: { backgroundColor: Colors.dangerSoft, borderWidth: 1, borderColor: Colors.danger, borderRadius: 16, padding: 14, gap: 10, marginBottom: 12 },
  cautionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cautionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', flex: 1 },
  cautionFoot: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  cautionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cautionBtn: { backgroundColor: Colors.danger, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16 },
  cautionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cautionBtnGhost: { borderWidth: 1, borderColor: Colors.danger, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16 },
  cautionGhostText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  reasonTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  reasonText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  note: { color: Colors.textPrimary, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  toggle: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, padding: 3, marginBottom: 10 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 15 },
  toggleOn: { backgroundColor: Colors.accent },
  toggleText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  toggleTextOn: { color: Colors.background },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginBottom: 10 },
  dayChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  dayChipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  dayText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  dayTextOn: { color: Colors.textPrimary },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent, marginTop: 3 },
  dayTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '900' },
  dayCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 12, gap: 8, marginTop: 6, marginBottom: 12 },
  dayTotals: { color: Colors.textMuted, fontSize: 12 },
  mealMacros: { marginTop: 6 },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  meal: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  mealWide: { width: '48%', marginBottom: 0 },
  mealBody: { padding: 12, gap: 2 },
  slot: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  mealMeta: { color: Colors.textSecondary, fontSize: 12 },
  mealNote: { color: Colors.textPrimary, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  weekRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  weekLabel: { width: 64, paddingTop: 6 },
  weekLabelText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800' },
  weekHead: { width: 84, alignItems: 'center' },
  weekHeadText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  weekCell: { width: 84, gap: 4 },
  weekCellWide: { width: 112 },
  weekName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingVertical: 10 },
  statValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900' },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  buttons: { gap: 10, marginTop: 16 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  link: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  safety: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 14 },
});
