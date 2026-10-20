import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { formatPrice, localizeTest, PLANS, testIcon } from '@/data/testCatalog';
import { getMySubscription, MySubscription } from '@/data/orders';
import { Access, getMyAccess, tierName } from '@/data/access';
import { mockNextTestDate } from '@/data/mockData';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, t } from '@/i18n';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// "My subscription": suscripción activa, renovación, próxima analítica y mejora a Premium. La
// comparación de suscripciones va debajo, en la misma pantalla (SubscriptionScreen).
export const SubscriptionCard = () => {
  const router = useRouter();
  const [sub, setSub] = useDeepState<MySubscription | null>(null);
  const [access, setAccess] = useDeepState<Access | null>(null);
  const [loaded, setLoaded] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      const [s, a] = await Promise.all([getMySubscription(), getMyAccess().catch(() => null)]);
      setSub(s);
      setAccess(a);
      setLoaded(true);
    }, [setSub, setAccess]),
  );

  if (!loaded) return null;

  // Sin pagar, con acceso por invitación (código o dado por Kuova) o como administrador
  if (!sub && access && (access.source === 'code' || access.source === 'admin_grant' || access.source === 'admin')) {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name={access.source === 'admin' ? 'shield-checkmark-outline' : 'gift-outline'} size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {access.source === 'admin' ? t('Admin access') : t('Invitation access · {plan}', { plan: tierName(access.tier) })}
            </Text>
            <Text style={styles.text}>
              {access.source === 'admin'
                ? t('As an admin you can use everything in the app.')
                : access.expiresAt
                  ? t('Everything in {plan} until {date}.', { plan: tierName(access.tier), date: longDate(access.expiresAt.slice(0, 10)) })
                  : t('Everything in {plan}, with no end date.', { plan: tierName(access.tier) })}
            </Text>
          </View>
          <View style={styles.active}>
            <Text style={styles.activeText}>{t('Active')}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!sub) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('No active subscription')}</Text>
        <Text style={styles.text}>{t('Subscribe to get two full blood tests a year, scan your own lab reports and keep your personalised plan.')}</Text>
        <TouchableOpacity onPress={() => router.push('/redeem-code')} hitSlop={8} style={styles.codeLink}>
          <Text style={styles.codeLinkText}>{t('Have an invitation code?')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const plan = localizeTest(PLANS.find((p) => p.id === sub.productId)!);
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
            {formatPrice(plan.price)} {t('/ year')} · {isPremium ? t('test every 3 months') : t('test every 6 months')}
            {sub.sample ? ` · ${t('sample')}` : ''}
          </Text>
        </View>
        <View style={styles.active}>
          <Text style={styles.activeText}>{t('Active')}</Text>
        </View>
      </View>

      <View style={styles.rows}>
        {sub.since && <Row icon="calendar-outline" label={t('Member since')} value={longDate(sub.since)} />}
        {sub.renewsOn && <Row icon="refresh-outline" label={t('Renews on')} value={longDate(sub.renewsOn)} />}
        {/* La fecha de la próxima analítica de ejemplo solo en la demo */}
        {sub.sample && <Row icon="flask-outline" label={t('Next blood test')} value={longDate(mockNextTestDate)} />}
      </View>

      <View style={styles.actions}>
        {!isPremium && (
          <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: '/checkout', params: { id: 'premium' } })}>
            <Text style={styles.ctaText}>{t('Upgrade to Premium')}</Text>
          </TouchableOpacity>
        )}
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
  codeLink: { alignSelf: 'center', paddingVertical: 2 },
  codeLinkText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
});
