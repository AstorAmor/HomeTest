import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { labUploadRepository } from '@/data/labUploads';
import { makeTourScroll } from '@/components/tour/tourStore';
import { labValuesFrom } from '@/data/labUploadValues';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart, TrendSeries } from '@/components/TrendChart';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { mockBiomarkers, mockDiagnosticTests, DiagnosticTest } from '@/data/mockData';
import { loadSeedData } from '@/data/seedData';
import { importLocalDataToAccount } from '@/data/importLocalData';
import { useAuth } from '@/context/AuthContext';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { cortisolRepository } from '@/data/cortisolRepository';
import { vo2maxRepository } from '@/data/vo2maxRepository';
import { gripStrengthRepository } from '@/data/gripStrengthRepository';
import { formatSleep, shortDate, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';
import { WearableMetric } from '@/wearables/types';
import { metricAxis, metricLine } from '@/screens/MetricDetailScreen';
import { useSections } from '@/data/appPrefs';
import { dateLocale, num, t } from '@/i18n';
import { useWebShell } from '@/web/webMode';
import { showSamples } from '@/data/dataMode';
import { TAB, tabHref } from '@/constants/tabs';
import { weightRepository } from '@/data/weightRepository';
import { weighAdvice, WeighAdvice } from '@/logic/weight';
import { labReports } from '@/utils/labReportView';
import {
  chartBand,
  chartPoints,
  DEFAULT_CHARTS,
  isOut,
  latestAnalysis,
  markerHistory,
  markerSummaries,
  MarkerPoint,
  MarkerSummary,
  normalizeCharts,
  OWN_SCREEN,
  pointsFromReports,
  pointsFromUploads,
  stateCounts,
  toggleChart,
} from '@/logic/labMarkers';
import { userFlags } from '@/data/userFlags';
import { markerHref, markerName } from '@/utils/markerLinks';
import { Chev, SecHead } from '@/components/fine/Fine';
import { SecRow } from '@/components/fine/FineMeasure';
import { labToneColor, rangeTone, StatusWord } from '@/components/fine/FineLab';
import { rangeStatusLabel } from '@/utils/rangeStatus';
import { FINE, ff, fine } from '@/theme/fine';

// El estado de una prueba de ejemplo, en los tonos finos (sin rojo): bien en jade, en espera apagado, para
// mirar en oro
const diagnosticTone = (status: DiagnosticTest['status']) => (status === 'ok' ? FINE.jade : status === 'attention' ? FINE.gold : FINE.mute);

interface DatedValue {
  fecha: string;
  valor: number;
}

interface ChartData {
  labels: string[];
  series: TrendSeries[];
  latest: string;
  isSample: boolean;
}

const RECENT = 10; // puntos que se muestran en las gráficas de análisis

// Últimas mediciones guardadas; si no hay, el histórico mock (con fechas mensuales
// inventadas) para que la pantalla no salga vacía en la demo. En una cuenta real, sin
// mediciones no hay gráfica (null) y con una sola se enseña esa.
function simpleChart(entries: DatedValue[], mockId: string, color: string): ChartData | null {
  const asc = [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
  if (asc.length >= 2 || (asc.length === 1 && !showSamples())) {
    return {
      labels: asc.map((e) => shortDate(e.fecha)),
      series: [{ color, values: asc.map((e) => e.valor) }],
      latest: String(asc[asc.length - 1].valor),
      isSample: false,
    };
  }
  if (!showSamples()) return null;
  const mock = mockBiomarkers.find((b) => b.id === mockId)!;
  const now = new Date();
  const labels = mock.history.map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (mock.history.length - 1 - i), 1);
    return d.toLocaleDateString(dateLocale(), { month: 'short' });
  });
  return { labels, series: [{ color, values: mock.history }], latest: mock.valor, isSample: true };
}

// Una medición del reloj con la misma línea que su ficha (color y franja de MetricDetailScreen)
const wearableChart = (points: DailyPoint[] | undefined, kind: WearableMetric, format: (v: number) => string) => {
  const pts = points ?? [];
  const line = metricLine(kind);
  return {
    labels: pts.map((p) => shortDate(p.date)),
    series: [{ color: line.color, values: pts.map((p) => p.value) }],
    band: line.band,
    formatY: metricAxis(kind),
    latest: pts.length ? format(pts[pts.length - 1].value) : '—',
    avg: pts.length ? format(pts.reduce((a, p) => a + p.value, 0) / pts.length) : '—',
  };
};

// Las gráficas de Mediciones, pequeñas: la misma línea que la de su ficha, sin el toque (tocar abre la ficha)
const SMALL = 90;
// La tensión baja, en turquesa como en su ficha (BloodPressureDetailScreen)
const TURQUOISE = '#5CC7C9';

// Los nombres de los últimos `n` meses («jun», «jul»…), para las líneas de ejemplo
const lastMonths = (n: number) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1).toLocaleDateString(dateLocale(), { month: 'short' }),
  );
};

// Lo que se apunta a mano de vez en cuando (VO2max, fuerza de agarre): las últimas mediciones en jade; sin ninguna,
// en la demo una línea de ejemplo `sample` que se pinta apagada, y en una cuenta real nada
function manualChart(entries: DatedValue[], sample: number[]): ChartData | null {
  const asc = [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
  if (asc.length) {
    return { labels: asc.map((e) => shortDate(e.fecha)), series: [{ color: FINE.jade, values: asc.map((e) => e.valor) }], latest: num(asc[asc.length - 1].valor), isSample: false };
  }
  return showSamples() ? { labels: lastMonths(sample.length), series: [{ color: FINE.jade, values: sample }], latest: '—', isSample: true } : null;
}

// Lo que quedaba de «Mis datos», que dejó de ser pestaña el 2026-11-16 (borradores/app-estructura): dos
// pantallas sueltas. `measurements`: tus mediciones con su línea en el tiempo (pasos, sueño, tensión, peso…;
// «Ver todas» desde Hoy). `biomarkers`: los valores de tus analíticas con sus gráficas y la lista entera
// («Ver todos» desde Análisis). La Edad KUOVA pasó a Análisis; el historial y el perfil genético, a Tú.
export const MyDataScreen = ({ part }: { part: 'measurements' | 'biomarkers' }) => {
  const router = useRouter();
  const show = useSections();
  const { series, isSample } = useDailyWearables();
  const { authMode } = useAuth();
  // Web del paciente en escritorio: las tarjetas van en 2 columnas en vez de una debajo de otra
  const grid = useWebShell();
  const [seedStatus, setSeedStatus] = useState('');
  const [glucose, setGlucose] = useDeepState<ChartData | null>(null);
  const [cholesterol, setCholesterol] = useDeepState<ChartData | null>(null);
  const [cortisol, setCortisol] = useDeepState<ChartData | null>(null);
  const [vo2, setVo2] = useDeepState<ChartData | null>(null);
  // Fuerza de agarre (fundador, 2026-11-17: «añade otra sección (como VO2max) para "fuerza de agarre"»)
  const [grip, setGrip] = useDeepState<ChartData | null>(null);
  const [bp, setBp] = useDeepState<ChartData | null>(null);
  // Peso (fundador, 2026-11-06: salía en Hoy pero no aquí) y cuándo toca pesarse
  const [weight, setWeight] = useDeepState<ChartData | null>(null);
  const [weighIn, setWeighIn] = useState<WeighAdvice | null>(null);
  // «Analíticas»: el último valor de cada marcador de tus analíticas (los de la demo, en las de prueba)
  const [analyses, setAnalyses] = useDeepState<{ list: MarkerSummary[]; last: MarkerPoint | null; any: boolean; points: MarkerPoint[] }>({ list: [], last: null, any: false, points: [] });
  // Qué gráficas se ven en Analíticas: el ojo de cada una (fundador, 2026-11-06)
  const [charts, setCharts] = useState<string[]>(DEFAULT_CHARTS);
  const tourScroll = useMemo(makeTourScroll, []);

  const load = useCallback(async () => {
    weightRepository
      .getAll()
      .then((all) => {
        setWeighIn(weighAdvice(all));
        const asc = [...all].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
        setWeight(
          asc.length
            ? { labels: asc.map((e) => shortDate(e.fecha)), series: [{ color: FINE.jade, values: asc.map((e) => e.valor) }], latest: num(asc[asc.length - 1].valor.toFixed(1)), isSample: false }
            : null,
        );
      })
      .catch(() => setWeight(null));
    const [g, bpEntries, chol, cort, vo, gr, uploads] = await Promise.all([
      getGlucoseEntries(),
      getBloodPressureEntries(),
      cholesterolRepository.getAll(),
      cortisolRepository.getAll(),
      vo2maxRepository.getAll().catch(() => []),
      gripStrengthRepository.getAll().catch(() => []),
      labUploadRepository.getAll().catch(() => []),
    ]);
    // Lo apuntado a mano más lo que traen las analíticas subidas (glucosa, colesterol total, cortisol)
    setGlucose(simpleChart([...g, ...labValuesFrom(uploads, 'glucose')], 'sugar', Colors.accent));
    setCholesterol(simpleChart([...chol, ...labValuesFrom(uploads, 'total_cholesterol')], 'cholesterol', Colors.amber));
    setCortisol(simpleChart([...cort, ...labValuesFrom(uploads, 'cortisol_am')], 'cortisol', Colors.violet));
    const points = [...pointsFromUploads(uploads), ...pointsFromReports(labReports())];
    setAnalyses({
      // Todos, también azúcar, colesterol total y cortisol: su ojo pone o quita su tarjeta de arriba
      list: markerSummaries(points, (p) => markerName(p.key, p.name)),
      last: latestAnalysis(points),
      any: points.length > 0,
      points,
    });
    userFlags
      .get(CHARTS_FLAG)
      .then((v) => setCharts(normalizeCharts(v)))
      .catch(() => undefined);
    // VO2max y fuerza de agarre: sin mediciones, una línea de ejemplo "apagada" (como los demás sin medir)
    setVo2(manualChart(vo, [37, 38.5, 39, 40.5, 41]));
    setGrip(manualChart(gr, [41, 42, 42.5, 43.5, 44]));

    const bpAsc = [...bpEntries].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
    if (bpAsc.length >= 2 || (bpAsc.length === 1 && !showSamples())) {
      setBp({
        labels: bpAsc.map((e) => shortDate(e.fecha)),
        series: [
          { label: t('Systolic (high)'), color: FINE.jade, values: bpAsc.map((e) => e.systolic) },
          { label: t('Diastolic (low)'), color: TURQUOISE, values: bpAsc.map((e) => e.diastolic) },
        ],
        latest: `${bpAsc[bpAsc.length - 1].systolic}/${bpAsc[bpAsc.length - 1].diastolic}`,
        isSample: false,
      });
    } else if (!showSamples()) {
      // Cuenta real sin tomas: la tarjeta, vacía, invita a registrar la primera
      setBp({ labels: [], series: [], latest: '—', isSample: false });
    } else {
      const sys = [118, 122, 119, 125, 121, 120];
      const dia = [78, 81, 77, 83, 80, 80];
      setBp({
        labels: lastMonths(sys.length),
        series: [
          { label: t('Systolic (high)'), color: FINE.jade, values: sys },
          { label: t('Diastolic (low)'), color: TURQUOISE, values: dia },
        ],
        latest: '120/80',
        isSample: true,
      });
    }
  }, [setGlucose, setCholesterol, setCortisol, setVo2, setGrip, setBp, setWeight, setAnalyses]);

  useReloadOnFocus(load);

  // El ojo: pone la gráfica (al final) o la quita, y se guarda en la cuenta
  const flipChart = (key: string) => {
    const next = toggleChart(charts, key);
    setCharts(next);
    userFlags.set(CHARTS_FLAG, { keys: next }).catch(() => undefined);
  };

  const handleLoadSeed = async () => {
    setSeedStatus('Loading…');
    const result = await loadSeedData();
    setSeedStatus(
      `Loaded: ${result.bloodPressure} blood pressure, ${result.glucose} glucose, ${result.cholesterol} cholesterol, ${result.cortisol} cortisol, ${result.cycle} cycle`
    );
    load();
  };

  const handleImportLocal = async () => {
    setSeedStatus('Uploading…');
    try {
      setSeedStatus(await importLocalDataToAccount());
      load();
    } catch (err) {
      setSeedStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const hr = wearableChart(series.resting_heart_rate, 'resting_heart_rate', (v) => `${Math.round(v)}`);
  const hrv = wearableChart(series.hrv, 'hrv', (v) => `${Math.round(v)}`);
  const sleep = wearableChart(series.sleep_duration, 'sleep_duration', formatSleep);
  const steps = wearableChart(series.steps, 'steps', (v) => Math.round(v).toLocaleString(dateLocale()));
  const kcal = wearableChart(series.active_energy, 'active_energy', (v) => `${Math.round(v)}`);
  // Con la coma decimal del idioma (fundador, 2026-11-17: «sé coherente entre comas y puntos»)
  const temp = wearableChart(series.body_temperature, 'body_temperature', (v) => num(v.toFixed(1)));
  // Una gráfica de reloj en Mediciones: su cifra (la de hoy) con la media al lado y la línea de su ficha
  const watchChart = (title: string, c: ReturnType<typeof wearableChart>, unit: string | undefined, kind: WearableMetric) => (
    <BioChart
      key={kind}
      title={title}
      value={c.latest}
      unit={c.latest === '—' ? undefined : unit}
      sub={c.avg === '—' ? t('Not measured yet') : t('avg {v}', { v: c.avg })}
      off={c.latest === '—'}
      onPress={() => router.push({ pathname: '/metric', params: { kind } })}
    >
      <TrendChart labels={c.labels} series={c.series} height={SMALL} band={c.band} formatY={c.formatY} interactive={false} />
    </BioChart>
  );

  // Analíticas (antes «Biomarcadores»; fundador, 2026-11-06: «todo son biomarcadores», lo de las analíticas
  // se llama Analíticas): primero lo medido; lo que no, "apagado" como incentivo. El VO2max va en Mediciones.
  const biomarkers = [
    { key: 'sugar', marker: 'glucose', title: 'Sugar', icon: 'glucose', color: Colors.accent, data: glucose, unit: 'mg/dL', to: '/glucose-detail', band: { low: 70, high: 99 } },
    { key: 'chol', marker: 'total_cholesterol', title: 'Total cholesterol', icon: 'analytics-outline', color: Colors.amber, data: cholesterol, unit: 'mg/dL', to: '/cholesterol-detail', band: { low: 125, high: 200 } },
    { key: 'cortisol', marker: 'cortisol_am', title: 'Cortisol', icon: 'sunny-outline', color: Colors.violet, data: cortisol, unit: 'µg/dL', to: '/cortisol-detail' },
  ]
    .filter((b) => charts.includes(b.marker))
    .sort((a, b) => Number(!a.data || a.data.isSample) - Number(!b.data || b.data.isSample));
  // Las demás gráficas elegidas con el ojo (vitamina D…), con los valores de tus analíticas
  const pinned = charts.filter((k) => !OWN_SCREEN[k] && analyses.points.some((p) => p.key === k));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={part === 'measurements' ? t('Measurements') : t('Your biomarkers')} showBack backFallback={tabHref(part === 'measurements' ? TAB.today : TAB.analysis)} />

        {/* Mediciones («Ver todas» desde Hoy), desde el 2026-11-17 en fino como Tus biomarcadores (fundador: «"ver
            todas" pierde la coherencia, vuelve al formato antiguo»): cada medición en su sección con la raya, la cifra
            grande y ligera y, debajo, la misma curva que su ficha (la de pasos, la que le gusta: línea fina, degradado
            suave y el punto de luz al final), sin tarjeta ni icono en círculo de color */}
        {part === 'measurements' && (
        <View style={styles.bioBody}>
        <Text style={fine.lead}>
          {show('wearables') ? `${t('From your watch (last 14 days) and what you log')}${isSample ? ` · ${t('sample')}` : ''}` : t('What you log')}
        </Text>
        <View style={grid ? styles.bioGrid : undefined}>
        {/* Orden pedido: pasos, sueño, calorías, pulso en reposo y variabilidad */}
        {show('wearables') && (
          <>
            {watchChart(t('Steps'), steps, t('steps'), 'steps')}
            {watchChart(t('Sleep'), sleep, undefined, 'sleep_duration')}
            {watchChart(t('Active calories'), kcal, 'kcal', 'active_energy')}
            {watchChart(t('Resting heart rate'), hr, 'bpm', 'resting_heart_rate')}
            {watchChart(t('Heart rate variability'), hrv, 'ms', 'hrv')}
          </>
        )}

        {bp && (
          <BioChart
            title={t('Blood pressure')}
            value={bp.latest}
            unit={bp.latest === '—' ? undefined : 'mmHg'}
            sub={bp.isSample ? t('sample') : bp.latest === '—' ? t('Not measured yet') : bp.labels[bp.labels.length - 1]}
            off={bp.latest === '—'}
            onPress={() => router.push('/blood-pressure-detail')}
          >
            {/* Las dos líneas de su ficha: la alta en jade y la baja en turquesa */}
            <TrendChart labels={bp.labels} series={bp.series} height={SMALL + 10} interactive={false} />
          </BioChart>
        )}

        <BioChart
          title={t('Weight')}
          value={weight ? weight.latest : '—'}
          unit={weight ? 'kg' : undefined}
          sub={
            !weighIn?.last
              ? t('Not measured yet')
              : weighIn.due
                ? t('Time to weigh in')
                : t('Next: {day}', { day: weighIn.next ? weighIn.next.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' }) : '' })
          }
          off={!weight}
          onPress={() => router.push(weight ? '/weight-detail' : '/log-weight')}
        >
          {weight ? (
            <TrendChart labels={weight.labels} series={weight.series} height={SMALL} formatY={(v) => v.toFixed(0)} interactive={false} />
          ) : (
            <Text style={fine.note}>{t('Weigh yourself once a week, on the same day and at the same time, to see your trend here.')}</Text>
          )}
        </BioChart>

        {show('wearables') && watchChart(t('Temperature'), temp, '°C', 'body_temperature')}

        {/* VO2max y fuerza de agarre: se apuntan a mano. Sin mediciones, una línea de ejemplo apagada */}
        {[
          { key: 'vo2', title: t('VO2max'), data: vo2, unit: 'mL/kg/min', to: '/vo2max-detail', hint: t('Log a reading or add it to your next test to see your own line here.') },
          { key: 'grip', title: t('Grip strength'), data: grip, unit: 'kg', to: '/grip-strength-detail', hint: t('Log your best attempt with a hand dynamometer to see your own line here.') },
        ].map((m) => {
          const off = !m.data || m.data.isSample;
          return (
            <BioChart
              key={m.key}
              title={m.title}
              value={off ? '—' : m.data!.latest}
              unit={off ? undefined : m.unit}
              sub={off ? t('Not measured yet') : m.data!.labels[m.data!.labels.length - 1]}
              off={off}
              onPress={() => router.push(m.to as any)}
            >
              {m.data ? (
                <TrendChart labels={m.data.labels} series={m.data.series.map((s) => ({ ...s, color: off ? FINE.mute : FINE.jade }))} height={SMALL} interactive={false} />
              ) : null}
              {off && <Text style={fine.note}>{m.hint}</Text>}
            </BioChart>
          );
        })}
        </View>
        </View>
        )}

        {/* Tus biomarcadores, desde el 2026-11-16 en fino (como la ficha de un biomarcador del prototipo): cada
            gráfica en su sección con la raya, la cifra grande y ligera y la curva en jade sin tarjeta; la lista
            entera en filas con línea fina, lo de fuera en oro y sin iconos rellenos */}
        {part === 'biomarkers' && (
        <View style={styles.bioBody}>
        <Text style={fine.lead}>{t('The values of your lab tests, each one against the range of its lab. Tap one to see all your results for it.')}</Text>
        <View style={grid ? styles.bioGrid : undefined}>
        {biomarkers.map((b) => {
          const off = !b.data || b.data.isSample;
          return (
            <BioChart
              key={b.key}
              title={t(b.title)}
              value={off ? '—' : b.data!.latest}
              unit={off ? undefined : b.unit}
              sub={off ? t('Not measured yet') : ''}
              off={off}
              onPress={() => router.push(b.to as any)}
              onHide={() => flipChart(b.marker)}
            >
              {b.data ? (
                <TrendChart
                  labels={b.data.labels}
                  series={b.data.series.map((s) => ({ ...s, color: off ? FINE.mute : FINE.jade }))}
                  height={90}
                  band={b.band}
                  formatY={b.key === 'cortisol' ? (v) => v.toFixed(0) : undefined}
                />
              ) : null}
              {off && <Text style={fine.note}>{t('Log a reading or add it to your next test to see your own line here.')}</Text>}
            </BioChart>
          );
        })}
        {pinned.map((k) => (
          <LabChartCard key={k} k={k} points={analyses.points} onHide={() => flipChart(k)} />
        ))}
        </View>
        {biomarkers.length + pinned.length === 0 && analyses.any && (
          <Text style={fine.note}>{t('No charts chosen. Tap the eye next to a value to see its chart here.')}</Text>
        )}
        <AnalysesList list={analyses.list} last={analyses.last} any={analyses.any} charts={charts} onEye={flipChart} />

        {/* Una debajo de otra: no sabemos cuántas pruebas habrá en camino (de ejemplo: no en cuentas reales) */}
        {showSamples() && (
          <>
            <SecHead title={t('Tests')} />
            {mockDiagnosticTests.map((test, i) => (
              <View key={test.id} style={[fine.row, i === mockDiagnosticTests.length - 1 && styles.bioNoLine]}>
                <Text style={[fine.rowTitle, styles.bioFlex]}>{test.nombre}</Text>
                <Text style={[styles.bioTestStatus, { color: diagnosticTone(test.status) }]}>
                  {test.statusLabel ? t(test.statusLabel) : test.status === 'ok' ? t('Normal') : t('Needs a look')}
                </Text>
              </View>
            ))}
          </>
        )}
        </View>
        )}

        {/* Botones de desarrollo: nunca en una cuenta real (meterían datos inventados en ella) */}
        {part === 'measurements' && showSamples() && (
        <TouchableOpacity style={styles.seedButton} onPress={handleLoadSeed}>
          <Ionicons name="flask-outline" size={16} color={FINE.mute} />
          <Text style={styles.seedButtonText}>Load dummy data (dev)</Text>
        </TouchableOpacity>
        )}
        {part === 'measurements' && authMode === 'supabase' && showSamples() && (
          <TouchableOpacity style={styles.seedButton} onPress={handleImportLocal}>
            <Ionicons name="cloud-upload-outline" size={16} color={FINE.mute} />
            <Text style={styles.seedButtonText}>Upload this phone's data to my account (dev)</Text>
          </TouchableOpacity>
        )}
        {seedStatus ? <Text style={styles.seedStatus}>{seedStatus}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

// «Analíticas»: el último valor de cada marcador de tus analíticas, frente al rango de su laboratorio. Primero
// los que están fuera, luego en rango y sin referencia; se ven unos pocos y «Ver todos». Cada uno abre su ficha
// con todos sus valores (/lab-marker). Sin analíticas, cómo subir la primera.
const LIST_FIRST = 6;
const CHARTS_FLAG = 'mydata_charts';
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const monthLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short', year: '2-digit' });

// La gráfica de un valor de tus analíticas elegido con el ojo: el último, y su línea si hay dos o más en la
// misma unidad (con la franja del rango recortada, como en su ficha). Al tocarla, su ficha.
const LabChartCard = ({ k, points, onHide }: { k: string; points: MarkerPoint[]; onHide: () => void }) => {
  const router = useRouter();
  const history = markerHistory(points, k);
  const latest = history[history.length - 1];
  if (!latest) return null;
  const chart = chartPoints(history);
  const values = chart.points.map((p) => p.value as number);
  return (
    <BioChart
      title={markerName(k, latest.name)}
      value={latest.value != null ? num(latest.value) : latest.text || '—'}
      unit={latest.unit || undefined}
      sub={shortDay(latest.date)}
      onPress={() => router.push(markerHref(k))}
      onHide={onHide}
    >
      {values.length >= 2 ? (
        <TrendChart
          labels={chart.points.map((p) => monthLabel(p.date))}
          series={[{ color: FINE.jade, values }]}
          height={90}
          band={chartBand(values, latest.low ? latest.low : null, latest.high)}
          formatY={(v) => num(Math.round(v * 10) / 10)}
        />
      ) : (
        <Text style={fine.note}>{t('One result so far: your next lab test will draw the line.')}</Text>
      )}
    </BioChart>
  );
};

// Una gráfica en fino (Tus biomarcadores y, desde el 2026-11-17, Mediciones): la cabecera de sección con su raya,
// el nombre y, en los biomarcadores, el ojo (quita la gráfica); debajo, la cifra grande y ligera con la unidad y la
// fecha (o la media) apagadas, y la curva sin tarjeta. Al tocarla, su ficha. `off`: aún sin medir, apagada.
const BioChart = ({
  title,
  value,
  unit,
  sub,
  off,
  onPress,
  onHide,
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  sub?: string;
  off?: boolean;
  onPress: () => void;
  onHide?: () => void; // el ojo (solo en Tus biomarcadores)
  children?: React.ReactNode;
}) => (
  <View style={[useWebShell() && styles.bioHalf, off && styles.metricOff]}>
    <SecRow
      title={title}
      right={
        onHide ? (
          <TouchableOpacity onPress={onHide} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Hide this chart')}>
            <Ionicons name="eye-outline" size={17} color={FINE.jade} />
          </TouchableOpacity>
        ) : undefined
      }
    />
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.bioFigure}>
        <Text style={styles.bioNum} numberOfLines={1}>
          {value}
        </Text>
        {unit ? <Text style={styles.bioUnit}>{unit}</Text> : null}
        <Text style={styles.bioSub} numberOfLines={1}>
          {sub}
        </Text>
        <Chev />
      </View>
      {children}
    </TouchableOpacity>
  </View>
);

const AnalysesList = ({ list, last, any, charts, onEye }: { list: MarkerSummary[]; last: MarkerPoint | null; any: boolean; charts: string[]; onEye: (key: string) => void }) => {
  const router = useRouter();
  const [all, setAll] = useState(false);
  if (!any) {
    return (
      <>
        <SecHead title={t('All your values')} />
        <Text style={[fine.note, styles.anaFirst]}>{t('No lab tests in Kuova yet. Upload a report (photo or PDF) and you will see each value here, with its history.')}</Text>
        <TouchableOpacity onPress={() => router.push('/upload-test')} hitSlop={8} style={styles.anaUpload} accessibilityRole="button">
          <Text style={fine.link}>{t('Upload a lab test')} ›</Text>
        </TouchableOpacity>
      </>
    );
  }
  if (!list.length) return null;
  const counts = stateCounts(list);
  const first = Math.max(LIST_FIRST, counts.out);
  const shown = all ? list : list.slice(0, first);
  const more = list.length > first;
  // Sin rojos: lo de fuera en oro, lo de dentro en jade
  const parts = [
    counts.out ? { text: t(counts.out === 1 ? '1 out of range' : '{n} out of range', { n: counts.out }), color: FINE.gold } : null,
    counts.in ? { text: t('{n} in range', { n: counts.in }), color: FINE.jade } : null,
    counts.none ? { text: t('{n} with no reference', { n: counts.none }), color: FINE.mute } : null,
  ].filter(Boolean) as { text: string; color: string }[];
  return (
    <>
      {/* La flecha de la derecha abre y cierra la lista entera (fundador, 2026-11-06); la de abajo, también */}
      <SecRow
        title={t('All your values')}
        right={
          more ? (
            <TouchableOpacity
              onPress={() => setAll(!all)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={all ? t('Show fewer') : t('See all {n} values', { n: list.length })}
            >
              <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={16} color={FINE.jade} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      {last && <Text style={fine.rowSub}>{t('Latest test: {date} · {lab}', { date: shortDay(last.date), lab: last.source.lab || t('Uploaded by you') })}</Text>}
      <Text style={styles.anaCounts}>
        {parts.map((p, i) => (
          <Text key={p.text} style={{ color: p.color }}>
            {i > 0 ? '  ·  ' : ''}
            {p.text}
          </Text>
        ))}
      </Text>
      <Text style={[fine.note, styles.anaEyeHint]}>{t('The eye shows or hides its chart above.')}</Text>
      {shown.map((s, i) => {
        const on = charts.includes(s.key);
        return (
          <View key={s.key} style={[fine.row, i === shown.length - 1 && !more && styles.bioNoLine]}>
            <TouchableOpacity
              onPress={() => onEye(s.key)}
              hitSlop={8}
              style={styles.anaEye}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t('Show its chart')}
            >
              <Ionicons name={on ? 'eye-outline' : 'eye-off-outline'} size={17} color={on ? FINE.jade : FINE.mute} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.anaMain} onPress={() => router.push(markerHref(s.key))} activeOpacity={0.7} accessibilityRole="button">
              <View style={styles.bioFlex}>
                <Text style={fine.rowTitle} numberOfLines={2}>
                  {markerName(s.key, s.latest.name)}
                </Text>
                <Text style={fine.rowSub}>
                  {shortDay(s.latest.date)}
                  {s.count > 1 ? ` · ${t('{n} results', { n: s.count })}` : ''}
                </Text>
              </View>
              <View style={styles.anaRight}>
                <Text style={[fine.rowValue, isOut(s.state) && { color: labToneColor('out') }]}>
                  {s.latest.value != null ? num(s.latest.value) : s.latest.text || '—'} <Text style={styles.anaUnit}>{s.latest.unit}</Text>
                </Text>
                <StatusWord label={rangeStatusLabel(s.state)} tone={rangeTone(s.state)} />
              </View>
              <Chev />
            </TouchableOpacity>
          </View>
        );
      })}
      {more ? (
        <TouchableOpacity onPress={() => setAll(!all)} hitSlop={8} style={styles.anaMore} accessibilityRole="button">
          <Text style={fine.link}>{all ? t('Show fewer') : t('See all {n} values', { n: list.length })}</Text>
          <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={14} color={FINE.jade} />
        </TouchableOpacity>
      ) : null}
      <Text style={fine.note}>
        {t('In range: within the reference range of its lab. Above or below: outside that range, which is not a diagnosis; your doctor puts it in context. No reference: the lab gives no range.')}
      </Text>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // deja ver el fondo ambiental de las pestañas
  },
  content: {
    paddingBottom: 32,
  },
  metricOff: { opacity: 0.55 },
  // Mediciones y Tus biomarcadores, en fino (2026-11-16 y 2026-11-17)
  bioBody: { paddingHorizontal: 20 },
  bioGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bioHalf: { width: '48%' },
  bioFlex: { flex: 1, minWidth: 0 },
  bioNoLine: { borderBottomWidth: 0 },
  bioFigure: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  bioNum: { ...fine.num, fontSize: 34, lineHeight: 40, flexShrink: 1 },
  bioUnit: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  bioSub: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 12.5, textAlign: 'right' },
  bioTestStatus: { ...ff('regular'), fontSize: 13 },
  anaFirst: { marginTop: 0 },
  anaUpload: { marginTop: 10 },
  anaCounts: { ...ff('regular'), fontSize: 12.5, marginTop: 6 },
  anaMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  anaEye: { paddingRight: 2 },
  anaEyeHint: { marginTop: 4, marginBottom: 2 },
  anaRight: { alignItems: 'flex-end', gap: 2 },
  anaUnit: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  anaMore: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 10 },
  // Botones de desarrollo, apagados
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 10,
  },
  seedButtonText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  seedStatus: { ...ff('regular'), color: FINE.mute, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
