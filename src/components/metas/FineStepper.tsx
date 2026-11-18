// «− número +» con la unidad fuera, como en el prototipo de las 4 pestañas (borradores/app-estructura/prototipo,
// `.stp`): dos botones redondos con una línea fina y la cifra grande y ligera en medio. El fundador, 2026-11-16:
// «me gustaba el estilo de input que me habías enseñado, era más sencillo» (sustituye a la ruedita). Si se deja
// pulsado un botón, la cifra sigue subiendo o bajando (para los pasos, que van de 500 en 500).
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { FINE, ff } from '@/theme/fine';
import { t } from '@/i18n';

// Pulsar: un paso. Dejarlo pulsado: un paso cada poco hasta soltar (siempre con lo último que llega del padre)
function useHold(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return {
    onPress: () => ref.current(),
    onLongPress: () => {
      stop();
      ref.current();
      timer.current = setInterval(() => ref.current(), 90);
    },
    onPressOut: stop,
  };
}

export function FineStepper({
  value,
  unit,
  onMinus,
  onPlus,
  canMinus = true,
  canPlus = true,
  small,
  dim,
  style,
}: {
  value: string;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  canMinus?: boolean;
  canPlus?: boolean;
  small?: boolean; // en una fila (la meta tuya, los días a la semana)
  dim?: boolean; // apagada (un objetivo del día que no sale en Hoy)
  style?: StyleProp<ViewStyle>;
}) {
  const minus = useHold(onMinus);
  const plus = useHold(onPlus);
  const btn = [styles.btn, small && styles.btnSmall];
  return (
    <View style={[styles.row, small && styles.rowSmall, style]}>
      <TouchableOpacity
        style={[btn, !canMinus && styles.off]}
        disabled={!canMinus}
        {...minus}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={t('Less')}
        hitSlop={4}
      >
        <Text style={[styles.sign, small && styles.signSmall]}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.val, small && styles.valSmall, dim && styles.dim]} numberOfLines={1} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <TouchableOpacity
        style={[btn, !canPlus && styles.off]}
        disabled={!canPlus}
        {...plus}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={t('More')}
        hitSlop={4}
      >
        <Text style={[styles.sign, small && styles.signSmall]}>+</Text>
      </TouchableOpacity>
      {unit ? (
        <Text style={[styles.unit, small && styles.unitSmall, dim && styles.dim]} numberOfLines={2}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  rowSmall: { justifyContent: 'flex-start', gap: 10 },
  btn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(240,239,230,0.16)', alignItems: 'center', justifyContent: 'center' },
  btnSmall: { width: 40, height: 40, borderRadius: 20 },
  off: { opacity: 0.35 },
  sign: { ...ff('light'), fontSize: 24, lineHeight: 28, color: FINE.ivory, marginTop: -2 },
  signSmall: { fontSize: 21, lineHeight: 25 },
  val: { ...ff('light'), minWidth: 96, textAlign: 'center', fontSize: 34, lineHeight: 40, color: FINE.ivory, fontVariant: ['tabular-nums'] },
  // Ancho fijo de sobra para «10.500» o «7 h 30»: así el + no se mueve al cambiar la cifra
  valSmall: { minWidth: 96, fontSize: 26, lineHeight: 32 },
  unit: { ...ff('regular'), fontSize: 15, color: FINE.mute, flexShrink: 1, maxWidth: 140 },
  unitSmall: { fontSize: 14 },
  dim: { opacity: 0.45 },
});
