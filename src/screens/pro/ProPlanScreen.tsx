import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProLayout } from '@/components/pro/ProLayout';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import { PlanVersionItem } from '@/data/planVersions';
import { draftActionsForMarkers } from '@/utils/planUpdate';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

import { t } from '@/i18n';
// "Generar plan de acción": borrador a partir de los valores fuera de rango del
// paciente; el especialista edita las recomendaciones y lo envía. Kuova no emite
// recetas: si hace falta una, el médico la hace fuera (su plataforma o papel).
// El paciente lo recibe como nueva versión de su plan ("Updated by your specialist").
export const ProPlanScreen = () => {
  const router = useRouter();
  const { patient: patientId } = useLocalSearchParams<{ patient: string }>();
  const [name, setName] = useState('');
  const [items, setItems] = useState<PlanVersionItem[]>([]);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useReloadOnFocus(
    useCallback(async () => {
      const [patients, lab] = await Promise.all([portal.listPatients(), portal.patientLab(patientId).catch(() => null)]);
      setName(patients.find((p) => p.id === patientId)?.name ?? t('Patient'));
      if (items.length === 0 && lab) {
        setItems(draftActionsForMarkers(lab.markers.filter((m) => m.status !== 'in')));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]),
  );

  const update = (i: number, patch: Partial<PlanVersionItem>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const send = async () => {
    const clean = items.filter((i) => i.title.trim());
    if (clean.length === 0) {
      setError(t('Add at least one recommendation.'));
      setState('error');
      return;
    }
    setState('saving');
    setError('');
    try {
      await portal.createActionPlan(patientId, clean, note.trim());
      setState('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not send the plan'));
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <ProLayout active="patients" title={t('Action plan')}>
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={56} color={Colors.ok} />
          <Text style={styles.doneTitle}>Plan sent to {name}</Text>
          <Text style={styles.muted}>{t('It appears in their app as their current plan, marked “Updated by your specialist”.')}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.replace({ pathname: '/pro-patient', params: { id: patientId } })}>
            <Text style={styles.primaryText}>Back to {name}</Text>
          </TouchableOpacity>
        </View>
      </ProLayout>
    );
  }

  return (
    <ProLayout
      active="patients"
      title={`${t('Action plan')} · ${name}`}
      right={
        <TouchableOpacity style={styles.send} onPress={send} disabled={state === 'saving'}>
          {state === 'saving' ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.sendText}>{t('Send to patient')}</Text>}
        </TouchableOpacity>
      }
    >
      <Text style={styles.intro}>{t('Draft built from the values out of range. Edit, remove or add recommendations before sending.')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>{t('Recommendations')}</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHead}>
            <TextInput style={styles.title} value={it.title} onChangeText={(t) => update(i, { title: t })} placeholder={t('Recommendation')} placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity onPress={() => setItems((prev) => prev.filter((_, j) => j !== i))} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TextInput style={styles.input} multiline value={it.why} onChangeText={(t) => update(i, { why: t })} placeholder={t('What to do and why')} placeholderTextColor={Colors.textMuted} />
          {it.note ? <Text style={styles.based}>{t('Based on: {what}', { what: it.note })}</Text> : null}
        </View>
      ))}
      <TouchableOpacity style={styles.add} onPress={() => setItems((prev) => [...prev, { title: '', why: '', markers: [], status: 'new' }])}>
        <Ionicons name="add" size={18} color={Colors.accent} />
        <Text style={styles.addText}>{t('Add recommendation')}</Text>
      </TouchableOpacity>

      <Text style={styles.section}>{t('Note to the patient')}</Text>
      <TextInput style={[styles.input, { minHeight: 80 }]} multiline value={note} onChangeText={setNote} placeholder={t('A few words in plain language')} placeholderTextColor={Colors.textMuted} />
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  intro: { color: Colors.textSecondary, fontSize: 13, marginBottom: 8 },
  muted: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 8 },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, marginBottom: 8, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '800', paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 14, minHeight: 56, textAlignVertical: 'top' },
  based: { color: Colors.textMuted, fontSize: 11 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  send: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  sendText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  done: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20 },
  doneTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  primary: { backgroundColor: Colors.accent, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  primaryText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
