import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { WheelPicker } from '@/components/WheelPicker';
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
  UserProfile,
  profileRepository,
} from '@/data/profileRepository';
import { AppPurpose, appPrefs, PURPOSE_OPTIONS, wantsPlan } from '@/data/appPrefs';
import { answersPreview, sectionsFromAnswers } from '@/data/goalEffects';
import { t as tr } from '@/i18n';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS = Array.from({ length: 81 }, (_, i) => String(1930 + i));
const HEIGHTS = Array.from({ length: 71 }, (_, i) => String(140 + i));
const WEIGHTS = Array.from({ length: 111 }, (_, i) => String(40 + i));

type Step = 'purpose' | 'dob' | 'sex' | 'body' | 'habits' | 'health' | 'goals';

// Mismos pasos para todos (la barra de avance no cambia según lo que elija). Lo que se ve en la
// app no se pregunta: sale de estas respuestas (src/data/goalEffects.ts) y se ajusta luego en
// More → Configure my experience.
const STEPS: Step[] = ['purpose', 'dob', 'sex', 'body', 'habits', 'health', 'goals'];

interface ChipOption<T extends string> {
  id: T;
  label: string;
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value?: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(o.id)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{tr(o.label)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const OnboardingScreen = () => {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<'questions' | 'building'>('questions');

  const [day, setDay] = useState(14);
  const [month, setMonth] = useState(5);
  const [year, setYear] = useState(YEARS.indexOf('1992'));
  const [sex, setSex] = useState<Sex>();
  const [height, setHeight] = useState(HEIGHTS.indexOf('175'));
  const [weight, setWeight] = useState(WEIGHTS.indexOf('75'));
  const [activity, setActivity] = useState<ActivityLevel>();
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
  const buildsPlan = wantsPlan(purposes);

  // Al editar el perfil, el cuestionario parte de las respuestas ya guardadas
  useEffect(() => {
    appPrefs
      .load()
      .then((p) => setPurposes(p.purposes))
      .catch(() => undefined);
    profileRepository
      .get()
      .then((p) => {
        if (p.dateOfBirth) {
          const [y, m, d] = p.dateOfBirth.split('-').map(Number);
          if (YEARS.includes(String(y))) setYear(YEARS.indexOf(String(y)));
          setMonth(m - 1);
          setDay(d - 1);
        }
        if (p.sex) setSex(p.sex);
        if (p.heightCm && HEIGHTS.includes(String(p.heightCm))) setHeight(HEIGHTS.indexOf(String(p.heightCm)));
        if (p.weightKg && WEIGHTS.includes(String(Math.round(p.weightKg)))) setWeight(WEIGHTS.indexOf(String(Math.round(p.weightKg))));
        setActivity(p.activity);
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
      profile.dateOfBirth = `${YEARS[year]}-${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
    }
    if (sex) profile.sex = sex;
    if (answered.has('body')) {
      profile.heightCm = Number(HEIGHTS[height]);
      profile.weightKg = Number(WEIGHTS[weight]);
    }
    Object.assign(profile, { activity, sleep, smoking, alcohol });
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
  const applySections = async (profile: UserProfile) => {
    for (const section of sectionsFromAnswers(profile)) await appPrefs.setSectionVisible(section, true);
  };

  const skipAll = async () => {
    if (purposes.length) await appPrefs.setPurposes(purposes);
    const profile = await buildProfile();
    await profileRepository.save(profile);
    await applySections(profile);
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
    if (buildsPlan) setPhase('building');
    else router.replace('/(tabs)');
  };

  useEffect(() => {
    if (phase !== 'building') return;
    // Recibir el plan no se celebra (ni insignia ni confeti): eso queda para lo que el usuario consigue
    const t = setTimeout(() => router.replace('/plan-intro'), 1600);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'building') {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.buildingText}>{tr('Building your personalised plan…')}</Text>
      </SafeAreaView>
    );
  }

  const toggleCondition = (id: ConditionId) =>
    setConditions((prev) => {
      if (id === 'none') return prev.includes('none') ? [] : ['none'];
      const without = prev.filter((c) => c !== 'none');
      return without.includes(id) ? without.filter((c) => c !== id) : [...without, id];
    });

  const toggleGoal = (id: GoalId) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  const togglePurpose = (id: AppPurpose) =>
    setPurposes((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  // Vista previa de lo que cambia con lo elegido (plan de partida y secciones que se encienden)
  const preview = answersPreview({
    goals,
    sex,
    activity,
    sleep,
    smoking,
    alcohol,
    conditions,
    takesMedication,
    dateOfBirth: answered.has('dob') ? `${YEARS[year]}-${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}` : undefined,
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (stepIndex > 0 ? setStepIndex(stepIndex - 1) : undefined)}
          hitSlop={12}
          style={{ opacity: stepIndex > 0 ? 1 : 0 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((stepIndex + 1) / STEPS.length) * 100}%` }]} />
        </View>
        <TouchableOpacity onPress={skipAll} hitSlop={12}>
          <Text style={styles.skip}>{tr('Skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 'purpose' && (
          <>
            <Text style={styles.title}>{tr('What do you want Kuova for?')}</Text>
            <Text style={styles.subtitle}>
              {tr("Pick one or more. We'll only show what you need, and you can change it anytime in More → Configure my experience.")}
            </Text>
            <View style={styles.goalList}>
              {PURPOSE_OPTIONS.map((o) => {
                const selected = purposes.includes(o.id);
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.goalRow, styles.purposeRow, selected && styles.bigOptionSelected]}
                    onPress={() => togglePurpose(o.id)}
                  >
                    <Ionicons name={o.icon as any} size={24} color={selected ? Colors.accent : Colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.purposeTitle, selected && { color: Colors.accent }]}>{tr(o.title)}</Text>
                      <Text style={styles.purposeSubtitle}>{tr(o.subtitle)}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? Colors.accent : Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'dob' && (
          <>
            <Text style={styles.title}>{tr('When were you born?')}</Text>
            <Text style={styles.subtitle}>{tr('Reference ranges change with age.')}</Text>
            <View style={styles.wheels}>
              <WheelPicker items={DAYS} selectedIndex={day} onChange={setDay} width={84} />
              <WheelPicker items={MONTHS} selectedIndex={month} onChange={setMonth} width={104} />
              <WheelPicker items={YEARS} selectedIndex={year} onChange={setYear} width={110} />
            </View>
          </>
        )}

        {step === 'sex' && (
          <>
            <Text style={styles.title}>{tr("What's your biological sex?")}</Text>
            <Text style={styles.subtitle}>{tr('Many markers (iron, hormones…) have different ranges.')}</Text>
            <View style={styles.bigOptions}>
              {(
                [
                  { id: 'female', label: 'Female', icon: 'female' },
                  { id: 'male', label: 'Male', icon: 'male' },
                  { id: 'other', label: 'Other', icon: 'male-female' },
                  { id: 'undisclosed', label: 'Prefer not to say', icon: 'remove-circle-outline' },
                ] as const
              ).map((o) => {
                const selected = sex === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.bigOption, selected && styles.bigOptionSelected]}
                    onPress={() => setSex(o.id)}
                  >
                    <Ionicons name={o.icon} size={26} color={selected ? Colors.accent : Colors.textSecondary} />
                    <Text style={[styles.bigOptionText, selected && { color: Colors.textPrimary }]}>{tr(o.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 'body' && (
          <>
            <Text style={styles.title}>{tr('Height and weight')}</Text>
            <Text style={styles.subtitle}>{tr('Used for body composition and energy needs.')}</Text>
            <View style={styles.wheels}>
              <View style={styles.wheelColumn}>
                <WheelPicker items={HEIGHTS} selectedIndex={height} onChange={setHeight} width={130} />
                <Text style={styles.wheelUnit}>{tr('cm')}</Text>
              </View>
              <View style={styles.wheelColumn}>
                <WheelPicker items={WEIGHTS} selectedIndex={weight} onChange={setWeight} width={130} />
                <Text style={styles.wheelUnit}>{tr('kg')}</Text>
              </View>
            </View>
          </>
        )}

        {step === 'habits' && (
          <>
            <Text style={styles.title}>{tr('Your habits')}</Text>
            <Text style={styles.subtitle}>{tr('Knowing where you start from helps us build a plan that fits you.')}</Text>
            <Text style={styles.question}>{tr('How active are you?')}</Text>
            <ChipGroup
              value={activity}
              onChange={setActivity}
              options={[
                { id: 'sedentary', label: 'Mostly sitting' },
                { id: 'light', label: 'Light activity' },
                { id: 'active', label: 'Fairly active' },
                { id: 'very_active', label: 'Very active' },
              ]}
            />
            <Text style={styles.question}>{tr('How much do you usually sleep?')}</Text>
            <ChipGroup
              value={sleep}
              onChange={setSleep}
              options={[
                { id: 'lt6', label: '< 6 h' },
                { id: '6to7', label: '6–7 h' },
                { id: '7to8', label: '7–8 h' },
                { id: 'gt8', label: '> 8 h' },
              ]}
            />
            <Text style={styles.question}>{tr('Do you smoke?')}</Text>
            <ChipGroup
              value={smoking}
              onChange={setSmoking}
              options={[
                { id: 'never', label: 'Never' },
                { id: 'former', label: 'I used to' },
                { id: 'occasional', label: 'Occasionally' },
                { id: 'current', label: 'Yes' },
              ]}
            />
            <Text style={styles.question}>{tr('Alcohol')}</Text>
            <ChipGroup
              value={alcohol}
              onChange={setAlcohol}
              options={[
                { id: 'never', label: 'Never' },
                { id: 'occasional', label: 'Occasionally' },
                { id: 'weekly', label: 'Every week' },
                { id: 'daily', label: 'Daily' },
              ]}
            />
          </>
        )}

        {step === 'health' && (
          <>
            <Text style={styles.title}>{tr('Your health background')}</Text>
            <Text style={styles.subtitle}>
              {tr('Some medicines and conditions change how results should be read. Only you and the professionals you choose can see this.')}
            </Text>
            <Text style={styles.question}>{tr('Do you take any regular medication?')}</Text>
            <ChipGroup
              value={takesMedication === undefined ? undefined : takesMedication ? 'yes' : 'no'}
              onChange={(v) => setTakesMedication(v === 'yes')}
              options={[
                { id: 'no', label: 'No' },
                { id: 'yes', label: 'Yes' },
              ]}
            />
            {takesMedication && (
              <TextInput
                style={styles.textInput}
                value={medications}
                onChangeText={setMedications}
                placeholder={tr('Which ones? e.g. levothyroxine 50 µg, contraceptive pill')}
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            )}
            <Text style={styles.question}>{tr('Have you been diagnosed with any condition?')}</Text>
            <View style={styles.chips}>
              {CONDITION_OPTIONS.filter((c) => !c.femaleOnly || sex === 'female').map((c) => {
                const selected = conditions.includes(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleCondition(c.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{tr(c.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {conditions.includes('other') && (
              <TextInput
                style={styles.textInput}
                value={conditionsOther}
                onChangeText={setConditionsOther}
                placeholder={tr('Tell us which')}
                placeholderTextColor={Colors.textMuted}
              />
            )}
          </>
        )}

        {step === 'goals' && (
          <>
            <Text style={styles.title}>{tr('What do you want to achieve?')}</Text>
            <Text style={styles.subtitle}>{tr('Everyone has their own goals. Choose yours and we will build your plan around them.')}</Text>
            <View style={styles.goalList}>
              {GOAL_OPTIONS.map((g) => {
                const selected = goals.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.goalRow, selected && styles.bigOptionSelected]}
                    onPress={() => toggleGoal(g.id)}
                  >
                    <Ionicons name={g.icon as any} size={22} color={selected ? Colors.accent : Colors.textSecondary} />
                    <Text style={[styles.goalText, selected && { color: Colors.accent }]}>{tr(g.label)}</Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? Colors.accent : Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {buildsPlan && (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>{tr('Your starting plan')}</Text>
                {preview.plan.map((t, i) => (
                  <Text key={t} style={styles.previewItem}>
                    {i + 1}. {t}
                  </Text>
                ))}
                {preview.sections.length > 0 && (
                  <Text style={styles.previewNote}>Also switched on for you: {preview.sections.join(', ')}.</Text>
                )}
                <Text style={styles.previewNote}>{tr('It changes as you choose, and again when your results arrive.')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
        <Text style={styles.ctaText}>
          {stepIndex < STEPS.length - 1 ? tr('Continue') : buildsPlan ? tr('Create my plan') : tr('Done')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  skip: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 28,
  },
  // Ruedas pegadas: las rayas de la selección forman una sola franja de lado a lado
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  wheelColumn: {
    alignItems: 'center',
  },
  wheelUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  bigOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bigOption: {
    width: '47%',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 22,
  },
  bigOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: withAlpha(Colors.accent, 0.08),
  },
  bigOptionText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  question: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.textPrimary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 15,
    marginBottom: 18,
  },
  goalList: {
    gap: 10,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 16,
  },
  goalText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  purposeRow: {
    alignItems: 'flex-start',
    paddingVertical: 18,
  },
  purposeTitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  purposeSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  preview: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.35),
    backgroundColor: withAlpha(Colors.accent, 0.06),
    padding: 14,
    gap: 4,
  },
  previewTitle: { color: Colors.accent, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  previewItem: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  previewNote: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  buildingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 16,
  },
});
