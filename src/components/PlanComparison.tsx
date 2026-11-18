import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { FRow, Tag } from '@/components/fine/Fine';
import { ON_BG } from '@/components/fine/FineForm';
import { PathEmblem, PathIcon } from '@/components/fine/RoleEmblem';
import { formatPrice, localizeTest, MEMBERSHIP, PREMIUM } from '@/data/testCatalog';
import { getMySubscription } from '@/data/orders';
import { DEFAULT_PLAN_FEATURES, FeatureValue, getMyAccess, loadPlanFeatures, localText, PlanFeatureRow, Tier, TIERS, tierName } from '@/data/access';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

type PlanId = 'membership' | 'premium';

// Dibujos a línea a 24 × 24, como los de fine/LineEmblem y fine/RoleEmblem (fundador, 2026-11-17: en Básico vs
// Premium «sí que dejaría iconos (aunque más acordes al estilo)»). Antes, la estrella y la corona rellenas de
// MaterialCommunityIcons en un círculo de color; ahora, su contorno fino dentro de un aro: jade Basic, oro Premium.
const STAR_PATH = 'M12 3.6l2.55 5.2 5.7.83-4.13 4.03.98 5.69L12 16.67l-5.1 2.68.98-5.69-4.13-4.03 5.7-.83z';
const CROWN_PATH = 'M5.2 17.5L3.6 8.2l4.7 3.6L12 5.2l3.7 6.6 4.7-3.6-1.6 9.3zM6 20.5h12';
// La marca de «incluido» de las tablas de suscripción (también en PanelMarkersScreen)
export const CHECK_PATH = 'M5 12.5l4.4 4.4L19 7.3';

// Las dos suscripciones una junto a la otra y, debajo, qué incluye cada nivel (también el gratuito),
// con la columna de tu nivel marcada: la suscripción que pagas o, si no, el acceso que tengas
// (invitación, admin; gratis si nada). Las filas las decide el admin (Más → Suscripciones (admin)).
// Va en «Mi suscripción» y en «Comparar suscripciones»; sin márgenes a los lados: los pone la pantalla.
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17: las dos suscripciones en tarjetas casi transparentes
// (la de Premium con borde de oro), la tabla en filas con una línea fina y las marcas a línea, en oro en Premium.
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
              <PathEmblem d={premium ? CROWN_PATH : STAR_PATH} size={44} color={premium ? FINE.gold : FINE.jade} />
              <Text style={styles.planName}>{premium ? 'Premium' : 'Basic'}</Text>
              {p.price != null ? (
                <Text style={styles.price}>
                  {formatPrice(p.price)} <Text style={styles.per}>{t('per year')}</Text>
                </Text>
              ) : (
                <Text style={styles.per}>{t('Price to be confirmed')}</Text>
              )}
              {isCurrent ? (
                <View style={styles.currentBox}>
                  <Tag label={t('Your current plan')} />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cta}
                  onPress={() => router.push({ pathname: '/checkout', params: { id: p.id } })}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {current && premium ? t('Upgrade to Premium') : t('Subscribe')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Qué incluye cada nivel: el nombre de la fila y, debajo, sus tres columnas; la tuya, con el fondo apenas marcado */}
      <View style={[styles.cells, styles.tableHead]}>
        {TIERS.map((tier) => (
          <View key={tier} style={[styles.headCell, tier === mine && styles.mineCell]}>
            <Text style={[styles.headText, tier === 'premium' && styles.goldText, tier === mine && tier !== 'premium' && styles.jadeText]}>{tierName(tier)}</Text>
            {tier === mine && <Text style={[styles.mineTag, tier === 'premium' && styles.goldText]}>{t('Yours')}</Text>}
          </View>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.rowLabel}>{localText(r.label)}</Text>
          <View style={styles.cells}>
            {TIERS.map((tier) => (
              <Cell key={tier} value={r.values[tier]} mine={tier === mine} premium={tier === 'premium'} />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.links}>
        <FRow title={t('What each analysis measures')} onPress={() => router.push('/panel-markers')} />
        <FRow title={t('Invitation code')} onPress={() => router.push('/redeem-code')} />
      </View>
    </>
  );
};

const Cell = ({ value, mine, premium }: { value: FeatureValue; mine: boolean; premium: boolean }) => (
  <View style={[styles.cell, mine && styles.mineCell]}>
    {value === true ? (
      <PathIcon d={CHECK_PATH} size={17} stroke={1.5} color={premium ? FINE.gold : FINE.jade} />
    ) : value === false || !value ? (
      <View style={styles.dash} accessibilityLabel="–" />
    ) : (
      <Text style={styles.cellText}>{localText(value)}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  col: { ...fine.tile, flex: 1, padding: 14, alignItems: 'center', gap: 2 },
  colPremium: { borderColor: FINE.goldLine },
  colCurrent: { borderColor: FINE.jadeLine, backgroundColor: ON_BG },
  planName: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 21, marginTop: 8 },
  price: { ...fine.num, fontSize: 22, lineHeight: 28 },
  per: { ...ff('regular'), color: FINE.mute, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  cta: { ...fine.pill, alignSelf: 'stretch', marginTop: 12 },
  ctaText: { ...fine.pillText },
  currentBox: { minHeight: 36, marginTop: 12, justifyContent: 'center' },
  tableHead: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: FINE.line },
  headCell: { flex: 1, alignItems: 'center', paddingVertical: 5 },
  headText: { ...fine.kicker, textAlign: 'center' },
  goldText: { color: FINE.gold },
  jadeText: { color: FINE.jade },
  mineCell: { backgroundColor: ON_BG, borderRadius: 8 },
  mineTag: { ...ff('regular'), color: FINE.jade, fontSize: 10.5, marginTop: 1 },
  row: { paddingVertical: 11, gap: 8, borderBottomWidth: 1, borderBottomColor: FINE.line },
  rowLabel: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  cells: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, minHeight: 26 },
  cellText: { ...ff('regular'), color: '#CFD6CF', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  dash: { width: 10, height: 1, backgroundColor: FINE.mute, opacity: 0.6 },
  links: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.rule },
});
