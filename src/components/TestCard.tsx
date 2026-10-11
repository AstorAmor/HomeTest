import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { CatalogTest, formatPrice, testIcon } from '@/data/testCatalog';
import { t } from '@/i18n';

interface Props {
  test: CatalogTest; // ya pasado por localizeTest
  open: boolean;
  onToggle?: () => void;
  featured?: boolean; // suscripciones: siempre abiertas y con borde dorado
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

// Ficha de un test, la misma en la tienda y en el cuestionario "¿Qué analítica pido?":
// qué es, para qué puede servir, qué incluye, cada cuánto repetirlo, muestra y plazo.
export const TestCard = ({ test, open: openProp, onToggle, featured, onOrder, isPaid, isCurrent, hasPlan, selected, onSelect, reasons }: Props) => {
  const router = useRouter();
  const open = openProp || !!featured;
  const selectable = !!onSelect;

  return (
    <TouchableOpacity
      style={[styles.card, featured && styles.featured, selected && styles.cardSelected]}
      activeOpacity={0.9}
      onPress={() => !featured && onToggle?.()}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.catIcon, featured && { backgroundColor: withAlpha(Colors.amber, 0.18) }]}>
          <MaterialCommunityIcons name={testIcon(test) as any} size={18} color={featured ? Colors.amber : Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{test.name}</Text>
          <Text style={styles.desc} numberOfLines={open ? undefined : 2}>
            {test.description}
          </Text>
          {!!reasons?.length && (
            <View style={styles.reasons}>
              <Ionicons name="sparkles-outline" size={12} color={Colors.accent} />
              <Text style={styles.reasonsText}>{t('For: {list}', { list: reasons.join(' · ') })}</Text>
            </View>
          )}
          {!open && (
            <Text style={styles.more}>
              {t('See more')} <Ionicons name="chevron-down" size={12} color={Colors.accent} />
            </Text>
          )}
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.price}>{formatPrice(test.price)}</Text>
          {test.perYear && <Text style={styles.priceUnit}>{t('/year')}</Text>}
          {selectable && (
            <TouchableOpacity
              onPress={onSelect}
              hitSlop={10}
              style={[styles.check, selected && styles.checkOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!selected }}
              accessibilityLabel={test.name}
            >
              {selected && <Ionicons name="checkmark" size={16} color={Colors.background} />}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {open && (
        <View style={styles.details}>
          {!!test.useful && (
            <>
              <Text style={styles.detailLabel}>{t('What it can help with')}</Text>
              <Text style={styles.detailText}>{test.useful}</Text>
            </>
          )}
          <Text style={[styles.detailLabel, !!test.useful && styles.detailGap]}>{t("What's included")}</Text>
          {test.includes.map((i, n) =>
            // En las suscripciones, la primera línea (las analíticas) lleva a la lista de marcadores
            test.perYear && n === 0 ? (
              <TouchableOpacity key={i} style={styles.includeRow} onPress={() => router.push('/panel-markers')}>
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
                <Text style={[styles.includeText, styles.includeLink]}>{i}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
              </TouchableOpacity>
            ) : (
              <View key={i} style={styles.includeRow}>
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
                <Text style={styles.includeText}>{i}</Text>
              </View>
            ),
          )}
          {!!test.repeat && (
            <>
              <Text style={[styles.detailLabel, styles.detailGap]}>{t('When to repeat it')}</Text>
              <Text style={styles.detailText}>{test.repeat}</Text>
            </>
          )}
          <View style={[styles.metaRow, styles.detailGap]}>
            <Ionicons name="flask-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.meta}>{t('Sample: {what}', { what: test.sample })}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.meta}>{test.delivery}</Text>
          </View>
          {test.discreet && (
            <View style={styles.metaRow}>
              <Ionicons name="lock-closed-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.meta}>{t('Results only visible to you. Not shared unless you choose to.')}</Text>
            </View>
          )}

          {selectable ? (
            <TouchableOpacity style={[styles.order, selected && styles.orderDone]} onPress={onSelect}>
              <Text style={[styles.orderText, selected && { color: Colors.accent }]}>
                {selected ? t('Added to your order') : `${t('Add to my order')} · ${formatPrice(test.price)}`}
              </Text>
            </TouchableOpacity>
          ) : onOrder ? (
            <TouchableOpacity style={[styles.order, (isPaid || isCurrent) && styles.orderDone]} disabled={isCurrent} onPress={onOrder}>
              <Text style={[styles.orderText, (isPaid || isCurrent) && { color: Colors.accent }]}>
                {isCurrent
                  ? t('Your current plan')
                  : `${test.perYear ? (hasPlan ? t('Upgrade to Premium') : t('Subscribe')) : isPaid ? t('Order again') : t('Order')} · ${formatPrice(test.price)}`}
              </Text>
            </TouchableOpacity>
          ) : null}

          {!featured && (
            <TouchableOpacity onPress={onToggle} style={styles.lessRow} hitSlop={6}>
              <Text style={styles.more}>
                {t('See less')} <Ionicons name="chevron-up" size={12} color={Colors.accent} />
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  featured: { borderColor: withAlpha(Colors.amber, 0.55), marginBottom: 16 },
  cardSelected: { borderColor: Colors.accent },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  catIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  desc: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  reasons: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  reasonsText: { color: Colors.accent, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  more: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 6 },
  lessRow: { alignSelf: 'center', marginTop: 2 },
  priceBox: { alignItems: 'flex-end', gap: 2 },
  price: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  priceUnit: { color: Colors.textMuted, fontSize: 11 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 6 },
  detailLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detailGap: { marginTop: 6 },
  detailText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  includeText: { color: Colors.textPrimary, fontSize: 13, flexShrink: 1 },
  includeLink: { color: Colors.accent, fontWeight: '700', textDecorationLine: 'underline' },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  meta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  order: { backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 11, alignItems: 'center', marginTop: 8 },
  orderDone: { backgroundColor: Colors.accentSoft },
  orderText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
