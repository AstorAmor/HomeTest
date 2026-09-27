import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Colors } from '@/constants/colors';
import { mockPatient } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { ageFromDob, BADGES, GOAL_OPTIONS, profileRepository, UserProfile } from '@/data/profileRepository';

const avatarSource = require('../../assets/images/avatar.jpg');

const LABELS: Record<string, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: 'Prefer not to say',
  sedentary: 'Mostly sitting',
  light: 'Light activity',
  active: 'Active',
  very_active: 'Very active',
  lt6: '< 6 h',
  '6to7': '6–7 h',
  '7to8': '7–8 h',
  gt8: '> 8 h',
  never: 'Never',
  former: 'Used to',
  current: 'Yes',
  occasional: 'Occasionally',
  weekly: 'Every week',
  daily: 'Daily',
};

export const ProfileScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useDeepState<UserProfile | null>(null);

  const load = useCallback(() => {
    profileRepository.get().then(setProfile);
  }, [setProfile]);

  useReloadOnFocus(load);

  const age = ageFromDob(profile?.dateOfBirth);
  const rows: { label: string; value?: string }[] = [
    { label: 'Age', value: age != null ? `${age}` : undefined },
    { label: 'Sex', value: profile?.sex && LABELS[profile.sex] },
    { label: 'Height', value: profile?.heightCm ? `${profile.heightCm} cm` : undefined },
    { label: 'Weight', value: profile?.weightKg ? `${profile.weightKg} kg` : undefined },
    { label: 'Activity', value: profile?.activity && LABELS[profile.activity] },
    { label: 'Sleep', value: profile?.sleep && LABELS[profile.sleep] },
    { label: 'Smoking', value: profile?.smoking && LABELS[profile.smoking] },
    { label: 'Alcohol', value: profile?.alcohol && LABELS[profile.alcohol] },
  ];
  const goals = GOAL_OPTIONS.filter((g) => profile?.goals.includes(g.id));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My Profile" showBack />

        <View style={styles.hero}>
          <Avatar nombre={mockPatient.nombre} source={avatarSource} size={84} />
          <Text style={styles.name}>{user?.nombre ?? mockPatient.nombre}</Text>
          <Text style={styles.email}>{user?.email ?? mockPatient.email}</Text>
          <View style={styles.memberPill}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.accent} />
            <Text style={styles.memberText}>Annual membership · 2 tests / year</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>About you</Text>
          <TouchableOpacity onPress={() => router.push('/onboarding')}>
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={[styles.rowValue, !r.value && styles.rowEmpty]}>{r.value ?? 'Not answered'}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.spaced]}>Your goals</Text>
        <View style={styles.goals}>
          {goals.length ? (
            goals.map((g) => (
              <View key={g.id} style={styles.goalChip}>
                <Ionicons name={g.icon as any} size={14} color={Colors.accent} />
                <Text style={styles.goalText}>{g.label}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.rowEmpty}>No goals yet. Tap Edit to add them.</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, styles.spaced]}>Badges</Text>
        <View style={styles.goals}>
          {profile?.badges.length ? (
            profile.badges.map((b) => (
              <View key={b} style={styles.badge}>
                <Ionicons name={(BADGES[b]?.icon ?? 'ribbon') as any} size={22} color={Colors.amber} />
                <Text style={styles.badgeText}>{BADGES[b]?.title ?? b}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.rowEmpty}>Complete your profile to earn your first badge.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 12 },
  email: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  memberText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
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
  rowEmpty: { color: Colors.textMuted, fontSize: 13, fontWeight: '400' },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(62, 205, 184, 0.35)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalText: { color: Colors.textPrimary, fontSize: 13 },
  badge: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(240, 184, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240, 184, 77, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  badgeText: { color: Colors.amber, fontSize: 12, fontWeight: '700' },
});
