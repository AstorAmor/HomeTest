import React, { useId, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { mixHex } from '@/components/GlowRing';
import { CyclePhaseInfo, PHASE_COLORS, phaseBoundaries } from '@/utils/cyclePhase';
import { t } from '@/i18n';

interface CycleStripProps {
  info: CyclePhaseInfo;
  onPress?: () => void;
  // 'line' (Hoy, rediseño 2026-11-16): sin tarjeta y la barra como una recta cometa
  variant?: 'card' | 'line';
}

// La barra del ciclo como una recta tipo cometa (fundador, 2026-11-16, para Hoy): gruesa en medio, con los
// dos extremos estrechándose y difuminándose, como el aro del check-in. Cada fase con su color (con un
// fundido corto entre fases) y hoy, un punto de luz con su brillo.
function CycleLine({ info, segments }: { info: CyclePhaseInfo; segments: { color: string; days: number }[] }) {
  const id = `cy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [w, setW] = useState(0);
  const H = 24;
  const c = H / 2;
  const T = 6; // grosor en medio
  const pad = 10; // sitio para el brillo del punto en los extremos
  const x0 = pad;
  const x1 = Math.max(x0 + 1, w - pad);
  const len = x1 - x0;
  const total = segments.reduce((a, s) => a + Math.max(1, s.days), 0);
  // Fases en fracciones de la recta
  const bands: { a: number; b: number; color: string }[] = [];
  let acc = 0;
  for (const s of segments) {
    const d = Math.max(1, s.days) / total;
    bands.push({ a: acc, b: acc + d, color: s.color });
    acc += d;
  }
  const colorAt = (f: number) => {
    const i = bands.findIndex((b) => f <= b.b);
    const band = bands[i < 0 ? bands.length - 1 : i];
    // Fundido corto con la fase de al lado
    const blend = 0.025;
    const next = bands[i + 1];
    if (next && band.b - f < blend) return mixHex(band.color, next.color, 0.5 * (1 - (band.b - f) / blend));
    const prev = bands[i - 1];
    if (prev && f - band.a < blend) return mixHex(band.color, prev.color, 0.5 * (1 - (f - band.a) / blend));
    return band.color;
  };
  // Los extremos se apagan
  const fade = (f: number) => 0.18 + 0.82 * Math.min(1, f / 0.16, (1 - f) / 0.16);
  const width = (f: number) => T * (0.22 + 0.78 * Math.pow(Math.sin(Math.PI * f), 0.55));
  const N = 48;
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const x = (x0 + f * len).toFixed(2);
    top.push(`${x} ${(c - width(f) / 2).toFixed(2)}`);
    bot.push(`${x} ${(c + width(f) / 2).toFixed(2)}`);
  }
  const d = `M ${top.join(' L ')} L ${bot.reverse().join(' L ')} Z`;
  const fs = new Set<number>([0, 0.08, 0.16, 0.84, 0.92, 1]);
  for (const b of bands) for (const f of [b.a, b.a + 0.026, b.b - 0.026, b.b]) if (f >= 0 && f <= 1) fs.add(Number(f.toFixed(4)));
  const stops = [...fs].sort((a, b) => a - b);
  const markerF = (Math.min(info.day, info.length) - 0.5) / info.length;
  const mx = x0 + markerF * len;
  const phaseColor = PHASE_COLORS[info.phase];
  const light = Colors.isLight;
  return (
    <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id={`${id}f`} gradientUnits="userSpaceOnUse" x1={x0} y1={c} x2={x1} y2={c}>
              {stops.map((f) => (
                <Stop key={f} offset={String(f)} stopColor={colorAt(f)} stopOpacity={(light ? 0.85 : 0.75) * fade(f)} />
              ))}
            </LinearGradient>
            <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={mixHex(phaseColor, '#FFFFFF', 0.25)} stopOpacity={light ? 0.55 : 0.75} />
              <Stop offset="1" stopColor={phaseColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={d} fill={`url(#${id}f)`} />
          <Circle cx={mx} cy={c} r={10} fill={`url(#${id}g)`} />
          <Circle cx={mx} cy={c} r={4.2} fill={phaseColor} />
          <Circle cx={mx} cy={c} r={2.4} fill={light ? '#FFFFFF' : '#F7F3E6'} />
        </Svg>
      )}
    </View>
  );
}

// Barra del ciclo con sus fases, un marcador en el día actual y, con datos suyos, cuándo llegaría la
// próxima regla. Si se retrasa, el marcador se queda al final y el día sigue contando (día 31).
export const CycleStrip = ({ info, onPress, variant = 'card' }: CycleStripProps) => {
  const { menstrualEnd, ovulationStart, ovulationEnd } = phaseBoundaries(info.length);
  const segments = [
    { color: PHASE_COLORS.menstrual, days: menstrualEnd },
    { color: PHASE_COLORS.follicular, days: ovulationStart - 1 - menstrualEnd },
    { color: PHASE_COLORS.ovulation, days: ovulationEnd - ovulationStart + 1 },
    { color: PHASE_COLORS.luteal, days: info.length - ovulationEnd },
  ];
  const markerPct = ((Math.min(info.day, info.length) - 0.5) / info.length) * 100;

  return (
    <TouchableOpacity style={variant === 'line' ? styles.line : styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.phaseRow}>
          <Ionicons name="rose-outline" size={16} color={Colors.pulseAccent} />
          <Text style={[styles.phase, { color: PHASE_COLORS[info.phase] }]}>{t(info.label)}</Text>
        </View>
        <Text style={styles.day}>
          {cycleDayLabel(info)}
          {info.isSample ? ` · ${t('sample')}` : ''}
        </Text>
      </View>
      {variant === 'line' ? (
        <View style={styles.lineBar}>
          <CycleLine info={info} segments={segments} />
        </View>
      ) : (
        <View style={styles.bar}>
          {segments.map((s, i) => (
            <View key={i} style={{ flex: Math.max(1, s.days), backgroundColor: s.color, opacity: 0.55 }} />
          ))}
          <View style={[styles.marker, { left: `${markerPct}%` }]} />
        </View>
      )}
      {info.next && (
        <Text style={styles.next}>
          {t(info.next.text, info.next.vars)}
          {info.next.note ? <Text style={styles.note}>{` ${t(info.next.note, info.next.noteVars)}`}</Text> : null}
        </Text>
      )}
      <Text style={styles.hint}>{t(info.hint)}</Text>
    </TouchableOpacity>
  );
};

// «Día 9 de 28»; pasada la duración habitual, solo «Día 31»
export const cycleDayLabel = (info: CyclePhaseInfo) =>
  info.day > info.length ? t('Day {n}', { n: info.day }) : t('Day {n} of {total}', { n: info.day, total: info.length });

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  line: { paddingVertical: 4 },
  lineBar: { marginHorizontal: -10, marginTop: -2 }, // el brillo de los extremos, fuera del margen
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phase: {
    fontSize: 14,
    fontWeight: '700',
  },
  day: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    gap: 2,
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 16,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: Colors.textPrimary,
  },
  next: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  note: {
    color: Colors.textMuted,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
});
