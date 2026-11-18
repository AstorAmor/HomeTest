import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LockTag, Tag } from '@/components/fine/Fine';
import { FButton, FLink, FMark, ON_BG } from '@/components/fine/FineForm';
import { CatalogTest, formatPrice } from '@/data/testCatalog';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

interface Props {
  test: CatalogTest; // ya pasado por localizeTest
  open: boolean;
  onToggle?: () => void;
  featured?: boolean; // suscripciones: siempre abiertas, en una tarjeta con borde de oro
  // Tienda: botón de pedir
  onOrder?: () => void;
  isPaid?: boolean;
  isCurrent?: boolean;
  hasPlan?: boolean;
  // Cuestionario: marcar varios y pedirlos juntos
  selected?: boolean;
  onSelect?: () => void;
  reasons?: string[];
}

// Ficha de una prueba, la misma en la tienda, en el buscador «¿Qué prueba pido?» y en los patrones de Digestión:
// qué es, para qué puede servir, qué incluye, qué tener en cuenta, muestra y plazo. Las genéticas (`counselling`)
// llevan el aviso de la consulta de asesoramiento genético y no se piden desde aquí. Sin precio decidido, «Precio por
// confirmar» (ver src/data/testCatalog.ts).
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17; el fundador: «Catálogo de pruebas tampoco está
// actualizada la estética». Antes, una tarjeta con un icono en un círculo de color y cada dato con su icono. Ahora,
// una fila con una línea fina debajo: el nombre, la descripción y, a la derecha, el precio y la flecha. Abierta, lo
// suyo en secciones pequeñas en versalitas y «Qué incluye» con puntos, sin iconos. Las suscripciones (`featured`) van
// en una tarjeta casi transparente con borde de oro, siempre abiertas. La cabecera que abre y cierra, la marca de
// elegir y los botones de dentro son hermanos: en la web un botón no puede ir dentro de otro.
export const TestCard = ({ test, open: openProp, onToggle, featured, onOrder, isPaid, isCurrent, hasPlan, selected, onSelect, reasons }: Props) => {
  const router = useRouter();
  const open = openProp || !!featured;
  const selectable = !!onSelect;
  const priced = test.price != null;
  const withPrice = (label: string) => (priced ? `${label} · ${formatPrice(test.price!)}` : label);
  // Lo que se mide en la extracción del seguimiento solo se puede pedir con la suscripción
  const needsPlan = !!test.withFollowUp && !hasPlan;
  const locked = needsPlan && !!onOrder && !selectable;

  const head = (
    <>
      <View style={styles.text}>
        <Text style={fine.rowTitle}>{test.name}</Text>
        <Text style={fine.rowSub} numberOfLines={open ? undefined : 2}>
          {test.description}
        </Text>
        {!!reasons?.length && <Text style={styles.reasons}>{t('For: {list}', { list: reasons.join(' · ') })}</Text>}
        {test.counselling || locked || isCurrent ? (
          <View style={styles.tags}>
            {test.counselling ? <Tag gold label={t('With genetic counselling')} /> : null}
            {locked ? <LockTag /> : null}
            {isCurrent ? <Tag label={t('Your current plan')} /> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.side}>
        {priced ? (
          <Text style={styles.price}>
            {formatPrice(test.price!)}
            {test.perYear ? <Text style={styles.unit}> {t('/year')}</Text> : null}
          </Text>
        ) : (
          <Text style={styles.priceTbd}>{t('Price to be confirmed')}</Text>
        )}
        {!featured && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />}
      </View>
    </>
  );

  // Lo que se puede hacer con la prueba: pedirla, añadirla al pedido del cuestionario o nada (genéticas y las que
  // pide un médico)
  const action =
    test.orderable === false ? null : selectable ? (
      selected ? (
        <StateButton label={t('Added to your order')} onPress={onSelect!} />
      ) : (
        <FButton label={withPrice(t('Add to my order'))} onPress={onSelect!} style={styles.action} />
      )
    ) : locked ? (
      <Text style={styles.lockedText}>{t('Only with the subscription, in your follow-up')}</Text>
    ) : onOrder && !isCurrent ? (
      isPaid ? (
        <StateButton label={withPrice(t('Order again'))} onPress={onOrder} />
      ) : (
        <FButton
          label={withPrice(
            test.perYear ? (hasPlan ? t('Upgrade to Premium') : t('Subscribe')) : test.withFollowUp ? t('Add to my follow-up') : priced ? t('Order') : t('Request'),
          )}
          onPress={onOrder}
          style={styles.action}
        />
      )
    ) : null;

  return (
    <View style={featured ? styles.tile : styles.row}>
      <View style={styles.headRow}>
        {featured ? (
          <View style={styles.head}>{head}</View>
        ) : (
          <TouchableOpacity style={styles.head} onPress={onToggle} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            {head}
          </TouchableOpacity>
        )}
        {selectable && (
          <TouchableOpacity
            onPress={onSelect}
            hitSlop={10}
            style={styles.mark}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
            accessibilityLabel={test.name}
          >
            <FMark on={!!selected} />
          </TouchableOpacity>
        )}
      </View>

      {open && (
        <View style={styles.details}>
          {/* Genéticas: lo que hay que saber antes, en una tarjeta casi transparente con borde de oro (sin icono) */}
          {test.counselling && (
            <View style={styles.counsel}>
              <Text style={styles.counselTitle}>{t('A genetic counselling consultation is needed')}</Text>
              <Text style={styles.counselText}>
                {t(
                  'Before the test, a doctor decides with you whether it makes sense, requests it and asks for your written consent. After it, a second consultation explains the result to you.',
                )}
              </Text>
            </View>
          )}
          {!!test.useful && (
            <>
              <Text style={styles.label}>{t('What it can help with')}</Text>
              <Text style={styles.p}>{test.useful}</Text>
            </>
          )}
          <Text style={styles.label}>{t("What's included")}</Text>
          {test.includes.map((i, n) =>
            // En las suscripciones, las líneas de las analíticas llevan a la comparativa de marcadores (en jade)
            test.perYear && n < (test.markerLines ?? 1) ? (
              <TouchableOpacity
                key={i}
                style={styles.dotRow}
                onPress={() => router.push({ pathname: '/panel-markers', params: { plan: test.id } })}
                activeOpacity={0.7}
                accessibilityRole="link"
              >
                <View style={[styles.dot, styles.dotJade]} />
                <Text style={[styles.dotText, styles.dotLink]}>{i} ›</Text>
              </TouchableOpacity>
            ) : (
              <View key={i} style={styles.dotRow}>
                <View style={styles.dot} />
                <Text style={styles.dotText}>{i}</Text>
              </View>
            ),
          )}
          {!!test.notes && (
            <>
              <Text style={styles.label}>{t('Good to know')}</Text>
              <Text style={styles.p}>{test.notes}</Text>
            </>
          )}
          {/* Muestra, plazo y privacidad: notas apagadas, sin iconos */}
          <View style={styles.meta}>
            <Text style={styles.metaText}>{t('Sample: {what}', { what: test.sample })}</Text>
            <Text style={styles.metaText}>{test.delivery}</Text>
            {test.discreet && <Text style={styles.metaText}>{t('Results only visible to you. Not shared unless you choose to.')}</Text>}
          </View>

          {action}

          {!featured && <FLink muted label={t('See less')} onPress={() => onToggle?.()} style={styles.less} />}
        </View>
      )}
    </View>
  );
};

// Lo que ya está hecho pero se puede tocar otra vez (añadido al pedido, volver a pedir): borde jade, fondo apenas marcado
function StateButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.state, styles.action]} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <Text style={styles.stateText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Una fila con su línea fina debajo; las suscripciones, en tarjeta con borde de oro
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  tile: { ...fine.tile, padding: 14, borderColor: FINE.goldLine, marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  head: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { flex: 1, minWidth: 0 },
  reasons: { ...ff('regular'), color: FINE.jade, fontSize: 12, lineHeight: 16, marginTop: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 1 },
  price: { ...ff('regular'), color: FINE.ivory, fontSize: 14, fontVariant: ['tabular-nums'] },
  unit: { ...ff('regular'), color: FINE.mute, fontSize: 11 },
  priceTbd: { ...ff('regular'), color: FINE.mute, fontSize: 11, lineHeight: 14, textAlign: 'right', maxWidth: 74 },
  mark: { paddingTop: 1 },
  details: { marginTop: 4 },
  label: { ...fine.kicker, marginTop: 14, marginBottom: 4 },
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  dotRow: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: FINE.mute, marginTop: 8 },
  dotJade: { backgroundColor: FINE.jade },
  dotText: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  dotLink: { color: FINE.jade },
  meta: { marginTop: 12, gap: 3 },
  metaText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17 },
  counsel: { ...fine.tile, borderColor: FINE.goldLine, marginTop: 10 },
  counselTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  counselText: { ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18, marginTop: 4 },
  lockedText: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18, marginTop: 14 },
  action: { marginTop: 14 },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
    backgroundColor: ON_BG,
  },
  stateText: { ...ff('medium'), color: FINE.jade, fontSize: 15 },
  less: { marginTop: 4, minHeight: 36, paddingVertical: 6 },
});
