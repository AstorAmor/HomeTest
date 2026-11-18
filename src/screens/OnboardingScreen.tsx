import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WheelPicker } from '@/components/WheelPicker';
import { StepsBar } from '@/components/fine/FineSteps';
import { FButton, FChip, FChips, FOption, formStyles } from '@/components/fine/FineForm';
import {
  ActivityLevel,
  Alcohol,
  CONDITION_OPTIONS,
  ConditionId,
  GOAL_OPTIONS,
  GoalId,
  Sex,
  SleepHabit,
  Smoking,
  StepsBand,
  UserProfile,
  profileRepository,
} from '@/data/profileRepository';
import { AppPurpose, appPrefs, PURPOSE_OPTIONS } from '@/data/appPrefs';
import { t as tr } from '@/i18n';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { requestTourAfterOnboarding } from '@/components/tour/tourStore';
import { userFlags } from '@/data/userFlags';
import { FIRST_STEPS_FLAG } from '@/logic/firstSteps';
// Opciones, ruedas y lo que se enciende al guardar: compartido con «Sobre ti» de Mi perfil (2026-11-16)
import {
  ACTIVITY_OPTIONS,
  ALCOHOL_OPTIONS,
  applyProfileSections,
  DAYS,
  DAYS_OPTIONS,
  daysInMonth,
  dobFromWheels,
  HEIGHTS,
  monthLabels,
  SEX_OPTIONS,
  SLEEP_OPTIONS,
  SMOKING_OPTIONS,
  STEPS_OPTIONS,
  toggleConditionIn,
  WEIGHTS,
  wheelsFromDob,
  YEARS,
} from '@/components/profile/profileFields';
import { FINE, ff, fine } from '@/theme/fine';

type Step = 'purpose' | 'dob' | 'sex' | 'body' | 'activity' | 'habits' | 'health' | 'goals';

// Mismos pasos para todos (la barra de avance no cambia según lo que elija). Lo que se ve en la
// app no se pregunta: sale de estas respuestas (src/data/goalEffects.ts) y se ajusta luego en
// Tú → Configura tu experiencia.
const STEPS: Step[] = ['purpose', 'dob', 'sex', 'body', 'activity', 'habits', 'health', 'goals'];

// Las opciones con su texto en el idioma de la app, para los chips
const opts = <T extends string>(list: { id: T; label: string }[]) => list.map((o) => ({ id: o.id, label: tr(o.label) }));

export const OnboardingScreen = () => {
  const router = useRouter();
  // Primeros pasos de una cuenta nueva (src/logic/firstSteps.ts): al acabar, a objetivos y metas en vez de a Hoy
  const inicio = useLocalSearchParams<{ inicio?: string }>().inicio === '1';
  const [stepIndex, setStepIndex] = useState(0);
  const months = useMemo(monthLabels, []);

  const [day, setDay] = useState(14);
  const [month, setMonth] = useState(5);
  const [year, setYear] = useState(YEARS.indexOf('1992'));
  const [sex, setSex] = useState<Sex>();
  const [height, setHeight] = useState(HEIGHTS.indexOf('175'));
  const [weight, setWeight] = useState(WEIGHTS.indexOf('75'));
  const [activity, setActivity] = useState<ActivityLevel>();
  const [strengthDays, setStrengthDays] = useState<number>();
  const [cardioDays, setCardioDays] = useState<number>();
  const [stepsBand, setStepsBand] = useState<StepsBand>();
  const [sleep, setSleep] = useState<SleepHabit>();
  const [smoking, setSmoking] = useState<Smoking>();
  const [alcohol, setAlcohol] = useState<Alcohol>();
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [takesMedication, setTakesMedication] = useState<boolean>();
  const [medications, setMedications] = useState('');
  const [conditions, setConditions] = useState<ConditionId[]>([]);
  const [conditionsOther, setConditionsOther] = useState('');
  const [purposes, setPurposes] = useState<AppPurpose[]>([]);
  // Sin plan (solo historial, o entender sin plan) no se "construye" ningún plan al final

  // Al editar el perfil, el cuestionario parte de las respuestas ya guardadas
  useEffect(() => {
    appPrefs
      .load()
      .then((p) => setPurposes(p.purposes))
      .catch(() => undefined);
    profileRepository
      .get()
      .then((p) => {
        const dob = wheelsFromDob(p.dateOfBirth);
        if (dob) {
          setYear(dob.year);
          setMonth(dob.month);
          setDay(dob.day);
        }
        if (p.sex) setSex(p.sex);
        if (p.heightCm && HEIGHTS.includes(String(p.heightCm))) setHeight(HEIGHTS.indexOf(String(p.heightCm)));
        if (p.weightKg && WEIGHTS.includes(String(Math.round(p.weightKg)))) setWeight(WEIGHTS.indexOf(String(Math.round(p.weightKg))));
        setActivity(p.activity);
        setStrengthDays(p.strengthDays);
        setCardioDays(p.cardioDays);
        setStepsBand(p.stepsBand);
        setSleep(p.sleep);
        setSmoking(p.smoking);
        setAlcohol(p.alcohol);
        setGoals(p.goals);
        setTakesMedication(p.takesMedication);
        setMedications(p.medications ?? '');
        setConditions(p.conditions ?? []);
        setConditionsOther(p.conditionsOther ?? '');
      })
      .catch(() => undefined);
  }, []);
  // Qué pasos ha respondido de verdad (si se salta, no se guarda el valor por defecto)
  const [answered, setAnswered] = useState<Set<Step>>(new Set());

  const step = STEPS[stepIndex];

  const buildProfile = async (): Promise<UserProfile> => {
    const current = await profileRepository.get();
    const profile: UserProfile = { ...current, goals };
    if (answered.has('dob')) {
      // Un 31 de febrero se guarda como el último día de febrero (como en «Sobre ti»)
      profile.dateOfBirth = dobFromWheels(Math.min(day, daysInMonth(month, year) - 1), month, year);
    }
    if (sex) profile.sex = sex;
    if (answered.has('body')) {
      profile.heightCm = Number(HEIGHTS[height]);
      profile.weightKg = Number(WEIGHTS[weight]);
    }
    Object.assign(profile, { activity, strengthDays, cardioDays, stepsBand, sleep, smoking, alcohol });
    if (answered.has('health') || takesMedication !== undefined || conditions.length) {
      profile.takesMedication = takesMedication;
      profile.medications = takesMedication ? medications.trim() : undefined;
      profile.conditions = conditions;
      profile.conditionsOther = conditions.includes('other') ? conditionsOther.trim() : undefined;
    }
    return profile;
  };

  // Enciende lo que piden sus respuestas (p. ej. medicación si toma alguna, el ciclo si cuida su
  // salud reproductiva y es mujer); lo demás queda como esté
  const applySections = applyProfileSections;

  const skipAll = async () => {
    if (purposes.length) await appPrefs.setPurposes(purposes);
    const profile = await buildProfile();
    await profileRepository.save(profile);
    await applySections(profile);
    await requestTourAfterOnboarding();
    // Saltó el cuestionario: no se le vuelve a llevar a los primeros pasos
    if (inicio) await userFlags.set(FIRST_STEPS_FLAG, 'skipped').catch(() => undefined);
    router.replace('/(tabs)');
  };

  const next = async () => {
    setAnswered((prev) => new Set(prev).add(step));
    if (step === 'purpose' && purposes.length) await appPrefs.setPurposes(purposes);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    const profile = await buildProfile();
    profile.completedAt = new Date().toISOString();
    await profileRepository.save(profile);
    await applySections(profile);
    // Directo a Hoy, donde empieza el tutorial. Sin las pantallas de presentación del plan (el
    // fundador las quitó el 2026-10-21: no se veían bien ni tienen sentido sin la suscripción completa)
    await requestTourAfterOnboarding();
    // Cuenta nueva: sigue con sus objetivos y metas (lo que recomiendan sus respuestas) y la firma; el tutorial,
    // al llegar a Hoy (fundador, 2026-11-17)
    if (inicio) router.replace({ pathname: '/metas-objetivos', params: { inicio: '1' } });
    else router.replace('/(tabs)');
  };

  const toggleCondition = (id: ConditionId) => setConditions((prev) => toggleConditionIn(prev, id));

  const toggleGoal = (id: GoalId) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  const togglePurpose = (id: AppPurpose) =>
    setPurposes((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* La barra de los cuestionarios paso a paso (fine/FineSteps.tsx): «‹» al paso anterior, el avance como una línea
          cometa y «Omitir». En el primer paso de una cuenta nueva no hay × (no hay adónde volver) */}
      <StepsBar
        index={stepIndex}
        total={STEPS.length}
        onBack={() => (stepIndex > 0 ? setStepIndex(stepIndex - 1) : router.back())}
        noClose={inicio || !router.canGoBack()}
        right={
          <TouchableOpacity onPress={skipAll} hitSlop={10} style={styles.skipBox} accessibilityRole="button">
            <Text style={styles.skip}>{tr('Skip')}</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 'purpose' && (
          <>
            <Text style={styles.title}>{tr('What do you want Kuova for?')}</Text>
            <Text style={styles.lead}>
              {tr(
                'Pick one or more. Your answer shapes your experience: what you see in the app and which options appear. You can change it anytime in You → Configure my experience.',
              )}
            </Text>
            <View>
              {PURPOSE_OPTIONS.map((o, i) => (
                <FOption
                  key={o.id}
                  multi
                  title={tr(o.title)}
                  hint={tr(o.subtitle)}
                  on={purposes.includes(o.id)}
                  onPress={() => togglePurpose(o.id)}
                  last={i === PURPOSE_OPTIONS.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {step === 'dob' && (
          <>
            <Text style={styles.title}>{tr('When were you born?')}</Text>
            <Text style={styles.lead}>{tr('Reference ranges change with age.')}</Text>
            <View style={styles.wheels}>
              <WheelPicker items={DAYS} selectedIndex={day} onChange={setDay} width={72} />
              <WheelPicker items={months} selectedIndex={month} onChange={setMonth} width={100} />
              <WheelPicker items={YEARS} selectedIndex={year} onChange={setYear} width={100} />
            </View>
          </>
        )}

        {step === 'sex' && (
          <>
            <Text style={styles.title}>{tr("What's your biological sex?")}</Text>
            <Text style={styles.lead}>{tr('Many markers (iron, hormones…) have different ranges.')}</Text>
            <View>
              {SEX_OPTIONS.map((o, i) => (
                <FOption key={o.id} title={tr(o.label)} on={sex === o.id} onPress={() => setSex(o.id)} last={i === SEX_OPTIONS.length - 1} />
              ))}
            </View>
          </>
        )}

        {step === 'body' && (
          <>
            <Text style={styles.title}>{tr('Height and weight')}</Text>
            <Text style={styles.lead}>{tr('Used for body composition and energy needs.')}</Text>
            <View style={styles.wheels}>
              <View style={styles.wheelColumn}>
                <WheelPicker items={HEIGHTS} selectedIndex={height} onChange={setHeight} width={120} />
                <Text style={styles.wheelUnit}>{tr('cm')}</Text>
              </View>
              <View style={styles.wheelColumn}>
                <WheelPicker items={WEIGHTS} selectedIndex={weight} onChange={setWeight} width={120} />
                <Text style={styles.wheelUnit}>{tr('kg')}</Text>
              </View>
            </View>
          </>
        )}

        {step === 'activity' && (
          <>
            <Text style={styles.title}>{tr('Your activity')}</Text>
            <Text style={styles.lead}>
              {tr('Roughly is fine. If you log your workouts or connect a watch, your plan will use that instead.')}
            </Text>
            <Text style={[styles.label, styles.firstLabel]}>{tr('How active are you?')}</Text>
            <FChips value={activity} onChange={setActivity} options={opts(ACTIVITY_OPTIONS)} />
            <Text style={styles.label}>{tr('How many days a week do you do strength training?')}</Text>
            <FChips value={strengthDays != null ? String(strengthDays) : undefined} onChange={(v) => setStrengthDays(Number(v))} options={opts(DAYS_OPTIONS)} />
            <Text style={styles.label}>{tr('And cardio (running, cycling, swimming…)?')}</Text>
            <FChips value={cardioDays != null ? String(cardioDays) : undefined} onChange={(v) => setCardioDays(Number(v))} options={opts(DAYS_OPTIONS)} />
            <Text style={styles.label}>{tr('How many steps do you walk a day?')}</Text>
            <FChips value={stepsBand} onChange={setStepsBand} options={opts(STEPS_OPTIONS)} />
          </>
        )}

        {step === 'habits' && (
          <>
            <Text style={styles.title}>{tr('Your habits')}</Text>
            <Text style={styles.lead}>{tr('Knowing where you start from helps us build a plan that fits you.')}</Text>
            <Text style={[styles.label, styles.firstLabel]}>{tr('How much do you usually sleep?')}</Text>
            <FChips value={sleep} onChange={setSleep} options={opts(SLEEP_OPTIONS)} />
            <Text style={styles.label}>{tr('Do you smoke?')}</Text>
            <FChips value={smoking} onChange={setSmoking} options={opts(SMOKING_OPTIONS)} />
            <Text style={styles.label}>{tr('Alcohol')}</Text>
            <FChips value={alcohol} onChange={setAlcohol} options={opts(ALCOHOL_OPTIONS)} />
          </>
        )}

        {step === 'health' && (
          <>
            <Text style={styles.title}>{tr('Your health background')}</Text>
            <Text style={styles.lead}>
              {tr('Some medicines and conditions change how results should be read. Only you and the professionals you choose can see this.')}
            </Text>
            <Text style={[styles.label, styles.firstLabel]}>{tr('Do you take any regular medication?')}</Text>
            <FChips
              value={takesMedication === undefined ? undefined : takesMedication ? 'yes' : 'no'}
              onChange={(v) => setTakesMedication(v === 'yes')}
              options={[
                { id: 'no', label: tr('No') },
                { id: 'yes', label: tr('Yes') },
              ]}
            />
            {takesMedication && (
              <TextInput
                style={[formStyles.input, styles.input]}
                value={medications}
                onChangeText={setMedications}
                placeholder={tr('Which ones? e.g. levothyroxine 50 µg, contraceptive pill')}
                placeholderTextColor={FINE.mute}
                multiline
              />
            )}
            <Text style={styles.label}>{tr('Have you been diagnosed with any condition?')}</Text>
            <View style={styles.chips}>
              {CONDITION_OPTIONS.filter((c) => !c.femaleOnly || sex === 'female').map((c) => (
                <FChip key={c.id} multi check label={tr(c.label)} on={conditions.includes(c.id)} onPress={() => toggleCondition(c.id)} />
              ))}
            </View>
            {conditions.includes('other') && (
              <TextInput
                style={[formStyles.input, styles.input]}
                value={conditionsOther}
                onChangeText={setConditionsOther}
                placeholder={tr('Tell us which')}
                placeholderTextColor={FINE.mute}
              />
            )}
          </>
        )}

        {step === 'goals' && (
          <>
            <Text style={styles.title}>{tr('What do you want to achieve?')}</Text>
            <Text style={styles.lead}>{tr('Everyone has their own goals. Choose yours and we will build your plan around them.')}</Text>
            <View>
              {GOAL_OPTIONS.map((g, i) => (
                <FOption key={g.id} multi title={tr(g.label)} on={goals.includes(g.id)} onPress={() => toggleGoal(g.id)} last={i === GOAL_OPTIONS.length - 1} />
              ))}
            </View>
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter style={styles.footer}>
        <FButton label={stepIndex < STEPS.length - 1 ? tr('Continue') : tr('Done')} onPress={next} />
      </KeyboardFooter>
    </SafeAreaView>
  );
};

// En el lenguaje fino desde el 2026-11-17 (fundador: «si queda pendiente lo del cuestionario… ¿por qué no lo
// actualizas?»), como el cuestionario del ciclo: la pregunta grande y su explicación, opciones en filas con una línea
// fina y un círculo, chips con borde y el botón esmeralda. Sin tarjetas ni iconos de color.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  skipBox: { minWidth: 40, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  skip: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  title: { ...formStyles.q },
  lead: { ...formStyles.lead, marginBottom: 18 },
  // Las preguntas de dentro de un paso
  label: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 22, marginTop: 24, marginBottom: 10 },
  firstLabel: { marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { marginTop: 12 },
  // Ruedas pegadas: las rayas de la selección forman una sola franja de lado a lado
  wheels: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  wheelColumn: { alignItems: 'center' },
  wheelUnit: { ...fine.unit, marginTop: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
});
