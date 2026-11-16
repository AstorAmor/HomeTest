import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { InfoButton } from '@/components/InfoButton';
import { Pill } from '@/components/fine/Fine';
import { FineStepper } from '@/components/metas/FineStepper';
import { profileRepository } from '@/data/profileRepository';
import { dailyGoalsStore, goalsShownStore } from '@/data/dailyGoals';
import { useSections } from '@/data/appPrefs';
import { litres } from '@/data/waterRepository';
import { DailyGoals, effectiveGoals, GoalBasis, GoalKey, goalsShown, GoalsShown, suggestedGoals } from '@/logic/dailyGoals';
import { buildPlan } from '@/logic/plan';
import { fmtNum } from '@/logic/metas';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Objetivos de «Tu estado de hoy» (Hoy → tocar los círculos): cada objetivo con su «− número +», lo que se
// sugiere debajo y de dónde sale (tu plan, tu edad o tus pasos con tu peso y altura; (i) con las fuentes). Solo
// se guarda lo que cambias; lo demás sigue a la sugerencia si cambia. A la derecha de cada uno, «En Hoy» /
// «Oculto»: qué círculos salen en «Tu estado de hoy» (el agua también).
// Desde el 2026-11-16, en el lenguaje fino del prototipo de las 4 pestañas: filas con una línea fina, sin
// tarjetas ni iconos de color, la cifra ligera y «− número +» en vez de la ruedita (el fundador: «Your daily
// goals mantiene una estética antigua no coherente con la sobriedad de la nueva»).

const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
const sleepText = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
const dec = (v: number, digits: number) => v.toLocaleString(dateLocale(), { maximumFractionDigits: digits });

// `text`: la cifra con su unidad (para «Para tu edad: 8.000»); `num` y `unit`: lo mismo, con la unidad fuera del − +
const GOALS: { key: GoalKey; label: string; values: number[]; text: (v: number) => string; num: (v: number) => string; unit?: () => string }[] = [
  // Los pasos, con el punto de los miles también en 8.000 (toLocaleString en español no lo pone con 4 cifras)
  { key: 'steps', label: 'Steps', values: range(1000, 30000, 500), text: (v) => fmtNum(v, true), num: (v) => fmtNum(v, true), unit: () => t('steps') },
  { key: 'activeKcal', label: 'Active kcal', values: range(100, 2000, 50), text: (v) => `${v} kcal`, num: (v) => String(v), unit: () => 'kcal' },
  { key: 'sleepMin', label: 'Sleep', values: range(300, 600, 15), text: sleepText, num: sleepText },
  { key: 'distanceM', label: 'Distance', values: range(1000, 30000, 500), text: (v) => `${dec(v / 1000, 1)} km`, num: (v) => dec(v / 1000, 1), unit: () => 'km' },
  { key: 'waterMl', label: 'Water', values: range(1000, 4000, 100), text: litres, num: (v) => dec(v / 1000, 2), unit: () => 'L' },
];

// Por qué ese número: del plan, por edad o calculado con tus pasos, sexo, peso y altura
const BASIS_TEXT: Record<GoalKey, Record<GoalBasis, string>> = {
  steps: { plan: 'Your plan: {v}', age: 'For your age: {v}', body: 'For your age: {v}' },
  sleepMin: { plan: 'Your plan: {v}', age: 'For your age: {v}', body: 'For your age: {v}' },
  activeKcal: { plan: 'Your plan: {v}', age: 'For your steps, sex and weight: {v}', body: 'For your steps, sex and weight: {v}' },
  distanceM: { plan: 'Your plan: {v}', age: 'For your steps and height: {v}', body: 'For your steps and height: {v}' },
  waterMl: { plan: 'Your plan: {v}', age: 'For your sex (EFSA): {v}', body: 'For your sex (EFSA): {v}' },
};

// El paso de antes y el de después en la lista de cada objetivo (lo guardado puede caer entre dos)
const below = (list: number[], v: number) => [...list].reverse().find((x) => x < v) ?? list[0];
const above = (list: number[], v: number) => list.find((x) => x > v) ?? list[list.length - 1];

export const DailyGoalsScreen = () => {
  const router = useRouter();
  const show = useSections();
  const tourScroll = useMemo(makeTourScroll, []);
  const [suggested, setSuggested] = useState<{ goals: DailyGoals; basis: Record<GoalKey, GoalBasis> } | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [changed, setChanged] = useState<Partial<DailyGoals>>({});
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
  };
  const toggleShown = (key: GoalKey) => setSavedShown((s) => ({ ...s, [key]: !shown[key] }));
  const save = async () => {
    await Promise.all([dailyGoalsStore.set(changed), goalsShownStore.set(savedShown)]);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Como la cabecera de las demás pantallas: cerrar en jade, el título y, a la derecha, «Guardar» */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.close} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={24} color={FINE.jade} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
          {t('Your daily goals')}
        </Text>
        <InfoButton topic="daily_goals" size={19} color={FINE.mute} />
        <View style={{ marginLeft: 8 }}>
          <Pill label={t('Save')} onPress={save} />
        </View>
      </View>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          {t('In Today, each figure sits next to its goal. We suggest the ones in your plan; change any of them, and choose which ones show in Today.')}
        </Text>
        {GOALS.map((g, i) => {
          const value = goals[g.key];
          const own = changed[g.key] !== undefined && changed[g.key] !== suggested.goals[g.key];
          const on = shown[g.key];
          return (
            <TourTarget key={g.key} id={i === 0 ? 'goals.first' : `goals.${g.key}`} scroll={tourScroll}>
              <View style={[styles.goal, i === GOALS.length - 1 && styles.goalLast]}>
                <View style={styles.head}>
                  <Text style={[styles.label, !on && styles.dim]}>{t(g.label)}</Text>
                  {/* A la derecha: si sale como círculo en Hoy */}
                  <TourTarget id={i === 0 ? 'goals.first.shown' : `goals.${g.key}.shown`}>
                    <TouchableOpacity
                      style={[styles.shown, on && styles.shownOn]}
                      onPress={() => toggleShown(g.key)}
                      hitSlop={6}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${t(g.label)}: ${on ? t('In Today') : t('Hidden')}`}
                    >
                      <Text style={[styles.shownText, on && styles.shownTextOn]}>{on ? t('In Today') : t('Hidden')}</Text>
                    </TouchableOpacity>
                  </TourTarget>
                </View>
                <FineStepper
                  small
                  value={g.num(value)}
                  unit={g.unit?.()}
                  onMinus={() => set(g.key, below(g.values, value))}
                  onPlus={() => set(g.key, above(g.values, value))}
                  canMinus={value > g.values[0]}
                  canPlus={value < g.values[g.values.length - 1]}
                  dim={!on}
                  style={styles.stepper}
                />
                <View style={styles.hintRow}>
                  <Text style={styles.hint}>{t(BASIS_TEXT[g.key][suggested.basis[g.key]], { v: g.text(suggested.goals[g.key]) })}</Text>
                  {own && (
                    <TouchableOpacity onPress={() => backToPlan(g.key)} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.reset}>{suggested.basis[g.key] === 'plan' ? t('Use the plan one') : t('Use the suggested one')}</Text>
                    </TouchableOpacity>
                  )}
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
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 10, paddingRight: 20, paddingTop: 6, paddingBottom: 12, minHeight: 56 },
  close: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...ff('medium'), flex: 1, fontSize: 19, lineHeight: 24, color: FINE.ivory },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  lead: { ...fine.note, fontSize: 13.5, lineHeight: 19, marginTop: 0, marginBottom: 8 },
  // Cada objetivo: una fila con una línea fina debajo
  goal: { paddingTop: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: FINE.line },
  goalLast: { borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  label: { ...fine.rowTitle, flex: 1 },
  dim: { opacity: 0.5 },
  stepper: { marginTop: 10 },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginTop: 10 },
  hint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17 },
  reset: { ...ff('regular'), color: FINE.jade, fontSize: 12.5 },
  // «En Hoy» / «Oculto»: un chip con borde (jade si sale en Hoy)
  shown: { minHeight: 30, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, justifyContent: 'center' },
  shownOn: { borderColor: FINE.jadeLine },
  shownText: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  shownTextOn: { color: FINE.jade },
});
