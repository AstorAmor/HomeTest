import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FChip } from '@/components/fine/FineForm';

// Fila de opciones tipo "chip" (una seleccionada). Se usa en los registros y en las encuestas.
// Desde el 2026-11-16, en el lenguaje fino del prototipo (como FChips de FineForm): chips con un borde fino y la
// letra apagada; el elegido, con borde jade y la letra en marfil. Mismas props y la misma fila que antes.
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
    <View style={[styles.row, center && styles.center]} accessibilityRole="radiogroup">
      {options.map((o) => (
        <FChip key={String(o.id)} label={o.label} on={value === o.id} onPress={() => onChange(o.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { justifyContent: 'center' },
});
