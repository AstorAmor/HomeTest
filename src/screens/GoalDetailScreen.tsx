// Un objetivo por dentro (/goal?goal=<objetivo>). El fundador, 2026-11-16: que cada objetivo de «Tus objetivos»
// abra su propia pantalla, unida a una métrica concreta (antes todos llevaban a la misma). Especificación:
// borradores/app-estructura/ESPECIFICACION.md §7 «Objetivo» y la tabla objetivo → medida de la octava vuelta de
// la propuesta; dibujo: el prototipo (`k==='obj'`). De arriba abajo:
// - De dónde sale: «Recomendado por tu análisis» o «Lo elegiste tú».
// - «CÓMO SE MIDE»: un bloque por medida, con su nombre y de dónde llega con el periodo («check-in · 14 días»), la
//   cifra de ahora grande y ligera con su unidad, la de los 14 días de antes y su línea de los 14 días (en el ánimo,
//   una carita por día). Al tocarlo se abre la ficha que ya había de esa medida.
// - «ESTE OBJETIVO»: cambiar tus objetivos o quitar este.
// La app no guarda cuándo elegiste cada objetivo, así que no se dice «cuando lo elegiste»: se compara con los 14
// días de antes. Nada de porcentajes de avance. Un biomarcador se compara solo con el rango del laboratorio.
// Las cuentas están en src/logic/goalMetrics.ts.
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { useMetas } from '@/hooks/useMetas';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useDailyWearables } from '@/wearables/dailySeries';
import { MetasScreenFrame } from '@/components/metas/MetaParts';
import { Chev, FRow, SecHead } from '@/components/fine/Fine';
import { FineGauge } from '@/components/fine/FineGauge';
import { MoodFace } from '@/components/checkin/MoodFaces';
import { kuovaAgeLockedHint } from '@/components/KuovaAgeBadge';
import { MOOD_OPTIONS, type CheckInEntry, type Mood } from '@/types/checkIn';
import type { SimpleMetricEntry } from '@/types/simpleMetric';
import { weightRepository } from '@/data/weightRepository';
import { vo2maxRepository } from '@/data/vo2maxRepository';
import { loadLabReadings } from '@/data/metasRepository';
import { labUploadRepository } from '@/data/labUploads';
import { profileRepository } from '@/data/profileRepository';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { showSamples } from '@/data/dataMode';
import { kuovaAge, kuovaAgeFromUploads, type KuovaAge } from '@/logic/kuovaAge';
import { GOALS, dayKeyOf, dayMonth, fmtNum, resolveMeta, selectedIds, unitWord, valuesFor, type GoalKey, type LabReading, type Meta } from '@/logic/metas';
import {
  GOAL_DAYS,
  GOAL_METRICS,
  checkInByDay,
  countByDay,
  daysBefore,
  entriesByDay,
  hasAny,
  hoursText,
  labReadingFor,
  moodByDay,
  moodWindow,
  pointsByDay,
  rangeScale,
  round1,
  visibleMetrics,
  weeklyOf,
  windowDays,
  windowOf,
  type ByDay,
  type CheckInField,
  type GoalMetric,
  type GoalWindow,
} from '@/logic/goalMetrics';
import { markerHref } from '@/utils/markerLinks';
import { getRangeStatus, rangeText } from '@/utils/rangeStatus';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

const isGoal = (x: unknown): x is GoalKey => typeof x === 'string' && x in GOALS;

// Adónde lleva cada bloque de «Tus objetivos» (Plan)
export const goalHref = (g: GoalKey) => ({ pathname: '/goal', params: { goal: g } }) as unknown as Href;

// El nombre corto de cada marcador de los objetivos del análisis (sin «bueno» ni «malo»)
const LAB_NAME: Record<string, string> = { ldl: 'LDL', hdl: 'HDL', triglycerides: 'Triglycerides', glucose: 'Glucose', hba1c: 'HbA1c' };
const LAB_DEFAULT: Partial<Record<GoalKey, string>> = { ldl: 'ldl', tg: 'triglycerides', glucosa: 'glucose', hdl: 'hdl' };

// El reloj, en oro; lo que apuntas tú (check-in, peso, hábitos), en jade (como el prototipo)
const WATCH = FINE.gold;
const MINE = FINE.jade;

// La Edad KUOVA de esta cuenta, como en BiologicalAgeScreen: en la demo, la del informe de ejemplo; en una cuenta
// real, la de sus analíticas subidas (o lo que le falta para tenerla)
type AgeView = { k: KuovaAge; previous: KuovaAge | null } | { hint: string };
async function loadAge(): Promise<AgeView> {
  if (showSamples()) {
    const p = currentReport.summary.phenoage;
    const b = baselineReport.summary.phenoage;
    return p.available
      ? { k: kuovaAge(p), previous: b.available ? kuovaAge(b) : null }
      : { hint: t('It is worked out from 9 values of a routine blood test. Get the full blood test or upload yours to find out your KUOVA age.') };
  }
  const [uploads, prof] = await Promise.all([labUploadRepository.getAll().catch(() => []), profileRepository.get().catch(() => null)]);
  const r = kuovaAgeFromUploads(uploads, prof?.dateOfBirth);
  return r.status === 'ok' ? { k: r.k, previous: r.previous } : { hint: kuovaAgeLockedHint(r) };
}

// Lo que no trae useMetas: el peso, el VO2max, los valores del análisis y la Edad KUOVA (solo lo que mide este objetivo)
interface Extra {
  weights: SimpleMetricEntry[];
  vo2: SimpleMetricEntry[];
  readings: LabReading[];
  age: AgeView | null;
}
function useExtra(g: GoalKey | null): Extra | null {
  const [extra, setExtra] = useDeepState<Extra | null>(null);
  const load = useCallback(async () => {
    if (!g) return;
    const need = GOAL_METRICS[g];
    const [weights, vo2, readings, age] = await Promise.all([
      need.includes('weight') ? weightRepository.getAll().catch(() => []) : Promise.resolve([]),
      need.includes('vo2max') ? vo2maxRepository.getAll().catch(() => []) : Promise.resolve([]),
      need.includes('lab') ? loadLabReadings().catch(() => []) : Promise.resolve([]),
      need.includes('kuovaAge') ? loadAge().catch(() => null) : Promise.resolve(null),
    ]);
    setExtra({ weights, vo2, readings, age });
  }, [g, setExtra]);
  useReloadOnFocus(load);
  return extra;
}

// Un bloque de «Cómo se mide»
interface Block {
  id: GoalMetric;
  name: string;
  source: string; // «check-in · 14 días»
  big: string; // la cifra de ahora, o «—»
  unit?: string; // al lado de la cifra: «de 5», «de media», «kg»
  before?: string | null; // «Los 14 días de antes: 3,2»
  note?: string; // sin datos, o lo que hay que saber
  line?: { values: (number | null)[]; color: string; domain?: [number, number] };
  mood?: Mood | null; // el ánimo: su carita junto a la palabra
  moods?: (Mood | null)[]; // y una carita por día
  dots?: ('on' | 'off' | 'none')[]; // días con entreno, días sin fumar
  gauge?: { value: number; min: number; max: number; range: [number, number] | null };
  go?: Href;
}

const fmt1 = (x: number) => fmtNum(round1(x));
const src = (what: string) => t('{source} · {n} days', { source: what, n: GOAL_DAYS });
const beforeText = (v: string) => t('The {n} days before: {value}', { n: GOAL_DAYS, value: v });
const moodLabel = (m: Mood) => t(MOOD_OPTIONS.find((o) => o.id === m)?.label ?? m);

export function GoalDetailScreen() {
  const router = useRouter();
  const { goal: raw } = useLocalSearchParams<{ goal?: string }>();
  const g = isGoal(raw) ? raw : null;
  const api = useMetas();
  const extra = useExtra(g);
  const { series } = useDailyWearables(GOAL_DAYS * 2);

  if (!g)
    return (
      <MetasScreenFrame title={t('Your goals')}>
        <FRow title={t('Choose your goals')} onPress={() => router.replace('/metas-objetivos')} last />
      </MetasScreenFrame>
    );
  const def = GOALS[g];
  if (!api.data) return <MetasScreenFrame title={t(def.name)}>{null}</MetasScreenFrame>;

  const s = api.data.state;
  const today = api.today;
  const checkIns: CheckInEntry[] = api.data.checkIns;
  const demoToday = showSamples() ? today : undefined;
  const days28 = [...daysBefore(today), ...windowDays(today)];

  // Lo de una meta por día (tabaco, días sin fumar, alcohol), en lo que se guarda: si la tienes elegida, lo mismo
  // que ves en su área (lo apuntado y lo que llega solo); si no, lo que apuntaste a mano
  const metaByDay = (id: string): ByDay => {
    const vals = selectedIds(s).includes(id) ? valuesFor(s, days28, api.data!.manual, api.auto, demoToday)[id] : days28.map((d) => api.data!.manual[id]?.[d] ?? null);
    const out: ByDay = {};
    days28.forEach((d, i) => {
      const v = vals?.[i];
      if (v != null) out[d] = v;
    });
    return out;
  };
  const metaHas = (id: string, byDay: ByDay) => selectedIds(s).includes(id) || hasAny(byDay, today);

  const sleepMin = pointsByDay(series.sleep_duration);
  const hrv = pointsByDay(series.hrv);
  const tobacco = metaByDay('tabaco');
  const smokeFree = metaByDay('sinhumo');
  const has: Partial<Record<GoalMetric, boolean>> = {
    sleepHours: hasAny(sleepMin, today),
    hrv: hasAny(hrv, today),
    vo2max: (extra?.vo2.length ?? 0) > 0,
    tobacco: metaHas('tabaco', tobacco),
    smokeFree: metaHas('sinhumo', smokeFree),
  };

  // Un valor del check-in de 1 a 5
  const checkInBlock = (id: GoalMetric, field: CheckInField, name: string, empty: string): Block => {
    const w = windowOf(checkInByDay(checkIns, field), today);
    return {
      id,
      name,
      source: src(t('check-in')),
      big: w.now == null ? '—' : fmt1(w.now),
      unit: w.now == null ? undefined : t('of 5'),
      before: w.now == null ? null : beforeText(w.before == null ? '—' : fmt1(w.before)),
      note: w.now == null ? empty : undefined,
      line: { values: w.values, color: MINE, domain: [1, 5] },
      go: '/your-days',
    };
  };

  // Lo del reloj: la media de los días con dato
  const watchBlock = (id: GoalMetric, name: string, byDay: ByDay, show: (x: number) => string, unit: string, go: Href, scale = 1): Block => {
    const w = windowOf(byDay, today);
    return {
      id,
      name,
      source: src(t('watch')),
      big: w.now == null ? '—' : show(w.now),
      unit: w.now == null ? undefined : unit,
      before: w.now == null ? null : beforeText(w.before == null ? '—' : show(w.before)),
      note: w.now == null ? t('No data from your phone or watch in the last {n} days.', { n: GOAL_DAYS }) : undefined,
      line: { values: w.values.map((v) => (v == null ? null : v * scale)), color: WATCH },
      go,
    };
  };

  // Una meta de cantidad (cigarrillos, bebidas), en la unidad que elegiste: al día, la media de los días apuntados;
  // a la semana, lo de los 14 días entre 2
  const amountBlock = (id: GoalMetric, metaId: string, name: string, byDay: ByDay): Block => {
    const m = resolveMeta(s, metaId) as Meta;
    const inUnit: ByDay = Object.fromEntries(Object.entries(byDay).map(([d, v]) => [d, v / m.f]));
    const w: GoalWindow = m.per === 'week' ? weeklyOf(inUnit, today) : windowOf(inUnit, today);
    const unit = w.now == null ? undefined : t(m.per === 'week' ? '{q} a week' : '{q} a day', { q: unitWord(m, round1(w.now)) });
    return {
      id,
      name,
      source: src(t('habits')),
      big: w.now == null ? '—' : fmt1(w.now),
      unit,
      before: w.now == null ? null : beforeText(w.before == null ? '—' : fmt1(w.before)),
      note: w.now == null ? t('Nothing logged in the last {n} days.', { n: GOAL_DAYS }) : undefined,
      line: { values: w.values, color: MINE },
      go: { pathname: '/metas-info', params: { id: metaId } } as Href,
    };
  };

  const block = (id: GoalMetric): Block | null => {
    switch (id) {
      case 'lab': {
        const r = labReadingFor(g, extra?.readings ?? []);
        const name = t(LAB_NAME[r?.marker ?? LAB_DEFAULT[g] ?? ''] ?? def.name);
        if (!r) return { id, name, source: t('lab test'), big: '—', note: t('No value from your lab tests yet.') };
        const range = rangeText(r.low, r.high);
        const st = getRangeStatus(r.value, r.low != null && r.low > 0 ? r.low : null, r.high);
        const where =
          st === 'por_encima'
            ? t('In your last lab test it came out above the lab range.')
            : st === 'por_debajo'
              ? t('In your last lab test it came out below the lab range.')
              : st === 'en_rango'
                ? t('In your last lab test it came out within the lab range.')
                : '';
        return {
          id,
          name,
          source: t('lab test'),
          big: fmtNum(r.value),
          unit: r.unit ?? undefined,
          before: range ? t('Lab range: {range}', { range }) : null,
          gauge: { value: r.value, ...rangeScale(r.value, r.low, r.high) },
          note: `${where} ${t('Measured again in your next lab test.')}`.trim(),
          go: markerHref(r.marker),
        };
      }
      case 'sleepHours':
        return watchBlock(id, t('Hours of sleep'), sleepMin, hoursText, t('average'), { pathname: '/metric', params: { kind: 'sleep_duration' } } as Href, 1 / 60);
      case 'sleepCheckIn':
        return checkInBlock(id, 'sleep', t('Sleep quality'), t('No morning check-ins in the last {n} days.', { n: GOAL_DAYS }));
      case 'energy':
        return checkInBlock(id, 'energy', t('Energy'), t('No check-ins in the last {n} days.', { n: GOAL_DAYS }));
      case 'stress':
        return checkInBlock(id, 'stress', t('Stress'), t('No midday check-ins in the last {n} days.', { n: GOAL_DAYS }));
      case 'hrv':
        return watchBlock(id, t('HRV'), hrv, (x) => String(Math.round(x)), 'ms', { pathname: '/metric', params: { kind: 'hrv' } } as Href);
      case 'steps':
        return watchBlock(id, t('Steps'), pointsByDay(series.steps), (x) => fmtNum(Math.round(x), true), t('{q} a day', { q: t('steps') }), {
          pathname: '/metric',
          params: { kind: 'steps' },
        } as Href);
      case 'mood': {
        const w = moodWindow(moodByDay(checkIns), today);
        return {
          id,
          name: t('Mood'),
          source: src(t('check-in')),
          big: w.now ? moodLabel(w.now) : '—',
          mood: w.now,
          unit: w.now ? t('Most days') : undefined,
          before: w.now ? beforeText(w.before ? moodLabel(w.before) : '—') : null,
          note: w.now ? undefined : t('No check-ins in the last {n} days.', { n: GOAL_DAYS }),
          moods: w.now ? w.days : undefined,
          go: '/your-days',
        };
      }
      case 'weight': {
        const w = windowOf(entriesByDay(extra?.weights ?? []), today);
        return {
          id,
          name: t('Weight'),
          source: src(t('weigh-ins')),
          big: w.now == null ? '—' : fmt1(w.now),
          unit: w.now == null ? undefined : 'kg',
          before: w.now == null ? null : beforeText(w.before == null ? '—' : fmt1(w.before)),
          note: w.now == null ? t('No weigh-ins in the last {n} days.', { n: GOAL_DAYS }) : undefined,
          line: { values: w.values, color: MINE },
          go: '/weight-detail',
        };
      }
      case 'workouts': {
        const all = api.data!.workouts;
        const byDay = countByDay(all);
        const w = weeklyOf(byDay, today);
        const any = all.length > 0;
        return {
          id,
          name: t('Workouts'),
          source: src(t('workouts')),
          big: any ? fmt1(w.now ?? 0) : '—',
          unit: any ? t('a week') : undefined,
          before: any ? beforeText(fmt1(w.before ?? 0)) : null,
          note: any ? undefined : t('No workouts logged yet.'),
          dots: any ? windowDays(today).map((d) => (byDay[d] ? 'on' : 'none')) : undefined,
          go: '/workout-history',
        };
      }
      case 'vo2max': {
        const list = [...(extra?.vo2 ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
        const last = list[list.length - 1];
        if (!last) return null;
        const prev = list[list.length - 2];
        return {
          id,
          name: t('VO2max'),
          source: dayMonth(dayKeyOf(new Date(last.fecha))),
          big: fmt1(last.valor),
          unit: last.unidad || 'ml/kg/min',
          before: prev ? t('Before: {value}', { value: fmt1(prev.valor) }) : null,
          go: '/vo2max-detail',
        };
      }
      case 'tobacco':
        return amountBlock(id, 'tabaco', t('Tobacco'), tobacco);
      case 'alcohol':
        return amountBlock(id, 'alcohol', t('Alcohol'), metaByDay('alcohol'));
      case 'smokeFree': {
        const now = windowDays(today).map((d) => smokeFree[d] ?? null);
        const n = now.filter((v) => v === 1).length;
        const prev = daysBefore(today).map((d) => smokeFree[d] ?? null);
        const logged = now.some((v) => v != null);
        return {
          id,
          name: t('Smoke-free'),
          source: src(t('habits')),
          big: logged ? String(n) : '—',
          unit: logged ? t('smoke-free days') : undefined,
          before: logged ? beforeText(prev.some((v) => v != null) ? String(prev.filter((v) => v === 1).length) : '—') : null,
          note: logged ? undefined : t('Nothing logged in the last {n} days.', { n: GOAL_DAYS }),
          dots: logged ? now.map((v) => (v === 1 ? 'on' : v === 0 ? 'off' : 'none')) : undefined,
          go: { pathname: '/metas-info', params: { id: 'sinhumo' } } as Href,
        };
      }
      case 'kuovaAge': {
        const a = extra?.age;
        if (!a || !('k' in a))
          return { id, name: t('KUOVA age'), source: t('lab test'), big: '—', note: a?.hint ?? t('It is worked out from 9 values of a routine blood test. Get the full blood test or upload yours to find out your KUOVA age.'), go: '/biological-age' };
        return {
          id,
          name: t('KUOVA age'),
          source: t('lab test'),
          big: fmt1(a.k.age),
          unit: t('years'),
          before: a.previous ? t('Your previous lab test: {value}', { value: fmt1(a.previous.age) }) : null,
          go: '/biological-age',
        };
      }
    }
  };

  // Hasta tener lo que no trae useMetas (peso, análisis…), los bloques no se pintan: así no salen «—» un momento
  const needsExtra = GOAL_METRICS[g].some((m) => ['lab', 'weight', 'vo2max', 'kuovaAge'].includes(m));
  const blocks = needsExtra && !extra ? [] : visibleMetrics(g, has).map(block).filter((b): b is Block => !!b);
  const chosen = s.goals.includes(g);
  const remove = () => {
    api.update({ ...s, goals: s.goals.filter((x) => x !== g) });
    router.back();
  };

  return (
    <MetasScreenFrame title={t(def.name)}>
      <Text style={[fine.note, styles.origin]}>{def.lab ? t('Recommended by your lab results') : t('You chose it')}</Text>

      <SecHead title={t('How it’s measured')} />
      {blocks.map((b, i) => (
        <MetricBlock key={b.id} b={b} last={i === blocks.length - 1} />
      ))}
      {g === 'sueno' && !has.sleepHours && <Text style={fine.note}>{t('With a watch you’ll also see your sleep hours.')}</Text>}

      <SecHead title={t('This goal')} />
      <FRow title={t('Change my goals')} onPress={() => router.push('/metas-objetivos')} last={!chosen} />
      {chosen && <FRow title={t('Remove this goal')} onPress={remove} last />}
    </MetasScreenFrame>
  );
}

// Un bloque: el nombre y de dónde llega, la cifra grande con lo suyo al lado y su línea (prototipo, `.area`)
function MetricBlock({ b, last }: { b: Block; last?: boolean }) {
  const router = useRouter();
  const label = [b.name, b.source, b.big === '—' ? t('No data') : `${b.big} ${b.unit ?? ''}`.trim(), b.before, b.note].filter(Boolean).join('. ');
  const body = (
    <>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={2}>
          {b.name}
        </Text>
        <Text style={styles.source}>{b.source}</Text>
        {b.go ? <Chev /> : null}
      </View>
      <View style={styles.big}>
        {b.mood ? <MoodFace mood={b.mood} size={40} color={FINE.ivory} /> : null}
        <Text style={[styles.bigNum, !!b.mood && styles.bigWord]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {b.big}
        </Text>
        {b.unit || b.before ? (
          <View style={styles.side}>
            {b.unit ? <Text style={styles.sideText}>{b.unit}</Text> : null}
            {b.before ? <Text style={styles.sideText}>{b.before}</Text> : null}
          </View>
        ) : null}
      </View>
      {b.gauge ? (
        <View style={styles.gauge}>
          <FineGauge min={b.gauge.min} max={b.gauge.max} value={b.gauge.value} range={b.gauge.range ?? undefined} />
        </View>
      ) : null}
      {b.line ? <Spark values={b.line.values} color={b.line.color} domain={b.line.domain} /> : null}
      {b.moods ? <MoodDays moods={b.moods} /> : null}
      {b.dots ? <DotDays dots={b.dots} /> : null}
      {b.note ? <Text style={fine.note}>{b.note}</Text> : null}
    </>
  );
  const style = [styles.block, last && styles.blockLast];
  return b.go ? (
    <TouchableOpacity style={style} onPress={() => router.push(b.go!)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

// La línea de los 14 días (como MetaChart, pero ajustada a lo que hay: el peso no cabe en una escala desde 0). Los
// días sin dato no se pintan: la línea une los que hay. `domain`: una escala fija (el check-in, de 1 a 5).
function Spark({ values, color, domain }: { values: (number | null)[]; color: string; domain?: [number, number] }) {
  const [w, setW] = useState(0);
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const ys = pts.map((p) => p[1]);
  let lo = domain ? domain[0] : Math.min(...ys);
  let hi = domain ? domain[1] : Math.max(...ys);
  if (!domain) {
    const pad = (hi - lo) * 0.2 || Math.abs(hi) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  }
  const h = 56;
  const base = h - 4;
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * (w - 12) + 6 : w / 2);
  const y = (v: number) => base - ((v - lo) / (hi - lo || 1)) * (h - 12);
  const xy = pts.map(([i, v]) => [x(i), y(v)] as const);
  const line = xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const end = xy[xy.length - 1];
  return (
    <View style={styles.spark} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {w > 0 && (
        <Svg width={w} height={h}>
          <Line x1={6} x2={w - 6} y1={base} y2={base} stroke={FINE.line} />
          <Polygon points={`${xy[0][0].toFixed(1)},${base} ${line} ${end[0].toFixed(1)},${base}`} fill={color} opacity={0.09} />
          <Polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={end[0]} cy={end[1]} r={3.5} fill="#F7F3E6" />
        </Svg>
      )}
    </View>
  );
}

// El ánimo de cada uno de los 14 días: su carita, o un punto apagado si no hubo check-in. Hoy, en marfil.
function MoodDays({ moods }: { moods: (Mood | null)[] }) {
  return (
    <View style={styles.days} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {moods.map((m, i) =>
        m ? <MoodFace key={i} mood={m} size={18} color={i === moods.length - 1 ? FINE.ivory : FINE.mute} /> : <View key={i} style={styles.dayCell}><View style={styles.dayNone} /></View>,
      )}
    </View>
  );
}

// Un punto por día: lleno si lo hubo (entreno, día sin fumar), con borde si se apuntó que no, apagado sin dato
function DotDays({ dots }: { dots: ('on' | 'off' | 'none')[] }) {
  return (
    <View style={styles.days} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {dots.map((d, i) => (
        <View key={i} style={styles.dayCell}>
          <View style={d === 'on' ? styles.dotOn : d === 'off' ? styles.dotOff : styles.dayNone} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { marginTop: 0 },
  block: { paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: FINE.line },
  blockLast: { borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...ff('medium'), flex: 1, color: FINE.ivory, fontSize: 15, lineHeight: 20 },
  source: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  big: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  bigNum: { ...ff('light'), color: FINE.ivory, fontSize: 40, lineHeight: 48, fontVariant: ['tabular-nums'], flexShrink: 1 },
  bigWord: { fontSize: 30, lineHeight: 38 },
  side: { flex: 1, minWidth: 110 },
  sideText: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  gauge: { marginTop: 10 },
  spark: { height: 56, marginTop: 10 },
  days: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, minHeight: 18 },
  dayCell: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  dayNone: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(240,239,230,0.18)' },
  dotOn: { width: 10, height: 10, borderRadius: 5, backgroundColor: FINE.jade },
  dotOff: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: FINE.jadeLine },
});
