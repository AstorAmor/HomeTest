import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChoiceChips } from '@/components/ChoiceChips';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { StepsBar } from '@/components/fine/FineSteps';
import { FButton, FChip, FLink, FOption, formStyles } from '@/components/fine/FineForm';
import { FineNumber } from '@/components/fine/FineNumber';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
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
import { FINE, ff, fine } from '@/theme/fine';

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
// Los mismos límites que tenían las ruedas: el ciclo, de 15 a 60 días; la regla, de 1 a 12
const CYCLE = { min: 15, max: 60, start: 28 };
const PERIOD = { min: 1, max: 12, start: 5 };

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
// Rediseño del 2026-11-17 (lenguaje fino, src/theme/fine.ts). El fundador: «no está coherente la barra de progreso y
// la fuente e iconos con el resto de la app… ¿Cuánto suelen durar tus ciclos, la regla?, ponlo con +-, la rueda es
// demasiado. Y que no sea taaan grande». El avance es una línea cometa fina (StepsBar), las opciones van en filas con
// una línea fina y su marca redonda o en chips con borde, sin iconos; las dos duraciones, con el «− cifra +» de las
// mediciones (FineNumber) en su tamaño pequeño, y el botón de seguir, en esmeralda. Las preguntas, lo que se guarda y
// el orden de los pasos no cambian.
export const CycleGoalScreen = () => {
  const router = useRouter();
  const [step, setStep] = useState<Step>('goal');
  const [goals, setGoals] = useState<CycleGoal[]>([]);
  const [lastStart, setLastStart] = useState<string | null | undefined>(); // null = no lo recuerda
  const [month, setMonth] = useState(new Date());
  const [cycleDays, setCycleDays] = useState(CYCLE.start);
  const [cycleUnknown, setCycleUnknown] = useState(false);
  const [periodDays, setPeriodDays] = useState(PERIOD.start);
  const [periodUnknown, setPeriodUnknown] = useState(false);
  // Una cifra a medio escribir con el teclado que aún no vale (p. ej. «9» días de ciclo) apaga «Continuar»
  const [cycleOk, setCycleOk] = useState(true);
  const [periodOk, setPeriodOk] = useState(true);
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
    (step === 'lengths' && (cycleUnknown || cycleOk) && (periodUnknown || periodOk)) ||
    (step === 'flow' && !!regular && !!flow) ||
    (step === 'pain' && !!pain) ||
    (step === 'contraception' && !!contraception) ||
    step === 'conditions' ||
    (step === 'trying' && !!tryingFor) ||
    (step === 'temperature' && !!logTemp) ||
    step === 'result';

  const cycleLength = cycleUnknown ? null : cycleDays;
  const periodLength = periodUnknown ? null : periodDays;
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
  const toDoctor = () => router.push({ pathname: '/professionals', params: { role: 'doctor' } });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StepsBar
        index={index}
        total={steps.length}
        onBack={() => (index > 0 ? setStep(steps[index - 1]) : router.back())}
        right={
          step !== 'result' ? (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.skipBox} accessibilityRole="button">
              <Text style={styles.skip}>{tr('Skip')}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Las duraciones se pueden escribir con el teclado: la lista y el botón de seguir suben con él, como al apuntar el peso */}
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'goal' && (
          <>
            <Text style={styles.title}>{tr('What would you like to do?')}</Text>
            <Text style={styles.lead}>{tr('Choose all that apply. We will adapt your cycle predictions and tips. You can change it any time.')}</Text>
            <View>
              {CYCLE_GOAL_OPTIONS.map((o, i) => (
                <FOption
                  key={o.id}
                  multi
                  title={tr(o.title)}
                  hint={tr(o.subtitle)}
                  on={goals.includes(o.id)}
                  onPress={() => setGoals((g) => (g.includes(o.id) ? g.filter((x) => x !== o.id) : [...g, o.id]))}
                  last={i === CYCLE_GOAL_OPTIONS.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {step === 'last' && (
          <>
            <Text style={styles.title}>{tr('When did your last period start?')}</Text>
            <Text style={styles.lead}>{tr('The first day of bleeding. With it we can tell you when the next one is coming.')}</Text>
            <View style={styles.calendar}>
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
            <Text style={styles.lead}>{tr('From the first day of one period to the day before the next one. Most last 21 to 35 days.')}</Text>
            {/* «− cifra +» en lugar de la rueda; al tocarlo deja de estar en «No lo sé», como pasaba con la rueda */}
            <FineNumber
              compact
              value={cycleDays}
              min={CYCLE.min}
              max={CYCLE.max}
              fastStep={5}
              unit={tr('days')}
              label={tr('Cycle length')}
              onChange={(v) => {
                setCycleDays(v);
                setCycleUnknown(false);
              }}
              onValidChange={setCycleOk}
              style={[styles.number, cycleUnknown && styles.dim]}
            />
            <ChoiceChips
              options={[{ id: 'unknown' as const, label: tr("I don't know") }]}
              value={cycleUnknown ? 'unknown' : undefined}
              onChange={() => setCycleUnknown((v) => !v)}
            />
            <Text style={[styles.label, styles.second]}>{tr('And how many days does your period usually last?')}</Text>
            <FineNumber
              compact
              value={periodDays}
              min={PERIOD.min}
              max={PERIOD.max}
              unit={tr('days')}
              label={tr('Period length')}
              onChange={(v) => {
                setPeriodDays(v);
                setPeriodUnknown(false);
              }}
              onValidChange={setPeriodOk}
              style={[styles.number, periodUnknown && styles.dim]}
            />
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
            <View style={styles.chips}>
              {SYMPTOM_OPTIONS.map((s) => (
                <FChip key={s.id} multi check label={tr(s.label)} on={symptoms.includes(s.id)} onPress={() => setSymptoms((l) => toggleIn(l, s.id))} />
              ))}
            </View>
          </>
        )}

        {step === 'contraception' && (
          <>
            <Text style={styles.title}>{tr('Are you using any contraception?')}</Text>
            <Text style={styles.lead}>{tr('Hormonal methods change how your cycle and predictions behave.')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {CONTRACEPTION_OPTIONS.map((c) => (
                <FChip key={c.id} label={tr(c.label)} on={contraception === c.id} onPress={() => setContraception(c.id)} />
              ))}
            </View>
          </>
        )}

        {step === 'conditions' && (
          <>
            <Text style={styles.title}>{tr('Has a doctor told you that you have any of these?')}</Text>
            <Text style={styles.lead}>{tr('Only if it has been diagnosed. It helps us read your cycle better. Optional.')}</Text>
            <View style={styles.chips}>
              {CONDITION_OPTIONS.map((c) => (
                <FChip key={c.id} multi check label={tr(c.label)} on={conditions.includes(c.id)} onPress={() => setConditions((l) => toggleIn(l, c.id))} />
              ))}
            </View>
          </>
        )}

        {step === 'trying' && (
          <>
            <Text style={styles.title}>{tr('Trying to conceive')}</Text>
            <Text style={styles.lead}>{tr('These help us tell you when it is worth seeing a doctor. Only the first one is needed.')}</Text>
            <Text style={[styles.label, styles.afterLead]}>{tr('How long have you been trying?')}</Text>
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
            <Text style={styles.title}>{tr('Add your morning temperature?')}</Text>
            <Text style={styles.lead}>
              {conceive
                ? tr('Your temperature rises slightly (about 0.2–0.5 °C) after you ovulate. Taking it every morning, before you get up, lets us confirm when it happened and learn your fertile window.')
                : tr('Your temperature rises slightly (about 0.2–0.5 °C) after you ovulate. Taking it every morning, before you get up, lets us confirm when it happened.')}
            </Text>
            <ChoiceChips
              options={[
                { id: 'yes', label: tr("Yes, I'll log it") },
                { id: 'no', label: tr('Not now') },
              ]}
              value={logTemp}
              onChange={(v) => setLogTemp(v as 'yes' | 'no')}
            />
            {/* Lo del reloj o la pulsera, como una nota apagada debajo (antes, una tarjeta con su icono) */}
            <Text style={styles.aside}>
              {tr('If your wearable measures temperature at night, we use it too. It is less precise than a thermometer, so the two together work best.')}
            </Text>
          </>
        )}

        {step === 'result' && (
          <>
            <Text style={styles.title}>{tr('All set')}</Text>
            {advice && (
              <View style={[styles.block, advice.level !== 'keep_trying' && styles.blockGold]}>
                <Text style={styles.blockTitle}>{advice.title}</Text>
                <Text style={styles.p}>{advice.body}</Text>
                {advice.tips.map((t) => (
                  <View key={t} style={styles.tipRow}>
                    <View style={styles.tipDot} />
                    <Text style={styles.tipText}>{t}</Text>
                  </View>
                ))}
                {advice.level !== 'keep_trying' && <FLink label={`${tr('Find a gynaecologist or fertility specialist')} ›`} onPress={toDoctor} style={styles.blockLink} />}
              </View>
            )}
            {goals
              .filter((g) => g !== 'conceive')
              .map((g) => (
                <Text key={g} style={[styles.p, styles.goalLine]}>
                  {g === 'symptoms'
                    ? tr('Log how you feel through the month and we will show you patterns by cycle phase.')
                    : g === 'perimenopause'
                      ? tr('We will keep an eye on changes in your cycle length and symptoms over time.')
                      : tr('We will predict your next period and your fertile days from what you log.')}
                </Text>
              ))}
            {worthAsking && (
              <View style={styles.block}>
                <Text style={styles.p}>
                  {tr('Very heavy bleeding or pain that stops you doing things is worth mentioning to your gynaecologist. It is common and there is a lot that can help.')}
                </Text>
                <FLink label={`${tr('Talk to a doctor')} ›`} onPress={toDoctor} style={styles.blockLink} />
              </View>
            )}
            <Text style={styles.disclaimer}>
              {tr('Kuova is not a contraceptive method and does not diagnose fertility problems. Guidance based on ASRM and NICE fertility guidelines.')}
            </Text>
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter style={styles.footer}>
        <FButton label={step === 'result' ? tr('Done') : tr('Continue')} onPress={next} disabled={!canContinue} />
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  skipBox: { minWidth: 40, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  skip: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  // La pregunta de cada paso y su explicación, como en «Crear mi menú»
  title: { ...formStyles.q },
  lead: { ...formStyles.lead, marginBottom: 18 },
  // Las preguntas de dentro de un paso
  label: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 22, marginTop: 24, marginBottom: 8 },
  afterLead: { marginTop: 4 },
  second: { marginTop: 32, marginBottom: 12 },
  hint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, marginTop: -4, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // El calendario, sin tarjeta: entre dos líneas finas
  calendar: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line, marginBottom: 14 },
  // El «− cifra +», a la izquierda como el resto de las respuestas del cuestionario
  number: { alignItems: 'flex-start', marginTop: 4, marginBottom: 14 },
  dim: { opacity: 0.35 },
  aside: { ...fine.note, marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: FINE.line },
  // Lo que conviene leer al acabar: una tarjeta casi transparente; con borde de oro si toca consultarlo
  block: { ...fine.tile, padding: 14, gap: 8, marginTop: 14 },
  blockGold: { borderColor: FINE.goldLine },
  blockTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 22 },
  blockLink: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 36, paddingVertical: 6 },
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  goalLine: { marginTop: 12 },
  tipRow: { flexDirection: 'row', gap: 10 },
  tipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: FINE.mute, marginTop: 8 },
  tipText: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  disclaimer: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16, marginTop: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
});
