// Piezas de formulario en el lenguaje fino del prototipo (src/theme/fine.ts) para Dieta y Entrenamientos (rediseño
// del 2026-11-16; el fundador: «siguen con el estilo de antes»): chips con borde, opciones en filas con una línea fina
// y un círculo a la derecha, botón esmeralda a todo el ancho y acciones secundarias en jade. Sin tarjetas de color.
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FINE, ff, fine } from '@/theme/fine';

const DARK = '#061A16'; // la marca sobre el jade
export const ON_BG = 'rgba(131,214,180,0.08)'; // el fondo apenas marcado de lo elegido

// Un chip con borde; elegido, borde jade y la letra en marfil (prototipo, `.chipsw`)
export function FChip({
  label,
  on,
  onPress,
  check,
  disabled,
  multi,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  check?: boolean; // una marca delante cuando está elegido (los de elegir varios)
  disabled?: boolean;
  multi?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn, disabled && styles.off]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: on, disabled }}
    >
      {check && on ? <Ionicons name="checkmark" size={14} color={FINE.jade} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Una fila de chips con una sola elegida (en estas pantallas, en lugar de ChoiceChips)
export function FChips<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { id: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.chips, style]} accessibilityRole="radiogroup">
      {options.map((o) => (
        <FChip key={String(o.id)} label={o.label} on={o.id === value} onPress={() => onChange(o.id)} />
      ))}
    </View>
  );
}

// El círculo de marcar: vacío con borde fino; marcado, jade con la marca oscura (prototipo, `.mark`)
export function FMark({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }, on && styles.markOn]}>
      {on ? <Ionicons name="checkmark" size={Math.round(size * 0.62)} color={DARK} /> : null}
    </View>
  );
}

// Una opción en fila: su nombre, la explicación debajo y el círculo a la derecha
export function FOption({
  title,
  hint,
  on,
  onPress,
  multi,
  last,
  left,
}: {
  title: string;
  hint?: string;
  on: boolean;
  onPress: () => void;
  multi?: boolean; // casilla (sí / no o varias) en lugar de una sola entre varias
  last?: boolean;
  left?: ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[fine.row, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: on }}
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[fine.rowTitle, !on && !multi && styles.optOff]}>{title}</Text>
        {hint ? <Text style={fine.rowSub}>{hint}</Text> : null}
      </View>
      <FMark on={on} />
    </TouchableOpacity>
  );
}

// Botón principal: esmeralda a todo el ancho, letra marfil (como «Ver tus objetivos» en la hoja de Hoy)
export function FButton({
  label,
  onPress,
  icon,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || busy) && styles.off, style]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      accessibilityLabel={label}
    >
      {busy ? <ActivityIndicator size="small" color={FINE.ivory} /> : icon ? <Ionicons name={icon as any} size={17} color={FINE.ivory} /> : null}
      <Text style={styles.btnText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Acción secundaria: texto en jade (o apagado), con su icono a línea si lo lleva
export function FLink({
  label,
  onPress,
  icon,
  disabled,
  busy,
  muted,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
  busy?: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = muted ? FINE.mute : FINE.jade;
  return (
    <TouchableOpacity
      style={[styles.link, (disabled || busy) && styles.off, style]}
      onPress={onPress}
      disabled={disabled || busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      accessibilityLabel={label}
    >
      {busy ? <ActivityIndicator size="small" color={c} /> : icon ? <Ionicons name={icon as any} size={16} color={c} /> : null}
      <Text style={[styles.linkText, { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const formStyles = StyleSheet.create({
  // Casilla de texto, casi transparente con borde fino (como en Metas)
  input: { ...ff('regular'), backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: FINE.ivory, fontSize: 15 },
  // Pregunta de un asistente (Crear mi menú, Crear mi entrenamiento)
  q: { ...ff('medium'), color: FINE.ivory, fontSize: 21, lineHeight: 27 },
  // Texto de apoyo
  lead: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 6 },
  // Aviso que hay que mirar (en oro, sin alarma)
  warn: { ...ff('regular'), color: FINE.gold, fontSize: 13, lineHeight: 18 },
  // Algo que no ha salido (guardar, cargar): sin rojo de alarma, en un coral suave
  error: { ...ff('regular'), color: '#E9A48F', fontSize: 13, lineHeight: 18 },
});

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, justifyContent: 'center' },
  chipOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  chipText: { ...ff('regular'), color: FINE.mute, fontSize: 13.5 },
  chipTextOn: { color: FINE.ivory },
  optOff: { color: '#CFD6CF' },
  mark: { borderWidth: 1, borderColor: 'rgba(240,239,230,0.3)', alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: FINE.jade, borderColor: FINE.jade },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FINE.emerald, borderRadius: 22, paddingVertical: 13, paddingHorizontal: 18, minHeight: 48 },
  btnText: { ...ff('medium'), color: '#F0EFE6', fontSize: 15, flexShrink: 1 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, minHeight: 44 },
  linkText: { ...ff('regular'), fontSize: 14 },
  off: { opacity: 0.45 },
});
