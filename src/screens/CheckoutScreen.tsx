import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FButton, FLink } from '@/components/fine/FineForm';
import { PathEmblem } from '@/components/fine/RoleEmblem';
import { CHECK_PATH } from '@/components/PlanComparison';
import { CatalogTest, findTest, formatPrice, localizeTest, totalPrice } from '@/data/testCatalog';
import { t } from '@/i18n';
import { expectSystemUi } from '@/utils/systemUi';
import { getOrderStatus, startCheckout } from '@/data/orders';
import { FINE, ff, fine } from '@/theme/fine';

type Stage = 'review' | 'starting' | 'simulated' | 'confirming' | 'paid' | 'pending' | 'cancelled' | 'error';

// Los dibujos a línea del resultado (24 × 24, como los de fine/RoleEmblem): un reloj para «pendiente» y una × para
// «cancelado» o «ha fallado»; la marca de hecho es la de las tablas de suscripción (CHECK_PATH)
const CLOCK_PATH = 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16zM12 8v4.5l3 2';
const CROSS_PATH = 'M7.5 7.5l9 9M16.5 7.5l-9 9';

const findProduct = (id?: string): CatalogTest | undefined => {
  const p = id ? findTest(id) : undefined;
  return p && p.orderable !== false ? localizeTest(p) : undefined;
};

// Pago de un test o plan (?id=) o de varios tests juntos (?ids=a,b, desde el cuestionario). Con Revolut configurado abre su página de pago segura (la app
// nunca ve la tarjeta) y espera a que el webhook confirme el cobro. Sin Revolut (o en
// modo demo) muestra un pago SIMULADO que no cobra nada. Las pruebas sin precio decidido no llegan
// al servidor (no las vende): se simula la solicitud y no se cobra nada.
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17: lo que se pide en filas con una línea fina y el total
// como cifra ligera, sin iconos; la simulación en una tarjeta casi transparente con borde de oro y el resultado con un
// dibujo a línea en un aro fino (jade si ha ido bien), en lugar del círculo relleno.
export const CheckoutScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; ids?: string; status?: string; order_id?: string }>();
  const items = (params.ids ? params.ids.split(',') : params.id ? [params.id] : [])
    .map(findProduct)
    .filter((p): p is CatalogTest => !!p && (!params.ids || !p.perYear)); // los planes no van en un pedido conjunto
  const product = items[0];
  const total = totalPrice(items); // null: alguna prueba aún no tiene precio
  const showPrice = (price?: number | null) => (price == null ? t('To be confirmed') : formatPrice(price));
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
    if (total == null) {
      setSimulated(true);
      return setStage('simulated');
    }
    setStage('starting');
    try {
      const start = await startCheckout(items.map((p) => p.id));
      if (start.kind === 'simulated') {
        setSimulated(true);
        return setStage('simulated');
      }
      // La pasarela sale encima de la app: que el bloqueo no la tape con la K (src/utils/systemUi.ts)
      expectSystemUi();
      const result = await WebBrowser.openAuthSessionAsync(start.url, start.returnUrl);
      if (result.type !== 'success') return setStage('review');
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.status === 'success' && typeof queryParams.order_id === 'string') {
        await confirm(queryParams.order_id);
      } else setStage('cancelled');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('Something went wrong'));
      setStage('error');
    }
  };

  if (!product && stage === 'review') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Checkout')} showBack />
        <Text style={[styles.body, styles.pad]}>{t('This product is not available.')}</Text>
      </SafeAreaView>
    );
  }

  const done = stage === 'paid' || stage === 'pending' || stage === 'cancelled' || stage === 'error';
  const isSimulation = stage === 'simulated';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={total == null ? t('Your request') : t('Checkout')} showBack />

        <View style={styles.pad}>
          {/* Varias pruebas juntas (desde el buscador): una fila por prueba con su precio y, debajo, el total */}
          {items.length > 1 && !done && (
            <View style={styles.list}>
              {items.map((p) => (
                <View key={p.id} style={fine.row}>
                  <View style={styles.flex}>
                    <Text style={fine.rowTitle}>{p.name}</Text>
                    <Text style={fine.rowSub}>{t('Sample: {what}', { what: p.sample })}</Text>
                  </View>
                  <Text style={[fine.rowValue, p.price == null && styles.tbd]}>{showPrice(p.price)}</Text>
                </View>
              ))}
              {total != null && <Text style={styles.small}>{t('One-off payment')}</Text>}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('Total')}</Text>
                <Text style={[styles.total, total == null && styles.totalTbd]}>{showPrice(total)}</Text>
              </View>
            </View>
          )}

          {/* Una sola prueba o una suscripción: su nombre, qué incluye con puntos y el total */}
          {items.length === 1 && product && !done && (
            <View>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.small}>
                {product.perYear
                  ? t('Annual subscription · renews every year')
                  : product.price == null
                    ? t('Sample: {what}', { what: product.sample })
                    : t('One-off payment')}
              </Text>
              <Text style={styles.label}>{t("What's included")}</Text>
              {product.includes.map((i) => (
                <View key={i} style={styles.dotRow}>
                  <View style={styles.dot} />
                  <Text style={styles.dotText}>{i}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('Total')}</Text>
                <Text style={[styles.total, product.price == null && styles.totalTbd]}>
                  {showPrice(product.price)}
                  {product.perYear && product.price != null ? <Text style={styles.unit}> {t('/year')}</Text> : null}
                </Text>
              </View>
            </View>
          )}

          {/* Sin precio todavía, o el pago seguro: una nota apagada, sin icono */}
          {(stage === 'review' || stage === 'starting') && total == null ? (
            <Text style={styles.note}>
              {product?.perYear
                ? t("This subscription doesn't have a price yet. You can simulate the request: nothing is charged and no order is created.")
                : t("This test doesn't have a price yet. You can simulate the request: nothing is charged and no order is created.")}
            </Text>
          ) : stage === 'review' || stage === 'starting' ? (
            <Text style={styles.note}>
              {t("You'll pay on Revolut's secure page (card, Apple Pay, Google Pay or Revolut Pay). Kuova never sees or stores your card details.")}
            </Text>
          ) : null}

          {isSimulation && (
            <View style={styles.sim}>
              <Text style={styles.simTitle}>{total == null ? t('Request simulation') : t('Payment simulation')}</Text>
              <Text style={styles.body}>
                {total == null
                  ? t('When the price is decided, this is where you will confirm it and pay. Nothing will be charged.')
                  : t("Payments aren't switched on yet, so this is where Revolut's secure payment page will open. Nothing will be charged.")}
              </Text>
              <FButton label={total == null ? t('Simulate the request') : t('Simulate successful payment')} onPress={() => setStage('paid')} style={styles.simCta} />
              <FLink muted label={total == null ? t('Cancel') : t('Simulate cancelled payment')} onPress={() => setStage('cancelled')} />
            </View>
          )}

          {stage === 'confirming' && (
            <View style={styles.result}>
              <ActivityIndicator color={FINE.jade} />
              <Text style={[styles.body, styles.center]}>{t('Confirming your payment…')}</Text>
            </View>
          )}

          {done && (
            <View style={styles.result}>
              <PathEmblem
                d={stage === 'paid' ? CHECK_PATH : stage === 'pending' ? CLOCK_PATH : CROSS_PATH}
                size={72}
                glow={stage === 'paid'}
                color={stage === 'paid' ? FINE.jade : FINE.mute}
              />
              <Text style={styles.resultTitle}>
                {stage === 'paid'
                  ? total == null
                    ? t('Request simulated')
                    : product?.perYear
                      ? t('Subscription active')
                      : t('Order confirmed')
                  : stage === 'pending'
                    ? t('Payment received')
                    : stage === 'cancelled'
                      ? total == null
                        ? t('Request cancelled')
                        : t('Payment cancelled')
                      : t('Payment failed')}
              </Text>
              <Text style={[styles.body, styles.center]}>
                {stage === 'paid'
                  ? simulated
                    ? total == null
                      ? t('Simulated request: nothing was charged and no order was created.')
                      : t('Simulated payment: nothing was charged and no order was created.')
                    : t("We'll send your first kit or book your appointment in the next few days.")
                  : stage === 'pending'
                    ? t("We're waiting for the bank's confirmation. It will show up in the app in a few minutes.")
                    : stage === 'cancelled'
                      ? t('Nothing was charged. You can try again whenever you like.')
                      : message}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {(stage === 'review' || stage === 'starting') && product && (
        <View style={styles.footer}>
          <FButton label={total == null ? t('Request') : t('Pay {price}', { price: formatPrice(total) })} onPress={pay} busy={stage === 'starting'} />
        </View>
      )}
      {done && (
        <View style={styles.footer}>
          <FButton
            label={stage === 'cancelled' || stage === 'error' ? t('Try again') : t('Done')}
            onPress={() => (stage === 'cancelled' || stage === 'error' ? setStage('review') : router.back())}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 24 },
  pad: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  list: { borderTopWidth: 1, borderTopColor: FINE.line },
  tbd: { color: FINE.mute, fontSize: 13 },
  name: { ...ff('medium'), color: FINE.ivory, fontSize: 19, lineHeight: 25 },
  small: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  label: { ...fine.kicker, marginTop: 18, marginBottom: 4 },
  dotRow: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: FINE.mute, marginTop: 8 },
  dotText: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  // El total: una raya fina encima y la cifra grande y ligera
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: FINE.rule,
    marginTop: 16,
    paddingTop: 12,
  },
  totalLabel: { ...fine.kicker },
  total: { ...fine.num, fontSize: 26, lineHeight: 32, flexShrink: 1, textAlign: 'right' },
  totalTbd: { ...ff('regular'), color: FINE.mute, fontSize: 15, lineHeight: 20 },
  unit: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  note: { ...fine.note, marginTop: 16 },
  // La simulación es un estado que hay que mirar: tarjeta casi transparente con borde de oro
  sim: { ...fine.tile, padding: 14, borderColor: FINE.goldLine, marginTop: 18, gap: 8 },
  simTitle: { ...fine.kicker, color: FINE.gold },
  simCta: { marginTop: 4 },
  body: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  center: { textAlign: 'center' },
  result: { alignItems: 'center', gap: 12, paddingHorizontal: 8, marginTop: 36 },
  resultTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
});
