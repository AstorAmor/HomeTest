import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { DeliveryHelp } from '@/components/DeliveryHelp';
import { Chev, FRow, Pill, SecHead } from '@/components/fine/Fine';
import { FChip, FLink } from '@/components/fine/FineForm';
import { SecRow } from '@/components/fine/FineMeasure';
import { SetRow, SwitchRow, settingsStyles } from '@/components/settings/SettingsParts';
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
import { FINE, ff, fine } from '@/theme/fine';

// Sin rojo ni naranja: lo enviado en jade, lo retenido en oro (para mirarlo) y lo demás apagado
const STATUS: Record<NudgeDecision['status'], { label: string; color: string }> = {
  send: { label: 'Sent now', color: FINE.jade },
  muted: { label: 'Muted', color: FINE.mute },
  cooldown: { label: 'Waiting', color: FINE.gold },
  daily_limit: { label: 'Daily limit', color: FINE.gold },
  not_due: { label: 'Not due', color: FINE.mute },
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
const mutedUntil = (until: string) =>
  t('Muted until {date}', { date: new Date(until).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }) });

// Avisos: los recientes arriba y, debajo, todos los tipos de aviso desplegados con su
// interruptor. Apagar = silenciar para siempre; los silencios temporales (7 días, 1 mes…)
// se ponen desde cada aviso recibido. En el modo demo, "Why these notifications?" enseña cada
// regla con su motivo: lo mismo que npm run simulate, con los datos que hay ahora en la app.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: cabeceras pequeñas y filas con línea fina (sin tarjetas);
// cada grupo de avisos con su nombre pequeño encima; «En el móvil» como una sección más, con la píldora esmeralda
// para activarlo; el usuario simulado, una línea en oro; y los estados del modo demo sin rojo ni naranja.
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

  // «Necesita X: actívala» (lleva a Configura tu experiencia), en jade debajo de la explicación
  const needsLink = (text: string) => (
    <TouchableOpacity onPress={() => router.push('/app-sections')} hitSlop={6} style={styles.needs} accessibilityRole="link">
      <Text style={styles.needsText}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Notifications')} showBack backFallback="/settings" />

        <View style={settingsStyles.body}>
          <View style={styles.introRow}>
            <Text style={styles.intro}>{t('At most two a day, and you can switch off any of them.')}</Text>
            <InfoButton topic="notifications" color={FINE.mute} />
          </View>

          {phone.status !== 'unsupported' && (
            <>
              <SecHead title={t('On your phone')} />
              {phone.status === 'on' ? (
                <>
                  <Text style={styles.text}>{t('On, even with the app closed. Dose reminders do not count towards the two a day.')}</Text>
                  <Text style={styles.kicker}>{t('Next reminders')}</Text>
                  {phone.upcoming.length ? (
                    phone.upcoming.map((u, i) => (
                      <View key={u.id} style={[styles.upcomingRow, i === phone.upcoming.length - 1 && settingsStyles.noLine]}>
                        <Text style={styles.upcomingWhen}>{upcomingWhen(u.at)}</Text>
                        <Text style={styles.upcomingTitle} numberOfLines={1}>
                          {u.title}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.text}>{t('Nothing scheduled for the next few days.')}</Text>
                  )}
                  <FLink label={t('Turn off on this phone')} onPress={turnOffPhone} muted style={settingsStyles.linkLeft} />
                </>
              ) : phone.status === 'blocked' ? (
                <>
                  <Text style={styles.text}>{t('Kuova notifications are off in your phone settings.')}</Text>
                  <View style={styles.pillRow}>
                    <Pill label={t('Open settings')} onPress={openPhoneSettings} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.text}>{t('Get your reminders even when the app is closed.')}</Text>
                  <View style={styles.pillRow}>
                    <Pill label={t('Turn on')} onPress={turnOnPhone} />
                  </View>
                </>
              )}
              {phone.status === 'on' && <DeliveryHelp />}
            </>
          )}

          {/* Probadores: el usuario simulado cargado, en oro (es algo que mirar) */}
          {sim && (
            <TouchableOpacity style={styles.simRow} onPress={() => router.push('/simulation')} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.simText}>{t('Simulated user: {name}. Tap to see the full timeline.', { name: sim.name })}</Text>
              <Chev />
            </TouchableOpacity>
          )}

          <SecHead title={t('Latest')} />
          {recent.length === 0 ? (
            <Text style={styles.empty}>{t('Nothing new. We only write when something is worth telling you.')}</Text>
          ) : (
            recent.map((item, idx) => {
              const key = `${item.id}-${item.at}`;
              const isMuted = !!prefs.muted[item.id];
              const open = openMenu === key;
              return (
                <View key={key} style={[styles.item, idx === recent.length - 1 && settingsStyles.noLine]}>
                  {/* El texto abre lo suyo y la campana va aparte (en la web un botón no puede llevar otro dentro) */}
                  <View style={styles.itemMain}>
                    <View style={[styles.dot, !item.read && styles.dotUnread]} />
                    <TouchableOpacity
                      style={styles.itemText}
                      onPress={() => item.route && router.push(item.route as Href)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                    >
                      <Text style={fine.rowTitle}>{t(item.title)}</Text>
                      {!!item.body && <Text style={fine.rowSub}>{t(item.body)}</Text>}
                      <Text style={styles.meta}>
                        {ago(item.at)}
                        {isMuted ? ` · ${t('muted')}` : ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setOpenMenu(open ? null : key)}
                      hitSlop={10}
                      style={styles.menuButton}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={t('Mute "{name}" for', { name: label(item.id) })}
                    >
                      <Ionicons name="notifications-off-outline" size={18} color={open ? FINE.jade : FINE.mute} />
                    </TouchableOpacity>
                  </View>
                  {open && (
                    <View style={styles.muteMenu}>
                      <Text style={fine.rowSub}>{t('Mute "{name}" for', { name: label(item.id) })}</Text>
                      <View style={styles.chipRow}>
                        {MUTE_OPTIONS.map((o) => (
                          <FChip key={o.id} label={t(o.label)} on={false} onPress={() => mute(item.id, o.id)} />
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}

          <SecHead title={t('What we can tell you about')} />
          <Text style={styles.hint}>{t('They appear here and on Today. Each one only works with the part of the app it needs switched on.')}</Text>
          {CATEGORY_ORDER.map((cat) => {
            const rules = NUDGE_RULES.filter((r) => r.category === cat);
            if (!rules.length) return null;
            return (
              <View key={cat}>
                <Text style={styles.groupTitle}>{t(CATEGORY_LABEL[cat])}</Text>
                {rules.map((r, i) => {
                  const info = NUDGE_INFO[r.id];
                  const needs = info.needs ?? [];
                  const available = needs.length === 0 || needs.some(show);
                  const m = prefs.muted[r.id];
                  const on = available && !m;
                  return (
                    <SwitchRow
                      key={r.id}
                      title={t(r.label)}
                      sub={t(info.description)}
                      dim={!available}
                      value={on}
                      disabled={!available}
                      onValueChange={(v) => toggle(r.id, v)}
                      last={i === rules.length - 1}
                    >
                      {!available ? (
                        needsLink(t('Needs {section}: switch it on', { section: needs.map(sectionTitle).join(t(' or ')) }))
                      ) : m?.until ? (
                        <Text style={styles.meta}>{mutedUntil(m.until)}</Text>
                      ) : null}
                    </SwitchRow>
                  );
                })}
              </View>
            );
          })}

          {phone.status !== 'unsupported' && (
            <View>
              <Text style={styles.groupTitle}>{t('On your phone')}</Text>
              {PHONE_ROWS.map((row, i) => {
                const available = !row.needs || show(row.needs);
                const m = row.id === 'doses' ? undefined : prefs.muted[row.id];
                const on = available && !m;
                const last = i === PHONE_ROWS.length - 1;
                const extra =
                  !available && row.needs ? (
                    needsLink(t('Needs {section}: switch it on', { section: sectionTitle(row.needs) }))
                  ) : m?.until ? (
                    <Text style={styles.meta}>{mutedUntil(m.until)}</Text>
                  ) : null;
                // Las tomas se eligen en cada medicamento: la fila entera lleva a Medicación
                if (row.id === 'doses') {
                  return available ? (
                    <FRow key={row.id} title={t(row.label)} sub={t(row.description)} onPress={() => router.push('/medications')} last={last} />
                  ) : (
                    <SetRow key={row.id} title={t(row.label)} sub={t(row.description)} dim last={last}>
                      {extra}
                    </SetRow>
                  );
                }
                return (
                  <SwitchRow
                    key={row.id}
                    title={t(row.label)}
                    sub={t(row.description)}
                    dim={!available}
                    value={on}
                    disabled={!available}
                    onValueChange={(v) => toggle(row.id as ReminderId, v)}
                    last={last}
                  >
                    {extra}
                  </SwitchRow>
                );
              })}
            </View>
          )}

          {authMode === 'demo' && (
            <>
              <TouchableOpacity
                onPress={() => setShowWhy((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: showWhy }}
              >
                <SecRow
                  title={t('Why these notifications?')}
                  right={<Ionicons name={showWhy ? 'chevron-up' : 'chevron-down'} size={16} color={FINE.mute} />}
                />
              </TouchableOpacity>
              {showWhy &&
                decisions.map((d, i) => (
                  <View key={d.id} style={[fine.row, styles.whyRow, i === decisions.length - 1 && settingsStyles.noLine]}>
                    <Text style={[styles.status, { color: STATUS[d.status].color }]}>{t(STATUS[d.status].label)}</Text>
                    <View style={styles.flex}>
                      <Text style={fine.rowTitle}>{t(d.label)}</Text>
                      <Text style={fine.rowSub}>{d.reason}</Text>
                    </View>
                  </View>
                ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  intro: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13, lineHeight: 18 },
  text: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  hint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, marginBottom: 2 },
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, paddingVertical: 8 },
  kicker: { ...fine.kicker, marginTop: 14, marginBottom: 2 },
  pillRow: { flexDirection: 'row', marginTop: 12 },
  // Los próximos recordatorios: cuándo, apagado y en cifras iguales; qué, en marfil
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: FINE.line },
  upcomingWhen: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, minWidth: 110, fontVariant: ['tabular-nums'] },
  upcomingTitle: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 13.5 },
  simRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, minHeight: 44, paddingVertical: 8 },
  simText: { ...ff('regular'), flex: 1, color: FINE.gold, fontSize: 13, lineHeight: 18 },
  // Cada aviso: el punto jade si no lo has visto, su texto y la campana para silenciarlo
  item: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  itemMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemText: { flex: 1, minWidth: 0, paddingVertical: 11 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 18, backgroundColor: 'transparent' },
  dotUnread: { backgroundColor: FINE.jade },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  menuButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8, marginTop: 2 },
  muteMenu: { paddingBottom: 12, paddingLeft: 16, gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // El nombre de cada grupo de avisos, pequeño y en mayúsculas, encima de sus filas
  groupTitle: { ...fine.kicker, marginTop: 20, marginBottom: 2 },
  needs: { alignSelf: 'flex-start', marginTop: 4 },
  needsText: { ...ff('regular'), color: FINE.jade, fontSize: 12.5, lineHeight: 17 },
  whyRow: { alignItems: 'flex-start' },
  status: { ...ff('regular'), fontSize: 11.5, lineHeight: 20, minWidth: 74 },
});
