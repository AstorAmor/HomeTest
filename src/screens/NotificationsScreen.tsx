import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
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
import { AppSection, SECTION_OPTIONS, useSections } from '@/data/appPrefs';
import { MUTE_OPTIONS, NudgeCategory, NudgeDecision, NudgeId, NudgePrefs, ReminderId } from '@/logic/nudges/types';
import { NUDGE_RULES } from '@/logic/nudges';
import {
  getPhoneStatus,
  openPhoneSettings,
  PhoneStatus,
  syncPhoneReminders,
  turnOffPhoneReminders,
  turnOnPhoneReminders,
  upcomingPhoneReminders,
} from '@/data/phoneReminders';

const STATUS: Record<NudgeDecision['status'], { label: string; color: string }> = {
  send: { label: 'Sent now', color: Colors.ok },
  muted: { label: 'Muted', color: Colors.textMuted },
  cooldown: { label: 'Waiting', color: Colors.gold },
  daily_limit: { label: 'Daily limit', color: Colors.attention },
  not_due: { label: 'Not due', color: Colors.textMuted },
};

// Qué avisa cada notificación y qué sección de la app necesita para poder mandarse: sin esa
// sección encendida el aviso nunca saltaría, así que su interruptor no se puede activar.
const NUDGE_INFO: Record<NudgeId, { description: string; needs?: AppSection[] }> = {
  inactive_7d: { description: 'If nothing has been logged for a week.' },
  checkin_missed_3d: { description: 'If you usually check in and then stop for a few days.', needs: ['checkin'] },
  low_energy_3d: { description: 'Three days in a row with low energy in your check-ins.', needs: ['checkin'] },
  low_energy_weeks: { description: 'Low energy for several weeks in your check-ins.', needs: ['checkin'] },
  short_sleep_3n: { description: 'Three nights in a row under 6 hours, from your wearable.', needs: ['wearables'] },
  short_sleep_weeks: { description: 'Several weeks of short sleep, from your wearable.', needs: ['wearables'] },
  period_late: { description: 'When your period is later than your usual cycle.', needs: ['cycle'] },
  fertility_doctor: { description: 'If you are trying to conceive, when guidelines suggest seeing a doctor.', needs: ['cycle'] },
  temperature_reminder: { description: 'A morning reminder if you track your temperature.', needs: ['cycle'] },
  bowel_none_3d: { description: 'Three days without a bowel movement.', needs: ['gut'] },
  stool_colour: { description: 'A stool colour you logged that nothing explains.', needs: ['gut'] },
  urine_dark: { description: 'Dark urine on several of the last few days.', needs: ['bladder'] },
  bathroom_weekly: { description: 'Once a week, a summary of what you logged and anything worth a look.' },
  medication_missed: { description: 'A dose you have not marked as taken.', needs: ['medication'] },
  bp_very_high: { description: 'A very high reading from your home blood pressure monitor.' },
  bp_high_weeks: { description: 'Blood pressure running high for several weeks.' },
  glucose_high_weeks: { description: 'Several high glucose readings over a few weeks.' },
};

const CATEGORY_ORDER: NudgeCategory[] = ['wellbeing', 'cycle', 'digestive', 'urinary', 'medication', 'measurements', 'engagement'];
const CATEGORY_LABEL: Record<NudgeCategory, string> = {
  wellbeing: 'Energy and sleep',
  cycle: 'Cycle',
  digestive: 'Digestion',
  urinary: 'Hydration',
  medication: 'Medication',
  measurements: 'Blood pressure and glucose',
  engagement: 'Reminders',
};

// Recordatorios que solo llegan al móvil (la temperatura y el check-in ya tienen su interruptor
// arriba y también salen en el móvil). Las tomas se eligen en cada medicamento.
const PHONE_ROWS: { id: 'doses' | ReminderId; label: string; description: string; needs?: AppSection }[] = [
  {
    id: 'doses',
    label: 'Medication and supplement doses',
    description: 'At their time, for each one with reminders on. You choose them in Medication & supplements.',
    needs: 'medication',
  },
  { id: 'weigh_in', label: 'Weekly weigh-in', description: 'A morning reminder a week after your last weigh-in.' },
];

const upcomingWhen = (d: Date) =>
  `${d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('Today');
  if (days === 1) return t('Yesterday');
  return t('{n} days ago', { n: days });
};

const label = (id: NudgeId) => t(NUDGE_RULES.find((r) => r.id === id)?.label ?? id);
const sectionTitle = (s: AppSection) => t(SECTION_OPTIONS.find((o) => o.id === s)?.title ?? s);

// Avisos: los recientes arriba y, debajo, todos los tipos de aviso desplegados con su
// interruptor. Apagar = silenciar para siempre; los silencios temporales (7 días, 1 mes…)
// se ponen desde cada aviso recibido. En el modo demo, "Why these notifications?" enseña cada
// regla con su motivo: lo mismo que npm run simulate, con los datos que hay ahora en la app.
export const NotificationsScreen = () => {
  const router = useRouter();
  const { authMode } = useAuth();
  const show = useSections();
  const [inbox, setInbox] = useDeepState<InboxItem[]>([]);
  const [decisions, setDecisions] = useDeepState<NudgeDecision[]>([]);
  const [prefs, setPrefs] = useDeepState<NudgePrefs>({ muted: {} });
  const [sim, setSim] = useDeepState<ActiveSimulation | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  // Avisos con la app cerrada: 'unsupported' en la web y en los APK sin expo-notifications
  const [phone, setPhone] = useDeepState<{ status: PhoneStatus; upcoming: { id: string; at: Date; title: string }[] }>({
    status: 'unsupported',
    upcoming: [],
  });

  const loadPhone = useCallback(async () => {
    const status = await getPhoneStatus();
    if (status === 'on') await syncPhoneReminders();
    setPhone({ status, upcoming: status === 'on' ? await upcomingPhoneReminders(3) : [] });
  }, [setPhone]);

  const load = useCallback(async () => {
    const result = await nudgeStore.refresh();
    setInbox(result.inbox);
    setDecisions(result.decisions);
    setPrefs(await nudgeStore.getPrefs());
    setSim(await activeSimulation());
    await nudgeStore.markAllRead();
    await loadPhone().catch(() => undefined);
  }, [setInbox, setDecisions, setPrefs, setSim, loadPhone]);
  useReloadOnFocus(load);

  const mute = async (id: NudgeId, option: (typeof MUTE_OPTIONS)[number]['id']) => {
    await nudgeStore.mute(id, option);
    setOpenMenu(null);
    setPrefs(await nudgeStore.getPrefs());
    loadPhone().catch(() => undefined);
  };
  const toggle = async (id: ReminderId, on: boolean) => {
    if (on) await nudgeStore.unmute(id);
    else await nudgeStore.mute(id, 'forever');
    setPrefs(await nudgeStore.getPrefs());
    loadPhone().catch(() => undefined);
  };
  const turnOnPhone = async () => {
    await turnOnPhoneReminders();
    await loadPhone();
  };
  const turnOffPhone = async () => {
    await turnOffPhoneReminders();
    await loadPhone();
  };

  const recent = inbox.filter((i) => Date.now() - new Date(i.at).getTime() < 30 * 86400000);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Notifications')} showBack backFallback="/settings" />
        <View style={styles.introRow}>
          <Text style={styles.intro}>{t('At most two a day, and you can switch off any of them.')}</Text>
          <InfoButton topic="notifications" />
        </View>

        {phone.status !== 'unsupported' && (
          <View style={styles.phoneCard}>
            <View style={styles.phoneHead}>
              <Ionicons name="phone-portrait-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.ruleTitle}>{t('On your phone')}</Text>
            </View>
            {phone.status === 'on' ? (
              <>
                <Text style={styles.ruleBody}>
                  {t('On, even with the app closed. Dose reminders do not count towards the two a day.')}
                </Text>
                <Text style={styles.phoneSub}>{t('Next reminders')}</Text>
                {phone.upcoming.length ? (
                  phone.upcoming.map((u) => (
                    <View key={u.id} style={styles.upcomingRow}>
                      <Text style={styles.upcomingWhen}>{upcomingWhen(u.at)}</Text>
                      <Text style={styles.upcomingTitle} numberOfLines={1}>
                        {u.title}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.ruleBody}>{t('Nothing scheduled for the next few days.')}</Text>
                )}
                <TouchableOpacity onPress={turnOffPhone} hitSlop={8}>
                  <Text style={styles.phoneOff}>{t('Turn off on this phone')}</Text>
                </TouchableOpacity>
              </>
            ) : phone.status === 'blocked' ? (
              <>
                <Text style={styles.ruleBody}>{t('Kuova notifications are off in your phone settings.')}</Text>
                <TouchableOpacity style={styles.phoneButton} onPress={openPhoneSettings} activeOpacity={0.85}>
                  <Text style={styles.phoneButtonText}>{t('Open settings')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.ruleBody}>{t('Get your reminders even when the app is closed.')}</Text>
                <TouchableOpacity style={styles.phoneButton} onPress={turnOnPhone} activeOpacity={0.85}>
                  <Text style={styles.phoneButtonText}>{t('Turn on')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {sim && (
          <TouchableOpacity style={styles.simBanner} onPress={() => router.push('/simulation')} activeOpacity={0.85}>
            <Ionicons name="flask-outline" size={18} color={Colors.gold} />
            <Text style={styles.simText}>{t('Simulated user: {name}. Tap to see the full timeline.', { name: sim.name })}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{t('Latest')}</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>{t('Nothing new. We only write when something is worth telling you.')}</Text>
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
                    <Text style={styles.itemTitle}>{t(item.title)}</Text>
                    {!!item.body && <Text style={styles.itemBody}>{t(item.body)}</Text>}
                    <Text style={styles.itemMeta}>
                      {ago(item.at)}
                      {isMuted ? ` · ${t('muted')}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setOpenMenu(openMenu === key ? null : key)} hitSlop={10}>
                    <Ionicons name="notifications-off-outline" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
                {openMenu === key && (
                  <View style={styles.muteMenu}>
                    <Text style={styles.muteTitle}>{t('Mute "{name}" for', { name: label(item.id) })}</Text>
                    <View style={styles.muteRow}>
                      {MUTE_OPTIONS.map((o) => (
                        <TouchableOpacity key={o.id} style={styles.muteChip} onPress={() => mute(item.id, o.id)}>
                          <Text style={styles.muteChipText}>{t(o.label)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>{t('What we can tell you about')}</Text>
        <Text style={styles.sectionIntro}>
          {t('They appear here and on Today. Each one only works with the part of the app it needs switched on.')}
        </Text>
        {CATEGORY_ORDER.map((cat) => {
          const rules = NUDGE_RULES.filter((r) => r.category === cat);
          if (!rules.length) return null;
          return (
            <View key={cat} style={styles.group}>
              <Text style={styles.groupTitle}>{t(CATEGORY_LABEL[cat])}</Text>
              {rules.map((r, i) => {
                const info = NUDGE_INFO[r.id];
                const needs = info.needs ?? [];
                const available = needs.length === 0 || needs.some(show);
                const m = prefs.muted[r.id];
                const on = available && !m;
                return (
                  <View key={r.id} style={[styles.ruleRow, i > 0 && styles.ruleDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ruleTitle, !available && styles.ruleOff]}>{t(r.label)}</Text>
                      <Text style={styles.ruleBody}>{t(info.description)}</Text>
                      {!available ? (
                        <TouchableOpacity onPress={() => router.push('/app-sections')}>
                          <Text style={styles.ruleNeeds}>
                            {t('Needs {section}: switch it on', { section: needs.map(sectionTitle).join(t(' or ')) })}
                          </Text>
                        </TouchableOpacity>
                      ) : m?.until ? (
                        <Text style={styles.itemMeta}>
                          {t('Muted until {date}', { date: new Date(m.until).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }) })}
                        </Text>
                      ) : null}
                    </View>
                    <Switch
                      value={on}
                      disabled={!available}
                      onValueChange={(v) => toggle(r.id, v)}
                      trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
                      thumbColor={on ? Colors.accent : Colors.textMuted}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}

        {phone.status !== 'unsupported' && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('On your phone')}</Text>
            {PHONE_ROWS.map((row, i) => {
              const available = !row.needs || show(row.needs);
              const m = row.id === 'doses' ? undefined : prefs.muted[row.id];
              const on = available && !m;
              return (
                <View key={row.id} style={[styles.ruleRow, i > 0 && styles.ruleDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ruleTitle, !available && styles.ruleOff]}>{t(row.label)}</Text>
                    <Text style={styles.ruleBody}>{t(row.description)}</Text>
                    {!available && row.needs ? (
                      <TouchableOpacity onPress={() => router.push('/app-sections')}>
                        <Text style={styles.ruleNeeds}>{t('Needs {section}: switch it on', { section: sectionTitle(row.needs) })}</Text>
                      </TouchableOpacity>
                    ) : m?.until ? (
                      <Text style={styles.itemMeta}>
                        {t('Muted until {date}', { date: new Date(m.until).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }) })}
                      </Text>
                    ) : null}
                  </View>
                  {row.id === 'doses' ? (
                    available && (
                      <TouchableOpacity onPress={() => router.push('/medications')} hitSlop={10} accessibilityLabel={t(row.label)}>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )
                  ) : (
                    <Switch
                      value={on}
                      disabled={!available}
                      onValueChange={(v) => toggle(row.id as ReminderId, v)}
                      trackColor={{ false: Colors.cardBorder, true: withAlpha(Colors.accent, 0.6) }}
                      thumbColor={on ? Colors.accent : Colors.textMuted}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {authMode === 'demo' && (
          <>
            <TouchableOpacity style={styles.whyHeader} onPress={() => setShowWhy((v) => !v)}>
              <Text style={styles.sectionTitleInline}>{t('Why these notifications?')}</Text>
              <Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showWhy &&
              decisions.map((d) => (
                <View key={d.id} style={styles.whyRow}>
                  <View style={[styles.statusPill, { backgroundColor: withAlpha(STATUS[d.status].color, 0.14) }]}>
                    <Text style={[styles.statusText, { color: STATUS[d.status].color }]}>{t(STATUS[d.status].label)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whyTitle}>{t(d.label)}</Text>
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
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 4 },
  intro: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20 },
  simBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: withAlpha(Colors.gold, 0.12),
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
  },
  simText: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  phoneCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    gap: 4,
  },
  phoneHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  phoneSub: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: 10 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  upcomingWhen: { color: Colors.textSecondary, fontSize: 12, minWidth: 104 },
  upcomingTitle: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  phoneButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  phoneButtonText: { color: Colors.background, fontSize: 13, fontWeight: '700' },
  phoneOff: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 10 },
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
  sectionIntro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, marginTop: -4, marginBottom: 12 },
  sectionTitleInline: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  group: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  groupTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  ruleDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  ruleTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  ruleOff: { color: Colors.textMuted },
  ruleBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  ruleNeeds: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 4 },
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
