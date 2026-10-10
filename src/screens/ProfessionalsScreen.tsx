import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Colors } from '@/constants/colors';
import { Image } from 'expo-image';
import { mockProfessionals, ProfessionalRole, ROLE_INFO } from '@/data/servicesMock';
import { listVerifiedProfessionals, ProfessionalAccount } from '@/data/sharing';
import { isRemoteActive } from '@/lib/supabase';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const ROLES = Object.keys(ROLE_INFO) as ProfessionalRole[];

export const ProfessionalsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole = ROLES.includes(params.role as ProfessionalRole) ? (params.role as ProfessionalRole) : 'all';
  const [role, setRole] = useState<ProfessionalRole | 'all'>(initialRole);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [langs, setLangs] = useState<string[]>([]);
  const [videoOnly, setVideoOnly] = useState(false);

  // Búsqueda (nombre, especialidad, bio) + filtros (especialidad, idioma, videoconsulta).
  const q = query.trim().toLowerCase();
  const matches = (name: string, specialty: string, bio: string, languages: string[], video: boolean, r: string) =>
    (role === 'all' || r === role) &&
    (!q || `${name} ${specialty} ${bio}`.toLowerCase().includes(q)) &&
    (langs.length === 0 || langs.every((l) => languages.includes(l))) &&
    (!videoOnly || video);
  const list = mockProfessionals.filter((p) => matches(p.name, p.specialty, p.bio, p.languages, p.online, p.role));
  // Especialistas reales verificados en Kuova (con cuenta). Los de ejemplo van debajo.
  const [real, setReal] = useDeepState<ProfessionalAccount[]>([]);
  useReloadOnFocus(
    useCallback(async () => {
      if (!isRemoteActive()) return;
      setReal(await listVerifiedProfessionals().catch(() => []));
    }, [setReal]),
  );
  const realList = real.filter((p) =>
    matches(p.displayName, p.specialty ?? '', p.bio ?? '', p.languages, p.videoEnabled !== false, p.role),
  );
  const allLanguages = Array.from(new Set([...mockProfessionals.flatMap((p) => p.languages), ...real.flatMap((p) => p.languages)])).sort();
  const activeFilters = langs.length + (videoOnly ? 1 : 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Professionals" showBack />
        <Text style={styles.intro}>
          Doctors, psychologists, dietitians, trainers, genetic counsellors and more, all with access to your results if you allow it.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or specialty"
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={[styles.filterBtn, (showFilters || activeFilters > 0) && styles.filterActive]} onPress={() => setShowFilters((v) => !v)}>
            <Ionicons name="options-outline" size={18} color={showFilters || activeFilters > 0 ? Colors.background : Colors.textPrimary} />
            {activeFilters > 0 && <Text style={styles.filterCount}>{activeFilters}</Text>}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Languages</Text>
            <View style={styles.chips}>
              {allLanguages.map((l) => {
                const on = langs.includes(l);
                return (
                  <TouchableOpacity key={l} style={[styles.filter, on && styles.filterActive]} onPress={() => setLangs((prev) => (on ? prev.filter((x) => x !== l) : [...prev, l]))}>
                    <Text style={[styles.filterText, on && styles.filterTextActive]}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.switchRow}>
              <Ionicons name="videocam-outline" size={18} color={Colors.accent} />
              <Text style={styles.switchLabel}>Offers video consultations</Text>
              <Switch value={videoOnly} onValueChange={setVideoOnly} trackColor={{ true: Colors.accent, false: Colors.cardBorder }} />
            </View>
            {activeFilters > 0 && (
              <TouchableOpacity onPress={() => { setLangs([]); setVideoOnly(false); }}>
                <Text style={styles.clear}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <TouchableOpacity style={[styles.filter, role === 'all' && styles.filterActive]} onPress={() => setRole('all')}>
            <Text style={[styles.filterText, role === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {ROLES.map((r) => (
            <TouchableOpacity key={r} style={[styles.filter, role === r && styles.filterActive]} onPress={() => setRole(r)}>
              <MaterialCommunityIcons name={ROLE_INFO[r].icon as any} size={15} color={role === r ? Colors.background : Colors.textSecondary} />
              <Text style={[styles.filterText, role === r && styles.filterTextActive]}>{ROLE_INFO[r].label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {realList.length > 0 && (
          <>
            <Text style={styles.groupTitle}>On Kuova</Text>
            <View style={[styles.list, { marginBottom: 20 }]}>
              {realList.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.card}
                  onPress={() => router.push({ pathname: '/professional-detail', params: { id: p.id } })}
                  activeOpacity={0.85}
                >
                  {p.photoUrl ? (
                    <Image source={{ uri: p.photoUrl }} style={styles.photo} contentFit="cover" />
                  ) : (
                    <Avatar nombre={p.displayName.replace(/^Dra?\.\s*/, '')} size={52} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.displayName}</Text>
                    <Text style={styles.specialty}>{p.specialty ?? ROLE_INFO[p.role as ProfessionalRole]?.label ?? p.role}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="shield-checkmark" size={12} color={Colors.ok} />
                      <Text style={styles.meta}>Verified{p.hourlyRateEur ? ` · €${p.hourlyRateEur} / h` : ''}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.groupTitle}>Examples</Text>
          </>
        )}

        {realList.length === 0 && list.length === 0 && <Text style={styles.empty}>No specialists match your search.</Text>}

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
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 10 },
  filterBtn: { width: 44, borderRadius: 14, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  filterCount: { position: 'absolute', top: 4, right: 6, color: Colors.background, fontSize: 10, fontWeight: '900' },
  panel: { marginHorizontal: 20, marginBottom: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, gap: 10 },
  panelLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { color: Colors.textPrimary, fontSize: 14, flex: 1 },
  clear: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  empty: { color: Colors.textSecondary, fontSize: 14, paddingHorizontal: 20, marginBottom: 10 },
  groupTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', paddingHorizontal: 20, marginBottom: 10 },
  photo: { width: 52, height: 52, borderRadius: 26 },
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
