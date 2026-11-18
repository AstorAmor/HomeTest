import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Achievement,
  achievementCategory,
  formatAchievementValue,
  formatReachedDay,
  TIER_COLORS,
  TIER_NAMES,
} from '@/data/achievements';
import { AmbientBackground } from '@/components/AmbientBackground';
import { Pill, SecHead } from '@/components/fine/Fine';
import { FineLink } from '@/components/fine/FineMeasure';
import { BadgeEmblem, badgeTone } from './BadgeEmblem';
import { BadgeShareCard } from './BadgeShareCard';
import { shareBadge } from '@/utils/shareBadge';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Una insignia en grande (tocar una en «Insignias y rachas»). El fundador, 2026-11-16: el detalle «sigue siendo poco
// profesional… hacerla más especial, seria y formal». Ahora es como un estuche de medalla o un diploma: el fondo
// esmeralda de la app, el mismo emblema que en la fila de Plan en grande (BadgeEmblem; el fundador: «entras y
// cambian. Ojo con eso»), el antetítulo pequeño en mayúsculas («INSIGNIA · MOVIMIENTO»), el nombre en letra fina y
// grande, el nivel, una raya corta, y debajo lo que dice el registro: por qué se concedió, desde cuándo y la cifra de
// ahora. Luego los cinco niveles en filas finas y las acciones discretas: compartir (píldora con borde de oro) y cerrar.
// Sin confeti, sin rebote: solo aparece despacio (y nada con «reducir movimiento»).
// La imagen que se comparte (BadgeShareCard, en SVG) va dibujada aquí, invisible, para poder pasarla a PNG.

const useNative = Platform.OS !== 'web';
const SHARE_W = 360; // ancho de la tarjeta invisible; la imagen sale a 1080 × 1350 igualmente
const EMBLEM = 150; // el mismo emblema que en la fila de Plan, en grande

export const BadgeModal = ({ achievement: a, onClose }: { achievement: Achievement | null; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const cardRef = useRef<any>(null);
  const appear = useRef(new Animated.Value(0)).current;
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!a) return;
    if (reduce) {
      appear.setValue(1);
      return;
    }
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [a, appear, reduce]);

  if (!a) return null;
  const earned = a.level > 0 && !!a.tier;
  const metal = badgeTone(a);
  const domId = `kuova-badge-${a.id}`;
  const category = achievementCategory(a);
  const kicker = [t('Badge'), category].filter(Boolean).join(' · ');
  const day = earned ? a.reachedOn?.[a.level - 1] : null;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareBadge({
        svg: cardRef.current,
        domId,
        fileName: `kuova-${a.id}-${a.tier?.toLowerCase() ?? 'badge'}`,
        message: t('I reached {tier} in "{badge}" on Kuova. kuovahealth.com', { tier: t(a.tier!), badge: a.title }),
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <AmbientBackground />
        {/* La imagen para compartir, invisible (se pasa a PNG desde aquí) */}
        <View style={styles.shareCard} nativeID={domId} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <BadgeShareCard ref={cardRef} achievement={a} width={SHARE_W} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: appear,
              transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
            }}
          >
            {/* El emblema y su nombre */}
            <View style={styles.head}>
              <BadgeEmblem achievement={a} size={EMBLEM} />
              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title} accessibilityRole="header">
                {a.title}
              </Text>
              <Text style={[styles.tier, { color: earned ? metal : FINE.mute }]}>
                {earned ? `${t(a.tier!)} · ${t('Level {n} of {total}', { n: a.level, total: TIER_NAMES.length })}` : t('Not yet earned')}
              </Text>
              <View style={styles.rule} />
            </View>

            {/* Lo que dice el registro */}
            {earned ? (
              <View>
                <Field label={t('Awarded for')} value={`${a.description}: ${formatAchievementValue(a, a.thresholds[a.level - 1])}`} />
                {day ? <Field label={t('Level reached on')} value={formatReachedDay(day)} /> : null}
                <Field label={t('Now')} value={formatAchievementValue(a, a.value)} last />
              </View>
            ) : (
              <View>
                <SecHead title={t('How to earn it')} style={styles.firstSec} />
                <Field label={t('What counts')} value={a.description} />
                <Field label={t('First level')} value={t('{tier}, on reaching {value}', { tier: t(TIER_NAMES[0]), value: formatAchievementValue(a, a.thresholds[0]) })} />
                <Field label={t('Now')} value={formatAchievementValue(a, a.value)} last />
              </View>
            )}

            {/* Los cinco niveles */}
            <SecHead title={t('Levels')} />
            {TIER_NAMES.map((tier, i) => {
              const on = a.level > i;
              const date = on ? a.reachedOn?.[i] : null;
              const left = Math.max(0, a.thresholds[i] - a.value);
              const sub = on
                ? date
                  ? t('Reached on {date}', { date: formatReachedDay(date, true) })
                  : t('Reached')
                : a.level === i
                  ? t(left === 1 ? 'Just {value} to go' : '{value} to go', { value: formatAchievementValue(a, left) })
                  : null;
              return (
                <View key={tier} style={[fine.row, i === TIER_NAMES.length - 1 && styles.noLine]}>
                  <View style={[styles.dot, { borderColor: TIER_COLORS[tier] }, on ? { backgroundColor: TIER_COLORS[tier] } : styles.dotOff]} />
                  <View style={styles.flex}>
                    <Text style={[fine.rowTitle, !on && styles.muted, a.level === i + 1 && { color: metal }]}>{t(tier)}</Text>
                    {sub ? <Text style={fine.rowSub}>{sub}</Text> : null}
                  </View>
                  <Text style={[fine.rowValue, !on && styles.muted]}>{formatAchievementValue(a, a.thresholds[i])}</Text>
                </View>
              );
            })}

            {/* Acciones discretas */}
            <View style={styles.actions}>
              {earned ? <Pill label={sharing ? t('Preparing…') : t('Share as an image')} onPress={share} gold /> : null}
              <FineLink label={t('Close')} onPress={onClose} textStyle={styles.closeLink} />
            </View>
          </Animated.View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.close, { top: insets.top + 6 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          hitSlop={10}
        >
          <Ionicons name="close" size={24} color={FINE.ivory} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// Un dato del registro: la etiqueta pequeña en mayúsculas y debajo el valor
function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, last && styles.noLine]}>
      <Text style={fine.kicker}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#061A16' },
  shareCard: { position: 'absolute', top: 0, left: 0, width: SHARE_W, opacity: 0 },
  content: { paddingHorizontal: 24 },
  head: { alignItems: 'center', paddingBottom: 8 },
  kicker: { ...ff('regular'), fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: FINE.mute, marginTop: 18, textAlign: 'center' },
  title: { ...ff('light'), fontSize: 34, lineHeight: 40, letterSpacing: -0.3, color: FINE.ivory, marginTop: 8, textAlign: 'center' },
  tier: { ...ff('regular'), fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 10, textAlign: 'center' },
  rule: { width: 44, height: 1, backgroundColor: FINE.goldLine, marginTop: 22, marginBottom: 6 },
  field: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  fieldValue: { ...ff('regular'), fontSize: 15, lineHeight: 21, color: FINE.ivory, marginTop: 4 },
  firstSec: { marginTop: 8 },
  noLine: { borderBottomWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: FINE.mute },
  dot: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1 },
  dotOff: { backgroundColor: 'transparent', opacity: 0.55 },
  actions: { alignItems: 'center', gap: 10, marginTop: 30 },
  closeLink: { color: FINE.mute },
  close: { position: 'absolute', right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
