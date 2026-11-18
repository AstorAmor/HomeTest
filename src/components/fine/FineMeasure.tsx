// Piezas finas de las fichas de medición y de los registros (rediseño de días, mediciones y secciones, 2026-11-16).
// El fundador: esas pantallas «siguen con el estilo de antes» (tarjetas, títulos gordos, iconos en círculos de
// color). Aquí, el lenguaje del prototipo (src/theme/fine.ts): la cifra grande y ligera con lo suyo al lado
// (`.big`), los periodos en pestañas pequeñas con borde (`.tabs`), opciones en chips con borde (`.chipsw`), una
// fila con su marca redonda, el botón esmeralda a todo el ancho para guardar y la × de los registros.
// MetricDetailParts (los periodos) sigue aparte; desde el 2026-11-16 también va en fino.
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { RANGES, type RangeId } from '@/components/MetricDetailParts';
import { FINE, ff, fine } from '@/theme/fine';
import { t } from '@/i18n';

const DARK = '#061A16'; // la marca sobre el jade
const ON_BG = 'rgba(131,214,180,0.08)'; // el fondo apenas marcado de lo elegido

// 7D · 14D · 1M · 6M: pestañas pequeñas con borde; la elegida, en marfil con borde jade
export function FineRangeTabs({
  value,
  onChange,
  only,
  style,
}: {
  value: RangeId;
  onChange: (r: RangeId) => void;
  only?: RangeId[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tabs, style]}>
      {RANGES.filter((r) => !only || only.includes(r.id)).map((r) => {
        const on = value === r.id;
        return (
          <TouchableOpacity
            key={r.id}
            style={[styles.tab, on && styles.tabOn]}
            onPress={() => onChange(r.id)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{r.id}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// La cifra grande y ligera de una ficha, con la unidad y la fecha apagadas al lado. `word`: cuando lo que sale
// son palabras («Bien», «Podrías beber un poco más»), algo más pequeñas, en hasta dos líneas y lo suyo debajo
export function BigFigure({
  value,
  lines,
  word,
  style,
}: {
  value: string;
  lines?: (string | null | undefined | false)[];
  word?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const side = (lines ?? []).filter((l): l is string => !!l);
  return (
    <View style={[word ? styles.bigCol : styles.big, style]}>
      <Text style={[styles.bigNum, word && styles.bigWord]} numberOfLines={word ? 2 : 1} adjustsFontSizeToFit={!word} minimumFontScale={0.6}>
        {value}
      </Text>
      {side.length ? (
        <View style={word ? null : styles.bigSideBox}>
          {side.map((l, i) => (
            <Text key={i} style={styles.bigSide}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Cabecera de sección (como SecHead) con algo a la derecha: «Últimos 7 días», un total, el (i)…
export function SecRow({ title, right, style }: { title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[fine.secHead, style]}>
      <Text style={fine.secTitle} accessibilityRole="header">
        {title}
      </Text>
      {right ? <View style={styles.secRight}>{right}</View> : null}
    </View>
  );
}

// Un chip con borde (prototipo, `.chipsw`); elegido, borde jade y la letra en marfil
export function FineChip({
  label,
  sub,
  on,
  onPress,
  multi,
  style,
}: {
  label: string;
  sub?: string; // segunda línea apagada (p. ej. «330 ml»)
  on: boolean;
  onPress: () => void;
  multi?: boolean; // de los que se eligen varios
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn, style]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      {sub ? <Text style={styles.chipSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

// Una fila de chips en la que se elige uno (como ChoiceChips, en fino)
export function FineChips<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { id: T; label: string }[];
  value: T | undefined | null;
  onChange: (id: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.chips, style]} accessibilityRole="radiogroup">
      {options.map((o) => (
        <FineChip key={String(o.id)} label={o.label} on={value === o.id} onPress={() => onChange(o.id)} />
      ))}
    </View>
  );
}

// Marca redonda: vacía con un borde fino; marcada, rellena de jade con el check
export function FineMark({ on, size = 24 }: { on: boolean; size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }, on && styles.markOn]}>
      {on ? <Ionicons name="checkmark" size={Math.round(size * 0.62)} color={DARK} /> : null}
    </View>
  );
}

// Una fila con línea fina que se marca o desmarca («Me despertó por la noche»)
export function CheckRow({ label, on, onPress, style }: { label: string; on: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity
      style={[fine.row, style]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Text style={[fine.rowTitle, styles.flex]}>{label}</Text>
      <FineMark on={on} />
    </TouchableOpacity>
  );
}

// El botón esmeralda a todo el ancho (Guardar). `dim`: apagado pero se puede pulsar (como el ✓ de antes)
export function FineButton({
  label,
  onPress,
  disabled,
  dim,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  dim?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || dim) && styles.buttonOff, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Un enlace en jade (acción secundaria), con un icono a línea delante si hace falta
export function FineLink({
  label,
  onPress,
  icon,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.link, disabled && styles.linkOff, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon ? <Ionicons name={icon} size={15} color={FINE.jade} /> : null}
      <Text style={[fine.link, styles.linkText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

// La × de cerrar de los registros (van en hoja que sube desde abajo), a la derecha del título
export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.close} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Close')}>
      <Ionicons name="close" size={24} color={FINE.ivory} />
    </TouchableOpacity>
  );
}

// Iconos a línea, finos, para las pocas fichas en las que un icono ayuda (el fundador, 2026-11-16: los de antes «se
// ven un poco bastos»). Dibujados a 24 × 24 como los de GoalEmblem; el trazo queda en unos 1,4 px a cualquier tamaño
const GLYPHS = {
  camera: 'M3.5 9a2 2 0 0 1 2-2h2.2l1.5-2.2h5.6L16.3 7h2.2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V9zM12 9.6a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 1 0 0-6.6z',
  up: 'M3.5 16.5l5.3-5.3 3.7 3.7L20 7.4M15 7.4h5v5',
  down: 'M3.5 7.5l5.3 5.3 3.7-3.7L20 16.6M15 16.6h5v-5',
} as const;
export type FineGlyphName = keyof typeof GLYPHS;

export function FineGlyph({ name, size = 16, color = FINE.mute, stroke = 1.4 }: { name: FineGlyphName; size?: number; color?: string; stroke?: number }) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={GLYPHS[name]} fill="none" stroke={color} strokeWidth={(stroke * 24) / size} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export const measureStyles = StyleSheet.create({
  // Texto largo de lectura (el «.art p» del prototipo)
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  // Caja de texto como «Tu diario» del check-in
  input: {
    ...ff('regular'),
    minHeight: 70,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
    color: FINE.ivory,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  // El pie fijo con el botón de guardar
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, alignItems: 'stretch' },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tab: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20, borderWidth: 1, borderColor: FINE.line, minHeight: 30, justifyContent: 'center' },
  tabOn: { borderColor: FINE.jade },
  tabText: { ...ff('regular'), fontSize: 12.5, color: FINE.mute },
  tabTextOn: { color: FINE.ivory },
  big: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  bigNum: { ...fine.num, fontSize: 44, lineHeight: 52, flexShrink: 1 },
  bigCol: { marginTop: 4, gap: 4 },
  bigWord: { fontSize: 32, lineHeight: 38 },
  bigSideBox: { flex: 1, minWidth: 110 },
  bigSide: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  secRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: FINE.line },
  chipOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  chipText: { ...ff('regular'), fontSize: 13, color: FINE.mute },
  chipTextOn: { color: FINE.ivory },
  chipSub: { ...ff('regular'), fontSize: 11.5, color: FINE.mute, marginTop: 1 },
  mark: { borderWidth: 1, borderColor: 'rgba(240,239,230,0.3)', alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: FINE.jade, borderColor: FINE.jade },
  button: { minHeight: 48, borderRadius: 24, backgroundColor: FINE.emerald, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonOff: { opacity: 0.4 },
  buttonText: { ...ff('medium'), color: '#F0EFE6', fontSize: 15 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', minHeight: 40, paddingHorizontal: 6 },
  linkOff: { opacity: 0.5 },
  linkText: { fontSize: 14 },
  close: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
});
