import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Colors, withAlpha } from '@/constants/colors';
import { mockPatient } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { ageFromDob, CONDITION_OPTIONS, GOAL_OPTIONS, profileRepository, UserProfile } from '@/data/profileRepository';
import { PURPOSE_OPTIONS, useAppPrefs } from '@/data/appPrefs';
import { t } from '@/i18n';
import { TAB, tabHref } from '@/constants/tabs';
import { removeAvatar, setAvatar, useAvatar } from '@/data/avatar';
import { confirmAsk } from '@/components/dev/confirmAsk';

// Se evalúa con el idioma ya cargado (index.js); cambiar de idioma recarga la app.
const LABELS: Record<string, string> = {
  female: t('Female'),
  male: t('Male'),
  other: t('Other'),
  undisclosed: t('Prefer not to say'),
  sedentary: t('Mostly sitting'),
  light: t('Light activity'),
  active: t('Fairly active'),
  very_active: t('Very active'),
  lt6: t('< 6 h'),
  '6to7': t('6–7 h'),
  '7to8': t('7–8 h'),
  gt8: t('> 8 h'),
  never: t('Never'),
  former: t('Used to'),
  current: t('Yes'),
  occasional: t('Occasionally'),
  weekly: t('Every week'),
  daily: t('Daily'),
};

export const ProfileScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const photo = useAvatar();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [heroError, setHeroError] = useState('');

  const pickPhoto = async () => {
    setHeroError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    setPhotoBusy(true);
    try {
      await setAvatar(result.assets[0].uri);
    } catch (e) {
      setHeroError(e instanceof Error ? e.message : t('Could not save the photo'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const dropPhoto = async () => {
    if (!(await confirmAsk(t('Remove your photo?'), t('Your initial will show instead.'), t('Remove')))) return;
    setPhotoBusy(true);
    await removeAvatar().catch(() => undefined);
    setPhotoBusy(false);
  };

  const [profile, setProfile] = useDeepState<UserProfile | null>(null);
  const prefs = useAppPrefs();
  const chosen = PURPOSE_OPTIONS.filter((p) => prefs.purposes.includes(p.id));
  const purpose = chosen.length === 1 ? chosen[0] : undefined;

  const load = useCallback(() => {
    profileRepository.get().then(setProfile);
  }, [setProfile]);

  useReloadOnFocus(load);

  const age = ageFromDob(profile?.dateOfBirth);
  const rows: { label: string; value?: string }[] = [
    { label: t('Age'), value: age != null ? `${age}` : undefined },
    { label: t('Sex'), value: profile?.sex && LABELS[profile.sex] },
    { label: t('Height'), value: profile?.heightCm ? `${profile.heightCm} cm` : undefined },
    { label: t('Weight'), value: profile?.weightKg ? `${profile.weightKg} kg` : undefined },
    { label: t('Activity'), value: profile?.activity && LABELS[profile.activity] },
    { label: t('Sleep'), value: profile?.sleep && LABELS[profile.sleep] },
    { label: t('Smoking'), value: profile?.smoking && LABELS[profile.smoking] },
    { label: t('Alcohol'), value: profile?.alcohol && LABELS[profile.alcohol] },
    {
      label: t('Medication'),
      value:
        profile?.takesMedication === undefined
          ? undefined
          : profile.takesMedication
            ? profile.medications || t('Yes')
            : t('None'),
    },
    {
      label: t('Conditions'),
      value: profile?.conditions?.length
        ? profile.conditions
            .map((c) => (c === 'other' ? profile.conditionsOther || t('Other') : t(CONDITION_OPTIONS.find((o) => o.id === c)?.label ?? c)))
            .join(', ')
        : undefined,
    },
  ];
  const goals = GOAL_OPTIONS.filter((g) => profile?.goals.includes(g.id));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('My Profile')} showBack backFallback={tabHref(TAB.more)} />

        <View style={styles.hero}>
          {/* Tocar la foto: elegir otra de la galería */}
          <TouchableOpacity onPress={pickPhoto} disabled={photoBusy} activeOpacity={0.85} accessibilityLabel={t('Change photo')}>
            <UserAvatar size={84} />
            <View style={styles.cameraBadge}>
              {photoBusy ? <ActivityIndicator size="small" color={Colors.background} /> : <Ionicons name="camera" size={15} color={Colors.background} />}
            </View>
          </TouchableOpacity>
          {photo && !photoBusy && (
            <TouchableOpacity onPress={dropPhoto} hitSlop={8}>
              <Text style={styles.photoLink}>{t('Remove photo')}</Text>
            </TouchableOpacity>
          )}

          {/* El alias tiene su propia pantalla (/your-name), también en Ajustes → Cuenta */}
          <TouchableOpacity style={styles.nameRow} onPress={() => router.push('/your-name')} accessibilityLabel={t('Change your name')}>
            <Text style={styles.name}>{user?.nombre ?? mockPatient.nombre}</Text>
            <Ionicons name="pencil" size={15} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={styles.email}>{user?.email ?? mockPatient.email}</Text>
          {heroError ? <Text style={styles.heroError}>{heroError}</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('What you use Kuova for')}</Text>
          <TouchableOpacity onPress={() => router.push('/app-sections')}>
            <Text style={styles.edit}>{t('Change')}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, styles.purposeCard]}>
          <Ionicons name={(purpose?.icon ?? 'apps-outline') as any} size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.purposeTitle}>{chosen.length ? chosen.map((c) => t(c.title)).join(' · ') : t('Everything')}</Text>
            <Text style={styles.purposeSubtitle}>
              {prefs.hidden.length
                ? t(prefs.hidden.length === 1 ? '{n} section hidden' : '{n} sections hidden', { n: prefs.hidden.length })
                : t('All sections visible')}
            </Text>
          </View>
        </View>

        <View style={[styles.sectionHeader, styles.afterCard]}>
          <Text style={styles.sectionTitle}>{t('About you')}</Text>
          <TouchableOpacity onPress={() => router.push('/onboarding')}>
            <Text style={styles.edit}>{t('Edit')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={[styles.rowValue, styles.rowValueWrap, !r.value && styles.rowEmpty]}>{r.value ?? t('Not answered')}</Text>
            </View>
          ))}
        </View>

        {!prefs.hidden.includes('plan') && (
          <>
            <Text style={[styles.sectionTitle, styles.spaced]}>{t('Your goals')}</Text>
            <View style={styles.goals}>
              {goals.length ? (
                goals.map((g) => (
                  <View key={g.id} style={styles.goalChip}>
                    <Ionicons name={g.icon as any} size={14} color={Colors.accent} />
                    <Text style={styles.goalText}>{t(g.label)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.rowEmpty}>{t('No goals yet. Tap Edit to add them.')}</Text>
              )}
            </View>
          </>
        )}


      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLink: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  heroError: { color: Colors.attention, fontSize: 13, marginTop: 8, textAlign: 'center' },
  email: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  spaced: { paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  edit: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  afterCard: { marginTop: 22 },
  purposeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  purposeTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  purposeSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowLabel: { color: Colors.textSecondary, fontSize: 14 },
  rowValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowValueWrap: { flexShrink: 1, textAlign: 'right', marginLeft: 16 },
  rowEmpty: { color: Colors.textMuted, fontSize: 13, fontWeight: '400' },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(Colors.accent, 0.35),
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalText: { color: Colors.textPrimary, fontSize: 13 },
  badge: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(Colors.amber, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(Colors.amber, 0.4),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  badgeText: { color: Colors.amber, fontSize: 12, fontWeight: '700' },
});
