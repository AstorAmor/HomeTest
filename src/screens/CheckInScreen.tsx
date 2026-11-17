import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckInEntry, DayMoment, MOMENT_OPTIONS, Mood } from '@/types/checkIn';
import { noteCheckInSaved } from '@/logic/checkInCelebration';
import { checkInRepository, checkInSuggestions, suggestMoment, Suggestion } from '@/data/checkInRepository';
import { checkInDayKey, checkInDayOptions, fechaForCheckIn, localDayKey } from '@/logic/checkInDay';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { dateLocale, t } from '@/i18n';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { offerPhoneReminders } from '@/data/phoneReminders';
import { profileRepository } from '@/data/profileRepository';
import { loadCheckInTags, removeCheckInTags, saveCheckInTags } from '@/data/checkInTagRepository';
import { tagsFor } from '@/logic/checkInTags';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { Ruler } from '@/components/checkin/Ruler';
import { MoodFaces } from '@/components/checkin/MoodFaces';
import { FINE, ff, fine } from '@/theme/fine';

type QuestionId = 'sleep' | 'energy' | 'stress' | 'dayRating' | 'mood';
type ScaleId = Exclude<QuestionId, 'mood'>;

// Qué se pregunta según el momento del día (primera respuesta del check-in). La energía va siempre arriba, que
// es la pregunta que se repite en los tres momentos (fundador, 2026-11-16: «dejaría que arriba esté siempre la
// energía»); debajo, la propia de cada momento.
const QUESTIONS: Record<DayMoment, QuestionId[]> = {
  just_woke_up: ['energy', 'sleep', 'mood'],
  mid_day: ['energy', 'stress', 'mood'],
  winding_down: ['energy', 'dayRating', 'mood'],
};

// Cada escala, una etiqueta y los números 1 a 5, sin preguntas ni palabras coloquiales (fundador, 2026-11-17: «más
// preciso, más científico… «A tope» es súper malo»; «Energía y la regla, Estrés y la regla»). Se guarda lo mismo, de 1 a 5:
// la base de datos solo acepta 1-5 y el fundador eligió números 1-5 antes que una migración a 0-10.
const SCALE_STEPS = ['1', '2', '3', '4', '5'];
const QUESTION_TEXT: Record<ScaleId, { title: string; labels: string[] }> = {
  sleep: { title: 'Sleep quality', labels: SCALE_STEPS },
  energy: { title: 'Energy', labels: SCALE_STEPS },
  stress: { title: 'Stress', labels: SCALE_STEPS },
  dayRating: { title: 'Day rating', labels: SCALE_STEPS },
};

// El nombre corto de cada momento en sus pestañas, como en el prototipo (Mañana · Mediodía · Noche); el largo
// queda para el lector de pantalla
const MOMENT_SHORT: Record<DayMoment, string> = { just_woke_up: 'Morning', mid_day: 'Midday', winding_down: 'Night' };

// "Hoy", "Ayer" o "mié 15"
const dayLabel = (key: string, now: Date) => {
  if (key === localDayKey(now)) return t('Today');
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (key === localDayKey(y)) return t('Yesterday');
  return new Date(`${key}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' });
};

// Todo el check-in en una sola pantalla: momento del día (preseleccionado el
// sugerido), el día al que cuenta, las preguntas de ese momento, el ánimo y una nota opcional.
// ?id=… edita uno ya hecho (y lo puede mover de día o borrar); ?date=…&moment=… apunta uno de un
// día pasado (desde "Tus últimos días").
// Con el lenguaje fino del prototipo (borradores/app-estructura/prototipo, pantalla «ci»; 2026-11-16): los
// momentos en pestañas pequeñas con borde, cada escala en una regla (src/components/checkin/Ruler.tsx), los
// ánimos dibujados a línea (src/components/checkin/MoodFaces.tsx), las etiquetas en píldoras con borde, la
// nota como «Tu diario» y el botón esmeralda centrado. La lógica, los datos y la ruta, los de siempre.
export const CheckInScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string; moment?: DayMoment }>();
  const now = useMemo(() => new Date(), []);
  const suggested = useMemo(() => suggestMoment(now), [now]);
  const [moment, setMoment] = useState<DayMoment>(params.moment ?? suggested);
  const [editing, setEditing] = useState<CheckInEntry | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(params.date ?? null);
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, number>>>({});
  const [mood, setMood] = useState<Mood>();
  const [note, setNote] = useState('');
  // Etiquetas de «¿Algo más?» (dolor de cabeza, hinchazón…): solo quedan registradas con el check-in
  const [tags, setTags] = useState<string[]>([]);
  const [sex, setSex] = useState<string | null>(null);
  useEffect(() => {
    profileRepository
      .get()
      .then((p) => setSex(p?.sex ?? null))
      .catch(() => undefined);
  }, []);
  const [done, setDone] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  // Los check-ins ya hechos, para marcar con un check los momentos de ese día que ya tienes
  const [all, setAll] = useState<CheckInEntry[]>([]);
  useEffect(() => {
    checkInRepository
      .getAll()
      .then(setAll)
      .catch(() => undefined);
  }, []);

  // Las respuestas de un check-in ya hecho, en el formulario (guardar lo cambia)
  const fill = (e: CheckInEntry) => {
    setEditing(e);
    setAnswers({ sleep: e.sleep, energy: e.energy, stress: e.stress, dayRating: e.dayRating });
    setMood(e.mood);
    setNote(e.note ?? '');
    setTags([]);
    loadCheckInTags(e.id)
      .then(setTags)
      .catch(() => undefined);
  };

  // Editar: se cargan las respuestas del check-in
  useEffect(() => {
    if (!params.id) return;
    checkInRepository
      .getAll()
      .then((all) => {
        const e = all.find((x) => x.id === params.id);
        if (!e) return;
        fill(e);
        setMoment(e.moment);
        setPickedDay(checkInDayKey(e));
      })
      .catch(() => undefined);
  }, [params.id]);

  const scales = QUESTIONS[moment].filter((q): q is ScaleId => q !== 'mood');
  const complete = !!mood && scales.every((q) => answers[q] !== undefined);

  // Día al que cuenta: el elegido o, si no, el que toca por la hora (de madrugada, el anterior)
  const dayOptions = checkInDayOptions(moment, now, pickedDay ?? undefined);
  const day = pickedDay && dayOptions.includes(pickedDay) ? pickedDay : dayOptions[0];
  const pastMidnight = !pickedDay && !params.id && day !== localDayKey(now);
  // Apuntado o movido a otro día (no el que toca ahora): sin ideas "para ahora" al guardar
  const backdated = !!params.id || !!params.date || day !== dayOptions[0];
  const doneMoments = new Set(all.filter((e) => (!params.id || e.id !== editing?.id) && checkInDayKey(e) === day).map((e) => e.moment));

  // Un momento que ya hiciste ese día (el del check): se ve lo que marcaste y guardar lo cambia, en vez
  // de apuntar otro (fundador, 2026-11-05). Al pasar a uno sin hacer, el formulario vuelve a estar vacío.
  const existing = params.id ? undefined : all.find((e) => checkInDayKey(e) === day && e.moment === moment);
  const autoLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (params.id) return;
    if (existing) {
      autoLoaded.current = existing.id;
      fill(existing);
    } else if (autoLoaded.current) {
      autoLoaded.current = null;
      setEditing(null);
      setAnswers({});
      setMood(undefined);
      setNote('');
      setTags([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, params.id]);

  const save = async () => {
    if (!complete) return;
    const nowIso = new Date().toISOString();
    // Solo se guardan las respuestas de las preguntas del momento elegido (al editar, las del
    // momento anterior se borran con null).
    const pick = (q: ScaleId) => (scales.includes(q) ? answers[q] : undefined);
    const entry: Omit<CheckInEntry, 'id' | 'createdAt'> = {
      fecha: fechaForCheckIn(day, moment, editing?.fecha ?? nowIso),
      moment,
      sleep: pick('sleep'),
      energy: pick('energy'),
      stress: pick('stress'),
      dayRating: pick('dayRating'),
      mood,
      note: note.trim() || undefined,
    };
    if (editing) {
      const clear = <V,>(v: V | undefined) => (v === undefined ? (null as unknown as V) : v);
      await checkInRepository.update(editing.id, {
        ...entry,
        sleep: clear(entry.sleep),
        energy: clear(entry.energy),
        stress: clear(entry.stress),
        dayRating: clear(entry.dayRating),
        note: clear(entry.note),
      });
      await saveCheckInTags(editing.id, entry.fecha, tags).catch((e) => console.warn('Check-in tags not saved', e));
      router.back();
      return;
    }
    const id = `checkin-${Date.now()}`;
    await checkInRepository.save({ ...entry, id, createdAt: nowIso });
    if (tags.length) await saveCheckInTags(id, entry.fecha, tags).catch((e) => console.warn('Check-in tags not saved', e));
    noteCheckInSaved(); // si con este se completan los 3 de hoy, Hoy lo celebra
    void offerPhoneReminders('checkin');
    // Apuntado para un día pasado: sin ideas "para ahora"
    if (backdated) {
      router.back();
      return;
    }
    setSuggestions(checkInSuggestions(entry));
    setDone(true);
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirmAsk(t('Delete this check-in?'), t('It will disappear from your days and your trends.'), t('Delete'));
    if (!ok) return;
    await checkInRepository.remove(editing.id);
    await removeCheckInTags(editing.id).catch(() => undefined);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={editing ? t('Edit check-in') : t('Check in')} showBack={!done} />

      <KeyboardAwareScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!done && (
          <>
            {/* Momento del día: pestañas pequeñas con borde; la elegida, en marfil con borde jade. El check, si
                ese momento ya está hecho ese día. */}
            <View style={styles.tabs} accessibilityRole="radiogroup" accessibilityLabel={t('Time of day')}>
              {MOMENT_OPTIONS.map((o) => {
                const selected = moment === o.id;
                const had = doneMoments.has(o.id);
                const color = selected ? FINE.ivory : FINE.mute;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.tab, selected && styles.tabOn]}
                    onPress={() => setMoment(o.id)}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={had ? `${t(o.label)}. ${t('Already done that day')}` : t(o.label)}
                  >
                    {had && <Ionicons name="checkmark" size={12} color={color} />}
                    <Text style={[styles.tabText, { color }]}>{t(MOMENT_SHORT[o.id])}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {moment === suggested && !backdated && <Text style={fine.note}>{t('Suggested from the time of day.')}</Text>}

            <SecHead title={t('Which day does it count for?')} />
            <View style={styles.tabs}>
              {dayOptions.map((key) => {
                const selected = key === day;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.tab, selected && styles.tabOn]}
                    onPress={() => setPickedDay(key)}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text style={[styles.tabText, styles.dayText, { color: selected ? FINE.ivory : FINE.mute }]}>{dayLabel(key, now)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {pastMidnight && <Text style={fine.note}>{t('It is the small hours, so it counts for yesterday.')}</Text>}

            {/* Cada escala, una regla de 5 posiciones numeradas: se guarda lo mismo que antes, de 1 a 5 */}
            {scales.map((q) => (
              <Ruler
                key={q}
                title={t(QUESTION_TEXT[q].title)}
                words={QUESTION_TEXT[q].labels.map((l) => t(l))}
                value={answers[q]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q]: v }))}
              />
            ))}

            <SecHead title={t('Mood')} />
            <MoodFaces value={mood} onChange={setMood} />

            <SecHead title={t('Tags (optional)')} />
            {/* Etiquetas para marcar con un toque: quedan registradas con el check-in (2026-11-16) */}
            <View style={styles.chips}>
              {tagsFor(sex).map((tag) => {
                const on = tags.includes(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setTags((prev) => (prev.includes(tag.id) ? prev.filter((x) => x !== tag.id) : [...prev, tag.id]))}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(tag.label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* La nota de siempre, ahora «Tu diario»: se lee en «Tus últimos días» */}
            <SecHead title={t('Your diary')} />
            <TextInput
              style={styles.diary}
              placeholder={t('Write whatever you want to remember about today')}
              placeholderTextColor={FINE.mute}
              value={note}
              onChangeText={setNote}
              multiline
              accessibilityLabel={t('Your diary')}
            />
          </>
        )}

        {done && (
          <>
            <View style={styles.doneRing}>
              <Ionicons name="checkmark" size={30} color={FINE.jade} />
            </View>
            <Text style={[fine.title, styles.center]}>{t('Checked in')}</Text>
            <Text style={[fine.note, styles.center, styles.doneLead]}>{t('Here are a few ideas for right now. All optional.')}</Text>
            {suggestions.map((s, i) => {
              const isAccepted = accepted.has(s.id);
              return (
                <View key={s.id} style={[fine.row, i === suggestions.length - 1 && styles.lastRow]}>
                  <View style={styles.rowText}>
                    <Text style={fine.rowTitle}>{t(s.title)}</Text>
                    <Text style={fine.rowSub}>
                      {s.minutes} min · {t(s.subtitle)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.start}
                    onPress={() => {
                      setAccepted((prev) => new Set(prev).add(s.id));
                      router.push({ pathname: '/exercise', params: { id: s.id } });
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.startText, isAccepted && { color: FINE.mute }]}>{isAccepted ? t('Again') : t('Start')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={styles.footer}>
          {!done ? (
            <>
              <TouchableOpacity
                style={[fine.pill, styles.save, !complete && styles.saveOff]}
                onPress={save}
                disabled={!complete}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ disabled: !complete }}
              >
                <Text style={fine.pillText}>{editing ? t('Save changes') : t('Save check-in')}</Text>
              </TouchableOpacity>
              {editing && (
                <TouchableOpacity onPress={remove} style={styles.deleteLink} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.deleteText}>{t('Delete this check-in')}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity style={[fine.pill, styles.save]} onPress={() => router.back()} activeOpacity={0.8} accessibilityRole="button">
              <Text style={fine.pillText}>{t('Done')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 24,
  },
  center: { textAlign: 'center' },
  // Pestañas pequeñas con borde (.tabs del prototipo): momentos del día y día al que cuenta
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FINE.line,
  },
  tabOn: { borderColor: FINE.jade },
  tabText: { ...ff('regular'), fontSize: 12.5 },
  dayText: { textTransform: 'capitalize' },
  // Etiquetas de «¿Algo más?» (.chipsw del prototipo)
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FINE.line,
  },
  chipOn: { borderColor: FINE.jade, backgroundColor: 'rgba(131,214,180,0.08)' },
  chipText: { ...ff('regular'), fontSize: 13, color: FINE.mute },
  chipTextOn: { color: FINE.ivory },
  // «Tu diario» (.diary del prototipo)
  diary: {
    minHeight: 104,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
    color: FINE.ivory,
    ...ff('regular'),
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  // Después de guardar: un aro fino con el check, el título y las ideas en filas con línea
  doneRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  doneLead: { marginTop: 4, marginBottom: 14 },
  rowText: { flex: 1, minWidth: 0 },
  lastRow: { borderBottomWidth: 0 },
  start: {
    minHeight: 34,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
  },
  startText: { ...ff('medium'), fontSize: 13, color: FINE.jade },
  // El botón esmeralda, centrado (.pill del prototipo, un poco más alto para el dedo)
  footer: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  save: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22 },
  saveOff: { opacity: 0.4 },
  deleteLink: { marginTop: 14, paddingVertical: 2 },
  deleteText: { ...ff('regular'), fontSize: 13, color: FINE.mute },
});
