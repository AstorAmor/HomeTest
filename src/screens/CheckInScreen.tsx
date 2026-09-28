import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { CheckInEntry, DayMoment, MOMENT_OPTIONS, MOOD_OPTIONS, Mood } from '@/types/checkIn';
import { checkInRepository, checkInSuggestions, suggestMoment, Suggestion } from '@/data/checkInRepository';

type QuestionId = 'sleep' | 'energy' | 'stress' | 'dayRating' | 'mood';

// Qué se pregunta según el momento del día (primera respuesta del check-in).
const QUESTIONS: Record<DayMoment, QuestionId[]> = {
  just_woke_up: ['sleep', 'energy', 'mood'],
  mid_day: ['energy', 'stress', 'mood'],
  winding_down: ['dayRating', 'energy', 'mood'],
};

const QUESTION_TEXT: Record<Exclude<QuestionId, 'mood'>, { title: string; labels: string[] }> = {
  sleep: { title: 'How did you sleep?', labels: ['Terrible', 'Poor', 'OK', 'Good', 'Great'] },
  energy: { title: "How's your energy level?", labels: ['Drained', 'Low', 'OK', 'Good', 'Full'] },
  stress: { title: 'How stressed do you feel?', labels: ['Not at all', 'A little', 'Some', 'Quite', 'Very'] },
  dayRating: { title: 'How was your day?', labels: ['Rough', 'Meh', 'OK', 'Good', 'Great'] },
};

const LevelScale = ({ value, onChange, labels }: { value?: number; onChange: (v: number) => void; labels: string[] }) => (
  <View style={styles.levelRow}>
    {labels.map((label, i) => {
      const level = i + 1;
      const filled = value !== undefined && level <= value;
      const selected = value === level;
      return (
        <TouchableOpacity key={label} style={styles.levelItem} onPress={() => onChange(level)} activeOpacity={0.8}>
          <View style={styles.levelBarWrap}>
            <View
              style={[
                styles.levelBar,
                { height: 18 + i * 12 },
                filled && { backgroundColor: Colors.accent, opacity: 0.45 + i * 0.13 },
              ]}
            />
          </View>
          <Text style={[styles.levelLabel, selected && styles.levelLabelSelected]}>{label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export const CheckInScreen = () => {
  const router = useRouter();
  const suggested = useMemo(() => suggestMoment(), []);
  const [moment, setMoment] = useState<DayMoment | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, number>>>({});
  const [mood, setMood] = useState<Mood>();
  const [note, setNote] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stage, setStage] = useState<'moment' | 'questions' | 'note' | 'done'>('moment');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const questions = moment ? QUESTIONS[moment] : [];
  const currentQuestion = questions[questionIndex];
  // Momento + 3 preguntas + nota (todas las variantes tienen 3 preguntas)
  const totalSteps = 1 + (questions.length || 3) + 1;
  const stepNumber =
    stage === 'moment' ? 1 : stage === 'questions' ? 2 + questionIndex : stage === 'note' ? totalSteps : totalSteps;

  const chooseMoment = (m: DayMoment) => {
    setMoment(m);
    setQuestionIndex(0);
    setStage('questions');
  };

  const goNext = () => {
    if (questionIndex < questions.length - 1) setQuestionIndex(questionIndex + 1);
    else setStage('note');
  };

  const goBack = () => {
    if (stage === 'questions' && questionIndex > 0) setQuestionIndex(questionIndex - 1);
    else if (stage === 'questions') setStage('moment');
    else if (stage === 'note') setStage('questions');
    else router.back();
  };

  const save = async () => {
    if (!moment) return;
    const now = new Date().toISOString();
    const entry: Omit<CheckInEntry, 'id' | 'createdAt'> = {
      fecha: now,
      moment,
      sleep: answers.sleep,
      energy: answers.energy,
      stress: answers.stress,
      dayRating: answers.dayRating,
      mood,
      note: note.trim() || undefined,
    };
    await checkInRepository.save({ ...entry, id: `checkin-${Date.now()}`, createdAt: now });
    setSuggestions(checkInSuggestions(entry));
    setStage('done');
  };

  const answered =
    currentQuestion === 'mood' ? !!mood : currentQuestion ? answers[currentQuestion] !== undefined : false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        {stage !== 'done' ? (
          <TouchableOpacity onPress={goBack} hitSlop={12}>
            <Ionicons name={stage === 'moment' ? 'close' : 'chevron-back'} size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.topTitle}>Check in</Text>
        <Text style={styles.stepCount}>{stage !== 'done' ? `${stepNumber}/${totalSteps}` : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {stage === 'moment' && (
          <>
            <Text style={styles.title}>What does your day look like?</Text>
            <Text style={styles.subtitle}>We'll adapt the questions to the moment.</Text>
            <View style={styles.optionList}>
              {MOMENT_OPTIONS.map((o) => (
                <TouchableOpacity key={o.id} style={styles.option} onPress={() => chooseMoment(o.id)} activeOpacity={0.85}>
                  <View style={styles.optionIcon}>
                    <Ionicons name={o.icon as any} size={22} color={Colors.accent} />
                  </View>
                  <Text style={styles.optionText}>{o.label}</Text>
                  {o.id === suggested && <Text style={styles.suggestedTag}>Suggested</Text>}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              Suggested from the time of day. With a connected wearable we'll also use your wake-up time.
            </Text>
          </>
        )}

        {stage === 'questions' && currentQuestion && currentQuestion !== 'mood' && (
          <>
            <Text style={styles.title}>{QUESTION_TEXT[currentQuestion].title}</Text>
            <LevelScale
              value={answers[currentQuestion]}
              labels={QUESTION_TEXT[currentQuestion].labels}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [currentQuestion]: v }))}
            />
          </>
        )}

        {stage === 'questions' && currentQuestion === 'mood' && (
          <>
            <Text style={styles.title}>How are you feeling?</Text>
            <View style={styles.moodGrid}>
              {MOOD_OPTIONS.map((m) => {
                const selected = mood === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.moodItem, selected && styles.moodItemSelected]}
                    onPress={() => setMood(m.id)}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, selected && { color: Colors.textPrimary }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {stage === 'note' && (
          <>
            <Text style={styles.title}>Anything else?</Text>
            <Text style={styles.subtitle}>Optional. A few words about how you feel or what's going on.</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Big presentation today, slept badly…"
              placeholderTextColor={Colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </>
        )}

        {stage === 'done' && (
          <>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={34} color={Colors.background} />
            </View>
            <Text style={[styles.title, { textAlign: 'center' }]}>Checked in</Text>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              Here are a few ideas for right now. All optional.
            </Text>
            <View style={styles.optionList}>
              {suggestions.map((s) => {
                const isAccepted = accepted.has(s.id);
                return (
                  <View key={s.id} style={styles.suggestion}>
                    <View style={styles.optionIcon}>
                      <Ionicons name={s.icon as any} size={22} color={Colors.violet} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{s.title}</Text>
                      <Text style={styles.suggestionSubtitle}>
                        {s.minutes} min · {s.subtitle}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.startButton, isAccepted && styles.startButtonDone]}
                      onPress={() => {
                        setAccepted((prev) => new Set(prev).add(s.id));
                        router.push({ pathname: '/exercise', params: { id: s.id } });
                      }}
                    >
                      <Text style={[styles.startText, isAccepted && { color: Colors.accent }]}>
                        {isAccepted ? 'Again' : 'Start'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {stage === 'questions' && (
        <TouchableOpacity style={[styles.cta, !answered && styles.ctaDisabled]} onPress={goNext} disabled={!answered}>
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
      )}
      {stage === 'note' && (
        <TouchableOpacity style={styles.cta} onPress={save}>
          <Text style={styles.ctaText}>{note.trim() ? 'Save check-in' : 'Skip and save'}</Text>
        </TouchableOpacity>
      )}
      {stage === 'done' && (
        <TouchableOpacity style={styles.cta} onPress={() => router.back()}>
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  stepCount: {
    color: Colors.textMuted,
    fontSize: 13,
    width: 24,
    textAlign: 'right',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 28,
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
    marginBottom: 24,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 16,
  },
  optionList: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  suggestedTag: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(62, 205, 184, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 36,
  },
  levelItem: {
    alignItems: 'center',
    flex: 1,
  },
  levelBarWrap: {
    height: 70,
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  levelBar: {
    width: 34,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  levelLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  levelLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  moodItem: {
    width: '30.5%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 14,
  },
  moodItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(62, 205, 184, 0.08)',
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  noteInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  suggestionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  suggestionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  startButton: {
    backgroundColor: Colors.violetSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startButtonDone: {
    backgroundColor: Colors.accentSoft,
  },
  startText: {
    color: Colors.violet,
    fontSize: 13,
    fontWeight: '700',
  },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaDisabled: {
    backgroundColor: Colors.cardBorder,
  },
  ctaText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
