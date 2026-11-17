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
import { CloseButton, FineButton, measureStyles } from '@/components/fine/FineMeasure';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { createMetricRepository } from '@/data/metricRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { FINE, ff, fine } from '@/theme/fine';

const formatDate = (date: Date) =>
  date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

interface LogSimpleMetricScreenProps {
  title: string;
  unit: string;
  // El icono y el color de antes (círculo de color sobre el título): en el estilo fino ya no se pintan
  icon?: string;
  color?: string;
  repo: ReturnType<typeof createMetricRepository<SimpleMetricEntry>>;
  // De min a max y, si decimals, con un decimal
  min: number;
  max: number;
  decimals?: boolean;
  initial: number; // valor de partida si aún no hay ninguna medición
  withTime?: boolean; // false: solo la fecha (p. ej. el VO2max, que no depende de la hora)
  hint?: string; // una línea apagada bajo la fecha: cómo se toma (clave en inglés para t())
}

// Apunte de una medición de un solo valor (colesterol, cortisol, VO2max). Desde el 2026-11-16, como la glucosa, el
// peso y la tensión (el fundador: «me quedo con +- y que se pueda introducir con teclado»): en lugar de las ruedas,
// la cifra grande y ligera con «− +» (FineNumber: de uno en uno, o de 0,1 en 0,1 si lleva decimal, y dejándolo
// pulsado, al rato más deprisa; tocarla abre el teclado), la fecha (y la hora) en filas con línea fina y un solo
// botón de Guardar abajo, que sube con el teclado. Título a la izquierda con la × de cerrar, fuera de lo que se
// desplaza.

export const LogSimpleMetricScreen = ({ title, unit, repo, min, max, decimals, initial, withTime = true, hint }: LogSimpleMetricScreenProps) => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const places = decimals ? 1 : 0;
  const clampValue = (v: number) => Math.round(Math.max(min, Math.min(max, v)) * 10 ** places) / 10 ** places;

  const [dateTime, setDateTime] = useState(new Date());
  const [value, setValue] = useState(() => clampValue(initial));
  const setFrom = (v: number) => setValue(clampValue(v));
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const numbers = useNumbersReady();

  // Al editar, la cifra empieza en ese valor; si no, en la última medición
  useEffect(() => {
    repo.getAll().then((entries) => {
      const existing = id ? entries.find((e) => e.id === id) : undefined;
      if (existing) {
        setFrom(existing.valor);
        setDateTime(new Date(existing.fecha));
      } else if (!id && entries.length) {
        setFrom([...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0].valor);
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

  const isValid = value >= min && numbers.ready;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const numericValue = Math.round(value * 10) / 10;
      if (isEditing && id) {
        await repo.update(id, { valor: numericValue, fecha: dateTime.toISOString() });
      } else {
        await repo.save({
          id: `${Date.now()}`,
          valor: numericValue,
          unidad: unit,
          fecha: dateTime.toISOString(),
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
    await repo.remove(id);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title={t(title)} right={<CloseButton onPress={() => router.back()} />} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FineNumber
          value={value}
          onChange={setFrom}
          min={min}
          max={max}
          decimals={places}
          step={decimals ? 0.1 : 1}
          fastStep={decimals ? 1 : 5}
          unit={unit}
          label={t(title)}
          onValidChange={numbers.watch('value')}
          style={styles.number}
        />

        <View style={styles.rows}>
          <FRow title={t('Date')} value={formatDate(dateTime)} onPress={() => openPicker('date')} last={!withTime} />
          {withTime && <FRow title={t('Time')} value={formatTime(dateTime)} onPress={() => openPicker('time')} last />}
        </View>
        {hint ? <Text style={fine.note}>{t(hint)}</Text> : null}
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
