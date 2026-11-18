import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RecipeImage } from '@/components/diet/RecipeImage';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { Chev, SecHead } from '@/components/fine/Fine';
import { FLink } from '@/components/fine/FineForm';
import { amountText, FOODS, foodName, getRecipe, recipeName, recipeSteps, scale, slotLabel } from '@/data/diet/catalog';
import { loadDietContext } from '@/data/diet/context';
import { dietRepository } from '@/data/diet/dietRepository';
import type { DietPlan, MealSlot, Recipe } from '@/data/diet/types';
import { alternativesForSlot, LabFlag, portionFor } from '@/logic/dietPlanner';
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Ficha de un plato: foto grande, cuánto lleva tu ración, nutrientes, por qué te conviene y cómo se
// hace. Si viene del menú, se puede cambiar por otro que también encaje.
// Rediseño del 2026-11-16 (lenguaje fino): etiquetas con borde, secciones con su cabecera pequeña, ingredientes y
// platos para cambiar en filas con línea fina y cada paso con su número a línea. Sin cajas de color.

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

        <SecHead title={t('Your serving')} />
        <View style={styles.macroCard}>
          <MacroDonut m={n} size={104} />
          <Text style={styles.fibre}>
            {t('Fibre')} {Math.round(n.fiber)} g · {t('Salt')} {num(Math.round((n.sodium * 2.5) / 100) / 10)} g
          </Text>
        </View>

        {hl.length ? (
          <View style={styles.why}>
            <SecHead title={t('Why it suits you')} />
            {hl.map((h) => (
              <View key={h} style={styles.whyRow}>
                <Ionicons name="leaf-outline" size={14} color={FINE.jade} style={{ marginTop: 3 }} />
                <Text style={styles.whyItem}>{h}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.ingHead}>
          <Text style={fine.secTitle} accessibilityRole="header">
            {t('Ingredients')}
          </Text>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={() => setPeople((x) => Math.max(1, x - 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Fewer people')}>
              <Ionicons name="remove-circle-outline" size={24} color={FINE.jade} />
            </TouchableOpacity>
            <Text style={styles.portionValue}>{people === 1 ? t('for you') : t('for {n} people', { n: people })}</Text>
            <TouchableOpacity onPress={() => setPeople((x) => Math.min(8, x + 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('More people')}>
              <Ionicons name="add-circle-outline" size={24} color={FINE.jade} />
            </TouchableOpacity>
          </View>
        </View>
        {r.ingredients.map((i) => (
          <View key={i.food} style={styles.ing}>
            <Text style={styles.ingName}>{foodName(FOODS[i.food])}</Text>
            <Text style={styles.ingAmount}>{amountText(i.food, i.g * portion * people)}</Text>
          </View>
        ))}

        <SecHead title={t('How to make it')} />
        {recipeSteps(r).map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        {plan && slot ? (
          <>
            <FLink label={t('Swap this dish')} icon="swap-horizontal-outline" onPress={() => setSwapping((v) => !v)} style={styles.swap} />
            {swapping &&
              alternatives.map((a, i) => (
                <TouchableOpacity
                  key={a.id}
                  style={[fine.row, i === alternatives.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => swap(a.id)}
                  accessibilityRole="button"
                  accessibilityLabel={recipeName(a)}
                >
                  <RecipeImage recipeId={a.id} slot={slot} size={52} radius={10} />
                  <View style={{ flex: 1 }}>
                    <Text style={fine.rowTitle}>{recipeName(a)}</Text>
                    <Text style={fine.rowSub}>
                      {a.minutes} min · ~{num(Math.round(a.cost * 100) / 100)} €
                    </Text>
                  </View>
                  <Chev />
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
    <Ionicons name={icon as any} size={13} color={FINE.mute} />
    <Text style={styles.tagText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  name: { ...ff('medium'), color: FINE.ivory, fontSize: 24, lineHeight: 30, marginTop: 16 },
  // Etiquetas con borde, sin relleno
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: FINE.line, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  macroCard: { gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: FINE.line },
  fibre: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  ingHead: { ...fine.secHead, justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  portionValue: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, minWidth: 90, textAlign: 'center' },
  why: { gap: 6 },
  whyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  whyItem: { flex: 1, ...fine.body, fontSize: 14, lineHeight: 20 },
  ing: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: FINE.line },
  ingName: { flex: 1, ...fine.body, fontSize: 14.5 },
  ingAmount: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  // Cada paso con su número a línea, en jade
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  stepNum: { ...ff('regular'), width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: FINE.jadeLine, color: FINE.jade, textAlign: 'center', lineHeight: 22, fontSize: 12, overflow: 'hidden' },
  stepText: { flex: 1, ...fine.body, fontSize: 14.5, lineHeight: 21 },
  swap: { marginTop: 14, marginBottom: 4, borderTopWidth: 1, borderTopColor: FINE.line, paddingTop: 14 },
  credit: { ...fine.note, fontSize: 11.5, marginTop: 20 },
});
