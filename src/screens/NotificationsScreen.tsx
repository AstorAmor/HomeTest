import { dateLocale } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { Colors, withAlpha } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { InboxItem, nudgeStore } from '@/data/nudgeStore';
import { activeSimulation, ActiveSimulation } from '@/data/simulation';
import { MUTE_OPTIONS, NudgeDecision, NudgeId, NudgePrefs } from '@/logic/nudges/types';
import { NUDGE_RULES } from '@/logic/nudges';

const STATUS: Record<NudgeDecision['status'], { label: string; color: string }> = {
  send: { label: 'Sent now', color: Colors.ok },
  muted: { label: 'Muted', color: Colors.textMuted },
  cooldown: { label: 'Waiting', color: Colors.gold },
  daily_limit: { label: 'Daily limit', color: Colors.attention },
  not_due: { label: 'Not due', color: Colors.textMuted },
};

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

const label = (id: NudgeId) => NUDGE_RULES.find((r) => r.id === id)?.label ?? id;

// Bandeja de avisos. Cada aviso se puede silenciar 7 días, 1 mes, 3 meses o para siempre, y se
// reactiva desde aquí. En el modo demo, "Why these notifications?" enseña cada regla con su
// motivo: lo mismo que npm run simulate, pero con los datos que hay ahora en la app.
export const NotificationsScreen = () => {
  const router = useRouter();
  const { authMode } = useAuth();
  const [inbox, setInbox] = useDeepState<InboxItem[]>([]);
  const [decisions, setDecisions] = useDeepState<NudgeDecision[]>([]);
  const [prefs, setPrefs] = useDeepState<NudgePrefs>({ muted: {} });
  const [sim, setSim] = useDeepState<ActiveSimulation | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const load = useCallback(async () => {
    const result = await nudgeStore.refresh();
    setInbox(result.inbox);
    setDecisions(result.decisions);
    setPrefs(await nudgeStore.getPrefs());
    setSim(await activeSimulation());
    await nudgeStore.markAllRead();
  }, [setInbox, setDecisions, setPrefs, setSim]);
  useReloadOnFocus(load);

  const mute = async (id: NudgeId, option: (typeof MUTE_OPTIONS)[number]['id']) => {
    await nudgeStore.mute(id, option);
    setOpenMenu(null);
    setPrefs(await nudgeStore.getPrefs());
  };
  const unmute = async (id: NudgeId) => {
    await nudgeStore.unmute(id);
    setPrefs(await nudgeStore.getPrefs());
  };

  const muted = Object.entries(prefs.muted) as [NudgeId, { until: string | null; setAt: string }][];
  const recent = inbox.filter((i) => Date.now() - new Date(i.at).getTime() < 30 * 86400000);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Notifications" showBack />
        <View style={styles.introRow}>
          <Text style={styles.intro}>At most two a day, and you can mute any of them.</Text>
          <InfoButton topic="notifications" />
        </View>

        {sim && (
          <TouchableOpacity style={styles.simBanner} onPress={() => router.push('/simulation')} activeOpacity={0.85}>
            <Ionicons name="flask-outline" size={18} color={Colors.gold} />
            <Text style={styles.simText}>Simulated user: {sim.name}. Tap to see the full timeline.</Text>
          </TouchableOpacity>
        )}

        {recent.length === 0 ? (
          <Text style={styles.empty}>Nothing new. We only write when something is worth telling you.</Text>
        ) : (
          recent.map((item) => {
            const key = `${item.id}-${item.at}`;
            const isMuted = !!prefs.muted[item.id];
            return (
              <View key={key} style={styles.item}>
                <TouchableOpacity
                  style={styles.itemMain}
                  onPress={() => item.route && router.push(item.route as Href)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.dot, !item.read && styles.dotUnread]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {!!item.body && <Text style={styles.itemBody}>{item.body}</Text>}
                    <Text style={styles.itemMeta}>
                      {ago(item.at)}
                      {isMuted ? ' · muted' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setOpenMenu(openMenu === key ? null : key)} hitSlop={10}>
                    <Ionicons name="notifications-off-outline" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
                {openMenu === key && (
                  <View style={styles.muteMenu}>
                    <Text style={styles.muteTitle}>Mute "{label(item.id)}" for</Text>
                    <View style={styles.muteRow}>
                      {MUTE_OPTIONS.map((o) => (
                        <TouchableOpacity key={o.id} style={styles.muteChip} onPress={() => mute(item.id, o.id)}>
                          <Text style={styles.muteChipText}>{o.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        {muted.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Muted</Text>
            {muted.map(([id, m]) => (
              <View key={id} style={styles.mutedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{label(id)}</Text>
                  <Text style={styles.itemMeta}>
                    {m.until ? `Until ${new Date(m.until).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' })}` : 'For good'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => unmute(id)}>
                  <Text style={styles.link}>Turn back on</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {authMode === 'demo' && (
          <>
            <TouchableOpacity style={styles.whyHeader} onPress={() => setShowWhy((v) => !v)}>
              <Text style={styles.sectionTitleInline}>Why these notifications?</Text>
              <Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showWhy &&
              decisions.map((d) => (
                <View key={d.id} style={styles.whyRow}>
                  <View style={[styles.statusPill, { backgroundColor: withAlpha(STATUS[d.status].color, 0.14) }]}>
                    <Text style={[styles.statusText, { color: STATUS[d.status].color }]}>{STATUS[d.status].label}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whyTitle}>{d.label}</Text>
                    <Text style={styles.itemBody}>{d.reason}</Text>
                  </View>
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 12 },
  intro: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginTop: 8 },
  simBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: withAlpha(Colors.gold, 0.12),
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  simText: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  item: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },
  itemMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: 'transparent' },
  dotUnread: { backgroundColor: Colors.green },
  itemTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  itemBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  itemMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  muteMenu: { borderTopWidth: 1, borderTopColor: Colors.divider, padding: 12, gap: 8 },
  muteTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  muteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muteChip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.background,
  },
  muteChipText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  sectionTitleInline: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  mutedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, minWidth: 74, alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '700' },
  whyTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
});
