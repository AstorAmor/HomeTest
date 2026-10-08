import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { CYCLE_GOAL_PROMPTED, cycleGoalStore } from '@/data/cycleGoal';
import { profileRepository } from '@/data/profileRepository';
import { userFlags } from '@/data/userFlags';
import { CYCLE_GOAL_OPTIONS, CycleGoal, CycleGoalAnswers } from '@/types/cycleGoal';
import { fertilityAdvice, SexFrequency, Timing, TryingFor } from '@/logic/fertility';

type Step = 'goal' | 'cycle' | 'trying' | 'temperature' | 'result';


const ageFrom = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
};

// Encuesta de la primera vez que se abre el ciclo (como Flo): qué busca, cómo son sus ciclos y,
// si busca embarazo, desde cuándo y cómo, con cuidado de no pasarse (todo opcional salvo el
// tiempo). Al final, si toca según las guías, recomienda hablar con un médico.
export const CycleGoalScreen = () => {
  const router = useRouter();
  const [step, setStep] = useState<Step>('goal');
  const [goal, setGoal] = useState<CycleGoal | undefined>();
  const [regular, setRegular] = useState<CycleGoalAnswers['regularCycles'] | undefined>();
  const [contraception, setContraception] = useState<CycleGoalAnswers['hormonalContraception']>();
  const [tryingFor, setTryingFor] = useState<TryingFor | undefined>();
  const [frequency, setFrequency] = useState<SexFrequency | 'skip' | undefined>();
  const [timing, setTiming] = useState<Timing | 'skip' | undefined>();
  const [logTemp, setLogTemp] = useState<'yes' | 'no' | undefined>();
  const [age, setAge] = useState<number | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);

  useEffect(() => {
    userFlags.set(CYCLE_GOAL_PROMPTED);
    profileRepository.get().then((p) => {
      setAge(ageFrom(p.dateOfBirth));
      setConditions(p.conditions.filter((c) => c === 'pcos'));
    });
    cycleGoalStore.get().then((g) => {
      if (!g) return;
      setGoal(g.goal);
      setRegular(g.regularCycles);
      setContraception(g.hormonalContraception);
      setTryingFor(g.tryingFor);
      setFrequency(g.frequency);
      setTiming(g.timing);
      setLogTemp(g.logTemperature == null ? undefined : g.logTemperature ? 'yes' : 'no');
    });
  }, []);

  const steps: Step[] = ['goal', 'cycle', ...(goal === 'conceive' ? (['trying'] as Step[]) : []), 'temperature', 'result'];
  const index = steps.indexOf(step);
  const canContinue =
    (step === 'goal' && !!goal) ||
    (step === 'cycle' && !!regular) ||
    (step === 'trying' && !!tryingFor) ||
    (step === 'temperature' && !!logTemp) ||
    step === 'result';

  const answers = (): CycleGoalAnswers => ({
    goal: goal!,
    regularCycles: regular ?? 'unsure',
    hormonalContraception: contraception,
    tryingFor: goal === 'conceive' ? tryingFor : undefined,
    frequency: goal === 'conceive' && frequency !== 'skip' ? frequency : undefined,
    timing: goal === 'conceive' && timing !== 'skip' ? timing : undefined,
    logTemperature: logTemp === 'yes',
    answeredAt: new Date().toISOString(),
  });

  const next = async () => {
    if (step === 'result') {
      await cycleGoalStore.set(answers());
      router.back();
      return;
    }
    setStep(steps[index + 1]);
  };

  const advice =
    goal === 'conceive' && tryingFor
      ? fertilityAdvice({
          age,
          tryingFor,
          regularCycles: regular ?? 'unsure',
          frequency: frequency === 'skip' ? undefined : frequency,
          timing: timing === 'skip' ? undefined : timing,
          knownConditions: conditions,
        })
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => (index > 0 ? setStep(steps[index - 1]) : router.back())}
        >
          <Ionicons name={index > 0 ? 'chevron-back' : 'close'} size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
        </View>
        {step !== 'result' ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'goal' && (
          <>
            <Ionicons name="rose-outline" size={34} color={Colors.pulseAccent} style={styles.icon} />
            <Text style={styles.title}>What would you like to do?</Text>
            <Text style={styles.subtitle}>We will adapt your cycle predictions and tips. You can change it any time.</Text>
            {CYCLE_GOAL_OPTIONS.map((o) => {
              const selected = goal === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setGoal(o.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={o.icon as any} size={22} color={selected ? Colors.pulseAccent : Colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{o.title}</Text>
                    <Text style={styles.optionSubtitle}>{o.subtitle}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? Colors.pulseAccent : Colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 'cycle' && (
          <>
            <Text style={styles.title}>About your cycle</Text>
            <Text style={styles.label}>Are your periods usually regular?</Text>
            <Text style={styles.hint}>Regular means they come every 21 to 35 days and roughly on time.</Text>
            <ChoiceChips
              options={[
                { id: 'yes', label: 'Yes' },
                { id: 'no', label: 'No' },
                { id: 'unsure', label: 'Not sure' },
              ]}
              value={regular}
              onChange={(v) => setRegular(v as CycleGoalAnswers['regularCycles'])}
            />
            <Text style={styles.label}>Are you using hormonal contraception?</Text>
            <Text style={styles.hint}>It changes how your cycle and predictions behave.</Text>
            <ChoiceChips
              options={[
                { id: 'none', label: 'No' },
                { id: 'pill', label: 'The pill' },
                { id: 'hormonal_iud', label: 'Hormonal IUD' },
                { id: 'other', label: 'Other' },
              ]}
              value={contraception}
              onChange={(v) => setContraception(v as CycleGoalAnswers['hormonalContraception'])}
            />
          </>
        )}

        {step === 'trying' && (
          <>
            <Text style={styles.title}>Trying to conceive</Text>
            <Text style={styles.subtitle}>
              These help us tell you when it is worth seeing a doctor. Only the first one is needed.
            </Text>
            <Text style={styles.label}>How long have you been trying?</Text>
            <ChoiceChips
              options={[
                { id: 'under_6m', label: 'Less than 6 months' },
                { id: '6_12m', label: '6 to 12 months' },
                { id: '1_2y', label: '1 to 2 years' },
                { id: 'over_2y', label: 'More than 2 years' },
              ]}
              value={tryingFor}
              onChange={(v) => setTryingFor(v as TryingFor)}
            />
            <Text style={styles.label}>How often do you have sex? (optional)</Text>
            <ChoiceChips
              options={[
                { id: 'several_week', label: 'Several times a week' },
                { id: 'weekly', label: 'About once a week' },
                { id: 'less', label: 'Less often' },
                { id: 'skip', label: 'Prefer not to say' },
              ]}
              value={frequency}
              onChange={(v) => setFrequency(v as SexFrequency | 'skip')}
            />
            <Text style={styles.label}>Do you plan it around your fertile days? (optional)</Text>
            <ChoiceChips
              options={[
                { id: 'yes', label: 'Yes' },
                { id: 'sometimes', label: 'Sometimes' },
                { id: 'no', label: 'No' },
                { id: 'skip', label: 'Prefer not to say' },
              ]}
              value={timing}
              onChange={(v) => setTiming(v as Timing | 'skip')}
            />
          </>
        )}

        {step === 'temperature' && (
          <>
            <Ionicons name="thermometer-outline" size={34} color={Colors.gold} style={styles.icon} />
            <Text style={styles.title}>Add your morning temperature?</Text>
            <Text style={styles.subtitle}>
              Your temperature rises slightly (about 0.2–0.5 °C) after you ovulate. Taking it every morning, before you
              get up, lets us confirm when it happened{goal === 'conceive' ? ' and learn your fertile window' : ''}.
            </Text>
            <View style={styles.infoCard}>
              <Ionicons name="watch-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.infoText}>
                If your wearable measures temperature at night, we use it too. It is less precise than a thermometer,
                so the two together work best.
              </Text>
            </View>
            <ChoiceChips
              options={[
                { id: 'yes', label: "Yes, I'll log it" },
                { id: 'no', label: 'Not now' },
              ]}
              value={logTemp}
              onChange={(v) => setLogTemp(v as 'yes' | 'no')}
            />
          </>
        )}

        {step === 'result' && (
          <>
            <Ionicons name="checkmark-circle" size={40} color={Colors.ok} style={styles.icon} />
            <Text style={styles.title}>All set</Text>
            {advice ? (
              <View
                style={[
                  styles.adviceCard,
                  advice.level !== 'keep_trying' && { borderColor: withAlpha(Colors.attention, 0.6) },
                ]}
              >
                <Text style={styles.adviceTitle}>{advice.title}</Text>
                <Text style={styles.adviceBody}>{advice.body}</Text>
                {advice.tips.map((t) => (
                  <View key={t} style={styles.tipRow}>
                    <Ionicons name="ellipse" size={6} color={Colors.textMuted} style={{ marginTop: 7 }} />
                    <Text style={styles.tipText}>{t}</Text>
                  </View>
                ))}
                {advice.level !== 'keep_trying' && (
                  <TouchableOpacity
                    style={styles.secondaryCta}
                    onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}
                  >
                    <Text style={styles.secondaryCtaText}>Find a gynaecologist or fertility specialist</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.subtitle}>
                {goal === 'symptoms'
                  ? 'Log how you feel through the month and we will show you patterns by cycle phase.'
                  : goal === 'perimenopause'
                    ? 'We will keep an eye on changes in your cycle length and symptoms over time.'
                    : 'We will predict your next period and your fertile days from what you log.'}
              </Text>
            )}
            <Text style={styles.disclaimer}>
              Kuova is not a contraceptive method and does not diagnose fertility problems. Guidance based on ASRM and
              NICE fertility guidelines.
            </Text>
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.cta, !canContinue && styles.ctaDisabled]} onPress={next} disabled={!canContinue}>
        <Text style={styles.ctaText}>{step === 'result' ? 'Done' : 'Continue'}</Text>
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
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  adviceCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 8,
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
