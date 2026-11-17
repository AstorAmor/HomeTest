import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FRow, LockTag, Pill, SecHead } from '@/components/fine/Fine';
import { FineLink, SecRow } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { loadSymptomData, removeSymptom } from '@/data/symptomRepository';
import {
  AREAS,
  PATTERN_TEXT,
  PHASE_PHRASE,
  SAMPLE_NOTE,
  WEEK_TEXT,
  intensityPhrase,
  symptomDayKey,
  symptomName,
  symptomPatterns,
  symptomsByDay,
  weekSummary,
  type SymptomDay,
  type SymptomEntry,
  type SymptomPattern,
  type WeekSummary,
} from '@/logic/symptoms';
import { dateLocale, t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// «Tus síntomas»: a donde lleva guardar un síntoma (y el enlace «Ver mis síntomas» de esa pantalla). El fundador,
// 2026-11-17: «un mapeo de cuándo tienes estas cosas con el ciclo o con dormir bien, mal» y un resumen semanal
// sin IA. De arriba abajo:
// - Resumen de la semana (los últimos 7 días): cuántos días con síntomas, los más frecuentes y una o dos
//   observaciones. Debajo, con candado, «Insights sobre tu semana»: de pago y aún sin nada detrás (el fundador:
//   «aunque no tenga código detrás»); lleva a comparar suscripciones.
// - Patrones: por reglas (src/logic/symptoms.ts), con qué coincide en sus registros cada síntoma apuntado varias
//   veces: noches de menos de 6 h (o haber dicho que durmió mal) y fase del ciclo. Siempre como una cuenta de lo
//   suyo, nunca como la causa.
// - Historial por días: la hora a la izquierda, el síntoma y, debajo, la intensidad y dónde; cada apunte se
//   puede quitar (la × pide confirmarlo en la misma fila).
// En la demo y en las cuentas de prueba, sin nada propio, un ejemplo que no se guarda ni se puede quitar.
// «Apuntar» abre el formulario con ?from=symptoms, para que al guardar vuelva aquí en vez de abrir otra copia.

// Los días del historial que se ven de entrada; el resto, con «Ver anteriores»
const DAYS_SHOWN = 14;

interface Loaded {
  sample: boolean;
  today: string;
  yesterday: string;
  days: SymptomDay[];
  week: WeekSummary;
  patterns: SymptomPattern[];
}

const nameOf = (e: Pick<SymptomEntry, 'symptom' | 'name'>) => {
  const n = symptomName(e);
  return n.translate ? t(n.text) : n.text;
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

// «Intensidad moderada · frente, sienes · detrás del ojo»
const detailOf = (e: SymptomEntry) =>
  [t(intensityPhrase(e.intensity)), (e.where ?? []).map((a) => t(AREAS[a]).toLowerCase()).join(', '), e.whereText].filter(Boolean).join(' · ');

// La observación y, detrás, lo habitual en ese periodo (para que la cuenta se pueda comparar)
const patternText = (p: SymptomPattern) => {
  const v = { k: p.hits, n: p.total, b: p.baseHits, m: p.baseTotal };
  if (p.kind === 'cycle_phase') {
    const phase = t(PHASE_PHRASE[p.phase ?? 'menstrual']);
    return `${t(PATTERN_TEXT.cycle_phase, { ...v, phase })} ${t(PATTERN_TEXT.cycle_phase_base, { p: Math.round((100 * p.baseHits) / Math.max(1, p.baseTotal)) })}`;
  }
  return p.kind === 'short_night'
    ? `${t(PATTERN_TEXT.short_night, v)} ${t(PATTERN_TEXT.short_night_base, v)}`
    : `${t(PATTERN_TEXT.bad_sleep, v)} ${t(PATTERN_TEXT.bad_sleep_base, v)}`;
};

const weekLines = (w: WeekSummary) => {
  const out: string[] = [];
  if (w.sleep) out.push(t(WEEK_TEXT[w.sleep.kind], { k: w.sleep.hits, n: w.sleep.total }));
  if (w.phase) out.push(t(WEEK_TEXT.phase, { k: w.phase.hits, n: w.phase.total, phase: t(PHASE_PHRASE[w.phase.phase]) }));
  return out;
};

export const SymptomsScreen = () => {
  const router = useRouter();
  const [view, setView] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState<string | null>(null); // el apunte que se va a quitar
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const data = await loadSymptomData(now);
      setView({
        sample: data.sample,
        today: symptomDayKey(now),
        yesterday: symptomDayKey(yesterday),
        days: symptomsByDay(data.entries),
        week: weekSummary(data.entries, data.context, now),
        patterns: symptomPatterns(data.entries, data.context, now),
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useReloadOnFocus(load);

  const log = () => router.push({ pathname: '/log-symptom', params: { from: 'symptoms' } });
  const remove = async (id: string) => {
    setAsking(null);
    try {
      await removeSymptom(id);
      await load();
    } catch {
      setFailed(true);
    }
  };

  const dayTitle = (day: string) =>
    day === view?.today
      ? t('Today')
      : day === view?.yesterday
        ? t('Yesterday')
        : new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  const week = view?.week;
  const observations = week ? weekLines(week) : [];
  const days = view ? (all ? view.days : view.days.slice(0, DAYS_SHOWN)) : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your symptoms')} showBack right={<Pill label={t('Log')} onPress={log} />} />
        <View style={styles.body}>
          <Text style={styles.lead}>{t('Your own record of how you feel. It is not a diagnosis.')}</Text>
          {failed ? <Text style={[formStyles.error, styles.after]}>{t('Something went wrong. Try again.')}</Text> : null}
          {view?.sample ? <Text style={styles.sample}>{t('Sample data: log your first symptom to see your own.')}</Text> : null}

          {view && week ? (
            <>
              {/* Resumen de la semana: cuentas sencillas de los últimos 7 días */}
              <SecRow title={t('Summary of the week')} right={<Text style={styles.secNote}>{t('Last 7 days')}</Text>} />
              {week.days === 0 ? (
                <Text style={styles.empty}>{t('No symptoms logged in the last 7 days.')}</Text>
              ) : (
                <>
                  <FRow
                    title={t('Days with symptoms')}
                    sub={week.prevDays != null ? t('The 7 days before: {n}.', { n: week.prevDays }) : undefined}
                    value={t('{n} of 7', { n: week.days })}
                  />
                  <FRow
                    title={t('Most frequent')}
                    sub={week.top.map((x) => `${nameOf(x)} (${tn(x.days, '{n} day', '{n} days')})`).join(', ')}
                    last={!observations.length}
                  />
                  {observations.map((line, i) => (
                    <View key={line} style={[fine.row, i === observations.length - 1 && styles.lastRow]}>
                      <Text style={styles.observation}>{line}</Text>
                    </View>
                  ))}
                </>
              )}
              {/* De pago, aún sin nada detrás: lleva a comparar suscripciones */}
              <FRow
                title={t('Insights about your week')}
                sub={t('With Kuova Premium: your week explained from everything you log.')}
                right={<LockTag />}
                onPress={() => router.push('/compare-plans')}
                style={styles.teaser}
                last
              />

              {/* Patrones: con qué coincide cada síntoma en sus registros */}
              <SecHead title={t('Patterns')} />
              {view.patterns.length ? (
                <>
                  {view.patterns.map((p, i) => (
                    <FRow key={`${p.key}:${p.kind}`} title={nameOf(p)} sub={patternText(p)} last={i === view.patterns.length - 1} />
                  ))}
                  <Text style={fine.note}>
                    {t('These are coincidences in your own records, not causes or a diagnosis. Only the days with sleep or cycle data count. If something worries you, talk to your doctor.')}
                    {view.patterns.some((p) => p.kind === 'cycle_phase') ? ` ${t('The cycle phases are an estimate from the periods you log.')}` : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.empty}>
                  {t('Not enough records yet to see patterns. When a symptom repeats, you will see here what it coincides with in your records: your sleep and, if you log your periods, your cycle.')}
                </Text>
              )}

              {/* Historial por días */}
              <SecHead title={t('History')} />
              {!view.days.length ? <Text style={styles.empty}>{t('Nothing logged yet.')}</Text> : null}
              {days.map((d) => (
                <View key={d.day}>
                  <Text style={styles.day} accessibilityRole="header">
                    {dayTitle(d.day)}
                  </Text>
                  {d.items.map(({ entry, showNote }, i) => (
                    <View key={entry.id} style={[fine.row, styles.entry, i === d.items.length - 1 && styles.lastRow]}>
                      <Text style={styles.time}>{hhmm(entry.fecha)}</Text>
                      <View style={styles.flex}>
                        <Text style={fine.rowTitle}>{nameOf(entry)}</Text>
                        <Text style={fine.rowSub}>{detailOf(entry)}</Text>
                        {showNote && entry.note ? <Text style={styles.note}>{view.sample && entry.note === SAMPLE_NOTE ? t(SAMPLE_NOTE) : entry.note}</Text> : null}
                      </View>
                      {view.sample ? null : asking === entry.id ? (
                        <View style={styles.confirm}>
                          <TouchableOpacity onPress={() => remove(entry.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('Remove')}: ${nameOf(entry)}`}>
                            <Text style={styles.confirmYes}>{t('Remove')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setAsking(null)} hitSlop={8} accessibilityRole="button">
                            <Text style={styles.confirmNo}>{t('Cancel')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.x} onPress={() => setAsking(entry.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${t('Remove')}: ${nameOf(entry)}`}>
                          <Ionicons name="close" size={18} color={FINE.mute} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              ))}
              {!all && view.days.length > DAYS_SHOWN ? <FineLink label={t('Show older ones')} onPress={() => setAll(true)} style={styles.more} /> : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1, minWidth: 0 },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  lead: { ...fine.note, marginTop: 0 },
  after: { marginTop: 10 },
  lastRow: { borderBottomWidth: 0 },
  secNote: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  empty: { ...fine.note, marginTop: 4 },
  // Una observación de la semana: texto de lectura en su fila
  observation: { ...ff('regular'), flex: 1, color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  // La fila de pago, separada del resumen por la raya de las secciones
  teaser: { marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.rule },
  sample: { ...fine.note, marginTop: 6 },
  // El día de cada grupo de apuntes
  day: { ...fine.kicker, marginTop: 16, marginBottom: 2 },
  // La hora a la izquierda, arriba (un apunte puede llevar tres líneas)
  entry: { alignItems: 'flex-start' },
  time: { ...ff('regular'), width: 46, color: FINE.mute, fontSize: 13, lineHeight: 20, fontVariant: ['tabular-nums'] },
  note: { ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18, marginTop: 4 },
  x: { minHeight: 20, justifyContent: 'center' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 20 },
  confirmYes: { ...ff('medium'), color: FINE.ivory, fontSize: 13 },
  confirmNo: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  more: { marginTop: 8 },
});
