import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useFeature } from '@/data/access';
import { getRecipe, recipeName, slotLabel } from '@/data/diet/catalog';
import { dietRepository, eatenMeals } from '@/data/diet/dietRepository';
import type { DietPlan } from '@/data/diet/types';
import { dayTotals } from '@/logic/dietPlanner';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { RecipeImage } from './RecipeImage';
import { MacroDonut } from './MacroDonut';
import { t } from '@/i18n';

// En "Alimentación": el menú de hoy (fotos, macros del día y acceso a la semana) o, si aún no hay,
// "Construye tu plan". El menú personalizado va con suscripción (fila 'diet_menu' de los planes).

export const DIET_FEATURE = 'diet_menu';
const todayIndex = () => (new Date().getDay() + 6) % 7;

// Bloqueado: lo mismo que "Escanear informes" sin suscripción
export const DietLocked = ({ compact }: { compact?: boolean }) => {
  const router = useRouter();
  return (
    <View style={[styles.card, styles.locked, compact && { marginHorizontal: 0 }]}>
      <View style={styles.lockedIcon}>
        <MaterialCommunityIcons name="silverware-fork-knife" size={24} color={Colors.gold} />
      </View>
      <Text style={styles.title}>{t('Your personalised menu comes with a subscription')}</Text>
      <Text style={styles.text}>
        {t('A week of breakfasts, lunches and dinners made for you: your blood tests, what you like and what sits badly, your budget and your time. With recipes, photos and the shopping list.')}
      </Text>
      <TouchableOpacity style={styles.primary} onPress={() => router.push('/compare-plans')}>
        <Text style={styles.primaryText}>{t('See subscriptions')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/redeem-code')} hitSlop={8}>
        <Text style={styles.link}>{t('I have a code')}</Text>
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

  if (allowed === null || plan === undefined) return <ActivityIndicator color={Colors.accent} style={{ marginVertical: 20 }} />;
  if (!allowed) return <DietLocked />;

  if (!plan) {
    return (
      <View style={styles.card}>
        <Text style={styles.badge}>{t('Your food plan')}</Text>
        <Text style={styles.title}>{t('Build your plan')}</Text>
        <Text style={styles.text}>
          {t('Answer a few questions and get a week of meals made for you, based on your results, what you like and the time you have.')}
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/diet-new')}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.background} />
          <Text style={styles.primaryText}>{t('Create my menu')}</Text>
        </TouchableOpacity>
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
        <TouchableOpacity onPress={() => router.push('/diet')} hitSlop={8}>
          <Text style={styles.link}>{t('See the week')}</Text>
        </TouchableOpacity>
      </View>
      {plan.reasons.some((r) => r.caution) ? (
        <TouchableOpacity style={styles.caution} onPress={() => router.push('/diet')}>
          <Ionicons name="medkit-outline" size={15} color={Colors.accent} />
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
      <TouchableOpacity style={styles.shop} onPress={() => router.push({ pathname: '/shopping-list', params: { plan: plan.id } })}>
        <Ionicons name="cart-outline" size={16} color={Colors.accent} />
        <Text style={styles.link}>{t('Shopping list')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  eaten: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  caution: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accentSoft, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  cautionText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginHorizontal: 20, marginBottom: 16, gap: 10 },
  locked: { alignItems: 'center' },
  lockedIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  text: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'stretch', backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 11 },
  primaryText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  meal: { width: 136, gap: 2 },
  slot: { color: Colors.accent, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  mealName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  mealMeta: { color: Colors.textMuted, fontSize: 11 },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
