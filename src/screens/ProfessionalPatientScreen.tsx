import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { ageFromDob, GOAL_OPTIONS } from '@/data/profileRepository';
import { fetchSharedPatientData, PatientData, SHARE_SCOPES, ShareScope } from '@/data/sharing';

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const METRIC_LABEL: Record<string, string> = {
  cholesterol_total: 'Total cholesterol',
  cortisol: 'Cortisol',
  steps: 'Steps',
  resting_heart_rate: 'Resting HR',
  hrv: 'HRV',
  sleep_duration: 'Sleep (min)',
  active_energy: 'Active kcal',
  body_temperature: 'Temperature',
};

const Section = ({ scope, children }: { scope: ShareScope; children: React.ReactNode }) => {
  const info = SHARE_SCOPES.find((s) => s.id === scope)!;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={info.icon as any} size={18} color={Colors.accent} />
        <Text style={styles.sectionTitle}>{info.label}</Text>
      </View>
      {children}
    </View>
  );
};

const Empty = () => <Text style={styles.muted}>No data yet.</Text>;

// Profesional: datos de un paciente, SOLO LECTURA y solo las categorías compartidas
// (RLS en la base de datos lo garantiza aunque la app pidiera más).
export const ProfessionalPatientScreen = () => {
  const { patientId, name, scopes: scopesParam } = useLocalSearchParams<{
    patientId: string;
    name: string;
    scopes: string;
  }>();
  const scopes = (scopesParam ?? '').split(',').filter(Boolean) as ShareScope[];
  const [data, setData] = useState<PatientData | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await fetchSharedPatientData(patientId, scopes);
      setData(d);
      const paths = (d.meals ?? []).map((m: any) => m.photo_path).filter(Boolean).slice(0, 12);
      if (paths.length && supabase) {
        const { data: signed } = await supabase.storage.from('meal-photos').createSignedUrls(paths, 600);
        setPhotos(
          Object.fromEntries(
            (signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string])
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, scopesParam]);

  useReloadOnFocus(load);

  const asc = (rows: any[] | undefined, col: string) =>
    [...(rows ?? [])].sort((a, b) => String(a[col]).localeCompare(String(b[col])));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={name ?? 'Patient'} showBack />
        <View style={styles.readOnly}>
          <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.readOnlyText}>Read-only · only what the patient chose to share</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!data && !error ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} /> : null}

        {data && scopes.includes('profile') && (
          <Section scope="profile">
            {data.profile ? (
              <>
                <Text style={styles.row}>
                  {[
                    ageFromDob(data.profile.date_of_birth) != null ? `${ageFromDob(data.profile.date_of_birth)} y` : null,
                    data.profile.sex,
                    data.profile.height_cm ? `${data.profile.height_cm} cm` : null,
                    data.profile.weight_kg ? `${data.profile.weight_kg} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No profile details'}
                </Text>
                {data.profile.goals?.length ? (
                  <Text style={styles.rowMuted}>
                    Goals: {data.profile.goals.map((g: string) => GOAL_OPTIONS.find((o) => o.id === g)?.label ?? g).join(', ')}
                  </Text>
                ) : null}
              </>
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('lab_reports') && (
          <Section scope="lab_reports">
            {(data.lab_reports ?? []).length ? (
              data.lab_reports.map((r: any) => (
                <Text key={r.id} style={styles.row}>
                  {r.test_date ? longDate(r.test_date) : 'Undated'} · {r.lab_name ?? 'Lab report'}
                </Text>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('glucose') && (
          <Section scope="glucose">
            {(data.glucose_readings ?? []).length ? (
              <>
                <Text style={styles.latest}>
                  {data.glucose_readings[0].value} {data.glucose_readings[0].unit}
                  <Text style={styles.rowMuted}> · {longDate(data.glucose_readings[0].measured_at)}</Text>
                </Text>
                <TrendChart
                  height={90}
                  labels={asc(data.glucose_readings, 'measured_at').map((r) => shortDate(r.measured_at))}
                  series={[{ color: Colors.accent, values: asc(data.glucose_readings, 'measured_at').map((r) => Number(r.value)) }]}
                  band={{ low: 70, high: 99 }}
                />
              </>
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('blood_pressure') && (
          <Section scope="blood_pressure">
            {(data.blood_pressure_readings ?? []).length ? (
              <>
                <Text style={styles.latest}>
                  {data.blood_pressure_readings[0].systolic}/{data.blood_pressure_readings[0].diastolic} mmHg
                  <Text style={styles.rowMuted}> · {longDate(data.blood_pressure_readings[0].measured_at)}</Text>
                </Text>
                <TrendChart
                  height={100}
                  labels={asc(data.blood_pressure_readings, 'measured_at').map((r) => shortDate(r.measured_at))}
                  series={[
                    { label: 'Systolic', color: Colors.coral, values: asc(data.blood_pressure_readings, 'measured_at').map((r) => r.systolic) },
                    { label: 'Diastolic', color: Colors.sky, values: asc(data.blood_pressure_readings, 'measured_at').map((r) => r.diastolic) },
                  ]}
                />
              </>
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('metrics') && (
          <Section scope="metrics">
            {(data.metric_readings ?? []).length ? (
              Object.values(
                (data.metric_readings as any[]).reduce<Record<string, any>>((acc, r) => {
                  acc[r.kind] ??= r; // la primera es la más reciente
                  return acc;
                }, {})
              ).map((r: any) => (
                <Text key={r.kind} style={styles.row}>
                  {METRIC_LABEL[r.kind] ?? r.kind}: {r.value} {r.unit}
                  <Text style={styles.rowMuted}> · {longDate(r.measured_at)}</Text>
                </Text>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('cycle') && (
          <Section scope="cycle">
            {(data.cycle_starts ?? []).length ? (
              <Text style={styles.row}>
                Period starts: {data.cycle_starts.slice(0, 6).map((r: any) => shortDate(r.started_at)).join(', ')}
              </Text>
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('wellbeing') && (
          <Section scope="wellbeing">
            {(data.check_ins ?? []).length || (data.ai_logs ?? []).length ? (
              <>
                {(data.check_ins ?? []).slice(0, 7).map((c: any) => (
                  <Text key={c.id} style={styles.row}>
                    {shortDate(c.checked_in_at)} · energy {c.energy ?? '–'}/5
                    {c.sleep ? ` · sleep ${c.sleep}/5` : ''}
                    {c.mood ? ` · ${c.mood}` : ''}
                    {c.note ? <Text style={styles.rowMuted}> · “{c.note}”</Text> : null}
                  </Text>
                ))}
                {(data.ai_logs ?? []).slice(0, 5).map((l: any) => (
                  <Text key={l.id} style={styles.rowMuted}>
                    {shortDate(l.logged_at)} · {l.summary ?? l.quadrant}
                  </Text>
                ))}
              </>
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('activity') && (
          <Section scope="activity">
            {(data.workouts ?? []).length ? (
              data.workouts.slice(0, 10).map((w: any) => (
                <Text key={w.id} style={styles.row}>
                  {shortDate(w.performed_at)} · {w.type} · {w.minutes} min · {w.intensity}
                </Text>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('nutrition') && (
          <Section scope="nutrition">
            {(data.meals ?? []).length ? (
              data.meals.slice(0, 12).map((m: any) => (
                <View key={m.id} style={styles.mealRow}>
                  {m.photo_path && photos[m.photo_path] ? (
                    <Image source={{ uri: photos[m.photo_path] }} style={styles.mealPhoto} contentFit="cover" />
                  ) : (
                    <View style={[styles.mealPhoto, styles.mealPhotoEmpty]}>
                      <Ionicons name="restaurant-outline" size={16} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.row}>{m.description || m.meal_type}</Text>
                    <Text style={styles.rowMuted}>
                      {shortDate(m.eaten_at)} · {m.meal_type}
                      {m.added_sugar === true ? ' · added sugar' : m.added_sugar === false ? ' · no added sugar' : ''}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        )}

        {data && scopes.includes('wearables') && (
          <Section scope="wearables">
            {(data.wearable_daily ?? []).length ? (
              Object.values(
                (data.wearable_daily as any[]).reduce<Record<string, any>>((acc, r) => {
                  acc[r.metric] ??= r;
                  return acc;
                }, {})
              ).map((r: any) => (
                <Text key={r.metric} style={styles.row}>
                  {METRIC_LABEL[r.metric] ?? r.metric}: {Number(r.value)}
                  <Text style={styles.rowMuted}> · {shortDate(r.date)} · {r.source_name}</Text>
                </Text>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 14,
  },
  readOnlyText: { color: Colors.textSecondary, fontSize: 12 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20 },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 6,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  latest: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  row: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  rowMuted: { color: Colors.textSecondary, fontSize: 12, fontWeight: '400' },
  muted: { color: Colors.textMuted, fontSize: 13 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealPhoto: { width: 44, height: 44, borderRadius: 8 },
  mealPhotoEmpty: { backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center' },
});
