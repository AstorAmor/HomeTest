import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { muteUntil } from '@/logic/nudges';
import { MUTE_OPTIONS, MuteOption } from '@/logic/nudges/types';
import { courseEnd, courseProgress, dosesForDay, isActiveOn, isReminderMuted, MUTED_FOREVER, scheduleText } from '@/logic/medication';
import { DoseLog, MedicationItem } from '@/types/medication';
import { DoseRows } from '@/components/DoseRows';
import { MedIcon } from '@/components/MedIcon';
import { ZoneChangeBanner } from '@/components/ZoneChangeBanner';


// Medicación y suplementos: las tomas de hoy (marcar tomada u omitida), lo que toma de forma
// habitual y los tratamientos puntuales. Cada recordatorio se enciende, apaga o silencia aparte.
export const MedicationsScreen = () => {
  const router = useRouter();
  const [items, setItems] = useDeepState<MedicationItem[]>([]);
  const [logs, setLogs] = useDeepState<DoseLog[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, l] = await Promise.all([medicationRepository.getAll(), doseRepository.getAll()]);
    setItems(m);
    setLogs(l);
  }, [setItems, setLogs]);
  useReloadOnFocus(load);

  const now = new Date();
  const active = items.filter((i) => isActiveOn(i, now));
  const regular = active.filter((i) => i.course.type === 'ongoing');
  const courses = active.filter((i) => i.course.type === 'short');
  const finished = items.filter((i) => !isActiveOn(i, now) && i.course.type === 'short').slice(0, 3);
  const today = dosesForDay(active, now, logs);
  const asNeeded = active.filter((i) => i.schedule.type === 'as_needed');

  const logNow = async (item: MedicationItem) => {
    const at = new Date().toISOString();
    await doseRepository.save({ id: `${Date.now()}`, fecha: at, createdAt: at, medId: item.id, scheduledFor: at, status: 'taken' });
    load();
  };
  const setReminders = async (item: MedicationItem, on: boolean) => {
    await medicationRepository.update(item.id, { reminders: on, remindersMutedUntil: undefined });
    setMenuFor(null);
    load();
  };
  const mute = async (item: MedicationItem, option: MuteOption) => {
    await medicationRepository.update(item.id, { remindersMutedUntil: muteUntil(option, new Date()) ?? MUTED_FOREVER });
    setMenuFor(null);
    load();
  };
  const stop = async (item: MedicationItem) => {
    await medicationRepository.update(item.id, { stoppedAt: new Date().toISOString() });
    setMenuFor(null);
    load();
  };

  const reminderLabel = (item: MedicationItem) => {
    if (item.schedule.type === 'as_needed') return t('Only when needed');
    if (!item.reminders) return t('No reminders');
    if (isReminderMuted(item)) {
      return item.remindersMutedUntil === MUTED_FOREVER
        ? t('Reminders muted')
        : t('Muted until {date}', { date: new Date(item.remindersMutedUntil!).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) });
    }
    return t('Reminders on');
  };

  const renderItem = (item: MedicationItem) => {
    const progress = courseProgress(item);
    const end = courseEnd(item);
    const open = menuFor === item.id;
    return (
      <View key={item.id} style={styles.item}>
        <TouchableOpacity
          style={styles.itemMain}
          onPress={() => router.push({ pathname: '/medication-setup', params: { id: item.id } })}
          activeOpacity={0.85}
        >
          <MedIcon name={item.name} kind={item.kind} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>
              {item.name}
              {item.dose ? <Text style={styles.itemDose}> · {item.dose}</Text> : null}
            </Text>
            <Text style={styles.itemSub}>{scheduleText(item.schedule)}</Text>
            {progress && end && (
              <Text style={styles.itemSub}>
                {t('Day {n} of {total} · ends {date}', { n: progress.day, total: progress.total, date: new Date(end.getTime() - 1).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) })}
              </Text>
            )}
            <Text style={styles.itemMeta}>{reminderLabel(item)}</Text>
          </View>
          <TouchableOpacity onPress={() => setMenuFor(open ? null : item.id)} hitSlop={10}>
            <Ionicons
              name={item.reminders && !isReminderMuted(item) ? 'notifications-outline' : 'notifications-off-outline'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        </TouchableOpacity>
        {open && (
          <View style={styles.menu}>
            {item.schedule.type !== 'as_needed' && (
              <TouchableOpacity style={styles.menuRow} onPress={() => setReminders(item, !item.reminders)}>
                <Text style={styles.menuText}>{item.reminders ? t('Turn reminders off') : t('Turn reminders on')}</Text>
              </TouchableOpacity>
            )}
            {item.reminders && item.schedule.type !== 'as_needed' && (
              <>
                <Text style={styles.menuLabel}>{t('Mute reminders for')}</Text>
                <View style={styles.chipRow}>
                  {MUTE_OPTIONS.map((o) => (
                    <TouchableOpacity key={o.id} style={styles.chip} onPress={() => mute(item, o.id)}>
                      <Text style={styles.chipText}>{t(o.label)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={styles.menuRow} onPress={() => stop(item)}>
              <Text style={[styles.menuText, { color: Colors.danger }]}>{t('I stopped taking it')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Medication & supplements')} showBack />

        <View style={{ marginHorizontal: 20 }}>
          <ZoneChangeBanner onChanged={load} />
        </View>
        <View style={styles.titleRow}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: 0 }]}>{t('Today')}</Text>
          <InfoButton topic="medication" />
        </View>
        {today.length === 0 && asNeeded.length === 0 ? (
          <Text style={styles.empty}>{t('Nothing scheduled for today.')}</Text>
        ) : (
          <View style={styles.card}>
            <DoseRows doses={today} onChange={load} />
            {asNeeded.map((item) => (
              <View key={item.id} style={[styles.doseRow, (today.length > 0 || item !== asNeeded[0]) && styles.divider]}>
                <Text style={styles.doseTime}>—</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doseName}>{item.name}</Text>
                  <Text style={styles.itemSub}>
                    When needed · {logs.filter((l) => l.medId === item.id && l.fecha.slice(0, 10) === now.toISOString().slice(0, 10)).length} today
                  </Text>
                </View>
                <TouchableOpacity style={styles.take} onPress={() => logNow(item)}>
                  <Text style={styles.takeText}>{t('Took one')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('What I take regularly')}</Text>
        {regular.length ? regular.map(renderItem) : <Text style={styles.empty}>{t('Nothing yet.')}</Text>}
        <TouchableOpacity style={styles.add} onPress={() => router.push({ pathname: '/medication-setup', params: { mode: 'regular' } })}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
          <Text style={styles.addText}>{t('Add a medicine or supplement')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('Short courses')}</Text>
        <Text style={styles.hint}>{t('For when you are ill: antibiotics, painkillers… They end on their own.')}</Text>
        {courses.map(renderItem)}
        {finished.map((i) => (
          <Text key={i.id} style={styles.finished}>
            {t('{name}: finished', { name: i.name })}
          </Text>
        ))}
        <TouchableOpacity style={styles.add} onPress={() => router.push({ pathname: '/medication-setup', params: { mode: 'short' } })}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
          <Text style={styles.addText}>{t('Add a short course')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 18, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  hint: { color: Colors.textSecondary, fontSize: 12, paddingHorizontal: 20, marginTop: -4, marginBottom: 10 },
  empty: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 6 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginHorizontal: 20,
  },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  doseTime: { width: 46, color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  doseName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  take: { backgroundColor: Colors.accent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  takeText: { color: Colors.background, fontSize: 12, fontWeight: '800' },
  skip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  skipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  item: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    overflow: 'hidden',
  },
  itemMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  itemTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  itemDose: { color: Colors.textSecondary, fontWeight: '500' },
  itemSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  menu: { borderTopWidth: 1, borderTopColor: Colors.divider, padding: 12, gap: 8 },
  menuRow: { paddingVertical: 4 },
  menuText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  menuLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.background,
  },
  chipText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  addText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  finished: { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 20, marginBottom: 4 },
});
