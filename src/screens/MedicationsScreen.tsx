import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { deleteMedication, doseRepository, medicationRepository } from '@/data/medicationRepository';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { muteUntil } from '@/logic/nudges';
import { MUTE_OPTIONS, MuteOption } from '@/logic/nudges/types';
import { courseEnd, courseProgress, dosesForDay, isActiveOn, isReminderMuted, MUTED_FOREVER, scheduleText } from '@/logic/medication';
import { DoseLog, MedicationItem } from '@/types/medication';
import { DoseRows, doseStyles } from '@/components/DoseRows';
import { ZoneChangeBanner } from '@/components/ZoneChangeBanner';
import { FRow, Pill, SecHead } from '@/components/fine/Fine';
import { FChip, FLink } from '@/components/fine/FineForm';
import { SecRow } from '@/components/fine/FineMeasure';
import { offerPhoneReminders } from '@/data/phoneReminders';
import { FINE, ff, fine } from '@/theme/fine';

// Medicación y suplementos: las tomas de hoy (marcar tomada u omitida), lo que toma de forma
// habitual y los tratamientos puntuales. Cada recordatorio se enciende, apaga o silencia aparte.
// Rediseño del 2026-11-17 (lenguaje fino, src/theme/fine.ts; el fundador: «las "tomas" de medicación no están
// actualizadas con la estética actual»): sin tarjetas ni iconos sobre círculos de color. Cada sección lleva su
// cabecera pequeña y, debajo, filas con una línea fina; las tomas de hoy, con «Omitir» apagado y la píldora
// esmeralda «Tomada» (DoseRows); lo que tomas, con su pauta debajo y «···» para sus opciones; y añadir, como enlace
// en jade. Qué se guarda y cuándo avisa no cambia.
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
    if (on) void offerPhoneReminders('medication');
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
  const remove = async (item: MedicationItem) => {
    const ok = await confirmAsk(t('Delete {name}?', { name: t(item.name) }), t('Its logged doses are deleted too. This cannot be undone.'), t('Delete'));
    if (!ok) return;
    await deleteMedication(item.id);
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

  // Una opción del menú de un medicamento: texto en jade (borrar, apagado), sin caja
  const menuLink = (label: string, onPress: () => void, quiet?: boolean) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.menuText, quiet && styles.menuQuiet]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = (item: MedicationItem) => {
    const progress = courseProgress(item);
    const end = courseEnd(item);
    const open = menuFor === item.id;
    return (
      <View key={item.id} style={styles.item}>
        <View style={styles.itemMain}>
          <TouchableOpacity
            style={styles.itemText}
            onPress={() => router.push({ pathname: '/medication-setup', params: { id: item.id } })}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={fine.rowTitle}>
              {t(item.name)}
              {item.dose ? <Text style={styles.itemDose}> · {item.dose}</Text> : null}
            </Text>
            <Text style={fine.rowSub}>{scheduleText(item.schedule)}</Text>
            {progress && end && (
              <Text style={fine.rowSub}>
                {t('Day {n} of {total} · ends {date}', { n: progress.day, total: progress.total, date: new Date(end.getTime() - 1).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) })}
              </Text>
            )}
            <Text style={styles.itemMeta}>{reminderLabel(item)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuFor(open ? null : item.id)}
            hitSlop={10}
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={t('Options for {name}', { name: t(item.name) })}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={open ? FINE.jade : FINE.mute} />
          </TouchableOpacity>
        </View>
        {open && (
          <View style={styles.menu}>
            {item.schedule.type !== 'as_needed' && menuLink(item.reminders ? t('Turn reminders off') : t('Turn reminders on'), () => setReminders(item, !item.reminders))}
            {item.reminders && item.schedule.type !== 'as_needed' && (
              <>
                <Text style={styles.menuLabel}>{t('Mute reminders for')}</Text>
                <View style={styles.chipRow}>
                  {MUTE_OPTIONS.map((o) => (
                    <FChip key={o.id} label={t(o.label)} on={false} onPress={() => mute(item, o.id)} />
                  ))}
                </View>
              </>
            )}
            {menuLink(t('I stopped taking it'), () => stop(item))}
            {menuLink(t('Delete'), () => remove(item), true)}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Medication & supplements')} showBack />

        <View style={styles.body}>
          <ZoneChangeBanner onChanged={load} />
          <SecRow title={t('Today')} right={<InfoButton topic="medication" color={FINE.mute} />} style={styles.firstSec} />
          {today.length === 0 && asNeeded.length === 0 ? (
            <Text style={styles.empty}>{t('Nothing scheduled for today.')}</Text>
          ) : (
            <View>
              <DoseRows doses={today} onChange={load} />
              {asNeeded.map((item) => (
                <View key={item.id} style={fine.row}>
                  <Text style={doseStyles.time}>—</Text>
                  <View style={doseStyles.main}>
                    <Text style={fine.rowTitle} numberOfLines={2}>
                      {t(item.name)}
                    </Text>
                    <Text style={fine.rowSub}>
                      {t('When needed · {n} today', { n: logs.filter((l) => l.medId === item.id && new Date(l.fecha).toDateString() === now.toDateString()).length })}
                    </Text>
                  </View>
                  <Pill label={t('Took one')} onPress={() => logNow(item)} />
                </View>
              ))}
            </View>
          )}
          {items.length > 0 && <FRow title={t('History')} sub={t('See each day and fix what you forgot to mark')} onPress={() => router.push('/medication-history')} last />}

          <SecHead title={t('What I take regularly')} />
          {regular.length ? regular.map(renderItem) : <Text style={styles.empty}>{t('Nothing yet.')}</Text>}
          <FLink label={t('Add a medicine or supplement')} icon="add" onPress={() => router.push({ pathname: '/medication-setup', params: { mode: 'regular' } })} style={styles.add} />

          <SecHead title={t('Short courses')} />
          <Text style={styles.hint}>{t('For when you are ill: antibiotics, painkillers… They end on their own.')}</Text>
          {courses.map(renderItem)}
          {finished.map((i) => (
            <Text key={i.id} style={styles.finished}>
              {t('{name}: finished', { name: t(i.name) })}
            </Text>
          ))}
          <FLink label={t('Add a short course')} icon="add" onPress={() => router.push({ pathname: '/medication-setup', params: { mode: 'short' } })} style={styles.add} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  // La primera sección va pegada a la cabecera de la pantalla
  firstSec: { marginTop: 4 },
  hint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, marginBottom: 4 },
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, paddingVertical: 8 },
  // Lo que tomas: una fila con su línea fina; el menú de opciones se abre dentro, encima de la línea
  item: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  itemMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemText: { flex: 1, minWidth: 0, paddingVertical: 11 },
  itemDose: { ...ff('regular'), color: FINE.mute },
  itemMeta: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  menuButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8, marginTop: 2 },
  menu: { paddingBottom: 10, gap: 2 },
  menuRow: { minHeight: 38, justifyContent: 'center' },
  menuText: { ...ff('regular'), color: FINE.jade, fontSize: 14 },
  menuQuiet: { color: FINE.mute },
  menuLabel: { ...fine.kicker, marginTop: 8, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  add: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  finished: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, paddingVertical: 6 },
});
