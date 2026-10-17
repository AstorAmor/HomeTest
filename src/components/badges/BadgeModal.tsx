import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Achievement, formatAchievementValue, TIER_COLORS, TIER_GRADIENTS, TIER_NAMES } from '@/data/achievements';
import { BadgeShareCard } from './BadgeShareCard';
import { Confetti } from './Confetti';
import { shareBadge } from '@/utils/shareBadge';
import { t } from '@/i18n';

// Insignia a pantalla completa (tocar una medalla en "Tus insignias"): la medalla entra con un
// golpe de escala, cae confeti del color del nivel y se puede compartir como imagen. Debajo, la
// escalera bronce → plata → oro → platino → diamante con lo que pide cada nivel.
// Fondo oscuro fijo en los dos temas: es un momento de celebración.

const BG = '#06140F';
const useNative = Platform.OS !== 'web';

export const BadgeModal = ({ achievement: a, onClose }: { achievement: Achievement | null; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<any>(null);
  const pop = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState(0);
  const [sharing, setSharing] = useState(false);
  const cardWidth = Math.min(width - 48, 380);

  useEffect(() => {
    if (!a) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: useNative }).start();
    setBurst((b) => b + 1);
  }, [a, pop]);

  if (!a) return null;
  const earned = a.level > 0;
  const colors = earned ? [...TIER_GRADIENTS[a.tier!], '#F0B84D', '#FFFFFF', '#3ECDB8'] : [];
  const domId = `kuova-badge-${a.id}`;

  const share = async () => {
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

  const next = a.nextThreshold !== null ? TIER_NAMES[a.level] : null;

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View
            nativeID={domId}
            style={{
              alignSelf: 'center',
              borderRadius: 22,
              overflow: 'hidden',
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                { rotate: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-6deg', '3deg', '0deg'] }) },
              ],
              opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            }}
          >
            <BadgeShareCard ref={cardRef} achievement={a} width={cardWidth} />
          </Animated.View>

          {earned && (
            <TouchableOpacity style={styles.share} onPress={share} disabled={sharing} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={20} color={BG} />
              <Text style={styles.shareText}>{sharing ? t('Preparing…') : t('Share')}</Text>
            </TouchableOpacity>
          )}
          {earned && <Text style={styles.shareHint}>{t('Instagram, WhatsApp, TikTok… as an image')}</Text>}

          <Text style={styles.status}>
            {next
              ? earned
                ? t('Next: {tier} at {value}', { tier: t(next), value: formatAchievementValue(a, a.nextThreshold!) })
                : t('Reach {value} to unlock bronze', { value: formatAchievementValue(a, a.nextThreshold!) })
              : t('Top level reached')}
          </Text>

          <View style={styles.ladder}>
            {TIER_NAMES.map((tier, i) => {
              const on = a.level > i;
              const color = TIER_COLORS[tier];
              return (
                <View key={tier} style={styles.step}>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: color, backgroundColor: on ? color : 'transparent', opacity: on ? 1 : 0.45 },
                    ]}
                  >
                    {on && <Ionicons name="checkmark" size={14} color={BG} />}
                  </View>
                  <Text style={[styles.stepName, { color: on ? color : '#7F958D' }]}>{t(tier)}</Text>
                  <Text style={styles.stepValue}>{formatAchievementValue(a, a.thresholds[i])}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {earned && <Confetti colors={colors} burst={burst} />}

        <TouchableOpacity
          style={[styles.close, { top: insets.top + 10 }]}
          onPress={onClose}
          accessibilityLabel={t('Close')}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        {earned && (
          <TouchableOpacity style={[styles.again, { top: insets.top + 10 }]} onPress={() => setBurst((b) => b + 1)} hitSlop={12}>
            <Ionicons name="sparkles-outline" size={22} color="#F0B84D" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingTop: 56, paddingBottom: 36, paddingHorizontal: 24, alignItems: 'stretch' },
  share: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0B84D',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 36,
    marginTop: 22,
    minWidth: 220,
  },
  shareText: { color: BG, fontSize: 16, fontWeight: '800' },
  shareHint: { color: '#7F958D', fontSize: 12, textAlign: 'center', marginTop: 8 },
  status: { color: '#DDEBE6', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 22 },
  ladder: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, maxWidth: 420, alignSelf: 'center', width: '100%' },
  step: { alignItems: 'center', flex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepName: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  stepValue: { color: '#7F958D', fontSize: 10, marginTop: 2, textAlign: 'center' },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  again: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
});
