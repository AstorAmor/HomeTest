import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { KuovaWordmark } from '@/components/KuovaLogo';
import { IntestineIcon } from '@/components/IntestineIcon';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/context/AuthContext';
import { AppSection, useSections } from '@/data/appPrefs';
import { mockPatient } from '@/data/mockData';
import { t } from '@/i18n';
import { useWebShell } from '@/web/webMode';

// Web del paciente en escritorio (estilo Salud de Apple): columna de menú a la izquierda y la
// pantalla elegida en el centro, en una columna de ancho limitado (bloques, no a lo ancho de
// toda la pantalla). Envuelve el Stack raíz; con la vista de app normal no pinta nada extra.

interface NavItem {
  id: string;
  label: string;
  icon: string; // Ionicons, o 'intestine' para el icono propio
  color: string;
  pathname: string;
  params?: Record<string, string>;
  tab?: number; // pestañas de la app (/(tabs)?tab=N)
  section?: AppSection; // se oculta si esa parte de la app está apagada
}

const TOP: NavItem[] = [
  { id: 'summary', label: 'Summary', icon: 'heart-circle-outline', color: Colors.accent, pathname: '/resumen' },
  { id: 'today', label: 'Today', icon: 'sunny-outline', color: Colors.gold, pathname: '/(tabs)', tab: 0 },
  { id: 'sharing', label: 'Sharing', icon: 'people-outline', color: Colors.sky, pathname: '/sharing' },
];

const CATEGORIES: NavItem[] = [
  { id: 'lab', label: 'Lab results', icon: 'flask', color: Colors.danger, pathname: '/(tabs)', tab: 3 },
  { id: 'mydata', label: 'My Data', icon: 'pulse', color: Colors.accent, pathname: '/(tabs)', tab: 1 },
  { id: 'activity', label: 'Activity', icon: 'flame', color: Colors.coral, pathname: '/metric', params: { kind: 'steps' }, section: 'wearables' },
  { id: 'sleep', label: 'Sleep', icon: 'bed', color: Colors.sky, pathname: '/metric', params: { kind: 'sleep_duration' }, section: 'wearables' },
  { id: 'heart', label: 'Heart', icon: 'heart', color: Colors.danger, pathname: '/metric', params: { kind: 'resting_heart_rate' }, section: 'wearables' },
  { id: 'bp', label: 'Blood pressure', icon: 'speedometer', color: Colors.violet, pathname: '/blood-pressure-detail' },
  { id: 'glucose', label: 'Glucose', icon: 'water', color: Colors.amber, pathname: '/glucose-detail' },
  { id: 'cycle', label: 'Cycle', icon: 'rose', color: Colors.pinkSoft, pathname: '/cycle-detail', section: 'cycle' },
  { id: 'gut', label: 'Gut', icon: 'intestine', color: Colors.green, pathname: '/digestive', params: { part: 'gut' }, section: 'gut' },
  { id: 'bladder', label: 'Bladder', icon: 'water-outline', color: Colors.gold, pathname: '/digestive', params: { part: 'bladder' }, section: 'bladder' },
  { id: 'meds', label: 'Medication', icon: 'medical', color: Colors.gold, pathname: '/medications', section: 'medication' },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition', color: Colors.green, pathname: '/nutrients' },
  { id: 'genetics', label: 'Family history', icon: 'git-network-outline', color: Colors.violet, pathname: '/genetic-profile' },
];

const PLAN: NavItem[] = [
  { id: 'plans', label: 'My plan', icon: 'list', color: Colors.accent, pathname: '/plans', section: 'plan' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar', color: Colors.sky, pathname: '/(tabs)', tab: 2 },
  { id: 'tracking', label: 'Track your tests', icon: 'cube-outline', color: Colors.amber, pathname: '/track-tests' },
  { id: 'pros', label: 'Professionals', icon: 'chatbubbles-outline', color: Colors.green, pathname: '/professionals' },
];

const ACCOUNT: NavItem[] = [
  { id: 'subscription', label: 'My subscription', icon: 'star-outline', color: Colors.gold, pathname: '/subscription' },
  { id: 'store', label: 'Test catalogue', icon: 'pricetags-outline', color: Colors.coral, pathname: '/store', params: { view: 'tests' } },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', color: Colors.textSecondary, pathname: '/settings' },
];

const ALL = [...TOP, ...CATEGORIES, ...PLAN, ...ACCOUNT];

// Pantallas que van a pantalla completa, sin menú: entrada, onboarding y el portal del médico
const FULL_SCREEN = ['/login', '/onboarding', '/results-ready', '/plan-intro', '/report-intro', '/exercise', '/video'];
const isProRoute = (p: string) => /^\/pro(-|$|\/)/.test(p);

function useCurrent() {
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const params = useGlobalSearchParams<Record<string, string>>();
  const inTabs = segments[0] === '(tabs)';
  const tab = Number(params.tab ?? 0) || 0;
  const active = ALL.find((n) =>
    n.tab !== undefined
      ? inTabs && tab === n.tab
      : pathname === n.pathname && Object.entries(n.params ?? {}).every(([k, v]) => params[k] === v),
  );
  return { pathname, inTabs, active };
}

// true si el menú lateral está a la vista (la pantalla actual sale en la columna central)
export function useInWebShell(): boolean {
  const on = useWebShell();
  const { isLoggedIn, demoMode, professional } = useAuth();
  const { pathname, inTabs } = useCurrent();
  if (!on || !isLoggedIn || demoMode === 'pro' || professional) return false;
  if (FULL_SCREEN.includes(pathname) || isProRoute(pathname)) return false;
  return inTabs || pathname !== '/';
}

// La pantalla actual es una entrada del menú: sin flecha de "atrás" (se navega con el menú)
export function useIsShellRoot(): boolean {
  const inShell = useInWebShell();
  const { active } = useCurrent();
  return inShell && !!active;
}

const NavIcon = ({ item, on }: { item: NavItem; on: boolean }) =>
  item.icon === 'intestine' ? (
    <IntestineIcon size={19} color={item.color} />
  ) : (
    <Ionicons name={item.icon as any} size={19} color={on ? item.color : item.color} />
  );

export const WebShell = ({ children }: { children: React.ReactNode }) => {
  const inShell = useInWebShell();
  if (!inShell) return <>{children}</>;
  return <ShellFrame>{children}</ShellFrame>;
};

const ShellFrame = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const show = useSections();
  const { user } = useAuth();
  const { pathname, active } = useCurrent();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ categories: true, plan: true, account: true });

  const visible = (n: NavItem) => !n.section || show(n.section);
  const q = query.trim().toLowerCase();
  const matches = (n: NavItem) => !q || t(n.label).toLowerCase().includes(q);

  const go = (n: NavItem) => {
    setQuery('');
    if (n.tab !== undefined) router.navigate({ pathname: '/(tabs)', params: { tab: String(n.tab) } } as any);
    else router.navigate({ pathname: n.pathname, params: n.params } as any);
  };

  const groups = useMemo(
    () => [
      { id: 'top', title: null as string | null, items: TOP },
      { id: 'categories', title: 'Health categories', items: CATEGORIES },
      { id: 'plan', title: 'Plan and tests', items: PLAN },
      { id: 'account', title: 'Account', items: ACCOUNT },
    ],
    [],
  );

  // El resumen usa más ancho (rejilla de bloques); el resto, una columna cómoda de leer
  const maxWidth = pathname === '/resumen' ? 1180 : 760;

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.brand}>
          <KuovaWordmark height={17} color={Colors.isLight ? Colors.accent : Colors.textPrimary} />
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search')}
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={() => {
              const first = ALL.filter(visible).find(matches);
              if (first && q) go(first);
            }}
          />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {groups.map((g) => {
            const items = g.items.filter((n) => visible(n) && matches(n));
            if (!items.length) return null;
            const expanded = !g.title || q || open[g.id];
            return (
              <View key={g.id} style={g.title ? styles.group : styles.groupTop}>
                {g.title && (
                  <TouchableOpacity style={styles.groupHeader} onPress={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}>
                    <Text style={styles.groupTitle}>{t(g.title)}</Text>
                    <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
                {expanded &&
                  items.map((n) => {
                    const on = active?.id === n.id;
                    return (
                      <TouchableOpacity key={n.id} style={[styles.item, on && styles.itemOn]} onPress={() => go(n)} activeOpacity={0.8}>
                        <NavIcon item={n} on={on} />
                        <Text style={[styles.itemText, on && styles.itemTextOn]} numberOfLines={1}>
                          {t(n.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.me} onPress={() => router.navigate('/profile')} activeOpacity={0.8}>
          <UserAvatar size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.meName} numberOfLines={1}>
              {user?.nombre || mockPatient.nombre}
            </Text>
            <Text style={styles.meSub}>{t('Profile')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.main}>
        <View style={[styles.column, { maxWidth }]}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  sidebar: {
    width: 264,
    margin: 12,
    marginRight: 0,
    paddingTop: 18,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderRadius: 22,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOpacity: Colors.isLight ? 0.06 : 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  brand: { paddingHorizontal: 10, marginBottom: 14 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(Colors.textMuted, 0.1),
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 8 },
  groupTop: { marginBottom: 6 },
  group: { marginTop: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6 },
  groupTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  itemOn: { backgroundColor: Colors.accentSoft },
  itemText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500', flex: 1 },
  itemTextOn: { fontWeight: '800' },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  meName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  meSub: { color: Colors.textMuted, fontSize: 11 },
  main: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%' },
});
