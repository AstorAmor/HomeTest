import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { formatPrice, PLANS, testIcon } from '@/data/testCatalog';
import { getMySubscription, MySubscription } from '@/data/orders';
import { mockNextTestDate } from '@/data/mockData';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

import { dateLocale } from '@/i18n';
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// "My subscription": suscripción activa, renovación, próxima analítica y mejora a Premium.
// Se usa en el perfil y en Lab.
export const SubscriptionCard = () => {
  const router = useRouter();
  const [sub, setSub] = useDeepState<MySubscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      setSub(await getMySubscription());
      setLoaded(true);
    }, [setSub]),
  );

  if (!loaded) return null;

  if (!sub) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>No active subscription</Text>
        <Text style={styles.text}>Join to get two full blood tests a year, a doctor's review and your personalised plan.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/store')}>
          <Text style={styles.ctaText}>See subscriptions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const plan = PLANS.find((p) => p.id === sub.productId)!;
  const isPremium = sub.productId === 'premium';

  return (
    <View style={[styles.card, isPremium && styles.premium]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name={testIcon(plan) as any} size={20} color={isPremium ? Colors.amber : Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{plan.name}</Text>
          <Text style={styles.text}>
            {formatPrice(plan.price)} / year · {isPremium ? 'test every 3 months' : 'test every 6 months'}
            {sub.sample ? ' · sample' : ''}
          </Text>
        </View>
        <View style={styles.active}>
          <Text style={styles.activeText}>Active</Text>
        </View>
      </View>

      <View style={styles.rows}>
        {sub.since && <Row icon="calendar-outline" label="Member since" value={longDate(sub.since)} />}
        {sub.renewsOn && <Row icon="refresh-outline" label="Renews on" value={longDate(sub.renewsOn)} />}
        <Row icon="flask-outline" label="Next blood test" value={longDate(mockNextTestDate)} />
      </View>

      <View style={styles.actions}>
        {!isPremium && (
          <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: '/checkout', params: { id: 'premium' } })}>
            <Text style={styles.ctaText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondary} onPress={() => router.push('/store')}>
          <Text style={styles.secondaryText}>Compare subscriptions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Row = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.row}>
    <Ionicons name={icon as any} size={15} color={Colors.textSecondary} />
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  premium: { borderColor: Colors.amber },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  text: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  active: { backgroundColor: Colors.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  activeText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  rows: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cta: { flex: 1, backgroundColor: Colors.accent, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  ctaText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  secondary: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
});
