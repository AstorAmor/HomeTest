import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChoiceChips } from '@/components/ChoiceChips';
import { WheelPicker } from '@/components/WheelPicker';
import { Pill } from '@/components/fine/Fine';
import { FButton, FChip, formStyles, ON_BG } from '@/components/fine/FineForm';
import { FineNumber } from '@/components/fine/FineNumber';
import { StepsBar } from '@/components/fine/FineSteps';
import { deleteMedication, medicationRepository } from '@/data/medicationRepository';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { dayKey } from '@/data/bathroomRepository';
import { defaultTimes, findKnownMed, KnownMed, parseMedicationText, scheduleText } from '@/logic/medication';
import { MedicationItem, MedKind, MedSchedule } from '@/types/medication';
import { t as tr } from '@/i18n';
import { offerPhoneReminders } from '@/data/phoneReminders';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FINE, ff, fine } from '@/theme/fine';

type Step = 'what' | 'dose' | 'when' | 'duration' | 'reminders' | 'summary';
type Frequency = 'once' | 'twice' | 'three' | 'every_hours' | 'weekdays' | 'as_needed';

const REGULAR_SUGGESTIONS = ['Vitamin D', 'Magnesium', 'Omega-3', 'Creatine', 'Iron', 'Folic acid', 'Vitamin B12', 'Levothyroxine', 'Contraceptive pill'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const COURSE_DAYS = [3, 5, 7, 10, 14];
const MAX_COURSE_DAYS = 90; // "Other": de 1 a 90 días
const SHORT_SUGGESTIONS = ['Ibuprofen', 'Paracetamol', 'Amoxicillin', 'Omeprazole'];
const SLOTS = [
  { id: '08:00', label: tr('Morning 08:00') },
  { id: '13:30', label: tr('Midday 13:30') },
  { id: '17:00', label: tr('Afternoon 17:00') },
  { id: '20:00', label: tr('Evening 20:00') },
  { id: '22:30', label: tr('Bedtime 22:30') },
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const frequencyOf = (s: MedSchedule): Frequency =>
  s.type === 'as_needed'
    ? 'as_needed'
    : s.type === 'every_hours'
      ? 'every_hours'
      : s.type === 'weekdays'
        ? 'weekdays'
        : s.times.length >= 3
          ? 'three'
          : s.times.length === 2
            ? 'twice'
            : 'once';

// Alta guiada de una medicación o suplemento: lo habitual (?mode=regular) o un tratamiento
// puntual (?mode=short). Lo que el usuario escribe ("ibuprofeno 600 cada 8 horas 3 días") se
// interpreta para rellenar los pasos siguientes; siempre se puede corregir. Se pueden elegir
// varios a la vez: se configuran uno detrás de otro.
// Rediseño del 2026-11-17 (lenguaje fino, src/theme/fine.ts; el fundador: «las "tomas" de medicación no están
// actualizadas con la estética actual»): la misma barra de pasos que el cuestionario del ciclo (StepsBar, con el
// avance como una línea cometa), las preguntas en Inter de peso medio, las opciones en chips con borde y sin
// iconos de color, las casillas casi transparentes y el botón de seguir en esmeralda. «Otra duración» se elige con
// el «− cifra +» (FineNumber) en lugar de la rueda; la hora sigue con sus dos ruedas. Los pasos, lo que se entiende
// del texto, lo que se guarda y los recordatorios no cambian.
export const MedicationSetupScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();
  const [isShort, setIsShort] = useState(params.mode === 'short');
  const [existing, setExisting] = useState<MedicationItem | null>(null);
  const [step, setStep] = useState<Step>('what');
  const [text, setText] = useState('');
  const [known, setKnown] = useState<KnownMed | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MedKind>('supplement');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [hours, setHours] = useState(8);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [withFood, setWithFood] = useState<MedicationItem['withFood']>();
  const [courseDays, setCourseDays] = useState<number | undefined>();
  const [reminders, setReminders] = useState<'yes' | 'no' | undefined>();
  // Varios a la vez: los elegidos en la lista y los que faltan por configurar
  const [picked, setPicked] = useState<string[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [total, setTotal] = useState(1);
  // "Other time": ruedas de hora y minutos
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDaysOpen, setOtherDaysOpen] = useState(false);
  const [otherDays, setOtherDays] = useState(5); // índice: 6 días
  const [otherDaysOk, setOtherDaysOk] = useState(true); // false con una cifra a medio escribir que aún no vale
  const [otherHour, setOtherHour] = useState(9);
  const [otherMinute, setOtherMinute] = useState(0);

  // Editar: partir de lo guardado
  useEffect(() => {
    if (!params.id) return;
    medicationRepository.getAll().then((all) => {
      const m = all.find((x) => x.id === params.id);
      if (!m) return;
      setExisting(m);
      setIsShort(m.course.type === 'short');
      setText(m.name);
      setName(m.name);
      setKind(m.kind);
      setDose(m.dose ?? '');
      applySchedule(m.schedule);
      setWithFood(m.withFood);
      if (m.course.type === 'short') setCourseDays(m.course.days);
      setReminders(m.reminders ? 'yes' : 'no');
      setKnown(findKnownMed(m.name));
    });
  }, [params.id]);

  const applySchedule = (s: MedSchedule) => {
    setFrequency(frequencyOf(s));
    if (s.type === 'times') setTimes(s.times);
    if (s.type === 'weekdays') {
      setDays(s.days);
      setTimes(s.times);
    }
    if (s.type === 'every_hours') {
      setHours(s.hours);
      setTimes([s.firstTime]);
    }
  };

  // Paso 1 → rellenar el resto con lo que se entiende del texto y con la pauta habitual
  const understand = (input = text) => {
    const parsed = parseMedicationText(input);
    const k = findKnownMed(input);
    setText(input);
    setKnown(k);
    setName(parsed.name ?? (k ? tr(k.label) : input.trim()));
    setKind(k?.kind ?? (isShort ? 'medication' : kind));
    if (parsed.dose) setDose(parsed.dose);
    const schedule = parsed.schedule ?? k?.schedule;
    if (schedule) applySchedule(schedule);
    if (k?.withFood) setWithFood(k.withFood);
    if (isShort) setCourseDays(parsed.courseDays ?? k?.shortCourseDays);
    setPrefilled(!!(parsed.dose || parsed.schedule || parsed.courseDays || k));
    setStep('dose');
  };

  const schedule = (): MedSchedule => {
    if (frequency === 'as_needed') return { type: 'as_needed' };
    if (frequency === 'every_hours') return { type: 'every_hours', hours, firstTime: times[0] ?? '07:00' };
    if (frequency === 'weekdays') return { type: 'weekdays', days, times: times.length ? times : ['08:00'] };
    const n = frequency === 'once' ? 1 : frequency === 'twice' ? 2 : 3;
    const chosen = [...times].sort().slice(0, n);
    return { type: 'times', times: chosen.length === n ? chosen : defaultTimes(n) };
  };

  const steps: Step[] = ['what', 'dose', 'when', ...(isShort ? (['duration'] as Step[]) : []), 'reminders', 'summary'];
  const index = steps.indexOf(step);
  // Al editar no se vuelve a interpretar el texto (pisaría lo que ya se corrigió)
  const start = () => {
    const typed = text.trim();
    const list = [...(typed.length > 1 && !picked.includes(typed) ? [typed] : []), ...picked];
    setQueue(list.slice(1));
    setTotal(list.length);
    understand(list[0]);
  };
  const next = () => (step === 'what' && !existing ? start() : setStep(steps[index + 1]));
  const canContinue =
    (step === 'what' && (text.trim().length > 1 || picked.length > 0)) ||
    step === 'dose' ||
    (step === 'when' && (frequency === 'as_needed' || times.length > 0)) ||
    (step === 'duration' && !!courseDays) ||
    (step === 'reminders' && (!!reminders || frequency === 'as_needed')) ||
    step === 'summary';

  const save = async () => {
    const now = new Date().toISOString();
    const item: MedicationItem = {
      id: existing?.id ?? `${Date.now()}`,
      fecha: existing?.fecha ?? now,
      createdAt: existing?.createdAt ?? now,
      name: name.trim() || text.trim(),
      kind,
      dose: dose.trim() || undefined,
      schedule: schedule(),
      course: isShort
        ? { type: 'short', startDate: existing?.course.type === 'short' ? existing.course.startDate : dayKey(new Date()), days: courseDays ?? 5 }
        : { type: 'ongoing' },
      withFood,
      reminders: frequency !== 'as_needed' && reminders === 'yes',
      remindersMutedUntil: existing?.remindersMutedUntil,
    };
    if (existing) await medicationRepository.update(existing.id, item);
    else await medicationRepository.save(item);
    // Acaba de pedir recordatorios: buen momento para el permiso de notificaciones del móvil
    if (item.reminders) void offerPhoneReminders('medication');
    if (queue.length) {
      // El siguiente de la lista, desde cero
      const [nextOne, ...rest] = queue;
      setQueue(rest);
      setDose('');
      setFrequency('once');
      setTimes(['08:00']);
      setWithFood(undefined);
      setCourseDays(undefined);
      setReminders(undefined);
      setKind(isShort ? 'medication' : 'supplement');
      understand(nextOne);
      return;
    }
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAsk(tr('Delete {name}?', { name: tr(existing.name) }), tr('Its logged doses are deleted too. This cannot be undone.'), tr('Delete'));
    if (!ok) return;
    await deleteMedication(existing.id);
    router.back();
  };

  const toggleTime = (t: string) =>
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()));
  const slotOptions = [...SLOTS, ...times.filter((t) => !SLOTS.some((s) => s.id === t)).map((t) => ({ id: t, label: t }))];
  const togglePicked = (name: string) =>
    setPicked((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  const addOther = () => {
    const t = `${HOURS[otherHour]}:${MINUTES[otherMinute]}`;
    setTimes((prev) => (prev.includes(t) ? prev : [...prev, t].sort()));
    setOtherOpen(false);
  };
  // Lo que se está configurando, a la vista en todos los pasos (con varios: cuál va y cuáles faltan)
  const current = name || text.trim();
  const currentBar =
    step !== 'what' && current ? (
      <View style={styles.current}>
        <View style={{ flex: 1 }}>
          <Text style={styles.currentName} numberOfLines={1}>
            {current}
          </Text>
          {queue.length > 0 && (
            <Text style={styles.currentNext} numberOfLines={2}>
              {tr('Then: {names}', { names: queue.join(', ') })}
            </Text>
          )}
        </View>
        {total > 1 && <Text style={styles.currentPos}>{tr('{i} of {n}', { i: total - queue.length, n: total })}</Text>}
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StepsBar
        index={index}
        total={steps.length}
        onBack={() => (index > 0 ? setStep(steps[index - 1]) : router.back())}
        right={
          existing ? (
            <TouchableOpacity style={styles.trash} onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('Delete')}>
              <Ionicons name="trash-outline" size={19} color={FINE.mute} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {currentBar}
        {step === 'what' && (
          <>
            <Text style={styles.title}>{isShort ? tr('What are you taking?') : tr('What do you take regularly?')}</Text>
            <Text style={styles.subtitle}>
              {tr('Write it the way you would say it. For example: “{example}”.', {
                example: isShort ? tr('Ibuprofen 600 every 8 hours for 3 days') : tr('Vitamin D 1000 IU once a day'),
              })}
            </Text>
            <TextInput
              style={styles.bigInput}
              value={text}
              onChangeText={setText}
              placeholder={isShort ? tr('Name, dose, how often, for how long') : tr('Name, dose, how often')}
              placeholderTextColor={FINE.mute}
              autoFocus
            />
            <Text style={styles.label}>{tr('Or pick one or more')}</Text>
            <View style={styles.slots}>
              {(isShort ? SHORT_SUGGESTIONS : REGULAR_SUGGESTIONS).map((en) => {
                // En el idioma de la app: lo que se elige es también el nombre que se guarda
                const s = tr(en);
                return <FChip key={s} multi check label={s} on={picked.includes(s)} onPress={() => togglePicked(s)} />;
              })}
            </View>
            {picked.length > 1 && (
              <Text style={styles.tip}>{tr('We will set them up one after the other ({n}).', { n: picked.length })}</Text>
            )}
          </>
        )}

        {step === 'dose' && (
          <>
            {/* Lo que hay que revisar, en oro y sin caja */}
            {prefilled && <Text style={styles.prefilled}>{tr('We filled in the next steps from what you wrote. Check them.')}</Text>}
            <Text style={styles.title}>{name || tr('How much?')}</Text>
            <Text style={styles.label}>{tr('Is it a medicine or a supplement?')}</Text>
            <ChoiceChips
              options={[
                { id: 'medication', label: tr('Medicine') },
                { id: 'supplement', label: tr('Supplement') },
              ]}
              value={kind}
              onChange={(v) => setKind(v as MedKind)}
            />
            <Text style={styles.label}>{tr('How much each time? (optional)')}</Text>
            <TextInput
              style={styles.input}
              value={dose}
              onChangeText={setDose}
              placeholder={tr('1 tablet, 600 mg, 1000 IU…')}
              placeholderTextColor={FINE.mute}
            />
          </>
        )}

        {step === 'when' && (
          <>
            <Text style={[styles.title, styles.titleGap]}>{tr('How often and when?')}</Text>
            <ChoiceChips
              options={[
                { id: 'once', label: tr('Once a day') },
                { id: 'twice', label: tr('Twice a day') },
                { id: 'three', label: tr('Three times a day') },
                { id: 'every_hours', label: tr('Every few hours') },
                { id: 'weekdays', label: tr('Some days of the week') },
                { id: 'as_needed', label: tr('Only when I need it') },
              ]}
              value={frequency}
              onChange={(v) => setFrequency(v as Frequency)}
            />
            {frequency === 'every_hours' && (
              <>
                <Text style={styles.label}>{tr('Every')}</Text>
                <ChoiceChips options={[4, 6, 8, 12].map((h) => ({ id: h, label: tr('{n} hours', { n: h }) }))} value={hours} onChange={setHours} />
                <Text style={styles.label}>{tr('First dose of the day')}</Text>
                <ChoiceChips
                  options={['06:00', '07:00', '08:00', '09:00'].map((t) => ({ id: t, label: t }))}
                  value={times[0]}
                  onChange={(t) => setTimes([t])}
                />
              </>
            )}
            {frequency === 'weekdays' && (
              <>
                <Text style={styles.label}>{tr('Which days?')}</Text>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.weekDay, on && styles.weekDayOn]}
                        onPress={() => setDays((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i].sort()))}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                      >
                        <Text style={[styles.weekDayText, on && styles.weekDayTextOn]}>{tr(d)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {(frequency === 'once' || frequency === 'twice' || frequency === 'three' || frequency === 'weekdays') && (
              <>
                <Text style={styles.label}>
                  {frequency === 'twice' ? tr('At what times? (pick 2)') : frequency === 'three' ? tr('At what times? (pick 3)') : tr('At what time?')}
                </Text>
                <View style={styles.slots}>
                  {slotOptions.map((s) => {
                    const on = times.includes(s.id);
                    // Una hora añadida a mano no se quita al tocarla (desaparecería): lleva su × para eso
                    if (!SLOTS.some((x) => x.id === s.id)) {
                      return (
                        <View key={s.id} style={styles.slotCustom}>
                          <Text style={styles.slotCustomText}>{s.label}</Text>
                          <TouchableOpacity onPress={() => toggleTime(s.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('Remove {time}', { time: s.label })}>
                            <Ionicons name="close" size={15} color={FINE.mute} />
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return <FChip key={s.id} multi label={tr(s.label)} on={on} onPress={() => toggleTime(s.id)} />;
                  })}
                  <FChip multi label={tr('+ Other time')} on={otherOpen} onPress={() => setOtherOpen((v) => !v)} />
                </View>
                {otherOpen && (
                  <View style={styles.otherBox}>
                    <View style={styles.wheels}>
                      {/* Las ruedas bajas, de tres filas (como en metas): con cinco ocupaban media pantalla */}
                      <WheelPicker items={HOURS} selectedIndex={otherHour} onChange={setOtherHour} width={80} visible={3} />
                      <Text style={styles.colon}>:</Text>
                      <WheelPicker items={MINUTES} selectedIndex={otherMinute} onChange={setOtherMinute} width={80} visible={3} />
                    </View>
                    <Pill label={tr('Add {time}', { time: `${HOURS[otherHour]}:${MINUTES[otherMinute]}` })} onPress={addOther} />
                  </View>
                )}
              </>
            )}
            {frequency !== 'as_needed' && (
              <>
                <Text style={styles.label}>{tr('With food?')}</Text>
                <ChoiceChips
                  options={[
                    { id: 'with', label: tr('With food') },
                    { id: 'empty', label: tr('Empty stomach') },
                    { id: 'any', label: tr("Doesn't matter") },
                  ]}
                  value={withFood}
                  onChange={(v) => setWithFood(v as MedicationItem['withFood'])}
                />
              </>
            )}
            {known && <Text style={styles.tip}>{tr(known.tip)}</Text>}
          </>
        )}

        {step === 'duration' && (
          <>
            <Text style={styles.title}>{tr('For how long?')}</Text>
            <Text style={styles.subtitle}>
              {known?.shortCourseDays
                ? tr('{name} is often taken for {n} days. Follow what your doctor or the leaflet says.', { name: tr(known.label), n: known.shortCourseDays })
                : tr('Check your prescription or the leaflet.')}
            </Text>
            {/* Duraciones típicas + "Other" con su «− cifra +», y la que ya tenga si no es típica */}
            <ChoiceChips
              options={[
                ...[...COURSE_DAYS, ...(courseDays && !COURSE_DAYS.includes(courseDays) ? [courseDays] : [])]
                  .sort((a, b) => a - b)
                  .map((d) => ({ id: d, label: tr(d === 1 ? '{n} day' : '{n} days', { n: d }) })),
                { id: 0, label: tr('+ Other') },
              ]}
              value={otherDaysOpen ? 0 : courseDays}
              onChange={(d) => {
                if (d === 0) {
                  if (courseDays) setOtherDays(Math.min(89, courseDays - 1));
                  setOtherDaysOpen((v) => !v);
                  return;
                }
                setOtherDaysOpen(false);
                setCourseDays(d);
              }}
            />
            {otherDaysOpen && (
              <View style={styles.otherBox}>
                <FineNumber
                  compact
                  value={otherDays + 1}
                  min={1}
                  max={MAX_COURSE_DAYS}
                  fastStep={5}
                  unit={tr('days')}
                  label={tr('For how long?')}
                  onChange={(v) => setOtherDays(v - 1)}
                  onValidChange={setOtherDaysOk}
                />
                <View style={!otherDaysOk && styles.off} pointerEvents={otherDaysOk ? 'auto' : 'none'}>
                  <Pill
                    label={tr(otherDays === 0 ? 'For {n} day' : 'For {n} days', { n: otherDays + 1 })}
                    onPress={() => {
                      setCourseDays(otherDays + 1);
                      setOtherDaysOpen(false);
                    }}
                  />
                </View>
              </View>
            )}
            {known?.tip ? <Text style={styles.tip}>{tr(known.tip)}</Text> : null}
          </>
        )}

        {step === 'reminders' && (
          <>
            <Text style={styles.title}>{tr('Do you want a reminder?')}</Text>
            {frequency === 'as_needed' ? (
              <Text style={styles.subtitle}>{tr('You take it only when you need it, so there are no reminders. Log it when you take it.')}</Text>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  {tr('We can remind you at each dose, or you can keep track yourself. You can change it or mute it any time.')}
                </Text>
                <ChoiceChips
                  options={[
                    { id: 'yes', label: tr('Remind me') },
                    { id: 'no', label: tr("I'll track it myself") },
                  ]}
                  value={reminders}
                  onChange={(v) => setReminders(v as 'yes' | 'no')}
                />
              </>
            )}
          </>
        )}

        {step === 'summary' && (
          <>
            <Text style={styles.title}>{tr('Check it')}</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryName}>{name || text}</Text>
              <Text style={styles.summaryLine}>
                {kind === 'supplement' ? tr('Supplement') : tr('Medicine')}
                {dose ? ` · ${dose}` : ''}
              </Text>
              <Text style={styles.summaryLine}>{scheduleText(schedule())}</Text>
              {isShort && <Text style={styles.summaryLine}>{tr(courseDays === 1 ? 'For {n} day, from today' : 'For {n} days, from today', { n: courseDays ?? 5 })}</Text>}
              {withFood && withFood !== 'any' && (
                <Text style={styles.summaryLine}>{withFood === 'with' ? tr('With food') : tr('On an empty stomach')}</Text>
              )}
              <Text style={styles.summaryLine}>
                {frequency === 'as_needed' ? tr('No reminders') : reminders === 'yes' ? tr('Reminders on') : tr('No reminders, I track it')}
              </Text>
            </View>
            {known && <Text style={styles.tip}>{tr(known.tip)}</Text>}
            <Text style={styles.disclaimer}>{tr('Always follow your prescription and the leaflet. Kuova does not change your treatment.')}</Text>
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter style={styles.footer}>
        <FButton
          label={step === 'summary' ? (queue.length ? tr('Save and set up {name}', { name: queue[0] }) : tr('Save')) : tr('Continue')}
          onPress={step === 'summary' ? save : next}
          disabled={!canContinue}
        />
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  trash: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  // Lo que se está configurando: su nombre en jade sobre una línea fina, sin caja ni icono
  current: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: FINE.line },
  currentName: { ...ff('medium'), color: FINE.jade, fontSize: 14, lineHeight: 19 },
  currentNext: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  currentPos: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  // «Otra hora» y «otra duración»: una tarjeta casi transparente con lo de elegir y su píldora para añadirlo
  otherBox: { ...fine.tile, marginTop: 12, paddingVertical: 14, alignItems: 'center', gap: 12 },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { ...ff('light'), color: FINE.ivory, fontSize: 22, marginHorizontal: 4 },
  off: { opacity: 0.4 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  // La pregunta de cada paso y su explicación, como en «Crear mi menú» y en el cuestionario del ciclo
  title: { ...formStyles.q },
  titleGap: { marginBottom: 14 }, // cuando lo que sigue son las opciones, sin explicación en medio
  subtitle: { ...formStyles.lead, marginBottom: 16 },
  label: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 22, marginTop: 24, marginBottom: 10 },
  bigInput: { ...formStyles.input, fontSize: 16, paddingVertical: 13 },
  input: { ...formStyles.input },
  prefilled: { ...formStyles.warn, marginBottom: 14 },
  weekRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  // Los días de la semana: círculos con borde fino; el elegido, con borde jade y la letra en marfil (como los chips)
  weekDay: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: FINE.line, alignItems: 'center', justifyContent: 'center' },
  weekDayOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  weekDayText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  weekDayTextOn: { color: FINE.ivory },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Una hora añadida a mano: como un chip elegido, con su × para quitarla
  slotCustom: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: FINE.jade, backgroundColor: ON_BG },
  slotCustomText: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  tip: { ...fine.note, fontSize: 13, lineHeight: 19, marginTop: 16 },
  // El resumen antes de guardar: una tarjeta casi transparente
  summaryCard: { ...fine.tile, padding: 14, gap: 4, marginTop: 14 },
  summaryName: { ...ff('medium'), color: FINE.ivory, fontSize: 17, lineHeight: 23, marginBottom: 4 },
  summaryLine: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  disclaimer: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, lineHeight: 16, marginTop: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
});
