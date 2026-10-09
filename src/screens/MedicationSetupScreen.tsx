import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { WheelPicker } from '@/components/WheelPicker';
import { medicationRepository } from '@/data/medicationRepository';
import { dayKey } from '@/data/bathroomRepository';
import { defaultTimes, findKnownMed, KnownMed, medIcon, parseMedicationText, scheduleText } from '@/logic/medication';
import { MedicationItem, MedKind, MedSchedule } from '@/types/medication';

type Step = 'what' | 'dose' | 'when' | 'duration' | 'reminders' | 'summary';
type Frequency = 'once' | 'twice' | 'three' | 'every_hours' | 'weekdays' | 'as_needed';

const REGULAR_SUGGESTIONS = ['Vitamin D', 'Magnesium', 'Omega-3', 'Creatine', 'Iron', 'Folic acid', 'Vitamin B12', 'Levothyroxine', 'Contraceptive pill'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const COURSE_DAYS = [3, 5, 7, 10, 14];
const DAY_ITEMS = Array.from({ length: 90 }, (_, i) => String(i + 1)); // "Other": de 1 a 90 días
const SHORT_SUGGESTIONS = ['Ibuprofen', 'Paracetamol', 'Amoxicillin', 'Omeprazole'];
const SLOTS = [
  { id: '08:00', label: 'Morning 08:00' },
  { id: '13:30', label: 'Midday 13:30' },
  { id: '17:00', label: 'Afternoon 17:00' },
  { id: '20:00', label: 'Evening 20:00' },
  { id: '22:30', label: 'Bedtime 22:30' },
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
    setName(parsed.name ?? k?.label ?? input.trim());
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
  const position = total > 1 ? `${total - queue.length} of ${total}` : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => (index > 0 ? setStep(steps[index - 1]) : router.back())}>
          <Ionicons name={index > 0 ? 'chevron-back' : 'close'} size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'what' && (
          <>
            <Text style={styles.title}>{isShort ? 'What are you taking?' : 'What do you take regularly?'}</Text>
            <Text style={styles.subtitle}>
              Write it the way you would say it. For example: {isShort ? '"Ibuprofen 600 every 8 hours for 3 days"' : '"Vitamin D 1000 IU once a day"'}.
            </Text>
            <TextInput
              style={styles.bigInput}
              value={text}
              onChangeText={setText}
              placeholder={isShort ? 'Name, dose, how often, for how long' : 'Name, dose, how often'}
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <Text style={styles.label}>Or pick one or more</Text>
            <View style={styles.slots}>
              {(isShort ? SHORT_SUGGESTIONS : REGULAR_SUGGESTIONS).map((s) => {
                const on = picked.includes(s);
                return (
                  <TouchableOpacity key={s} style={[styles.slot, styles.suggestion, on && styles.slotOn]} onPress={() => togglePicked(s)}>
                    <MaterialCommunityIcons
                      name={medIcon(s, findKnownMed(s)?.kind ?? 'medication').name as any}
                      size={16}
                      color={findKnownMed(s)?.kind === 'supplement' ? Colors.green : Colors.gold}
                    />
                    <Text style={[styles.slotText, on && { color: Colors.textPrimary }]}>
                      {on ? '✓ ' : ''}
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {picked.length > 1 && (
              <Text style={styles.tip}>We will set them up one after the other ({picked.length}).</Text>
            )}
          </>
        )}

        {step === 'dose' && (
          <>
            {prefilled && (
              <View style={styles.prefilled}>
                <Ionicons name="sparkles-outline" size={16} color={Colors.gold} />
                <Text style={styles.prefilledText}>We filled in the next steps from what you wrote. Check them.</Text>
              </View>
            )}
            {position && <Text style={styles.position}>{position}</Text>}
            <Text style={styles.title}>{name || 'How much?'}</Text>
            <Text style={styles.label}>Is it a medicine or a supplement?</Text>
            <ChoiceChips
              options={[
                { id: 'medication', label: 'Medicine' },
                { id: 'supplement', label: 'Supplement' },
              ]}
              value={kind}
              onChange={(v) => setKind(v as MedKind)}
            />
            <Text style={styles.label}>How much each time? (optional)</Text>
            <TextInput
              style={styles.input}
              value={dose}
              onChangeText={setDose}
              placeholder="1 tablet, 600 mg, 1000 IU…"
              placeholderTextColor={Colors.textMuted}
            />
          </>
        )}

        {step === 'when' && (
          <>
            <Text style={styles.title}>How often and when?</Text>
            <ChoiceChips
              options={[
                { id: 'once', label: 'Once a day' },
                { id: 'twice', label: 'Twice a day' },
                { id: 'three', label: 'Three times a day' },
                { id: 'every_hours', label: 'Every few hours' },
                { id: 'weekdays', label: 'Some days of the week' },
                { id: 'as_needed', label: 'Only when I need it' },
              ]}
              value={frequency}
              onChange={(v) => setFrequency(v as Frequency)}
            />
            {frequency === 'every_hours' && (
              <>
                <Text style={styles.label}>Every</Text>
                <ChoiceChips options={[4, 6, 8, 12].map((h) => ({ id: h, label: `${h} hours` }))} value={hours} onChange={setHours} />
                <Text style={styles.label}>First dose of the day</Text>
                <ChoiceChips
                  options={['06:00', '07:00', '08:00', '09:00'].map((t) => ({ id: t, label: t }))}
                  value={times[0]}
                  onChange={(t) => setTimes([t])}
                />
              </>
            )}
            {frequency === 'weekdays' && (
              <>
                <Text style={styles.label}>Which days?</Text>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.weekDay, on && styles.weekDayOn]}
                        onPress={() => setDays((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i].sort()))}
                      >
                        <Text style={[styles.weekDayText, on && { color: Colors.background }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            {(frequency === 'once' || frequency === 'twice' || frequency === 'three' || frequency === 'weekdays') && (
              <>
                <Text style={styles.label}>
                  At what time{frequency === 'twice' ? 's (pick 2)' : frequency === 'three' ? 's (pick 3)' : ''}?
                </Text>
                <View style={styles.slots}>
                  {slotOptions.map((s) => {
                    const on = times.includes(s.id);
                    return (
                      <TouchableOpacity key={s.id} style={[styles.slot, on && styles.slotOn]} onPress={() => toggleTime(s.id)}>
                        <Text style={[styles.slotText, on && { color: Colors.textPrimary }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={[styles.slot, otherOpen && styles.slotOn]} onPress={() => setOtherOpen((v) => !v)}>
                    <Text style={[styles.slotText, otherOpen && { color: Colors.textPrimary }]}>+ Other time</Text>
                  </TouchableOpacity>
                </View>
                {otherOpen && (
                  <View style={styles.otherBox}>
                    <View style={styles.wheels}>
                      <WheelPicker items={HOURS} selectedIndex={otherHour} onChange={setOtherHour} width={90} />
                      <Text style={styles.colon}>:</Text>
                      <WheelPicker items={MINUTES} selectedIndex={otherMinute} onChange={setOtherMinute} width={90} />
                    </View>
                    <TouchableOpacity style={styles.addTime} onPress={addOther} activeOpacity={0.85}>
                      <Text style={styles.addTimeText}>
                        Add {HOURS[otherHour]}:{MINUTES[otherMinute]}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
            {frequency !== 'as_needed' && (
              <>
                <Text style={styles.label}>With food?</Text>
                <ChoiceChips
                  options={[
                    { id: 'with', label: 'With food' },
                    { id: 'empty', label: 'Empty stomach' },
                    { id: 'any', label: "Doesn't matter" },
                  ]}
                  value={withFood}
                  onChange={(v) => setWithFood(v as MedicationItem['withFood'])}
                />
              </>
            )}
            {known && <Text style={styles.tip}>{known.tip}</Text>}
          </>
        )}

        {step === 'duration' && (
          <>
            <Text style={styles.title}>For how long?</Text>
            <Text style={styles.subtitle}>
              {known?.shortCourseDays
                ? `${known.label} is often taken for ${known.shortCourseDays} days. Follow what your doctor or the leaflet says.`
                : 'Check your prescription or the leaflet.'}
            </Text>
            {/* Duraciones típicas + "Other" con rueda (como la hora), y la que ya tenga si no es típica */}
            <ChoiceChips
              options={[
                ...[...COURSE_DAYS, ...(courseDays && !COURSE_DAYS.includes(courseDays) ? [courseDays] : [])]
                  .sort((a, b) => a - b)
                  .map((d) => ({ id: d, label: `${d} day${d === 1 ? '' : 's'}` })),
                { id: 0, label: '+ Other' },
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
                <View style={styles.wheels}>
                  <WheelPicker items={DAY_ITEMS} selectedIndex={otherDays} onChange={setOtherDays} width={90} />
                  <Text style={styles.wheelUnit}>days</Text>
                </View>
                <TouchableOpacity
                  style={styles.addTime}
                  onPress={() => {
                    setCourseDays(otherDays + 1);
                    setOtherDaysOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addTimeText}>
                    For {otherDays + 1} day{otherDays === 0 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {known?.tip ? <Text style={styles.tip}>{known.tip}</Text> : null}
          </>
        )}

        {step === 'reminders' && (
          <>
            <Ionicons name="notifications-outline" size={32} color={Colors.gold} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.title}>Do you want a reminder?</Text>
            {frequency === 'as_needed' ? (
              <Text style={styles.subtitle}>You take it only when you need it, so there are no reminders. Log it when you take it.</Text>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  We can remind you at each dose, or you can keep track yourself. You can change it or mute it any time.
                </Text>
                <ChoiceChips
                  options={[
                    { id: 'yes', label: 'Remind me' },
                    { id: 'no', label: "I'll track it myself" },
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
            <Text style={styles.title}>Check it</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryName}>{name || text}</Text>
              <Text style={styles.summaryLine}>
                {kind === 'supplement' ? 'Supplement' : 'Medicine'}
                {dose ? ` · ${dose}` : ''}
              </Text>
              <Text style={styles.summaryLine}>{scheduleText(schedule())}</Text>
              {isShort && <Text style={styles.summaryLine}>For {courseDays} days, from today</Text>}
              {withFood && withFood !== 'any' && (
                <Text style={styles.summaryLine}>{withFood === 'with' ? 'With food' : 'On an empty stomach'}</Text>
              )}
              <Text style={styles.summaryLine}>
                {frequency === 'as_needed' ? 'No reminders' : reminders === 'yes' ? 'Reminders on' : 'No reminders, I track it'}
              </Text>
            </View>
            {known && <Text style={styles.tip}>{known.tip}</Text>}
            <Text style={styles.disclaimer}>Always follow your prescription and the leaflet. Kuova does not change your treatment.</Text>
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.cta, !canContinue && styles.ctaDisabled]}
        onPress={step === 'summary' ? save : next}
        disabled={!canContinue}
      >
        <Text style={styles.ctaText}>{step === 'summary' ? (queue.length ? `Save and set up ${queue[0]}` : 'Save') : 'Continue'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.green },
  position: { color: Colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  otherBox: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginHorizontal: 4 },
  wheelUnit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginLeft: 8 },
  addTime: { backgroundColor: Colors.accent, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9, marginTop: 6, marginBottom: 6 },
  addTimeText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  bigInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  prefilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: withAlpha(Colors.gold, 0.12),
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  prefilledText: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  weekRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  weekDay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  weekDayText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  slotOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tip: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 16, fontStyle: 'italic' },
  summaryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  summaryName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  summaryLine: { color: Colors.textSecondary, fontSize: 14 },
  disclaimer: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 16 },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
