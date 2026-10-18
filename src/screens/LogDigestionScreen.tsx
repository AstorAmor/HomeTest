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
import { digestionRepository } from '@/data/digestionRepository';
import { DigestionEntry, GUT_SYMPTOMS, GutSymptom, INTENSITIES, Intensity } from '@/types/digestion';
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
// intensidad; la app lo relaciona sola con lo que comiste por la hora (src/logic/gutPatterns.ts).
// "Hoy, bien" también se apunta: sin los días buenos no se puede comparar.
// ?day=AAAA-MM-DD para otro día (desde las barras de la semana).
export const LogDigestionScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const today = dayKey(new Date());
  const day = params.day ?? today;
  const isToday = day === today;
  const [levels, setLevels] = useState<Partial<Record<GutSymptom, Intensity>>>({});
  const [when, setWhen] = useState<number>(isToday ? 0 : 14);
  const [woke, setWoke] = useState(false);
  const [note, setNote] = useState('');
  const [dayOk, setDayOk] = useState(false);
  const [hasSymptoms, setHasSymptoms] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    digestionRepository.getAll().then((all) => {
      const sameDay = all.filter((e) => dayKey(new Date(e.fecha)) === day);
      setDayOk(sameDay.some((e) => e.kind === 'day_ok'));
      setHasSymptoms(sameDay.some((e) => e.kind === 'symptoms'));
    });
  }, [day]);

  const any = Object.values(levels).some(Boolean);

  const startedAt = () => {
    if (isToday) return new Date(Date.now() - when * 3600 * 1000);
    const d = new Date(`${day}T12:00:00`);
    d.setHours(when, 0, 0, 0);
    return d;
  };

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
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const saveDayOk = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    try {
      await digestionRepository.save({ id: `gut-ok-${Date.now()}`, kind: 'day_ok', fecha: isToday ? now : noonOf(day), createdAt: now });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
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
            {t('Only what you feel in your tummy; stools go in Stools. The app links it to what you ate by the time.')}
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
});
