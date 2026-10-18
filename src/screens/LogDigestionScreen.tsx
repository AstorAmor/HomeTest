import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { IntestineIcon } from '@/components/IntestineIcon';
import { ChoiceChips } from '@/components/ChoiceChips';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
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
import { logScreenStyles } from './LogBowelScreen';

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

  if (step === 'food') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleButton} onPress={close}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.circleButton, answeredFood && styles.circleButtonActive]} onPress={saveFood} disabled={saving}>
            <Ionicons name="checkmark" size={22} color={answeredFood ? Colors.background : Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="restaurant-outline" size={24} color={Colors.green} />
            </View>
            <Text style={styles.title}>{t('What did you eat before?')}</Text>
            <Text style={styles.subtitle}>
              {params.id
                ? t('The last meal or snack before you noticed it.')
                : t('Saved. Now the last meal or snack before you noticed it: it helps us see what disagrees with you.')}
            </Text>
          </View>

          <TouchableOpacity style={[styles.toggle, fasted && styles.toggleOn]} onPress={() => setFasted(!fasted)} activeOpacity={0.85}>
            <Ionicons name={fasted ? 'checkbox' : 'square-outline'} size={20} color={fasted ? Colors.accent : Colors.textMuted} />
            <Text style={styles.toggleText}>{t('I had not eaten for hours')}</Text>
          </TouchableOpacity>

          {!fasted && (
            <>
              <Text style={styles.label}>{t('What was it?')}</Text>
              <TextInput
                style={styles.note}
                value={description}
                onChangeText={setDescription}
                placeholder={t('For example: coffee with milk and toast')}
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              <Text style={styles.label}>{t('Did it have any of these?')}</Text>
              {!!description.trim() && <Text style={styles.foodHint}>{t('We filled it in from what you wrote. Tap to fix it.')}</Text>}
              <View style={styles.groups}>
                {FOOD_GROUPS.map((g) => {
                  const on = selected.includes(g.id);
                  return (
                    <TouchableOpacity key={g.id} style={[styles.group, on && styles.groupOn]} onPress={() => toggleGroup(g.id)} activeOpacity={0.85}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? Colors.accent : Colors.textMuted} />
                      <Text style={styles.groupText}>{t(g.label)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t('How long before you noticed it?')}</Text>
              <ChoiceChips options={MINUTES_BEFORE.map((o) => ({ id: o.id, label: t(o.label) }))} value={minutesBefore} onChange={setMinutesBefore} />

              <Text style={styles.label}>{t('How much did you eat?')}</Text>
              <ChoiceChips options={MEAL_AMOUNTS.map((o) => ({ id: o.id, label: t(o.label) }))} value={amount} onChange={setAmount} />

              {/* Solo la primera vez que sale cada grupo: es con lo que comparamos */}
              {askUsual.length > 0 && (
                <>
                  <Text style={styles.label}>{t('How often do you usually have it?')}</Text>
                  <Text style={styles.foodHint}>{t('Only the first time: it tells us whether it shows up more than usual.')}</Text>
                  {askUsual.map((g) => (
                    <View key={g} style={styles.usual}>
                      <Text style={styles.usualTitle}>{t(FOOD_GROUPS.find((x) => x.id === g)!.label)}</Text>
                      <ChoiceChips
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

          <TouchableOpacity style={styles.skip} onPress={close}>
            <Text style={styles.skipText}>{t('Not now')}</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={close}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, any && styles.circleButtonActive]} onPress={save} disabled={saving || !any}>
          <Ionicons name="checkmark" size={22} color={any ? Colors.background : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <IntestineIcon size={26} color={Colors.green} />
          </View>
          <Text style={styles.title}>{isToday ? t('What do you feel?') : dayLabel}</Text>
          <Text style={styles.subtitle}>
            {t('Only what you feel in your tummy; stools go in Stools. Then we ask what you ate before.')}
          </Text>
        </View>

        {/* Los días buenos cuentan tanto como los malos */}
        <TouchableOpacity
          style={[styles.okButton, dayOk && styles.okButtonDone]}
          onPress={saveDayOk}
          disabled={saving || dayOk}
          activeOpacity={0.85}
        >
          <Ionicons name={dayOk ? 'checkmark-circle' : 'happy-outline'} size={20} color={Colors.ok} />
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

        {GUT_SYMPTOMS.map((s) => (
          <View key={s.id} style={styles.symptom}>
            <Text style={styles.symptomTitle}>{t(s.label)}</Text>
            <Text style={styles.symptomHint}>{t(s.hint)}</Text>
            {/* Nada · Leve · Moderado · Fuerte en una sola fila, para que sea rápido */}
            <View style={styles.levels}>
              {[{ id: 0, label: 'Not at all' }, ...INTENSITIES].map((o) => {
                const on = (levels[s.id] ?? 0) === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.level, on && (o.id ? styles.levelOn : styles.levelNone)]}
                    onPress={() => setLevels((l) => ({ ...l, [s.id]: o.id ? (o.id as Intensity) : undefined }))}
                    activeOpacity={0.85}
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

        {any && (
          <>
            <Text style={styles.label}>{isToday ? t('When did it start?') : t('Roughly when?')}</Text>
            <ChoiceChips options={(isToday ? AGO : PART_OF_DAY).map((o) => ({ id: o.id, label: t(o.label) }))} value={when} onChange={setWhen} />
            <TouchableOpacity style={[styles.toggle, woke && styles.toggleOn]} onPress={() => setWoke(!woke)} activeOpacity={0.85}>
              <Ionicons name={woke ? 'checkbox' : 'square-outline'} size={20} color={woke ? Colors.accent : Colors.textMuted} />
              <Text style={styles.toggleText}>{t('It woke me up at night')}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('Anything else? (optional)')}</Text>
            <TextInput
              style={styles.note}
              value={note}
              onChangeText={setNote}
              placeholder={t('Stress, period, travelling…')}
              placeholderTextColor={Colors.textMuted}
              multiline
            />
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  okButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ok,
    backgroundColor: Colors.card,
  },
  okButtonDone: { opacity: 0.7 },
  okText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  okHint: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 6 },
  symptom: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  symptomTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  symptomHint: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  levels: { flexDirection: 'row', gap: 6 },
  level: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  levelNone: { borderColor: Colors.textMuted },
  levelOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  levelText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  levelTextOn: { color: Colors.textPrimary },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  toggleOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  toggleText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  foodHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 10 },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  groupOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  groupText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  usual: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  usualTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  skip: { alignItems: 'center', paddingVertical: 14, marginTop: 10 },
  skipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
