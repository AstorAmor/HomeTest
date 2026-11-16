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
import { Colors, withAlpha } from '@/constants/colors';
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
import { formatSleep, shortDate, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';
import { useSections } from '@/data/appPrefs';
import { dateLocale, num, t } from '@/i18n';
import { useWebShell } from '@/web/webMode';
import { IconBadge } from '@/components/HealthIcons';
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
import { statusColor, statusIcon } from '@/components/LabValueRow';

const diagnosticIcon = (status: DiagnosticTest['status']) => {
  switch (status) {
    case 'ok':
      return { name: 'happy-outline' as const, color: Colors.accent };
    case 'waiting':
      return { name: 'time-outline' as const, color: Colors.textSecondary };
    case 'attention':
      return { name: 'alert-circle-outline' as const, color: Colors.danger };
  }
};

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

const wearableChart = (points: DailyPoint[] | undefined, color: string, format: (v: number) => string) => {
  const pts = points ?? [];
  return {
    labels: pts.map((p) => shortDate(p.date)),
    series: [{ color, values: pts.map((p) => p.value) }],
    latest: pts.length ? format(pts[pts.length - 1].value) : '—',
    avg: pts.length ? format(pts.reduce((a, p) => a + p.value, 0) / pts.length) : '—',
  };
};

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
            ? { labels: asc.map((e) => shortDate(e.fecha)), series: [{ color: Colors.violet, values: asc.map((e) => e.valor) }], latest: num(asc[asc.length - 1].valor.toFixed(1)), isSample: false }
            : null,
        );
      })
      .catch(() => setWeight(null));
    const [g, bpEntries, chol, cort, vo, uploads] = await Promise.all([
      getGlucoseEntries(),
      getBloodPressureEntries(),
      cholesterolRepository.getAll(),
      cortisolRepository.getAll(),
      vo2maxRepository.getAll().catch(() => []),
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
    // VO2max: sin mediciones, una línea de ejemplo "apagada" (como los demás sin medir)
    const voAsc = [...vo].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);    setVo2(
      voAsc.length
        ? { labels: voAsc.map((e) => shortDate(e.fecha)), series: [{ color: Colors.sky, values: voAsc.map((e) => e.valor) }], latest: num(voAsc[voAsc.length - 1].valor), isSample: false }
        : showSamples()
          ? { labels: ['', '', '', '', ''], series: [{ color: Colors.sky, values: [37, 38.5, 39, 40.5, 41] }], latest: '—', isSample: true }
          : null,
    );

    const bpAsc = [...bpEntries].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
    if (bpAsc.length >= 2 || (bpAsc.length === 1 && !showSamples())) {
      setBp({
        labels: bpAsc.map((e) => shortDate(e.fecha)),
        series: [
          { label: t('Systolic (high)'), color: Colors.coral, values: bpAsc.map((e) => e.systolic) },
          { label: t('Diastolic (low)'), color: Colors.sky, values: bpAsc.map((e) => e.diastolic) },
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
        labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        series: [
          { label: t('Systolic (high)'), color: Colors.coral, values: sys },
          { label: t('Diastolic (low)'), color: Colors.sky, values: dia },
        ],
        latest: '120/80',
        isSample: true,
      });
    }
  }, [setGlucose, setCholesterol, setCortisol, setBp, setWeight, setAnalyses]);

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

  const hr = wearableChart(series.resting_heart_rate, Colors.coral, (v) => `${Math.round(v)}`);
  const hrv = wearableChart(series.hrv, Colors.accent, (v) => `${Math.round(v)}`);
  const sleep = wearableChart(series.sleep_duration, Colors.violet, formatSleep);
  const steps = wearableChart(series.steps, Colors.sky, (v) => Math.round(v).toLocaleString(dateLocale()));
  const kcal = wearableChart(series.active_energy, Colors.amber, (v) => `${Math.round(v)}`);
  const temp = wearableChart(series.body_temperature, Colors.pinkSoft, (v) => v.toFixed(1));

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

        {part === 'measurements' && (
        <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionMeta}>
            {show('wearables') ? `${t('From your watch (last 14 days) and what you log')}${isSample ? ` · ${t('sample')}` : ''}` : t('What you log')}
          </Text>
        </View>
        <View style={grid ? styles.grid : undefined}>
        {/* Orden pedido: pasos, sueño, calorías, pulso en reposo y variabilidad */}
        {show('wearables') && (
          <>
            <MetricCard title={t('Steps')} icon="footsteps-outline" iconColor={Colors.sky} value={steps.latest} avg={t('avg {v}', { v: steps.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'steps' } })}>
              <TrendChart labels={steps.labels} series={steps.series} height={90} formatY={(v) => `${(v / 1000).toFixed(1)}k`} />
            </MetricCard>
            <MetricCard title={t('Sleep')} icon="moon-outline" iconColor={Colors.violet} value={sleep.latest} avg={t('avg {v}', { v: sleep.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'sleep_duration' } })}>
              <TrendChart labels={sleep.labels} series={sleep.series} height={90} formatY={(v) => `${(v / 60).toFixed(1)}h`} />
            </MetricCard>
            <MetricCard title={t('Active calories')} icon="flame-outline" iconColor={Colors.amber} value={kcal.latest} unit="kcal" avg={t('avg {v}', { v: kcal.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'active_energy' } })}>
              <TrendChart labels={kcal.labels} series={kcal.series} height={90} />
            </MetricCard>
            <MetricCard title={t('Resting heart rate')} icon="heart-outline" iconColor={Colors.coral} value={hr.latest} unit="bpm" avg={t('avg {v}', { v: hr.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'resting_heart_rate' } })}>
              <TrendChart labels={hr.labels} series={hr.series} height={90} />
            </MetricCard>
            <MetricCard title={t('Heart rate variability')} icon="pulse-outline" iconColor={Colors.accent} value={hrv.latest} unit="ms" avg={t('avg {v}', { v: hrv.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'hrv' } })}>
              <TrendChart labels={hrv.labels} series={hrv.series} height={90} />
            </MetricCard>
          </>
        )}

        {bp && (
          <MetricCard
            title={t('Blood pressure')}
            icon="speedometer-outline"
            iconColor={Colors.coral}
            value={bp.latest}
            unit="mmHg"
            avg={bp.isSample ? t('sample') : bp.latest === '—' ? t('Not measured yet') : t('tap to log')}
            onPress={() => router.push('/blood-pressure-detail')}
          >
            <TrendChart labels={bp.labels} series={bp.series} height={110} />
          </MetricCard>
        )}

        <MetricCard
          title={t('Weight')}
          icon="mci:scale-bathroom"
          iconColor={Colors.violet}
          value={weight ? weight.latest : '—'}
          unit={weight ? 'kg' : undefined}
          avg={
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
            <TrendChart labels={weight.labels} series={weight.series} height={90} formatY={(v) => v.toFixed(0)} />
          ) : (
            <Text style={styles.offHint}>{t('Weigh yourself once a week, on the same day and at the same time, to see your trend here.')}</Text>
          )}
        </MetricCard>

        {show('wearables') && (
          <MetricCard title={t('Temperature')} icon="thermometer-outline" iconColor={Colors.pinkSoft} value={temp.latest} unit="°C" avg={t('avg {v}', { v: temp.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'body_temperature' } })}>
            <TrendChart
              labels={temp.labels}
              series={temp.series}
              height={90}
              band={{ low: 36.1, high: 37.2 }}
              formatY={(v) => v.toFixed(1)}
            />
          </MetricCard>
        )}

        {(() => {
          const off = !vo2 || vo2.isSample;
          return (
            <MetricCard title="VO2max" icon="mci:lungs" iconColor={Colors.sky} value={off ? '—' : vo2!.latest} unit={off ? undefined : 'mL/kg/min'} avg={off ? t('Not measured yet') : ''} off={off} onPress={() => router.push('/vo2max-detail')}>
              {vo2 ? <TrendChart labels={vo2.labels} series={off ? vo2.series.map((s) => ({ ...s, color: Colors.textMuted })) : vo2.series} height={90} /> : null}
              {off && <Text style={styles.offHint}>{t('Log a reading or add it to your next test to see your own line here.')}</Text>}
            </MetricCard>
          );
        })()}
        </View>
        </>
        )}

        {part === 'biomarkers' && (
        <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionMeta}>{t('The values of your lab tests, each one against the range of its lab. Tap one to see all your results for it.')}</Text>
        </View>
        <View style={grid ? styles.grid : undefined}>
        {biomarkers.map((b) => {
          const off = !b.data || b.data.isSample;
          return (
            <MetricCard
              key={b.key}
              title={t(b.title)}
              icon={b.icon}
              iconColor={b.color}
              value={off ? '—' : b.data!.latest}
              unit={off ? undefined : b.unit}
              avg={off ? t('Not measured yet') : ''}
              off={off}
              onPress={() => router.push(b.to as any)}
              onHide={() => flipChart(b.marker)}
            >
              {b.data ? (
                <TrendChart labels={b.data.labels} series={off ? b.data.series.map((s) => ({ ...s, color: Colors.textMuted })) : b.data.series} height={90} band={b.band} formatY={b.key === 'cortisol' ? (v) => v.toFixed(0) : undefined} />
              ) : null}
              {off && <Text style={styles.offHint}>{t('Log a reading or add it to your next test to see your own line here.')}</Text>}
            </MetricCard>
          );
        })}
        {pinned.map((k) => (
          <LabChartCard key={k} k={k} points={analyses.points} onHide={() => flipChart(k)} />
        ))}
        </View>
        {biomarkers.length + pinned.length === 0 && analyses.any && (
          <Text style={[styles.offHint, { marginHorizontal: 20, marginBottom: 10 }]}>{t('No charts chosen. Tap the eye next to a value to see its chart here.')}</Text>
        )}
        <AnalysesList list={analyses.list} last={analyses.last} any={analyses.any} charts={charts} onEye={flipChart} />

        {showSamples() && <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('Tests')}</Text>}
        {/* Una debajo de otra: no sabemos cuántas pruebas habrá en camino (de ejemplo: no en cuentas reales) */}
        {showSamples() && <View style={styles.testList}>
          {mockDiagnosticTests.map((test, i) => {
            const icon = diagnosticIcon(test.status);
            return (
              <View key={test.id} style={[styles.testRow, i > 0 && styles.testDivider]}>
                <Text style={styles.diagnosticName}>{test.nombre}</Text>
                <View style={styles.testStatus}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                  <Text style={[styles.testStatusText, { color: icon.color }]}>
                    {test.statusLabel ? t(test.statusLabel) : test.status === 'ok' ? t('Normal') : t('Needs a look')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>}

        </>
        )}

        {/* Botones de desarrollo: nunca en una cuenta real (meterían datos inventados en ella) */}
        {part === 'measurements' && showSamples() && (
        <TouchableOpacity style={styles.seedButton} onPress={handleLoadSeed}>
          <Ionicons name="flask-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.seedButtonText}>Load dummy data (dev)</Text>
        </TouchableOpacity>
        )}
        {part === 'measurements' && authMode === 'supabase' && showSamples() && (
          <TouchableOpacity style={styles.seedButton} onPress={handleImportLocal}>
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.textMuted} />
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
    <MetricCard
      title={markerName(k, latest.name)}
      icon="flask-outline"
      iconColor={Colors.sky}
      value={latest.value != null ? num(latest.value) : latest.text || '—'}
      unit={latest.unit || undefined}
      avg={shortDay(latest.date)}
      onPress={() => router.push(markerHref(k))}
      onHide={onHide}
    >
      {values.length >= 2 ? (
        <TrendChart
          labels={chart.points.map((p) => monthLabel(p.date))}
          series={[{ color: Colors.sky, values }]}
          height={90}
          band={chartBand(values, latest.low ? latest.low : null, latest.high)}
          formatY={(v) => num(Math.round(v * 10) / 10)}
        />
      ) : (
        <Text style={styles.offHint}>{t('One result so far: your next lab test will draw the line.')}</Text>
      )}
    </MetricCard>
  );
};

const AnalysesList = ({ list, last, any, charts, onEye }: { list: MarkerSummary[]; last: MarkerPoint | null; any: boolean; charts: string[]; onEye: (key: string) => void }) => {
  const router = useRouter();
  const [all, setAll] = useState(false);
  if (!any) {
    return (
      <View style={styles.anaCard}>
        <Text style={styles.anaText}>{t('No lab tests in Kuova yet. Upload a report (photo or PDF) and you will see each value here, with its history.')}</Text>
        <TouchableOpacity onPress={() => router.push('/upload-test')} hitSlop={8} style={{ marginTop: 10 }}>
          <Text style={styles.anaLink}>
            {t('Upload a lab test')} <Ionicons name="chevron-forward" size={13} color={Colors.accent} />
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!list.length) return null;
  const counts = stateCounts(list);
  const first = Math.max(LIST_FIRST, counts.out);
  const shown = all ? list : list.slice(0, first);
  const more = list.length > first;
  const parts = [
    counts.out ? { text: t(counts.out === 1 ? '1 out of range' : '{n} out of range', { n: counts.out }), color: Colors.attention } : null,
    counts.in ? { text: t('{n} in range', { n: counts.in }), color: Colors.ok } : null,
    counts.none ? { text: t('{n} with no reference', { n: counts.none }), color: Colors.textSecondary } : null,
  ].filter(Boolean) as { text: string; color: string }[];
  return (
    <>
      <View style={styles.anaCard}>
        {/* La flecha de la derecha abre y cierra la lista entera (fundador, 2026-11-06); la de abajo, también */}
        <View style={styles.anaHead}>
          <Text style={[styles.anaTitle, { flex: 1 }]}>{t('All your values')}</Text>
          {more && (
            <TouchableOpacity
              onPress={() => setAll(!all)}
              hitSlop={10}
              style={styles.anaToggle}
              accessibilityRole="button"
              accessibilityLabel={all ? t('Show fewer') : t('See all {n} values', { n: list.length })}
            >
              <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.accent} />
            </TouchableOpacity>
          )}
        </View>
        {last && <Text style={styles.anaMeta}>{t('Latest test: {date} · {lab}', { date: shortDay(last.date), lab: last.source.lab || t('Uploaded by you') })}</Text>}
        <Text style={styles.anaCounts}>
          {parts.map((p, i) => (
            <Text key={p.text} style={{ color: p.color }}>
              {i > 0 ? '  ·  ' : ''}
              {p.text}
            </Text>
          ))}
        </Text>
        <Text style={styles.anaEyeHint}>{t('The eye shows or hides its chart above.')}</Text>
        {shown.map((s, i) => {
          const color = statusColor(s.state);
          const on = charts.includes(s.key);
          return (
            <View key={s.key} style={[styles.anaRow, i > 0 && styles.testDivider]}>
              <TouchableOpacity
                onPress={() => onEye(s.key)}
                hitSlop={8}
                style={styles.anaEye}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t('Show its chart')}
              >
                <Ionicons name={on ? 'eye' : 'eye-off-outline'} size={18} color={on ? Colors.accent : Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.anaMain} onPress={() => router.push(markerHref(s.key))} activeOpacity={0.8}>
              <Ionicons name={statusIcon(s.state) as any} size={18} color={color} />
              <View style={{ flex: 1 }}>
                <Text style={styles.anaName} numberOfLines={2}>
                  {markerName(s.key, s.latest.name)}
                </Text>
                <Text style={styles.anaSub}>
                  {shortDay(s.latest.date)}
                  {s.count > 1 ? ` · ${t('{n} results', { n: s.count })}` : ''}
                </Text>
              </View>
              <Text style={[styles.anaValue, isOut(s.state) && { color: Colors.attention }]}>
                {s.latest.value != null ? num(s.latest.value) : s.latest.text || '—'} <Text style={styles.anaUnit}>{s.latest.unit}</Text>
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          );
        })}
        {more ? (
          <TouchableOpacity onPress={() => setAll(!all)} hitSlop={8} style={styles.anaMore}>
            <Text style={styles.anaLink}>{all ? t('Show fewer') : t('See all {n} values', { n: list.length })}</Text>
            <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.accent} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.anaLegend}>
        {t('In range: within the reference range of its lab. Above or below: outside that range, which is not a diagnosis; your doctor puts it in context. No reference: the lab gives no range.')}
      </Text>
    </>
  );
};

const MetricCard = ({
  title,
  icon,
  iconColor,
  value,
  unit,
  avg,
  off,
  onPress,
  onHide,
  children,
}: {
  title: string;
  icon: string;
  iconColor: string;
  value: string;
  unit?: string;
  avg?: string;
  off?: boolean; // aún sin medir: se ve "apagado"
  onPress: () => void;
  onHide?: () => void; // el ojo: quita la tarjeta (Analíticas)
  children?: React.ReactNode;
}) => (
  <TouchableOpacity style={[styles.metricCard, useWebShell() && styles.metricCardHalf, off && styles.metricOff]} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.metricHeader}>
      <IconBadge name={icon} color={iconColor} size={28} />
      <Text style={styles.metricTitle}>{title}</Text>
      {onHide ? (
        <TouchableOpacity onPress={onHide} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Hide this chart')}>
          <Ionicons name="eye" size={17} color={Colors.accent} />
        </TouchableOpacity>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </View>
    <View style={styles.metricValueRow}>
      <Text style={styles.metricValue}>{value}</Text>
      {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      {avg ? <Text style={styles.metricAvg}>{avg}</Text> : null}
    </View>
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // deja ver el fondo ambiental de las pestañas
  },
  content: {
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 2,
  },
  bioAge: { alignItems: 'center', marginHorizontal: 20, marginTop: 4, marginBottom: 24 },
  bioAgeKicker: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  bioAgeMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 6 },
  bioAgeMore: { color: Colors.accent, fontSize: 13, fontWeight: '800', marginTop: 10 },
  bioAgeDiff: { fontSize: 17, fontWeight: '800', marginTop: 14 },
  bioAgeMargin: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800' },
  // El tutorial señala el bloque genético: los márgenes van en su marco para que el hueco se ajuste
  geneticSlot: { marginHorizontal: 20, marginBottom: 20 },
  geneticInSlot: { marginHorizontal: 0, marginBottom: 0 },
  genetic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  geneticIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(Colors.gold, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  geneticTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  geneticSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  // "years" pequeño y abajo, como un subíndice
  bioAgeSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  bioAgeLocked: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 8, maxWidth: 290 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionTitleSpaced: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20 },
  metricCardHalf: { width: '49%', marginHorizontal: 0 },
  metricCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  metricTitle: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  metricUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  metricAvg: {
    marginLeft: 'auto',
    color: Colors.textMuted,
    fontSize: 12,
  },
  testList: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  testRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  testDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  testStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testStatusText: { fontSize: 13, fontWeight: '600' },
  metricOff: { opacity: 0.55 },
  anaCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 20, marginBottom: 8 },
  anaTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  anaMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  anaCounts: { fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  anaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
  anaMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  anaEye: { paddingRight: 2 },
  anaEyeHint: { color: Colors.textMuted, fontSize: 11, marginBottom: 2 },
  anaHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  anaToggle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  anaName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  anaSub: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  anaValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  anaUnit: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  anaMore: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8 },
  anaLink: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
  anaText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  anaLegend: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginHorizontal: 20, marginBottom: 20 },
  offHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  diagnosticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  diagnosticCard: {
    width: '47%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagnosticName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  diagnosticWaiting: {
    alignItems: 'center',
    gap: 2,
  },
  diagnosticWaitingText: {
    color: Colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
    width: 60,
  },
  periodBlock: { paddingHorizontal: 20, marginBottom: 24, gap: 10 },
  filesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  filesText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 10,
  },
  seedButtonText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  seedStatus: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
