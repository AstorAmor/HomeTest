import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { cycleRepository } from '@/data/cycleRepository';

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const LogCycleScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    cycleRepository.getAll().then((entries) => {
      const existing = entries.find((e) => e.id === id);
      if (existing) setDate(new Date(existing.fecha));
    });
  }, [id]);

  const onPickerChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDate(selected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditing && id) {
        await cycleRepository.update(id, { fecha: date.toISOString() });
      } else {
        await cycleRepository.save({
          id: `${Date.now()}`,
          fecha: date.toISOString(),
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
    await cycleRepository.remove(id);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleButton, styles.circleButtonActive]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="water" size={26} color={Colors.pulseAccent} />
        </View>
        <Text style={styles.title}>Period Start</Text>
      </View>

      <View style={styles.list}>
        <TouchableOpacity style={styles.row} onPress={() => setShowPicker(true)}>
          <Text style={styles.rowLabel}>Date</Text>
          <View style={styles.rowValuePill}>
            <Text style={styles.rowValueText}>{formatDate(date)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>Delete entry</Text>
        </TouchableOpacity>
      )}

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
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
  circleButtonActive: {
    backgroundColor: Colors.pulseAccent,
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
    backgroundColor: 'rgba(224, 107, 158, 0.15)',
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
