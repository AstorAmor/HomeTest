import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { consult } from '@/data/consultations';
import { Appointment, KIND_LABEL } from '@/data/specialistTypes';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Today: la próxima consulta con un especialista, con "Join video" cuando está confirmada.
export const NextConsultationCard = () => {
  const router = useRouter();
  const [next, setNext] = useState<Appointment | null>(null);

  useReloadOnFocus(
    useCallback(async () => {
      const all = await consult.myAppointments().catch(() => []);
      const soon = all
        .filter((a) => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.startsAt).getTime() + a.durationMin * 60000 > Date.now())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      setNext(soon[0] ?? null);
    }, []),
  );

  if (!next) return null;
  const real = /^[0-9a-f-]{36}$/i.test(next.id);
  const canJoin = real && next.status === 'confirmed';

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name={next.modality === 'video' ? 'videocam' : 'call'} size={20} color={Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {KIND_LABEL[next.kind]}
          {next.professionalName ? ` with ${next.professionalName}` : ''}
        </Text>
        <Text style={styles.sub}>
          {when(next.startsAt)} · {next.status === 'confirmed' ? 'Confirmed' : 'Waiting for confirmation'}
        </Text>
      </View>
      {canJoin && (
        <TouchableOpacity
          style={styles.join}
          onPress={() => router.push({ pathname: '/video', params: { appt: next.id, title: next.professionalName ?? 'Video consultation' } })}
        >
          <Text style={styles.joinText}>Join</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  join: { backgroundColor: Colors.accent, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  joinText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
