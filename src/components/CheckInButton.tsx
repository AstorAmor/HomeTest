// El check-in de Hoy (fundador, 2026-11-05): un botón redondo con la carita y, alrededor, un donut de 3
// tramos que se llena con los check-ins del día (mañana, mediodía, noche).
// - Modo claro: círculo blanco y la carita en verde KUOVA (fundador, 2026-11-05: el verde de fondo
//   quedaba mal). Oscuro: degradado ámbar → dorado.
// - El tramo nuevo se rellena poco a poco y el donut va cogiendo color (más intenso con cada uno).
// - Al completar los 3 (justo después de guardar el tercero): el anillo se cierra, la carita sale hacia
//   delante y Hoy suelta confeti (`onComplete`).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { checkInSavedRecently, clearCheckInSaved } from '@/logic/checkInCelebration';
import { t } from '@/i18n';

export const CHECKINS_PER_DAY = 3;

const SIZE = 132;
const STROKE = 8;
const GAP = 0.035; // hueco entre tramos (fracción de la vuelta)
const KUOVA_GREEN = '#0E2A24';
const KUOVA_GOLD = '#C9A366';
// El donut coge color con cada check-in: dorado suave, dorado y dorado KUOVA
const FILL = ['#E3CFA3', '#D6B97F', KUOVA_GOLD];
const useNative = Platform.OS !== 'web';

// Un número que va hacia `target` en `ms` (para los trazos del SVG, que no se animan solos en todas partes)
function useTween(target: number, ms: number): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const now = start + (target - start) * eased;
      from.current = now;
      setV(now);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function CheckInButton({ done, onPress, onComplete }: { done: number; onPress: () => void; onComplete?: () => void }) {
  const c = SIZE / 2;
  const r = (SIZE - STROKE) / 2;
  const n = Math.max(0, Math.min(CHECKINS_PER_DAY, done));
  const full = n >= CHECKINS_PER_DAY;
  const progress = useTween(n, 650); // 0..3, con decimales mientras se rellena
  const closed = useTween(full ? 1 : 0, 450); // los huecos se cierran al completar
  const scale = useRef(new Animated.Value(full ? 1.08 : 1)).current;
  const prev = useRef(n);

  useEffect(() => {
    const was = prev.current;
    prev.current = n;
    if (n >= CHECKINS_PER_DAY && was < CHECKINS_PER_DAY && checkInSavedRecently()) {
      clearCheckInSaved();
      // La carita sale hacia delante y se queda un poco más grande
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.32, duration: 260, easing: Easing.out(Easing.back(2)), useNativeDriver: useNative }),
        Animated.spring(scale, { toValue: 1.08, friction: 4, tension: 60, useNativeDriver: useNative }),
      ]).start();
      onComplete?.();
    } else if (n < CHECKINS_PER_DAY) {
      scale.setValue(1);
    } else {
      scale.setValue(1.08);
    }
  }, [n, scale, onComplete]);

  const point = (f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2;
    return `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
  };
  const gap = GAP * (1 - closed);
  const seg = (i: number, part = 1) => {
    const from = i / CHECKINS_PER_DAY + gap / 2;
    const to = from + (1 / CHECKINS_PER_DAY - gap) * part;
    return `M ${point(from)} A ${r} ${r} 0 0 1 ${point(to)}`;
  };
  const fill = FILL[Math.max(0, Math.ceil(progress) - 1)] ?? KUOVA_GOLD;
  const inner = SIZE - STROKE * 2 - 12;
  const caption = full ? t('All 3 check-ins done today') : t('{n} of {total} check-ins today', { n, total: CHECKINS_PER_DAY });
  const light = Colors.isLight;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${t('Check in')}. ${caption}`}>
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            {Array.from({ length: CHECKINS_PER_DAY }, (_, i) => (
              <Path key={`b${i}`} d={seg(i)} stroke={Colors.divider} strokeWidth={STROKE} strokeLinecap={closed > 0.95 ? 'butt' : 'round'} fill="none" />
            ))}
            {Array.from({ length: CHECKINS_PER_DAY }, (_, i) => {
              const part = Math.max(0, Math.min(1, progress - i));
              if (part < 0.01) return null;
              return <Path key={`f${i}`} d={seg(i, part)} stroke={fill} strokeWidth={STROKE} strokeLinecap={closed > 0.95 ? 'butt' : 'round'} fill="none" />;
            })}
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { transform: [{ scale }] }]}>
            <View style={[styles.disc, { width: inner, height: inner, borderRadius: inner / 2 }, light && styles.discLight, full && light && styles.discGlow]}>
              {!light && (
                <Svg width={inner} height={inner} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="checkinFace" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={Colors.amber} />
                      <Stop offset="1" stopColor={Colors.gold} />
                    </LinearGradient>
                  </Defs>
                  <Circle cx={inner / 2} cy={inner / 2} r={inner / 2} fill="url(#checkinFace)" />
                </Svg>
              )}
              <Ionicons name="happy-outline" size={52} color={KUOVA_GREEN} />
            </View>
          </Animated.View>
        </View>
      </TouchableOpacity>
      <Text style={styles.title}>{t('Check in')}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' }, // sin overflow: hidden, que en iOS corta la sombra
  discLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: withAlpha(KUOVA_GREEN, 0.1),
    shadowColor: KUOVA_GREEN,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  discGlow: {
    shadowColor: KUOVA_GOLD,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 2,
    borderColor: withAlpha(KUOVA_GOLD, 0.6),
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 8 },
  caption: { color: Colors.textMuted, fontSize: 13 },
});
