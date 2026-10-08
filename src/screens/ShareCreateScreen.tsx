import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import {
  createShare,
  listVerifiedProfessionals,
  ProfessionalAccount,
  roleLabel,
  SHARE_SCOPES,
  ShareScope,
} from '@/data/sharing';
import { profileRepository } from '@/data/profileRepository';

const EXPIRY_OPTIONS: { id: string; label: string; days: number | null }[] = [
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '3 months', days: 90 },
  { id: '365', label: '1 year', days: 365 },
  { id: 'none', label: 'Until I revoke it', days: null },
];

// Paciente: elegir profesional (verificado) → qué categorías → hasta cuándo.
// `?scope=plan` (desde "Share or print" del plan) llega con esa categoría ya marcada.
export const ShareCreateScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string }>();
  const preselected = SHARE_SCOPES.find((s) => s.id === params.scope)?.id ?? 'lab_reports';
  const [professionals, setProfessionals] = useState<ProfessionalAccount[] | null>(null);
  const [selectedPro, setSelectedPro] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Set<ShareScope>>(new Set([preselected]));
  const [expiry, setExpiry] = useState('90');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // La categoría del ciclo menstrual solo se ofrece a perfiles de mujer
  const [isFemale, setIsFemale] = useState(false);
  useEffect(() => {
    profileRepository.get().then((p) => setIsFemale(p.sex === 'female')).catch(() => undefined);
  }, []);
  const scopeOptions = SHARE_SCOPES.filter((s) => s.id !== 'cycle' || isFemale);

  useEffect(() => {
    listVerifiedProfessionals()
      .then(setProfessionals)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load professionals'));
  }, []);

  const toggleScope = (id: ShareScope) =>
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = scopes.size === scopeOptions.length;
  const pro = professionals?.find((p) => p.id === selectedPro);

  const submit = async () => {
    if (!selectedPro || scopes.size === 0) return;
    setSaving(true);
    setError('');
    try {
      const days = EXPIRY_OPTIONS.find((o) => o.id === expiry)?.days ?? null;
      const expiresAt = days ? new Date(Date.now() + days * 24 * 3600 * 1000).toISOString() : null;
      await createShare(selectedPro, [...scopes], expiresAt);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Share your data" showBack />

        <Text style={styles.step}>1 · Who</Text>
        {professionals === null && !error ? (
          <ActivityIndicator color={Colors.accent} />
        ) : professionals && professionals.length === 0 ? (
          <Text style={styles.muted}>There are no verified professionals yet.</Text>
        ) : (
          (professionals ?? []).map((p) => {
            const selected = selectedPro === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setSelectedPro(p.id)}
              >
                <View style={styles.proIcon}>
                  <Ionicons name="medkit-outline" size={20} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{p.displayName}</Text>
                  <Text style={styles.optionSubtitle}>
                    {roleLabel(p.role)}
                    {p.specialty ? ` · ${p.specialty}` : ''} · Verified
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? Colors.accent : Colors.textMuted}
                />
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.stepRow}>
          <Text style={styles.step}>2 · What</Text>
          <TouchableOpacity
            onPress={() => setScopes(allSelected ? new Set() : new Set(scopeOptions.map((s) => s.id)))}
          >
            <Text style={styles.link}>{allSelected ? 'Clear all' : 'Select all'}</Text>
          </TouchableOpacity>
        </View>
        {scopeOptions.map((s) => {
          const selected = scopes.has(s.id);
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => toggleScope(s.id)}
            >
              <Ionicons name={s.icon as any} size={20} color={selected ? Colors.accent : Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{s.label}</Text>
                <Text style={styles.optionSubtitle}>{s.description}</Text>
              </View>
              <Ionicons
                name={selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={selected ? Colors.accent : Colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}

        <Text style={styles.step}>3 · For how long</Text>
        <View style={styles.expiryRow}>
          {EXPIRY_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.expiryChip, expiry === o.id && styles.expiryChipSelected]}
              onPress={() => setExpiry(o.id)}
            >
              <Text style={[styles.expiryText, expiry === o.id && { color: Colors.textPrimary }]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.summary}>
          {pro
            ? `${pro.displayName} will be able to read ${scopes.size} categor${scopes.size === 1 ? 'y' : 'ies'}. You can revoke it anytime.`
            : 'Choose a professional to continue.'}
        </Text>
        <TouchableOpacity
          style={[styles.cta, (!selectedPro || scopes.size === 0 || saving) && styles.ctaDisabled]}
          disabled={!selectedPro || scopes.size === 0 || saving}
          onPress={submit}
        >
          {saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>Share</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  step: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 14, marginBottom: 10 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingRight: 20 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  muted: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20, marginTop: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 13,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  optionSelected: { borderColor: Colors.accent, backgroundColor: withAlpha(Colors.accent, 0.08) },
  proIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  optionSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  expiryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  expiryChip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  expiryChipSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  expiryText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 10 },
  summary: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center' },
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 15, alignItems: 'center' },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
