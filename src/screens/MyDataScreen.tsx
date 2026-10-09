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
    return d.toLocaleDateString('en-GB', { month: 'short' });
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
  const steps = wearableChart(series.steps, Colors.sky, (v) => Math.round(v).toLocaleString('en-GB'));
  const kcal = wearableChart(series.active_energy, Colors.amber, (v) => `${Math.round(v)}`);
  const temp = wearableChart(series.body_temperature, Colors.pinkSoft, (v) => v.toFixed(1));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My Data" />

        {/* Edad biológica (PhenoAge) de la última analítica: lo primero que se ve */}
        {(() => {
          const now = currentReport.summary.phenoage;
          const before = baselineReport.summary.phenoage;
          if (!now.available) return null;
          const mid = (p: typeof now) => (p.low + p.high) / 2;
          const younger = now.chronological_age - mid(now);
          return (
            <TouchableOpacity style={styles.bioAge} onPress={() => router.push('/report-summary')} activeOpacity={0.85}>
              <View style={styles.bioAgeHeader}>
                <Ionicons name="hourglass-outline" size={18} color={Colors.accent} />
                <Text style={styles.bioAgeTitle}>Your biological age</Text>
                <Text style={styles.bioAgeTag}>sample</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
              <Text style={styles.bioAgeValue}>
                {Math.round(now.low)}–{Math.round(now.high)}
                <Text style={styles.bioAgeUnit}> years</Text>
              </Text>
              <Text style={styles.bioAgeSub}>
                {(() => {
                  const n = Math.round(Math.abs(younger));
                  return `About ${n} year${n === 1 ? '' : 's'} ${younger >= 0 ? 'younger' : 'older'}`;
                })()}{' '}
                than your age (
                {now.chronological_age})
                {before.available && mid(before) > mid(now) ? ` · down from ${Math.round(before.low)}–${Math.round(before.high)} at your previous test` : ''}
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* Perfil genético: antecedentes familiares ("Know your roots") y, más adelante, resultados */}
        <TouchableOpacity style={styles.genetic} onPress={() => router.push('/genetic-profile')} activeOpacity={0.85}>
          <View style={styles.geneticIcon}>
            <MaterialCommunityIcons name="dna" size={20} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.geneticTitle}>Your genetic profile</Text>
            <Text style={styles.geneticSub}>Know your roots: what runs in your family</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {sex === 'female' && cycle && show('cycle') && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Period</Text>
            </View>
            <View style={styles.periodBlock}>
              <CycleStrip info={cycle} onPress={() => router.push('/cycle-detail')} />
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{show('wearables') ? 'Wearable measurements' : 'Measurements'}</Text>
          {show('wearables') && <Text style={styles.sectionMeta}>Last 14 days{isSample ? ' · sample' : ''}</Text>}
        </View>
        {show('wearables') && (
          <>
            <MetricCard title="Resting heart rate" icon="heart" iconColor={Colors.coral} value={hr.latest} unit="bpm" avg={`avg ${hr.avg}`} onPress={() => router.push({ pathname: '/metric', params: { kind: 'resting_heart_rate' } })}>
              <TrendChart labels={hr.labels} series={hr.series} height={90} />
            </MetricCard>
            <MetricCard title="Heart rate variability" icon="pulse" iconColor={Colors.accent} value={hrv.latest} unit="ms" avg={`avg ${hrv.avg}`} onPress={() => router.push({ pathname: '/metric', params: { kind: 'hrv' } })}>
              <TrendChart labels={hrv.labels} series={hrv.series} height={90} />
            </MetricCard>
            <MetricCard title="Sleep" icon="moon" iconColor={Colors.violet} value={sleep.latest} avg={`avg ${sleep.avg}`} onPress={() => router.push({ pathname: '/metric', params: { kind: 'sleep_duration' } })}>
              <TrendChart labels={sleep.labels} series={sleep.series} height={90} formatY={(v) => `${(v / 60).toFixed(1)}h`} />
            </MetricCard>
            <MetricCard title="Steps" icon="footsteps" iconColor={Colors.sky} value={steps.latest} avg={`avg ${steps.avg}`} onPress={() => router.push({ pathname: '/metric', params: { kind: 'steps' } })}>
              <TrendChart labels={steps.labels} series={steps.series} height={90} formatY={(v) => `${(v / 1000).toFixed(1)}k`} />
            </MetricCard>
            <MetricCard title="Active calories" icon="flame" iconColor={Colors.amber} value={kcal.latest} unit="kcal" avg={`avg ${kcal.avg}`} onPress={() => router.push({ pathname: '/metric', params: { kind: 'active_energy' } })}>
              <TrendChart labels={kcal.labels} series={kcal.series} height={90} />
            </MetricCard>
          </>
        )}

        {bp && (
          <MetricCard
            title="Blood pressure"
            icon="speedometer"
            iconColor={Colors.coral}
            value={bp.latest}
            unit="mmHg"
            avg={bp.isSample ? 'sample' : 'tap to log'}
            onPress={() => router.push('/blood-pressure-detail')}
          >
            <TrendChart labels={bp.labels} series={bp.series} height={110} />
          </MetricCard>
        )}

        {show('wearables') && (
          <MetricCard title="Temperature" icon="thermometer" iconColor={Colors.pinkSoft} value={temp.latest} unit="°C" avg={`avg ${temp.avg}`} onPress={() => router.push({ pathname: '/metric', params: { kind: 'body_temperature' } })}>
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
          <Text style={styles.sectionTitle}>Biomarkers</Text>
          <Text style={styles.sectionMeta}>Tap to see history and log</Text>
        </View>
        {/* Sin datos todavía: la tarjeta sale igual, para registrar la primera lectura */}
        {!glucose && <MetricCard title="Sugar" icon="water" iconColor={Colors.accent} value="—" avg="tap to log" onPress={() => router.push('/glucose-detail')} />}
        {!cholesterol && (
          <MetricCard title="Total cholesterol" icon="analytics" iconColor={Colors.amber} value="—" avg="tap to log" onPress={() => router.push('/cholesterol-detail')} />
        )}
        {!cortisol && <MetricCard title="Cortisol" icon="sunny" iconColor={Colors.violet} value="—" avg="tap to log" onPress={() => router.push('/cortisol-detail')} />}
        {glucose && (
          <MetricCard title="Sugar" icon="water" iconColor={Colors.accent} value={glucose.latest} unit="mg/dL" avg={glucose.isSample ? 'sample' : ''} onPress={() => router.push('/glucose-detail')}>
            <TrendChart labels={glucose.labels} series={glucose.series} height={90} band={{ low: 70, high: 99 }} />
          </MetricCard>
        )}
        {cholesterol && (
          <MetricCard title="Total cholesterol" icon="analytics" iconColor={Colors.amber} value={cholesterol.latest} unit="mg/dL" avg={cholesterol.isSample ? 'sample' : ''} onPress={() => router.push('/cholesterol-detail')}>
            <TrendChart labels={cholesterol.labels} series={cholesterol.series} height={90} band={{ low: 125, high: 200 }} />
          </MetricCard>
        )}
        {cortisol && (
          <MetricCard title="Cortisol" icon="sunny" iconColor={Colors.violet} value={cortisol.latest} unit="µg/dL" avg={cortisol.isSample ? 'sample' : ''} onPress={() => router.push('/cortisol-detail')}>
            <TrendChart labels={cortisol.labels} series={cortisol.series} height={90} formatY={(v) => v.toFixed(0)} />
          </MetricCard>
        )}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Tests</Text>
        <View style={styles.diagnosticGrid}>
          {mockDiagnosticTests.map((test) => {
            const icon = diagnosticIcon(test.status);
            return (
              <View key={test.id} style={styles.diagnosticCard}>
                <Text style={styles.diagnosticName}>{test.nombre}</Text>
                {test.statusLabel ? (
                  <View style={styles.diagnosticWaiting}>
                    <Ionicons name={icon.name} size={16} color={icon.color} />
                    <Text style={styles.diagnosticWaitingText}>{test.statusLabel}</Text>
                  </View>
                ) : (
                  <Ionicons name={icon.name} size={28} color={icon.color} />
                )}
              </View>
            );
          })}
        </View>


        <TouchableOpacity style={styles.filesCard}>
          <Ionicons name="folder-outline" size={22} color={Colors.textPrimary} />
          <Text style={styles.filesText}>Access to your files</Text>
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
  onPress,
  children,
}: {
  title: string;
  icon: string;
  iconColor: string;
  value: string;
  unit?: string;
  avg?: string;
  onPress: () => void;
  children?: React.ReactNode;
}) => (
  <TouchableOpacity style={styles.metricCard} onPress={onPress} activeOpacity={0.85}>
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
  bioAgeValue: { color: Colors.accent, fontSize: 34, fontWeight: '800', marginTop: 8 },
  bioAgeUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  bioAgeSub: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
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
