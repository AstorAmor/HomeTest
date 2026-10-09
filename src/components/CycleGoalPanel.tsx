import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { TrendChart } from '@/components/TrendChart';
import { InfoButton } from '@/components/InfoButton';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { CYCLE_GOAL_PROMPTED, cycleGoalStore } from '@/data/cycleGoal';
import { cycleRepository } from '@/data/cycleRepository';
import { profileRepository } from '@/data/profileRepository';
import { userFlags } from '@/data/userFlags';
import { basalTemperatureRepository, temperatureReadings } from '@/data/temperatureRepository';
import { wearableRepository } from '@/wearables/wearableRepository';
import { CYCLE_GOAL_OPTIONS, CycleGoalAnswers } from '@/types/cycleGoal';
import { dailyTemps, detectTempShift, FertilityAdvice, fertilityAdvice, TempReading, TempShift } from '@/logic/fertility';

const ageFrom = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};

const shortDay = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// Parte de arriba del detalle del ciclo: el objetivo de la encuesta (la primera vez se abre
// sola), el consejo de fertilidad si busca embarazo, y la temperatura basal con la del wearable.
export const CycleGoalPanel = () => {
  const router = useRouter();
  const [goal, setGoal] = useDeepState<CycleGoalAnswers | null>(null);
  const [advice, setAdvice] = useDeepState<FertilityAdvice | null>(null);
  const [temps, setTemps] = useDeepState<TempReading[]>([]);
  const [shift, setShift] = useDeepState<TempShift | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [g, prompted, profile, manual, wearable, cycles] = await Promise.all([
      cycleGoalStore.get(),
      userFlags.get(CYCLE_GOAL_PROMPTED),
      profileRepository.get(),
      basalTemperatureRepository.getAll(),
      wearableRepository.getRecords(),
      cycleRepository.getAll(),
    ]);
    setLoaded(true);
    if (!g && !prompted) {
      router.push('/cycle-goal');
      return;
    }
    setGoal(g);
    setAdvice(
      g?.goal === 'conceive' && g.tryingFor
        ? fertilityAdvice({
            age: ageFrom(profile.dateOfBirth),
            tryingFor: g.tryingFor,
            regularCycles: g.regularCycles,
            frequency: g.frequency,
            timing: g.timing,
            knownConditions: profile.conditions.filter((c) => c === 'pcos'),
          })
        : null
    );
    const readings = temperatureReadings(manual, wearable);
    setTemps(readings);
    const lastStart = cycles.reduce<string | null>((a, c) => (!a || c.fecha > a ? c.fecha : a), null);
    setShift(detectTempShift(readings, lastStart?.slice(0, 10)));
  }, [router, setGoal, setAdvice, setTemps, setShift]);
  useReloadOnFocus(load);

  if (!loaded) return null;

  const option = CYCLE_GOAL_OPTIONS.find((o) => o.id === goal?.goal);
  const showTemperature = goal?.logTemperature || goal?.goal === 'conceive' || temps.length > 0;

  // Gráfica de los últimos 30 días con lectura: termómetro y, si cubre esos mismos días, wearable
  const days = dailyTemps(temps).slice(-30);
  const manualDays = days.filter((d) => d.source === 'manual');
  const chartDays = manualDays.length >= 3 ? manualDays : days;
  const wearableByDay = new Map(temps.filter((t) => t.source === 'wearable').map((t) => [t.date, t.celsius]));
  const wearableAligned = chartDays.map((d) => wearableByDay.get(d.date));
  const series = [
    {
      label: manualDays.length >= 3 ? 'Thermometer' : 'Wearable',
      color: Colors.gold,
      values: chartDays.map((d) => d.celsius),
    },
    ...(manualDays.length >= 3 && wearableAligned.every((v) => v != null)
      ? [{ label: 'Wearable (night)', color: Colors.green, values: wearableAligned as number[] }]
      : []),
  ];

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.goalRow} onPress={() => router.push('/cycle-goal')} activeOpacity={0.85}>
        <Ionicons name={(option?.icon ?? 'rose-outline') as any} size={20} color={Colors.pulseAccent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.goalLabel}>Your goal</Text>
          <Text style={styles.goalTitle}>{option?.title ?? 'Tell us what you are looking for'}</Text>
        </View>
        <Text style={styles.link}>{goal ? 'Change' : 'Start'}</Text>
      </TouchableOpacity>

      {advice && (
        <View style={[styles.card, advice.level !== 'keep_trying' && { borderColor: withAlpha(Colors.attention, 0.6) }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>{advice.title}</Text>
            <InfoButton topic="fertility" />
          </View>
          <Text style={styles.cardText}>{advice.body}</Text>
          {advice.level !== 'keep_trying' && (
            <TouchableOpacity onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
              <Text style={styles.link}>Find a gynaecologist or fertility specialist</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showTemperature ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="thermometer-outline" size={18} color={Colors.gold} />
            <Text style={[styles.cardTitle, { flex: 1 }]}>Morning temperature</Text>
            <InfoButton topic="temperature" />
            <TouchableOpacity style={styles.logButton} onPress={() => router.push('/log-temperature')}>
              <Text style={styles.logButtonText}>Log today</Text>
            </TouchableOpacity>
          </View>
          {chartDays.length >= 3 ? (
            <TrendChart
              height={90}
              labels={chartDays.map((d) => shortDay(d.date))}
              series={series}
              formatY={(v) => v.toFixed(1)}
              formatValue={(v) => `${v.toFixed(2)} °C`}
              interactive
            />
          ) : (
            <Text style={styles.cardText}>Log a few mornings to see your curve.</Text>
          )}
          <Text style={styles.cardText}>
            {shift
              ? `Your temperature rose on ${shortDay(shift.shiftDate)}: you most likely ovulated around ${shortDay(shift.likelyOvulation)}${shift.confidence === 'low' ? ' (from your wearable, less precise)' : ''}.`
              : 'After ovulation your temperature rises about 0.2–0.5 °C and stays up until your period. We will mark it when we see it.'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.card} onPress={() => router.push('/cycle-goal')} activeOpacity={0.85}>
          <Text style={styles.cardTitle}>Add your morning temperature</Text>
          <Text style={styles.cardText}>
            It confirms when you ovulate and makes predictions more accurate. If your wearable measures temperature at
            night, we use it too.
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.pinkSoftBg,
    borderRadius: 16,
    padding: 14,
  },
  goalLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  goalTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  logButton: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  logButtonText: { color: Colors.background, fontSize: 12, fontWeight: '800' },
});
