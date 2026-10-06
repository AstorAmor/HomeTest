import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { NotesPanel, RequestsPanel, ResultsPanel } from '@/components/pro/PatientPanels';
import { Colors, withAlpha } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import { ConsultRequest, PatientLabResult, PatientSummary } from '@/data/specialistTypes';
import { scopeLabel } from '@/data/sharing';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

type Tab = 'results' | 'notes' | 'requests';

const notify = (title: string, body: string) => (Platform.OS === 'web' ? window.alert(`${title}\n\n${body}`) : Alert.alert(title, body));

// Ficha del paciente: datos generales, acciones directas y pestañas
// (resultados · notas privadas · mensajes y solicitudes).
export const ProPatientDetailScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [patient, setPatient] = useDeepState<PatientSummary | null>(null);
  const [lab, setLab] = useDeepState<PatientLabResult | null>(null);
  const [requests, setRequests] = useDeepState<ConsultRequest[]>([]);
  const [tab, setTab] = useState<Tab>('results');

  const load = useCallback(async () => {
    const [all, l, reqs] = await Promise.all([portal.listPatients(), portal.patientLab(id).catch(() => null), portal.listRequests(id)]);
    setPatient(all.find((p) => p.id === id) ?? null);
    setLab(l);
    setRequests(reqs);
  }, [id, setPatient, setLab, setRequests]);
  useReloadOnFocus(load);

  if (!patient) return <ProLayout active="patients" title="Patient">{null}</ProLayout>;

  const openChat = async () => {
    try {
      const conv = await portal.conversationWith(patient.id, patient.name);
      router.push({ pathname: '/chat', params: { conversation: conv, title: patient.name, side: 'pro' } });
    } catch {
      notify('Chat is off', 'Turn on chat in Profile → Channels to message your patients.');
    }
  };

  const actions: { icon: string; label: string; onPress: () => void; primary?: boolean }[] = [
    { icon: 'call-outline', label: 'Call', onPress: () => router.push({ pathname: '/pro-room', params: { patient: patient.id, mode: 'voice' } }) },
    { icon: 'videocam-outline', label: 'Video call', onPress: () => router.push({ pathname: '/pro-room', params: { patient: patient.id, mode: 'video' } }) },
    { icon: 'chatbubble-outline', label: 'Message', onPress: openChat },
    { icon: 'mail-outline', label: 'Email', onPress: () => notify('Email', "The patient hasn't shared an email address. Use Message: it stays inside Kuova and is encrypted in transit.") },
    { icon: 'film-outline', label: 'Video explanation', onPress: () => notify('Video explanation', 'Prototype: you will be able to record a short video (up to 3 min) explaining the results, and the patient will get it in their app.') },
    { icon: 'sparkles-outline', label: 'Generate action plan', onPress: () => router.push({ pathname: '/pro-plan', params: { patient: patient.id } }), primary: true },
  ];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'results', label: 'Biomarkers & results', count: lab ? lab.markers.filter((m) => m.status !== 'in').length : 0 },
    { id: 'notes', label: 'History & notes' },
    { id: 'requests', label: 'Messages & requests', count: requests.filter((r) => r.status === 'open').length },
  ];

  return (
    <ProLayout
      active="patients"
      title={patient.name}
      right={
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/pro-patients'))}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      }
    >
      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{patient.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.sub}>{[patient.age ? `${patient.age} years` : null, patient.sex].filter(Boolean).join(' · ') || 'Patient'}</Text>
          {patient.goals?.length ? <Text style={styles.sub}>Goals: {patient.goals.join(', ')}</Text> : null}
          <Text style={styles.scopes}>
            {patient.scopes.length ? `Shares with you: ${patient.scopes.map(scopeLabel).join(', ')}` : 'Has not shared data with you yet'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {actions.map((a) => (
          <TouchableOpacity key={a.label} style={[styles.action, a.primary && styles.actionPrimary]} onPress={a.onPress}>
            <Ionicons name={a.icon as any} size={18} color={a.primary ? Colors.background : Colors.accent} />
            <Text style={[styles.actionText, a.primary && { color: Colors.background }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, tab === t.id && styles.tabOn]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabText, tab === t.id && { color: Colors.textPrimary }]}>{t.label}</Text>
            {!!t.count && <Text style={styles.tabCount}>{t.count}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.panel}>
        {tab === 'results' && <ResultsPanel lab={lab} />}
        {tab === 'notes' && <NotesPanel patientId={patient.id} />}
        {tab === 'requests' && (
          <View style={{ gap: 12 }}>
            <TouchableOpacity style={styles.chatLink} onPress={openChat}>
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent} />
              <Text style={styles.chatLinkText}>
                Open chat{patient.unreadMessages ? ` · ${patient.unreadMessages} new` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <RequestsPanel requests={requests} onAnswered={load} />
          </View>
        )}
      </View>
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 },
  heroWide: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.accent, fontSize: 22, fontWeight: '900' },
  sub: { color: Colors.textSecondary, fontSize: 13 },
  scopes: { color: Colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.5), borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  actionPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  tabOn: { borderColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabCount: { color: Colors.background, backgroundColor: Colors.attention, fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  panel: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14 },
  chatLink: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: 12, padding: 12 },
  chatLinkText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
});
