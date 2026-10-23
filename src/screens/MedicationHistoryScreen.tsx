import { dateLocale, t, tn } from '@/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MedIcon } from '@/components/MedIcon';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { addAsNeededDose, doseRepository, medicationRepository, setDoseStatus } from '@/data/medicationRepository';
import { dayKey } from '@/data/bathroomRepository';
import { asNeededLogsOn, DaySummary, daySummary, dosesForDay, historyDays, isActiveOn } from '@/logic/medication';
import { DoseLog, MedicationItem, ScheduledDose } from '@/types/medication';

// Historial de medicación (Medicación y suplementos → Historial, o la línea de medicación de Tus
// últimos días): cada día con lo que tocaba y lo marcado. Al tocar un día se despliega y se corrige
// cada toma, p. ej. la tomaste pero se te olvidó marcarla. Los días pasados se calculan con la pauta
// de ahora (no se guarda cómo era antes).

const PAGE = 14;
const MAX_DOTS = 8;

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const summaryText = (s: DaySummary, asNeeded: number) => {
  const parts: string[] = [];
  if (s.total && s.taken === s.total) parts.push(t('All taken'));
  else if (s.total) {
    // Hoy, si aún no tocaba nada, solo "3 más tarde" (no "0 de 3 tomadas")
    if (s.taken || s.skipped || s.unmarked) parts.push(t('{taken} of {total} taken', { taken: s.taken, total: s.total }));
    if (s.skipped) parts.push(tn(s.skipped, '{n} dose not taken', '{n} doses not taken'));
    if (s.unmarked) parts.push(t('{n} unmarked', { n: s.unmarked }));
    if (s.later) parts.push(t('{n} later today', { n: s.later }));
  }
  if (asNeeded) parts.push(t('When needed: {n}', { n: asNeeded }));
  return parts.length ? parts.join(' · ') : t('Nothing scheduled');
};

export const MedicationHistoryScreen = () => {
  const params = useLocalSearchParams<{ date?: string }>();
  const [items, setItems] = useDeepState<MedicationItem[]>([]);
  const [logs, setLogs] = useDeepState<DoseLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string[]>(params.date ? [params.date] : []);
  const [shown, setShown] = useState(PAGE);
  const busy = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    const [m, l] = await Promise.all([medicationRepository.getAll(), doseRepository.getAll()]);
    setItems(m);
    setLogs(l);
    setLoaded(true);
  }, [setItems, setLogs]);
  useReloadOnFocus(load);

  const now = new Date();
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const allDays = useMemo(() => historyDays(items), [items]);

  // Si se llega con ?date= de un día más antiguo que la primera página, se enseña hasta él
  useEffect(() => {
    if (!params.date) return;
    const i = allDays.findIndex((d) => dayKey(d) === params.date);
    if (i >= PAGE) setShown((s) => Math.max(s, i + 1));
  }, [allDays, params.date]);

  const days = allDays.slice(0, shown).map((date) => {
    const doses = dosesForDay(items, date, logs);
    const asNeeded = items
      .filter((i) => i.schedule.type === 'as_needed' && isActiveOn(i, date))
      .map((item) => ({ item, taken: asNeededLogsOn(item, date, logs) }));
    return { key: dayKey(date), date, doses, asNeeded, summary: daySummary(doses, now) };
  });

  // Los 7 días anteriores a hoy (hoy aún no ha terminado)
  const week = allDays
    .slice(1, 8)
    .map((d) => daySummary(dosesForDay(items, d, logs), now))
    .filter((s) => s.total > 0);
  const weekTotal = week.reduce((a, s) => a + s.total, 0);
  const weekTaken = week.reduce((a, s) => a + s.taken, 0);
  const weekSkipped = week.reduce((a, s) => a + s.skipped, 0);
  const weekUnmarked = week.reduce((a, s) => a + s.unmarked, 0);
  const fullDays = week.filter((s) => s.taken === s.total).length;

  // Un cambio cada vez: un doble toque no apunta dos veces
  const run = async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
      await load();
    } finally {
      busy.current = false;
    }
  };
  const choose = (dose: ScheduledDose, status: DoseLog['status']) =>
    run(() => setDoseStatus(dose, dose.log?.status === status ? null : status, logs));
  const addOne = (item: MedicationItem, date: Date) => run(() => addAsNeededDose(item.id, date));
  // Quita el último "He tomado una" de ese día
  const removeOne = (taken: DoseLog[]) => {
    const last = [...taken].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))[0];
    if (last) void run(() => doseRepository.remove(last.id));
  };

  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));

  const dayLabel = (date: Date, key: string) =>
    key === todayKey
      ? t('Today')
      : key === yesterdayKey
        ? t('Yesterday')
        : capital(date.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }));

  const dot = (d: ScheduledDose, i: number) => {
    const status = d.log?.status;
    const later = !d.log && d.at > now;
    return (
      <Ionicons
        key={i}
        name={status === 'taken' ? 'checkmark-circle' : status === 'skipped' ? 'remove-circle-outline' : 'ellipse-outline'}
        size={14}
        color={status === 'taken' ? Colors.ok : Colors.textMuted}
        style={later ? { opacity: 0.45 } : undefined}
      />
    );
  };

  const remaining = allDays.length - shown;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Medication history')} showBack backFallback="/medications" />

        {loaded && !items.length ? (
          <Text style={styles.empty}>{t('Nothing here yet. Add what you take and each day will show up here.')}</Text>
        ) : (
          <>
            <Text style={styles.intro}>
              {t('Tap a day to see it and fix it. Tap the chosen option again to leave it unmarked.')}
            </Text>

            {week.length > 0 && (
              <View style={styles.weekCard}>
                <Text style={styles.weekLabel}>{t('Last 7 days, up to yesterday')}</Text>
                <Text style={styles.weekMain}>
                  {t(week.length === 1 ? '{full} of {n} day with everything taken' : '{full} of {n} days with everything taken', { full: fullDays, n: week.length })}
                </Text>
                <Text style={styles.weekSub}>
                  {[
                    t('You took {taken} of {total} doses', { taken: weekTaken, total: weekTotal }),
                    weekSkipped ? tn(weekSkipped, '{n} dose not taken', '{n} doses not taken') : null,
                    weekUnmarked ? t('{n} unmarked', { n: weekUnmarked }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            )}

            {days.map((d) => {
              const isOpen = open.includes(d.key);
              const asNeededCount = d.asNeeded.reduce((a, x) => a + x.taken.length, 0);
              const editable = d.doses.length > 0 || d.asNeeded.length > 0;
              return (
                <View
                  key={d.key}
                  style={[styles.day, isOpen && styles.dayOpen]}
                  onLayout={(e) => {
                    if (scrolled.current || params.date !== d.key) return;
                    scrolled.current = true;
                    const y = e.nativeEvent.layout.y;
                    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 60);
                  }}
                >
                  <TouchableOpacity
                    style={styles.dayHead}
                    onPress={() => editable && toggle(d.key)}
                    activeOpacity={editable ? 0.85 : 1}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen, disabled: !editable }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayTitle}>{dayLabel(d.date, d.key)}</Text>
                      <View style={styles.dayLine}>
                        {d.doses.length > 0 && d.doses.length <= MAX_DOTS && <View style={styles.dots}>{d.doses.map(dot)}</View>}
                        {d.summary.total > 0 && d.summary.taken === d.summary.total ? (
                          <Ionicons name="checkmark-done" size={14} color={Colors.ok} />
                        ) : null}
                        <Text style={[styles.daySummary, !editable && { color: Colors.textMuted }]}>{summaryText(d.summary, asNeededCount)}</Text>
                      </View>
                    </View>
                    {editable && <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />}
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.dayBody}>
                      {d.doses.map((dose) => (
                        <View key={`${dose.medId}-${dose.at.toISOString()}`} style={styles.doseRow}>
                          <View style={styles.doseTop}>
                            <Text style={styles.doseTime}>{hhmm(dose.at)}</Text>
                            <MedIcon name={dose.name} kind={dose.kind ?? 'medication'} size={14} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.doseName}>{t(dose.name)}</Text>
                              {dose.dose ? <Text style={styles.doseSub}>{dose.dose}</Text> : null}
                            </View>
                          </View>
                          <View style={styles.choices}>
                            {(['taken', 'skipped'] as const).map((status) => {
                              const on = dose.log?.status === status;
                              return (
                                <TouchableOpacity
                                  key={status}
                                  style={[styles.choice, on && styles.choiceOn]}
                                  onPress={() => choose(dose, status)}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: on }}
                                >
                                  {on && <Ionicons name={status === 'taken' ? 'checkmark' : 'remove'} size={14} color={Colors.accent} />}
                                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{status === 'taken' ? t('Taken') : t('Not taken')}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                      {d.asNeeded.map(({ item, taken }) => (
                        <View key={item.id} style={[styles.doseRow, styles.doseTop]}>
                          <Text style={styles.doseTime}>—</Text>
                          <MedIcon name={item.name} kind={item.kind} size={14} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.doseName}>{t(item.name)}</Text>
                            <Text style={styles.doseSub}>{t('Only when needed')}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.step, !taken.length && { opacity: 0.4 }]}
                            disabled={!taken.length}
                            onPress={() => removeOne(taken)}
                            accessibilityLabel={t('One less')}
                          >
                            <Ionicons name="remove" size={16} color={Colors.textPrimary} />
                          </TouchableOpacity>
                          <Text style={styles.count}>{taken.length}</Text>
                          <TouchableOpacity style={styles.step} onPress={() => addOne(item, d.date)} accessibilityLabel={t('One more')}>
                            <Ionicons name="add" size={16} color={Colors.textPrimary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {remaining > 0 && (
              <TouchableOpacity style={styles.more} onPress={() => setShown((s) => s + PAGE)}>
                <Text style={styles.moreText}>{tn(Math.min(PAGE, remaining), 'Show {n} more day', 'Show {n} more days')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginBottom: 14 },
  empty: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginTop: 8 },
  weekCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  weekLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  weekMain: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 4 },
  weekSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  day: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dayOpen: { borderColor: Colors.accent },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dayTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  dayLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 2 },
  daySummary: { color: Colors.textSecondary, fontSize: 12, flexShrink: 1 },
  dayBody: { paddingHorizontal: 14 },
  doseRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  doseTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doseTime: { width: 46, color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  doseName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  doseSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  choices: { flexDirection: 'row', gap: 8, marginTop: 8, marginLeft: 56 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.background,
  },
  choiceOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  choiceText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  choiceTextOn: { color: Colors.accent },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { minWidth: 18, textAlign: 'center', color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  more: { alignItems: 'center', paddingVertical: 12 },
  moreText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});
