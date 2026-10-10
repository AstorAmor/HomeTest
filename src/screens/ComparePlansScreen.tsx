import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { formatPrice, localizeTest, MEMBERSHIP, PREMIUM, testIcon } from '@/data/testCatalog';
import { getMySubscription } from '@/data/orders';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { t } from '@/i18n';

type PlanId = 'membership' | 'premium';

// Qué cambia entre Basic y Premium, en filas: [etiqueta, Basic, Premium] (true = incluido).
const ROWS = (): [string, string | boolean, string | boolean][] => [
  [t('Blood tests a year'), t('2 (full panel + follow-up at 6 months)'), t('4 (full panel + a follow-up every 3 months)')],
  [t('A doctor reviews every result'), true, true],
  [t('Video consultations included'), false, t('5 a year')],
  [t('Personalised plan, trends and reminders'), true, true],
];

// "Compare subscriptions": solo los dos planes, uno junto al otro (sin el resto de la tienda).
export const ComparePlansScreen = () => {
  const router = useRouter();
  const [current, setCurrent] = useState<PlanId | null>(null);

  useReloadOnFocus(
    useCallback(async () => {
      setCurrent((await getMySubscription())?.productId ?? null);
    }, []),
  );

  const plans = [localizeTest(MEMBERSHIP), localizeTest(PREMIUM)];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Compare subscriptions')} showBack backFallback="/subscription" />

        <View style={styles.cols}>
          {plans.map((p) => {
            const isCurrent = current === p.id;
            const premium = p.id === 'premium';
            return (
              <View key={p.id} style={[styles.col, premium && styles.colPremium, isCurrent && styles.colCurrent]}>
                <View style={[styles.icon, premium && { backgroundColor: withAlpha(Colors.amber, 0.18) }]}>
                  <MaterialCommunityIcons name={testIcon(p) as any} size={20} color={premium ? Colors.amber : Colors.accent} />
                </View>
                <Text style={styles.planName}>{premium ? 'Premium' : 'Basic'}</Text>
                <Text style={styles.price}>{formatPrice(p.price)}</Text>
                <Text style={styles.per}>{t('per year')}</Text>
                {isCurrent ? (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentText}>{t('Your current plan')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: '/checkout', params: { id: p.id } })}>
                    <Text style={styles.ctaText}>{current && premium ? t('Upgrade to Premium') : t('Subscribe')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.table}>
          {ROWS().map(([label, basic, premium], i) => (
            <View key={label} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{label}</Text>
              <View style={styles.cells}>
                <Cell value={basic} />
                <Cell value={premium} />
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.link} onPress={() => router.push('/panel-markers')}>
          <Ionicons name="list-outline" size={18} color={Colors.accent} />
          <Text style={styles.linkText}>{t('See which markers each analysis measures')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const Cell = ({ value }: { value: string | boolean }) => (
  <View style={styles.cell}>
    {value === true ? (
      <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
    ) : value === false ? (
      <Text style={styles.dash}>–</Text>
    ) : (
      <Text style={styles.cellText}>{value}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  cols: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 14 },
  col: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 2,
  },
  colPremium: { borderColor: withAlpha(Colors.amber, 0.55) },
  colCurrent: { borderColor: Colors.accent, borderWidth: 2 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  planName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  price: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 4 },
  per: { color: Colors.textMuted, fontSize: 12 },
  cta: { alignSelf: 'stretch', backgroundColor: Colors.accent, borderRadius: 20, paddingVertical: 9, alignItems: 'center', marginTop: 10 },
  ctaText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  currentPill: { alignSelf: 'stretch', backgroundColor: Colors.accentSoft, borderRadius: 20, paddingVertical: 9, alignItems: 'center', marginTop: 10 },
  currentText: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
  table: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    paddingHorizontal: 14,
  },
  row: { paddingVertical: 12, gap: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cells: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, alignItems: 'center' },
  cellText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  dash: { color: Colors.textMuted, fontSize: 16 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginTop: 18 },
  linkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});
