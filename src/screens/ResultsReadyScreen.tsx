import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Confetti } from '@/components/Confetti';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { FineButton } from '@/components/fine/FineMeasure';
import { currentReport, markersBackInRange } from '@/data/reportRepository';
import { t } from '@/i18n';
import { FINE, ff } from '@/theme/fine';

// Llegan los resultados. Solo se celebra (rayo + GREAT JOB!! + confeti) si hay logros de verdad:
// marcadores que estaban fuera de rango y han vuelto a él. Si no, un aviso tranquilo.
// Desde el 2026-11-16, en fino sobre el fondo degradado de la app: el rayo a línea dentro de un aro de luz (oro
// al celebrar, jade si no), el confeti solo en jade, oro y marfil, el título ligero y el botón esmeralda.
const CONFETTI = [FINE.jade, FINE.gold, '#F7F3E6'];

export const ResultsReadyScreen = () => {
  const router = useRouter();
  const improved = markersBackInRange(currentReport);
  const celebrate = improved.length > 0;
  const bolt = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bolt, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: false }),
      Animated.spring(text, { toValue: 1, friction: 5, useNativeDriver: false }),
    ]).start();
  }, [bolt, text]);

  const openReport = () => {
    router.replace('/(tabs)');
    router.push('/report-summary');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {celebrate && <Confetti count={90} duration={3200} colors={CONFETTI} />}
      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: bolt,
            transform: [
              { scale: bolt.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
              { rotate: bolt.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
            ],
          }}
        >
          <GlowRing progress={1} colors={ringTones(celebrate ? FINE.gold : FINE.jade)} size={124} stroke={3.5}>
            <Ionicons name={celebrate ? 'flash-outline' : 'document-text-outline'} size={celebrate ? 46 : 40} color={celebrate ? FINE.gold : FINE.ivory} />
          </GlowRing>
        </Animated.View>

        {celebrate && (
          <Animated.Text
            style={[
              styles.greatJob,
              { opacity: text, transform: [{ scale: text.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
            ]}
          >
            {t('GREAT JOB!!')}
          </Animated.Text>
        )}
        <Text style={styles.title} accessibilityRole="header">
          {t('Your results are in')}
        </Text>
        <Text style={styles.teaser}>
          {celebrate
            ? t(improved.length === 1 ? '{n} marker is back in range since your last test, right in step with better sleep and more movement.' : '{n} markers are back in range since your last test, right in step with better sleep and more movement.', { n: improved.length })
            : t('Take a look at your report and your updated plan.')}
        </Text>

        <FineButton label={t('View my report')} onPress={openReport} style={styles.cta} />
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.secondary} hitSlop={8} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t('Later')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  greatJob: { ...ff('light'), color: FINE.gold, fontSize: 32, lineHeight: 38, letterSpacing: 2.5, marginTop: 26 },
  title: { ...ff('light'), color: FINE.ivory, fontSize: 30, lineHeight: 36, letterSpacing: -0.3, marginTop: 14, textAlign: 'center' },
  teaser: { ...ff('regular'), color: '#CFD6CF', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 34 },
  cta: { alignSelf: 'stretch' },
  secondary: { paddingVertical: 14 },
  secondaryText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
