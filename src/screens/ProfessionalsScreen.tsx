import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev, SecHead } from '@/components/fine/Fine';
import { FChip, FLink, ON_BG } from '@/components/fine/FineForm';
import { Monogram, RoleIcon } from '@/components/fine/RoleEmblem';
import { mockProfessionals, ProfessionalRole, ROLE_INFO } from '@/data/servicesMock';
import { listVerifiedProfessionals, ProfessionalAccount } from '@/data/sharing';
import { isRemoteActive } from '@/lib/supabase';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { num, t } from '@/i18n';
import { formatPrice } from '@/data/testCatalog';
import { TAB, tabHref } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

const ROLES = Object.keys(ROLE_INFO) as ProfessionalRole[];
const AVATAR = 44; // la foto o la inicial de cada fila

// Profesionales (/professionals): buscar, filtrar por especialidad e idioma y abrir la ficha. En la estética fina
// (fundador, 2026-11-16: los iconos de los especialistas «se ven muy gordos y no alineados con la estética»): chips con
// borde y el dibujo a línea de cada rol (components/fine/RoleEmblem.tsx) en lugar de los iconos rellenos, filas con una
// línea fina debajo en lugar de tarjetas, la inicial en un aro fino y la valoración en texto («4,9 · 128 valoraciones»).
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
  const filtersOn = showFilters || activeFilters > 0;
  const open = (id: string) => router.push({ pathname: '/professional-detail', params: { id } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Professionals')} showBack backFallback={tabHref(TAB.you)} />
        <Text style={[fine.lead, styles.pad, styles.intro]}>
          {t('Doctors, psychologists, dietitians, trainers, genetic counsellors and more, all with access to your results if you allow it.')}
        </Text>

        <View style={[styles.pad, styles.searchRow]}>
          <View style={styles.search}>
            <Ionicons name="search-outline" size={16} color={FINE.mute} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('Search by name or specialty')}
              placeholderTextColor={FINE.mute}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              accessibilityLabel={t('Search by name or specialty')}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Clear search')}>
                <Ionicons name="close-outline" size={18} color={FINE.mute} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, filtersOn && styles.filterBtnOn]}
            onPress={() => setShowFilters((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('Filters')}
            accessibilityState={{ expanded: showFilters }}
          >
            <Ionicons name="options-outline" size={18} color={filtersOn ? FINE.jade : FINE.ivory} />
            {activeFilters > 0 && <Text style={styles.filterCount}>{activeFilters}</Text>}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={[styles.pad, styles.panel]}>
            <Text style={[fine.kicker, styles.panelLabel]}>{t('Languages')}</Text>
            <View style={styles.chipsWrap}>
              {allLanguages.map((l) => {
                const on = langs.includes(l);
                return <FChip key={l} label={t(l)} on={on} multi check onPress={() => setLangs((prev) => (on ? prev.filter((x) => x !== l) : [...prev, l]))} />;
              })}
            </View>
            <View style={[fine.row, styles.switchRow]}>
              <Ionicons name="videocam-outline" size={18} color={FINE.jade} />
              <Text style={[fine.rowTitle, styles.flex]}>{t('Offers video consultations')}</Text>
              <Switch
                value={videoOnly}
                onValueChange={setVideoOnly}
                trackColor={{ false: 'rgba(240,239,230,0.14)', true: FINE.emerald }}
                thumbColor={FINE.ivory}
                accessibilityLabel={t('Offers video consultations')}
              />
            </View>
            {activeFilters > 0 && (
              <FLink
                label={t('Clear filters')}
                onPress={() => {
                  setLangs([]);
                  setVideoOnly(false);
                }}
                style={styles.clear}
              />
            )}
          </View>
        )}

        {/* Especialidades: chips con borde y el dibujo a línea del rol; la elegida, borde jade */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roles} accessibilityRole="radiogroup">
          <RoleChip label={t('All specialists')} on={role === 'all'} onPress={() => setRole('all')} />
          {ROLES.map((r) => (
            <RoleChip key={r} role={r} label={ROLE_INFO[r].label} on={role === r} onPress={() => setRole(r)} />
          ))}
        </ScrollView>

        <View style={[styles.pad, styles.list]}>
          {realList.length > 0 && (
            <>
              <SecHead title={t('On Kuova')} style={styles.firstHead} />
              {realList.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  style={[fine.row, styles.proRow, i === realList.length - 1 && styles.noLine]}
                  onPress={() => open(p.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.displayName}. ${p.specialty ?? ROLE_INFO[p.role as ProfessionalRole]?.label ?? p.role}`}
                >
                  {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.photo} contentFit="cover" /> : <Monogram name={p.displayName} size={AVATAR} />}
                  <View style={styles.flex}>
                    <Text style={fine.rowTitle} numberOfLines={1}>
                      {p.displayName}
                    </Text>
                    <Text style={fine.rowSub} numberOfLines={1}>
                      {p.specialty ?? ROLE_INFO[p.role as ProfessionalRole]?.label ?? p.role}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="shield-checkmark-outline" size={12} color={FINE.jade} />
                      <Text style={[styles.meta, { color: FINE.jade }]}>{t('Verified')}</Text>
                      {p.hourlyRateEur ? <Text style={styles.meta}>{` · ${formatPrice(p.hourlyRateEur)} / h`}</Text> : null}
                    </View>
                  </View>
                  <Chev />
                </TouchableOpacity>
              ))}
              <SecHead title={t('Examples')} />
            </>
          )}

          {realList.length === 0 && list.length === 0 && <Text style={[fine.note, styles.empty]}>{t('No specialists match your search.')}</Text>}

          {list.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              style={[fine.row, styles.proRow, i === list.length - 1 && styles.noLine]}
              onPress={() => open(p.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}. ${p.specialty}`}
            >
              <Monogram name={p.name} size={AVATAR} />
              <View style={styles.flex}>
                <Text style={fine.rowTitle} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={fine.rowSub} numberOfLines={1}>
                  {p.specialty}
                </Text>
                {/* Valoración y precio en texto, sin estrellas: «4,9 · 128 valoraciones · 100 € / 15 min» */}
                <Text style={[styles.meta, styles.metaLine]} numberOfLines={2}>
                  {p.rating > 0 ? (
                    `${num(p.rating.toFixed(1))}${p.reviews ? ` · ${t('{n} reviews', { n: p.reviews })}` : ''}`
                  ) : (
                    <Text style={{ color: FINE.jade }}>{t('New on Kuova')}</Text>
                  )}
                  {` · ${formatPrice(p.pricePerSession)} / ${p.sessionMinutes} min`}
                </Text>
                <Text style={styles.next}>{t('Next: {when}', { when: p.nextAvailable })}</Text>
              </View>
              <Chev />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Un chip de especialidad: borde fino, el dibujo a línea del rol y el nombre; elegido, borde jade y letra marfil
// (como FChip)
function RoleChip({ role, label, on, onPress }: { role?: ProfessionalRole; label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      {role ? <RoleIcon role={role} size={18} color={on ? FINE.jade : FINE.mute} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  intro: { marginTop: 0, marginBottom: 14 },
  flex: { flex: 1, minWidth: 0 },
  // Buscador: casi transparente con borde fino (como las casillas de FineForm)
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14, paddingVertical: 10 },
  filterBtn: { width: 44, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: FINE.line, alignItems: 'center', justifyContent: 'center' },
  filterBtnOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  filterCount: { ...ff('medium'), position: 'absolute', top: 3, right: 6, color: FINE.jade, fontSize: 10 },
  // Filtros: sin tarjeta, una cabecera pequeña, los idiomas en chips y la videoconsulta en una fila
  panel: { marginBottom: 14 },
  panelLabel: { marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { marginTop: 6, borderBottomWidth: 0 },
  clear: { alignSelf: 'flex-start', paddingVertical: 4, minHeight: 32 },
  // Especialidades
  roles: { paddingHorizontal: 20, gap: 8, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: FINE.line },
  chipOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  chipText: { ...ff('regular'), color: FINE.mute, fontSize: 13.5 },
  chipTextOn: { color: FINE.ivory },
  // Lista
  list: { marginTop: 4 },
  firstHead: { marginTop: 10 },
  empty: { marginTop: 18, textAlign: 'center' },
  proRow: { gap: 14, paddingVertical: 14 },
  noLine: { borderBottomWidth: 0 },
  photo: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 12, lineHeight: 16 },
  metaLine: { marginTop: 5 },
  next: { ...ff('regular'), color: FINE.jade, fontSize: 12, lineHeight: 16, marginTop: 3 },
});
