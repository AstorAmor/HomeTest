import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ProgressRing } from '@/components/ProgressRing';
import { TrendChart } from '@/components/TrendChart';
import { CycleStrip } from '@/components/CycleStrip';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import {
  mockPatient,
  mockBiomarkers,
  mockNextTestDate,
  mockResultsEtaDays,
  Biomarker,
} from '@/data/mockData';
import { getLiveBiomarkers } from '@/utils/liveBiomarkers';
import { profileRepository, UserProfile } from '@/data/profileRepository';
import { checkInRepository, dailyCheckInSeries, sampleCheckInSeries, DailyCheckInPoint } from '@/data/checkInRepository';
import { CheckInEntry, MOOD_OPTIONS, MOMENT_OPTIONS } from '@/types/checkIn';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo } from '@/utils/cyclePhase';
import {
  CURRENT_PLAN,
  PlanItemKind,
  mealsLoggedToday,
  strengthSessionsThisWeek,
} from '@/data/planRepository';
import { computeReadiness, formatSleep, latest, shortDate, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';

const firstName = mockPatient.nombre.split(' ')[0];

const statusColor = (status: Biomarker['status']) => {
  switch (status) {
    case 'excellent':
    case 'good':
      return Colors.accent;
    case 'attention':
      return Colors.warning;
    case 'high':
      return Colors.danger;
    default:
      return Colors.textSecondary;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
};

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

// Estado de un valor de wearable frente a su media reciente
const vsUsual = (points: DailyPoint[] | undefined, higherIsBetter: boolean) => {
  if (!points || points.length < 3) return { label: '—', color: Colors.textSecondary };
  const today = points[points.length - 1].value;
  const base = points.slice(0, -1).reduce((a, p) => a + p.value, 0) / (points.length - 1);
  const diff = (today - base) / base;
  if (Math.abs(diff) < 0.06) return { label: 'As usual', color: Colors.accent };
  const better = higherIsBetter ? diff > 0 : diff < 0;
  return better
    ? { label: higherIsBetter ? 'Above your usual' : 'Below your usual', color: Colors.accent }
    : { label: higherIsBetter ? 'Below your usual' : 'Above your usual', color: Colors.warning };
};

// Icono abstracto del check-in: orbe con gradiente
const CheckInOrb = () => (
  <Svg width={52} height={52}>
    <Defs>
      <RadialGradient id="orb" cx="35%" cy="30%" r="75%">
        <Stop offset="0" stopColor="#C9C2FF" />
        <Stop offset="0.45" stopColor={Colors.violet} />
        <Stop offset="1" stopColor="#3ECDB8" stopOpacity="0.85" />
      </RadialGradient>
    </Defs>
    <Circle cx={26} cy={26} r={24} fill="url(#orb)" />
    <Circle cx={19} cy={18} r={5} fill="#FFFFFF" opacity={0.35} />
  </Svg>
);

const PLAN_ICON: Record<PlanItemKind, { family: 'mci' | 'ion'; name: string; color: string }> = {
  strength: { family: 'mci', name: 'dumbbell', color: Colors.coral },
  steps: { family: 'ion', name: 'footsteps', color: Colors.sky },
  nutrition: { family: 'mci', name: 'rice', color: Colors.amber },
};

export const TodayScreen = () => {
  const router = useRouter();
  const { demoMode } = useAuth();
  const { series, isSample } = useDailyWearables();
  const [biomarkers, setBiomarkers] = useDeepState<Biomarker[]>(mockBiomarkers);
  const [, setProfile] = useDeepState<UserProfile | null>(null);
  const [lastCheckIn, setLastCheckIn] = useDeepState<CheckInEntry | null>(null);
  const [checkInSeries, setCheckInSeries] = useDeepState<{ points: DailyCheckInPoint[]; sample: boolean }>({
    points: [],
    sample: true,
  });
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);
  const [strengthDone, setStrengthDone] = useState(0);
  const [mealsToday, setMealsToday] = useState(0);

  const load = useCallback(async () => {
    getLiveBiomarkers().then(setBiomarkers);
    const [p, checkIns, cycleEntries, strength, meals] = await Promise.all([
      profileRepository.get(),
      checkInRepository.getAll(),
      cycleRepository.getAll(),
      strengthSessionsThisWeek(),
      mealsLoggedToday(),
    ]);
    setProfile(p);
    setLastCheckIn(checkIns.length ? checkIns[0] : null);
    const real = dailyCheckInSeries(checkIns);
    setCheckInSeries(real.length >= 2 ? { points: real, sample: false } : { points: sampleCheckInSeries(), sample: true });
    setCycle(p.sex === 'female' ? currentCyclePhase(cycleEntries) : null);
    setStrengthDone(strength);
    setMealsToday(meals);
  }, [setBiomarkers, setProfile, setLastCheckIn, setCheckInSeries, setCycle]);

  useReloadOnFocus(load);

  const readiness = computeReadiness(series);
  const steps = latest(series.steps) ?? 0;
  const calories = latest(series.active_energy) ?? 0;
  const sleep = latest(series.sleep_duration) ?? 0;

  const sugar = biomarkers.find((b) => b.id === 'sugar');
  const bp = biomarkers.find((b) => b.id === 'blood_pressure');
  const rhr = latest(series.resting_heart_rate);
  const hrv = latest(series.hrv);
  const temp = latest(series.body_temperature);

  const lastMood = lastCheckIn?.mood ? MOOD_OPTIONS.find((m) => m.id === lastCheckIn.mood) : null;
  const lastMoment = lastCheckIn ? MOMENT_OPTIONS.find((m) => m.id === lastCheckIn.moment) : null;

  const planProgress = (kind: PlanItemKind, target: number) => {
    if (kind === 'strength') return { value: strengthDone / target, text: `${strengthDone}/${target} this week` };
    if (kind === 'steps') return { value: steps / target, text: `${steps.toLocaleString('en-GB')} today` };
    return { value: mealsToday / target, text: `${mealsToday}/${target} meals logged today` };
  };

  const onPlanPress = (kind: PlanItemKind) => {
    if (kind === 'strength') router.push('/log-workout');
    else if (kind === 'steps') router.push('/wearables');
    else router.push('/log-meal');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Today" />

        {demoMode === 'results' && (
          <TouchableOpacity
            style={styles.reportBanner}
            onPress={() => router.push('/report-intro')}
            activeOpacity={0.85}
          >
            <View style={styles.reportBannerIcon}>
              <Ionicons name="sparkles" size={22} color={Colors.accent} />
            </View>
            <View style={styles.reportBannerText}>
              <Text style={styles.reportBannerTitle}>Your report is here!</Text>
              <Text style={styles.reportBannerSubtitle}>Tap to see your results and plan</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Hi {firstName}!</Text>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>–</Text>
            <Text style={styles.bulletText}>
              Your next blood test will be delivered {formatDate(mockNextTestDate)}.{' '}
              <Text
                style={styles.link}
                onPress={() => router.push({ pathname: '/upcoming-analysis', params: { id: 'up-1' } })}
              >
                Tap to confirm or edit
              </Text>
            </Text>
          </View>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>–</Text>
            <Text style={styles.bulletText}>
              Your last results will be available in ~{mockResultsEtaDays} days
            </Text>
          </View>
        </View>

        {/* Check-in */}
        <TouchableOpacity style={styles.checkInCard} onPress={() => router.push('/check-in')} activeOpacity={0.85}>
          <CheckInOrb />
          <View style={{ flex: 1 }}>
            <Text style={styles.checkInTitle}>How are you feeling?</Text>
            <Text style={styles.checkInSubtitle}>
              {lastCheckIn
                ? `Last check-in ${timeAgo(lastCheckIn.fecha)}${lastMood ? ` · ${lastMood.emoji} ${lastMood.label}` : ''}`
                : 'Sleep, energy and mood in 30 seconds'}
            </Text>
          </View>
          <View style={styles.checkInButton}>
            <Text style={styles.checkInButtonText}>Check in</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your last 7 days</Text>
            {checkInSeries.sample && <Text style={styles.sampleTag}>sample</Text>}
          </View>
          <TrendChart
            height={96}
            labels={checkInSeries.points.map((p) => shortDate(p.date))}
            series={[
              { label: 'Energy', color: Colors.accent, values: checkInSeries.points.map((p) => p.energy) },
              { label: 'Mood', color: Colors.violet, values: checkInSeries.points.map((p) => p.mood) },
            ]}
            formatY={(v) => v.toFixed(0)}
          />
          {lastMoment && !checkInSeries.sample && (
            <Text style={styles.cardFootnote}>Last: {lastMoment.label.toLowerCase()}</Text>
          )}
        </View>

        {cycle && (
          <View style={styles.block}>
            <CycleStrip info={cycle} onPress={() => router.push('/cycle-detail')} />
          </View>
        )}

        {/* Daily readiness */}
        <Text style={styles.sectionTitle}>Daily readiness</Text>
        <View style={[styles.card, styles.readinessCard]}>
          {readiness ? (
            <>
              <ProgressRing
                size={156}
                strokeWidth={14}
                progress={readiness.score / 100}
                color={readiness.score >= 80 ? Colors.accent : readiness.score >= 60 ? Colors.amber : Colors.coral}
              >
                <Text style={styles.readinessScore}>{readiness.score}</Text>
                <Text style={styles.readinessLabel}>{readiness.label}</Text>
              </ProgressRing>
              <View style={styles.smallRings}>
                <SmallRing
                  icon={<Ionicons name="footsteps" size={16} color={Colors.sky} />}
                  color={Colors.sky}
                  progress={steps / 8000}
                  value={steps.toLocaleString('en-GB')}
                  label="Steps"
                />
                <SmallRing
                  icon={<Ionicons name="flame" size={16} color={Colors.coral} />}
                  color={Colors.coral}
                  progress={calories / 500}
                  value={`${calories}`}
                  label="Active kcal"
                />
                <SmallRing
                  icon={<Ionicons name="moon" size={15} color={Colors.violet} />}
                  color={Colors.violet}
                  progress={sleep / 480}
                  value={formatSleep(sleep)}
                  label="Sleep"
                />
              </View>
              <Text style={styles.sourceText}>
                From Huawei Health{isSample ? ' (sample data)' : ''} · <Text style={styles.link} onPress={() => router.push('/wearables')}>manage</Text>
              </Text>
            </>
          ) : (
            <Text style={styles.cardFootnote}>Connect a wearable to see your readiness.</Text>
          )}
        </View>

        {/* Biomarkers */}
        <Text style={styles.sectionTitle}>Biomarkers</Text>
        <View style={styles.grid}>
          {sugar && (
            <BiomarkerCard
              name="Sugar"
              value={sugar.valor}
              unit={sugar.unidad}
              status={sugar.statusLabel}
              color={statusColor(sugar.status)}
              onPress={() => router.push('/glucose-detail')}
            />
          )}
          {bp && (
            <BiomarkerCard
              name="Blood Pressure"
              value={bp.valor}
              unit={bp.unidad}
              status={bp.statusLabel}
              color={statusColor(bp.status)}
              onPress={() => router.push('/blood-pressure-detail')}
            />
          )}
          <BiomarkerCard
            name="Resting HR"
            value={rhr != null ? String(rhr) : '—'}
            unit="bpm"
            status={vsUsual(series.resting_heart_rate, false).label}
            color={vsUsual(series.resting_heart_rate, false).color}
            onPress={() => router.push('/wearables')}
          />
          <BiomarkerCard
            name="HRV"
            value={hrv != null ? String(hrv) : '—'}
            unit="ms"
            status={vsUsual(series.hrv, true).label}
            color={vsUsual(series.hrv, true).color}
            onPress={() => router.push('/wearables')}
          />
          <BiomarkerCard
            name="Temperature"
            value={temp != null ? temp.toFixed(1) : '—'}
            unit="°C"
            status={temp != null && temp >= 36.1 && temp <= 37.2 ? 'Normal' : 'Check'}
            color={temp != null && temp >= 36.1 && temp <= 37.2 ? Colors.accent : Colors.warning}
            onPress={() => router.push('/wearables')}
            wide
          />
        </View>

        {/* Your plan */}
        <Text style={styles.sectionTitle}>Your plan</Text>
        <View style={styles.planList}>
          {CURRENT_PLAN.map((item) => {
            const icon = PLAN_ICON[item.kind];
            const progress = planProgress(item.kind, item.target);
            return (
              <TouchableOpacity
                key={item.kind}
                style={styles.planRow}
                onPress={() => onPlanPress(item.kind)}
                activeOpacity={0.85}
              >
                <View style={[styles.planIcon, { backgroundColor: `${icon.color}22` }]}>
                  {icon.family === 'mci' ? (
                    <MaterialCommunityIcons name={icon.name as any} size={24} color={icon.color} />
                  ) : (
                    <Ionicons name={icon.name as any} size={22} color={icon.color} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{item.title}</Text>
                  <View style={styles.planBarTrack}>
                    <View
                      style={[
                        styles.planBarFill,
                        { width: `${Math.min(1, progress.value) * 100}%`, backgroundColor: icon.color },
                      ]}
                    />
                  </View>
                  <Text style={styles.planProgress}>{progress.text}</Text>
                </View>
                <Ionicons
                  name={item.kind === 'steps' ? 'chevron-forward' : 'add-circle'}
                  size={item.kind === 'steps' ? 18 : 26}
                  color={item.kind === 'steps' ? Colors.textMuted : icon.color}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.planNote}>Sample plan. It will come from your personalised recommendations.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const SmallRing = ({
  icon,
  color,
  progress,
  value,
  label,
}: {
  icon: React.ReactNode;
  color: string;
  progress: number;
  value: string;
  label: string;
}) => (
  <View style={styles.smallRing}>
    <ProgressRing size={64} strokeWidth={7} progress={progress} color={color}>
      {icon}
    </ProgressRing>
    <Text style={styles.smallRingValue}>{value}</Text>
    <Text style={styles.smallRingLabel}>{label}</Text>
  </View>
);

const BiomarkerCard = ({
  name,
  value,
  unit,
  status,
  color,
  onPress,
  wide,
}: {
  name: string;
  value: string;
  unit: string;
  status: string;
  color: string;
  onPress: () => void;
  wide?: boolean;
}) => (
  <TouchableOpacity style={[styles.biomarkerCard, wide && styles.biomarkerCardWide]} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.biomarkerName}>{name}</Text>
    <View style={styles.biomarkerValueRow}>
      <Text style={[styles.biomarkerValue, value.length > 5 && !wide && styles.biomarkerValueLong]}>{value}</Text>
      <Text style={styles.biomarkerUnit}> {unit.split(' ')[0]}</Text>
    </View>
    <Text style={[styles.biomarkerStatus, { color }]}>{status}</Text>
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
  reportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  reportBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportBannerText: {
    flex: 1,
  },
  reportBannerTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  reportBannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  greeting: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    color: Colors.textSecondary,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  link: {
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(155, 140, 255, 0.35)',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  checkInTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  checkInSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  checkInButton: {
    backgroundColor: Colors.violet,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  checkInButtonText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '800',
  },
  block: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardFootnote: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  sampleTag: {
    color: Colors.textMuted,
    fontSize: 11,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 14,
    marginTop: 16,
  },
  readinessCard: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  readinessScore: {
    color: Colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
  },
  readinessLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 110,
  },
  smallRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    marginTop: 22,
  },
  smallRing: {
    alignItems: 'center',
  },
  smallRingValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  smallRingLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  sourceText: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 8,
  },
  biomarkerCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  biomarkerCardWide: {
    width: '100%',
  },
  biomarkerName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  biomarkerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  biomarkerValue: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  biomarkerValueLong: {
    fontSize: 21,
  },
  biomarkerUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  biomarkerStatus: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  planList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  planIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  planBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
    marginBottom: 6,
  },
  planBarFill: {
    height: 6,
    borderRadius: 3,
  },
  planProgress: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  planNote: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
});
