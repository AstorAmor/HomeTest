import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { Colors } from '@/constants/colors';
import { isPortalDemo, portal } from '@/data/specialistPortal';
import { DEMO_PATIENT_COUNTS } from '@/data/demoPatients';
import { PatientSummary } from '@/data/specialistTypes';
import { scopeLabel } from '@/data/sharing';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

import { dateLocale, t } from '@/i18n';
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const shortDay = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// Por qué no se ven sus datos: aún no ha compartido, el permiso caducó o lo retiró
const shareNote = (p: PatientSummary) =>
  p.shareState === 'expired'
    ? t('Sharing expired on {date}', { date: shortDay(p.shareUntil ?? new Date().toISOString()) })
    : p.shareState === 'revoked'
      ? t('Stopped sharing on {date}', { date: shortDay(p.shareUntil ?? new Date().toISOString()) })
      : t('Hasn’t shared data with you yet');

const when = (iso: string) =>
  new Date(iso).toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// C. Mis pacientes: en bloques (tarjetas con avisos arriba a la derecha: triángulo = acciones
// pendientes o valores alterados; teléfono = consulta hoy) o en lista, uno debajo de otro. Las dos
// vistas se ordenan por fecha (última novedad) o por nombre; la elección se recuerda.
type ViewMode = 'blocks' | 'list';
type SortMode = 'date' | 'name';
const VIEW_KEY = 'pro.patientsView.v1';
export const ProPatientsScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const [patients, setPatients] = useDeepState<PatientSummary[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const demo = isPortalDemo();
  const [count, setCount] = useState(4); // demo: cuántos pacientes de ejemplo
  const [view, setView] = useState<ViewMode>('blocks');
  const [sort, setSort] = useState<SortMode>('date');

  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY)
      .then((v) => {
        const saved = v ? (JSON.parse(v) as { view?: ViewMode; sort?: SortMode }) : null;
        if (saved?.view) setView(saved.view);
        if (saved?.sort) setSort(saved.sort);
      })
      .catch(() => undefined);
  }, []);
  const choose = (next: { view?: ViewMode; sort?: SortMode }) => {
    const v = next.view ?? view;
    const so = next.sort ?? sort;
    setView(v);
    setSort(so);
    AsyncStorage.setItem(VIEW_KEY, JSON.stringify({ view: v, sort: so })).catch(() => undefined);
  };

  const load = useCallback(async () => {
    try {
      setPatients(await portal.listPatients());
      if (isPortalDemo()) setCount(await portal.demoPatientCount());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not load patients'));
    }
  }, [setPatients]);
  useReloadOnFocus(load);

  const simulate = async (n: number) => {
    await portal.setDemoPatientCount(n);
    await load();
  };

  const shown = patients
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, dateLocale())
        : (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '') || a.name.localeCompare(b.name, dateLocale()),
    );
  const open = (p: PatientSummary) => router.push({ pathname: '/pro-patient', params: { id: p.id } });
  const alerts = patients.filter((p) => p.openRequests > 0 || p.flaggedMarkers > 0 || p.unreadMessages > 0).length;
  const sharing = patients.filter((p) => p.scopes.length > 0).length;

  return (
    <ProLayout active="patients" title={t('My patients')} badge={{ patients: alerts }}>
      {demo && (
        <View style={styles.simRow}>
          <Ionicons name="people-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.simLabel}>{t('Sample patients')}</Text>
          {DEMO_PATIENT_COUNTS.map((n) => (
            <TouchableOpacity key={n} style={[styles.simChip, count === n && styles.simChipOn]} onPress={() => simulate(n)}>
              <Text style={[styles.simChipText, count === n && { color: Colors.background }]}>{n}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.simInfo}>{t('{n} share data with you', { n: sharing })}</Text>
        </View>
      )}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('Search patients')}
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          {(
            [
              { id: 'blocks', icon: 'grid-outline', label: t('Blocks') },
              { id: 'list', icon: 'list-outline', label: t('List') },
            ] as const
          ).map((o) => (
            <TouchableOpacity key={o.id} style={[styles.segBtn, view === o.id && styles.segBtnOn]} onPress={() => choose({ view: o.id })}>
              <Ionicons name={o.icon} size={15} color={view === o.id ? Colors.background : Colors.textSecondary} />
              <Text style={[styles.segText, view === o.id && styles.segTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>{t('Sort by')}</Text>
          <View style={styles.segment}>
            {(
              [
                { id: 'date', label: t('Date') },
                { id: 'name', label: t('Name') },
              ] as const
            ).map((o) => (
              <TouchableOpacity key={o.id} style={[styles.segBtn, sort === o.id && styles.segBtnOn]} onPress={() => choose({ sort: o.id })}>
                <Text style={[styles.segText, sort === o.id && styles.segTextOn]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && patients.length === 0 && (
        <Text style={styles.empty}>
          {t('Patients appear here when they share their data with you, book a consultation, send you a request or open a chat.')}
        </Text>
      )}

      {view === 'list' && shown.length > 0 && (
        <View style={styles.list}>
          {wide && (
            <View style={[styles.listRow, styles.listHead]}>
              <Text style={[styles.headCell, { flex: 1.5 }]}>{t('Patient')}</Text>
              <Text style={[styles.headCell, { flex: 2 }]}>{t('Shares')}</Text>
              <Text style={[styles.headCell, { flex: 1.4 }]}>{t('Alerts')}</Text>
              <Text style={[styles.headCell, styles.dateCell]}>{t('Date')}</Text>
              <View style={{ width: 16 }} />
            </View>
          )}
          {shown.map((p, i) => {
            const warn = p.openRequests > 0 || p.flaggedMarkers > 0;
            return (
              <TouchableOpacity key={p.id} style={[styles.listRow, i > 0 && styles.listDivider]} onPress={() => open(p)} activeOpacity={0.8}>
                <View style={[styles.nameCell, { flex: 1.5 }]}>
                  <View style={styles.avatarSm}>
                    <Text style={styles.avatarSmText}>{initials(p.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {[p.age ? t('{n} y', { n: p.age }) : null, p.sex ? t(p.sex) : null].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>
                </View>
                {wide && (
                  <View style={[styles.lockRow, { flex: 2 }]}>
                    {!p.scopes.length && <Ionicons name="lock-closed-outline" size={12} color={Colors.textMuted} />}
                    <Text style={styles.scopes} numberOfLines={1}>
                      {p.scopes.length ? p.scopes.map((x) => t(scopeLabel(x))).join(', ') : shareNote(p)}
                    </Text>
                  </View>
                )}
                <View style={[styles.alertCell, { flex: wide ? 1.4 : undefined }]}>
                  {p.appointmentToday && <Ionicons name="call" size={14} color={Colors.accent} />}
                  {warn && <Ionicons name="warning" size={14} color={Colors.attention} />}
                  {p.unreadMessages > 0 && <Ionicons name="chatbubble" size={13} color={Colors.accent} />}
                  {wide && p.flaggedMarkers > 0 && <Text style={styles.alertText}>{t(p.flaggedMarkers === 1 ? '{n} value out of range' : '{n} values out of range', { n: p.flaggedMarkers })}</Text>}
                </View>
                <Text style={[styles.listDate, styles.dateCell]}>{p.lastActivity ? shortDay(p.lastActivity) : '—'}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={[styles.grid, wide && styles.gridWide, view === 'list' && { display: 'none' }]}>
        {shown.map((p) => {
          const warn = p.openRequests > 0 || p.flaggedMarkers > 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, wide && styles.cardWide]}
              activeOpacity={0.85}
              onPress={() => open(p)}
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
                    {[p.age ? t('{n} y', { n: p.age }) : null, p.sex ? t(p.sex) : null].filter(Boolean).join(' · ') || (p.scopes.length ? t('{n} data categories shared', { n: p.scopes.length }) : t('No data shared yet'))}
                  </Text>
                </View>
              </View>
              <View style={styles.chips}>
                {p.flaggedMarkers > 0 && <Chip icon="flask" color={Colors.attention} text={t(p.flaggedMarkers === 1 ? '{n} value out of range' : '{n} values out of range', { n: p.flaggedMarkers })} />}
                {p.openRequests > 0 && <Chip icon="help-circle" color={Colors.attention} text={t(p.openRequests === 1 ? '{n} pending request' : '{n} pending requests', { n: p.openRequests })} />}
                {p.unreadMessages > 0 && <Chip icon="chatbubble" color={Colors.accent} text={t(p.unreadMessages === 1 ? '{n} new message' : '{n} new messages', { n: p.unreadMessages })} />}
                {p.nextAppointment && <Chip icon="calendar" color={Colors.textSecondary} text={when(p.nextAppointment)} />}
              </View>
              {p.scopes.length > 0 ? (
                <Text style={styles.scopes} numberOfLines={1}>
                  {t('Shares: {what}', { what: p.scopes.map((s) => t(scopeLabel(s))).join(', ') })}
                </Text>
              ) : (
                <View style={styles.lockRow}>
                  <Ionicons name="lock-closed-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.scopes} numberOfLines={1}>
                    {shareNote(p)}
                  </Text>
                </View>
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
  simRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  simLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  simChip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  simChipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  simChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800' },
  simInfo: { color: Colors.textMuted, fontSize: 12 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
  scopes: { color: Colors.textMuted, fontSize: 11, flexShrink: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  segment: { flexDirection: 'row', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 3 },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 13 },
  segBtnOn: { backgroundColor: Colors.accent },
  segText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: Colors.background },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  list: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingHorizontal: 14 },
  listHead: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  headCell: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarSm: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarSmText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  listName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  alertCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertText: { color: Colors.attention, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  dateCell: { width: 64, textAlign: 'right' },
  listDate: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
});
