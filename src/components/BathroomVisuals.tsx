import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type AccessibilityActionEvent,
  type GestureResponderHandlers,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { BRISTOL_TYPES, BristolType, STOOL_COLORS, StoolColor } from '@/types/bathroom';
import { rulerStopAt, STOOL_BROWN_SCALE, STOOL_OTHER_SCALE, stripIndexAt } from '@/logic/bathroom';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Formas abstractas de la escala de Bristol: siluetas sencillas en un tono neutro, nada
// realista, para que registrar la consistencia no resulte desagradable. Desde el 2026-11-16, en el oro
// del lenguaje fino (src/theme/fine.ts); las grietas del tipo 3, en el verde oscuro del fondo.
// Desde el 2026-11-17 solo quedan en la vista previa de la sección (FeaturePreview): al apuntar, la consistencia
// va en una regla con el dibujo a línea del tipo elegido (BristolRuler y BristolLine, más abajo).
export const BristolShape = ({ type, size = 44, color = FINE.gold }: { type: BristolType; size?: number; color?: string }) => {
  const s = size;
  const shapes: Record<BristolType, React.ReactNode> = {
    1: (
      <>
        <Circle cx={s * 0.28} cy={s * 0.42} r={s * 0.1} fill={color} />
        <Circle cx={s * 0.52} cy={s * 0.36} r={s * 0.09} fill={color} />
        <Circle cx={s * 0.72} cy={s * 0.5} r={s * 0.1} fill={color} />
        <Circle cx={s * 0.42} cy={s * 0.62} r={s * 0.09} fill={color} />
      </>
    ),
    2: (
      <>
        <Circle cx={s * 0.26} cy={s * 0.5} r={s * 0.13} fill={color} />
        <Circle cx={s * 0.44} cy={s * 0.46} r={s * 0.14} fill={color} />
        <Circle cx={s * 0.62} cy={s * 0.5} r={s * 0.13} fill={color} />
        <Circle cx={s * 0.78} cy={s * 0.47} r={s * 0.11} fill={color} />
      </>
    ),
    3: (
      <>
        <Rect x={s * 0.12} y={s * 0.36} width={s * 0.76} height={s * 0.28} rx={s * 0.14} fill={color} />
        <Path d={`M ${s * 0.34} ${s * 0.38} l ${s * 0.04} ${s * 0.1} M ${s * 0.56} ${s * 0.6} l ${s * 0.04} -${s * 0.1} M ${s * 0.7} ${s * 0.38} l -${s * 0.03} ${s * 0.09}`} stroke={FINE.deep} strokeWidth={2} strokeLinecap="round" />
      </>
    ),
    4: <Rect x={s * 0.12} y={s * 0.37} width={s * 0.76} height={s * 0.26} rx={s * 0.13} fill={color} />,
    5: (
      <>
        <Ellipse cx={s * 0.3} cy={s * 0.46} rx={s * 0.14} ry={s * 0.1} fill={color} />
        <Ellipse cx={s * 0.6} cy={s * 0.42} rx={s * 0.15} ry={s * 0.11} fill={color} />
        <Ellipse cx={s * 0.48} cy={s * 0.64} rx={s * 0.13} ry={s * 0.09} fill={color} />
      </>
    ),
    6: (
      <Path
        d={`M ${s * 0.16} ${s * 0.56} q ${s * 0.06} -${s * 0.2} ${s * 0.18} -${s * 0.08} q ${s * 0.08} -${s * 0.16} ${s * 0.2} -${s * 0.04} q ${s * 0.12} -${s * 0.12} ${s * 0.2} ${s * 0.04} q ${s * 0.12} ${s * 0.06} ${s * 0.02} ${s * 0.18} q -${s * 0.1} ${s * 0.1} -${s * 0.24} ${s * 0.04} q -${s * 0.14} ${s * 0.08} -${s * 0.24} -${s * 0.02} q -${s * 0.1} -${s * 0.02} -${s * 0.12} -${s * 0.12} Z`}
        fill={color}
      />
    ),
    7: (
      <>
        <Path d={`M ${s * 0.12} ${s * 0.46} q ${s * 0.1} -${s * 0.08} ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d={`M ${s * 0.12} ${s * 0.6} q ${s * 0.1} -${s * 0.08} ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0 t ${s * 0.19} 0`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
      </>
    ),
  };
  return (
    <Svg width={s} height={s}>
      {shapes[type]}
    </Svg>
  );
};

// Luminosidad de un color (0 negro … 1 blanco). Por encima de 0,85 la gota lleva borde, para que no
// se pierda sobre el fondo.
const lum = (hex: string) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// Gota de la orina, la misma de la infografía de la newsletter (viewBox 0 0 54 70: la gota ocupa
// x 5–49, y 3–67, y su parte redonda es un círculo de radio 22 en 27,45). `size` es el alto en px.
// `ring` pinta alrededor el anillo de selección con ese color ('transparent' guarda el hueco sin
// pintarlo, para que nada salte al elegir). Lo de dentro (`children`) va centrado en la parte redonda;
// si es un número, mejor sin brillo (`shine={false}`), que se le monta encima.
// Ya no se usa para elegir el color (fundador, 2026-11-16 y 17: sin gotas): solo en la vista previa (FeaturePreview).
const RING_GAP = 3;
const RING_W = 2;
export const UrineDrop = ({
  color,
  size,
  cloudy,
  ring,
  shine = true,
  children,
}: {
  color: string;
  size: number;
  cloudy?: boolean;
  ring?: string;
  shine?: boolean;
  children?: React.ReactNode;
}) => {
  const s = size / 64; // px por unidad
  const u = (px: number) => px / s;
  // El anillo es la gota agrandada `d` unidades (la punta sube más porque es un pico)
  const d = u(RING_GAP + RING_W / 2);
  const ringPath = `M27 ${3 - 1.6 * d} C27 ${3 - 1.6 * d} ${49 + d} ${30 - 0.35 * d} ${49 + d} 45 A${22 + d} ${22 + d} 0 0 1 ${5 - d} 45 C${5 - d} ${30 - 0.35 * d} 27 ${3 - 1.6 * d} 27 ${3 - 1.6 * d}Z`;
  const side = ring ? u(RING_GAP + RING_W) : u(1);
  const top = ring ? 1.6 * d + u(RING_W / 2) : u(1);
  const vb = { x: 5 - side, y: 3 - top, w: 44 + 2 * side, h: 64 + side + top };
  const pale = lum(color) > 0.85;
  const small = size < 24;
  return (
    <View style={{ width: vb.w * s, height: vb.h * s }}>
      <Svg width={vb.w * s} height={vb.h * s} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
        {ring && ring !== 'transparent' && (
          <Path d={ringPath} fill="none" stroke={ring} strokeWidth={u(RING_W)} strokeLinejoin="round" />
        )}
        <Path
          d="M27 3 C27 3 49 30 49 45 A22 22 0 0 1 5 45 C5 30 27 3 27 3Z"
          fill={color}
          stroke={pale ? '#D9CFBE' : color}
          strokeWidth={u(small ? 1 : 1.5)}
        />
        {/* Turbia: unas motas suaves */}
        {cloudy && !small && (
          <>
            <Circle cx={30} cy={28} r={2.2} fill="#FFFFFF" opacity={0.75} />
            <Circle cx={22} cy={37} r={2.6} fill="#B5AA93" opacity={0.45} />
            <Circle cx={36} cy={41} r={3} fill="#FFFFFF" opacity={0.75} />
            <Circle cx={29} cy={50} r={2.4} fill="#B5AA93" opacity={0.45} />
            <Circle cx={39} cy={54} r={2} fill="#B5AA93" opacity={0.45} />
            <Circle cx={26} cy={60} r={2.2} fill="#FFFFFF" opacity={0.75} />
          </>
        )}
        {shine && !small && (
          <Path d="M15 44 A12 12 0 0 0 21 56" fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round" />
        )}
      </Svg>
      {children != null && (
        <View
          pointerEvents="none"
          style={[styles.dropInner, { left: (5 - vb.x) * s, top: (23 - vb.y) * s, width: 44 * s, height: 44 * s }]}
        >
          {children}
        </View>
      )}
    </View>
  );
};

// Un punto de color con su filo fino (para que lo claro y lo oscuro se vean sobre el fondo): en las muestras
// sueltas de la orina
export const ColorDot = ({ color, size = 12 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 1, borderColor: FINE.rule }} />
);

// --- Reglas que se deslizan -------------------------------------------------------------------
// La carta de color de la orina le gustó al fundador («el color de la orina y la interfaz me gusta mucho») y las
// heces van igual desde el 2026-11-17 («la misma estética que la orina, con un continuo de color sin tantos
// nombres, no como ahora con circulitos»). Todas las reglas de aquí se tocan o se arrastran, como la del check-in
// (src/components/checkin/Ruler.tsx): en JS con PanResponder, así que van igual con el dedo y con el ratón.

// En la web: cursor de mano, sin seleccionar texto al arrastrar y el scroll vertical del móvil sigue siendo del navegador
const WEB_TOUCH = (Platform.OS === 'web' ? { cursor: 'pointer', userSelect: 'none', touchAction: 'pan-y' } : {}) as ViewStyle;

// Tocar o arrastrar sobre una regla. `pick(x)` recibe la distancia al borde izquierdo de la capa que recibe el
// toque (no tiene hijos). Un toque marca donde cae; deslizar en vertical no cambia nada
function useRulerPan(pick: (x: number) => void): GestureResponderHandlers {
  // El PanResponder se crea una vez: lee lo último por referencia
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const startX = useRef(0);
  const dragging = useRef(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Mientras se arrastra, la regla no suelta el dedo (ni el scroll de la pantalla se lo lleva)
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          startX.current = e.nativeEvent.locationX;
          dragging.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!dragging.current && Math.abs(g.dx) > 3 && Math.abs(g.dx) >= Math.abs(g.dy)) dragging.current = true;
          if (dragging.current) pickRef.current(startX.current + g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (dragging.current || Math.abs(g.dy) < 12) pickRef.current(startX.current + g.dx);
          dragging.current = false;
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
      }),
    [],
  );
  return pan.panHandlers;
}

type Swatch<T extends string> = { id: T; label: string; swatch: string };

// Una regla de color: una banda de tramos seguidos y, bajo el elegido, un punto de luz (como el de FineGauge y la
// cabeza de las líneas cometa). Sin nombres: el de lo elegido lo pone quien la usa. Si `value` no es de esta
// regla, no marca nada. Para lectores de pantalla es un control que sube o baja de tramo.
export function ColorRuler<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Swatch<T>[];
  value: T | undefined;
  onChange: (id: T) => void;
  label: string; // qué es la regla, ya traducido («Color», «Otros colores»)
}) {
  const width = useRef(0);
  const index = options.findIndex((o) => o.id === value);
  const pick = (i: number) => {
    const o = options[Math.min(options.length - 1, Math.max(0, i))];
    if (o && o.id !== value) onChange(o.id);
  };
  const handlers = useRulerPan((x) => {
    if (width.current > 0 && options.length) pick(stripIndexAt(x, width.current, options.length));
  });
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') pick(index + 1);
    if (e.nativeEvent.actionName === 'decrement') pick(index < 0 ? 0 : index - 1);
  };
  return (
    <View
      style={[styles.strip, WEB_TOUCH]}
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: index >= 0 ? t(options[index].label) : t('Not set') }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
    >
      {options.map((o, i) => {
        const on = i === index;
        return (
          <View key={o.id} style={styles.stripCol}>
            <View
              style={[
                styles.stripSeg,
                { backgroundColor: o.swatch },
                i === 0 && styles.stripFirst,
                i === options.length - 1 && styles.stripLast,
                on && styles.stripSegOn,
              ]}
            />
            <View style={styles.stripMark}>{on && <View style={styles.stripGlow}><View style={styles.stripDot} /></View>}</View>
          </View>
        );
      })}
      {/* La capa que recibe el dedo o el ratón, encima del dibujo */}
      <View style={StyleSheet.absoluteFill} {...handlers} />
    </View>
  );
}

// Elegir el color de la orina, sin las gotas (fundador, 2026-11-16: «iconos de gotitas muy feos… el color es
// relevante, pero igual mejor otra cosa»). Arriba, los cinco de la escala de hidratación (de transparente a ámbar)
// como una carta de color (ColorRuler); debajo, el nombre del elegido. Aparte, los que no son de la escala (marrón,
// rosado o rojo, turbia), como muestras sueltas con su nombre. Es el mismo en «El día en general» y en cada vez
// suelta (fundador, 2026-11-17: en «Cada vez» volvían a salir las gotas: «lo pondría como "El día en general" y no
// pondría el color seleccionado (que se vea en la regla, está bastante claro)»). `compact` es el de cada vez: sin
// el nombre del elegido debajo y con las muestras sueltas centradas, como el resto de esa tarjeta.
const URINE_SCALE = ['clear', 'pale', 'yellow', 'dark', 'amber'];
export function UrineColorPicker<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: Swatch<T>[];
  value: T | undefined;
  onChange: (id: T) => void;
  compact?: boolean;
}) {
  const scale = options.filter((o) => URINE_SCALE.includes(o.id));
  const others = options.filter((o) => !URINE_SCALE.includes(o.id));
  const picked = options.find((o) => o.id === value);
  return (
    <View>
      <ColorRuler options={scale} value={value} onChange={onChange} label={t('Colour')} />
      <View style={styles.stripEnds}>
        <Text style={styles.stripEnd}>{t(scale[0]?.label ?? '')}</Text>
        <Text style={styles.stripEnd}>{t(scale[scale.length - 1]?.label ?? '')}</Text>
      </View>
      {!compact && <Text style={[styles.picked, !picked && styles.pickedNone]}>{picked ? t(picked.label) : t('Tap the closest colour')}</Text>}

      {others.length > 0 && (
        <>
          <Text style={[styles.othersHead, compact && styles.centerText]}>{t('Other colours')}</Text>
          <View style={[styles.others, compact && styles.centerRow]}>
            {others.map((o) => {
              const on = value === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.other, on && styles.otherOn]}
                  onPress={() => onChange(o.id)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(o.label)}
                >
                  <ColorDot color={o.swatch} size={12} />
                  <Text style={[styles.otherText, on && styles.otherTextOn]}>{t(o.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// Elegir el color de las heces: dos reglas como la de la orina, una con los marrones (de claro a muy oscuro) y otra
// con los demás colores, y una sola palabra con el elegido (fundador, 2026-11-17). Se guarda el mismo id de
// siempre: cada uno tiene su tramo en una de las dos (STOOL_BROWN_SCALE y STOOL_OTHER_SCALE, en logic/bathroom.ts).
// `compact` (cada vez suelta): sin la palabra del elegido, como en la orina.
const stoolSwatches = (ids: StoolColor[]) => ids.map((id) => STOOL_COLORS.find((c) => c.id === id)!).filter(Boolean);
export function StoolColorPicker({ value, onChange, compact }: { value: StoolColor | undefined; onChange: (id: StoolColor) => void; compact?: boolean }) {
  const picked = STOOL_COLORS.find((c) => c.id === value);
  return (
    <View>
      <ColorRuler options={stoolSwatches(STOOL_BROWN_SCALE)} value={value} onChange={onChange} label={t('Brown shades')} />
      {/* Sin «Otros colores» encima: un solo título, «Color», y las dos reglas una debajo de la otra (fundador, 2026-11-17) */}
      <View style={styles.rulerGap} />
      <ColorRuler options={stoolSwatches(STOOL_OTHER_SCALE)} value={value} onChange={onChange} label={t('Other colours')} />
      {!compact && <Text style={[styles.picked, styles.pickedStool, !picked && styles.pickedNone]}>{picked ? t(picked.label) : t('Tap the closest colour')}</Text>}
    </View>
  );
}

// La escala de Bristol a línea (en 120 × 44), para la regla de la consistencia: trazo fino, sin relleno. 1 bolitas
// sueltas · 2 con forma y grumosa · 3 con grietas · 4 lisa · 5 trozos blandos · 6 pastosa · 7 líquida.
const SAUSAGE = 'M22 14H98A8 8 0 0 1 98 30H22A8 8 0 0 1 22 14Z';
const BRISTOL_LINES: Record<BristolType, string> = {
  1: 'M16 24a6 6 0 1 0 12 0a6 6 0 1 0-12 0M36.5 17a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0M54 27a6 6 0 1 0 12 0a6 6 0 1 0-12 0M74.5 18a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0M92 26a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
  2: 'M24 18A11 11 0 0 1 41 15A12 12 0 0 1 60 15A12 12 0 0 1 79 15A11 11 0 0 1 96 18A5.5 5.5 0 0 1 96 26A11 11 0 0 1 79 29A12 12 0 0 1 60 29A12 12 0 0 1 41 29A11 11 0 0 1 24 26A5.5 5.5 0 0 1 24 18Z',
  3: `${SAUSAGE}M38 14l3 5M58 30l3-5M76 14l-2.5 5M91 30l-2-4.5`,
  4: SAUSAGE,
  5: 'M17 20a13 8 0 1 0 26 0a13 8 0 1 0-26 0M48 26a14 8.5 0 1 0 28 0a14 8.5 0 1 0-28 0M81 19a12 7.5 0 1 0 24 0a12 7.5 0 1 0-24 0',
  6: 'M24 28C18 28 16 21 22 19C22 13 31 11 35 16C39 10 50 10 53 16C58 11 68 12 70 18C75 13 86 14 87 20C94 18 101 23 98 28C100 33 93 36 88 33C83 37 74 37 70 33C64 37 54 37 50 33C45 37 36 37 33 33C29 35 24 33 24 28Z',
  7: 'M17.5 15q8.5-6 17 0t17 0t17 0t17 0t17 0M17.5 23q8.5-6 17 0t17 0t17 0t17 0t17 0M17.5 31q8.5-6 17 0t17 0t17 0t17 0t17 0',
};
export const BristolLine = ({ type, width = 132, color = FINE.ivory, stroke = 1.4 }: { type: BristolType; width?: number; color?: string; stroke?: number }) => (
  <View style={{ width, height: (width * 44) / 120 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={width} height={(width * 44) / 120} viewBox="0 0 120 44">
      <Path d={BRISTOL_LINES[type]} fill="none" stroke={color} strokeWidth={(stroke * 120) / width} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

// La consistencia en una regla, de muy dura a líquida, con los 7 tipos de Bristol como paradas (fundador,
// 2026-11-17: «consistencia me pregunto si se puede mejorar»; antes, siete filas con su dibujo y su explicación).
// Arriba, el dibujo a línea del tipo elegido con su nombre y su explicación; debajo, la línea con las 7 marcas y un
// punto de luz, y las palabras de los extremos. Se toca o se arrastra y salta a la parada más cercana: se guarda lo
// mismo de siempre, de 1 a 7. Sin marcar, el punto queda apagado en el centro y no hay dibujo.
const B_H = 44; // alto de la zona que se toca
const B_PAD = 14; // el punto llega justo a los extremos de la línea
const B_STOPS = BRISTOL_TYPES.length;
export function BristolRuler({ value, onChange }: { value: BristolType | undefined; onChange: (b: BristolType) => void }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const pick = (stop: number) => {
    const b = BRISTOL_TYPES[Math.min(B_STOPS - 1, Math.max(0, stop))].id;
    if (b !== value) onChange(b);
  };
  const handlers = useRulerPan((x) => {
    if (widthRef.current > 0) pick(rulerStopAt(x, widthRef.current, B_STOPS, B_PAD));
  });
  const onAction = (e: AccessibilityActionEvent) => {
    const base = value ?? 4; // sin marcar, se parte del centro
    if (e.nativeEvent.actionName === 'increment') pick(base);
    if (e.nativeEvent.actionName === 'decrement') pick(base - 2);
  };
  const type = BRISTOL_TYPES.find((b) => b.id === value);
  const span = Math.max(0, width - 2 * B_PAD);
  const at = (stop: number) => B_PAD + (stop / (B_STOPS - 1)) * span;
  const cx = at((value ?? 4) - 1);
  return (
    <View>
      {type ? (
        <View style={styles.bristolArt}>
          <BristolLine type={type.id} />
        </View>
      ) : null}
      <Text style={[styles.picked, styles.bristolName, !type && styles.pickedNone]}>{type ? t(type.label) : t('Slide to the closest one')}</Text>
      {type ? <Text style={styles.bristolHint}>{t(type.hint)}</Text> : null}
      <View
        style={[styles.bristolRuler, WEB_TOUCH]}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          widthRef.current = w;
          setWidth(w);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('Consistency')}
        accessibilityValue={{ min: 1, max: B_STOPS, now: value, text: type ? `${t(type.label)}. ${t(type.hint)}` : t('Not set') }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
      >
        {width > 0 && (
          <>
            <View style={styles.bristolTrack} />
            {BRISTOL_TYPES.map((b, i) => (
              <View key={b.id} style={[styles.bristolTick, { left: at(i) - 0.5 }]} />
            ))}
            {type ? <View style={[styles.bristolGlow, { left: cx - 11 }]} /> : null}
            <View style={[styles.bristolDot, type ? { left: cx - 4.5 } : [styles.bristolDotOff, { left: cx - 3.5 }]]} />
          </>
        )}
        {/* La capa que recibe el dedo o el ratón, encima del dibujo */}
        <View style={StyleSheet.absoluteFill} {...handlers} />
      </View>
      <View style={styles.bristolEnds}>
        <Text style={styles.stripEnd}>{t('Very hard')}</Text>
        <Text style={styles.stripEnd}>{t('Liquid')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // La carta de color (orina y heces)
  strip: { flexDirection: 'row', gap: 3 },
  stripCol: { flex: 1, alignItems: 'stretch' },
  stripSeg: { height: 34, borderRadius: 3, borderWidth: 1, borderColor: FINE.rule },
  stripFirst: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  stripLast: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  stripSegOn: { borderColor: '#F7F3E6', borderWidth: 1.5 },
  stripMark: { height: 22, alignItems: 'center', justifyContent: 'center' },
  // El punto de luz bajo el elegido, como el de las reglas (FineGauge)
  stripGlow: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(131,214,180,0.18)', alignItems: 'center', justifyContent: 'center' },
  stripDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F7F3E6' },
  stripEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  stripEnd: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  picked: { ...ff('regular'), color: FINE.ivory, fontSize: 15, textAlign: 'center', marginTop: 8 },
  pickedNone: { color: FINE.mute, fontSize: 13 },
  // Heces: el nombre de la segunda regla y la palabra del elegido, pegada a las reglas
  rulerGap: { height: 12 },
  pickedStool: { marginTop: 0 },
  othersHead: { ...fine.kicker, marginTop: 18, marginBottom: 8 },
  others: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  centerText: { textAlign: 'center' },
  centerRow: { justifyContent: 'center' },
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FINE.line,
  },
  otherOn: { borderColor: FINE.jade },
  otherText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  otherTextOn: { color: FINE.ivory },
  // La regla de la consistencia
  bristolArt: { alignItems: 'center', marginTop: 2 },
  bristolName: { marginTop: 6 },
  bristolHint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  bristolRuler: { height: B_H, marginTop: 6 },
  bristolTrack: { position: 'absolute', left: 0, right: 0, top: B_H / 2 - 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(240,239,230,0.16)' },
  bristolTick: { position: 'absolute', top: B_H / 2 + 5, width: 1, height: 9, backgroundColor: 'rgba(240,239,230,0.5)' },
  bristolGlow: { position: 'absolute', top: B_H / 2 - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(131,214,180,0.18)' },
  bristolDot: { position: 'absolute', top: B_H / 2 - 4.5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#F7F3E6' },
  bristolDotOff: { top: B_H / 2 - 3.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: FINE.mute },
  bristolEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  dropInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
