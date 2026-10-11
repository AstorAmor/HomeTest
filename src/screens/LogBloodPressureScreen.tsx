import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WheelPicker } from '@/components/WheelPicker';
import { postAi } from '@/utils/apiBaseUrl';
import { prepareImage } from '@/utils/imageUpload';
import { ExtractedBloodPressure } from '@/types/bloodPressure';
import {
  saveBloodPressureEntry,
  updateBloodPressureEntry,
  deleteBloodPressureEntry,
  getBloodPressureEntries,
} from '@/data/bloodPressureRepository';

type Step = 'select' | 'processing' | 'edit';

const REQUEST_TIMEOUT_MS = 60000;

// Ruedas para la entrada a mano: sistólica 70-250, diastólica 40-150 y pulso 30-200 (o "—" si no se midió)
const SYS_MIN = 70;
const DIA_MIN = 40;
const PULSE_MIN = 30;
const SYS_ITEMS = Array.from({ length: 181 }, (_, i) => String(i + SYS_MIN));
const DIA_ITEMS = Array.from({ length: 111 }, (_, i) => String(i + DIA_MIN));
const PULSE_ITEMS = ['—', ...Array.from({ length: 171 }, (_, i) => String(i + PULSE_MIN))];
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

const formatDate = (date: Date) =>
  date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const LogBloodPressureScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [step, setStep] = useState<Step>(isEditing ? 'edit' : 'select');
  const [source, setSource] = useState<'photo' | 'manual'>('manual');
  const [processingError, setProcessingError] = useState('');

  const [dateTime, setDateTime] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [pulse, setPulse] = useState<number | null>(null);
  const [wheelKey, setWheelKey] = useState(0); // vuelve a montar las ruedas cuando llegan valores (foto, edición)
  const setValues = (sys: number | null, dia: number | null, pul: number | null) => {
    if (sys != null) setSystolic(clamp(sys, SYS_MIN, 250));
    if (dia != null) setDiastolic(clamp(dia, DIA_MIN, 150));
    setPulse(pul != null ? clamp(pul, PULSE_MIN, 200) : null);
    setWheelKey((k) => k + 1);
  };
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBloodPressureEntries().then((entries) => {
      const existing = entries.find((e) => e.id === id);
      if (existing) {
        setValues(existing.systolic, existing.diastolic, existing.pulse);
        setDateTime(new Date(existing.fecha));
        setSource(existing.source);
      }
    });
  }, [id]);

  const extractFromImage = async (uri: string, mimeType: string) => {
    setStep('processing');
    setProcessingError('');

    try {
      let base64: string;
      if (mimeType === 'application/pdf') {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        const prepared = await prepareImage(uri, 900);
        base64 = prepared.base64;
      }

      const response = await postAi('extract-bp', { files: [{ base64, mimeType }] }, REQUEST_TIMEOUT_MS);

      const data = await response.json();

      if (!response.ok) {
        setProcessingError(data.error ?? t('Error extracting data'));
      } else {
        const parsed = data as ExtractedBloodPressure;
        setValues(parsed.systolic, parsed.diastolic, parsed.pulse);
        if (parsed.systolic === null && parsed.diastolic === null) {
          setProcessingError(t('Could not read the values clearly. Please review or correct them manually.'));
        }
      }
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setSource('photo');
      setStep('edit');
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    await extractFromImage(result.assets[0].uri, 'image/jpeg');
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await extractFromImage(result.assets[0].uri, 'image/jpeg');
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await extractFromImage(asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  // A mano: las ruedas empiezan en la última toma (o en 120/80)
  const startManual = async () => {
    setSource('manual');
    setProcessingError('');
    const last = [...(await getBloodPressureEntries().catch(() => []))].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    setValues(last?.systolic ?? 120, last?.diastolic ?? 80, last?.pulse ?? null);
    setStep('edit');
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
    if (!isValid) return;
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

  if (step === 'select') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Blood Pressure')} showBack />
        <View style={styles.methodList}>
          <TouchableOpacity style={styles.methodButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>{t('Take photo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.methodButton} onPress={pickImage}>
            <Ionicons name="images-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>{t('Choose image')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.methodButton} onPress={pickFile}>
            <Ionicons name="document-text-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>{t('Choose file')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.methodButton} onPress={startManual}>
            <Ionicons name="create-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>{t('Manual entry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.processingWrap}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.processingText}>{t('Reading the blood pressure monitor screen…')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.circleButton, isValid ? styles.circleButtonActive : undefined]}
            onPress={handleSave}
            disabled={!isValid || saving}
          >
            <Ionicons name="checkmark" size={22} color={Colors.background} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="speedometer-outline" size={26} color={Colors.coral} />
          </View>
          <Text style={styles.title}>{t('Blood Pressure')}</Text>
        </View>

        {processingError ? <Text style={styles.errorText}>{processingError}</Text> : null}

        <View style={styles.list}>
          <TouchableOpacity style={styles.row} onPress={() => setPickerMode('date')}>
            <Text style={styles.rowLabel}>{t('Date')}</Text>
            <View style={styles.rowValuePill}>
              <Text style={styles.rowValueText}>{formatDate(dateTime)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => setPickerMode('time')}>
            <Text style={styles.rowLabel}>{t('Time')}</Text>
            <View style={styles.rowValuePill}>
              <Text style={styles.rowValueText}>{formatTime(dateTime)}</Text>
            </View>
          </TouchableOpacity>

        </View>

        {/* Una rueda por valor: se gira arriba y abajo hasta la cifra */}
        <View style={styles.wheels} key={wheelKey}>
          {[
            { label: t('Systolic'), unit: 'mmHg', items: SYS_ITEMS, index: systolic - SYS_MIN, set: (i: number) => setSystolic(i + SYS_MIN) },
            { label: t('Diastolic'), unit: 'mmHg', items: DIA_ITEMS, index: diastolic - DIA_MIN, set: (i: number) => setDiastolic(i + DIA_MIN) },
            {
              label: t('Pulse'),
              unit: t('bpm (optional)'),
              items: PULSE_ITEMS,
              index: pulse == null ? 0 : pulse - PULSE_MIN + 1,
              set: (i: number) => setPulse(i === 0 ? null : i - 1 + PULSE_MIN),
            },
          ].map((w) => (
            <View key={w.label} style={styles.wheelCol}>
              <Text style={styles.wheelLabel}>{w.label}</Text>
              <WheelPicker items={w.items} selectedIndex={w.index} onChange={w.set} width={86} />
              <Text style={styles.wheelUnit}>{w.unit}</Text>
            </View>
          ))}
        </View>
        {!isValid && <Text style={styles.errorText}>{t('The systolic (high) number must be above the diastolic (low) one.')}</Text>}

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.deleteButtonText}>{t('Delete entry')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {pickerMode && (
        <DateTimePicker
          value={dateTime}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  methodList: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 12,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 18,
  },
  methodButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  processingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  processingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonActive: {
    backgroundColor: Colors.accent,
  },
  header: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  rowValuePill: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rowValueText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  wheelCol: { alignItems: 'center', flex: 1 },
  wheelLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  wheelUnit: { color: Colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
