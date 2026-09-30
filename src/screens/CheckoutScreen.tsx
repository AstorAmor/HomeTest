import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { CATALOG, CatalogTest, formatPrice, PLANS, testIcon } from '@/data/testCatalog';
import { getOrderStatus, startCheckout } from '@/data/orders';

type Stage = 'review' | 'starting' | 'simulated' | 'confirming' | 'paid' | 'pending' | 'cancelled' | 'error';

const findProduct = (id?: string): CatalogTest | undefined => [...PLANS, ...CATALOG].find((t) => t.id === id);

// Pago de un test o plan. Con Revolut configurado abre su página de pago segura (la app
// nunca ve la tarjeta) y espera a que el webhook confirme el cobro. Sin Revolut (o en
// modo demo) muestra un pago SIMULADO que no cobra nada.
export const CheckoutScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; status?: string; order_id?: string }>();
  const product = findProduct(params.id);
  const [stage, setStage] = useState<Stage>('review');
  const [message, setMessage] = useState('');
  const [simulated, setSimulated] = useState(false);

  // Vuelta desde Revolut abriendo la app por enlace (si el navegador no la capturó).
  useEffect(() => {
    if (params.status === 'cancelled') setStage('cancelled');
    else if (params.status === 'success' && params.order_id) confirm(params.order_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status, params.order_id]);

  const confirm = async (orderId: string) => {
    setStage('confirming');
    for (let i = 0; i < 8; i++) {
      if ((await getOrderStatus(orderId)) === 'paid') return setStage('paid');
      await new Promise((r) => setTimeout(r, 1500));
    }
    setStage('pending');
  };

  const pay = async () => {
    if (!product) return;
    setStage('starting');
    try {
      const start = await startCheckout(product.id);
      if (start.kind === 'simulated') {
        setSimulated(true);
        return setStage('simulated');
      }
      const result = await WebBrowser.openAuthSessionAsync(start.url, start.returnUrl);
      if (result.type !== 'success') return setStage('review');
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.status === 'success' && typeof queryParams.order_id === 'string') {
        await confirm(queryParams.order_id);
      } else setStage('cancelled');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
      setStage('error');
    }
  };

  if (!product && stage === 'review') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Checkout" showBack />
        <Text style={styles.body}>This product is not available.</Text>
      </SafeAreaView>
    );
  }

  const done = stage === 'paid' || stage === 'pending' || stage === 'cancelled' || stage === 'error';
  const isSimulation = stage === 'simulated';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Checkout" showBack />

        {product && !done && (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.icon}>
                <MaterialCommunityIcons name={testIcon(product) as any} size={20} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.small}>{product.perYear ? 'Annual subscription · renews every year' : 'One-off payment'}</Text>
              </View>
            </View>
            {product.includes.map((i) => (
              <View key={i} style={styles.include}>
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
                <Text style={styles.includeText}>{i}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>
                {formatPrice(product.price)}
                {product.perYear ? <Text style={styles.small}> /year</Text> : null}
              </Text>
            </View>
          </View>
        )}

        {stage === 'review' || stage === 'starting' ? (
          <View style={styles.secure}>
            <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />
            <Text style={styles.small}>
              You'll pay on Revolut's secure page (card, Apple Pay, Google Pay or Revolut Pay). HomeTest never sees or stores your card details.
            </Text>
          </View>
        ) : null}

        {isSimulation && (
          <View style={[styles.card, styles.simCard]}>
            <Text style={styles.simTitle}>Payment simulation</Text>
            <Text style={styles.body}>
              Payments aren't switched on yet, so this is where Revolut's secure payment page will open. Nothing will be
              charged.
            </Text>
            <TouchableOpacity style={styles.cta} onPress={() => setStage('paid')}>
              <Text style={styles.ctaText}>Simulate successful payment</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStage('cancelled')}>
              <Text style={styles.link}>Simulate cancelled payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === 'confirming' && (
          <View style={styles.result}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.body}>Confirming your payment…</Text>
          </View>
        )}

        {done && (
          <View style={styles.result}>
            <View style={[styles.resultIcon, stage !== 'paid' && { backgroundColor: Colors.cardBorder }]}>
              <Ionicons
                name={stage === 'paid' ? 'checkmark' : stage === 'pending' ? 'time-outline' : 'close'}
                size={32}
                color={stage === 'paid' ? Colors.background : Colors.textPrimary}
              />
            </View>
            <Text style={styles.resultTitle}>
              {stage === 'paid'
                ? product?.perYear
                  ? 'Welcome to HomeTest!'
                  : 'Order confirmed'
                : stage === 'pending'
                  ? 'Payment received'
                  : stage === 'cancelled'
                    ? 'Payment cancelled'
                    : 'Payment failed'}
            </Text>
            <Text style={[styles.body, { textAlign: 'center' }]}>
              {stage === 'paid'
                ? simulated
                  ? 'Simulated payment: nothing was charged and no order was created.'
                  : "We'll send your first kit or book your appointment in the next few days."
                : stage === 'pending'
                  ? "We're waiting for the bank's confirmation. It will show up in the app in a few minutes."
                  : stage === 'cancelled'
                    ? 'Nothing was charged. You can try again whenever you like.'
                    : message}
            </Text>
          </View>
        )}
      </ScrollView>

      {(stage === 'review' || stage === 'starting') && product && (
        <TouchableOpacity style={styles.bottomCta} onPress={pay} disabled={stage === 'starting'}>
          {stage === 'starting' ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.ctaText}>Pay {formatPrice(product.price)}</Text>
          )}
        </TouchableOpacity>
      )}
      {done && (
        <TouchableOpacity
          style={styles.bottomCta}
          onPress={() => (stage === 'cancelled' || stage === 'error' ? setStage('review') : router.back())}
        >
          <Text style={styles.ctaText}>{stage === 'cancelled' || stage === 'error' ? 'Try again' : 'Done'}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 6,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  small: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  include: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  includeText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: 10,
    paddingTop: 12,
  },
  totalLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  total: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  secure: { flexDirection: 'row', gap: 8, marginHorizontal: 24, alignItems: 'flex-start' },
  simCard: { borderColor: withAlpha(Colors.amber, 0.55), gap: 10 },
  simTitle: { color: Colors.amber, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  cta: { backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  link: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 4 },
  result: { alignItems: 'center', gap: 12, paddingHorizontal: 28, marginTop: 40 },
  resultIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  resultTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  bottomCta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
});
