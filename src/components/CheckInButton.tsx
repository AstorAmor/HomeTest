// El check-in de Hoy. Rediseño «Emerald Luxury · Living Nebula» (2026-11-15): la carita deja paso a una
// nebulosa viva (CheckInNebula) que siempre se mueve un poco y gana luz con cada check-in del día
// (mañana, mediodía, noche). Alrededor, un aro fino tipo cometa dice cuántos llevas: la cola se estrecha y
// se difumina, la cabeza lleva un punto de luz, y va de jade a champán.
// - El tramo nuevo se rellena poco a poco y la nebulosa se enciende a la vez.
// - Al completar los 3 (justo después de guardar el tercero): el cometa da la vuelta y la nebulosa crece y
//   vuelve. Sin confeti ni destellos (fundador, 2026-11-16).
// Antes (fundador, 2026-11-05): carita sobre un disco y donut de 3 tramos dorados.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { mixHex } from '@/components/GlowRing';
import { Colors, withAlpha } from '@/constants/colors';
import { checkInSavedRecently, clearCheckInSaved } from '@/logic/checkInCelebration';
import { CheckInNebula } from '@/components/CheckInNebula';
import { useLiveMotion } from '@/hooks/useLiveMotion';
import { useTween } from '@/hooks/useTween';
import { TAB } from '@/constants/tabs';
import { t } from '@/i18n';

export const CHECKINS_PER_DAY = 3;

const SIZE = 184;
const RING_R = 84; // radio del aro (px): por fuera de las láminas, dentro del halo
const HEAD_W = 2.8; // grosor de la cabeza del cometa; la cola baja a TAIL_W y se apaga
const TAIL_W = 0.5;
// El cometa va de jade a champán según avanza (en claro, más hondos para que se vean sobre el crema)
const TONES = Colors.isLight ? ['#2E9A72', '#7E9A55', '#B08A45'] : ['#83D6B4', '#B4C894', '#D8B978'];
const toneAt = (f: number) => (f <= 0.5 ? mixHex(TONES[0], TONES[1], f * 2) : mixHex(TONES[1], TONES[2], (f - 0.5) * 2));

export function CheckInButton({ done, onPress }: { done: number; onPress: () => void }) {
  const c = SIZE / 2;
  const r = RING_R;
  const n = Math.max(0, Math.min(CHECKINS_PER_DAY, done));
  const full = n >= CHECKINS_PER_DAY;
  const progress = useTween(n, 900); // 0..3, con decimales mientras se rellena
  const [burst, setBurst] = useState(0);
  const prev = useRef(n);
  const moving = useLiveMotion(TAB.today);

  useEffect(() => {
    const was = prev.current;
    prev.current = n;
    if (n >= CHECKINS_PER_DAY && was < CHECKINS_PER_DAY && checkInSavedRecently()) {
      clearCheckInSaved();
      setBurst((b) => b + 1);
    }
  }, [n]);

  const at = (f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const arc = (a: number, b: number) => {
    const s = at(a);
    const e = at(b);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };
  // Cometa (fundador, 2026-11-15): de la salida, arriba, hasta donde va el día; la cola se estrecha y se
  // difumina y la cabeza lleva el punto de luz. Tramos cortos, cada uno con su grosor, color y opacidad.
  const f = progress / CHECKINS_PER_DAY;
  const parts = f > 0.003 ? Math.max(4, Math.ceil(f * 96)) : 0;
  const comet = Array.from({ length: parts }, (_, i) => {
    const u = (i + 0.5) / parts; // 0 cola … 1 cabeza
    return (
      <Path
        key={i}
        d={arc((f * i) / parts, (f * (i + 1)) / parts)}
        stroke={toneAt((f * (i + 0.5)) / parts)}
        strokeOpacity={Math.pow(u, 1.4)}
        strokeWidth={TAIL_W + (HEAD_W - TAIL_W) * Math.pow(u, 0.8)}
        fill="none"
      />
    );
  });
  const tip = at(f);
  const caption = full ? t('All 3 check-ins done today') : t('{n} of {total} check-ins today', { n, total: CHECKINS_PER_DAY });
  const light = Colors.isLight;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${t('Check in')}. ${caption}`}>
        <View style={{ width: SIZE, height: SIZE }}>
          <CheckInNebula size={SIZE} progress={n / CHECKINS_PER_DAY} burst={burst} moving={moving} />
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <RadialGradient id="checkinTip" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={toneAt(f)} stopOpacity={0.8} />
                <Stop offset="1" stopColor={toneAt(f)} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* Pista apenas visible y una marca en cada tercio (mañana, mediodía, noche) */}
            <Circle cx={c} cy={c} r={r} stroke={light ? withAlpha('#0E2A24', 0.07) : withAlpha('#F0EFE6', 0.07)} strokeWidth={1} fill="none" />
            {Array.from({ length: CHECKINS_PER_DAY }, (_, i) => {
              const m = at(i / CHECKINS_PER_DAY);
              return <Circle key={`m${i}`} cx={m.x} cy={m.y} r={1.4} fill={light ? '#0E2A24' : '#F0EFE6'} opacity={i < n ? 0 : 0.28} />;
            })}
            {comet}
            {parts > 0 && (
              <>
                <Circle cx={tip.x} cy={tip.y} r={8} fill="url(#checkinTip)" />
                <Circle cx={tip.x} cy={tip.y} r={2.5} fill={light ? '#FFFFFF' : '#F7F3E6'} />
              </>
            )}
          </Svg>
        </View>
      </TouchableOpacity>
      <Text style={styles.title}>{t('Check in')}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },
  caption: { color: Colors.textSecondary, fontSize: 13 },
});
