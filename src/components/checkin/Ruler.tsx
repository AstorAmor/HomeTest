// La regla de las escalas del check-in (fundador, 2026-11-16: «en la escala ibas a poner una regla, no los
// bloques»). Como en el prototipo (borradores/app-estructura/prototipo, .ruler): arriba la pregunta como
// cabecera de sección y, a la derecha, la palabra de lo marcado en jade («Desliza» si aún no hay nada); debajo,
// una línea fina con 17 marcas (las de las 5 posiciones, más largas), el tramo hecho en degradado jade y un
// punto de luz; y bajo los extremos, las palabras de los extremos.
// Se arrastra o se toca en cualquier punto y salta a la posición más cercana: se guarda lo mismo que antes,
// de 1 a 5. Sin marcar, el botón queda gris en el centro y no hay tramo jade.
// Todo en JS (PanResponder), así que va igual con el dedo en Android y iPhone que con el ratón en la web.
import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { FINE, ff, fine } from '@/theme/fine';
import { t } from '@/i18n';

const H = 48; // alto de la zona que se toca (y del dibujo, con el halo del botón dentro)
const PAD = 14; // medio botón: su centro llega justo a los extremos de la regla
const Y = H / 2; // la línea, a media altura
const TICKS = 17; // cada 4, una de las 5 posiciones
const STEPS = 5;
const IVORY = '#F7F3E6';
const JADE = '#83D6B4';
const JADE_DEEP = '#2F8F70';
const GREY = '#8D9E95';

// Qué posición (1 a 5) cae en el punto x de una regla de `width` de ancho
export const rulerValueAt = (x: number, width: number): number => {
  const span = Math.max(1, width - 2 * PAD);
  const p = Math.min(1, Math.max(0, (x - PAD) / span));
  return Math.round(p * (STEPS - 1)) + 1;
};

// En la web: cursor de mano, sin seleccionar texto al arrastrar y el scroll vertical del móvil sigue siendo del navegador
const WEB_TOUCH = (Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none', touchAction: 'pan-y' } : {}) as ViewStyle;

let seq = 0;

type Props = {
  title: string; // la pregunta, ya traducida
  words: string[]; // las 5 palabras de la escala, ya traducidas
  value?: number; // 1..5, o nada si aún no se ha marcado
  onChange: (v: number) => void;
};

export function Ruler({ title, words, value, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const [gid] = useState(() => `ruler${++seq}`); // ids de los degradados, únicos en la página (web)
  // El PanResponder se crea una vez: lee lo último por referencias
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const startX = useRef(0);
  const dragging = useRef(false);

  const pan = useMemo(() => {
    const pick = (x: number) => {
      if (!widthRef.current) return;
      const v = rulerValueAt(x, widthRef.current);
      if (v !== valueRef.current) {
        valueRef.current = v;
        onChangeRef.current(v);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Mientras se arrastra, la regla no suelta el dedo (ni el scroll de la pantalla se lo lleva)
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        // La capa que recibe el toque no tiene hijos: locationX es la distancia al borde izquierdo de la regla
        startX.current = e.nativeEvent.locationX;
        dragging.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (!dragging.current && Math.abs(g.dx) > 3 && Math.abs(g.dx) >= Math.abs(g.dy)) dragging.current = true;
        if (dragging.current) pick(startX.current + g.dx);
      },
      onPanResponderRelease: (_, g) => {
        // Un toque marca donde cae; deslizar en vertical no cambia nada
        if (dragging.current || Math.abs(g.dy) < 12) pick(startX.current + g.dx);
        dragging.current = false;
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
      },
    });
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    widthRef.current = w;
    setWidth(w);
  };

  // Lectores de pantalla: deslizar arriba o abajo sube o baja una posición (sin marcar, se parte del centro)
  const onAction = (e: AccessibilityActionEvent) => {
    const base = value ?? 3;
    if (e.nativeEvent.actionName === 'increment') onChange(Math.min(STEPS, base + 1));
    if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(1, base - 1));
  };

  const set = value !== undefined;
  const span = Math.max(0, width - 2 * PAD);
  const cx = PAD + (((value ?? 3) - 1) / (STEPS - 1)) * span;
  const word = set ? words[value - 1] : t('Slide');

  return (
    <View>
      <View style={fine.secHead}>
        <Text style={[fine.secTitle, styles.title]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.word} numberOfLines={1}>
          {word}
        </Text>
      </View>

      <View
        style={[styles.ruler, WEB_TOUCH]}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={title}
        accessibilityValue={{ min: 1, max: STEPS, now: value, text: set ? word : t('Not set') }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
      >
        {width > 0 && (
          <Svg width={width} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id={`${gid}f`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={JADE_DEEP} />
                <Stop offset="1" stopColor={JADE} />
              </LinearGradient>
              <RadialGradient id={`${gid}g`} cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor={JADE} stopOpacity={0.75} />
                <Stop offset="0.45" stopColor={JADE} stopOpacity={0.32} />
                <Stop offset="1" stopColor={JADE} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* La línea entera, apagada */}
            <Rect x={0} y={Y - 1} width={width} height={2} rx={1} fill="#F0EFE6" fillOpacity={0.16} />
            {/* Lo marcado: del borde al botón, en degradado jade */}
            {set && <Rect x={0} y={Y - 1} width={cx} height={2} rx={1} fill={`url(#${gid}f)`} />}
            {/* Las marcas: cortas y, en las 5 posiciones, largas */}
            {Array.from({ length: TICKS }, (_, i) => {
              const major = i % 4 === 0;
              return (
                <Rect
                  key={i}
                  x={PAD + (i * span) / (TICKS - 1) - 0.5}
                  y={Y + 5}
                  width={1}
                  height={major ? 11 : 5}
                  fill="#F0EFE6"
                  fillOpacity={major ? 0.6 : 0.28}
                />
              );
            })}
            {/* El botón: un punto de luz, como el de las demás reglas (FineGauge) y la cabeza de las líneas cometa. Antes
                era un botón marfil con borde jade grueso y aro oscuro (fundador, 2026-11-16: «muy bastos… contorno
                super gordo»). Marcado: halo jade y punto marfil; sin marcar, el punto apagado con un halo tenue */}
            <Circle cx={cx} cy={Y} r={set ? 19 : 13} fill={`url(#${gid}g)`} opacity={set ? 1 : 0.35} />
            <Circle cx={cx} cy={Y} r={set ? 6.5 : 5.5} fill={set ? IVORY : GREY} />
          </Svg>
        )}
        {/* La capa que recibe el dedo o el ratón, encima del dibujo */}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
      </View>

      <View style={styles.ends}>
        <Text style={styles.end}>{words[0]}</Text>
        <Text style={styles.end}>{words[STEPS - 1]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { flexShrink: 1 },
  word: { ...ff('medium'), fontSize: 13, color: FINE.jade, marginLeft: 'auto', paddingLeft: 8 },
  ruler: { height: H, position: 'relative' },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  end: { ...ff('regular'), fontSize: 11.5, color: FINE.mute },
});
