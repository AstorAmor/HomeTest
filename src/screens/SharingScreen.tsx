import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { DataShare, isShareActive, listMyShares, revokeShare, roleLabel, scopeLabel } from '@/data/sharing';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Paciente: con quién comparte qué, y revocar. Cada permiso es un consentimiento
// explícito; al revocarlo queda en el historial.
export const SharingScreen = () => {
  const router = useRouter();
  const { authMode } = useAuth();
  const [shares, setShares] = useState<DataShare[] | null>(null);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (authMode !== 'supabase') return;
    try {
      setShares(await listMyShares());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your shares');
    }
  }, [authMode]);

  useReloadOnFocus(load);

  const revoke = async (id: string) => {
    try {
      await revokeShare(id);
      setConfirmingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke');
    }
  };

  const active = (shares ?? []).filter(isShareActive);
  const history = (shares ?? []).filter((s) => !isShareActive(s));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Sharing & privacy" showBack />

        <View style={styles.intro}>
          <Ionicons name="shield-checkmark" size={22} color={Colors.accent} />
          <Text style={styles.introText}>
            You decide what each professional can see and for how long. They can only read your data, never
            change it, and you can stop sharing at any time. Your name is visible to the professionals you share
            with.
          </Text>
        </View>

        {authMode !== 'supabase' ? (
          <Text style={styles.muted}>Sharing needs a Kuova account (not available in demo mode).</Text>
        ) : shares === null && !error ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.cta} onPress={() => router.push('/share-new')} activeOpacity={0.85}>
              <Ionicons name="person-add-outline" size={20} color={Colors.background} />
              <Text style={styles.ctaText}>Share with a professional</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Active</Text>
            {active.length === 0 ? (
              <Text style={styles.muted}>You are not sharing data with anyone.</Text>
            ) : (
              active.map((s) => (
                <View key={s.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Ionicons name="medkit-outline" size={20} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{s.professionalName}</Text>
                      <Text style={styles.meta}>
                        {roleLabel(s.professionalRole)} · since {formatDate(s.createdAt)}
                        {s.expiresAt ? ` · until ${formatDate(s.expiresAt)}` : ' · no expiry'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.chips}>
                    {s.scopes.map((sc) => (
                      <View key={sc} style={styles.chip}>
                        <Text style={styles.chipText}>{scopeLabel(sc)}</Text>
                      </View>
                    ))}
                  </View>
                  {confirmingId === s.id ? (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmText}>Stop sharing with {s.professionalName}?</Text>
                      <TouchableOpacity style={styles.revokeConfirm} onPress={() => revoke(s.id)}>
                        <Text style={styles.revokeConfirmText}>Stop sharing</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setConfirmingId(null)}>
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.revoke} onPress={() => setConfirmingId(s.id)}>
                      <Text style={styles.revokeText}>Revoke access</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}

            {history.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>History</Text>
                {history.map((s) => (
                  <View key={s.id} style={[styles.card, styles.cardMuted]}>
                    <Text style={styles.name}>{s.professionalName}</Text>
                    <Text style={styles.meta}>
                      {s.scopes.map(scopeLabel).join(', ')} · {formatDate(s.createdAt)} →{' '}
                      {s.revokedAt ? `revoked ${formatDate(s.revokedAt)}` : `expired ${formatDate(s.expiresAt!)}`}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  intro: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.accentSoft,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 18,
  },
  introText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  muted: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  cardMuted: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { backgroundColor: Colors.violetSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: Colors.textPrimary, fontSize: 12 },
  revoke: { alignSelf: 'flex-start', marginTop: 12 },
  revokeText: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  confirmText: { color: Colors.textPrimary, fontSize: 13, flexBasis: '100%' },
  revokeConfirm: { backgroundColor: Colors.danger, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  revokeConfirmText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  cancelText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
