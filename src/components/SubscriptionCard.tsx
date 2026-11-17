import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Tag } from '@/components/fine/Fine';
import { FButton } from '@/components/fine/FineForm';
import { formatPrice, localizeTest, PLANS } from '@/data/testCatalog';
import { getMySubscription, MySubscription } from '@/data/orders';
import { Access, getMyAccess, tierName } from '@/data/access';
import { mockNextTestDate } from '@/data/mockData';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// "My subscription": suscripción activa, renovación, próxima analítica y mejora a Premium. La
// comparación de suscripciones va debajo, en la misma pantalla (SubscriptionScreen).
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17; el fundador: «en suscripción siento que el estilo
// tampoco es coherente: muchos iconos por todas partes». Una tarjeta casi transparente (borde de oro en Premium) con
// el nombre, «Activa» en una etiqueta con borde y las fechas en filas con una línea fina, sin iconos. El código de
// invitación ya no va aquí: está justo debajo, en la comparación (PlanComparison).
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
      <View style={[styles.card, access.tier === 'premium' && styles.premium]}>
        <View style={styles.head}>
          <View style={styles.flex}>
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
          <Tag label={t('Active')} />
        </View>
      </View>
    );
  }

  if (!sub) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('No active subscription')}</Text>
        <Text style={styles.text}>{t('Subscribe to get two full blood tests a year, scan your own lab reports and keep your personalised plan.')}</Text>
      </View>
    );
  }

  const plan = localizeTest(PLANS.find((p) => p.id === sub.productId)!);
  const isPremium = sub.productId === 'premium';
  const rows = [
    sub.since ? { label: t('Member since'), value: longDate(sub.since) } : null,
    sub.renewsOn ? { label: t('Renews on'), value: longDate(sub.renewsOn) } : null,
    // La fecha de la próxima analítica de ejemplo solo en la demo
    sub.sample ? { label: t('Next blood test'), value: longDate(mockNextTestDate) } : null,
  ].filter((r): r is { label: string; value: string } => !!r);

  return (
    <View style={[styles.card, isPremium && styles.premium]}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.title}>{plan.name}</Text>
          <Text style={styles.text}>
            {plan.price != null ? `${formatPrice(plan.price)} ${t('/ year')} · ` : ''}
            {isPremium ? t('test every 3 months') : t('test every 6 months')}
            {sub.sample ? ` · ${t('sample')}` : ''}
          </Text>
        </View>
        <Tag label={t('Active')} gold={isPremium} />
      </View>

      {rows.length > 0 && (
        <View style={styles.rows}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i === rows.length - 1 && styles.lastRow]}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>
      )}

      {!isPremium && <FButton label={t('Upgrade to Premium')} onPress={() => router.push({ pathname: '/checkout', params: { id: 'premium' } })} style={styles.cta} />}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { ...fine.tile, padding: 16 },
  premium: { borderColor: FINE.goldLine },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  title: { ...ff('medium'), color: FINE.ivory, fontSize: 15, lineHeight: 20 },
  text: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  rows: { marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { ...ff('regular'), color: FINE.mute, fontSize: 13, flex: 1 },
  rowValue: { ...ff('regular'), color: FINE.ivory, fontSize: 13, fontVariant: ['tabular-nums'] },
  cta: { marginTop: 12 },
});
