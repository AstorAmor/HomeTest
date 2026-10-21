import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { WheelPicker } from '@/components/WheelPicker';
import { InfoButton } from '@/components/InfoButton';
import { profileRepository } from '@/data/profileRepository';
import { dailyGoalsStore, goalsShownStore } from '@/data/dailyGoals';
import { useSections } from '@/data/appPrefs';
import { litres } from '@/data/waterRepository';
import { DailyGoals, effectiveGoals, GoalBasis, GoalKey, goalsShown, GoalsShown, suggestedGoals } from '@/logic/dailyGoals';
import { buildPlan } from '@/logic/plan';
import { dateLocale, t } from '@/i18n';

// Objetivos de «Tu estado de hoy» (Hoy → tocar los círculos): una rueda por objetivo, con lo que se
// sugiere al lado y de dónde sale (tu plan, tu edad o tus pasos con tu peso y altura; (i) con las
// fuentes). Solo se guarda lo que cambias; lo demás sigue a la sugerencia si cambia. Abajo a la derecha
// de cada bloque, «En Hoy» / «Oculto»: qué círculos salen en «Tu estado de hoy» (el agua también).

const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const sleepText = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;

const GOALS: { key: GoalKey; label: string; icon: string; color: string; values: number[]; text: (v: number) => string }[] = [
  { key: 'steps', label: 'Steps', icon: 'footsteps', color: Colors.sky, values: range(1000, 30000, 500), text: (v) => v.toLocaleString(dateLocale()) },
  { key: 'activeKcal', label: 'Active kcal', icon: 'flame', color: Colors.coral, values: range(100, 2000, 50), text: (v) => `${v} kcal` },
  { key: 'sleepMin', label: 'Sleep', icon: 'moon', color: Colors.violet, values: range(300, 600, 15), text: sleepText },
  {
    key: 'distanceM',
    label: 'Distance',
    icon: 'navigate-outline',
    color: Colors.amber,
    values: range(1000, 30000, 500),
    text: (v) => `${(v / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} km`,
  },
  { key: 'waterMl', label: 'Water', icon: 'water-outline', color: Colors.water, values: range(1000, 4000, 100), text: litres },
];

// Por qué ese número: del plan, por edad o calculado con tus pasos, sexo, peso y altura
const BASIS_TEXT: Record<GoalKey, Record<GoalBasis, string>> = {
  steps: { plan: 'Your plan: {v}', age: 'For your age: {v}', body: 'For your age: {v}' },
  sleepMin: { plan: 'Your plan: {v}', age: 'For your age: {v}', body: 'For your age: {v}' },
  activeKcal: { plan: 'Your plan: {v}', age: 'For your steps, sex and weight: {v}', body: 'For your steps, sex and weight: {v}' },
  distanceM: { plan: 'Your plan: {v}', age: 'For your steps and height: {v}', body: 'For your steps and height: {v}' },
  waterMl: { plan: 'Your plan: {v}', age: 'For your sex (EFSA): {v}', body: 'For your sex (EFSA): {v}' },
};

const nearest = (list: number[], v: number) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0);

export const DailyGoalsScreen = () => {
  const router = useRouter();
  const show = useSections();
  const tourScroll = useMemo(makeTourScroll, []);
  const [suggested, setSuggested] = useState<{ goals: DailyGoals; basis: Record<GoalKey, GoalBasis> } | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [changed, setChanged] = useState<Partial<DailyGoals>>({});
  const [wheelKey, setWheelKey] = useState(0); // para recolocar una rueda al volver a la del plan
  const [savedShown, setSavedShown] = useState<Partial<GoalsShown>>({});
  const shown = goalsShown(savedShown, show('bladder'));

  useEffect(() => {
    Promise.all([profileRepository.get().catch(() => null), dailyGoalsStore.get(), goalsShownStore.get()]).then(([profile, saved, savedS]) => {
      const s = suggestedGoals(buildPlan(profile), profile);
      setSuggested(s);
      setChanged(saved ?? {});
      setGoals(effectiveGoals(s.goals, saved));
      setSavedShown(savedS ?? {});
    });
  }, []);

  if (!suggested || !goals) return <SafeAreaView style={styles.safeArea} />;

  const set = (key: GoalKey, value: number) => {
    setGoals((g) => (g ? { ...g, [key]: value } : g));
    setChanged((c) => ({ ...c, [key]: value }));
  };
  const backToPlan = (key: GoalKey) => {
    setGoals((g) => (g ? { ...g, [key]: suggested.goals[key] } : g));
    setChanged((c) => {
      const next = { ...c };
      delete next[key];
      return next;
    });
    setWheelKey((k) => k + 1);
  };
  const toggleShown = (key: GoalKey) => setSavedShown((s) => ({ ...s, [key]: !shown[key] }));
  const save = async () => {
    await Promise.all([dailyGoalsStore.set(changed), goalsShownStore.set(savedShown)]);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, { backgroundColor: Colors.accent }]} onPress={save} accessibilityLabel={t('Save')}>
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('Your daily goals')}</Text>
          <InfoButton topic="daily_goals" size={20} />
        </View>
        <Text style={styles.subtitle}>
          {t('Each circle in “Daily readiness” fills up when you reach its goal. We suggest the ones in your plan; change any of them, and choose which ones show in Today.')}
        </Text>
        {GOALS.map((g, i) => {
          const value = goals[g.key];
          const own = changed[g.key] !== undefined && changed[g.key] !== suggested.goals[g.key];
          return (
            <TourTarget key={g.key} id={i === 0 ? 'goals.first' : `goals.${g.key}`} scroll={tourScroll}>
            <View style={[styles.card, !shown[g.key] && styles.cardHidden]}>
              <View style={styles.head}>
                <Ionicons name={g.icon as any} size={18} color={g.color} />
                <Text style={styles.label}>{t(g.label)}</Text>
                <Text style={styles.value}>{g.text(value)}</Text>
              </View>
              <View style={styles.wheel}>
                <WheelPicker
                  key={`${g.key}-${wheelKey}`}
                  items={g.values.map(g.text)}
                  selectedIndex={nearest(g.values, value)}
                  onChange={(i) => set(g.key, g.values[i])}
                  width={170}
                  itemHeight={36}
                />
              </View>
              <View style={styles.footRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.hint}>{t(BASIS_TEXT[g.key][suggested.basis[g.key]], { v: g.text(suggested.goals[g.key]) })}</Text>
                  {own && (
                    <TouchableOpacity onPress={() => backToPlan(g.key)} hitSlop={8}>
                      <Text style={styles.reset}>{suggested.basis[g.key] === 'plan' ? t('Use the plan one') : t('Use the suggested one')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* Abajo a la derecha: si sale como círculo en Hoy */}
                <TourTarget id={i === 0 ? 'goals.first.shown' : `goals.${g.key}.shown`}>
                  <TouchableOpacity
                    style={[styles.shownToggle, shown[g.key] && { borderColor: g.color, backgroundColor: withAlpha(g.color, 0.12) }]}
                    onPress={() => toggleShown(g.key)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: shown[g.key] }}
                  >
                    <Ionicons name={shown[g.key] ? 'eye-outline' : 'eye-off-outline'} size={14} color={shown[g.key] ? g.color : Colors.textMuted} />
                    <Text style={[styles.shownText, { color: shown[g.key] ? g.color : Colors.textMuted }]}>{shown[g.key] ? t('In Today') : t('Hidden')}</Text>
                  </TouchableOpacity>
                </TourTarget>
              </View>
            </View>
            </TourTarget>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  circleButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  value: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  wheel: { alignItems: 'center', marginTop: 6 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  hint: { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  reset: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  cardHidden: { opacity: 0.6 },
  shownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  shownText: { fontSize: 12, fontWeight: '700' },
});
