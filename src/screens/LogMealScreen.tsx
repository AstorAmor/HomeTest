import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Confetti } from '@/components/Confetti';
import { MealEntry, mealStreakDays, saveMeal } from '@/data/planRepository';

const MEAL_TYPES: { id: MealEntry['mealType']; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

const guessMealType = (): MealEntry['mealType'] => {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 17) return 'lunch';
  if (h < 23) return 'dinner';
  return 'snack';
};

// Foto de la comida + qué es. Gamificado (puntos y racha). Las fotos con su
// descripción quedan guardadas: a futuro, dataset para entrenar un modelo propio.
export const LogMealScreen = () => {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string>();
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<MealEntry['mealType']>(guessMealType());
  const [addedSugar, setAddedSugar] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState<number | null>(null);

  const takePhoto = async () => {
    setError('');
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Camera permission is needed to snap your meal.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        if (!result.canceled) setPhotoUri(result.assets[0].uri);
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
        if (!result.canceled) setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    const now = new Date().toISOString();
    await saveMeal({
      id: `meal-${Date.now()}`,
      fecha: now,
      createdAt: now,
      photoUri,
      description: description.trim(),
      mealType,
      addedSugar,
    });
    setStreak(await mealStreakDays());
  };

  if (streak !== null) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Confetti count={50} />
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>+10</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
        <Text style={styles.doneTitle}>Meal logged!</Text>
        <Text style={styles.doneText}>
          {streak > 1 ? `🔥 ${streak}-day streak. Keep it going!` : 'Log tomorrow too to start a streak.'}
          {addedSugar === false ? '\nNo added sugar, nice one.' : ''}
        </Text>
        <TouchableOpacity style={[styles.cta, { alignSelf: 'stretch' }]} onPress={() => router.back()}>
          <Text style={styles.ctaText}>Done</Text>
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
        <Text style={styles.topTitle}>Snap your meal</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.photoBox} onPress={takePhoto} activeOpacity={0.85}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <>
              <View style={styles.cameraCircle}>
                <Ionicons name="camera" size={34} color={Colors.background} />
              </View>
              <Text style={styles.photoText}>Tap to take a photo</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFromGallery} style={styles.galleryLink}>
          <Ionicons name="images-outline" size={16} color={Colors.accent} />
          <Text style={styles.galleryText}>{photoUri ? 'Choose another photo' : 'Or choose from gallery'}</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>What is it?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Rice with chicken and salad"
          placeholderTextColor={Colors.textMuted}
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Meal</Text>
        <View style={styles.chips}>
          {MEAL_TYPES.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, mealType === m.id && styles.selected]}
              onPress={() => setMealType(m.id)}
            >
              <Text style={[styles.chipText, mealType === m.id && { color: Colors.textPrimary }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Any added sugar?</Text>
        <View style={styles.chips}>
          {[
            { v: false, label: 'No', icon: 'check-circle-outline' },
            { v: true, label: 'Yes', icon: 'cube-outline' },
          ].map((o) => (
            <TouchableOpacity
              key={o.label}
              style={[styles.chip, styles.sugarChip, addedSugar === o.v && styles.selected]}
              onPress={() => setAddedSugar(o.v)}
            >
              <MaterialCommunityIcons
                name={o.icon as any}
                size={16}
                color={addedSugar === o.v ? Colors.amber : Colors.textSecondary}
              />
              <Text style={[styles.chipText, addedSugar === o.v && { color: Colors.textPrimary }]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.cta, !photoUri && !description.trim() && styles.ctaDisabled]}
        onPress={save}
        disabled={!photoUri && !description.trim()}
      >
        <Text style={styles.ctaText}>Save meal · +10 points</Text>
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
  photoBox: {
    height: 220,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(240, 184, 77, 0.5)',
    backgroundColor: 'rgba(240, 184, 77, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  cameraCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  galleryLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  galleryText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  label: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sugarChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selected: { borderColor: Colors.amber, backgroundColor: 'rgba(240, 184, 77, 0.1)' },
  chipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  pointsBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(240, 184, 77, 0.14)',
    borderWidth: 2,
    borderColor: 'rgba(240, 184, 77, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pointsText: { color: Colors.amber, fontSize: 34, fontWeight: '900' },
  pointsLabel: { color: Colors.amber, fontSize: 12, fontWeight: '700' },
  doneTitle: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  doneText: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
});
