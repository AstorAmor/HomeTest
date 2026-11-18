import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { TrendChart } from '@/components/TrendChart';
import { InfoButton } from '@/components/InfoButton';
import { FRow, SecHead } from '@/components/fine/Fine';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { CYCLE_GOAL_PROMPTED, cycleGoalStore } from '@/data/cycleGoal';
import { cycleRepository } from '@/data/cycleRepository';
import { profileRepository } from '@/data/profileRepository';
import { userFlags } from '@/data/userFlags';
import { basalTemperatureRepository, temperatureReadings } from '@/data/temperatureRepository';
import { wearableRepository } from '@/wearables/wearableRepository';
import { CYCLE_GOAL_OPTIONS, CycleGoalAnswers } from '@/types/cycleGoal';
import { dailyTemps, detectTempShift, FertilityAdvice, fertilityAdvice, TempReading, TempShift } from '@/logic/fertility';
import { num, t as tr } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

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

// Parte del detalle del ciclo: el objetivo de la encuesta (la primera vez se abre sola), el consejo de fertilidad si
// busca embarazo, y la temperatura basal con la del wearable. En el lenguaje fino desde el 2026-11-17 (cabeceras
// pequeñas con línea, filas finas, sin tarjetas ni iconos); va dentro del margen de la pantalla.
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
  const wearableByDay = new Map(temps.filter((x) => x.source === 'wearable').map((x) => [x.date, x.celsius]));
  const wearableAligned = chartDays.map((d) => wearableByDay.get(d.date));
  const series = [
    {
      label: manualDays.length >= 3 ? tr('Thermometer') : tr('Wearable'),
      color: FINE.gold,
      values: chartDays.map((d) => d.celsius),
    },
    ...(manualDays.length >= 3 && wearableAligned.every((v) => v != null)
      ? [{ label: tr('Wearable (night)'), color: Colors.green, values: wearableAligned as number[] }]
      : []),
  ];

  return (
    <View>
      <SecHead title={tr('Your goal')} more={goal ? tr('Change') : tr('Start')} onMore={() => router.push('/cycle-goal')} />
      <FRow title={option ? tr(option.title) : tr('Tell us what you are looking for')} onPress={() => router.push('/cycle-goal')} last />

      {advice && (
        <View style={styles.advice}>
          <View style={styles.adviceHead}>
            <Text style={[fine.rowTitle, styles.flex]}>{advice.title}</Text>
            <InfoButton topic="fertility" size={15} color={FINE.mute} />
          </View>
          <Text style={styles.text}>{advice.body}</Text>
          {advice.level !== 'keep_trying' && (
            <TouchableOpacity onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })} hitSlop={8}>
              <Text style={styles.link}>{tr('Find a gynaecologist or fertility specialist')} ›</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showTemperature ? (
        <>
          <View style={fine.secHead}>
            <Text style={fine.secTitle}>{tr('Morning temperature')}</Text>
            <InfoButton topic="temperature" size={15} color={FINE.mute} />
            <TouchableOpacity onPress={() => router.push('/log-temperature')} hitSlop={10} style={styles.more} accessibilityRole="link">
              <Text style={fine.secMore}>{tr('Log today')} ›</Text>
            </TouchableOpacity>
          </View>
          {chartDays.length >= 3 ? (
            <TrendChart
              height={90}
              labels={chartDays.map((d) => shortDay(d.date))}
              series={series}
              formatY={(v) => num(v.toFixed(1))}
              formatValue={(v) => `${num(v.toFixed(2))} °C`}
              interactive
            />
          ) : (
            <Text style={styles.text}>{tr('Log a few mornings to see your curve.')}</Text>
          )}
          <Text style={[fine.note, styles.tempNote]}>
            {shift
              ? tr(
                  shift.confidence === 'low'
                    ? 'Your temperature rose on {date}: you most likely ovulated around {ovulation} (from your wearable, less precise).'
                    : 'Your temperature rose on {date}: you most likely ovulated around {ovulation}.',
                  { date: shortDay(shift.shiftDate), ovulation: shortDay(shift.likelyOvulation) },
                )
              : tr('After ovulation your temperature rises about 0.2–0.5 °C and stays up until your period. We will mark it when we see it.')}
          </Text>
        </>
      ) : (
        <>
          <SecHead title={tr('Morning temperature')} />
          <FRow
            title={tr('Add your morning temperature')}
            sub={tr('It confirms when you ovulate and makes predictions more accurate. If your wearable measures temperature at night, we use it too.')}
            onPress={() => router.push('/cycle-goal')}
            last
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  advice: { paddingVertical: 12, gap: 6, borderTopWidth: 1, borderTopColor: FINE.line, marginTop: 4 },
  adviceHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 20, opacity: 0.86 },
  link: { ...fine.link, marginTop: 4 },
  more: { marginLeft: 'auto' },
  tempNote: { marginTop: 8 },
});
