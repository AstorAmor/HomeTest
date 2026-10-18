import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { gutSafetyStore } from '@/data/digestionRepository';
import { ageFromDob, profileRepository } from '@/data/profileRepository';
import { SafetyQuestionId } from '@/types/digestion';
import { t } from '@/i18n';
import { logScreenStyles } from './LogBowelScreen';

// Señales de alarma antes de sugerir ninguna prueba: cualquier "sí" manda al médico en vez de a un
// test (src/logic/gutPatterns.ts). Basadas en NICE NG12 y CG184, ACG/CAG 2017 (dispepsia) y la
// guía británica de colon irritable (BSG 2021). Se vuelven a preguntar cada 3 meses.
// SUPUESTO (revisión clínica): el texto de cada pregunta y el 5 % de peso.
const QUESTIONS: { id: SafetyQuestionId; text: string; onlyFrom50?: boolean }[] = [
  { id: 'weight_loss', text: 'Have you lost weight without trying in the last 6–12 months (about 5% or more)?' },
  { id: 'blood', text: 'Have you seen blood in your stools, or black stools?' },
  { id: 'anaemia', text: 'Have you been told you have anaemia or low iron?' },
  { id: 'night', text: 'Does pain or diarrhoea wake you up at night?' },
  { id: 'swallow_vomit', text: 'Does food get stuck when you swallow, or do you vomit often?' },
  { id: 'onset_after_50', text: 'Did these symptoms start after you turned 50?', onlyFrom50: true },
  { id: 'family', text: 'Has a parent, brother, sister or child had bowel cancer or coeliac disease?' },
];

export const GutSafetyScreen = () => {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<SafetyQuestionId, boolean>>>({});
  const [age, setAge] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    profileRepository
      .get()
      .then((p) => setAge(ageFromDob(p.dateOfBirth)))
      .catch(() => undefined);
    gutSafetyStore.get().then((s) => s && setAnswers(s.answers));
  }, []);

  // Sin edad en el perfil, se pregunta también lo de los 50
  const questions = QUESTIONS.filter((q) => !q.onlyFrom50 || age == null || age >= 50);
  const complete = questions.every((q) => answers[q.id] !== undefined);

  const save = async () => {
    if (!complete) return;
    setSaving(true);
    try {
      const kept = Object.fromEntries(questions.map((q) => [q.id, answers[q.id]]));
      await gutSafetyStore.save({ answeredAt: new Date().toISOString(), answers: kept });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, complete && styles.circleButtonActive]} onPress={save} disabled={saving || !complete}>
          <Ionicons name="checkmark" size={22} color={complete ? Colors.background : Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="shield-checkmark-outline" size={26} color={Colors.green} />
          </View>
          <Text style={styles.title}>{t('Before any test')}</Text>
          <Text style={styles.subtitle}>
            {t('Some signs need a doctor rather than a test. If you answer yes to any, we will tell you to see one first. We ask again every 3 months.')}
          </Text>
        </View>
        {questions.map((q) => (
          <View key={q.id} style={styles.question}>
            <Text style={styles.questionText}>{t(q.text)}</Text>
            <ChoiceChips
              options={[
                { id: 'no', label: t('No') },
                { id: 'yes', label: t('Yes') },
              ]}
              value={answers[q.id] === undefined ? undefined : answers[q.id] ? 'yes' : 'no'}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v === 'yes' }))}
            />
          </View>
        ))}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  question: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    gap: 10,
  },
  questionText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
