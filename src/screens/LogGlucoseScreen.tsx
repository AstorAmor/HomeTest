import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { Colors } from '@/constants/colors';
import { GlucoseIcon } from '@/components/HealthIcons';
import { WheelPicker } from '@/components/WheelPicker';
import { MealType, MEAL_TYPE_LABEL } from '@/types/glucose';
import { saveGlucoseEntry, updateGlucoseEntry, deleteGlucoseEntry, getGlucoseEntries } from '@/data/glucoseRepository';

const MEAL_OPTIONS: MealType[] = ['desayuno', 'comida', 'cena', 'unspecified'];
// Dos ruedas: decenas (de 2 a 40, es decir 20-409 mg/dL) y unidades. Más rápido que teclear.
const TENS = Array.from({ length: 39 }, (_, i) => String(i + 2));
const UNITS = Array.from({ length: 10 }, (_, i) => String(i));
const toWheels = (v: number) => {
  const n = Math.max(20, Math.min(409, Math.round(v)));
  return { tens: Math.floor(n / 10) - 2, units: n % 10 };
};

const formatDate = (date: Date) =>
  date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

export const LogGlucoseScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [dateTime, setDateTime] = useState(new Date());
  const [tens, setTens] = useState(toWheels(90).tens);
  const [units, setUnits] = useState(toWheels(90).units);
  const [wheelKey, setWheelKey] = useState(0); // vuelve a montar las ruedas al cargar un valor
  const value = (tens + 2) * 10 + units;
  const setValueOnWheels = (v: number) => {
    const w = toWheels(v);
    setTens(w.tens);
    setUnits(w.units);
    setWheelKey((k) => k + 1);
  };
  const [mealType, setMealType] = useState<MealType>('unspecified');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Al editar, las ruedas empiezan en ese valor; si no, en la última medición (o en 90)
  useEffect(() => {
    getGlucoseEntries().then((entries) => {
      const existing = id ? entries.find((e) => e.id === id) : undefined;
      if (existing) {
        setValueOnWheels(existing.valor);
        setDateTime(new Date(existing.fecha));
        setMealType(existing.mealType);
      } else if (!id && entries.length) {
        const last = [...entries].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
        setValueOnWheels(last.valor);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const handleSave = async () => {
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

  const isValid = value > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <GlucoseIcon size={28} color={Colors.accent} />
        </View>
        <Text style={styles.title}>{t('Blood Glucose')}</Text>
      </View>

      <View style={styles.list}>
        <TouchableOpacity style={styles.row} onPress={() => setPickerMode('date')}>
          <Text style={styles.rowLabel}>{t('Date')}</Text>
          <View style={styles.rowValuePill}>
            <Text style={styles.rowValueText}>{formatDate(dateTime)}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => setPickerMode('time')}>
          <Text style={styles.rowLabel}>{t('Time')}</Text>
          <View style={styles.rowValuePill}>
            <Text style={styles.rowValueText}>{formatTime(dateTime)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('Blood Glucose')}</Text>
          <Text style={styles.rowValuePlain}>{value} mg/dL</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => setShowMealPicker(true)}>
          <Text style={styles.rowLabel}>{t('Meal Time')}</Text>
          <View style={styles.rowValuePill}>
            <Text style={styles.rowValueText}>{t(MEAL_TYPE_LABEL[mealType])}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.wheels} key={wheelKey}>
        <WheelPicker items={TENS} selectedIndex={tens} onChange={setTens} width={80} />
        <WheelPicker items={UNITS} selectedIndex={units} onChange={setUnits} width={64} />
        <Text style={styles.wheelUnit}>mg/dL</Text>
      </View>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>{t('Delete entry')}</Text>
        </TouchableOpacity>
      )}

      <DateTimeSheet mode={pickerMode} value={dateTime} onChange={onPickerChange} onClose={() => setPickerMode(null)} />

      <Modal visible={showMealPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMealPicker(false)}
        >
          <View style={styles.modalSheet}>
            {MEAL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalOption}
                onPress={() => {
                  setMealType(option);
                  setShowMealPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    option === mealType && { color: Colors.accent },
                  ]}
                >
                  {t(MEAL_TYPE_LABEL[option])}
                </Text>
                {option === mealType && (
                  <Ionicons name="checkmark" size={18} color={Colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    marginBottom: 24,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
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
  rowValuePlain: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  wheelUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700', marginLeft: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalOptionText: {
    color: Colors.textPrimary,
    fontSize: 16,
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
