import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { CheckInEntry, DayMoment, MOMENT_OPTIONS, MOOD_OPTIONS, Mood } from '@/types/checkIn';
import { checkInRepository, checkInSuggestions, suggestMoment, Suggestion } from '@/data/checkInRepository';

type QuestionId = 'sleep' | 'energy' | 'stress' | 'dayRating' | 'mood';
type ScaleId = Exclude<QuestionId, 'mood'>;

// Qué se pregunta según el momento del día (primera respuesta del check-in).
const QUESTIONS: Record<DayMoment, QuestionId[]> = {
  just_woke_up: ['sleep', 'energy', 'mood'],
  mid_day: ['energy', 'stress', 'mood'],
  winding_down: ['dayRating', 'energy', 'mood'],
};

const QUESTION_TEXT: Record<ScaleId, { title: string; labels: string[] }> = {
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

// Todo el check-in en una sola pantalla: momento del día (preseleccionado el
// sugerido), las preguntas de ese momento, el ánimo y una nota opcional.
export const CheckInScreen = () => {
  const router = useRouter();
  const suggested = useMemo(() => suggestMoment(), []);
  const [moment, setMoment] = useState<DayMoment>(suggested);
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, number>>>({});
  const [mood, setMood] = useState<Mood>();
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const scales = QUESTIONS[moment].filter((q): q is ScaleId => q !== 'mood');
  const complete = !!mood && scales.every((q) => answers[q] !== undefined);

  const save = async () => {
    if (!complete) return;
    const now = new Date().toISOString();
    // Solo se guardan las respuestas de las preguntas del momento elegido.
    const pick = (q: ScaleId) => (scales.includes(q) ? answers[q] : undefined);
    const entry: Omit<CheckInEntry, 'id' | 'createdAt'> = {
      fecha: now,
      moment,
      sleep: pick('sleep'),
      energy: pick('energy'),
      stress: pick('stress'),
      dayRating: pick('dayRating'),
      mood,
      note: note.trim() || undefined,
    };
    await checkInRepository.save({ ...entry, id: `checkin-${Date.now()}`, createdAt: now });
    setSuggestions(checkInSuggestions(entry));
    setDone(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        {!done ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.topTitle}>Check in</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!done && (
          <>
            <Text style={styles.question}>What does your day look like?</Text>
            <View style={styles.momentRow}>
              {MOMENT_OPTIONS.map((o) => {
                const selected = moment === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.momentChip, selected && styles.momentChipSelected]}
                    onPress={() => setMoment(o.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={o.icon as any} size={18} color={selected ? Colors.accent : Colors.textSecondary} />
                    <Text style={[styles.momentText, selected && { color: Colors.textPrimary }]} numberOfLines={2}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {moment === suggested && <Text style={styles.hint}>Suggested from the time of day.</Text>}

            {scales.map((q) => (
              <View key={q} style={styles.block}>
                <Text style={styles.question}>{QUESTION_TEXT[q].title}</Text>
                <LevelScale
                  value={answers[q]}
                  labels={QUESTION_TEXT[q].labels}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q]: v }))}
                />
              </View>
            ))}

            <View style={styles.block}>
              <Text style={styles.question}>How are you feeling?</Text>
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
            </View>

            <View style={styles.block}>
              <Text style={styles.question}>Anything else? (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Big presentation today, slept badly…"
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>
          </>
        )}

        {done && (
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
                      <Ionicons name={s.icon as any} size={22} color={Colors.green} />
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

      {!done ? (
        <TouchableOpacity style={[styles.cta, !complete && styles.ctaDisabled]} onPress={save} disabled={!complete}>
          <Text style={styles.ctaText}>Save check-in</Text>
        </TouchableOpacity>
      ) : (
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
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  block: {
    marginTop: 28,
  },
  question: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  momentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  momentChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  momentChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: withAlpha(Colors.accent, 0.08),
  },
  momentText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
    marginTop: 8,
  },
  optionList: {
    gap: 12,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
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
    backgroundColor: withAlpha(Colors.accent, 0.08),
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
    minHeight: 90,
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
    backgroundColor: withAlpha(Colors.green, 0.14),
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  startButtonDone: {
    backgroundColor: Colors.accentSoft,
  },
  startText: {
    color: Colors.green,
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
