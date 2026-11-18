import { dateLocale, num, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FRow } from '@/components/fine/Fine';
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { profileRepository } from '@/data/profileRepository';
import { loadBodyBasics } from '@/data/bodyBasics';
import { loadMeasureReadings, sampleMeasureReadings } from '@/data/measurementsRepository';
import { BodyComp, bodyCompFor, removeWeighIn, saveWeighIn, weightRepository } from '@/data/weightRepository';
import { BODY_COMP, BodyCompKind, parseComp, weighAdvice } from '@/logic/weight';
import { summarize } from '@/logic/bodyMeasures';
import { measureFatCandidates, pickBodyFat } from '@/logic/bodyComposition';
import { shortDay } from '@/screens/measureFormat';
import { offerPhoneReminders } from '@/data/phoneReminders';
import { FINE, ff, fine } from '@/theme/fine';

// Apuntar el peso y, si la báscula la da, la composición corporal a mano: grasa, agua, músculo y hueso. Con el
// aviso de que no hace falta pesarse a diario. Desde el 2026-11-16, como en el prototipo: la cifra grande y
// ligera con «− +» (de 100 en 100 g; tocarla abre el teclado para escribirla), la fecha y la hora en filas con
// línea fina y un solo botón de Guardar abajo (el fundador prefiere este estilo a la rueda). La cifra es FineNumber,
// el mismo «− +» con teclado que la glucosa y la tensión (2026-11-16): dejándolo pulsado, al rato va de 0,5 en 0,5.
// Bajo la casilla de la grasa, mientras está vacía: lo que sale con las medidas (pliegues o cinta) y que, si la
// báscula da otra cifra, se usa la de la báscula (fundador, 2026-11-16: «que puedas sobreescribirla»). No se
// rellena la casilla: la estimación no se guarda como si fuera de la báscula.

const MIN = 30;
const MAX = 250;
const formatDate = (date: Date) => date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
const formatTime = (date: Date) => date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
const clampKg = (v: number) => Math.round(Math.max(MIN, Math.min(MAX, v)) * 10) / 10;

export const LogWeightScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [dateTime, setDateTime] = useState(new Date());
  const [kg, setKg] = useState(70);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [comp, setComp] = useState<Record<BodyCompKind, string>>({ body_fat: '', body_water: '', muscle_mass: '', bone_mass: '' });
  const [showComp, setShowComp] = useState(false);
  const [recent, setRecent] = useState<{ inLastWeek: number; daysSince: number | null }>({ inLastWeek: 0, daysSince: null });
  const [saving, setSaving] = useState(false);
  // La grasa que sale con las medidas (la más reciente de pliegues o cinta), para la pista de la casilla
  const [fromMeasures, setFromMeasures] = useState<{ pct: number; fecha: string; sample: boolean } | null>(null);
  const numbers = useNumbersReady();
  const value = kg;

  const setFrom = (v: number) => setKg(clampKg(v));
  // La fecha y la hora se eligen con el teclado cerrado
  const openPicker = (mode: 'date' | 'time') => {
    Keyboard.dismiss();
    setPickerMode(mode);
  };

  useEffect(() => {
    (async () => {
      const entries = await weightRepository.getAll();
      const existing = id ? entries.find((e) => e.id === id) : undefined;
      if (existing) {
        setFrom(existing.valor);
        setDateTime(new Date(existing.fecha));
        const c = await bodyCompFor(existing.id);
        setComp({
          body_fat: c.body_fat != null ? num(c.body_fat) : '',
          body_water: c.body_water != null ? num(c.body_water) : '',
          muscle_mass: c.muscle_mass != null ? num(c.muscle_mass) : '',
          bone_mass: c.bone_mass != null ? num(c.bone_mass) : '',
        });
        setShowComp(Object.keys(c).length > 0);
      } else {
        const last = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        if (last) setFrom(last.valor);
        else {
          const p = await profileRepository.get().catch(() => null);
          if (p?.weightKg) setFrom(p.weightKg);
        }
        const a = weighAdvice(entries);
        setRecent({ inLastWeek: a.inLastWeek, daysSince: a.daysSince });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      const [readings, basics] = await Promise.all([loadMeasureReadings(), loadBodyBasics()]);
      // Sin medidas propias, las de ejemplo (demo y cuentas de prueba), como en la ficha del peso
      const sample = summarize(readings).length > 0 ? null : sampleMeasureReadings();
      const pick = pickBodyFat(measureFatCandidates(sample ?? readings, basics));
      // De ejemplo también si la estimación sale con la persona o la altura de ejemplo de la demo
      const sampleBasics = basics.samplePerson || (pick?.source === 'tape' && basics.sampleHeight);
      setFromMeasures(pick ? { pct: pick.pct, fecha: pick.fecha, sample: !!sample || sampleBasics } : null);
    })().catch(() => undefined);
  }, []);

  const onPickerChange = (_e: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selected) return;
    setDateTime((prev) => {
      const next = new Date(prev);
      if (pickerMode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      else if (pickerMode === 'time') next.setHours(selected.getHours(), selected.getMinutes());
      return next;
    });
  };

  const parsed: BodyComp = {};
  const invalid: BodyCompKind[] = [];
  for (const b of BODY_COMP) {
    const raw = comp[b.kind];
    if (!raw.trim()) continue;
    const v = parseComp(b.kind, raw);
    if (v === null) invalid.push(b.kind);
    else parsed[b.kind] = v;
  }

  const save = async () => {
    if (invalid.length || !numbers.ready) return;
    setSaving(true);
    try {
      await saveWeighIn({ id, kg: Math.round(value * 10) / 10, fecha: dateTime.toISOString(), comp: parsed });
      if (!id) void offerPhoneReminders('weigh_in');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    await removeWeighIn(id);
    router.back();
  };

  // Ya se pesó hace poco: no se bloquea, solo se explica
  const soon = !id && recent.daysSince !== null && recent.daysSince < 7;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Weight')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.advice}>
          {soon
            ? recent.daysSince === 0
              ? t('You already weighed yourself today. Day-to-day changes are mostly water and food, not fat. Once a week is enough.')
              : recent.daysSince === 1
                ? t('You weighed yourself yesterday. Day-to-day changes are mostly water and food, not fat. Once a week is enough.')
                : t('You weighed yourself {n} days ago. Day-to-day changes are mostly water and food, not fat. Once a week is enough.', { n: recent.daysSince ?? 0 })
            : t('Once a week is enough: same day, in the morning, after the toilet and before breakfast, with little clothing. Weight swings 1–2 kg from one day to the next with food, salt, fluid retention or your cycle; the trend over several weeks is what counts.')}
        </Text>

        <FineNumber
          value={value}
          onChange={setFrom}
          min={MIN}
          max={MAX}
          decimals={1}
          step={0.1}
          fastStep={0.5}
          unit="kg"
          label={t('Weight')}
          onValidChange={numbers.watch('kg')}
          style={styles.number}
        />

        <View style={styles.rows}>
          <FRow title={t('Date')} value={formatDate(dateTime)} onPress={() => openPicker('date')} />
          <FRow title={t('Time')} value={formatTime(dateTime)} onPress={() => openPicker('time')} />
          <TouchableOpacity
            style={fine.row}
            onPress={() => setShowComp((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showComp }}
          >
            <Text style={[fine.rowTitle, styles.flex]}>{t('Body composition (optional)')}</Text>
            <Ionicons name={showComp ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
          </TouchableOpacity>
        </View>
        {showComp && (
          <>
            <Text style={styles.compHint}>
              {t('If your scale measures it, copy it here. It changes a lot with how hydrated you are, so compare it only between weigh-ins in the same conditions.')}
            </Text>
            {BODY_COMP.map((b) => {
              // Con la casilla de la grasa vacía y una estimación de las medidas: la pista, pegada a su fila
              const hint = b.kind === 'body_fat' && fromMeasures && !comp.body_fat.trim() ? fromMeasures : null;
              return (
                <React.Fragment key={b.kind}>
                  <View style={[fine.row, hint && styles.noLine]}>
                    <Text style={[fine.rowTitle, styles.flex]}>{t(b.label)}</Text>
                    <View style={[styles.compInputWrap, invalid.includes(b.kind) && styles.compInvalid]}>
                      <TextInput
                        style={styles.compInput}
                        keyboardType="decimal-pad"
                        value={comp[b.kind]}
                        onChangeText={(v) => setComp((c) => ({ ...c, [b.kind]: v.replace(/[^\d.,]/g, '').slice(0, 5) }))}
                        placeholder="—"
                        placeholderTextColor={FINE.mute}
                        accessibilityLabel={t(b.label)}
                      />
                      <Text style={styles.compUnit}>{b.unit}</Text>
                    </View>
                  </View>
                  {hint ? (
                    <View style={styles.fatHint}>
                      <Text style={styles.fatHintText}>
                        {hint.sample
                          ? t('With sample data it comes to {v} %. If your scale gives a different figure, type it in and we will use that one.', { v: num(hint.pct) })
                          : t('With your measurements from {date} it comes to {v} %. If your scale gives a different figure, type it in and we will use that one.', {
                              date: shortDay(hint.fecha),
                              v: num(hint.pct),
                            })}
                      </Text>
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })}
            {invalid.length ? <Text style={styles.error}>{t('Check the values in red: they are outside the usual range.')}</Text> : null}
          </>
        )}
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={save} disabled={!!invalid.length || !numbers.ready || saving} />
          {id && (
            <TouchableOpacity style={styles.deleteButton} onPress={remove} hitSlop={8} accessibilityRole="button">
              <Ionicons name="trash-outline" size={15} color={FINE.mute} />
              <Text style={styles.deleteText}>{t('Delete entry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardFooter>

      <DateTimeSheet mode={pickerMode} value={dateTime} onChange={onPickerChange} onClose={() => setPickerMode(null)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  // flexGrow: la ScrollView ocupa todo el hueco, así que tocar en cualquier sitio fuera de la cifra cierra el teclado
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  flex: { flex: 1 },
  advice: { ...fine.note, marginTop: 0 },
  number: { marginTop: 26, marginBottom: 18 },
  rows: { borderTopWidth: 1, borderTopColor: FINE.line },
  compHint: { ...fine.note, marginTop: 10 },
  // La pista de la grasa va dentro de su fila: la línea fina, debajo de la pista
  noLine: { borderBottomWidth: 0, paddingBottom: 4 },
  fatHint: { paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: FINE.line },
  fatHintText: { ...fine.note, marginTop: 0 },
  compInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
    borderRadius: 10,
    paddingHorizontal: 10,
    minWidth: 110,
  },
  // El texto dice «en rojo»: el borde de lo que no cuadra sigue en rojo
  compInvalid: { borderColor: Colors.danger },
  compInput: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 16, paddingVertical: 7, textAlign: 'right', fontVariant: ['tabular-nums'] },
  compUnit: { ...ff('regular'), color: FINE.mute, fontSize: 13, width: 22 },
  error: { ...ff('regular'), color: Colors.danger, fontSize: 12.5, marginTop: 8 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  deleteText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
