import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { amountText, FOODS, foodName, SECTION_LABEL } from '@/data/diet/catalog';
import { dietRepository, shoppingChecks } from '@/data/diet/dietRepository';
import type { DietPlan, ShopSection } from '@/data/diet/types';
import { shoppingList } from '@/logic/dietPlanner';
import { num, t } from '@/i18n';

// Lista de la compra de la semana, por secciones del súper, con casillas y el coste aproximado
const ORDER: ShopSection[] = ['produce', 'meat_fish', 'chilled', 'frozen', 'bakery', 'pantry'];
const STAPLES = new Set(['salt', 'paprika', 'cumin', 'oregano', 'cinnamon']);

export const ShoppingListScreen = () => {
  const { plan: planId } = useLocalSearchParams<{ plan: string }>();
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      const p = planId ? await dietRepository.get(planId) : await dietRepository.active();
      setPlan(p);
      if (p) setChecked(await shoppingChecks.get(p.id));
    }, [planId]),
  );

  const items = useMemo(() => (plan ? shoppingList(plan.days) : []), [plan]);
  const total = items.reduce((a, i) => a + i.cost, 0);

  const toggle = (food: string) => {
    if (!plan) return;
    const next = checked.includes(food) ? checked.filter((x) => x !== food) : [...checked, food];
    setChecked(next);
    shoppingChecks.set(plan.id, next);
  };

  const text = () =>
    ORDER.map((sec) => {
      const list = items.filter((i) => FOODS[i.food]?.section === sec && !checked.includes(i.food));
      return list.length ? `${t(SECTION_LABEL[sec])}\n${list.map((i) => `- ${foodName(FOODS[i.food])}: ${amountText(i.food, i.grams, { whole: true })}`).join('\n')}` : '';
    })
      .filter(Boolean)
      .join('\n\n');

  const share = async () => {
    const message = text();
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // sin permiso de portapapeles: no pasa nada
      }
      return;
    }
    await Share.share({ message });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Shopping list')} showBack backFallback="/diet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.total}>{t('About {v} € for the week', { v: num(Math.round(total)) })}</Text>
          <TouchableOpacity style={styles.share} onPress={share}>
            <Ionicons name={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} size={16} color={Colors.accent} />
            <Text style={styles.shareText}>{copied ? t('Copied') : Platform.OS === 'web' ? t('Copy') : t('Share')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>{t('Amounts for the whole week, as they go into the recipes (raw weight). Rinse tinned legumes.')}</Text>
        {ORDER.map((sec) => {
          const list = items.filter((i) => FOODS[i.food]?.section === sec);
          if (!list.length) return null;
          return (
            <View key={sec} style={{ marginTop: 14 }}>
              <Text style={styles.section}>{t(SECTION_LABEL[sec])}</Text>
              {list.map((i) => {
                const on = checked.includes(i.food);
                return (
                  <TouchableOpacity key={i.food} style={styles.item} onPress={() => toggle(i.food)}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? Colors.textMuted : Colors.accent} />
                    <Text style={[styles.itemName, on && styles.done]}>{foodName(FOODS[i.food])}</Text>
                    <Text style={[styles.itemAmount, on && styles.done]}>{STAPLES.has(i.food) ? t('to taste') : amountText(i.food, i.grams, { whole: true })}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { color: Colors.textPrimary, fontSize: 18, fontWeight: '900' },
  share: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  shareText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  section: { color: Colors.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  itemName: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  itemAmount: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  done: { color: Colors.textMuted, textDecorationLine: 'line-through' },
});
