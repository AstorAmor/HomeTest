import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FRow } from '@/components/fine/Fine';
import { CloseButton, FineButton, FineChips, SecRow, measureStyles } from '@/components/fine/FineMeasure';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { MealType, MEAL_TYPE_LABEL } from '@/types/glucose';
import { saveGlucoseEntry, updateGlucoseEntry, deleteGlucoseEntry, getGlucoseEntries } from '@/data/glucoseRepository';
import { FINE, ff } from '@/theme/fine';

// Apuntar una glucosa. Desde el 2026-11-16, como el peso y la tensión: el fundador, «el input de glucosa, peso y
// presión no son coherentes. El primero es una rueda, los demás son de +-... me quedo con +- y que se pueda
// introducir con teclado». En lugar de las dos ruedas (decenas y unidades), la cifra grande y ligera con «− +»
// (FineNumber: de uno en uno y, dejándolo pulsado, al rato de 5 en 5; tocarla abre el teclado), la fecha y la hora
// en filas con línea fina, el momento de la comida en chips y un solo botón de Guardar abajo, que sube con el
// teclado. La × de cerrar queda arriba, fuera de lo que se desplaza.

const MEAL_OPTIONS: MealType[] = ['desayuno', 'comida', 'cena', 'unspecified'];
// De 20 a 409 mg/dL, lo que daban las dos ruedas
const MIN = 20;
const MAX = 409;
const clampMg = (v: number) => Math.max(MIN, Math.min(MAX, Math.round(v)));

const formatDate = (date: Date) =>
  date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const LogGlucoseScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [dateTime, setDateTime] = useState(new Date());
  const [value, setValue] = useState(90);
  const setFrom = (v: number) => setValue(clampMg(v));
  const [mealType, setMealType] = useState<MealType>('unspecified');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const numbers = useNumbersReady();

  // Al editar, la cifra empieza en ese valor; si no, en la última medición (o en 90)
  useEffect(() => {
    getGlucoseEntries().then((entries) => {
      const existing = id ? entries.find((e) => e.id === id) : undefined;
      if (existing) {
        setFrom(existing.valor);
        setDateTime(new Date(existing.fecha));
        setMealType(existing.mealType);
      } else if (!id && entries.length) {
        const last = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        setFrom(last.valor);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // La fecha y la hora se eligen con el teclado cerrado
  const openPicker = (mode: 'date' | 'time') => {
    Keyboard.dismiss();
    setPickerMode(mode);
  };

  const onPickerChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selected) return;

    setDateTime((prev) => {
      const next = new Date(prev);
      if (pickerMode === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else if (pickerMode === 'time') {
        next.setHours(selected.getHours(), selected.getMinutes());
      }
      return next;
    });
  };

  const isValid = value > 0 && numbers.ready;

  const handleSave = async () => {
    if (!isValid) return;
    const numericValue = value;

    setSaving(true);
    try {
      if (isEditing && id) {
        await updateGlucoseEntry(id, {
          valor: numericValue,
          fecha: dateTime.toISOString(),
          mealType,
        });
      } else {
        await saveGlucoseEntry({
          id: `${Date.now()}`,
          valor: numericValue,
          unidad: 'mg/dL',
          fecha: dateTime.toISOString(),
          mealType,
          createdAt: new Date().toISOString(),
        });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteGlucoseEntry(id);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t('Blood Glucose')} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FineNumber
          value={value}
          onChange={setFrom}
          min={MIN}
          max={MAX}
          fastStep={5}
          unit="mg/dL"
          label={t('Blood Glucose')}
          onValidChange={numbers.watch('mg')}
          style={styles.number}
        />

        <View style={styles.rows}>
          <FRow title={t('Date')} value={formatDate(dateTime)} onPress={() => openPicker('date')} />
          <FRow title={t('Time')} value={formatTime(dateTime)} onPress={() => openPicker('time')} last />
        </View>

        <SecRow title={t('Meal Time')} />
        <FineChips
          options={MEAL_OPTIONS.map((m) => ({ id: m, label: t(MEAL_TYPE_LABEL[m]) }))}
          value={mealType}
          onChange={setMealType}
        />
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={handleSave} disabled={!isValid || saving} />
          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} hitSlop={8} accessibilityRole="button">
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
  // flexGrow: la ScrollView ocupa todo el hueco, así que tocar en cualquier sitio libre cierra el teclado
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  number: { marginTop: 26, marginBottom: 18 },
  rows: { borderTopWidth: 1, borderTopColor: FINE.line },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  deleteText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
