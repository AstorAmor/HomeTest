import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
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
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { prepareImage, fetchWithTimeout } from '@/utils/imageUpload';
import { ExtractedBloodPressure } from '@/types/bloodPressure';
import {
  saveBloodPressureEntry,
  updateBloodPressureEntry,
  deleteBloodPressureEntry,
  getBloodPressureEntries,
} from '@/data/bloodPressureRepository';

type Step = 'select' | 'processing' | 'edit';

const REQUEST_TIMEOUT_MS = 60000;

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const LogBloodPressureScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [step, setStep] = useState<Step>(isEditing ? 'edit' : 'select');
  const [source, setSource] = useState<'photo' | 'manual'>('manual');
  const [processingError, setProcessingError] = useState('');

  const [dateTime, setDateTime] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBloodPressureEntries().then((entries) => {
      const existing = entries.find((e) => e.id === id);
      if (existing) {
        setSystolic(String(existing.systolic));
        setDiastolic(String(existing.diastolic));
        setPulse(existing.pulse !== null ? String(existing.pulse) : '');
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

      const response = await fetchWithTimeout(
        `${getApiBaseUrl()}/api/extract-bp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: [{ base64, mimeType }] }),
        },
        REQUEST_TIMEOUT_MS
      );

      const data = await response.json();

      if (!response.ok) {
        setProcessingError(data.error ?? 'Error extracting data');
        setSystolic('');
        setDiastolic('');
        setPulse('');
      } else {
        const parsed = data as ExtractedBloodPressure;
        setSystolic(parsed.systolic !== null ? String(parsed.systolic) : '');
        setDiastolic(parsed.diastolic !== null ? String(parsed.diastolic) : '');
        setPulse(parsed.pulse !== null ? String(parsed.pulse) : '');
        if (parsed.systolic === null && parsed.diastolic === null) {
          setProcessingError('Could not read the values clearly. Please review or correct them manually.');
        }
      }
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : 'Unknown error');
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

  const startManual = () => {
    setSource('manual');
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setProcessingError('');
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

  const isValid =
    systolic.trim() !== '' &&
    diastolic.trim() !== '' &&
    !Number.isNaN(parseInt(systolic, 10)) &&
    !Number.isNaN(parseInt(diastolic, 10));

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const parsedPulse =
        pulse.trim() !== '' && !Number.isNaN(parseInt(pulse, 10)) ? parseInt(pulse, 10) : null;

      if (isEditing && id) {
        await updateBloodPressureEntry(id, {
          systolic: parseInt(systolic, 10),
          diastolic: parseInt(diastolic, 10),
          pulse: parsedPulse,
          fecha: dateTime.toISOString(),
        });
      } else {
        await saveBloodPressureEntry({
          id: `${Date.now()}`,
          systolic: parseInt(systolic, 10),
          diastolic: parseInt(diastolic, 10),
          pulse: parsedPulse,
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
        <ScreenHeader title="Blood Pressure" showBack />
        <View style={styles.methodList}>
          <TouchableOpacity style={styles.methodButton} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.methodButton} onPress={pickImage}>
            <Ionicons name="images-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>Choose image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.methodButton} onPress={pickFile}>
            <Ionicons name="document-text-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>Choose file</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.methodButton} onPress={startManual}>
            <Ionicons name="create-outline" size={22} color={Colors.accent} />
            <Text style={styles.methodButtonText}>Manual entry</Text>
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
          <Text style={styles.processingText}>Reading the blood pressure monitor screen…</Text>
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
            <Ionicons name="heart" size={26} color={Colors.danger} />
          </View>
          <Text style={styles.title}>Blood Pressure</Text>
        </View>

        {processingError ? <Text style={styles.errorText}>{processingError}</Text> : null}

        <View style={styles.list}>
          <TouchableOpacity style={styles.row} onPress={() => setPickerMode('date')}>
            <Text style={styles.rowLabel}>Date</Text>
            <View style={styles.rowValuePill}>
              <Text style={styles.rowValueText}>{formatDate(dateTime)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => setPickerMode('time')}>
            <Text style={styles.rowLabel}>Time</Text>
            <View style={styles.rowValuePill}>
              <Text style={styles.rowValueText}>{formatTime(dateTime)}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Systolic</Text>
            <TextInput
              style={styles.inlineInput}
              value={systolic}
              onChangeText={setSystolic}
              keyboardType="number-pad"
              placeholder="mmHg"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Diastolic</Text>
            <TextInput
              style={styles.inlineInput}
              value={diastolic}
              onChangeText={setDiastolic}
              keyboardType="number-pad"
              placeholder="mmHg"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Pulse</Text>
            <TextInput
              style={styles.inlineInput}
              value={pulse}
              onChangeText={setPulse}
              keyboardType="number-pad"
              placeholder="bpm (opcional)"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.deleteButtonText}>Delete entry</Text>
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
  inlineInput: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 100,
  },
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
