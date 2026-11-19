import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Tag } from '@/components/fine/Fine';
import { FButton, FChip, FLink, formStyles } from '@/components/fine/FineForm';
import { FOOD_GROUPS, inferFoodGroups } from '@/logic/foodGroups';
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

// Foto de la comida + qué es. Las fotos con su descripción quedan guardadas: a futuro, dataset para entrenar un
// modelo propio. Rediseño del 2026-11-16 (lenguaje fino): la foto en un recuadro de línea discontinua fina con la
// cámara a línea, cabeceras pequeñas, chips con borde y el botón en esmeralda.
// Desde el 2026-11-18, sin puntos ni confeti (fundador: «save meal + 10 points... me aporta poco... sería mejor que
// pongamos qué es, qué cosas contiene»): debajo de lo que escribes, lo que lleva (los grupos que se deducen del texto,
// como en Digestión: src/logic/foodGroups.ts) y, al guardar, la comida con su foto, qué es y lo que lleva.
export const LogMealScreen = () => {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string>();
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<MealEntry['mealType']>(guessMealType());
  const [addedSugar, setAddedSugar] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [streak, setStreak] = useState<number | null>(null);
  // Lo que lleva, deducido de lo escrito (gluten, lácteos, legumbres, frito…)
  const groups = inferFoodGroups(description).map((g) => t(FOOD_GROUPS.find((f) => f.id === g.group)!.label));
  const typeLabel = t(MEAL_TYPES.find((m) => m.id === mealType)!.label);

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
    const sugar = addedSugar === false ? t('No added sugar') : addedSugar ? t('Added sugar') : null;
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={[fine.kicker, styles.doneKicker]}>{t('Meal logged')}</Text>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.donePhoto} contentFit="cover" /> : null}
        <Text style={styles.doneTitle}>{description.trim() || typeLabel}</Text>
        <Text style={styles.doneSub}>{[description.trim() ? typeLabel : null, sugar].filter(Boolean).join(' · ')}</Text>
        {groups.length > 0 && (
          <>
            <Text style={[fine.secTitle, styles.doneLabel]}>{t('Contains')}</Text>
            <View style={[styles.chips, styles.doneChips]}>
              {groups.map((g) => (
                <Tag key={g} label={g} />
              ))}
            </View>
          </>
        )}
        {streak > 1 ? <Text style={styles.doneText}>{t('{n} days in a row logging meals.', { n: streak })}</Text> : null}
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
        {groups.length > 0 && (
          <View style={styles.contains}>
            <Text style={fine.rowSub}>{t('Contains')}</Text>
            {groups.map((g) => (
              <Tag key={g} label={g} />
            ))}
          </View>
        )}

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
        <FButton label={t('Save meal')} onPress={save} disabled={!photoUri && !description.trim()} style={styles.cta} />
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
  doneBtn: { alignSelf: 'stretch', marginTop: 28 },
  contains: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  doneKicker: { marginBottom: 16 },
  donePhoto: { width: 180, height: 180, borderRadius: 20, marginBottom: 18 },
  doneTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  doneSub: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  doneLabel: { marginTop: 22, marginBottom: 8 },
  doneChips: { justifyContent: 'center' },
  doneText: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 20 },
});
