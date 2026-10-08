import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { cycleRepository } from '@/data/cycleRepository';

const DAY_MS = 24 * 3600 * 1000;
const fromKey = (key: string) => new Date(`${key}T12:00:00`);
const formatDay = (key: string) =>
  fromKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// "Log period": primer día y último día de la regla (duración), en un calendario.
// Primer toque = inicio; segundo toque = fin. Si aún no ha terminado, se guarda solo el inicio.
export const LogCycleScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const today = toDayKey(new Date());
  const [month, setMonth] = useState(new Date());
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    cycleRepository.getAll().then((entries) => {
      const existing = entries.find((e) => e.id === id);
      if (!existing) return;
      const s = toDayKey(new Date(existing.fecha));
      setStart(s);
      setEnd(existing.endFecha ? toDayKey(new Date(existing.endFecha)) : null);
      setMonth(fromKey(s));
    });
  }, [id]);

  const onDayPress = (day: string) => {
    if (!start || (start && end) || day < start) {
      setStart(day);
      setEnd(null);
    } else {
      setEnd(day);
    }
  };

  const days = start ? Math.round((fromKey(end ?? start).getTime() - fromKey(start).getTime()) / DAY_MS) + 1 : 0;

  const handleSave = async () => {
    if (!start) return;
    setSaving(true);
    try {
      const values = {
        fecha: fromKey(start).toISOString(),
        endFecha: end ? fromKey(end).toISOString() : undefined,
      };
      if (isEditing && id) {
        await cycleRepository.update(id, { ...values, endFecha: values.endFecha ?? null } as any);
      } else {
        await cycleRepository.save({ id: `${Date.now()}`, createdAt: new Date().toISOString(), ...values });
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
          style={[styles.circleButton, start ? styles.circleButtonActive : null]}
          onPress={handleSave}
          disabled={saving || !start}
        >
          <Ionicons name="checkmark" size={22} color={start ? Colors.background : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="rose-outline" size={26} color={Colors.pulseAccent} />
          </View>
          <Text style={styles.title}>Log period</Text>
          <Text style={styles.subtitle}>
            Tap the first day, then the last day. If it hasn't finished yet, just save the first day and add the end
            later.
          </Text>
        </View>

        <View style={styles.card}>
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            rangeStart={start}
            rangeEnd={end}
            onDayPress={onDayPress}
            maxDate={today}
          />
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Started</Text>
            <Text style={styles.summaryValue}>{start ? formatDay(start) : '—'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Ended</Text>
            <Text style={styles.summaryValue}>{end ? formatDay(end) : start ? 'Ongoing' : '—'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{start && end ? `${days} days` : '—'}</Text>
          </View>
        </View>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.deleteButtonText}>Delete entry</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonActive: { backgroundColor: Colors.pinkSoft },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.pinkSoftBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  summary: { flexDirection: 'row', gap: 10, marginTop: 14 },
  summaryItem: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  deleteButtonText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
});
