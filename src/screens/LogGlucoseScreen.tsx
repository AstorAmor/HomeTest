import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { MealType, MEAL_TYPE_LABEL } from '@/types/glucose';
import { saveGlucoseEntry } from '@/data/glucoseRepository';

const MEAL_OPTIONS: MealType[] = ['desayuno', 'comida', 'cena', 'unspecified'];
const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

const formatDate = (date: Date) =>
  date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export const LogGlucoseScreen = () => {
  const router = useRouter();
  const [dateTime, setDateTime] = useState(new Date());
  const [value, setValue] = useState('');
  const [mealType, setMealType] = useState<MealType>('unspecified');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const onKeyPress = (key: string) => {
    if (key === 'del') {
      setValue((v) => v.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) return;
    if (value.length >= 6) return;
    setValue((v) => v + key);
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

  const handleSave = async () => {
    const numericValue = parseFloat(value);
    if (Number.isNaN(numericValue) || numericValue <= 0) return;

    setSaving(true);
    try {
      await saveGlucoseEntry({
        id: `${Date.now()}`,
        valor: numericValue,
        unidad: 'mg/dL',
        fecha: dateTime.toISOString(),
        mealType,
        createdAt: new Date().toISOString(),
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const isValid = value.trim() !== '' && !Number.isNaN(parseFloat(value));

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
          <Ionicons name="pulse" size={26} color={Colors.danger} />
        </View>
        <Text style={styles.title}>Blood Glucose</Text>
      </View>

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
          <Text style={styles.rowLabel}>Blood Glucose</Text>
          <Text style={styles.rowValuePlain}>
            {value ? `${value} mg/dL` : 'mg/dL'}
          </Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => setShowMealPicker(true)}>
          <Text style={styles.rowLabel}>Meal Time</Text>
          <View style={styles.rowValuePill}>
            <Text style={styles.rowValueText}>{MEAL_TYPE_LABEL[mealType]}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, i) => (
          <View key={i} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.key}
                onPress={() => onKeyPress(key)}
              >
                {key === 'del' ? (
                  <Ionicons name="backspace-outline" size={22} color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {pickerMode && (
        <DateTimePicker
          value={dateTime}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      )}

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
                  {MEAL_TYPE_LABEL[option]}
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
  keypad: {
    marginHorizontal: 20,
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  key: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  keyText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
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
});
