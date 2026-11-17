import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { FMark } from '@/components/fine/FineForm';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { amountText, FOODS, foodName, SECTION_LABEL } from '@/data/diet/catalog';
import { dietRepository, shoppingChecks } from '@/data/diet/dietRepository';
import type { DietPlan, ShopSection } from '@/data/diet/types';
import { shoppingList } from '@/logic/dietPlanner';
import { num, t } from '@/i18n';
import { menuFileName, menuToHtml, shoppingText } from '@/utils/menuPdf';
import { shareHtmlPdf } from '@/utils/shareHtml';
import { expectSystemUi } from '@/utils/systemUi';
import { FINE, ff, fine } from '@/theme/fine';

// Lista de la compra de la semana, por secciones del súper, con casillas y el coste aproximado.
// Rediseño del 2026-11-16 (lenguaje fino): secciones con su cabecera pequeña, cada cosa en una fila con línea fina y
// un círculo para marcarla; compartir y PDF como etiquetas con borde en jade.
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

  // Lo que falta por comprar, con la cabecera de la marca (lo ya marcado no se manda)
  const text = () => (plan ? shoppingText(plan, checked) : '');

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
    // El menú de compartir sale encima de la app: que el bloqueo no la tape con la K (src/utils/systemUi.ts)
    expectSystemUi();
    await Share.share({ message });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Shopping list')} showBack backFallback="/diet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.total}>{t('About {v} € for the week', { v: num(Math.round(total)) })}</Text>
          <TouchableOpacity style={styles.share} onPress={share} accessibilityRole="button">
            <Ionicons name={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} size={15} color={FINE.jade} />
            <Text style={styles.shareText}>{copied ? t('Copied') : Platform.OS === 'web' ? t('Copy') : t('Share')}</Text>
          </TouchableOpacity>
          {plan ? (
            <TouchableOpacity
              style={styles.share}
              onPress={() => shareHtmlPdf({ html: menuToHtml(plan), fileName: menuFileName(), fallbackText: text(), dialogTitle: t('Send your menu') }).catch(() => undefined)}
              accessibilityRole="button"
              accessibilityLabel="PDF"
            >
              <Ionicons name="document-text-outline" size={15} color={FINE.jade} />
              <Text style={styles.shareText}>PDF</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.hint}>{t('Amounts for the whole week, as they go into the recipes (raw weight). Rinse tinned legumes.')}</Text>
        {ORDER.map((sec) => {
          const list = items.filter((i) => FOODS[i.food]?.section === sec);
          if (!list.length) return null;
          return (
            <View key={sec}>
              <SecHead title={t(SECTION_LABEL[sec])} style={styles.secHead} />
              {list.map((i, k) => {
                const on = checked.includes(i.food);
                return (
                  <TouchableOpacity
                    key={i.food}
                    style={[styles.item, k === list.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => toggle(i.food)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <FMark on={on} />
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
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  total: { flex: 1, ...ff('medium'), color: FINE.ivory, fontSize: 17, lineHeight: 22 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, borderWidth: 1, borderColor: FINE.jadeLine, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  shareText: { ...ff('regular'), color: FINE.jade, fontSize: 12.5 },
  hint: { ...fine.note, marginTop: 6 },
  secHead: { marginTop: 24, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 48, borderBottomWidth: 1, borderBottomColor: FINE.line },
  itemName: { flex: 1, ...fine.body, fontSize: 14.5 },
  itemAmount: { ...ff('regular'), color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  done: { color: FINE.mute, textDecorationLine: 'line-through' },
});
