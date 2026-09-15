import React from 'react';
import { Text, TextStyle, StyleProp, StyleSheet } from 'react-native';

interface UnitLabelProps {
  unit: string;
  style?: StyleProp<TextStyle>;
}

// Convierte notación "x10^6/µL" en texto con el exponente en superíndice real
export const UnitLabel = ({ unit, style }: UnitLabelProps) => {
  const parts = unit.split(/(\^\d+)/g).filter(Boolean);

  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith('^') ? (
          <Text key={i} style={styles.superscript}>
            {part.slice(1)}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
};

const styles = StyleSheet.create({
  superscript: {
    fontSize: 10,
    top: -5,
  },
});
