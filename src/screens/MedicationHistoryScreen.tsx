import { dateLocale, t, tn } from '@/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DoseMark, doseStyles } from '@/components/DoseRows';
import { SecHead } from '@/components/fine/Fine';
import { FChip, FLink } from '@/components/fine/FineForm';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { addAsNeededDose, doseRepository, medicationRepository, setDoseStatus } from '@/data/medicationRepository';
import { dayKey } from '@/data/bathroomRepository';
import { asNeededLogsOn, DaySummary, daySummary, dosesForDay, historyDays, isActiveOn } from '@/logic/medication';
import { DoseLog, MedicationItem, ScheduledDose } from '@/types/medication';
import { FINE, ff, fine } from '@/theme/fine';

// Historial de medicación (Medicación y suplementos → Historial, o la línea de medicación de Tus
// últimos días): cada día con lo que tocaba y lo marcado. Al tocar un día se despliega y se corrige
// cada toma, p. ej. la tomaste pero se te olvidó marcarla. Los días pasados se calculan con la pauta
// de ahora (no se guarda cómo era antes).
// Rediseño del 2026-11-17 (lenguaje fino; el fundador: «las "tomas" de medicación no están actualizadas con la
// estética actual»): sin tarjetas. El resumen de la semana, bajo su cabecera pequeña; cada día, una fila con una
// línea fina y una marca redonda por toma (DoseMark: tomada, omitida o sin marcar); al abrirlo, cada toma con su
// hora apagada y «Tomada» / «No tomada» en chips con borde, y lo de «solo cuando hace falta», con un «− n +» fino.

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

  // Una marca pequeña por toma del día; la que aún no toca, apagada
  const dot = (d: ScheduledDose, i: number) => <DoseMark key={i} status={d.log?.status} size={13} dim={!d.log && d.at > now} />;

  const remaining = allDays.length - shown;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScreenHeader title={t('Medication history')} showBack backFallback="/medications" />
        </View>

        {loaded && !items.length ? (
          <Text style={styles.empty}>{t('Nothing here yet. Add what you take and each day will show up here.')}</Text>
        ) : (
          <>
            <Text style={styles.intro}>
              {t('Tap a day to see it and fix it. Tap the chosen option again to leave it unmarked.')}
            </Text>

            {week.length > 0 && (
              <View style={styles.week}>
                <SecHead title={t('Last 7 days, up to yesterday')} style={styles.weekHead} />
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
                  style={styles.day}
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
                    activeOpacity={editable ? 0.7 : 1}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen, disabled: !editable }}
                  >
                    <View style={doseStyles.main}>
                      <Text style={fine.rowTitle}>{dayLabel(d.date, d.key)}</Text>
                      <View style={styles.dayLine}>
                        {d.doses.length > 0 && d.doses.length <= MAX_DOTS && <View style={styles.dots}>{d.doses.map(dot)}</View>}
                        <Text style={styles.daySummary}>{summaryText(d.summary, asNeededCount)}</Text>
                      </View>
                    </View>
                    {editable && <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={isOpen ? FINE.jade : FINE.mute} />}
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.dayBody}>
                      {d.doses.map((dose) => (
                        <View key={`${dose.medId}-${dose.at.toISOString()}`} style={styles.doseRow}>
                          <View style={styles.doseTop}>
                            <Text style={doseStyles.time}>{hhmm(dose.at)}</Text>
                            <View style={doseStyles.main}>
                              <Text style={styles.doseName}>{t(dose.name)}</Text>
                              {dose.dose ? <Text style={fine.rowSub}>{dose.dose}</Text> : null}
                            </View>
                          </View>
                          {/* Tocar la elegida otra vez la deja sin marcar */}
                          <View style={styles.choices}>
                            {(['taken', 'skipped'] as const).map((status) => (
                              <FChip
                                key={status}
                                multi
                                check
                                label={status === 'taken' ? t('Taken') : t('Not taken')}
                                on={dose.log?.status === status}
                                onPress={() => choose(dose, status)}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                      {d.asNeeded.map(({ item, taken }) => (
                        <View key={item.id} style={[styles.doseRow, styles.doseTop]}>
                          <Text style={doseStyles.time}>—</Text>
                          <View style={doseStyles.main}>
                            <Text style={styles.doseName}>{t(item.name)}</Text>
                            <Text style={fine.rowSub}>{t('Only when needed')}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.step, !taken.length && styles.stepOff]}
                            disabled={!taken.length}
                            onPress={() => removeOne(taken)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={t('One less')}
                          >
                            <Text style={styles.stepSign}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.count}>{taken.length}</Text>
                          <TouchableOpacity style={styles.step} onPress={() => addOne(item, d.date)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('One more')}>
                            <Text style={styles.stepSign}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {remaining > 0 && <FLink label={tn(Math.min(PAGE, remaining), 'Show {n} more day', 'Show {n} more days')} onPress={() => setShown((s) => s + PAGE)} style={styles.more} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  // La cabecera de la pantalla trae su propio margen: que no se sume al de la lista
  header: { marginHorizontal: -20 },
  intro: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  empty: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  // El resumen de la semana: su cabecera pequeña, la frase en marfil y el detalle apagado; debajo, la raya de los días
  week: { paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: FINE.rule },
  weekHead: { marginTop: 16 },
  weekMain: { ...ff('regular'), color: FINE.ivory, fontSize: 17, lineHeight: 23 },
  weekSub: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  // Cada día: una fila con su línea fina debajo; abierto, sus tomas van dentro, encima de esa línea
  day: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, minHeight: 50 },
  dayLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 3 },
  daySummary: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  dayBody: { paddingBottom: 4 },
  doseRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: FINE.line },
  doseTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doseName: { ...ff('regular'), color: FINE.ivory, fontSize: 14.5, lineHeight: 20 },
  // Debajo del nombre, alineados con él (la hora ocupa 44 + 10 de hueco)
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 54 },
  // «− n +» pequeño, con los botones redondos de línea fina del resto de la app
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(240,239,230,0.16)', alignItems: 'center', justifyContent: 'center' },
  stepOff: { opacity: 0.35 },
  stepSign: { ...ff('light'), color: FINE.ivory, fontSize: 19, lineHeight: 23, marginTop: -1 },
  count: { ...ff('regular'), minWidth: 20, textAlign: 'center', color: FINE.ivory, fontSize: 15, fontVariant: ['tabular-nums'] },
  more: { marginTop: 6 },
});
