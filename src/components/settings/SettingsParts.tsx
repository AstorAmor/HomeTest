// Piezas finas de Ajustes y sus pantallas (rediseño del 2026-11-17; el fundador: «Ajustes parece que dentro tampoco
// está actualizado… de repente tengo mil iconos»). Lo que no trae src/components/fine: el interruptor con los colores
// del prototipo (como en Configura tu experiencia) y una fila con línea fina que lleva algo debajo del texto (un aviso,
// un enlace) y, a la derecha, el interruptor u otra cosa. Sin iconos ni tarjetas.
import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { FINE, fine } from '@/theme/fine';

const TRACK_OFF = 'rgba(240,239,230,0.14)';

// El interruptor: esmeralda encendido y la bola en marfil (el mismo que SectionToggles en Configura tu experiencia)
export function FineSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: TRACK_OFF, true: FINE.emerald }}
      thumbColor={FINE.ivory}
      ios_backgroundColor={TRACK_OFF}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

// Fila con línea fina: título, explicación debajo, lo que haga falta debajo (children) y algo a la derecha.
// No es un botón: si lleva un enlace dentro (children), no queda un botón dentro de otro
export function SetRow({
  title,
  sub,
  dim,
  last,
  right,
  children,
  style,
}: {
  title: string;
  sub?: string;
  dim?: boolean; // el título apagado (p. ej. un aviso que no se puede encender)
  last?: boolean; // sin línea debajo
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[fine.row, last && styles.noLine, style]}>
      <View style={styles.text}>
        <Text style={[fine.rowTitle, dim && styles.dim]}>{title}</Text>
        {sub ? <Text style={fine.rowSub}>{sub}</Text> : null}
        {children}
      </View>
      {right}
    </View>
  );
}

// La misma fila con su interruptor a la derecha
export function SwitchRow({
  value,
  onValueChange,
  disabled,
  ...row
}: {
  title: string;
  sub?: string;
  dim?: boolean;
  last?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SetRow {...row} right={<FineSwitch value={value} onValueChange={onValueChange} disabled={disabled} accessibilityLabel={row.title} />} />
  );
}

export const settingsStyles = StyleSheet.create({
  // Cuerpo de cada pantalla: el margen de los lados
  body: { paddingHorizontal: 20 },
  // La primera sección va pegada a la cabecera de la pantalla
  firstSec: { marginTop: 4 },
  // Un enlace en jade alineado a la izquierda (FLink va centrado)
  linkLeft: { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  noLine: { borderBottomWidth: 0 },
});

const styles = StyleSheet.create({
  text: { flex: 1, minWidth: 0 },
  dim: { color: FINE.mute },
  noLine: { borderBottomWidth: 0 },
});
