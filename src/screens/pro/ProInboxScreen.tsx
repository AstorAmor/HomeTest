import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout } from '@/components/pro/ProLayout';
import { RequestsPanel } from '@/components/pro/PatientPanels';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import { ConsultRequest, Conversation } from '@/data/specialistTypes';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

// Bandeja del especialista: solicitudes de los pacientes y chats abiertos.
export const ProInboxScreen = () => {
  const router = useRouter();
  const [tab, setTab] = useState<'requests' | 'chats'>('requests');
  const [requests, setRequests] = useDeepState<ConsultRequest[]>([]);
  const [convs, setConvs] = useDeepState<Conversation[]>([]);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([portal.listRequests(), portal.listConversations()]);
    setRequests(r);
    setConvs(c);
  }, [setRequests, setConvs]);
  useReloadOnFocus(load);

  const open = requests.filter((r) => r.status === 'open').length;

  return (
    <ProLayout active="inbox" title="Inbox" badge={{ inbox: open }}>
      <View style={styles.tabs}>
        {(['requests', 'chats'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: Colors.background }]}>
              {t === 'requests' ? `Requests${open ? ` · ${open}` : ''}` : `Chats · ${convs.length}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'requests' ? (
        <View style={{ gap: 14 }}>
          {requests.length === 0 && <Text style={styles.muted}>No requests yet.</Text>}
          {Object.entries(
            requests.reduce<Record<string, ConsultRequest[]>>((acc, r) => {
              (acc[r.patientId] ??= []).push(r);
              return acc;
            }, {}),
          ).map(([pid, list]) => (
            <View key={pid} style={styles.group}>
              <TouchableOpacity style={styles.groupHead} onPress={() => router.push({ pathname: '/pro-patient', params: { id: pid } })}>
                <Text style={styles.groupName}>{list[0].patientName}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <RequestsPanel requests={list} onAnswered={load} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {convs.length === 0 && <Text style={styles.muted}>No chats yet. Patients can write to you when chat is on (Profile → Channels).</Text>}
          {convs.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.conv}
              onPress={() => router.push({ pathname: '/chat', params: { conversation: c.id, title: c.patientName, side: 'pro' } })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.patientName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.convName}>{c.patientName}</Text>
                <Text style={styles.muted}>
                  {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No messages yet'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  tabOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  group: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  conv: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.accent, fontWeight: '800' },
  convName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
