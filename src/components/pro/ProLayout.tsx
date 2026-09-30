import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/data/sharing';
import { isPortalDemo } from '@/data/specialistPortal';

// Portal del especialista. Web de escritorio (≥ 900 px): barra lateral fija y
// contenido ancho. Móvil / web estrecha: pestañas abajo como en una app.
export const useIsWide = () => {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 900;
};

export type ProSection = 'agenda' | 'patients' | 'inbox' | 'settings';

const NAV: { id: ProSection; label: string; icon: string; href: string }[] = [
  { id: 'agenda', label: 'Agenda', icon: 'calendar-outline', href: '/pro' },
  { id: 'patients', label: 'Patients', icon: 'people-outline', href: '/pro-patients' },
  { id: 'inbox', label: 'Inbox', icon: 'chatbubbles-outline', href: '/pro-inbox' },
  { id: 'settings', label: 'Profile', icon: 'person-circle-outline', href: '/pro-settings' },
];

// Identidad visible del especialista (real o de demo).
export const useProIdentity = () => {
  const { professional } = useAuth();
  if (professional) {
    return {
      name: professional.displayName,
      role: roleLabel(professional.role),
      photoUrl: professional.photoUrl,
      verified: professional.verified,
      demo: false,
    };
  }
  return { name: 'Dra. Marta Echeverría', role: 'Doctor', photoUrl: null as string | null, verified: true, demo: true };
};

interface Props {
  active: ProSection;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean; // false cuando la pantalla gestiona su propio scroll
  badge?: Partial<Record<ProSection, number>>;
}

export const ProLayout = ({ active, title, right, children, scroll = true, badge }: Props) => {
  const router = useRouter();
  const wide = useIsWide();
  const me = useProIdentity();
  const { logout } = useAuth();
  const go = (href: string) => router.replace(href as any);

  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, wide && styles.bodyWideFlex]}>{children}</View>
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{right}</View>
    </View>
  );

  const banners = (
    <>
      {isPortalDemo() && (
        <View style={styles.demo}>
          <Ionicons name="flask-outline" size={14} color={Colors.warning} />
          <Text style={styles.demoText}>Demo portal · sample patients, nothing is sent</Text>
        </View>
      )}
      {!me.verified && (
        <View style={styles.demo}>
          <Ionicons name="time-outline" size={14} color={Colors.warning} />
          <Text style={styles.demoText}>Your account is being verified by HomeTest. Patients can't find you yet.</Text>
        </View>
      )}
    </>
  );

  if (wide) {
    return (
      <View style={styles.wideRoot}>
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <Text style={styles.brandText}>HomeTest</Text>
            <Text style={styles.brandSub}>for specialists</Text>
          </View>
          {NAV.map((n) => {
            const on = n.id === active;
            return (
              <TouchableOpacity key={n.id} style={[styles.navItem, on && styles.navItemOn]} onPress={() => go(n.href)}>
                <Ionicons name={n.icon as any} size={20} color={on ? Colors.accent : Colors.textSecondary} />
                <Text style={[styles.navText, on && { color: Colors.textPrimary }]}>{n.label}</Text>
                {!!badge?.[n.id] && <Text style={styles.navBadge}>{badge[n.id]}</Text>}
              </TouchableOpacity>
            );
          })}
          <View style={{ flex: 1 }} />
          <View style={styles.me}>
            {me.photoUrl ? (
              <Image source={{ uri: me.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.avatarText}>{me.name.replace(/^(Dr|Dra)\.\s*/, '').slice(0, 1)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.meName} numberOfLines={1}>
                {me.name}
              </Text>
              <Text style={styles.meRole}>{me.role}</Text>
            </View>
            <TouchableOpacity onPress={logout} hitSlop={10}>
              <Ionicons name="log-out-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.main}>
          {header}
          {banners}
          {body}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {header}
      {banners}
      {body}
      <View style={styles.tabBar}>
        {NAV.map((n) => {
          const on = n.id === active;
          return (
            <TouchableOpacity key={n.id} style={styles.tab} onPress={() => go(n.href)}>
              <View>
                <Ionicons name={n.icon as any} size={22} color={on ? Colors.tabBarActive : Colors.tabBarInactive} />
                {!!badge?.[n.id] && <View style={styles.tabDot} />}
              </View>
              <Text style={[styles.tabText, on && { color: Colors.tabBarActive }]}>{n.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  wideRoot: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  sidebar: {
    width: 230,
    backgroundColor: Colors.backgroundElevated,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 4,
  },
  brand: { paddingHorizontal: 10, marginBottom: 18 },
  brandText: { color: Colors.textPrimary, fontSize: 20, fontWeight: '900' },
  brandSub: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10 },
  navItemOn: { backgroundColor: Colors.accentSoft },
  navText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700', flex: 1 },
  navBadge: { color: Colors.background, backgroundColor: Colors.accent, fontSize: 11, fontWeight: '800', borderRadius: 9, paddingHorizontal: 6, overflow: 'hidden' },
  me: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 12, paddingHorizontal: 6 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarEmpty: { backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.accent, fontWeight: '800' },
  meName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  meRole: { color: Colors.textSecondary, fontSize: 11 },
  main: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 8 },
  demoText: { color: Colors.warning, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 32 },
  bodyWide: { paddingHorizontal: 28, maxWidth: 1180, width: '100%' },
  bodyWideFlex: { paddingHorizontal: 8 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.tabBarBorder, backgroundColor: Colors.tabBarBackground, paddingTop: 8, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabText: { color: Colors.tabBarInactive, fontSize: 11, fontWeight: '600' },
  tabDot: { position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
});
