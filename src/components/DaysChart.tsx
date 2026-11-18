import React, { useState } from 'react';
import { LotusIcon } from '@/components/fine/LotusIcon';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { dateLocale, t } from '@/i18n';
import { smoothPath } from '@/components/TrendChart';
import { formatSleep, shortDate } from '@/wearables/dailySeries';
import { PHASE_COLORS, type CyclePhaseId } from '@/utils/cyclePhase';
import {
  SERIES,
  SERIES_BY_ID,
  SERIES_MAX,
  cycleRuns,
  scaled,
  segments,
  seriesScale,
  toggleSeries,
  type CycleDay,
  type DayValues,
  type SeriesId,
} from '@/logic/dayChart';
import { FINE, ff, fine } from '@/theme/fine';

// La gráfica de «Tus últimos días»: ánimo y energía por defecto y las medidas que añadas debajo, cada una en su
// escala (logic/dayChart.ts). A las mujeres, la fase del ciclo de cada día en una franja bajo la gráfica.
// Tocarla muestra los valores de ese día. Desde el 2026-11-16, en fino: líneas de guía apenas marcadas, las
// medidas en chips con borde (la elegida, con el borde de su color) y las notas apagadas.

// Ánimo y energía, como en Hoy (oro y verde). Las que más se juntan con ellas (sueño, pasos, VFC, pulso),
// de tonos bien distintos; el estrés, gris
export const SERIES_COLOR: Record<SeriesId, string> = {
  mood: Colors.gold,
  energy: Colors.green,
  stress: Colors.textSecondary,
  sleep: Colors.violet,
  steps: Colors.sky,
  hrv: Colors.coral,
  rhr: Colors.pulseAccent,
  urine: Colors.amber,
  bowel: '#B08968',
  workout: Colors.water,
};

const PHASE_SHORT: Record<CyclePhaseId, string> = { menstrual: 'Period', follicular: 'Follicular', ovulation: 'Ovulation', luteal: 'Luteal' };

const num = (v: number, digits = 0) => v.toLocaleString(dateLocale(), { maximumFractionDigits: digits });

export function valueText(id: SeriesId, v: number): string {
  switch (id) {
    case 'mood':
    case 'energy':
    case 'stress':
      return `${num(v, 1)}/5`;
    case 'sleep':
      return formatSleep(v);
    case 'steps':
      return num(Math.round(v));
    case 'hrv':
      return `${num(Math.round(v))} ms`;
    case 'rhr':
      return `${num(Math.round(v))} ${t('bpm')}`;
    case 'urine':
    case 'bowel':
      return t(v === 1 ? '{n} time' : '{n} times', { n: num(v, 1) });
    case 'workout':
      return `${num(Math.round(v))} min`;
  }
}

function scaleText(id: SeriesId, [lo, hi]: [number, number]): string {
  switch (id) {
    case 'sleep':
      return `${num(lo / 60)}–${num(hi / 60)} h`;
    // En miles: «5000–12.000» se lee mal (en español, 4 cifras van sin punto)
    case 'steps':
      return t('{lo}–{hi} thousand', { lo: num(lo / 1000, 1), hi: num(hi / 1000, 1) });
    case 'hrv':
      return `${num(lo)}–${num(hi)} ms`;
    case 'rhr':
      return `${num(lo)}–${num(hi)} ${t('bpm')}`;
    case 'urine':
    case 'bowel':
      return t('{lo}–{hi} times', { lo: num(lo), hi: num(hi) });
    case 'workout':
      return `${num(lo)}–${num(hi)} min`;
    default:
      return `${num(lo)}–${num(hi)}`;
  }
}

const PAD_TOP = 10;
const PLOT_H = 140;
const STRIP_GAP = 8;
const STRIP_H = 7;

interface Props {
  keys: string[]; // días, del más antiguo a hoy
  values: DayValues;
  selected: SeriesId[];
  onChange: (next: SeriesId[]) => void;
  cycle: (CycleDay | null)[] | null; // null: sin franja del ciclo
  sample?: boolean;
}

export const DaysChart = ({ keys, values, selected, onChange, cycle, sample }: Props) => {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [fullMsg, setFullMsg] = useState(false);
  const n = keys.length;
  const at = picked != null && picked < n ? picked : null;
  const cw = n ? width / n : 0;
  const x = (i: number) => cw * (i + 0.5);
  const showCycle = !!cycle && cycle.some(Boolean);
  const height = PAD_TOP + PLOT_H + (showCycle ? STRIP_GAP + STRIP_H : 4);
  const scales = Object.fromEntries(SERIES.map((d) => [d.id, seriesScale(d, values[d.id])])) as Record<SeriesId, [number, number]>;
  const y = (id: SeriesId, v: number) => PAD_TOP + (1 - scaled(v, scales[id])) * PLOT_H;
  const hasData = (id: SeriesId) => values[id].some((v) => v != null);
  const anyShown = selected.some(hasData);

  const pick = (lx: number) => {
    if (!n || width <= 0) return;
    setPicked(Math.max(0, Math.min(n - 1, Math.floor(lx / cw))));
  };
  const toggle = (id: SeriesId) => {
    const next = toggleSeries(selected, id);
    if (!next) return setFullMsg(true);
    setFullMsg(false);
    onChange(next);
  };
  const dayLabel = (k: string) => {
    const s = new Date(`${k}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const runs = showCycle ? cycleRuns(cycle!) : [];
  const phasesShown = (Object.keys(PHASE_SHORT) as CyclePhaseId[]).filter((p) => runs.some((r) => r.phase === p));
  const mid = Math.floor((n - 1) / 2);

  return (
    <View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((g) => (
              <Line key={g} x1={0} x2={width} y1={PAD_TOP + g * PLOT_H} y2={PAD_TOP + g * PLOT_H} stroke={FINE.line} strokeWidth={1} strokeDasharray="3 5" />
            ))}
            {at != null && (
              <Line x1={x(at)} x2={x(at)} y1={PAD_TOP - 6} y2={PAD_TOP + PLOT_H} stroke={FINE.mute} strokeWidth={1} strokeDasharray="2 3" />
            )}
            {selected.map((id) => {
              const vs = values[id];
              const color = SERIES_COLOR[id];
              const segs = segments(vs);
              const pt = (i: number) => ({ x: x(i), y: y(id, vs[i]!) });
              return (
                <React.Fragment key={id}>
                  {/* Entre dos tramos, una línea discontinua tenue: no hay dato esos días */}
                  {segs.slice(1).map((sg, k) => {
                    const a = pt(segs[k][segs[k].length - 1]);
                    const b = pt(sg[0]);
                    return <Line key={`g${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1.5} strokeDasharray="2 4" opacity={0.5} />;
                  })}
                  {segs.map((sg, k) =>
                    sg.length > 1 ? <Path key={`s${k}`} d={smoothPath(sg.map(pt))} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" /> : null,
                  )}
                  {/* Solo curvas, sin puntos (fundador, 2026-11-06); un día suelto sin vecinos sí lleva su punto, o no se vería */}
                  {segs
                    .filter((sg) => sg.length === 1)
                    .map((sg) => (
                      <Circle key={`d${sg[0]}`} cx={pt(sg[0]).x} cy={pt(sg[0]).y} r={2.8} fill={color} />
                    ))}
                  {at != null && vs[at] != null && <Circle cx={pt(at).x} cy={pt(at).y} r={5} fill={Colors.background} stroke={color} strokeWidth={2.5} />}
                </React.Fragment>
              );
            })}
            {runs.map((r) => (
              <Rect
                key={`c${r.from}`}
                x={r.from * cw + 0.5}
                y={PAD_TOP + PLOT_H + STRIP_GAP}
                width={Math.max(1, (r.to - r.from + 1) * cw - 1)}
                height={STRIP_H}
                rx={3}
                fill={PHASE_COLORS[r.phase]}
                opacity={0.65}
              />
            ))}
          </Svg>
        )}
        {width > 0 && !anyShown && (
          <View pointerEvents="none" style={[styles.empty, { top: PAD_TOP, height: PLOT_H }]}>
            <Text style={styles.emptyText}>{t('No data for these days yet')}</Text>
          </View>
        )}
        {width > 0 && (
          <View
            style={[StyleSheet.absoluteFill]}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
            onResponderMove={(e) => pick(e.nativeEvent.locationX)}
          />
        )}
        {at != null && width > 0 && (
          <View pointerEvents="none" style={[styles.tip, { left: Math.max(0, Math.min(width - 158, x(at) - 79)) }]}>
            <Text style={styles.tipDate}>{dayLabel(keys[at])}</Text>
            {showCycle && cycle![at] && (
              <Text style={[styles.tipRow, { color: PHASE_COLORS[cycle![at]!.phase] }]}>
                {t('{phase}, day {n}', { phase: t(PHASE_SHORT[cycle![at]!.phase]), n: cycle![at]!.day })}
              </Text>
            )}
            {selected.map((id) => (
              <Text key={id} style={[styles.tipRow, { color: SERIES_COLOR[id] }]}>
                {t(SERIES_BY_ID[id].label)}: {values[id][at] != null ? valueText(id, values[id][at]!) : '—'}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.xLabels}>
        <Text style={styles.xLabel}>{n ? shortDate(keys[0]) : ''}</Text>
        {n > 2 && <Text style={styles.xLabel}>{shortDate(keys[mid])}</Text>}
        <Text style={styles.xLabel}>{n ? t('Today') : ''}</Text>
      </View>

      {showCycle && (
        <View style={styles.phases}>
          <LotusIcon size={13} color={FINE.mute} />
          {phasesShown.map((p) => (
            <View key={p} style={styles.phase}>
              <View style={[styles.phaseDot, { backgroundColor: PHASE_COLORS[p] }]} />
              <Text style={styles.phaseText}>{t(PHASE_SHORT[p])}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Una sola fila, siempre en el mismo orden: las que se ven, rellenas y con su escala; las demás, «+» */}
      <View style={styles.chips}>
        {SERIES.map((d) => {
          const on = selected.includes(d.id);
          const color = SERIES_COLOR[d.id];
          const data = hasData(d.id);
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, on ? { borderColor: withAlpha(color, 0.75) } : !data && styles.chipNoData]}
              onPress={() => toggle(d.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t(SERIES_BY_ID[d.id].label)}${on ? '' : `: ${t('add to the chart')}`}`}
            >
              {on ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : <Ionicons name="add" size={14} color={FINE.mute} />}
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(d.label)}</Text>
              {on && <Text style={styles.chipScale}>{data ? scaleText(d.id, scales[d.id]) : t('no data')}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
      {fullMsg && <Text style={styles.note}>{t('Up to {n} at a time so the chart stays readable: remove one to add another.', { n: SERIES_MAX })}</Text>}
      <Text style={styles.note}>
        {t('Each measure has its own scale (lowest at the bottom, highest at the top), to see how they move together. Tap the chart to see each day.')}
        {sample ? ` ${t('Mood and energy are a sample until you do your check-ins.')}` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  tip: {
    position: 'absolute',
    top: -4,
    width: 158,
    backgroundColor: 'rgba(11,41,33,0.96)',
    borderWidth: 1,
    borderColor: FINE.line,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 1,
  },
  tipDate: { ...ff('regular'), color: FINE.mute, fontSize: 10.5 },
  tipRow: { ...ff('medium'), fontSize: 12 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  xLabel: { ...ff('regular'), color: FINE.mute, fontSize: 10.5 },
  phases: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  phase: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phaseDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.8 },
  phaseText: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  // Las medidas, en chips con borde (prototipo, `.chipsw`)
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    borderWidth: 1,
    borderColor: FINE.line,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipNoData: { opacity: 0.55 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  chipTextOn: { color: FINE.ivory },
  chipScale: { ...ff('regular'), color: FINE.mute, fontSize: 11 },
  note: { ...fine.note, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
