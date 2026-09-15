import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { createMetricRepository } from '@/data/metricRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

interface LogSimpleMetricScreenProps {
  title: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  repo: ReturnType<typeof createMetricRepository<SimpleMetricEntry>>;
}

export const LogSimpleMetricScreen = ({
  title,
  unit,
  icon,
  color,
  repo,
}: LogSimpleMetricScreenProps) => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [dateTime, setDateTime] = useState(new Date());
  const [value, setValue] = useState('');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    repo.getAll().then((entries) => {
      const existing = entries.find((e) => e.id === id);
      if (existing) {
        setValue(String(existing.valor));
        setDateTime(new Date(existing.fecha));
      }
    });
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

  const isValid = value.trim() !== '' && !Number.isNaN(parseFloat(value));

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const numericValue = parseFloat(value);
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
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleButton, isValid ? { backgroundColor: color } : undefined]}
          onPress={handleSave}
          disabled={!isValid || saving}
        >
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        <Text style={styles.title}>{title}</Text>
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

        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>{title}</Text>
          <TextInput
            style={styles.inlineInput}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={unit}
            placeholderTextColor={Colors.textMuted}
            autoFocus={!isEditing}
          />
        </View>
      </View>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>Delete entry</Text>
        </TouchableOpacity>
      )}

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
  header: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    marginBottom: 16,
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
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
