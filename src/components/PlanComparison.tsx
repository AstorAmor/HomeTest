import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { formatPrice, localizeTest, MEMBERSHIP, PREMIUM, testIcon } from '@/data/testCatalog';
import { getMySubscription } from '@/data/orders';
import { DEFAULT_PLAN_FEATURES, FeatureValue, getMyAccess, loadPlanFeatures, localText, PlanFeatureRow, Tier, TIERS, tierName } from '@/data/access';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { t } from '@/i18n';

type PlanId = 'membership' | 'premium';

// Las dos suscripciones una junto a la otra y, debajo, qué incluye cada nivel (también el gratuito),
// con la columna de tu nivel marcada: la suscripción que pagas o, si no, el acceso que tengas
// (invitación, admin; gratis si nada). Las filas las decide el admin (Más → Suscripciones (admin)).
// Va en «Mi suscripción» y en «Comparar suscripciones».
export const PlanComparison = () => {
  const router = useRouter();
  const [current, setCurrent] = useState<PlanId | null>(null);
  const [mine, setMine] = useState<Tier | null>(null);
  const [rows, setRows] = useDeepState<PlanFeatureRow[]>(DEFAULT_PLAN_FEATURES);

  useReloadOnFocus(
    useCallback(async () => {
      const [sub, access, features] = await Promise.all([getMySubscription(), getMyAccess().catch(() => null), loadPlanFeatures()]);
      const paid = sub?.productId ?? null;
      setCurrent(paid);
      // En la demo el acceso dice premium aunque la suscripción de ejemplo sea Basic: manda la suscripción
      const real = access && access.source !== 'demo' && access.source !== 'legacy' ? access.tier : null;
      setMine(paid ?? real ?? 'free');
      setRows(features.rows);
    }, [setRows]),
  );

  const plans = [localizeTest(MEMBERSHIP), localizeTest(PREMIUM)];

  return (
    <>
        <View style={styles.cols}>
          {plans.map((p) => {
            const isCurrent = (current ?? mine) === p.id;
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
          <View style={[styles.cells, styles.tableHead]}>
            {TIERS.map((tier) => (
              <View key={tier} style={[styles.headCell, tier === mine && styles.mineCell]}>
                <Text style={[styles.headText, tier === mine && styles.mineText]}>{tierName(tier)}</Text>
                {tier === mine && <Text style={styles.mineTag}>{t('Yours')}</Text>}
              </View>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.id} style={[styles.row, styles.rowBorder]}>
              <Text style={styles.rowLabel}>{localText(r.label)}</Text>
              <View style={styles.cells}>
                {TIERS.map((tier) => (
                  <Cell key={tier} value={r.values[tier]} mine={tier === mine} />
                ))}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.link} onPress={() => router.push('/redeem-code')}>
          <Ionicons name="gift-outline" size={18} color={Colors.accent} />
          <Text style={styles.linkText}>{t('Have an invitation code?')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => router.push('/panel-markers')}>
          <Ionicons name="list-outline" size={18} color={Colors.accent} />
          <Text style={styles.linkText}>{t('See which markers each analysis measures')}</Text>
        </TouchableOpacity>
    </>
  );
};

const Cell = ({ value, mine }: { value: FeatureValue; mine: boolean }) => (
  <View style={[styles.cell, mine && styles.mineCell]}>
    {value === true ? (
      <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
    ) : value === false || !value ? (
      <Text style={styles.dash}>–</Text>
    ) : (
      <Text style={styles.cellText}>{localText(value)}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
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
  tableHead: { paddingVertical: 10 },
  headCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  headText: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  mineCell: { backgroundColor: Colors.accentSoft, borderRadius: 8 },
  mineText: { color: Colors.accent },
  mineTag: { color: Colors.accent, fontSize: 10, fontWeight: '700', marginTop: 1 },
  rowLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cells: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  cellText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  dash: { color: Colors.textMuted, fontSize: 16 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, marginTop: 18 },
  linkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});
