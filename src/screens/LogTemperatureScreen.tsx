import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { basalTemperatureRepository } from '@/data/temperatureRepository';
import { dayKey } from '@/data/bathroomRepository';
import { logScreenStyles } from './LogBowelScreen';

const STEP = 0.05;
const MIN = 35.0;
const MAX = 38.0;

// Temperatura basal: al despertar, antes de levantarse, siempre a la misma hora. Se parte de la
// última para que baste con tocar + o − un par de veces.
export const LogTemperatureScreen = () => {
  const router = useRouter();
  const [value, setValue] = useState(36.5);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    basalTemperatureRepository.getAll().then((all) => {
      const today = all.find((t) => dayKey(new Date(t.fecha)) === dayKey(new Date()));
      if (today) {
        setValue(today.valor);
        setExistingId(today.id);
      } else if (all.length) {
        setValue(all.reduce((a, t) => (t.fecha > a.fecha ? t : a)).valor);
      }
    });
  }, []);

  const change = (delta: number) =>
    setValue((v) => Math.min(MAX, Math.max(MIN, Math.round((v + delta) * 100) / 100)));

  const save = async () => {
    setSaving(true);
    try {
      if (existingId) await basalTemperatureRepository.update(existingId, { valor: value });
      else {
        const now = new Date().toISOString();
        await basalTemperatureRepository.save({ id: `${Date.now()}`, valor: value, unidad: '°C', fecha: now, createdAt: now });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, styles.circleButtonActive]} onPress={save} disabled={saving}>
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="thermometer-outline" size={26} color={Colors.gold} />
          </View>
          <Text style={styles.title}>Morning temperature</Text>
          <Text style={styles.subtitle}>
            Take it as soon as you wake up, before getting out of bed, at about the same time each day.
          </Text>
        </View>

        <View style={styles.valueRow}>
          <TouchableOpacity style={styles.bigStep} onPress={() => change(-STEP)}>
            <Ionicons name="remove" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.value}>{value.toFixed(2)}</Text>
            <Text style={styles.unit}>°C</Text>
          </View>
          <TouchableOpacity style={styles.bigStep} onPress={() => change(STEP)}>
            <Ionicons name="add" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.askCard}>
          <Text style={styles.askText}>
            A digital basal thermometer (two decimals) works best. Illness, alcohol or a bad night can raise it: add a
            note in your check-in if so.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 26 },
  bigStep: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { color: Colors.textPrimary, fontSize: 48, fontWeight: '800' },
  unit: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
