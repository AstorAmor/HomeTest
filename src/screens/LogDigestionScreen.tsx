import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { SecHead } from '@/components/fine/Fine';
import { CheckRow, CloseButton, FineButton, FineChip, FineChips, FineLink, measureStyles } from '@/components/fine/FineMeasure';
import { dayKey, noonOf } from '@/data/bathroomRepository';
import { digestionRepository, usualFoodsStore } from '@/data/digestionRepository';
import { FOOD_GROUPS, FoodGroup, inferFoodGroups } from '@/logic/foodGroups';
import {
  DigestionEntry,
  FoodBefore,
  GUT_SYMPTOMS,
  GutSymptom,
  INTENSITIES,
  Intensity,
  MEAL_AMOUNTS,
  MealAmount,
  MINUTES_BEFORE,
  USUAL_FREQUENCIES,
  UsualFoods,
} from '@/types/digestion';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Cuándo empezó: hoy, "hace un rato"; otro día, la parte del día (hora aproximada)
const AGO = [
  { id: 0, label: 'Just now' },
  { id: 1, label: '1 h ago' },
  { id: 2, label: '2 h ago' },
  { id: 3, label: '3 h or more' },
];
const PART_OF_DAY = [
  { id: 10, label: 'Morning' },
  { id: 14, label: 'Midday' },
  { id: 18, label: 'Afternoon' },
  { id: 23, label: 'Night' },
];

// Digestión: lo que notas en la tripa (no las heces, que van en Heces). Cada síntoma con su
// intensidad y, al guardarlo, un segundo paso: qué comiste antes (qué era, qué llevaba, cuánto
// antes y cuánto). No se pregunta nada de comida antes de que pase algo, ni se usan las comidas de
// "Tus nutrientes". "Hoy, bien" también se apunta: sin los días buenos no se puede comparar.
// ?day=AAAA-MM-DD para otro día (desde las barras de la semana); ?id= abre la comida de un apunte.
// Desde el 2026-11-16, en el lenguaje fino del prototipo: sin icono en círculo de color, cada molestia en una
// fila con línea fina y su escala (Nada · Leve · Moderado · Fuerte) como la del check-in, las preguntas con
// cabecera pequeña, chips con borde y un solo botón de Guardar abajo.
export const LogDigestionScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; id?: string }>();
  const today = dayKey(new Date());
  const day = params.day ?? today;
  const isToday = day === today;
  // Si se abrió con un enlace directo no hay pantalla anterior: a Digestión
  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/digestive', params: { part: 'gut' } }));
  const [levels, setLevels] = useState<Partial<Record<GutSymptom, Intensity>>>({});
  const [when, setWhen] = useState<number>(isToday ? 0 : 14);
  const [woke, setWoke] = useState(false);
  const [note, setNote] = useState('');
  const [dayOk, setDayOk] = useState(false);
  const [hasSymptoms, setHasSymptoms] = useState(false);
  const [saving, setSaving] = useState(false);
  // Segundo paso: lo que comiste antes, del apunte ya guardado
  const [step, setStep] = useState<'symptoms' | 'food'>(params.id ? 'food' : 'symptoms');
  const [savedId, setSavedId] = useState<string | null>(params.id ?? null);
  const [fasted, setFasted] = useState(false);
  const [description, setDescription] = useState('');
  const [manual, setManual] = useState<Partial<Record<FoodGroup, boolean>>>({});
  const [minutesBefore, setMinutesBefore] = useState<number | undefined>();
  const [amount, setAmount] = useState<MealAmount | undefined>();
  const [usualKnown, setUsualKnown] = useState<UsualFoods>({});
  const [usualNew, setUsualNew] = useState<UsualFoods>({});

  useEffect(() => {
    digestionRepository.getAll().then((all) => {
      const sameDay = all.filter((e) => dayKey(new Date(e.fecha)) === day);
      setDayOk(sameDay.some((e) => e.kind === 'day_ok'));
      setHasSymptoms(sameDay.some((e) => e.kind === 'symptoms'));
      // Abrir la comida de un apunte (desde Digestión): lo que ya contestó
      const f = params.id ? all.find((e) => e.id === params.id)?.food : undefined;
      if (f) {
        setFasted(!!f.fasted);
        setDescription(f.description ?? '');
        if (f.groups) setManual(Object.fromEntries(FOOD_GROUPS.map((g) => [g.id, f.groups!.includes(g.id)])));
        setMinutesBefore(f.minutesBefore);
        setAmount(f.amount);
      }
    });
    usualFoodsStore.get().then(setUsualKnown);
  }, [day, params.id]);

  // Lo deducido del texto, con lo que el usuario haya tocado encima
  const inferred = new Set(inferFoodGroups(description).map((g) => g.group));
  const selected = FOOD_GROUPS.map((g) => g.id).filter((g) => manual[g] ?? inferred.has(g));
  const askUsual = selected.filter((g) => !usualKnown[g]);

  const any = Object.values(levels).some(Boolean);

  const startedAt = () => {
    if (isToday) return new Date(Date.now() - when * 3600 * 1000);
    const d = new Date(`${day}T12:00:00`);
    d.setHours(when, 0, 0, 0);
    return d;
  };

  // Paso 1: se guardan las molestias y se pasa a la comida (si la cierra, lo apuntado ya está)
  const save = async () => {
    if (!any) return;
    setSaving(true);
    const now = new Date().toISOString();
    const entry: DigestionEntry = {
      id: `gut-${Date.now()}`,
      kind: 'symptoms',
      fecha: startedAt().toISOString(),
      createdAt: now,
      symptoms: Object.fromEntries(Object.entries(levels).filter(([, v]) => v)) as DigestionEntry['symptoms'],
      wokeAtNight: woke || undefined,
      note: note.trim() || undefined,
    };
    try {
      await digestionRepository.save(entry);
      setSavedId(entry.id);
      setStep('food');
    } finally {
      setSaving(false);
    }
  };

  // Paso 2: lo que comiste antes, y cada cuánto sueles tomar lo nuevo
  const answeredFood = fasted || !!description.trim() || Object.keys(manual).length > 0 || minutesBefore != null || amount != null;
  const saveFood = async () => {
    if (!savedId || !answeredFood) return close();
    setSaving(true);
    const food: FoodBefore = fasted
      ? { fasted: true }
      : { description: description.trim() || undefined, groups: selected, minutesBefore, amount };
    try {
      await digestionRepository.update(savedId, { food });
      const answers = Object.fromEntries(Object.entries(usualNew).filter(([g]) => selected.includes(g as FoodGroup)));
      if (!fasted && Object.keys(answers).length) await usualFoodsStore.merge(answers);
      close();
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (g: FoodGroup) => setManual((m) => ({ ...m, [g]: !selected.includes(g) }));

  const saveDayOk = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    try {
      await digestionRepository.save({ id: `gut-ok-${Date.now()}`, kind: 'day_ok', fecha: isToday ? now : noonOf(day), createdAt: now });
      close();
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  // La × de cerrar (con un enlace directo no hay pantalla anterior: lleva a Digestión)
  const closeButton = <CloseButton onPress={close} />;

  if (step === 'food') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('What did you eat before?')} right={closeButton} />

        <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            {params.id
              ? t('The last meal or snack before you noticed it.')
              : t('Saved. Now the last meal or snack before you noticed it: it helps us see what disagrees with you.')}
          </Text>

          <CheckRow label={t('I had not eaten for hours')} on={fasted} onPress={() => setFasted(!fasted)} style={styles.firstRow} />

          {!fasted && (
            <>
              <SecHead title={t('What was it?')} />
              <TextInput
                style={measureStyles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={t('For example: coffee with milk and toast')}
                placeholderTextColor={FINE.mute}
                multiline
                accessibilityLabel={t('What was it?')}
              />

              <SecHead title={t('Did it have any of these?')} />
              {!!description.trim() && <Text style={styles.foodHint}>{t('We filled it in from what you wrote. Tap to fix it.')}</Text>}
              <View style={styles.chips}>
                {FOOD_GROUPS.map((g) => (
                  <FineChip key={g.id} label={t(g.label)} on={selected.includes(g.id)} onPress={() => toggleGroup(g.id)} multi />
                ))}
              </View>

              <SecHead title={t('How long before you noticed it?')} />
              <FineChips options={MINUTES_BEFORE.map((o) => ({ id: o.id, label: t(o.label) }))} value={minutesBefore} onChange={setMinutesBefore} />

              <SecHead title={t('How much did you eat?')} />
              <FineChips options={MEAL_AMOUNTS.map((o) => ({ id: o.id, label: t(o.label) }))} value={amount} onChange={setAmount} />

              {/* Solo la primera vez que sale cada grupo: es con lo que comparamos */}
              {askUsual.length > 0 && (
                <>
                  <SecHead title={t('How often do you usually have it?')} />
                  <Text style={styles.foodHint}>{t('Only the first time: it tells us whether it shows up more than usual.')}</Text>
                  {askUsual.map((g, i) => (
                    <View key={g} style={[styles.usual, i === askUsual.length - 1 && styles.lastRow]}>
                      <Text style={fine.rowTitle}>{t(FOOD_GROUPS.find((x) => x.id === g)!.label)}</Text>
                      <FineChips
                        options={USUAL_FREQUENCIES.map((o) => ({ id: o.id, label: t(o.label) }))}
                        value={usualNew[g]}
                        onChange={(v) => setUsualNew((u) => ({ ...u, [g]: v }))}
                      />
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </KeyboardAwareScrollView>

        <KeyboardFooter>
          <View style={measureStyles.footer}>
            {/* Como el ✓ de antes: apagado hasta contestar algo, pero pulsarlo sin nada cierra */}
            <FineButton label={t('Save')} onPress={saveFood} disabled={saving} dim={!answeredFood} />
            <FineLink label={t('Not now')} onPress={close} style={styles.skip} />
          </View>
        </KeyboardFooter>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={isToday ? t('What do you feel?') : dayLabel} right={closeButton} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>{t('Only what you feel in your tummy; stools go in Stools. Then we ask what you ate before.')}</Text>

        {/* Los días buenos cuentan tanto como los malos: botón con borde jade, secundario */}
        <TouchableOpacity
          style={[styles.okButton, dayOk && styles.okButtonDone]}
          onPress={saveDayOk}
          disabled={saving || dayOk}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || dayOk }}
        >
          <Ionicons name={dayOk ? 'checkmark-circle-outline' : 'happy-outline'} size={18} color={FINE.jade} />
          <Text style={styles.okText}>
            {dayOk
              ? t('Marked as a good day')
              : hasSymptoms
                ? isToday
                  ? t('Nothing else today')
                  : t('Nothing else that day')
                : isToday
                  ? t('All good today')
                  : t('All good that day')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.okHint}>{t('Good days matter too: without them we cannot compare.')}</Text>

        <View style={styles.symptoms}>
          {GUT_SYMPTOMS.map((s, i) => (
            <View key={s.id} style={[styles.symptom, i === GUT_SYMPTOMS.length - 1 && styles.lastRow]}>
              <Text style={fine.rowTitle}>{t(s.label)}</Text>
              <Text style={fine.rowSub}>{t(s.hint)}</Text>
              {/* Nada · Leve · Moderado · Fuerte en una sola fila, para que sea rápido (la escala del check-in) */}
              <View style={styles.levels} accessibilityRole="radiogroup" accessibilityLabel={t(s.label)}>
                {[{ id: 0, label: 'Not at all' }, ...INTENSITIES].map((o) => {
                  const on = (levels[s.id] ?? 0) === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.level, on && (o.id ? styles.levelOn : styles.levelNone)]}
                      onPress={() => setLevels((l) => ({ ...l, [s.id]: o.id ? (o.id as Intensity) : undefined }))}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.levelText, on && styles.levelTextOn]} numberOfLines={1}>
                        {t(o.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {any && (
          <>
            <SecHead title={isToday ? t('When did it start?') : t('Roughly when?')} />
            <FineChips options={(isToday ? AGO : PART_OF_DAY).map((o) => ({ id: o.id, label: t(o.label) }))} value={when} onChange={setWhen} />
            <CheckRow label={t('It woke me up at night')} on={woke} onPress={() => setWoke(!woke)} style={styles.wokeRow} />

            <SecHead title={t('Anything else? (optional)')} />
            <TextInput
              style={measureStyles.input}
              value={note}
              onChangeText={setNote}
              placeholder={t('Stress, period, travelling…')}
              placeholderTextColor={FINE.mute}
              multiline
              accessibilityLabel={t('Anything else? (optional)')}
            />
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={saving || !any} />
        </View>
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  lastRow: { borderBottomWidth: 0 },
  firstRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.line },
  wokeRow: { marginTop: 8, borderTopWidth: 1, borderTopColor: FINE.line },
  // «Hoy, bien»: píldora con borde jade, centrada (acción secundaria)
  okButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 18,
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: FINE.jadeLine,
  },
  okButtonDone: { opacity: 0.6 },
  okText: { ...ff('medium'), color: FINE.jade, fontSize: 14 },
  okHint: { ...fine.note, textAlign: 'center', marginTop: 8 },
  // Cada molestia, una fila con línea fina y su escala debajo
  symptoms: { marginTop: 14, borderTopWidth: 1, borderTopColor: FINE.line },
  symptom: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: FINE.line },
  // La escala del check-in (prototipo, `.scale`): casillas con línea fina; la elegida, esmeralda con borde jade
  levels: { flexDirection: 'row', gap: 6, marginTop: 10 },
  level: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FINE.line,
  },
  levelNone: { borderColor: 'rgba(240,239,230,0.3)' },
  levelOn: { borderColor: FINE.jade, backgroundColor: FINE.emerald },
  levelText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  levelTextOn: { color: FINE.ivory },
  foodHint: { ...fine.note, marginTop: -2, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  usual: { gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  skip: { marginTop: 4 },
});
