import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CloseButton, FineButton, FineChips, measureStyles } from '@/components/fine/FineMeasure';
import { gutSafetyStore } from '@/data/digestionRepository';
import { ageFromDob, profileRepository } from '@/data/profileRepository';
import { showSamples } from '@/data/dataMode';
import { SAMPLE_PERSON } from '@/logic/bodyComposition';
import { safetyAnswersToSave, safetyComplete, safetyQuestionsFor } from '@/logic/gutSafety';
import { SafetyQuestionId } from '@/types/digestion';
import { t } from '@/i18n';
import { FINE, fine } from '@/theme/fine';

// Señales de alarma antes de sugerir ninguna prueba: cualquier «sí» manda al médico en vez de a un test
// (src/logic/gutPatterns.ts). Las preguntas y a quién se le hace cada una, en src/logic/gutSafety.ts: la de
// «¿empezaron después de cumplir los 50?» no sale si el perfil dice que tienes menos de 50 (fundador, 2026-11-17).
// Desde el 2026-11-17, en el lenguaje fino (como los demás registros): título con la × de cerrar, sin icono en
// círculo de color ni tarjetas, cada pregunta en una fila con línea fina y sus dos chips, y un solo botón de Guardar.
export const GutSafetyScreen = () => {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<SafetyQuestionId, boolean>>>({});
  // undefined = aún no se ha mirado el perfil: hasta entonces no se pinta ninguna pregunta, para que la de los 50
  // no salga y desaparezca. null = sin edad en el perfil (se pregunta también)
  const [age, setAge] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // La edad se fija una sola vez: si el perfil tarda (sin red), a los 3 s se pregunta todo, como sin edad, y ya
    // no se quita ninguna pregunta aunque el perfil llegue después
    let settled = false;
    const settle = (a: number | null) => {
      if (settled) return;
      settled = true;
      setAge(a);
    };
    const timer = setTimeout(() => settle(null), 3000);
    profileRepository
      .get()
      // En la demo y en las cuentas de prueba, sin fecha de nacimiento, la edad de la persona de ejemplo (la misma
      // de la composición corporal): así la demo no pregunta lo de los 50 a alguien de 38
      .then((p) => settle(ageFromDob(p.dateOfBirth) ?? (showSamples() && !p.dateOfBirth ? SAMPLE_PERSON.age : null)))
      .catch(() => settle(null))
      .finally(() => clearTimeout(timer));
    gutSafetyStore.get().then((s) => s && setAnswers(s.answers));
    return () => clearTimeout(timer);
  }, []);

  const questions = age === undefined ? [] : safetyQuestionsFor(age);
  const complete = age !== undefined && safetyComplete(answers, age);

  const save = async () => {
    if (!complete) return;
    setSaving(true);
    try {
      await gutSafetyStore.save({ answeredAt: new Date().toISOString(), answers: safetyAnswersToSave(answers, age) });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Before any test')} right={<CloseButton onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          {t('Some signs need a doctor rather than a test. If you answer yes to any, we will tell you to see one first. We ask again every 3 months.')}
        </Text>
        <View style={styles.list}>
          {questions.map((q, i) => (
            <View key={q.id} style={[styles.question, i === questions.length - 1 && styles.lastRow]}>
              <Text style={fine.body}>{t(q.text)}</Text>
              <FineChips
                options={[
                  { id: 'no', label: t('No') },
                  { id: 'yes', label: t('Yes') },
                ]}
                value={answers[q.id] === undefined ? undefined : answers[q.id] ? 'yes' : 'no'}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v === 'yes' }))}
              />
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={measureStyles.footer}>
        <FineButton label={t('Save')} onPress={save} disabled={saving || !complete} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  // Cada pregunta, una fila con línea fina y el «No · Sí» debajo
  list: { marginTop: 16, borderTopWidth: 1, borderTopColor: FINE.line },
  question: { paddingVertical: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lastRow: { borderBottomWidth: 0 },
});
