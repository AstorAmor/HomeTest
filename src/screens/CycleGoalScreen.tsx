import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { WheelPicker } from '@/components/WheelPicker';
import { CYCLE_GOAL_PROMPTED, cycleGoalStore } from '@/data/cycleGoal';
import { cycleRepository } from '@/data/cycleRepository';
import { profileRepository } from '@/data/profileRepository';
import { userFlags } from '@/data/userFlags';
import {
  CONDITION_OPTIONS,
  CONTRACEPTION_OPTIONS,
  Contraception,
  CYCLE_GOAL_OPTIONS,
  CycleGoal,
  CycleGoalAnswers,
  Flow,
  hormonalFrom,
  PeriodPain,
  primaryGoal,
  SYMPTOM_OPTIONS,
} from '@/types/cycleGoal';
import { fertilityAdvice, SexFrequency, Timing, TryingFor } from '@/logic/fertility';
import { t as tr } from '@/i18n';
import { offerPhoneReminders } from '@/data/phoneReminders';

type Step = 'goal' | 'last' | 'lengths' | 'flow' | 'pain' | 'contraception' | 'conditions' | 'trying' | 'temperature' | 'result';

const ageFrom = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};

const DAY_MS = 24 * 3600 * 1000;
const fromKey = (key: string) => new Date(`${key}T12:00:00`);
const CYCLE_DAYS = Array.from({ length: 46 }, (_, i) => i + 15); // 15 a 60
const PERIOD_DAYS = Array.from({ length: 12 }, (_, i) => i + 1); // 1 a 12

// Multiselección con «Ninguno/a» que excluye lo demás
const toggleIn = (list: string[], id: string) => {
  if (id === 'none') return list.includes('none') ? [] : ['none'];
  const without = list.filter((x) => x !== 'none');
  return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
};

// Encuesta de la primera vez que se abre el ciclo (como Flo): qué busca (varias cosas a la vez), cuándo
// fue su última regla, cuánto duran sus ciclos y su regla, si son regulares, cómo es el sangrado y el
// dolor, síntomas, anticonceptivo, lo diagnosticado y, si busca embarazo, desde cuándo y cómo (con
// cuidado de no pasarse). Empieza siempre vacía. Al final, si toca según las guías, recomienda hablar
// con un médico. La fecha de la última regla se apunta como su primer ciclo, y la duración del ciclo
// se usa para predecir mientras no haya dos reglas apuntadas.
export const CycleGoalScreen = () => {
  const router = useRouter();
  const [step, setStep] = useState<Step>('goal');
  const [goals, setGoals] = useState<CycleGoal[]>([]);
  const [lastStart, setLastStart] = useState<string | null | undefined>(); // null = no lo recuerda
  const [month, setMonth] = useState(new Date());
  const [cycleIdx, setCycleIdx] = useState(CYCLE_DAYS.indexOf(28));
  const [cycleUnknown, setCycleUnknown] = useState(false);
  const [periodIdx, setPeriodIdx] = useState(PERIOD_DAYS.indexOf(5));
  const [periodUnknown, setPeriodUnknown] = useState(false);
  const [regular, setRegular] = useState<CycleGoalAnswers['regularCycles'] | undefined>();
  const [flow, setFlow] = useState<Flow | undefined>();
  const [pain, setPain] = useState<PeriodPain | undefined>();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [contraception, setContraception] = useState<Contraception | undefined>();
  const [conditions, setConditions] = useState<string[]>([]);
  const [tryingFor, setTryingFor] = useState<TryingFor | undefined>();
  const [frequency, setFrequency] = useState<SexFrequency | 'skip' | undefined>();
  const [timing, setTiming] = useState<Timing | 'skip' | undefined>();
  const [logTemp, setLogTemp] = useState<'yes' | 'no' | undefined>();
  const [age, setAge] = useState<number | null>(null);
  const [profileConditions, setProfileConditions] = useState<string[]>([]);

  useEffect(() => {
    userFlags.set(CYCLE_GOAL_PROMPTED);
    profileRepository.get().then((p) => {
      setAge(ageFrom(p.dateOfBirth));
      setProfileConditions(p.conditions.filter((c) => c === 'pcos'));
    });
  }, []);

  const conceive = goals.includes('conceive');
  const steps: Step[] = ['goal', 'last', 'lengths', 'flow', 'pain', 'contraception', 'conditions', ...(conceive ? (['trying'] as Step[]) : []), 'temperature', 'result'];
  const index = steps.indexOf(step);
  const canContinue =
    (step === 'goal' && goals.length > 0) ||
    (step === 'last' && lastStart !== undefined) ||
    step === 'lengths' ||
    (step === 'flow' && !!regular && !!flow) ||
    (step === 'pain' && !!pain) ||
    (step === 'contraception' && !!contraception) ||
    step === 'conditions' ||
    (step === 'trying' && !!tryingFor) ||
    (step === 'temperature' && !!logTemp) ||
    step === 'result';

  const cycleLength = cycleUnknown ? null : CYCLE_DAYS[cycleIdx];
  const periodLength = periodUnknown ? null : PERIOD_DAYS[periodIdx];
  const diagnosed = conditions.filter((c) => c !== 'none');

  const answers = (): CycleGoalAnswers => ({
    goal: primaryGoal(goals),
    goals,
    lastPeriodStart: lastStart ?? null,
    cycleLength,
    periodLength,
    regularCycles: regular ?? 'unsure',
    flow,
    pain,
    symptoms: symptoms.filter((s) => s !== 'none'),
    contraception,
    hormonalContraception: hormonalFrom(contraception),
    conditions: diagnosed,
    tryingFor: conceive ? tryingFor : undefined,
    frequency: conceive && frequency !== 'skip' ? frequency : undefined,
    timing: conceive && timing !== 'skip' ? timing : undefined,
    logTemperature: logTemp === 'yes',
    answeredAt: new Date().toISOString(),
  });

  // La última regla, como primer ciclo apuntado (si no hay ya uno esos días)
  const saveLastPeriod = async () => {
    if (!lastStart) return;
    const start = fromKey(lastStart);
    const all = await cycleRepository.getAll().catch(() => []);
    if (all.some((e) => Math.abs(new Date(e.fecha).getTime() - start.getTime()) < 4 * DAY_MS)) return;
    const end = periodLength ? new Date(start.getTime() + (periodLength - 1) * DAY_MS) : null;
    await cycleRepository.save({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      fecha: start.toISOString(),
      ...(end && end.getTime() <= Date.now() ? { endFecha: end.toISOString() } : {}),
    });
  };

  const next = async () => {
    if (step === 'result') {
      await cycleGoalStore.set(answers());
      await saveLastPeriod().catch(() => undefined);
      if (conceive && logTemp === 'yes') void offerPhoneReminders('temperature');
      router.back();
      return;
    }
    setStep(steps[index + 1]);
  };

  const advice =
    conceive && tryingFor
      ? fertilityAdvice({
          age,
          tryingFor,
          regularCycles: regular ?? 'unsure',
          frequency: frequency === 'skip' ? undefined : frequency,
          timing: timing === 'skip' ? undefined : timing,
          knownConditions: [...new Set([...profileConditions, ...diagnosed])],
        })
      : null;
  // Sangrado muy abundante o dolor que impide hacer cosas: merece una consulta (sin diagnosticar nada)
  const worthAsking = flow === 'very_heavy' || pain === 'severe';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => (index > 0 ? setStep(steps[index - 1]) : router.back())}>
          <Ionicons name={index > 0 ? 'chevron-back' : 'close'} size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
        </View>
        {step !== 'result' ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.skip}>{tr('Skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'goal' && (
          <>
            <Ionicons name="rose-outline" size={34} color={Colors.pulseAccent} style={styles.icon} />
            <Text style={styles.title}>{tr('What would you like to do?')}</Text>
            <Text style={styles.subtitle}>{tr('Choose all that apply. We will adapt your cycle predictions and tips. You can change it any time.')}</Text>
            {CYCLE_GOAL_OPTIONS.map((o) => {
              const selected = goals.includes(o.id);
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setGoals((g) => (g.includes(o.id) ? g.filter((x) => x !== o.id) : [...g, o.id]))}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons name={o.icon as any} size={22} color={selected ? Colors.pulseAccent : Colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{tr(o.title)}</Text>
                    <Text style={styles.optionSubtitle}>{tr(o.subtitle)}</Text>
                  </View>
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color={selected ? Colors.pulseAccent : Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 'last' && (
          <>
            <Text style={styles.title}>{tr('When did your last period start?')}</Text>
            <Text style={styles.subtitle}>{tr('The first day of bleeding. With it we can tell you when the next one is coming.')}</Text>
            <View style={styles.calendarCard}>
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                selectedDay={lastStart ?? null}
                onDayPress={(d) => setLastStart(d)}
                maxDate={toDayKey(new Date())}
              />
            </View>
            <ChoiceChips
              options={[{ id: 'unknown' as const, label: tr("I don't remember") }]}
              value={lastStart === null ? 'unknown' : undefined}
              onChange={() => setLastStart(null)}
            />
          </>
        )}

        {step === 'lengths' && (
          <>
            <Text style={styles.title}>{tr('How long do your cycles usually last?')}</Text>
            <Text style={styles.hint}>{tr('From the first day of one period to the day before the next one. Most last 21 to 35 days.')}</Text>
            <View style={[styles.wheels, cycleUnknown && styles.dim]}>
              <WheelPicker items={CYCLE_DAYS.map(String)} selectedIndex={cycleIdx} onChange={(i) => {
                  setCycleIdx(i);
                  setCycleUnknown(false);
                }} width={90} />
              <Text style={styles.unit}>{tr('days')}</Text>
            </View>
            <ChoiceChips
              options={[{ id: 'unknown' as const, label: tr("I don't know") }]}
              value={cycleUnknown ? 'unknown' : undefined}
              onChange={() => setCycleUnknown((v) => !v)}
            />
            <Text style={styles.label}>{tr('And how many days does your period usually last?')}</Text>
            <View style={[styles.wheels, periodUnknown && styles.dim]}>
              <WheelPicker items={PERIOD_DAYS.map(String)} selectedIndex={periodIdx} onChange={(i) => {
                  setPeriodIdx(i);
                  setPeriodUnknown(false);
                }} width={90} />
              <Text style={styles.unit}>{tr('days')}</Text>
            </View>
            <ChoiceChips
              options={[{ id: 'unknown' as const, label: tr("I don't know") }]}
              value={periodUnknown ? 'unknown' : undefined}
              onChange={() => setPeriodUnknown((v) => !v)}
            />
          </>
        )}

        {step === 'flow' && (
          <>
            <Text style={styles.title}>{tr('About your cycle')}</Text>
            <Text style={styles.label}>{tr('Are your periods usually regular?')}</Text>
            <Text style={styles.hint}>{tr('Regular means they come every 21 to 35 days and roughly on time.')}</Text>
            <ChoiceChips
              options={[
                { id: 'yes', label: tr('Yes') },
                { id: 'no', label: tr('No') },
                { id: 'unsure', label: tr('Not sure') },
              ]}
              value={regular}
              onChange={(v) => setRegular(v as CycleGoalAnswers['regularCycles'])}
            />
            <Text style={styles.label}>{tr('How heavy is your bleeding?')}</Text>
            <ChoiceChips
              options={[
                { id: 'light', label: tr('Light') },
                { id: 'medium', label: tr('Medium') },
                { id: 'heavy', label: tr('Heavy') },
                { id: 'very_heavy', label: tr('Very heavy (I change every 1-2 hours)') },
                { id: 'unsure', label: tr('Not sure') },
              ]}
              value={flow}
              onChange={(v) => setFlow(v as Flow)}
            />
          </>
        )}

        {step === 'pain' && (
          <>
            <Text style={styles.title}>{tr('How do you feel during your period?')}</Text>
            <Text style={styles.label}>{tr('Period pain')}</Text>
            <ChoiceChips
              options={[
                { id: 'none', label: tr('No pain') },
                { id: 'mild', label: tr('Mild') },
                { id: 'moderate', label: tr('Moderate: I take painkillers') },
                { id: 'severe', label: tr('Severe: it stops me doing things') },
              ]}
              value={pain}
              onChange={(v) => setPain(v as PeriodPain)}
            />
            <Text style={styles.label}>{tr('Do you notice any of these before or during your period?')}</Text>
            <Text style={styles.hint}>{tr('Choose all that apply.')}</Text>
            <View style={styles.multi}>
              {SYMPTOM_OPTIONS.map((s) => {
                const on = symptoms.includes(s.id);
                return (
                  <TouchableOpacity key={s.id} style={[styles.pill, on && styles.pillOn]} onPress={() => setSymptoms((l) => toggleIn(l, s.id))}>
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{tr(s.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'contraception' && (
          <>
            <Text style={styles.title}>{tr('Are you using any contraception?')}</Text>
            <Text style={styles.subtitle}>{tr('Hormonal methods change how your cycle and predictions behave.')}</Text>
            <View style={styles.multi}>
              {CONTRACEPTION_OPTIONS.map((c) => {
                const on = contraception === c.id;
                return (
                  <TouchableOpacity key={c.id} style={[styles.pill, on && styles.pillOn]} onPress={() => setContraception(c.id)}>
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{tr(c.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'conditions' && (
          <>
            <Text style={styles.title}>{tr('Has a doctor told you that you have any of these?')}</Text>
            <Text style={styles.subtitle}>{tr('Only if it has been diagnosed. It helps us read your cycle better. Optional.')}</Text>
            <View style={styles.multi}>
              {CONDITION_OPTIONS.map((c) => {
                const on = conditions.includes(c.id);
                return (
                  <TouchableOpacity key={c.id} style={[styles.pill, on && styles.pillOn]} onPress={() => setConditions((l) => toggleIn(l, c.id))}>
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{tr(c.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'trying' && (
          <>
            <Text style={styles.title}>{tr('Trying to conceive')}</Text>
            <Text style={styles.subtitle}>{tr('These help us tell you when it is worth seeing a doctor. Only the first one is needed.')}</Text>
            <Text style={styles.label}>{tr('How long have you been trying?')}</Text>
            <ChoiceChips
              options={[
                { id: 'under_6m', label: tr('Less than 6 months') },
                { id: '6_12m', label: tr('6 to 12 months') },
                { id: '1_2y', label: tr('1 to 2 years') },
                { id: 'over_2y', label: tr('More than 2 years') },
              ]}
              value={tryingFor}
              onChange={(v) => setTryingFor(v as TryingFor)}
            />
            <Text style={styles.label}>{tr('How often do you have sex? (optional)')}</Text>
            <ChoiceChips
              options={[
                { id: 'several_week', label: tr('Several times a week') },
                { id: 'weekly', label: tr('About once a week') },
                { id: 'less', label: tr('Less often') },
                { id: 'skip', label: tr('Prefer not to say') },
              ]}
              value={frequency}
              onChange={(v) => setFrequency(v as SexFrequency | 'skip')}
            />
            <Text style={styles.label}>{tr('Do you plan it around your fertile days? (optional)')}</Text>
            <ChoiceChips
              options={[
                { id: 'yes', label: tr('Yes') },
                { id: 'sometimes', label: tr('Sometimes') },
                { id: 'no', label: tr('No') },
                { id: 'skip', label: tr('Prefer not to say') },
              ]}
              value={timing}
              onChange={(v) => setTiming(v as Timing | 'skip')}
            />
          </>
        )}

        {step === 'temperature' && (
          <>
            <Ionicons name="thermometer-outline" size={34} color={Colors.gold} style={styles.icon} />
            <Text style={styles.title}>{tr('Add your morning temperature?')}</Text>
            <Text style={styles.subtitle}>
              {conceive
                ? tr('Your temperature rises slightly (about 0.2–0.5 °C) after you ovulate. Taking it every morning, before you get up, lets us confirm when it happened and learn your fertile window.')
                : tr('Your temperature rises slightly (about 0.2–0.5 °C) after you ovulate. Taking it every morning, before you get up, lets us confirm when it happened.')}
            </Text>
            <View style={styles.infoCard}>
              <Ionicons name="watch-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoText}>
                {tr('If your wearable measures temperature at night, we use it too. It is less precise than a thermometer, so the two together work best.')}
              </Text>
            </View>
            <ChoiceChips
              options={[
                { id: 'yes', label: tr("Yes, I'll log it") },
                { id: 'no', label: tr('Not now') },
              ]}
              value={logTemp}
              onChange={(v) => setLogTemp(v as 'yes' | 'no')}
            />
          </>
        )}

        {step === 'result' && (
          <>
            <Ionicons name="checkmark-circle" size={40} color={Colors.ok} style={styles.icon} />
            <Text style={styles.title}>{tr('All set')}</Text>
            {advice && (
              <View style={[styles.adviceCard, advice.level !== 'keep_trying' && { borderColor: withAlpha(Colors.gold, 0.5) }]}>
                <Text style={styles.adviceTitle}>{advice.title}</Text>
                <Text style={styles.adviceBody}>{advice.body}</Text>
                {advice.tips.map((t) => (
                  <View key={t} style={styles.tipRow}>
                    <Ionicons name="ellipse" size={6} color={Colors.textMuted} style={{ marginTop: 7 }} />
                    <Text style={styles.tipText}>{t}</Text>
                  </View>
                ))}
                {advice.level !== 'keep_trying' && (
                  <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
                    <Text style={styles.secondaryCtaText}>{tr('Find a gynaecologist or fertility specialist')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {goals
              .filter((g) => g !== 'conceive')
              .map((g) => (
                <Text key={g} style={styles.subtitle}>
                  {g === 'symptoms'
                    ? tr('Log how you feel through the month and we will show you patterns by cycle phase.')
                    : g === 'perimenopause'
                      ? tr('We will keep an eye on changes in your cycle length and symptoms over time.')
                      : tr('We will predict your next period and your fertile days from what you log.')}
                </Text>
              ))}
            {worthAsking && (
              <View style={styles.infoCard}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.textSecondary} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.infoText}>
                    {tr('Very heavy bleeding or pain that stops you doing things is worth mentioning to your gynaecologist. It is common and there is a lot that can help.')}
                  </Text>
                  <Text style={styles.link} onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
                    {tr('Talk to a doctor')}
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.disclaimer}>
              {tr('Kuova is not a contraceptive method and does not diagnose fertility problems. Guidance based on ASRM and NICE fertility guidelines.')}
            </Text>
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.cta, !canContinue && styles.ctaDisabled]} onPress={next} disabled={!canContinue}>
        <Text style={styles.ctaText}>{step === 'result' ? tr('Done') : tr('Continue')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.pulseAccent },
  skip: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 },
  icon: { alignSelf: 'center', marginBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  optionSelected: { borderColor: Colors.pulseAccent, backgroundColor: Colors.pinkSoftBg },
  optionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  optionSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  calendarCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 12, marginBottom: 12 },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 6 },
  dim: { opacity: 0.35 },
  unit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  multi: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  pillOn: { borderColor: Colors.pulseAccent, backgroundColor: Colors.pinkSoftBg },
  pillText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  pillTextOn: { color: Colors.textPrimary },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  adviceCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 14,
  },
  adviceTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  adviceBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  tipRow: { flexDirection: 'row', gap: 8 },
  tipText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  secondaryCta: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 24,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryCtaText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  disclaimer: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 18 },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
