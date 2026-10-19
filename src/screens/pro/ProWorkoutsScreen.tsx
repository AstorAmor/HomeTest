import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import { WorkoutModal } from '@/components/workouts/WorkoutModal';
import { ExerciseDetail } from '@/screens/workouts/ExerciseInfoScreen';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import type { PatientSummary } from '@/data/specialistTypes';
import { exerciseName } from '@/data/workouts/catalog';
import { programFacts } from '@/data/workouts/labels';
import type { CatalogExercise, WorkoutProgram } from '@/data/workouts/types';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, t, tn } from '@/i18n';

// Portal → Entrenamientos: los programas que has mandado (y si tus pacientes los siguen), crear uno
// nuevo para un paciente y la biblioteca de ejercicios con su vídeo.

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export const ProWorkoutsScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<CatalogExercise | null>(null);

  useReloadOnFocus(
    useCallback(async () => {
      const [w, p] = await Promise.all([portal.listWorkouts().catch(() => []), portal.listPatients().catch(() => [])]);
      setPrograms(w);
      setPatients(p);
    }, []),
  );

  const nameOf = (id?: string | null) => patients.find((p) => p.id === id)?.name ?? t('Patient');

  return (
    <ProLayout
      active="workouts"
      title={t('Workouts')}
      right={
        <TouchableOpacity style={styles.newBtn} onPress={() => setPicking((v) => !v)}>
          <Ionicons name="add" size={16} color={Colors.background} />
          <Text style={styles.newText}>{t('New programme')}</Text>
        </TouchableOpacity>
      }
    >
      {picking && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Who is it for?')}</Text>
          <View style={styles.patients}>
            {patients.map((p) => (
              <TouchableOpacity key={p.id} style={styles.patient} onPress={() => router.push({ pathname: '/pro-workout', params: { patient: p.id } })}>
                <Text style={styles.patientName}>{p.name}</Text>
                {p.goals?.length ? <Text style={styles.muted}>{p.goals.join(', ')}</Text> : null}
              </TouchableOpacity>
            ))}
            {patients.length === 0 && <Text style={styles.muted}>{t('You have no patients yet.')}</Text>}
          </View>
        </View>
      )}

      <Text style={styles.section}>{t('Programmes you have sent')}</Text>
      {programs.length === 0 ? (
        <Text style={styles.muted}>{t('None yet. Create one from here or from a patient’s page.')}</Text>
      ) : (
        <View style={[styles.list, wide && styles.listWide]}>
          {programs.map((w) => {
            const last = [...w.completions].sort((a, b) => b.at.localeCompare(a.at))[0];
            return (
              <TouchableOpacity
                key={w.id}
                style={[styles.card, wide && styles.cardWide]}
                onPress={() => router.push({ pathname: '/pro-workout', params: { patient: w.patientId ?? '', program: w.id } })}
              >
                <Text style={styles.badge}>{nameOf(w.patientId)}</Text>
                <Text style={styles.cardTitle}>{w.title}</Text>
                <Text style={styles.muted}>
                  {[...programFacts(w), t('sent {date}', { date: dayMonth(w.createdAt) })].join(' · ')}
                </Text>
                <View style={styles.progressRow}>
                  <Ionicons name={w.completions.length ? 'checkmark-circle' : 'time-outline'} size={16} color={w.completions.length ? Colors.ok : Colors.textMuted} />
                  <Text style={styles.progressText}>
                    {w.completions.length
                      ? `${tn(w.completions.length, '{n} session done', '{n} sessions done')} · ${t('last {date}', { date: dayMonth(last.at) })}`
                      : t('Not started yet')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>{t('Exercise library')}</Text>
      <Text style={[styles.muted, { marginBottom: 10 }]}>{t('Provisional images: Kuova will replace them with its own videos.')}</Text>
      <ExerciseLibrary onOpen={setOpen} />

      <WorkoutModal visible={!!open} title={open ? exerciseName(open) : ''} onClose={() => setOpen(null)}>
        {open && <ExerciseDetail ex={open} onOpenSimilar={setOpen} />}
      </WorkoutModal>
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  newText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  list: { gap: 8 },
  listWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, gap: 4, marginBottom: 8 },
  cardWide: { width: '49%' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  progressText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  patients: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  patient: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 160 },
  patientName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
