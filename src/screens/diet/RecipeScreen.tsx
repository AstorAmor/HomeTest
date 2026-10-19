import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RecipeImage } from '@/components/diet/RecipeImage';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { Colors } from '@/constants/colors';
import { amountText, FOODS, foodName, getRecipe, recipeName, recipeSteps, scale, slotLabel } from '@/data/diet/catalog';
import { loadDietContext } from '@/data/diet/context';
import { dietRepository } from '@/data/diet/dietRepository';
import type { DietPlan, MealSlot, Recipe } from '@/data/diet/types';
import { alternativesForSlot, LabFlag, portionFor } from '@/logic/dietPlanner';
import { num, t } from '@/i18n';

// Ficha de un plato: foto grande, cuánto lleva tu ración, nutrientes, por qué te conviene y cómo se
// hace. Si viene del menú, se puede cambiar por otro que también encaje.

const DIET_LABEL: Record<Recipe['diet'], string> = { vegan: 'Vegan', vegetarian: 'Vegetarian', pescatarian: 'Fish, no meat', omnivore: 'With meat' };
const SKILL_LABEL = ['', 'Easy to make', 'Basic cooking', 'Takes some skill'];

// Lo que destaca del plato para esta persona (por la ración que toca)
function highlights(r: Recipe, portion: number, labs: LabFlag[]): string[] {
  const n = scale(r.nutrients, portion);
  const out: string[] = [];
  const low = (m: string[]) => labs.some((l) => l.status === 'low' && m.includes(l.marker));
  const high = (m: string[]) => labs.some((l) => l.status === 'high' && m.includes(l.marker));
  if (low(['ferritin', 'iron', 'transferrin_saturation', 'hemoglobin']) && n.iron >= 3) out.push(t('Iron: {v} mg', { v: num(Math.round(n.iron * 10) / 10) }));
  if (low(['vitamin_d']) && n.vitD >= 2) out.push(t('Vitamin D: {v} µg', { v: num(Math.round(n.vitD * 10) / 10) }));
  if (high(['ldl', 'total_cholesterol', 'non_hdl_cholesterol', 'apob']) && n.fiber >= 8) out.push(t('Fibre: {v} g, good for your cholesterol', { v: Math.round(n.fiber) }));
  if ((high(['triglycerides']) || low(['omega3_total'])) && n.epaDha >= 0.5) out.push(t('Omega-3 from fish: {v} g', { v: num(Math.round(n.epaDha * 10) / 10) }));
  if (high(['glucose', 'hba1c', 'insulin', 'homa_ir']) && n.fiber >= 8 && n.sugars < 15) out.push(t('Slow carbs and fibre, gentle on your blood sugar'));
  if (high(['bp_systolic', 'bp_diastolic']) && n.potassium >= 900 && n.sodium < 600) out.push(t('Low in salt and rich in potassium'));
  if (!out.length && n.protein >= 25) out.push(t('Protein: {v} g', { v: Math.round(n.protein) }));
  if (!out.length && n.fiber >= 8) out.push(t('Fibre: {v} g', { v: Math.round(n.fiber) }));
  return out;
}

export const RecipeScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; portion?: string; plan?: string; day?: string; slot?: MealSlot }>();
  const [recipeId, setRecipeId] = useState(params.id);
  // Tu ración (la que fija el menú según tus calorías) no se enseña como "× 1,25": las cantidades ya salen
  // ajustadas a ti. Lo que se puede cambiar es para cuántas personas cocinas.
  const [portion, setPortion] = useState(Number(params.portion ?? 1) || 1);
  const [people, setPeople] = useState(1);
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [labs, setLabs] = useState<LabFlag[]>([]);
  const [swapping, setSwapping] = useState(false);
  const r = getRecipe(recipeId);

  useEffect(() => {
    loadDietContext().then((c) => setLabs(c.labs));
    if (params.plan) dietRepository.get(params.plan).then(setPlan);
  }, [params.plan]);

  const day = params.day !== undefined ? Number(params.day) : null;
  const slot = params.slot;
  const alternatives = useMemo(() => {
    if (!plan || !slot || day === null) return [];
    const usedToday = plan.days[day]?.meals.map((m) => m.recipeId) ?? [];
    return alternativesForSlot(plan.prefs, labs, slot, usedToday).slice(0, 8);
  }, [plan, slot, day, labs]);

  const swap = async (newId: string) => {
    if (!plan || day === null || !slot) return;
    const newPortion = portionFor(newId, slot, plan.prefs, labs);
    const days = plan.days.map((d) =>
      d.day !== day ? d : { ...d, meals: d.meals.map((m) => (m.slot === slot && m.recipeId === recipeId ? { slot, recipeId: newId, portion: newPortion } : m)) },
    );
    const next = { ...plan, days };
    await dietRepository.save(next);
    setPlan(next);
    setRecipeId(newId);
    setPortion(newPortion);
    setSwapping(false);
  };

  if (!r) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Recipe')} showBack backFallback="/diet" />
      </SafeAreaView>
    );
  }
  const n = scale(r.nutrients, portion);
  const hl = highlights(r, portion, labs);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={slot ? slotLabel(slot) : t('Recipe')} showBack backFallback="/diet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RecipeImage recipeId={r.id} slot={slot} height={Math.min(width * 0.62, 340)} radius={18} />
        <Text style={styles.name}>{recipeName(r)}</Text>
        <View style={styles.tags}>
          <Tag icon="time-outline" text={`${r.minutes} min`} />
          <Tag icon="restaurant-outline" text={t(SKILL_LABEL[r.skill])} />
          <Tag icon="pricetag-outline" text={t('~{v} € per person', { v: num(Math.round(r.cost * portion * 100) / 100) })} />
          <Tag icon="leaf-outline" text={t(DIET_LABEL[r.diet])} />
          {r.tags.includes('batch') ? <Tag icon="repeat-outline" text={t('Good for two days')} /> : null}
        </View>

        <View style={styles.macroCard}>
          <Text style={styles.macroTitle}>{t('Your serving')}</Text>
          <MacroDonut m={n} size={104} />
          <Text style={styles.fibre}>
            {t('Fibre')} {Math.round(n.fiber)} g · {t('Salt')} {num(Math.round((n.sodium * 2.5) / 100) / 10)} g
          </Text>
        </View>

        {hl.length ? (
          <View style={styles.why}>
            <Text style={styles.whyTitle}>{t('Why it suits you')}</Text>
            {hl.map((h) => (
              <Text key={h} style={styles.whyItem}>
                • {h}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.ingHead}>
          <Text style={[styles.section, { marginTop: 0, marginBottom: 0 }]}>{t('Ingredients')}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={() => setPeople((x) => Math.max(1, x - 1))} hitSlop={8} accessibilityLabel={t('Fewer people')}>
              <Ionicons name="remove-circle-outline" size={24} color={Colors.accent} />
            </TouchableOpacity>
            <Text style={styles.portionValue}>{people === 1 ? t('for you') : t('for {n} people', { n: people })}</Text>
            <TouchableOpacity onPress={() => setPeople((x) => Math.min(8, x + 1))} hitSlop={8} accessibilityLabel={t('More people')}>
              <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        </View>
        {r.ingredients.map((i) => (
          <View key={i.food} style={styles.ing}>
            <Text style={styles.ingName}>{foodName(FOODS[i.food])}</Text>
            <Text style={styles.ingAmount}>{amountText(i.food, i.g * portion * people)}</Text>
          </View>
        ))}

        <Text style={styles.section}>{t('How to make it')}</Text>
        {recipeSteps(r).map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        {plan && slot ? (
          <>
            <TouchableOpacity style={styles.secondary} onPress={() => setSwapping((v) => !v)}>
              <Ionicons name="swap-horizontal" size={18} color={Colors.accent} />
              <Text style={styles.secondaryText}>{t('Swap this dish')}</Text>
            </TouchableOpacity>
            {swapping &&
              alternatives.map((a) => (
                <TouchableOpacity key={a.id} style={styles.alt} onPress={() => swap(a.id)}>
                  <RecipeImage recipeId={a.id} slot={slot} size={56} radius={10} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.altName}>{recipeName(a)}</Text>
                    <Text style={styles.altMeta}>
                      {a.minutes} min · ~{num(Math.round(a.cost * 100) / 100)} €
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
          </>
        ) : null}
        <Text style={styles.credit}>{t('Nutrients calculated from USDA FoodData Central. Prices are an estimate.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const Tag = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.tag}>
    <Ionicons name={icon as any} size={13} color={Colors.textSecondary} />
    <Text style={styles.tagText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  name: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  macroCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 10, marginTop: 14 },
  macroTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  fibre: { color: Colors.textMuted, fontSize: 12 },
  ingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  portionValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', minWidth: 90, textAlign: 'center' },
  why: { backgroundColor: Colors.accentSoft, borderRadius: 14, padding: 12, gap: 4, marginTop: 12 },
  whyTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  whyItem: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  section: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  ing: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  ingName: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  ingAmount: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent, color: Colors.background, textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  stepText: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12, marginTop: 16, marginBottom: 8 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 8, marginBottom: 8 },
  altName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  altMeta: { color: Colors.textMuted, fontSize: 12 },
  credit: { color: Colors.textMuted, fontSize: 11, marginTop: 18 },
});
