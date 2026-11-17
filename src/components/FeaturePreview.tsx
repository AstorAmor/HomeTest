import React, { useId, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { CometLine } from '@/components/CometLine';
import { TrendChart } from '@/components/TrendChart';
import { BristolLine } from '@/components/BathroomVisuals';
import { MoodFace } from '@/components/checkin/MoodFaces';
import { DumbbellIcon } from '@/components/fine/DumbbellIcon';
import { RoleEmblem } from '@/components/fine/RoleEmblem';
import { LineEmblem } from '@/components/fine/LineEmblem';
import { BadgeEmblem, badgeTone } from '@/components/badges/BadgeEmblem';
import { AREA_RING } from '@/components/metas/MetaParts';
import { AREA_NAME, AREAS, type Area } from '@/logic/metas';
import { Colors } from '@/constants/colors';
import { AppSection } from '@/data/appPrefs';
import type { Achievement, TierName } from '@/data/achievements';
import { BRISTOL_TYPES, STOOL_COLORS, URINE_COLORS } from '@/types/bathroom';
import type { Mood } from '@/types/checkIn';
import { PHASE_COLORS, phaseBoundaries, type CyclePhaseId } from '@/utils/cyclePhase';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Vista previa de cada parte de la app (con datos de ejemplo), para que se vea cómo quedará antes
// de encenderla. Usa los mismos componentes que la pantalla real cuando se puede.
// Desde el 2026-11-17, en el lenguaje fino (como la app de ahora): recuadro casi transparente, filas sin icono en
// círculo de color, barras en jade y oro, la píldora esmeralda y sin emoji.
// Segunda vuelta, el mismo día (fundador: «está basado en el estilo antiguo: gotas de pis en forma de gota, líneas de
// fase del ciclo poco elegantes… la energía tampoco se corresponde»): cada vista previa copia la pantalla de ahora.
// - Plan: el círculo dorado de la semana y las tres áreas con su línea cometa (metas/WeekHero), y Entrenamientos con
//   las pesas de toda la app (DumbbellIcon).
// - Check-in: la energía en una regla de 0 a 10, quieta, con su etiqueta («Energía»), sin pregunta ni palabras en los
//   extremos; y el ánimo con las caras a línea (checkin/MoodFaces).
// - Tu estado de hoy: el aro de Hoy y su frase.
// - Ciclo: las cuatro fases como líneas finas, una por fase, y el día de hoy como un punto de luz.
// - Heces y orina: la semana en barras finas (DigestiveScreen), la consistencia en su regla con el dibujo a línea
//   (BristolRuler) y el color en la carta de color (ColorRuler), sin gotas ni formas rellenas.
// Todo es dibujo: nada se toca dentro de la vista previa.
export const FeaturePreview = ({ section }: { section: AppSection }) => {
  const P = PREVIEWS[section];
  return (
    <View style={styles.frame}>
      <Text style={styles.tag}>{t('Preview')}</Text>
      <P />
    </View>
  );
};

// --- Piezas -------------------------------------------------------------------------------------

// Una fila con línea fina (como FRow, pero sin tocar): lo de la izquierda, el texto y lo de la derecha
const Row = ({ title, sub, left, right, last }: { title: string; sub?: string; left?: React.ReactNode; right?: React.ReactNode; last?: boolean }) => (
  <View style={[styles.row, last && styles.rowLast]}>
    {left}
    <View style={styles.flex}>
      <Text style={fine.rowTitle} numberOfLines={2}>
        {title}
      </Text>
      {sub ? <Text style={fine.rowSub}>{sub}</Text> : null}
    </View>
    {right}
  </View>
);

// La píldora de Hoy, quieta: esmeralda, o con borde de oro
const StillPill = ({ label, gold }: { label: string; gold?: boolean }) => (
  <View style={[fine.pill, gold && fine.pillGold]}>
    <Text style={[fine.pillText, gold && fine.pillGoldText]}>{label}</Text>
  </View>
);

// La etiqueta pequeña en mayúsculas y, a la derecha, lo suyo apagado («HECES · Últimos 7 días»)
const Head = ({ title, right, style }: { title: string; right?: string; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.head, style]}>
    <Text style={fine.kicker}>{title}</Text>
    {right ? <Text style={styles.headRight}>{right}</Text> : null}
  </View>
);

// Lo que notamos de la semana: un punto de color, el título y el texto debajo (DigestiveScreen)
const Observation = ({ title, body }: { title: string; body: string }) => (
  <View style={styles.obs}>
    <View style={styles.obsHeader}>
      <View style={[styles.obsDot, { backgroundColor: FINE.jade }]} />
      <Text style={[fine.rowTitle, styles.flex]}>{title}</Text>
    </View>
    <Text style={styles.obsBody}>{body}</Text>
  </View>
);

// La regla de apuntar, quieta (checkin/Ruler y la de la consistencia en BathroomVisuals): la línea apagada, las marcas
// debajo y el punto de luz. `fill`: el tramo hasta el punto en degradado jade. `major`: las marcas largas (sin ellas,
// todas iguales, como la de la consistencia).
const R_H = 38;
const R_PAD = 12;
const R_Y = 16; // la línea, con sitio arriba para el brillo del punto
function StillRuler({ stops, at, major, fill }: { stops: number; at: number; major?: number[]; fill?: boolean }) {
  const id = `fp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [w, setW] = useState(0);
  const span = Math.max(0, w - 2 * R_PAD);
  const x = (i: number) => R_PAD + (i / (stops - 1)) * span;
  const cx = x(at);
  return (
    <View style={{ height: R_H }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 && (
        <Svg width={w} height={R_H}>
          <Defs>
            <LinearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#2F8F70" />
              <Stop offset="1" stopColor={FINE.jade} />
            </LinearGradient>
            <RadialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={FINE.jade} stopOpacity={0.75} />
              <Stop offset="0.45" stopColor={FINE.jade} stopOpacity={0.32} />
              <Stop offset="1" stopColor={FINE.jade} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={R_Y - 1} width={w} height={2} rx={1} fill="#F0EFE6" fillOpacity={0.16} />
          {fill && <Rect x={0} y={R_Y - 1} width={cx} height={2} rx={1} fill={`url(#${id}f)`} />}
          {Array.from({ length: stops }, (_, i) => {
            const long = major ? major.includes(i) : true;
            const h = major ? (long ? 10 : 5) : 8;
            return <Rect key={i} x={x(i) - 0.5} y={R_Y + 5} width={1} height={h} fill="#F0EFE6" fillOpacity={major && !long ? 0.28 : 0.55} />;
          })}
          <Circle cx={cx} cy={R_Y} r={16} fill={`url(#${id}g)`} />
          <Circle cx={cx} cy={R_Y} r={5.5} fill="#F7F3E6" />
        </Svg>
      )}
    </View>
  );
}

// Las palabras o cifras de los dos extremos de una regla. `under`: las cifras, debajo de la primera y la última marca
const Ends = ({ left, right, under }: { left: string; right: string; under?: boolean }) => (
  <View style={[styles.ends, under && styles.endsUnder]}>
    <Text style={styles.end}>{left}</Text>
    <Text style={styles.end}>{right}</Text>
  </View>
);

// La semana en barras finas (DigestiveScreen): arriba cuántas veces, la barra del color apuntado y la inicial del día
const weekLetters = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString(dateLocale(), { weekday: 'narrow' });
  });
const WeekBars = ({ bars }: { bars: { n: number; color: string }[] }) => {
  const max = Math.max(3, ...bars.map((b) => b.n));
  const letters = weekLetters();
  return (
    <View style={styles.week}>
      {bars.map((b, i) => (
        <View key={i} style={styles.dayCol}>
          <Text style={styles.barCount}>{b.n}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { height: 6 + (b.n / max) * 34, backgroundColor: b.n ? b.color : FINE.line }]} />
          </View>
          <Text style={styles.dayLabel}>{letters[i]}</Text>
        </View>
      ))}
    </View>
  );
};

// La carta de color (ColorRuler en BathroomVisuals), quieta: los tramos seguidos y, bajo el elegido, el punto de luz
const ColorStrip = ({ swatches, at }: { swatches: string[]; at: number }) => (
  <View style={styles.strip}>
    {swatches.map((c, i) => (
      <View key={c} style={styles.stripCol}>
        <View
          style={[
            styles.stripSeg,
            { backgroundColor: c },
            i === 0 && styles.stripFirst,
            i === swatches.length - 1 && styles.stripLast,
            i === at && styles.stripSegOn,
          ]}
        />
        <View style={styles.stripMark}>
          {i === at && (
            <View style={styles.stripGlow}>
              <View style={styles.stripDot} />
            </View>
          )}
        </View>
      </View>
    ))}
  </View>
);

// Las fases del ciclo como líneas finas, una por fase con un hueco entre ellas: la de ahora, entera y algo más
// gruesa; las demás, más apagadas. Hoy, un punto de luz del color de la fase (como en la línea del ciclo de Hoy).
const PHASES: CyclePhaseId[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
const PHASE_SHORT: Record<CyclePhaseId, string> = { menstrual: 'Period', follicular: 'Follicular', ovulation: 'Ovulation', luteal: 'Luteal' };
function PhaseLines({ day, length }: { day: number; length: number }) {
  const id = `fc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [w, setW] = useState(0);
  const H = 24;
  const Y = H / 2;
  const PAD = 10;
  const GAP = 5;
  const { menstrualEnd, ovulationStart, ovulationEnd } = phaseBoundaries(length);
  const days: Record<CyclePhaseId, [number, number]> = {
    menstrual: [1, menstrualEnd],
    follicular: [menstrualEnd + 1, ovulationStart - 1],
    ovulation: [ovulationStart, ovulationEnd],
    luteal: [ovulationEnd + 1, length],
  };
  const now = PHASES.find((p) => day >= days[p][0] && day <= days[p][1]) ?? 'luteal';
  const span = Math.max(1, w - 2 * PAD);
  const at = (d: number) => PAD + (d / length) * span; // d días ya pasados
  const mx = at(day - 0.5);
  const color = PHASE_COLORS[now];
  return (
    <View style={{ height: H }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={0.7} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {PHASES.map((p) => {
            const on = p === now;
            return (
              <Line
                key={p}
                x1={at(days[p][0] - 1) + GAP / 2}
                y1={Y}
                x2={at(days[p][1]) - GAP / 2}
                y2={Y}
                stroke={PHASE_COLORS[p]}
                strokeOpacity={on ? 0.9 : 0.4}
                strokeWidth={on ? 2.2 : 1.6}
                strokeLinecap="round"
              />
            );
          })}
          <Circle cx={mx} cy={Y} r={10} fill={`url(#${id}g)`} />
          <Circle cx={mx} cy={Y} r={3.6} fill={color} />
          <Circle cx={mx} cy={Y} r={2} fill="#F7F3E6" />
        </Svg>
      )}
    </View>
  );
}

// Una insignia de ejemplo (con lo que necesita BadgeEmblem)
const sampleBadge = (id: string, title: string, icon: string, tier: TierName, level: number, progress: number): Achievement => ({
  id,
  title,
  description: '',
  icon,
  value: 0,
  unit: '',
  thresholds: [],
  level,
  tier,
  nextThreshold: 1,
  progressToNext: progress,
});

// --- Cada parte -----------------------------------------------------------------------------------

// Plan: como arriba de la pestaña Plan (WeekHero): tu semana en el círculo dorado y cada área con su línea cometa;
// debajo, Entrenamientos con las pesas
const AREA_SAMPLE: Record<Area, { f: number; names: string }> = {
  ej: { f: 0.66, names: 'Steps · Cardio · Strength' },
  al: { f: 0.85, names: 'Vegetables · Added sugar' },
  ha: { f: 0.4, names: 'Sleep · Water' },
};
const PlanPreview = () => (
  <View>
    <View style={styles.hero}>
      <GlowRing progress={0.68} colors={ringTones(Colors.gold)} size={84} stroke={5}>
        <Text style={styles.ringNum}>
          68<Text style={styles.ringUnit}> %</Text>
        </Text>
        <Text style={styles.ringSub}>{t('of your week')}</Text>
      </GlowRing>
      <Text style={[styles.sideText, styles.flex]}>{t('Last week: {n} %', { n: 61 })}</Text>
    </View>
    <Text style={[fine.kicker, styles.areasHead]}>{t('Your targets')}</Text>
    {AREAS.map((a) => (
      <View key={a} style={styles.area}>
        <View style={styles.areaRow}>
          <Text style={styles.areaName}>{t(AREA_NAME[a])}</Text>
          <Text style={styles.areaPct}>{Math.round(AREA_SAMPLE[a].f * 100)} %</Text>
        </View>
        <Text style={styles.areaSub}>{t(AREA_SAMPLE[a].names)}</Text>
        <CometLine progress={AREA_SAMPLE[a].f} colors={AREA_RING[a]} thickness={3.5} style={styles.comet} />
      </View>
    ))}
    <Row title={t('Workouts')} sub={t('Full body · 6 exercises · 45 min')} left={<DumbbellIcon size={22} />} last />
  </View>
);

// Check-in: la energía en su regla de 1 a 5, como la de verdad (17 marcas, las 5 posiciones más largas; solo la etiqueta
// y la cifra, sin pregunta) y el ánimo con las caras
const MOODS: Mood[] = ['happy', 'calm', 'neutral'];
const MOOD_LABEL: Record<string, string> = { happy: 'Happy', calm: 'Calm', neutral: 'Neutral' };
const CheckinPreview = () => (
  <View>
    <View style={styles.rulerHead}>
      <Text style={fine.secTitle}>{t('Energy')}</Text>
      <Text style={styles.rulerValue}>4</Text>
    </View>
    <StillRuler stops={17} at={12} major={[0, 4, 8, 12, 16]} fill />
    <Ends left="1" right="5" under />
    <View style={[styles.rulerHead, styles.gapTop]}>
      <Text style={fine.secTitle}>{t('Mood')}</Text>
    </View>
    <View style={styles.faces}>
      {MOODS.map((m) => {
        const on = m === 'calm';
        const c = on ? FINE.jade : FINE.mute;
        return (
          <View key={m} style={[styles.face, on && styles.faceOn]}>
            <MoodFace mood={m} size={34} color={c} />
            <Text style={[styles.faceLabel, { color: c }]}>{t(MOOD_LABEL[m])}</Text>
          </View>
        );
      })}
    </View>
  </View>
);

// Tu estado de hoy: el aro de Hoy con la cifra y, al lado, la frase y de qué sale
const ReadinessPreview = () => (
  <View style={styles.hero}>
    <View style={styles.ringCol}>
      <GlowRing progress={0.72} colors={ringTones(Colors.green)} size={84} stroke={5}>
        <Text style={styles.ringNum}>72</Text>
      </GlowRing>
      <Text style={fine.kicker}>{t('Today')}</Text>
    </View>
    <View style={styles.flex}>
      <Text style={styles.stateLine}>{t('Moderate')}</Text>
      <Text style={fine.rowSub}>{t('Sleep, HRV and resting heart rate against your own values')}</Text>
    </View>
  </View>
);

// Datos del reloj: las dos fichas de Hoy (pulso en reposo y VFC frente a lo tuyo) y el sueño de la semana
const Tile = ({ name, value, unit, status }: { name: string; value: string; unit: string; status: string }) => (
  <View style={styles.tile}>
    <Text style={styles.tileName}>{name}</Text>
    <Text style={styles.tileValue}>
      {value}
      <Text style={styles.tileUnit}> {unit}</Text>
    </Text>
    <Text style={styles.tileStatus}>{status}</Text>
  </View>
);
const WearablesPreview = () => (
  <View style={{ gap: 14 }}>
    <View style={styles.tiles}>
      <Tile name={t('Resting HR')} value="58" unit="bpm" status={t('As usual')} />
      <Tile name={t('HRV')} value="46" unit="ms" status={t('Above your usual')} />
    </View>
    <View>
      <Head title={t('Sleep · last 7 nights')} />
      <TrendChart
        height={70}
        labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => t(d))}
        series={[{ label: t('Sleep (h)'), color: FINE.jade, values: [7.1, 6.4, 7.8, 6.9, 7.3, 8.1, 7.6] }]}
        formatY={(v) => v.toFixed(0)}
      />
    </View>
  </View>
);

// Ciclo: la fase de hoy en su color y el día; las cuatro fases en líneas finas con su nombre debajo, y la próxima regla
const CYCLE_DAY = 19;
const CYCLE_LENGTH = 28;
const CyclePreview = () => (
  <View>
    <View style={styles.cycleHead}>
      <Text style={[styles.phaseName, { color: PHASE_COLORS.luteal }]}>{t('Luteal phase')}</Text>
      <Text style={styles.headRight}>{t('Day {n} of {total}', { n: CYCLE_DAY, total: CYCLE_LENGTH })}</Text>
    </View>
    <View style={styles.phaseLine}>
      <PhaseLines day={CYCLE_DAY} length={CYCLE_LENGTH} />
    </View>
    <View style={styles.legend}>
      {PHASES.map((p) => (
        <View key={p} style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: PHASE_COLORS[p] }]} />
          <Text style={styles.legendText}>{t(PHASE_SHORT[p])}</Text>
        </View>
      ))}
    </View>
    <Text style={[fine.rowSub, styles.gapTop]}>{t('Based on your last cycles, your next period would come in about {n} days.', { n: CYCLE_LENGTH - CYCLE_DAY + 1 })}</Text>
  </View>
);

// Digestión: las heces de la semana en barras finas, la consistencia en su regla con el dibujo a línea y lo que vemos
const stool = (id: string) => STOOL_COLORS.find((c) => c.id === id)?.swatch ?? FINE.mute;
const GutPreview = () => {
  const smooth = BRISTOL_TYPES.find((b) => b.id === 4)!;
  return (
    <View>
      <Head title={t('Stools')} right={t('Last 7 days')} />
      <WeekBars
        bars={[1, 2, 1, 0, 1, 1, 2].map((n, i) => ({ n, color: stool(i === 1 || i === 6 ? 'light_brown' : 'brown') }))}
      />
      <Head title={t('Consistency')} style={styles.gapTop} />
      <View style={styles.bristolArt}>
        <BristolLine type={4} width={96} />
        <Text style={styles.picked}>{t(smooth.label)}</Text>
      </View>
      <StillRuler stops={7} at={3} />
      <Ends left={t('Very hard')} right={t('Liquid')} />
      <Observation title={t('Your digestion looks regular')} body={t('Frequency, colour and consistency are within the usual range.')} />
    </View>
  );
};

// Hidratación: la orina de la semana en barras finas con su color, la carta de color y lo que vemos
const URINE_SCALE = URINE_COLORS.slice(0, 5);
const urine = (id: string) => URINE_COLORS.find((c) => c.id === id)?.swatch ?? FINE.mute;
const BladderPreview = () => (
  <View>
    <Head title={t('Urine')} right={t('Last 7 days')} />
    <WeekBars
      bars={(['pale', 'pale', 'yellow', 'dark', 'pale', 'clear', 'pale'] as const).map((c, i) => ({ n: [6, 7, 5, 4, 6, 7, 6][i], color: urine(c) }))}
    />
    <Head title={t('Colour')} style={styles.gapTop} />
    <ColorStrip swatches={URINE_SCALE.map((c) => c.swatch)} at={1} />
    <Ends left={t(URINE_SCALE[0].label)} right={t(URINE_SCALE[URINE_SCALE.length - 1].label)} />
    <Observation title={t('Well hydrated this week')} body={t('One darker day: you got a tip to drink a bit more.')} />
  </View>
);

// Medicación: como las tomas de Hoy (MedToday): la tomada con «Deshacer» en oro y la que falta con «Tomada»
const MedicationPreview = () => (
  <View>
    <Row title={t('Levothyroxine')} sub={t('Taken at {time} · {done} of {total} today', { time: '07:30', done: 1, total: 1 })} right={<StillPill gold label={t('Undo')} />} />
    <Row title={t('Magnesium')} sub={t('Next dose · {time} · {done} of {total} today', { time: '21:30', done: 0, total: 1 })} right={<StillPill label={t('Taken')} />} last />
  </View>
);

// Insignias: las de Plan (BadgeEmblem), el aro de su nivel con su grabado dentro, el nombre y el nivel
const BADGES: Achievement[] = [
  sampleBadge('step_collector', 'Step collector', 'footsteps', 'Silver', 2, 0.45),
  sampleBadge('strength_streak', 'Strength streak', 'barbell', 'Bronze', 1, 0.6),
  sampleBadge('self_aware', 'Self-aware', 'happy', 'Gold', 3, 0.3),
];
const BadgesPreview = () => (
  <View style={styles.badges}>
    {BADGES.map((a) => (
      <View key={a.id} style={styles.badge}>
        <BadgeEmblem achievement={a} size={58} />
        <Text style={styles.badgeTitle} numberOfLines={2}>
          {t(a.title)}
        </Text>
        <Text style={[styles.badgeTier, { color: badgeTone(a) }]}>{t(a.tier!)}</Text>
      </View>
    ))}
  </View>
);

const PREVIEWS: Record<AppSection, () => React.ReactElement> = {
  plan: PlanPreview,
  checkin: CheckinPreview,
  readiness: ReadinessPreview,
  wearables: WearablesPreview,
  cycle: CyclePreview,
  gut: GutPreview,
  bladder: BladderPreview,
  medication: MedicationPreview,
  badges: BadgesPreview,
  // Especialistas: el dibujo a línea de su rol en oro (lo de pago), como en «Habla con un especialista»
  specialists: () => (
    <Row
      left={<RoleEmblem role="dietitian" size={40} />}
      title={t('Talk to a dietitian')}
      sub={t('Ferritin below the lab range: a dietitian can review the iron in your meals.')}
      last
    />
  ),
  // Aprende: el dibujo a línea del tema en un aro fino jade, como en Tú → Aprende
  learning: () => (
    <Row left={<LineEmblem icon="test-tube" size={40} />} title={t('What is HbA1c?')} sub={t('Your average blood sugar over about 3 months. 3 min read')} last />
  ),
  // Historial: filas con línea fina, sin iconos
  history: () => (
    <View>
      <Row title={t('Allergies')} sub={t('Penicillin · Shellfish')} />
      <Row title={t('Blood group')} right={<Text style={fine.rowValue}>A+</Text>} />
      <Row title={t('Vaccines')} sub={t('Tetanus · 2023')} last />
    </View>
  ),
};

const styles = StyleSheet.create({
  frame: { ...fine.tile, padding: 14, paddingTop: 30 },
  tag: { ...fine.kicker, position: 'absolute', top: 10, left: 14 },
  flex: { flex: 1, minWidth: 0 },
  gapTop: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: FINE.line },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  headRight: { ...ff('regular'), color: FINE.mute, fontSize: 12, marginLeft: 'auto' },
  // Plan y Tu estado de hoy: el círculo a la izquierda y lo suyo al lado
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringCol: { alignItems: 'center', gap: 6 },
  ringNum: { ...ff('light'), color: FINE.ivory, fontSize: 24, fontVariant: ['tabular-nums'] },
  ringUnit: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  ringSub: { ...ff('regular'), color: FINE.mute, fontSize: 9.5, marginTop: -2 },
  sideText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17 },
  stateLine: { ...ff('regular'), color: FINE.ivory, fontSize: 15, lineHeight: 21 },
  areasHead: { marginTop: 16 },
  area: { paddingTop: 10 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaName: { ...ff('medium'), flex: 1, color: FINE.ivory, fontSize: 14.5 },
  areaPct: { ...ff('regular'), color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  areaSub: { ...ff('regular'), color: FINE.mute, fontSize: 12, marginTop: 1 },
  comet: { marginHorizontal: -8, marginTop: -4, marginBottom: -6 },
  // Check-in: la cabecera de cada regla (etiqueta y, a la derecha, lo marcado en jade) y las caras
  rulerHead: { flexDirection: 'row', alignItems: 'center', minHeight: 22, marginBottom: 2 },
  rulerValue: { ...ff('medium'), color: FINE.jade, fontSize: 14, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  endsUnder: { paddingHorizontal: R_PAD - 4 },
  end: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  faces: { flexDirection: 'row', gap: 8, marginTop: 4 },
  face: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  faceOn: { borderColor: 'rgba(131,214,180,0.5)', backgroundColor: 'rgba(131,214,180,0.07)' },
  faceLabel: { ...ff('regular'), fontSize: 12 },
  // Datos del reloj: las fichas casi transparentes de Hoy
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: FINE.line, backgroundColor: FINE.tile },
  tileName: { ...ff('regular'), color: FINE.mute, fontSize: 12, marginBottom: 2 },
  tileValue: { ...ff('regular'), color: FINE.ivory, fontSize: 22, fontVariant: ['tabular-nums'] },
  tileUnit: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  tileStatus: { ...ff('regular'), color: FINE.jade, fontSize: 12, marginTop: 2 },
  // Ciclo
  cycleHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  phaseName: { ...ff('medium'), fontSize: 14 },
  phaseLine: { marginHorizontal: -10 }, // el brillo del punto, fuera del margen
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 12, height: 2, borderRadius: 1, opacity: 0.8 },
  legendText: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  // Heces y orina: la semana en barras finas
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { flex: 1, alignItems: 'center', gap: 4 },
  barCount: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  barTrack: { height: 40, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 8, borderRadius: 4, opacity: 0.9 },
  dayLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11 },
  // La consistencia: el dibujo a línea del tipo y su nombre encima de la regla
  bristolArt: { alignItems: 'center' },
  picked: { ...ff('regular'), color: FINE.ivory, fontSize: 14, marginTop: 2 },
  // La carta de color (como ColorRuler, algo más baja)
  strip: { flexDirection: 'row', gap: 3 },
  stripCol: { flex: 1, alignItems: 'stretch' },
  stripSeg: { height: 26, borderRadius: 3, borderWidth: 1, borderColor: FINE.rule },
  stripFirst: { borderTopLeftRadius: 9, borderBottomLeftRadius: 9 },
  stripLast: { borderTopRightRadius: 9, borderBottomRightRadius: 9 },
  stripSegOn: { borderColor: '#F7F3E6', borderWidth: 1.5 },
  stripMark: { height: 20, alignItems: 'center', justifyContent: 'center' },
  stripGlow: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(131,214,180,0.18)', alignItems: 'center', justifyContent: 'center' },
  stripDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F7F3E6' },
  // Lo que vemos esta semana: con una línea fina encima, un punto de color y el texto debajo
  obs: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: FINE.line, gap: 4 },
  obsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  obsDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  obsBody: { ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18, paddingLeft: 15 },
  // Insignias
  badges: { flexDirection: 'row', justifyContent: 'space-around' },
  badge: { width: 86, alignItems: 'center' },
  badgeTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 11.5, lineHeight: 15, marginTop: 7, textAlign: 'center' },
  badgeTier: { ...ff('regular'), fontSize: 10.5, marginTop: 1 },
});
