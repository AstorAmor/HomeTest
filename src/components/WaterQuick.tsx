import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWaterToday } from '@/hooks/useWaterToday';
import { litres } from '@/data/waterRepository';
import { t } from '@/i18n';
import { FINE, ff } from '@/theme/fine';

// La línea del agua en la tarjeta de Hidratación de Hoy: lo bebido hoy frente al objetivo y un «+» que
// apunta tu medida (un vaso, o la que hayas puesto). Otra cantidad, con la rueda, desde Hidratación.
// Con el lenguaje fino (2026-11-16): gota a línea en jade y el «+» esmeralda, como el resto de «+» de Hoy.
export const WaterQuick = ({ goalMl }: { goalMl: number }) => {
  const { total, usual, add } = useWaterToday();
  return (
    <View style={styles.row}>
      <Ionicons name="water-outline" size={14} color={FINE.jade} />
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.strong}>{litres(total)}</Text> / {litres(goalMl)}
      </Text>
      <TouchableOpacity style={styles.add} onPress={add} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Add {ml} ml of water', { ml: usual })}>
        <Ionicons name="add" size={16} color={FINE.ivory} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 12 },
  strong: { ...ff('medium'), color: FINE.ivory },
  add: { width: 24, height: 24, borderRadius: 12, backgroundColor: FINE.emerald, justifyContent: 'center', alignItems: 'center' },
});
