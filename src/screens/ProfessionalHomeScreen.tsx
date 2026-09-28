import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { CosmicBackground } from '@/components/CosmicBackground';
import { Image } from 'expo-image';
import { useAuth } from '@/context/AuthContext';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { listSharedPatients, roleLabel, scopeLabel, SharedPatient } from '@/data/sharing';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Inicio del profesional: pacientes que le han compartido datos.
export const ProfessionalHomeScreen = () => {
  const router = useRouter();
  const { professional, refreshProfessional, logout } = useAuth();
  const [patients, setPatients] = useState<SharedPatient[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    await refreshProfessional();
    try {
      setPatients(await listSharedPatients());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load patients');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useReloadOnFocus(load);

  if (!professional) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CosmicBackground />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {professional.photoUrl ? (
            <Image source={{ uri: professional.photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, styles.photoEmpty]}>
              <Ionicons name="person" size={26} color={Colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>HomeTest for professionals</Text>
            <Text style={styles.title}>{professional.displayName}</Text>
            <Text style={styles.subtitle}>
              {roleLabel(professional.role)}
              {professional.specialty ? ` · ${professional.specialty}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={logout} hitSlop={12} style={styles.logout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.editProfile} onPress={() => router.push('/pro-profile')} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={18} color={Colors.accent} />
          <Text style={styles.editProfileText}>
            {!professional.photoUrl || !professional.licenseNumber || professional.hourlyRateRequestedEur == null
              ? 'Complete your profile: photo, registration number and rate'
              : 'Edit your profile'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {!professional.verified && (
          <View style={styles.pending}>
            <Ionicons name="time-outline" size={20} color={Colors.warning} />
            <Text style={styles.pendingText}>
              Pending verification. HomeTest is checking your registration number
              {professional.licenseNumber ? ` (${professional.licenseNumber})` : ''}. Patients can share data with
              you once you are verified.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Your patients</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {patients === null && !error ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 16 }} />
        ) : patients && patients.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={34} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No patients have shared data with you yet.</Text>
          </View>
        ) : (
          (patients ?? []).map((p) => (
            <TouchableOpacity
              key={p.shareId}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: '/pro-patient',
                  params: { patientId: p.patientId, name: p.patientName ?? 'Patient', scopes: p.scopes.join(',') },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(p.patientName ?? '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.patientName ?? 'Patient'}</Text>
                  <Text style={styles.meta}>
                    Shared {formatDate(p.sharedAt)}
                    {p.expiresAt ? ` · until ${formatDate(p.expiresAt)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
              <View style={styles.chips}>
                {p.scopes.map((s) => (
                  <View key={s} style={styles.chip}>
                    <Text style={styles.chipText}>{scopeLabel(s)}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0F1A' },
  content: { paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 20, marginBottom: 14 },
  photo: { width: 60, height: 60, borderRadius: 30 },
  photoEmpty: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  editProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(30, 34, 48, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(62, 205, 184, 0.35)',
    borderRadius: 14,
    padding: 13,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  editProfileText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  eyebrow: { color: Colors.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  logout: { padding: 6 },
  pending: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(240, 184, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240, 184, 77, 0.4)',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  pendingText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginTop: 8, marginBottom: 10 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: 'rgba(30, 34, 48, 0.85)',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.violetSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: Colors.violet, fontSize: 17, fontWeight: '800' },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { backgroundColor: Colors.accentSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: Colors.textPrimary, fontSize: 12 },
});
