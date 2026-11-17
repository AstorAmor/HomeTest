import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Confetti } from '@/components/Confetti';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { FButton, FChip, FLink, formStyles } from '@/components/fine/FineForm';
import { MealEntry, mealStreakDays, saveMeal } from '@/data/planRepository';
import { t } from '@/i18n';
import { expectSystemUi } from '@/utils/systemUi';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FINE, ff, fine } from '@/theme/fine';

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
// Rediseño del 2026-11-16 (lenguaje fino): la foto en un recuadro de línea discontinua fina con la cámara a línea,
// cabeceras pequeñas, chips con borde y el botón en esmeralda; al guardar, los puntos dentro de un aro de oro.
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
        // La hoja del sistema sale encima de la app: que el bloqueo no la tape con la K (src/utils/systemUi.ts)
        expectSystemUi();
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError(t('Camera permission is needed to snap your meal.'));
          return;
        }
        expectSystemUi();
        const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        if (!result.canceled) setPhotoUri(result.assets[0].uri);
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
        if (!result.canceled) setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not open the camera'));
    }
  };

  const pickFromGallery = async () => {
    expectSystemUi();
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
          <GlowRing progress={1} colors={ringTones(FINE.gold)} size={124} stroke={5}>
            <Text style={styles.pointsText}>+10</Text>
            <Text style={styles.pointsLabel}>{t('points')}</Text>
          </GlowRing>
        </View>
        <Text style={styles.doneTitle}>{t('Meal logged!')}</Text>
        <Text style={styles.doneText}>
          {streak > 1 ? t('🔥 {n}-day streak. Keep it going!', { n: streak }) : t('Log tomorrow too to start a streak.')}
          {addedSugar === false ? `\n${t('No added sugar, nice one.')}` : ''}
        </Text>
        <FButton label={t('Done')} onPress={() => router.back()} style={styles.doneBtn} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={24} color={FINE.jade} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('Snap your meal')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.photoBox} onPress={takePhoto} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('Tap to take a photo')}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={36} color={FINE.jade} style={{ marginBottom: 10 }} />
              <Text style={styles.photoText}>{t('Tap to take a photo')}</Text>
            </>
          )}
        </TouchableOpacity>
        <FLink label={photoUri ? t('Choose another photo') : t('Or choose from gallery')} icon="images-outline" onPress={pickFromGallery} />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>{t('What is it?')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('e.g. Rice with chicken and salad')}
          placeholderTextColor={FINE.mute}
          value={description}
          onChangeText={setDescription}
          accessibilityLabel={t('What is it?')}
        />

        <Text style={styles.label}>{t('Meal')}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {MEAL_TYPES.map((m) => (
            <FChip key={m.id} label={t(m.label)} on={mealType === m.id} onPress={() => setMealType(m.id)} />
          ))}
        </View>

        <Text style={styles.label}>{t('Any added sugar?')}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {[
            { v: false, label: 'No' },
            { v: true, label: 'Yes' },
          ].map((o) => (
            <FChip key={o.label} label={t(o.label)} on={addedSugar === o.v} check onPress={() => setAddedSugar(o.v)} />
          ))}
        </View>
      </KeyboardAwareScrollView>

      <KeyboardFooter>
        <FButton label={t('Save meal · +10 points')} onPress={save} disabled={!photoUri && !description.trim()} style={styles.cta} />
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 17 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  // El recuadro de la foto: línea discontinua fina, casi transparente
  photoBox: {
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(240,239,230,0.22)',
    backgroundColor: FINE.tile,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoText: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
  error: { ...formStyles.error, textAlign: 'center' },
  label: { ...fine.secTitle, marginBottom: 10, marginTop: 22 },
  input: { ...formStyles.input },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cta: { marginHorizontal: 20, marginBottom: 12 },
  doneBtn: { alignSelf: 'stretch' },
  pointsBadge: { marginBottom: 20 },
  pointsText: { ...ff('light'), color: FINE.gold, fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  pointsLabel: { ...ff('regular'), color: FINE.gold, fontSize: 12 },
  doneTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 26, lineHeight: 32, marginBottom: 8 },
  doneText: { ...ff('regular'), color: FINE.mute, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
});
