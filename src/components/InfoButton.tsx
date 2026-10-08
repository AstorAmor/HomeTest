import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

// Icono (i) junto a un número o recomendación: abre cómo lo calculamos y sus fuentes
// (src/data/evidence.ts).
export const InfoButton = ({ topic, size = 18, color = Colors.textMuted }: { topic: string; size?: number; color?: string }) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/evidence', params: { topic } })}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="How this works and sources"
    >
      <Ionicons name="information-circle-outline" size={size} color={color} />
    </TouchableOpacity>
  );
};
