import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';

// Biblioteca de ejercicios para el usuario: buscar y ver cómo se hace cada uno
export const ExerciseLibraryScreen = () => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Exercise library')} showBack backFallback="/workouts" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ExerciseLibrary onOpen={(ex) => router.push({ pathname: '/exercise-info', params: { id: ex.id } })} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
});
