import { dateLocale, getLang, num, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, withAlpha } from '@/constants/colors';
import { AppIcon } from '@/components/HealthIcons';
import { WheelPicker } from '@/components/WheelPicker';
import { createMetricRepository } from '@/data/metricRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const formatDate = (date: Date) =>
  date.toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

interface LogSimpleMetricScreenProps {
  title: string;
  unit: string;
  icon: string; // nombre de AppIcon
  color: string;
  repo: ReturnType<typeof createMetricRepository<SimpleMetricEntry>>;
  // Ruedas: parte entera de min a max y, si decimals, una rueda más con el decimal
  min: number;
  max: number;
  decimals?: boolean;
  initial: number; // valor de partida si aún no hay ninguna medición
  withTime?: boolean; // false: solo la fecha (p. ej. el VO2max, que no depende de la hora)
}

// Apunte de una medición de un solo valor (colesterol, cortisol, VO2max) con ruedas, como la
// glucosa y la tensión: una para la parte entera y, si hace falta, otra para el decimal.

export const LogSimpleMetricScreen = ({ title, unit, icon, color, repo, min, max, decimals, initial, withTime = true }: LogSimpleMetricScreenProps) => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [dateTime, setDateTime] = useState(new Date());
  const WHOLE = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
  const DEC = Array.from({ length: 10 }, (_, i) => String(i));
  const split = (v: number) => {
    const r = Math.round(Math.max(min, Math.min(max, v)) * 10) / 10;
    return { whole: Math.floor(r) - min, dec: Math.round((r - Math.floor(r)) * 10) };
  };
  const [whole, setWhole] = useState(split(initial).whole);
  const [dec, setDec] = useState(split(initial).dec);
  const [wheelKey, setWheelKey] = useState(0);
  const value = min + whole + (decimals ? dec / 10 : 0);
  const setFrom = (v: number) => {
    const w = split(v);
    setWhole(w.whole);
    setDec(w.dec);
    setWheelKey((k) => k + 1);
  };
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);

  // Al editar, las ruedas empiezan en ese valor; si no, en la última medición
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

  const isValid = value >= min;

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
        <View style={[styles.iconBadge, { backgroundColor: withAlpha(color, 0.14) }]}>
          <AppIcon name={icon} size={26} color={color} />
        </View>
        <Text style={styles.title}>{t(title)}</Text>
      </View>

      <View style={styles.list}>
        <TouchableOpacity style={styles.row} onPress={() => setPickerMode('date')}>
          <Text style={styles.rowLabel}>{t('Date')}</Text>
          <View style={styles.rowValuePill}>
            <Text style={styles.rowValueText}>{formatDate(dateTime)}</Text>
          </View>
        </TouchableOpacity>

        {withTime && (
          <TouchableOpacity style={styles.row} onPress={() => setPickerMode('time')}>
            <Text style={styles.rowLabel}>{t('Time')}</Text>
            <View style={styles.rowValuePill}>
              <Text style={styles.rowValueText}>{formatTime(dateTime)}</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>{t(title)}</Text>
          <Text style={styles.rowValuePlain}>
            {num(decimals ? value.toFixed(1) : String(value))} {unit}
          </Text>
        </View>
      </View>

      <View style={styles.wheels} key={wheelKey}>
        <WheelPicker items={WHOLE} selectedIndex={whole} onChange={setWhole} width={84} />
        {decimals && (
          <>
            <Text style={styles.wheelComma}>{getLang() === 'en' ? '.' : ','}</Text>
            <WheelPicker items={DEC} selectedIndex={dec} onChange={setDec} width={56} />
          </>
        )}
        <Text style={styles.wheelUnit}>{unit}</Text>
      </View>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>{t('Delete entry')}</Text>
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
  rowValuePlain: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  wheelComma: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  wheelUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700', marginLeft: 8 },
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
