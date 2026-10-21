import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { MacroDonut } from '@/components/diet/MacroDonut';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import type { PatientSummary } from '@/data/specialistTypes';
import type { DietPlan } from '@/data/diet/types';
import { weekSummary } from '@/logic/dietPlanner';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, num, t } from '@/i18n';

// Portal → Dietas (como Entrenamientos): los menús que has mandado, con sus kcal y macros, y crear uno
// nuevo para un paciente. Se edita en ProDietScreen (?from=diets para volver aquí).

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export const ProDietsScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const [diets, setDiets] = useState<DietPlan[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [picking, setPicking] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      const [d, p] = await Promise.all([portal.listDiets().catch(() => []), portal.listPatients().catch(() => [])]);
      setDiets(d);
      setPatients(p);
    }, []),
  );

  const nameOf = (id?: string | null) => patients.find((p) => p.id === id)?.name ?? t('Patient');
  const open = (patientId: string) => router.push({ pathname: '/pro-diet', params: { patient: patientId, from: 'diets' } });

  return (
    <ProLayout
      active="diets"
      title={t('Diets')}
      right={
        <TouchableOpacity style={styles.newBtn} onPress={() => setPicking((v) => !v)}>
          <Ionicons name="add" size={16} color={Colors.background} />
          <Text style={styles.newText}>{t('New menu')}</Text>
        </TouchableOpacity>
      }
    >
      {picking && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Who is it for?')}</Text>
          <View style={styles.patients}>
            {patients.map((p) => (
              <TouchableOpacity key={p.id} style={styles.patient} onPress={() => open(p.id)}>
                <Text style={styles.patientName}>{p.name}</Text>
                {p.goals?.length ? <Text style={styles.muted}>{p.goals.join(', ')}</Text> : null}
              </TouchableOpacity>
            ))}
            {patients.length === 0 && <Text style={styles.muted}>{t('You have no patients yet.')}</Text>}
          </View>
        </View>
      )}

      <Text style={styles.section}>{t('Menus you have sent')}</Text>
      {diets.length === 0 ? (
        <Text style={styles.muted}>{t('None yet. Create one from here or from a patient’s page.')}</Text>
      ) : (
        <View style={[styles.list, wide && styles.listWide]}>
          {diets.map((d) => {
            const s = weekSummary(d.days);
            return (
              <TouchableOpacity key={d.id} style={[styles.card, wide && styles.cardWide]} onPress={() => d.patientId && open(d.patientId)}>
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.badge}>{nameOf(d.patientId)}</Text>
                    <Text style={styles.cardTitle}>
                      {t('Target')}: {num(d.targets.kcal)} kcal · {d.targets.protein} g {t('protein')}
                      {d.targets.carbs != null ? ` · ${d.targets.carbs} g ${t('carbs')}` : ''}
                      {d.targets.fat != null ? ` · ${d.targets.fat} g ${t('fat')}` : ''}
                    </Text>
                    <Text style={styles.muted}>
                      {t('sent {date}', { date: dayMonth(d.createdAt) })}
                      {d.active ? '' : ` · ${t('replaced')}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
                {/* Lo que trae el menú de media al día */}
                <View style={styles.donut}>
                  <MacroDonut m={s} size={64} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  donut: { marginTop: 8 },
  cardWide: { width: '49%' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  patients: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  patient: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 160 },
  patientName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
