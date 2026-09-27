import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Colors } from '@/constants/colors';
import { mockProfessionals, ProfessionalRole, ROLE_INFO } from '@/data/servicesMock';

const ROLES = Object.keys(ROLE_INFO) as ProfessionalRole[];

export const ProfessionalsScreen = () => {
  const router = useRouter();
  const [role, setRole] = useState<ProfessionalRole | 'all'>('all');
  const list = role === 'all' ? mockProfessionals : mockProfessionals.filter((p) => p.role === role);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Professionals" showBack />
        <Text style={styles.intro}>
          Doctors, dietitians, trainers and more, all with access to your results if you allow it.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <TouchableOpacity style={[styles.filter, role === 'all' && styles.filterActive]} onPress={() => setRole('all')}>
            <Text style={[styles.filterText, role === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {ROLES.map((r) => (
            <TouchableOpacity key={r} style={[styles.filter, role === r && styles.filterActive]} onPress={() => setRole(r)}>
              <Ionicons name={ROLE_INFO[r].icon as any} size={14} color={role === r ? Colors.background : Colors.textSecondary} />
              <Text style={[styles.filterText, role === r && styles.filterTextActive]}>{ROLE_INFO[r].label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {list.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/professional-detail', params: { id: p.id } })}
              activeOpacity={0.85}
            >
              <Avatar nombre={p.name.replace('Dr. ', '')} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.specialty}>{p.specialty}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={12} color={Colors.amber} />
                  <Text style={styles.meta}>
                    {p.rating.toFixed(1)} ({p.reviews})
                  </Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.meta}>
                    €{p.pricePerSession} / {p.sessionMinutes} min
                  </Text>
                </View>
                <Text style={styles.next}>Next: {p.nextAvailable}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginBottom: 14 },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: Colors.background },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  specialty: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  metaDot: { color: Colors.textMuted, fontSize: 12 },
  next: { color: Colors.accent, fontSize: 12, fontWeight: '600', marginTop: 4 },
});
