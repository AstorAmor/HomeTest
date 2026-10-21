import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useWaterToday } from '@/hooks/useWaterToday';
import { litres } from '@/data/waterRepository';
import { t } from '@/i18n';

// La línea del agua en la tarjeta de Hidratación de Hoy: lo bebido hoy frente al objetivo y un «+» que
// apunta tu medida (un vaso, o la que hayas puesto). Otra cantidad, con la rueda, desde Hidratación.
export const WaterQuick = ({ goalMl }: { goalMl: number }) => {
  const { total, usual, add } = useWaterToday();
  return (
    <View style={styles.row}>
      <Ionicons name="water" size={14} color={Colors.water} />
      <Text style={styles.text} numberOfLines={1}>
        <Text style={styles.strong}>{litres(total)}</Text> / {litres(goalMl)}
      </Text>
      <TouchableOpacity style={styles.add} onPress={add} hitSlop={8} accessibilityLabel={t('Add {ml} ml of water', { ml: usual })}>
        <Ionicons name="add" size={16} color={Colors.background} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  strong: { color: Colors.textPrimary, fontWeight: '800' },
  add: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.water, justifyContent: 'center', alignItems: 'center' },
});
