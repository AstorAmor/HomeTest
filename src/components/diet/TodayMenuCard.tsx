import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFeature } from '@/data/access';
import { getRecipe, recipeName, slotLabel } from '@/data/diet/catalog';
import { dietRepository, eatenMeals } from '@/data/diet/dietRepository';
import type { DietPlan } from '@/data/diet/types';
import { dayTotals } from '@/logic/dietPlanner';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { Pill } from '@/components/fine/Fine';
import { FButton } from '@/components/fine/FineForm';
import { RecipeImage } from './RecipeImage';
import { MacroDonut } from './MacroDonut';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// En "Alimentación": el menú de hoy (fotos, macros del día y acceso a la semana) o, si aún no hay,
// "Construye tu plan". El menú personalizado va con suscripción (fila 'diet_menu' de los planes).
// Lenguaje fino (2026-11-16): una caja casi transparente con borde fino, la cabecera pequeña en mayúsculas, el donut
// fino y los iconos a línea, sin círculos de color; lo de la suscripción, con borde de oro.

export const DIET_FEATURE = 'diet_menu';
const todayIndex = () => (new Date().getDay() + 6) % 7;

// Bloqueado: lo mismo que "Escanear informes" sin suscripción
export const DietLocked = ({ compact }: { compact?: boolean }) => {
  const router = useRouter();
  return (
    <View style={[styles.card, styles.locked, compact && { marginHorizontal: 0 }]}>
      <Ionicons name="restaurant-outline" size={24} color={FINE.gold} />
      <Text style={[styles.title, styles.center]}>{t('Your personalised menu comes with a subscription')}</Text>
      <Text style={[styles.text, styles.center]}>
        {t('A week of breakfasts, lunches and dinners made for you: your blood tests, what you like and what sits badly, your budget and your time. With recipes, photos and the shopping list.')}
      </Text>
      <View style={styles.lockedCta}>
        <Pill label={t('See subscriptions')} onPress={() => router.push('/compare-plans')} gold />
      </View>
      <TouchableOpacity onPress={() => router.push('/redeem-code')} hitSlop={8} accessibilityRole="button">
        <Text style={fine.link}>{t('I have a code')}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const TodayMenuCard = () => {
  const router = useRouter();
  const allowed = useFeature(DIET_FEATURE);
  const [plan, setPlan] = useState<DietPlan | null | undefined>(undefined);
  const [eaten, setEaten] = useState<number[]>([]);
  useReloadOnFocus(
    useCallback(async () => {
      const p = await dietRepository.active();
      setPlan(p);
      setEaten(p ? await eatenMeals.get(p.id) : []);
    }, [])
  );

  if (allowed === null || plan === undefined) return <ActivityIndicator color={FINE.jade} style={{ marginVertical: 20 }} />;
  if (!allowed) return <DietLocked />;

  if (!plan) {
    return (
      <View style={styles.card}>
        <Text style={styles.badge}>{t('Your food plan')}</Text>
        <Text style={styles.title}>{t('Build your plan')}</Text>
        <Text style={styles.text}>
          {t('Answer a few questions and get a week of meals made for you, based on your results, what you like and the time you have.')}
        </Text>
        <FButton label={t('Create my menu')} icon="sparkles-outline" onPress={() => router.push('/diet-new')} style={styles.cta} />
      </View>
    );
  }

  const day = plan.days[todayIndex()];
  const totals = day ? dayTotals(day) : null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>{plan.source === 'professional' ? t('From {name}', { name: plan.professionalName || t('your dietitian') }) : t('Your food plan')}</Text>
          <Text style={styles.title}>{t('Today on your menu')}</Text>
          {day && eaten.length ? <Text style={styles.eaten}>{t('{done} of {total} meals eaten today', { done: eaten.length, total: day.meals.length })}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => router.push('/diet')} hitSlop={8} accessibilityRole="link">
          <Text style={fine.link}>{t('See the week')} ›</Text>
        </TouchableOpacity>
      </View>
      {plan.reasons.some((r) => r.caution) ? (
        <TouchableOpacity style={styles.caution} onPress={() => router.push('/diet')} accessibilityRole="button">
          <Ionicons name="medkit-outline" size={15} color={FINE.gold} style={{ marginTop: 1 }} />
          <Text style={styles.cautionText}>{t('Something in your menu to discuss with your doctor. See')}</Text>
        </TouchableOpacity>
      ) : null}
      {totals ? <MacroDonut m={totals} size={80} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {day?.meals.map((m, i) => {
          const r = getRecipe(m.recipeId);
          if (!r) return null;
          return (
            <TouchableOpacity
              key={`${m.slot}-${i}`}
              style={styles.meal}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/recipe', params: { id: r.id, portion: String(m.portion), plan: plan.id, day: String(todayIndex()), slot: m.slot } })}
            >
              <RecipeImage recipeId={r.id} slot={m.slot} size={136} radius={12} />
              <Text style={styles.slot}>
                {eaten.includes(i) ? '✓ ' : ''}
                {slotLabel(m.slot, plan.prefs)}
              </Text>
              <Text style={styles.mealName} numberOfLines={2}>
                {recipeName(r)}
              </Text>
              <Text style={styles.mealMeta}>{Math.round(r.nutrients.kcal * m.portion)} kcal</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={styles.shop}
        onPress={() => router.push({ pathname: '/shopping-list', params: { plan: plan.id } })}
        hitSlop={6}
        accessibilityRole="button"
      >
        <Ionicons name="cart-outline" size={16} color={FINE.jade} />
        <Text style={fine.link}>{t('Shopping list')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  eaten: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, marginTop: 2 },
  // Para comentar con el médico: en oro, sin caja
  caution: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  cautionText: { ...ff('regular'), color: FINE.gold, fontSize: 13, lineHeight: 18, flex: 1 },
  // La caja casi transparente (prototipo, `.tile`), con algo más de aire
  card: { ...fine.tile, padding: 16, marginHorizontal: 20, marginBottom: 16, gap: 12 },
  locked: { alignItems: 'center', borderColor: 'rgba(216,185,120,0.28)' },
  lockedCta: { marginTop: 4 },
  center: { textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  badge: { ...fine.kicker },
  title: { ...ff('medium'), color: FINE.ivory, fontSize: 17, lineHeight: 22, marginTop: 2 },
  text: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19 },
  cta: { alignSelf: 'stretch', marginTop: 4 },
  meal: { width: 136, gap: 2 },
  slot: { ...fine.kicker, fontSize: 10, marginTop: 8 },
  mealName: { ...ff('medium'), color: FINE.ivory, fontSize: 13.5, lineHeight: 18 },
  mealMeta: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
});
