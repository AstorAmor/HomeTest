import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { Colors } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import { PatientSummary } from '@/data/specialistTypes';
import { scopeLabel } from '@/data/sharing';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// C. Mis pacientes: tarjetas con avisos arriba a la derecha:
// triángulo = acciones pendientes o valores alterados; teléfono = consulta hoy.
export const ProPatientsScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const [patients, setPatients] = useDeepState<PatientSummary[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useReloadOnFocus(
    useCallback(async () => {
      try {
        setPatients(await portal.listPatients());
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load patients');
      }
    }, [setPatients]),
  );

  const shown = patients.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const alerts = patients.filter((p) => p.openRequests > 0 || p.flaggedMarkers > 0 || p.unreadMessages > 0).length;

  return (
    <ProLayout active="patients" title="My patients" badge={{ patients: alerts }}>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && patients.length === 0 && (
        <Text style={styles.empty}>
          Patients appear here when they share their data with you, book a consultation, send you a request or open a chat.
        </Text>
      )}

      <View style={[styles.grid, wide && styles.gridWide]}>
        {shown.map((p) => {
          const warn = p.openRequests > 0 || p.flaggedMarkers > 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, wide && styles.cardWide]}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/pro-patient', params: { id: p.id } })}
            >
              <View style={styles.flags}>
                {p.appointmentToday && (
                  <View style={[styles.flag, { backgroundColor: Colors.accentSoft }]}>
                    <Ionicons name="call" size={14} color={Colors.accent} />
                  </View>
                )}
                {warn && (
                  <View style={[styles.flag, { backgroundColor: Colors.dangerSoft }]}>
                    <Ionicons name="warning" size={14} color={Colors.attention} />
                  </View>
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(p.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.sub}>
                    {[p.age ? `${p.age} y` : null, p.sex].filter(Boolean).join(' · ') || (p.scopes.length ? `${p.scopes.length} data categories shared` : 'No data shared yet')}
                  </Text>
                </View>
              </View>
              <View style={styles.chips}>
                {p.flaggedMarkers > 0 && <Chip icon="flask" color={Colors.attention} text={`${p.flaggedMarkers} values out of range`} />}
                {p.openRequests > 0 && <Chip icon="help-circle" color={Colors.attention} text={`${p.openRequests} pending request${p.openRequests > 1 ? 's' : ''}`} />}
                {p.unreadMessages > 0 && <Chip icon="chatbubble" color={Colors.accent} text={`${p.unreadMessages} new message${p.unreadMessages > 1 ? 's' : ''}`} />}
                {p.nextAppointment && <Chip icon="calendar" color={Colors.textSecondary} text={when(p.nextAppointment)} />}
              </View>
              {p.scopes.length > 0 && (
                <Text style={styles.scopes} numberOfLines={1}>
                  Shares: {p.scopes.map(scopeLabel).join(', ')}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ProLayout>
  );
};

const Chip = ({ icon, color, text }: { icon: string; color: string; text: string }) => (
  <View style={styles.chip}>
    <Ionicons name={icon as any} size={12} color={color} />
    <Text style={[styles.chipText, { color }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, paddingHorizontal: 12, marginBottom: 14 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 10 },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  grid: { gap: 10 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 10 },
  cardWide: { width: 340 },
  flags: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6, zIndex: 1 },
  flag: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 70 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.accent, fontSize: 16, fontWeight: '800' },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '700' },
  scopes: { color: Colors.textMuted, fontSize: 11 },
});
