import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FRow } from '@/components/fine/Fine';
import { CloseButton, FineButton, FineGlyph, measureStyles } from '@/components/fine/FineMeasure';
import { formStyles } from '@/components/fine/FineForm';
import { FineNumber, useNumbersReady } from '@/components/fine/FineNumber';
import { postAi } from '@/utils/apiBaseUrl';
import { prepareImage } from '@/utils/imageUpload';
import { expectSystemUi } from '@/utils/systemUi';
import { ExtractedBloodPressure } from '@/types/bloodPressure';
import {
  saveBloodPressureEntry,
  updateBloodPressureEntry,
  deleteBloodPressureEntry,
  getBloodPressureEntries,
} from '@/data/bloodPressureRepository';
import { FINE, ff, fine } from '@/theme/fine';

// Apuntar una toma de tensión. Desde el 2026-11-16, como el registro del peso (LogWeightScreen) y el prototipo:
// se abre directamente en la entrada a mano (el fundador: sin el paso de «elige cómo»), con la sistólica, la
// diastólica y el pulso en cifras grandes y ligeras con «− +» (tocar la cifra abre el teclado), la fecha y la
// hora en filas con línea fina y un solo botón de Guardar abajo. La foto del tensiómetro queda como opción
// secundaria en jade: lee las cifras y las deja en este mismo formulario para revisarlas o corregirlas. Ya no se
// elige imagen de la galería ni archivo. Las tres cifras son FineNumber, el mismo «− +» con teclado que la glucosa y
// el peso (2026-11-16): dejándolo pulsado, al rato va de 5 en 5.

const REQUEST_TIMEOUT_MS = 60000;

// Sistólica 70-250, diastólica 40-150 y pulso 30-200 (o sin pulso: es opcional)
type Bounds = { min: number; max: number };
const SYS: Bounds = { min: 70, max: 250 };
const DIA: Bounds = { min: 40, max: 150 };
const PULSE: Bounds = { min: 30, max: 200 };
const PULSE_START = 70; // al pulsar + sin pulso apuntado
const clamp = (v: number, b: Bounds) => Math.max(b.min, Math.min(b.max, Math.round(v)));

const formatDate = (date: Date) => date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
const formatTime = (date: Date) => date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const LogBloodPressureScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [reading, setReading] = useState(false); // leyendo la foto del tensiómetro
  const [source, setSource] = useState<'photo' | 'manual'>('manual');
  const [processingError, setProcessingError] = useState('');
  const [readOk, setReadOk] = useState(false); // la foto se ha leído: se pide revisar las cifras

  const [dateTime, setDateTime] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [pulse, setPulse] = useState<number | null>(null);
  const setValues = (sys: number | null, dia: number | null, pul: number | null) => {
    if (sys != null) setSystolic(clamp(sys, SYS));
    if (dia != null) setDiastolic(clamp(dia, DIA));
    setPulse(pul != null ? clamp(pul, PULSE) : null);
  };
  const [saving, setSaving] = useState(false);
  const numbers = useNumbersReady();
  // La fecha y la hora se eligen con el teclado cerrado
  const openPicker = (mode: 'date' | 'time') => {
    Keyboard.dismiss();
    setPickerMode(mode);
  };

  // Editar: la toma que se abre. Nueva: las cifras empiezan en la última toma (o en 120/80)
  useEffect(() => {
    let alive = true;
    getBloodPressureEntries()
      .then((entries) => {
        if (!alive) return;
        if (id) {
          const existing = entries.find((e) => e.id === id);
          if (existing) {
            setValues(existing.systolic, existing.diastolic, existing.pulse);
            setDateTime(new Date(existing.fecha));
            setSource(existing.source);
          }
        } else {
          const last = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
          if (last) setValues(last.systolic, last.diastolic, last.pulse);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const extractFromImage = async (uri: string) => {
    setReading(true);
    setProcessingError('');
    setReadOk(false);

    try {
      const prepared = await prepareImage(uri, 900);
      const response = await postAi('extract-bp', { files: [{ base64: prepared.base64, mimeType: 'image/jpeg' }] }, REQUEST_TIMEOUT_MS);

      const data = await response.json();

      if (!response.ok) {
        setProcessingError(data.error ?? t('Error extracting data'));
      } else {
        const parsed = data as ExtractedBloodPressure;
        setValues(parsed.systolic, parsed.diastolic, parsed.pulse);
        if (parsed.systolic === null && parsed.diastolic === null) {
          setProcessingError(t('Could not read the values clearly. Please review or correct them manually.'));
        } else {
          setReadOk(true);
        }
      }
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setSource('photo');
      setReading(false);
    }
  };

  const takePhoto = async () => {
    Keyboard.dismiss();
    expectSystemUi();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    expectSystemUi();
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    await extractFromImage(result.assets[0].uri);
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

  const isValid = systolic > diastolic;

  const handleSave = async () => {
    if (!isValid || !numbers.ready) return;
    setSaving(true);
    try {
      if (isEditing && id) {
        await updateBloodPressureEntry(id, {
          systolic,
          diastolic,
          pulse,
          fecha: dateTime.toISOString(),
        });
      } else {
        await saveBloodPressureEntry({
          id: `${Date.now()}`,
          systolic,
          diastolic,
          pulse,
          fecha: dateTime.toISOString(),
          source,
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
    await deleteBloodPressureEntry(id);
    router.back();
  };

  const header = <ScreenHeader title={t('Blood Pressure')} right={<CloseButton onPress={() => router.back()} />} />;

  if (reading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {header}
        <View style={styles.processingWrap}>
          <ActivityIndicator color={FINE.jade} size="large" />
          <Text style={styles.processingText}>{t('Reading the blood pressure monitor screen…')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {header}

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          {t('Sit and rest for 5 minutes first, with your arm at heart height. Then copy the numbers from your monitor.')}
        </Text>

        {/* La foto, como opción secundaria: lee las cifras y las deja aquí abajo para revisarlas */}
        {!isEditing && (
          <TouchableOpacity
            style={styles.photo}
            onPress={takePhoto}
            hitSlop={8}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('Take a photo of the monitor')}
          >
            <FineGlyph name="camera" size={17} color={FINE.jade} />
            <Text style={styles.photoText}>{t('Take a photo of the monitor')}</Text>
          </TouchableOpacity>
        )}
        {processingError ? (
          <Text style={[formStyles.warn, styles.centerNote]}>{processingError}</Text>
        ) : readOk ? (
          <Text style={[fine.note, styles.centerNote]}>{t('Read from your photo. Check the numbers and correct them if needed.')}</Text>
        ) : null}

        <FineNumber
          label={t('Systolic')}
          showLabel
          value={systolic}
          onChange={(v) => setSystolic(clamp(v, SYS))}
          min={SYS.min}
          max={SYS.max}
          fastStep={5}
          unit="mmHg"
          onValidChange={numbers.watch('sys')}
          style={styles.block}
        />
        <FineNumber
          label={t('Diastolic')}
          showLabel
          value={diastolic}
          onChange={(v) => setDiastolic(clamp(v, DIA))}
          min={DIA.min}
          max={DIA.max}
          fastStep={5}
          unit="mmHg"
          onValidChange={numbers.watch('dia')}
          style={styles.block}
        />
        <FineNumber
          label={`${t('Pulse')} · ${t('optional')}`}
          showLabel
          optional
          startAt={PULSE_START}
          value={pulse}
          onChange={(v) => setPulse(v == null ? null : clamp(v, PULSE))}
          min={PULSE.min}
          max={PULSE.max}
          fastStep={5}
          unit={t('bpm')}
          onValidChange={numbers.watch('pulse')}
          style={styles.block}
        />
        {!isValid && <Text style={[formStyles.warn, styles.centerNote]}>{t('The systolic (high) number must be above the diastolic (low) one.')}</Text>}

        <View style={styles.rows}>
          <FRow title={t('Date')} value={formatDate(dateTime)} onPress={() => openPicker('date')} />
          <FRow title={t('Time')} value={formatTime(dateTime)} onPress={() => openPicker('time')} last />
        </View>
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <View style={measureStyles.footer}>
          <FineButton label={t('Save')} onPress={handleSave} disabled={!isValid || !numbers.ready || saving} />
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
  lead: { ...fine.note, marginTop: 0 },
  photo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 7, minHeight: 44, paddingHorizontal: 8, marginTop: 8 },
  photoText: { ...fine.link, fontSize: 14 },
  centerNote: { textAlign: 'center', marginTop: 4 },
  processingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  processingText: { ...fine.note, textAlign: 'center', marginTop: 0 },
  // Cada cifra con su nombre encima (FineNumber con showLabel)
  block: { marginTop: 20 },
  rows: { marginTop: 26, borderTopWidth: 1, borderTopColor: FINE.line },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  deleteText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
