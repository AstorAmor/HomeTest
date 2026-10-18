import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { mealRepository, MealEntry } from '@/data/planRepository';
import { mealGroupsStore } from '@/data/digestionRepository';
import { FOOD_GROUPS, FoodGroup, inferFoodGroups } from '@/logic/foodGroups';
import { dateLocale, t } from '@/i18n';
import { logScreenStyles } from './LogBowelScreen';

// Corregir lo que la app dedujo de una comida (opcional: el registro de comidas no cambia). Lo
// confirmado por el usuario pesa sobre lo deducido en los patrones.
export const MealGroupsScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meal, setMeal] = useState<MealEntry | null>(null);
  const [selected, setSelected] = useState<Set<FoodGroup>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([mealRepository.getAll(), mealGroupsStore.getAll()]).then(([meals, overrides]) => {
      const m = meals.find((x) => x.id === id) ?? null;
      setMeal(m);
      if (m) setSelected(new Set(overrides[m.id] ?? inferFoodGroups(m.description).map((g) => g.group)));
    });
  }, [id]);

  const toggle = (g: FoodGroup) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const save = async () => {
    if (!meal) return;
    setSaving(true);
    try {
      await mealGroupsStore.set(meal.id, FOOD_GROUPS.map((g) => g.id).filter((g) => selected.has(g)));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, !!meal && styles.circleButtonActive]} onPress={save} disabled={saving || !meal}>
          <Ionicons name="checkmark" size={22} color={meal ? Colors.background : Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="restaurant-outline" size={24} color={Colors.green} />
          </View>
          <Text style={styles.title}>{t('What did it have?')}</Text>
          {meal && (
            <Text style={styles.subtitle}>
              {meal.description || t('Meal with a photo')} ·{' '}
              {new Date(meal.fecha).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <Text style={styles.subtitle}>{t('We worked it out from what you wrote. Tap to fix anything that is wrong.')}</Text>
        </View>
        <View style={styles.groups}>
          {FOOD_GROUPS.map((g) => {
            const on = selected.has(g.id);
            return (
              <TouchableOpacity key={g.id} style={[styles.group, on && styles.groupOn]} onPress={() => toggle(g.id)} activeOpacity={0.85}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? Colors.accent : Colors.textMuted} />
                <Text style={styles.groupText}>{t(g.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  groups: { gap: 8, marginTop: 16 },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  groupOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  groupText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
});
