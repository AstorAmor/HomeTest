import React from 'react';
import { View, Text, TextStyle, StyleProp, StyleSheet } from 'react-native';

interface UnitLabelProps {
  unit: string;
  style?: StyleProp<TextStyle>;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

const SUPERSCRIPT_CHARS = Object.keys(SUPERSCRIPT_DIGITS).join('');

// Reconoce tanto notación "^6" como caracteres unicode superíndice (⁶) y los
// normaliza a dígitos planos antes de renderizarlos siempre con el mismo
// estilo de superíndice (evita depender de si la fuente soporta el glifo).
// Nota: se usan dos regex idénticas (una con /g/ para split, otra sin /g/
// para test) porque una regex global es stateful entre llamadas a .test().
const EXPONENT_SPLIT_PATTERN = new RegExp(`(\\^\\d+|[${SUPERSCRIPT_CHARS}]+)`, 'g');
const EXPONENT_TEST_PATTERN = new RegExp(`^(\\^\\d+|[${SUPERSCRIPT_CHARS}]+)$`);

function normalizeExponent(match: string): string {
  if (match.startsWith('^')) return match.slice(1);
  return match
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join('');
}

// Nota: se renderiza como View (fila) en vez de Text anidado a propósito.
// El truco clásico de "Text dentro de Text" con `top`/`verticalAlign` para
// simular superíndice es poco fiable en Android. Alinear los hijos de una
// fila al inicio (alignItems: 'flex-start') consigue el mismo efecto visual
// apoyándose solo en Flexbox, que sí es consistente entre plataformas.
export const UnitLabel = ({ unit, style }: UnitLabelProps) => {
  const parts = unit.split(EXPONENT_SPLIT_PATTERN).filter(Boolean);

  return (
    <View style={styles.row}>
      {parts.map((part, i) =>
        EXPONENT_TEST_PATTERN.test(part) ? (
          <Text key={i} style={[style, styles.superscript]}>
            {normalizeExponent(part)}
          </Text>
        ) : (
          <Text key={i} style={style}>
            {part}
          </Text>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  superscript: {
    fontSize: 9,
  },
});
