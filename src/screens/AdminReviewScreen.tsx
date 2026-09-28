import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import {
  adminListProfessionals,
  adminReviewProfessional,
  MODALITIES,
  ProfessionalAccount,
  roleLabel,
} from '@/data/sharing';

// Panel de HomeTest: verificar profesionales y aprobar/rechazar su tarifa.
// Solo funciona para admins (la base de datos lo comprueba en cada llamada).
export const AdminReviewScreen = () => {
  const [pros, setPros] = useState<ProfessionalAccount[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setPros(await adminListProfessionals());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load professionals');
    }
  }, []);

  useReloadOnFocus(load);

  const review = async (id: string, decision: { verified?: boolean; rate?: 'approve' | 'reject' }) => {
    setBusyId(id);
    try {
      await adminReviewProfessional(id, { ...decision, note: notes[id]?.trim() || undefined });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review');
    } finally {
      setBusyId(null);
    }
  };

  const pending = (pros ?? []).filter((p) => !p.verified || p.rateStatus === 'pending');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Professionals review" showBack />
        <Text style={styles.summary}>
          {pros ? `${pros.length} professionals · ${pending.length} need your review` : ' '}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!pros && !error ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} /> : null}

        {(pros ?? []).map((p) => {
          const busy = busyId === p.id;
          return (
            <View key={p.id} style={styles.card}>
              <View style={styles.header}>
                {p.photoUrl ? (
                  <Image source={{ uri: p.photoUrl }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]}>
                    <Ionicons name="person" size={22} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.displayName}</Text>
                  <Text style={styles.meta}>
                    {roleLabel(p.role)}
                    {p.specialty ? ` · ${p.specialty}` : ''}
                    {p.city ? ` · ${p.city}` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: p.verified ? Colors.accentSoft : 'rgba(240, 184, 77, 0.15)' }]}>
                  <Text style={[styles.badgeText, { color: p.verified ? Colors.accent : Colors.warning }]}>
                    {p.verified ? 'Verified' : 'Unverified'}
                  </Text>
                </View>
              </View>

              <Text style={styles.detail}>
                Nº colegiado: <Text style={styles.detailStrong}>{p.licenseNumber || '—'}</Text>
                {p.licenseCollege ? ` · ${p.licenseCollege}` : ''}
              </Text>
              <Text style={styles.detail}>
                {p.yearsExperience != null ? `${p.yearsExperience} years · ` : ''}
                {p.languages.join(', ') || 'No languages'} ·{' '}
                {p.modalities.map((m) => MODALITIES.find((x) => x.id === m)?.label ?? m).join(', ') || 'No modality'}
              </Text>
              {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}

              <View style={styles.rateBox}>
                <Text style={styles.detail}>
                  Proposed rate:{' '}
                  <Text style={styles.detailStrong}>
                    {p.hourlyRateRequestedEur != null ? `€${p.hourlyRateRequestedEur}/h` : '—'}
                  </Text>
                  {'  ·  '}Approved:{' '}
                  <Text style={styles.detailStrong}>{p.hourlyRateEur != null ? `€${p.hourlyRateEur}/h` : '—'}</Text>
                </Text>
                <Text style={[styles.detail, { color: p.rateStatus === 'pending' ? Colors.warning : Colors.textSecondary }]}>
                  Rate status: {p.rateStatus}
                </Text>
              </View>

              <TextInput
                style={styles.noteInput}
                placeholder="Note to the professional (optional)"
                placeholderTextColor={Colors.textMuted}
                value={notes[p.id] ?? ''}
                onChangeText={(t) => setNotes((prev) => ({ ...prev, [p.id]: t }))}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.action, p.verified ? styles.actionNeutral : styles.actionPrimary]}
                  disabled={busy}
                  onPress={() => review(p.id, { verified: !p.verified })}
                >
                  <Text style={[styles.actionText, !p.verified && { color: Colors.background }]}>
                    {p.verified ? 'Remove verification' : 'Verify'}
                  </Text>
                </TouchableOpacity>
                {p.rateStatus === 'pending' && (
                  <>
                    <TouchableOpacity style={[styles.action, styles.actionPrimary]} disabled={busy} onPress={() => review(p.id, { rate: 'approve' })}>
                      <Text style={[styles.actionText, { color: Colors.background }]}>Approve rate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.action, styles.actionDanger]} disabled={busy} onPress={() => review(p.id, { rate: 'reject' })}>
                      <Text style={styles.actionText}>Reject rate</Text>
                    </TouchableOpacity>
                  </>
                )}
                {busy ? <ActivityIndicator color={Colors.accent} /> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  summary: { color: Colors.textSecondary, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoEmpty: { backgroundColor: Colors.divider, justifyContent: 'center', alignItems: 'center' },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  detail: { color: Colors.textSecondary, fontSize: 13 },
  detailStrong: { color: Colors.textPrimary, fontWeight: '700' },
  bio: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  rateBox: { backgroundColor: Colors.backgroundElevated, borderRadius: 10, padding: 10, gap: 4, marginTop: 4 },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.textPrimary,
    fontSize: 13,
    marginTop: 4,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  action: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  actionPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionNeutral: { backgroundColor: Colors.card },
  actionDanger: { backgroundColor: Colors.dangerSoft, borderColor: Colors.danger },
  actionText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
});
