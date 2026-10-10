import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { Confetti } from '@/components/Confetti';
import { strengthSessionsThisWeek, workoutRepository, WorkoutEntry, WorkoutType } from '@/data/planRepository';
import { t as tr } from '@/i18n';

const TYPES: { id: WorkoutType; label: string; icon: string }[] = [
  { id: 'strength', label: 'Strength', icon: 'dumbbell' },
  { id: 'cardio', label: 'Cardio', icon: 'run' },
  { id: 'mobility', label: 'Mobility', icon: 'yoga' },
  { id: 'sport', label: 'Sport', icon: 'tennis' },
];
const DURATIONS = [20, 30, 45, 60, 90];
const INTENSITIES: { id: WorkoutEntry['intensity']; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'hard', label: 'Hard' },
];

export const LogWorkoutScreen = () => {
  const router = useRouter();
  const [type, setType] = useState<WorkoutType>('strength');
  const [minutes, setMinutes] = useState(45);
  const [intensity, setIntensity] = useState<WorkoutEntry['intensity']>('moderate');
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const save = async () => {
    const now = new Date().toISOString();
    await workoutRepository.save({ id: `workout-${Date.now()}`, fecha: now, createdAt: now, type, minutes, intensity });
    setSavedCount(await strengthSessionsThisWeek());
  };

  if (savedCount !== null) {
    const goalHit = type === 'strength' && savedCount >= 3;
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Confetti count={goalHit ? 90 : 45} />
        <View style={styles.doneIcon}>
          <MaterialCommunityIcons name="dumbbell" size={40} color={Colors.coral} />
        </View>
        <Text style={styles.doneTitle}>{goalHit ? tr('Weekly goal reached!') : tr('Workout logged!')}</Text>
        <Text style={styles.doneText}>
          {type === 'strength'
            ? `${savedCount} of 3 strength sessions this week.`
            : tr('Nice. Every bit of movement counts.')}
        </Text>
        <TouchableOpacity style={[styles.cta, { alignSelf: 'stretch' }]} onPress={() => router.back()}>
          <Text style={styles.ctaText}>{tr('Done')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{tr('Log a workout')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{tr('Type')}</Text>
        <View style={styles.typeGrid}>
          {TYPES.map((t) => {
            const selected = type === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeItem, selected && styles.selected]}
                onPress={() => setType(t.id)}
              >
                <MaterialCommunityIcons name={t.icon as any} size={26} color={selected ? Colors.coral : Colors.textSecondary} />
                <Text style={[styles.typeText, selected && { color: Colors.textPrimary }]}>{tr(t.label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>{tr('Duration')}</Text>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <TouchableOpacity key={d} style={[styles.chip, minutes === d && styles.selected]} onPress={() => setMinutes(d)}>
              <Text style={[styles.chipText, minutes === d && { color: Colors.textPrimary }]}>{d} min</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{tr('Intensity')}</Text>
        <View style={styles.chips}>
          {INTENSITIES.map((i) => (
            <TouchableOpacity
              key={i.id}
              style={[styles.chip, intensity === i.id && styles.selected]}
              onPress={() => setIntensity(i.id)}
            >
              <Text style={[styles.chipText, intensity === i.id && { color: Colors.textPrimary }]}>{tr(i.label)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.cta} onPress={save}>
        <Text style={styles.ctaText}>{tr('Save workout')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 14 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeItem: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 18,
  },
  typeText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  selected: { borderColor: Colors.coral, backgroundColor: withAlpha(Colors.coral, 0.1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  doneIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: withAlpha(Colors.coral, 0.14),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  doneTitle: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  doneText: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 32 },
});
