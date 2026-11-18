// El lenguaje visual del prototipo de las 4 pestañas (borradores/app-estructura/prototipo, 2026-11-16). El
// fundador, al ver la app: «se veía mucho más fino en el localhost… la fuente y todo». Es esto:
// - Letra Inter en pesos finos: 300 para las cifras grandes, 400 el texto, 500 los títulos, 600 las cabeceras.
// - Cabeceras de sección pequeñas, en mayúsculas y apagadas; el enlace de la derecha, en jade.
// - Filas con una línea fina debajo, sin tarjeta ni icono de color; las tarjetas que quedan, casi transparentes.
// - Paleta: esmeralda muy oscuro, jade para lo que avanza, oro para lo de pago y lo que hay que revisar.
// Inter se carga en index.js antes de pintar nada; si no llegara, cada texto sale con la letra del sistema.
import { StyleSheet, type TextStyle } from 'react-native';
import { Colors } from '@/constants/colors';

// Cada peso es su propia familia (en Android fontWeight no elige el archivo): nunca se pone fontWeight con estas
export const INTER = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;
export const ff = (w: keyof typeof INTER): TextStyle => ({ fontFamily: INTER[w] });

const L = Colors.isLight; // la app va solo en oscuro desde el 2026-11-16; el claro, por si vuelve
export const FINE = {
  ivory: L ? Colors.textPrimary : '#F0EFE6',
  mute: L ? Colors.textMuted : '#8D9E95',
  jade: L ? '#17634B' : '#83D6B4',
  gold: L ? '#9C7A45' : '#D8B978',
  emerald: '#17634B',
  deep: L ? '#EDE8DC' : '#0B2921',
  line: L ? 'rgba(42,42,42,0.10)' : 'rgba(240,239,230,0.09)',
  // La raya entre secciones, algo más clara que la de las filas (fundador, 2026-11-16: «un separador más claro»)
  rule: L ? 'rgba(42,42,42,0.18)' : 'rgba(240,239,230,0.17)',
  tile: L ? 'rgba(42,42,42,0.035)' : 'rgba(240,239,230,0.045)',
  goldLine: 'rgba(216,185,120,0.5)',
  jadeLine: 'rgba(131,214,180,0.4)',
};

export const fine = StyleSheet.create({
  // Título de cada pestaña y la línea de debajo
  title: { ...ff('medium'), fontSize: 26, lineHeight: 32, letterSpacing: -0.3, color: FINE.ivory },
  lead: { ...ff('regular'), fontSize: 13, lineHeight: 18, color: FINE.mute, marginTop: 2 },
  // Cabecera de sección: «ESTA SEMANA                Tu plan ›»
  // Cada sección empieza con una raya fina a lo ancho y su título debajo
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 6,
    paddingTop: 14,
    minHeight: 46,
    borderTopWidth: 1,
    borderTopColor: FINE.rule,
  },
  secTitle: { ...ff('semibold'), fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', color: FINE.mute },
  secMore: { ...ff('regular'), fontSize: 12.5, color: FINE.jade, marginLeft: 'auto' },
  // Fila con una línea fina debajo
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, minHeight: 50, borderBottomWidth: 1, borderBottomColor: FINE.line },
  rowTitle: { ...ff('medium'), fontSize: 15, lineHeight: 20, color: FINE.ivory },
  rowSub: { ...ff('regular'), fontSize: 12.5, lineHeight: 17, color: FINE.mute, marginTop: 1 },
  rowValue: { ...ff('regular'), fontSize: 14, color: FINE.ivory, fontVariant: ['tabular-nums'] },
  // Textos sueltos
  body: { ...ff('regular'), fontSize: 15, lineHeight: 21, color: FINE.ivory },
  note: { ...ff('regular'), fontSize: 12.5, lineHeight: 18, color: FINE.mute, marginTop: 8 },
  kicker: { ...ff('regular'), fontSize: 10.5, letterSpacing: 0.95, textTransform: 'uppercase', color: FINE.mute },
  link: { ...ff('regular'), fontSize: 13, color: FINE.jade },
  // Cifras: grandes y ligeras, con la unidad pequeña y apagada
  num: { ...ff('light'), color: FINE.ivory, fontVariant: ['tabular-nums'] },
  unit: { ...ff('regular'), fontSize: 12, color: FINE.mute },
  // Tarjeta casi transparente (las pocas que quedan)
  tile: { padding: 12, borderRadius: 14, backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line },
  // Botón píldora: esmeralda, o con borde de oro para lo de pago
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: FINE.emerald, minHeight: 36, justifyContent: 'center', alignItems: 'center' },
  pillText: { ...ff('medium'), fontSize: 13, color: '#F0EFE6' },
  pillGold: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(216,185,120,0.55)' },
  pillGoldText: { color: FINE.gold },
  // Etiquetas pequeñas con borde: candado de la suscripción (oro) o «nuevo» (jade)
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { ...ff('regular'), fontSize: 11 },
});
