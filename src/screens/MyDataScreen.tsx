import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart, TrendSeries } from '@/components/TrendChart';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { mockBiomarkers, mockDiagnosticTests, DiagnosticTest } from '@/data/mockData';
import { loadSeedData } from '@/data/seedData';
import { importLocalDataToAccount } from '@/data/importLocalData';
import { profileRepository, Sex } from '@/data/profileRepository';
import { useAuth } from '@/context/AuthContext';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { cortisolRepository } from '@/data/cortisolRepository';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { formatSleep, shortDate, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo } from '@/utils/cyclePhase';
import { CycleStrip } from '@/components/CycleStrip';
import { useSections } from '@/data/appPrefs';
import { dateLocale, t } from '@/i18n';

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
// inventadas) para que la pantalla no salga vacía en la demo.
function simpleChart(entries: DatedValue[], mockId: string, color: string): ChartData {
  const asc = [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
  if (asc.length >= 2) {
    return {
      labels: asc.map((e) => shortDate(e.fecha)),
      series: [{ color, values: asc.map((e) => e.valor) }],
      latest: String(asc[asc.length - 1].valor),
      isSample: false,
    };
  }
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

export const MyDataScreen = () => {
  const router = useRouter();
  const show = useSections();
  const { series, isSample } = useDailyWearables();
  const { authMode } = useAuth();
  const [seedStatus, setSeedStatus] = useState('');
  const [glucose, setGlucose] = useDeepState<ChartData | null>(null);
  const [cholesterol, setCholesterol] = useDeepState<ChartData | null>(null);
  const [cortisol, setCortisol] = useDeepState<ChartData | null>(null);
  const [bp, setBp] = useDeepState<ChartData | null>(null);
  // El ciclo menstrual solo se muestra a perfiles de mujer
  const [sex, setSex] = useState<Sex | undefined>(undefined);
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);

  const load = useCallback(async () => {
    profileRepository
      .get()
      .then(async (p) => {
        setSex(p.sex);
        setCycle(p.sex === 'female' ? currentCyclePhase(await cycleRepository.getAll()) : null);
      })
      .catch(() => undefined);
    const [g, bpEntries, chol, cort] = await Promise.all([
      getGlucoseEntries(),
      getBloodPressureEntries(),
      cholesterolRepository.getAll(),
      cortisolRepository.getAll(),
    ]);
    setGlucose(simpleChart(g, 'sugar', Colors.accent));
    setCholesterol(simpleChart(chol, 'cholesterol', Colors.amber));
    setCortisol(simpleChart(cort, 'cortisol', Colors.violet));

    const bpAsc = [...bpEntries].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-RECENT);
    if (bpAsc.length >= 2) {
      setBp({
        labels: bpAsc.map((e) => shortDate(e.fecha)),
        series: [
          { label: 'Systolic (high)', color: Colors.coral, values: bpAsc.map((e) => e.systolic) },
          { label: 'Diastolic (low)', color: Colors.sky, values: bpAsc.map((e) => e.diastolic) },
        ],
        latest: `${bpAsc[bpAsc.length - 1].systolic}/${bpAsc[bpAsc.length - 1].diastolic}`,
        isSample: false,
      });
    } else {
      const sys = [118, 122, 119, 125, 121, 120];
      const dia = [78, 81, 77, 83, 80, 80];
      setBp({
        labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        series: [
          { label: 'Systolic (high)', color: Colors.coral, values: sys },
          { label: 'Diastolic (low)', color: Colors.sky, values: dia },
        ],
        latest: '120/80',
        isSample: true,
      });
    }
  }, [setGlucose, setCholesterol, setCortisol, setBp]);

  useReloadOnFocus(load);

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

  // Biomarcadores: primero lo que la persona ha medido; lo que no, "apagado" como incentivo
  const biomarkers = [
    { key: 'sugar', title: 'Sugar', icon: 'water', color: Colors.accent, data: glucose, unit: 'mg/dL', to: '/glucose-detail', band: { low: 70, high: 99 } },
    { key: 'chol', title: 'Total cholesterol', icon: 'analytics', color: Colors.amber, data: cholesterol, unit: 'mg/dL', to: '/cholesterol-detail', band: { low: 125, high: 200 } },
    { key: 'cortisol', title: 'Cortisol', icon: 'sunny', color: Colors.violet, data: cortisol, unit: 'µg/dL', to: '/cortisol-detail' },
  ].sort((a, b) => Number(!a.data || a.data.isSample) - Number(!b.data || b.data.isSample));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('My Data')} />

        {/* Edad biológica (PhenoAge) de la última analítica: lo primero que se ve */}
        {(() => {
          const now = currentReport.summary.phenoage;
          const before = baselineReport.summary.phenoage;
          if (!now.available) return null;
          const mid = (p: typeof now) => (p.low + p.high) / 2;
          const younger = now.chronological_age - mid(now);
          const n = Math.round(Math.abs(younger));
          return (
            <TouchableOpacity style={styles.bioAge} onPress={() => router.push('/biological-age')} activeOpacity={0.85}>
              <View style={styles.bioAgeHeader}>
                <Ionicons name="hourglass-outline" size={18} color={Colors.accent} />
                <Text style={styles.bioAgeTitle}>{t('Your biological age')}</Text>
                <Text style={styles.bioAgeTag}>{t('sample')}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
              <View style={styles.bioAgeValueRow}>
                <Text style={styles.bioAgeValue}>
                  {Math.round(now.low)}–{Math.round(now.high)}
                </Text>
                <Text style={styles.bioAgeUnit}>{t('years')}</Text>
              </View>
              <Text style={styles.bioAgeSub}>
                {t(younger >= 0 ? (n === 1 ? 'About {n} year younger than your age ({age})' : 'About {n} years younger than your age ({age})') : n === 1 ? 'About {n} year older than your age ({age})' : 'About {n} years older than your age ({age})', {
                  n,
                  age: now.chronological_age,
                })}
                {before.available && mid(before) > mid(now)
                  ? t(' · down from {low}–{high} at your previous test', { low: Math.round(before.low), high: Math.round(before.high) })
                  : ''}
              </Text>
            </TouchableOpacity>
          );
        })()}

        {sex === 'female' && cycle && show('cycle') && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('Period')}</Text>
            </View>
            <View style={styles.periodBlock}>
              <CycleStrip info={cycle} onPress={() => router.push('/cycle-detail')} />
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{show('wearables') ? t('Wearable measurements') : t('Measurements')}</Text>
          {show('wearables') && <Text style={styles.sectionMeta}>{t('Last 14 days')}{isSample ? ` · ${t('sample')}` : ''}</Text>}
        </View>
        {/* Orden pedido: pasos, sueño, calorías, pulso en reposo y variabilidad */}
        {show('wearables') && (
          <>
            <MetricCard title={t('Steps')} icon="footsteps" iconColor={Colors.sky} value={steps.latest} avg={t('avg {v}', { v: steps.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'steps' } })}>
              <TrendChart labels={steps.labels} series={steps.series} height={90} formatY={(v) => `${(v / 1000).toFixed(1)}k`} />
            </MetricCard>
            <MetricCard title={t('Sleep')} icon="moon" iconColor={Colors.violet} value={sleep.latest} avg={t('avg {v}', { v: sleep.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'sleep_duration' } })}>
              <TrendChart labels={sleep.labels} series={sleep.series} height={90} formatY={(v) => `${(v / 60).toFixed(1)}h`} />
            </MetricCard>
            <MetricCard title={t('Active calories')} icon="flame" iconColor={Colors.amber} value={kcal.latest} unit="kcal" avg={t('avg {v}', { v: kcal.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'active_energy' } })}>
              <TrendChart labels={kcal.labels} series={kcal.series} height={90} />
            </MetricCard>
            <MetricCard title={t('Resting heart rate')} icon="heart" iconColor={Colors.coral} value={hr.latest} unit="bpm" avg={t('avg {v}', { v: hr.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'resting_heart_rate' } })}>
              <TrendChart labels={hr.labels} series={hr.series} height={90} />
            </MetricCard>
            <MetricCard title={t('Heart rate variability')} icon="pulse" iconColor={Colors.accent} value={hrv.latest} unit="ms" avg={t('avg {v}', { v: hrv.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'hrv' } })}>
              <TrendChart labels={hrv.labels} series={hrv.series} height={90} />
            </MetricCard>
          </>
        )}

        {bp && (
          <MetricCard
            title={t('Blood pressure')}
            icon="speedometer"
            iconColor={Colors.coral}
            value={bp.latest}
            unit="mmHg"
            avg={bp.isSample ? t('sample') : t('tap to log')}
            onPress={() => router.push('/blood-pressure-detail')}
          >
            <TrendChart labels={bp.labels} series={bp.series} height={110} />
          </MetricCard>
        )}

        {show('wearables') && (
          <MetricCard title={t('Temperature')} icon="thermometer" iconColor={Colors.pinkSoft} value={temp.latest} unit="°C" avg={t('avg {v}', { v: temp.avg })} onPress={() => router.push({ pathname: '/metric', params: { kind: 'body_temperature' } })}>
            <TrendChart
              labels={temp.labels}
              series={temp.series}
              height={90}
              band={{ low: 36.1, high: 37.2 }}
              formatY={(v) => v.toFixed(1)}
            />
          </MetricCard>
        )}

        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>{t('Biomarkers')}</Text>
          <Text style={styles.sectionMeta}>{t('What you have measured first. Tap any to see history or log a reading.')}</Text>
        </View>
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
            >
              {b.data ? (
                <TrendChart labels={b.data.labels} series={off ? b.data.series.map((s) => ({ ...s, color: Colors.textMuted })) : b.data.series} height={90} band={b.band} formatY={b.key === 'cortisol' ? (v) => v.toFixed(0) : undefined} />
              ) : null}
              {off && <Text style={styles.offHint}>{t('Log a reading or add it to your next test to see your own line here.')}</Text>}
            </MetricCard>
          );
        })}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{t('Tests')}</Text>
        {/* Una debajo de otra: no sabemos cuántas pruebas habrá en camino */}
        <View style={styles.testList}>
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
        </View>

        {/* Perfil genético: antecedentes familiares ("Know your roots") y, más adelante, resultados */}
        <TouchableOpacity style={styles.genetic} onPress={() => router.push('/genetic-profile')} activeOpacity={0.85}>
          <View style={styles.geneticIcon}>
            <MaterialCommunityIcons name="dna" size={20} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.geneticTitle}>{t('Your genetic profile')}</Text>
            <Text style={styles.geneticSub}>{t('Know your roots: what runs in your family')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.genetic} onPress={() => router.push('/files')} activeOpacity={0.85}>
          <View style={[styles.geneticIcon, { backgroundColor: withAlpha(Colors.accent, 0.12) }]}>
            <Ionicons name="folder-open-outline" size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.geneticTitle}>{t('Your files')}</Text>
            <Text style={styles.geneticSub}>{t('Lab reports and everything you upload')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Informe de evolución: hábitos y marcadores entre tus dos últimas analíticas */}
        <TouchableOpacity style={styles.genetic} onPress={() => router.push('/habits')} activeOpacity={0.85}>
          <View style={[styles.geneticIcon, { backgroundColor: withAlpha(Colors.ok, 0.14) }]}>
            <Ionicons name="trending-up" size={20} color={Colors.ok} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.geneticTitle}>{t('Your evolution report')}</Text>
            <Text style={styles.geneticSub}>{t('How your habits and markers have changed. Create it and share it.')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.seedButton} onPress={handleLoadSeed}>
          <Ionicons name="flask-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.seedButtonText}>Load dummy data (dev)</Text>
        </TouchableOpacity>
        {authMode === 'supabase' && (
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

const MetricCard = ({
  title,
  icon,
  iconColor,
  value,
  unit,
  avg,
  off,
  onPress,
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
  children?: React.ReactNode;
}) => (
  <TouchableOpacity style={[styles.metricCard, off && styles.metricOff]} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.metricHeader}>
      <View style={[styles.metricIcon, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
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
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 2,
  },
  bioAge: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  bioAgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bioAgeValueRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 4, marginTop: 8 },
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
  bioAgeTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  bioAgeTag: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  bioAgeValue: { color: Colors.accent, fontSize: 38, fontWeight: '800' },
  // "years" pequeño y abajo, como un subíndice
  bioAgeUnit: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  bioAgeSub: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4, textAlign: 'center' },
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
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
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
