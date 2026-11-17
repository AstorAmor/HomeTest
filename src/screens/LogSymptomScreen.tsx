import React, { useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { SecHead } from '@/components/fine/Fine';
import { CheckRow, CloseButton, FineButton, FineChip, FineLink, measureStyles } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { saveSymptoms } from '@/data/symptomRepository';
import {
  AREAS,
  INTENSITIES,
  NAME_MAX,
  NOTE_MAX,
  OTHER_SYMPTOM,
  PROBLEM_TEXT,
  SYMPTOMS,
  SYMPTOM_GROUPS,
  WHERE_TEXT_MAX,
  asksWhere,
  buildSymptomEntries,
  clampStart,
  draftProblems,
  isUrgentSymptom,
  symptomDayKey,
  type AreaId,
  type Intensity,
  type SymptomDef,
  type SymptomDraft,
  type SymptomId,
} from '@/logic/symptoms';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Apuntar un síntoma (la primera opción del botón K; fundador, 2026-11-17: «Te dé forma de seleccionar varias cosas
// y a cada cosa seleccionada la intensidad y la hora a la que empezó y, a las que corresponda (p.ej. Dolor) dónde.
// Posibilidad de escritura libre también»). Debajo del título, que esto no es un diagnóstico sino su propio
// registro. Se marcan los síntomas que sean y, debajo de cada uno marcado, su intensidad (leve · moderada ·
// fuerte, como en Digestión), cuándo empezó (día y hora; por defecto, ahora) y, en dolores, hormigueo y
// sarpullido, dónde (zonas y texto libre). Al final, una nota para todo el apunte. Con un síntoma que puede
// necesitar atención urgente marcado (dolor en el pecho, falta de aire, desmayo), una línea neutra con el 112,
// sin rojo ni alarma.
// En el lenguaje fino (src/theme/fine.ts), como LogMeasurementsScreen: la cabecera con la × va fuera de la lista
// y no se mueve con el teclado, «Guardar» sube con él (KeyboardFooter), la casilla en la que se escribe queda a
// la vista (KeyboardAwareScrollView) y arrastrar la lista cierra el teclado.
// Al guardar lleva a «Tus síntomas» (historial, resumen y patrones). ?from=symptoms: se abrió desde allí y vuelve.

interface Draft {
  intensity?: Intensity;
  startedAt: Date;
  where: AreaId[];
  whereText: string;
  name: string; // solo «Otro»
}

const ALL: SymptomDef[] = [...SYMPTOMS, OTHER_SYMPTOM];
// Lo que recibe el selector mientras está cerrado (no se enseña)
const NO_DATE = new Date(0);

// «Hoy», «Ayer» o «lun, 9 nov»
const dayLabel = (d: Date) => {
  const now = new Date();
  const key = symptomDayKey(d);
  if (key === symptomDayKey(now)) return t('Today');
  now.setDate(now.getDate() - 1);
  if (key === symptomDayKey(now)) return t('Yesterday');
  return d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
};
const timeLabel = (d: Date) => d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const LogSymptomScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromHistory = params.from === 'symptoms';
  const [drafts, setDrafts] = useState<Partial<Record<SymptomId, Draft>>>({});
  // La última hora de inicio que eligió: el siguiente síntoma que marque empieza ahí (suelen empezar a la vez)
  const [lastStart, setLastStart] = useState<Date | null>(null);
  const [picker, setPicker] = useState<{ id: SymptomId; mode: 'date' | 'time' } | null>(null);
  // En este síntoma eligió un inicio posterior a ahora y se dejó en este momento
  const [clamped, setClamped] = useState<SymptomId | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const picked = ALL.filter((s) => drafts[s.id]);
  const list: SymptomDraft[] = picked.map((s) => {
    const d = drafts[s.id]!;
    return { symptom: s.id, intensity: d.intensity, startedAt: d.startedAt.toISOString(), where: d.where, whereText: d.whereText, name: d.name };
  });
  const problems = draftProblems(list);
  const hint = problems[0] === 'name' || problems[0] === 'intensity' ? PROBLEM_TEXT[problems[0]] : null;
  const urgent = picked.some((s) => isUrgentSymptom(s.id));

  const toggle = (id: SymptomId) => {
    const startedAt = lastStart ?? new Date();
    setDrafts((all) => {
      if (!all[id]) return { ...all, [id]: { startedAt, where: [], whereText: '', name: '' } };
      const next = { ...all };
      delete next[id];
      return next;
    });
  };
  const patch = (id: SymptomId, p: Partial<Draft>) => setDrafts((all) => (all[id] ? { ...all, [id]: { ...all[id]!, ...p } } : all));
  const toggleArea = (id: SymptomId, area: AreaId) => {
    const where = drafts[id]?.where ?? [];
    patch(id, { where: where.includes(area) ? where.filter((a) => a !== area) : [...where, area] });
  };

  // El día y la hora se eligen con el teclado cerrado
  const openPicker = (id: SymptomId, mode: 'date' | 'time') => {
    Keyboard.dismiss();
    setPicker({ id, mode });
  };
  const onPickerChange = (_event: unknown, selected?: Date) => {
    const current = picker;
    if (Platform.OS === 'android') setPicker(null);
    const prev = current ? drafts[current.id]?.startedAt : undefined;
    if (!selected || !current || !prev) return;
    const next = new Date(prev);
    if (current.mode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    const startedAt = clampStart(next, new Date());
    setClamped(startedAt !== next ? current.id : null);
    patch(current.id, { startedAt });
    setLastStart(startedAt);
  };

  const toHistory = () => (fromHistory && router.canGoBack() ? router.back() : router.replace('/symptoms'));

  const save = async () => {
    const entries = buildSymptomEntries(list, note, new Date());
    if (!entries.length) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveSymptoms(entries);
      toHistory();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const item = (s: SymptomDef) => {
    const d = drafts[s.id];
    return (
      <View key={s.id} style={styles.item}>
        <CheckRow label={t(s.label)} on={!!d} onPress={() => toggle(s.id)} style={styles.itemRow} />
        {d ? (
          <View style={styles.detail}>
            {s.id === 'other' && (
              <TextInput
                style={[formStyles.input, styles.field]}
                value={d.name}
                onChangeText={(v) => patch(s.id, { name: v })}
                placeholder={t('What do you notice?')}
                placeholderTextColor={FINE.mute}
                maxLength={NAME_MAX}
                returnKeyType="done"
                accessibilityLabel={t('What do you notice?')}
              />
            )}

            <Text style={styles.label}>{t('Intensity')}</Text>
            <View style={styles.levels} accessibilityRole="radiogroup" accessibilityLabel={`${t(s.label)}. ${t('Intensity')}`}>
              {INTENSITIES.map((o) => {
                const on = d.intensity === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.level, on && styles.levelOn]}
                    onPress={() => patch(s.id, { intensity: o.id })}
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

            <Text style={styles.label}>{t('Started')}</Text>
            <View style={styles.when}>
              <TouchableOpacity
                style={styles.whenChip}
                onPress={() => openPicker(s.id, 'date')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${t('Date')}: ${dayLabel(d.startedAt)}`}
              >
                <Text style={styles.whenText}>{dayLabel(d.startedAt)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.whenChip}
                onPress={() => openPicker(s.id, 'time')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${t('Time')}: ${timeLabel(d.startedAt)}`}
              >
                <Text style={styles.whenText}>{timeLabel(d.startedAt)}</Text>
              </TouchableOpacity>
            </View>
            {clamped === s.id ? <Text style={styles.hint}>{t('The start cannot be later than now: we have set it to this moment.')}</Text> : null}

            {asksWhere(s.id) && (
              <>
                <Text style={styles.label}>{t('Where?')}</Text>
                {s.areas?.length ? (
                  <View style={styles.chips}>
                    {s.areas.map((a) => (
                      <FineChip key={a} label={t(AREAS[a])} on={d.where.includes(a)} onPress={() => toggleArea(s.id, a)} multi />
                    ))}
                  </View>
                ) : null}
                <TextInput
                  style={[formStyles.input, styles.field, !!s.areas?.length && styles.fieldAfterChips]}
                  value={d.whereText}
                  onChangeText={(v) => patch(s.id, { whereText: v })}
                  placeholder={s.areas?.length ? t('Somewhere else, or more detail (optional)') : t('Where do you notice it? (optional)')}
                  placeholderTextColor={FINE.mute}
                  maxLength={WHERE_TEXT_MAX}
                  returnKeyType="done"
                  accessibilityLabel={t('Where?')}
                />
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Symptom')} right={<CloseButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('This is not a diagnosis. It is your own record of how you feel: it helps you see patterns and tell your doctor.')}</Text>
        <FineLink label={t('See my symptoms')} onPress={toHistory} style={styles.historyLink} />

        {SYMPTOM_GROUPS.map((g) => (
          <View key={g.id}>
            <Text style={styles.group} accessibilityRole="header">
              {t(g.label)}
            </Text>
            {SYMPTOMS.filter((s) => s.group === g.id).map(item)}
          </View>
        ))}
        <View style={styles.otherBlock}>{item(OTHER_SYMPTOM)}</View>

        <SecHead title={t('Anything else? (optional)')} />
        <TextInput
          style={measureStyles.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('What you were doing, what you had taken, how it went…')}
          placeholderTextColor={FINE.mute}
          maxLength={NOTE_MAX}
          multiline
          accessibilityLabel={t('Anything else? (optional)')}
        />

        {/* Sin alarma: una línea al final, solo con un síntoma de los que pueden necesitar atención urgente */}
        {urgent ? <Text style={styles.safety}>{t('If it is intense, does not ease or worries you, call 112.')}</Text> : null}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          {hint ? <Text style={styles.footNote}>{t(hint)}</Text> : null}
          {failed ? <Text style={[formStyles.error, styles.footError]}>{t('Something went wrong. Try again.')}</Text> : null}
          <FineButton label={t('Save')} onPress={save} disabled={saving || problems.length > 0} />
        </View>
      </KeyboardFooter>

      <DateTimeSheet
        mode={picker?.mode ?? null}
        value={(picker && drafts[picker.id]?.startedAt) || NO_DATE}
        onChange={onPickerChange}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { ...fine.note, marginTop: 0 },
  historyLink: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 2 },
  // El nombre de cada grupo, pequeño y apagado (sin raya: la lista ya lleva las suyas)
  group: { ...fine.kicker, marginTop: 20, marginBottom: 2 },
  // Cada síntoma: su fila de marcar y, marcado, lo suyo debajo; la línea fina, al final de todo
  item: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  itemRow: { borderBottomWidth: 0 },
  otherBlock: { marginTop: 20, borderTopWidth: 1, borderTopColor: FINE.line },
  detail: { paddingBottom: 16 },
  label: { ...fine.kicker, marginTop: 12, marginBottom: 8 },
  // La escala de Digestión y del check-in: casillas con línea fina; la elegida, esmeralda con borde jade
  levels: { flexDirection: 'row', gap: 6 },
  level: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 2, borderRadius: 10, borderWidth: 1, borderColor: FINE.line },
  levelOn: { borderColor: FINE.jade, backgroundColor: FINE.emerald },
  levelText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  levelTextOn: { color: FINE.ivory },
  // El día y la hora: dos píldoras con borde que abren su selector
  when: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  whenChip: { minHeight: 38, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: FINE.line },
  whenText: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { marginTop: 2 },
  fieldAfterChips: { marginTop: 10 },
  hint: { ...fine.note, marginTop: 8 },
  safety: { ...fine.note, marginTop: 16 },
  footNote: { ...fine.note, marginTop: 0, marginBottom: 8, textAlign: 'center' },
  footError: { marginBottom: 8, textAlign: 'center' },
});
