import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';

// Fila de opciones tipo "chip" (una seleccionada). Se usa en los registros y en las encuestas.
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  center,
}: {
  options: { id: T; label: string }[];
  value: T | undefined | null;
  onChange: (id: T) => void;
  center?: boolean;
}) {
  return (
    <View style={[styles.row, center && { justifyContent: 'center' }]}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <TouchableOpacity
            key={String(o.id)}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(o.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  text: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  textSelected: { color: Colors.textPrimary },
});
