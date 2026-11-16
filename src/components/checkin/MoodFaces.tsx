// Los estados de ánimo del check-in, dibujados a línea en vez de emojis (fundador, 2026-11-16: «habíamos
// quedado que ibas a poner iconos, no emojis»). Son las caras del prototipo (borradores/app-estructura/prototipo,
// FACES): un círculo y unos trazos finos, sin relleno, del color del texto. Los ids que se guardan son los de
// siempre (src/types/checkIn.ts); solo cambia el dibujo.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { MOOD_PICKER, type Mood } from '@/types/checkIn';
import { FINE, ff } from '@/theme/fine';
import { t } from '@/i18n';

// Cada cara: a qué altura van los ojos de punto (si los lleva), los trazos y, en Acelerado, los ojos abiertos
type Face = { eyes?: number; d: string; rings?: boolean };

const FACES: Record<Mood, Face> = {
  // Ilusionado: ojos en arco y sonrisa abierta
  excited: { d: 'M7.5 10.5q1.5-2 3 0M13.5 10.5q1.5-2 3 0M7.5 14q4.5 5 9 0' },
  happy: { eyes: 10.3, d: 'M8.5 14.5q3.5 3 7 0' },
  // Tranquilo: ojos cerrados y sonrisa suave
  calm: { d: 'M7.5 10q1.5 1.5 3 0M13.5 10q1.5 1.5 3 0M9.5 15q2.5 1.5 5 0' },
  neutral: { eyes: 10.3, d: 'M9 15.5h6' },
  sad: { eyes: 10.8, d: 'M7.5 8.8l2.5-1M16.5 8.8l-2.5-1M9 16.5q3-2.5 6 0' },
  // Acelerado: ojos muy abiertos y la boca en zigzag
  wired: { rings: true, d: 'M8.4 15.6l1.2-1 1.2 1 1.2-1 1.2 1 1.2-1 1.2 1' },
  anxious: { eyes: 10.8, d: 'M7.5 8.8l2.5-1M16.5 8.8l-2.5-1M9 16q1.5-1.5 3 0t3 0' },
  stressed: { d: 'M8 9.2l2 1.2-2 1.2M16 9.2l-2 1.2 2 1.2M9 16.5q3-2 6 0' },
  irritable: { eyes: 11, d: 'M7.5 8l2.5 1.2M16.5 8l-2.5 1.2M9.2 16h5.6' },
  // Desmotivado ya no se elige, pero los check-ins antiguos que lo llevan también tienen su cara
  unmotivated: { d: 'M7.6 10.8h2.8M13.6 10.8h2.8M9.5 16q2.5-1 5 0' },
};

// Una cara suelta (viewBox 24×24, trazo de 1,25)
export function MoodFace({ mood, size = 40, color }: { mood: Mood; size?: number; color: string }) {
  const f = FACES[mood];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={9.5} />
        {f.eyes !== undefined && (
          <>
            <Circle cx={9} cy={f.eyes} r={0.9} fill={color} stroke="none" />
            <Circle cx={15} cy={f.eyes} r={0.9} fill={color} stroke="none" />
          </>
        )}
        {f.rings && (
          <>
            <Circle cx={9} cy={10.3} r={1.4} />
            <Circle cx={15} cy={10.3} r={1.4} />
          </>
        )}
        <Path d={f.d} />
      </G>
    </Svg>
  );
}

// Los 9 que se eligen, de 3 en 3, con su nombre debajo. El elegido, en jade con un borde jade suave.
export function MoodFaces({ value, onChange }: { value?: Mood; onChange: (m: Mood) => void }) {
  const rows = Array.from({ length: Math.ceil(MOOD_PICKER.length / 3) }, (_, i) => MOOD_PICKER.slice(i * 3, i * 3 + 3));
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((m) => {
            const on = value === m.id;
            const c = on ? FINE.jade : FINE.mute;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.item, on && styles.itemOn]}
                onPress={() => onChange(m.id)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(m.label)}
              >
                <MoodFace mood={m.id} color={c} />
                <Text style={[styles.label, { color: c }]} numberOfLines={1}>
                  {t(m.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* La última fila, si se quedara corta, mantiene el ancho de las columnas */}
          {Array.from({ length: 3 - row.length }, (_, i) => (
            <View key={`gap${i}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 78,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemOn: { borderColor: 'rgba(131,214,180,0.5)', backgroundColor: 'rgba(131,214,180,0.07)' },
  filler: { flex: 1 },
  label: { ...ff('regular'), fontSize: 12 },
});
